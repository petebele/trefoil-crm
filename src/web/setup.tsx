import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { db } from '../db';
import { newId, now, readForm } from '../lib/util';
import { hashPassword } from '../auth/password';
import { createSession, setSessionCookie } from '../auth/session';
import { MODULES, isModuleKey } from '../modules';
import { seedTenantLists } from '../db/seed';
import { tr, getLocale } from '../i18n';
import { HeadAssets } from './head';

export const setupRoutes = new Hono<AppEnv>();

/** Průvodce prvním spuštěním: založení Organizace + účtu správce + výběr modulů. */
function SetupPage(props: { error?: string; orgName?: string; name?: string; email?: string }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadAssets title={`${tr('Založení organizace')} · Trefoil CRM`} />
      </head>
      <body>
        <main class="page" style="max-width:560px">
          <div style="text-align:center;margin:2.5rem 0 1.5rem">
            <h1>{tr('Vítej v Trefoil CRM')}</h1>
            <p class="sub">{tr('Začneme založením tvé organizace. Zabere to minutu.')}</p>
          </div>

          <div class="card" style="padding:1.5rem">
            {props.error ? <div class="form-error">{tr(props.error)}</div> : null}
            <form method="post" action="/zalozeni">
              <h3 class="section-title" style="margin-top:0">{tr('Organizace')}</h3>
              <div class="field">
                <label>
                  {tr('Název organizace')} <span class="req">*</span>
                </label>
                <input class="input" type="text" name="org_name" value={props.orgName ?? ''} placeholder={tr('např. Trefoil')} required autofocus />
                <span class="help">{tr('Společnost nebo tým, který bude CRM používat. Kolegy pozveš později.')}</span>
              </div>

              <h3 class="section-title">{tr('Tvůj účet (správce)')}</h3>
              <div class="field">
                <label>
                  {tr('Jméno')} <span class="req">*</span>
                </label>
                <input class="input" type="text" name="name" value={props.name ?? ''} placeholder={tr('Jméno a příjmení')} required />
              </div>
              <div class="field">
                <label>
                  {tr('E-mail')} <span class="req">*</span>
                </label>
                <input class="input" type="email" name="email" value={props.email ?? ''} required />
              </div>
              <div class="field">
                <label>
                  {tr('Heslo')} <span class="req">*</span>
                </label>
                <input class="input" type="password" name="password" minlength={6} required />
                <span class="help">{tr('Alespoň 6 znaků.')}</span>
              </div>

              <h3 class="section-title">{tr('Moduly')}</h3>
              <p class="sub" style="margin-top:-.3rem">
                {tr('Vyber, co budete používat — v aplikaci se zobrazí jen zapnuté moduly. Kdykoli to změníš v Administraci.')}
              </p>
              {MODULES.map((m) => (
                <label style="display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;cursor:pointer">
                  <input type="checkbox" name="modules" value={m.key} checked style="width:17px;height:17px;margin-top:.15rem;accent-color:var(--accent)" />
                  <span>
                    <span style="font-weight:600">{tr(m.label)}</span>
                    <span class="sub" style="display:block">{tr(m.desc)}</span>
                  </span>
                </label>
              ))}

              <div class="form-actions">
                <button class="btn btn-primary" type="submit">
                  {tr('Založit a vstoupit')}
                </button>
              </div>
            </form>
          </div>
        </main>
      </body>
    </html>
  );
}

setupRoutes.get('/zalozeni', (c) => c.html(<SetupPage />));

setupRoutes.post('/zalozeni', async (c) => {
  // pojistka: založit lze jen úplně první Organizaci
  const existing = await db.selectFrom('tenants').select('id').executeTakeFirst();
  if (existing) return c.redirect('/');

  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const orgName = f.str('org_name');
  const name = f.str('name');
  const email = f.email('email');
  const password = f.raw('password');

  const rawModules = body.modules;
  const moduleKeys = (Array.isArray(rawModules) ? rawModules : rawModules ? [rawModules] : [])
    .map(String)
    .filter(isModuleKey);

  if (!orgName || !name || !email || password.length < 6) {
    return c.html(
      <SetupPage error="Vyplň prosím všechna pole (heslo alespoň 6 znaků)." orgName={orgName} name={name} email={email} />,
      400,
    );
  }

  const tenantId = newId();
  await db.insertInto('tenants').values({ id: tenantId, name: orgName, created_at: now() }).execute();
  await seedTenantLists(tenantId);

  for (const key of moduleKeys) {
    await db.insertInto('tenant_modules').values({ tenant_id: tenantId, module: key }).execute();
  }

  const personId = newId();
  await db
    .insertInto('persons')
    .values({
      id: personId,
      tenant_id: tenantId,
      name,
      login_email: email,
      password_hash: hashPassword(password),
      is_admin: 1,
      is_active: 1,
      created_at: now(),
      deleted_at: null,
    })
    .execute();

  const sid = await createSession(personId);
  setSessionCookie(c, sid);
  return c.redirect('/');
});
