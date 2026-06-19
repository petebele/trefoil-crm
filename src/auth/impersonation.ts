import { AsyncLocalStorage } from 'node:async_hooks';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { db } from '../db';
import { config } from '../config';
import type { PersonsTable } from '../db/schema';

/**
 * Přepínání uživatelů (admin „Zobrazit jako…") — plná impersonace.
 * Stav nese krátká httpOnly cookie `imp` = id cílové osoby; autorizaci hlídá middleware
 * podle SKUTEČNÉ session (jen admin). Skutečného admina (kvůli banneru) neseme request‑scoped
 * přes AsyncLocalStorage — stejný vzor jako jazyk —, takže `Layout` ho přečte bez protahování.
 * Bez nové tabulky. Viz spec `docs/specs/prepinani-uzivatelu-v1.md`.
 */

export const IMP_COOKIE = 'imp';

const store = new AsyncLocalStorage<PersonsTable | null>();

/** Spustí zpracování požadavku s vědomím, kdo (admin) právě prohlíží jako někdo jiný. */
export function runWithImpersonator<T>(admin: PersonsTable | null, fn: () => T): T {
  return store.run(admin, fn);
}

/** Skutečný admin za probíhající impersonací (nebo null). Pro banner v `Layout`. */
export function getImpersonator(): PersonsTable | null {
  return store.getStore() ?? null;
}

/** Nastaví impersonační cookii (jen krátkodobě; po pár hodinách sama vyprší). */
export function setImpersonationCookie(c: Context, personId: string): void {
  setCookie(c, IMP_COOKIE, personId, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: 8 * 3600,
  });
}

/** Ukončí impersonaci (smaže cookii). Volá se i při odhlášení. */
export function clearImpersonationCookie(c: Context): void {
  deleteCookie(c, IMP_COOKIE, { path: '/' });
}

/** Cíl impersonace: aktivní člen téhož tenanta s přihlášením (jinak null). */
export async function getImpersonationTarget(tenantId: string, id: string): Promise<PersonsTable | null> {
  const p = await db
    .selectFrom('persons')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .where('login_email', 'is not', null)
    .executeTakeFirst();
  return p ?? null;
}
