import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { db } from '../db';
import { verifyPassword } from '../auth/password';
import { createSession, destroySession } from '../auth/session';

export const authRoutes = new Hono<AppEnv>();

function LoginPage(props: { orgName: string; email?: string; error?: string }) {
  return (
    <html lang="cs">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Přihlášení · Conviu CRM</title>
        <link rel="stylesheet" href="/static/theme.css" />
      </head>
      <body>
        <main class="page" style="max-width:420px">
          <div class="card" style="padding:1.6rem;margin-top:4rem">
            <h1 style="font-size:1.3rem">Conviu CRM</h1>
            <p class="sub" style="margin:.2rem 0 1.2rem">Přihlášení do organizace {props.orgName}</p>
            {props.error ? <div class="form-error">{props.error}</div> : null}
            <form method="post" action="/login">
              <div class="field">
                <label>E-mail</label>
                <input class="input" type="email" name="email" value={props.email ?? ''} required autofocus />
              </div>
              <div class="field">
                <label>Heslo</label>
                <input class="input" type="password" name="password" required />
              </div>
              <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center">
                Přihlásit se
              </button>
            </form>
          </div>
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
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

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
  setCookie(c, 'sid', sid, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return c.redirect('/');
});

authRoutes.post('/logout', async (c) => {
  await destroySession(getCookie(c, 'sid'));
  deleteCookie(c, 'sid', { path: '/' });
  return c.redirect('/login');
});
