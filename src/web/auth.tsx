import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { db } from '../db';
import { verifyPassword } from '../auth/password';
import { createSession, destroySession, setSessionCookie, clearSessionCookie } from '../auth/session';
import { clearImpersonationCookie } from '../auth/impersonation';
import { readForm } from '../lib/util';
import { isLocale, tr, getLocale } from '../i18n';
import { HeadAssets } from './head';

export const authRoutes = new Hono<AppEnv>();

/** Značka Trefoil — trojlístek (tři lístky) v barvě akcentu. */
function TrefoilMark() {
  return (
    <svg class="login-logo" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <circle cx="16" cy="9.6" r="6.3" />
      <circle cx="9.8" cy="20" r="6.3" />
      <circle cx="22.2" cy="20" r="6.3" />
    </svg>
  );
}

/**
 * Titulní/přihlašovací stránka: vystředěná brandovaná karta s logem a přihlášením.
 * (Aplikace poběží na subdoméně; veřejný web + login na doméně. Zatím základ + formulář.)
 */
function LoginPage(props: { orgName: string; email?: string; error?: string }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadAssets title={`${tr('Přihlášení')} · Trefoil CRM`} />
      </head>
      <body class="login-body">
        <main class="login-wrap">
          <div class="login-card">
            <div class="login-brand">
              <TrefoilMark />
              <span class="login-wm">Trefoil <small>CRM</small></span>
            </div>
            <p class="login-sub">
              {props.orgName ? tr('Přihlášení do organizace {org}', { org: props.orgName }) : tr('Přihlášení')}
            </p>
            {props.error ? <div class="form-error">{tr(props.error)}</div> : null}
            <form method="post" action="/login">
              <div class="field">
                <label>{tr('E-mail')}</label>
                <input class="input" type="email" name="email" value={props.email ?? ''} required autofocus />
              </div>
              <div class="field">
                <label>{tr('Heslo')}</label>
                <input class="input" type="password" name="password" required />
              </div>
              <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:.4rem">
                {tr('Přihlásit se')}
              </button>
            </form>
          </div>
          <p class="login-foot">Trefoil CRM</p>
        </main>
      </body>
    </html>
  );
}

authRoutes.get('/login', (c) => {
  const tenant = c.get('tenant');
  return c.html(<LoginPage orgName={tenant?.name ?? ''} />);
});

authRoutes.post('/login', async (c) => {
  const tenant = c.get('tenant');
  const f = readForm(await c.req.parseBody());
  const email = f.email('email');
  const password = f.raw('password');

  const person = await db
    .selectFrom('persons')
    .selectAll()
    .where('login_email', '=', email)
    .where('is_active', '=', 1)
    .executeTakeFirst();

  if (!person || !person.password_hash || !verifyPassword(password, person.password_hash)) {
    return c.html(<LoginPage orgName={tenant?.name ?? ''} email={email} error="Neplatný e-mail nebo heslo." />, 401);
  }

  const sid = await createSession(person.id);
  setSessionCookie(c, sid);
  return c.redirect('/');
});

authRoutes.post('/logout', async (c) => {
  await destroySession(getCookie(c, 'sid'));
  clearSessionCookie(c);
  clearImpersonationCookie(c); // odhlášení ukončí i případnou impersonaci
  return c.redirect('/login');
});

/** Přepnutí jazyka UI: cookie (i pro nepřihlášené) + uložení k uživateli. */
authRoutes.post('/jazyk', async (c) => {
  const lang = readForm(await c.req.parseBody()).str('lang');
  const back = c.req.header('referer') ?? '/';
  if (!isLocale(lang)) return c.redirect(back);
  setCookie(c, 'lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' });
  const person = c.get('person');
  if (person) await db.updateTable('persons').set({ lang }).where('id', '=', person.id).execute();
  return c.redirect(back);
});
