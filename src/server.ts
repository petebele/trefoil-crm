import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { serveStatic } from '@hono/node-server/serve-static';
import type { AppEnv } from './types';
import { db } from './db';
import { getSessionPerson } from './auth/session';
import { setupRoutes } from './web/setup';
import { authRoutes } from './web/auth';
import { dashboardRoutes } from './web/dashboard';
import { adminRoutes } from './web/admin';

export const app = new Hono<AppEnv>();

// Statické soubory (theme.css, app.js, htmx)
app.use('/static/*', serveStatic({ root: './public', rewriteRequestPath: (p) => p.replace(/^\/static/, '') }));

// Kontext požadavku: Organizace + zapnuté moduly + přihlášená osoba
app.use('*', async (c, next) => {
  const tenant = (await db.selectFrom('tenants').selectAll().executeTakeFirst()) ?? null;
  c.set('tenant', tenant);

  const enabled = new Set<string>();
  if (tenant) {
    const rows = await db.selectFrom('tenant_modules').select('module').where('tenant_id', '=', tenant.id).execute();
    for (const r of rows) enabled.add(r.module);
  }
  c.set('modules', enabled);

  c.set('person', await getSessionPerson(getCookie(c, 'sid')));
  await next();
});

// Tok přístupu: prázdná DB → průvodce založením; bez přihlášení → login
app.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.startsWith('/static/')) return next();

  const tenant = c.get('tenant');
  const person = c.get('person');

  if (!tenant && path !== '/zalozeni') return c.redirect('/zalozeni');
  if (tenant && path === '/zalozeni') return c.redirect('/');
  if (tenant && !person && path !== '/login') return c.redirect('/login');
  if (person && path === '/login') return c.redirect('/');

  return next();
});

app.route('/', setupRoutes);
app.route('/', authRoutes);
app.route('/', dashboardRoutes);
app.route('/', adminRoutes);
