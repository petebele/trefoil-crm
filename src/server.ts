import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';
import { addClient, removeClient } from './realtime';
import type { AppEnv } from './types';
import { db } from './db';
import { getSessionPerson } from './auth/session';
import { runWithImpersonator, getImpersonationTarget, IMP_COOKIE } from './auth/impersonation';
import { runWithLocale, isLocale, DEFAULT_LOCALE, type Locale } from './i18n';
import type { PersonsTable } from './db/schema';
import { setupRoutes } from './web/setup';
import { authRoutes } from './web/auth';
import { dashboardRoutes } from './web/dashboard';
import { adminRoutes } from './web/admin';
import { zakazniciRoutes } from './web/zakaznici';
import { firmyRoutes } from './web/firmy';
import { osobyRoutes } from './web/osoby';
import { sluzbyZakaznikaRoutes } from './web/sluzbyZakaznika';
import { vykazyRoutes } from './web/vykazy';
import { ukolyRoutes } from './web/ukoly';
import { poznamkyRoutes } from './web/poznamky';
import { notifikaceRoutes } from './web/notifikace';
import { impersonaceRoutes } from './web/impersonace';

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

  const realPerson = await getSessionPerson(getCookie(c, 'sid'));

  // Přepínání uživatelů (admin „Zobrazit jako…"): je‑li cookie `imp` a SKUTEČNÁ osoba je admin,
  // stává se efektivní osobou cíl (vidí i jedná jako on). Podvrhnutá cookie bez admin session = ignorováno.
  let person = realPerson;
  let impersonator: PersonsTable | null = null;
  const impId = getCookie(c, IMP_COOKIE);
  if (impId && realPerson && realPerson.is_admin === 1 && tenant && impId !== realPerson.id) {
    const target = await getImpersonationTarget(tenant.id, impId);
    if (target) {
      person = target;
      impersonator = realPerson;
    }
  }
  c.set('person', person);
  c.set('impersonator', impersonator);

  // jazyk UI: volba EFEKTIVNÍ osoby (DB) > cookie (před přihlášením) > výchozí
  const userLang = person?.lang ?? undefined;
  const cookieLang = getCookie(c, 'lang');
  const locale: Locale = isLocale(userLang) ? userLang : isLocale(cookieLang) ? cookieLang : DEFAULT_LOCALE;
  c.set('locale', locale);

  // zbytek požadavku (vč. vykreslení JSX) běží v kontextu jazyka i impersonace → t()/formátovače + banner
  return runWithLocale(locale, () => runWithImpersonator(impersonator, next));
});

// Tok přístupu: prázdná DB → průvodce založením; bez přihlášení → login
app.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.startsWith('/static/')) return next();
  if (path === '/jazyk') return next(); // přepnutí jazyka funguje i bez přihlášení

  const tenant = c.get('tenant');
  const person = c.get('person');

  if (!tenant && path !== '/zalozeni') return c.redirect('/zalozeni');
  if (tenant && path === '/zalozeni') return c.redirect('/');
  if (tenant && !person && path !== '/login') return c.redirect('/login');
  if (person && path === '/login') return c.redirect('/');

  return next();
});

// Realtime: SSE stream událostí pro otevřená okna (viz src/realtime.ts)
app.get('/live', (c) => {
  if (!c.get('person')) return c.redirect('/login');
  return streamSSE(c, async (stream) => {
    const send = (data: string) => void stream.writeSSE({ data });
    addClient(send);
    stream.onAbort(() => removeClient(send));
    // Keep-alive ping; při odpojení klienta smyčku ukončíme, ať nepíšeme do zavřeného streamu.
    while (!stream.aborted) {
      await stream.sleep(25_000);
      if (stream.aborted) break;
      try {
        await stream.writeSSE({ event: 'ping', data: '' });
      } catch {
        break;
      }
    }
    removeClient(send);
  });
});

app.route('/', setupRoutes);
app.route('/', authRoutes);
app.route('/', dashboardRoutes);
app.route('/', adminRoutes);
app.route('/', zakazniciRoutes);
app.route('/', sluzbyZakaznikaRoutes);
app.route('/', vykazyRoutes);
app.route('/', ukolyRoutes);
app.route('/', poznamkyRoutes);
app.route('/', notifikaceRoutes);
app.route('/', impersonaceRoutes);
app.route('/', firmyRoutes);
app.route('/', osobyRoutes);
