import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { db } from '../db';
import { Layout } from './layout';
import { MODULES, isModuleKey } from '../modules';

export const adminRoutes = new Hono<AppEnv>();

/** Administrace jen pro adminy Organizace. */
const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const person = c.get('person');
  if (!person || person.is_admin !== 1) return c.redirect('/');
  await next();
};
adminRoutes.use('/administrace', requireAdmin);
adminRoutes.use('/administrace/*', requireAdmin);

adminRoutes.get('/administrace', (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const enabled = c.get('modules');

  return c.html(
    <Layout title="Administrace" person={person} modules={enabled} active="administrace">
      <div class="page-head">
        <h1>Administrace</h1>
      </div>
      <p class="sub" style="margin-top:.2rem">Organizace: <b>{tenant.name}</b></p>

      <div class="card" style="max-width:560px;margin-top:1rem">
        <div class="card-head">
          <h3>Moduly</h3>
        </div>
        <p class="sub" style="margin-top:-.4rem">
          Zapnuté moduly vidí všichni v organizaci. Vypnutím se nic nemaže — modul jen zmizí
          z aplikace a po zapnutí je vše zpátky.
        </p>
        <form method="post" action="/administrace/moduly">
          {MODULES.map((m) => (
            <label style="display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;cursor:pointer">
              <input
                type="checkbox"
                name="modules"
                value={m.key}
                checked={enabled.has(m.key)}
                style="width:17px;height:17px;margin-top:.15rem;accent-color:var(--accent)"
              />
              <span>
                <span style="font-weight:600">{m.label}</span>
                {m.built ? null : <span class="chip chip-soft-gray" style="margin-left:.45rem">připravujeme</span>}
                <span class="sub" style="display:block">{m.desc}</span>
              </span>
            </label>
          ))}
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">
              Uložit
            </button>
          </div>
        </form>
      </div>
    </Layout>,
  );
});

adminRoutes.post('/administrace/moduly', async (c) => {
  const tenant = c.get('tenant')!;
  const body = await c.req.parseBody({ all: true });
  const raw = body.modules;
  const keys = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).filter(isModuleKey);

  await db.deleteFrom('tenant_modules').where('tenant_id', '=', tenant.id).execute();
  for (const key of keys) {
    await db.insertInto('tenant_modules').values({ tenant_id: tenant.id, module: key }).execute();
  }
  return c.redirect('/administrace');
});
