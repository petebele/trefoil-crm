import { randomBytes } from 'node:crypto';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { db } from '../db';
import { now } from '../lib/util';
import { config } from '../config';
import type { PersonsTable } from '../db/schema';

const COOKIE = 'sid';

/** Nastaví přihlašovací cookie (jediné místo s parametry cookie). */
export function setSessionCookie(c: Context, sid: string): void {
  setCookie(c, COOKIE, sid, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlDays * 86_400,
  });
}

/** Smaže přihlašovací cookie (odhlášení). */
export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Vytvoří serverovou session a vrátí její token (ukládá se do httpOnly cookie). */
export async function createSession(personId: string): Promise<string> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 86_400_000).toISOString();
  await db
    .insertInto('sessions')
    .values({ id, person_id: personId, expires_at: expiresAt, created_at: now() })
    .execute();
  return id;
}

/** Vrátí přihlášenou osobu podle session tokenu, nebo null. */
export async function getSessionPerson(sessionId: string | undefined): Promise<PersonsTable | null> {
  if (!sessionId) return null;
  const session = await db.selectFrom('sessions').selectAll().where('id', '=', sessionId).executeTakeFirst();
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
    return null;
  }

  const person = await db
    .selectFrom('persons')
    .selectAll()
    .where('id', '=', session.person_id)
    .where('is_active', '=', 1)
    .executeTakeFirst();
  return person ?? null;
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (sessionId) await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
}

/**
 * Smaže prošlé sessions (volá se při startu). Bez úklidu by opuštěné záznamy
 * — po odhlášení/zavření okna — v DB zůstávaly navždy.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const res = await db.deleteFrom('sessions').where('expires_at', '<', now()).executeTakeFirst();
  return Number(res?.numDeletedRows ?? 0);
}
