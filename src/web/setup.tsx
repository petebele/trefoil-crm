import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { db } from '../db';
import { newId, now } from '../lib/util';
import { hashPassword } from '../auth/password';
import { createSession } from '../auth/session';
import { MODULES, isModuleKey } from '../modules';

export const setupRoutes = new Hono<AppEnv>();

/** Průvodce prvním spuštěním: založení Organizace + účtu správce + výběr modulů. */
function SetupPage(props: { error?: string; orgName?: string; name?: string; email?: string }) {
  return (
    <html lang="cs">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Založení organizace · Conviu CRM</title>
        <link rel="stylesheet" href="/static/theme.css" />
      </head>
      <body>
        <main class="page" style="max-width:560px">
          <div style="text-align:center;margin:2.5rem 0 1.5rem">
            <h1>Vítej v Conviu CRM</h1>
            <p class="sub">Začneme založením tvé organizace. Zabere to minutu.</p>
          </div>

          <div class="card" style="padding:1.5rem">
            {props.error ? <div class="form-error">{props.error}</div> : null}
            <form method="post" action="/zalozeni">
              <h3 class="section-title" style="margin-top:0">Organizace</h3>
              <div class="field">
                <label>
                  Název organizace <span class="req">*</span>
                </label>
                <input class="input" type="text" name="org_name" value={props.orgName ?? ''} placeholder="např. Conviu" required autofocus />
                <span class="help">Společnost nebo tým, který bude CRM používat. Kolegy pozveš později.</span>
              </div>

              <h3 class="section-title">Tvůj účet (správce)</h3>
              <div class="field">
                <label>
                  Jméno <span class="req">*</span>
                </label>
                <input class="input" type="text" name="name" value={props.name ?? ''} placeholder="Jméno a příjmení" required />
              </div>
              <div class="field">
                <label>
                  E-mail <span class="req">*</span>
                </label>
                <input class="input" type="email" name="email" value={props.email ?? ''} required />
              </div>
              <div class="field">
                <label>
                  Heslo <span class="req">*</span>
                </label>
                <input class="input" type="password" name="password" minlength={6} required />
                <span class="help">Alespoň 6 znaků.</span>
              </div>

              <h3 class="section-title">Moduly</h3>
              <p class="sub" style="margin-top:-.3rem">
                Vyber, co budete používat — v aplikaci se zobrazí jen zapnuté moduly.
                Kdykoli to změníš v Administraci.
              </p>
              {MODULES.map((m) => (
                <label style="display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;cursor:pointer">
                  <input type="checkbox" name="modules" value={m.key} checked style="width:17px;height:17px;margin-top:.15rem;accent-color:var(--accent)" />
                  <span>
                    <span style="font-weight:600">{m.label}</span>
                    <span class="sub" style="display:block">{m.desc}</span>
                  </span>
                </label>
              ))}

              <div class="form-actions">
                <button class="btn btn-primary" type="submit">
                  Založit a vstoupit
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
  const orgName = String(body.org_name ?? '').trim();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

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
  setCookie(c, 'sid', sid, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return c.redirect('/');
});
