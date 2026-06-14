import { db } from '../db';
import { newId, now } from '../lib/util';
import { hashPassword } from '../auth/password';
import type { PersonsTable } from '../db/schema';

/**
 * Tým = osoby s přihlašovacím e-mailem. Uživatel se nemaže, jen deaktivuje
 * (stopa v Historii a výkazech zůstává). Role zatím dvě: Admin / Uživatel
 * (`is_admin` — nahradí RBAC).
 */

export async function listTeam(tenantId: string): Promise<PersonsTable[]> {
  return db
    .selectFrom('persons')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('login_email', 'is not', null)
    .where('deleted_at', 'is', null)
    .orderBy('is_active', 'desc')
    .orderBy('name')
    .execute();
}

export async function getTeamMember(tenantId: string, id: string): Promise<PersonsTable | null> {
  const p = await db
    .selectFrom('persons')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('login_email', 'is not', null)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  return p ?? null;
}

/** E-mail už používá jiný uživatel? (kontrola unikátnosti přihlášení) */
export async function loginEmailTaken(tenantId: string, email: string, exceptId?: string): Promise<boolean> {
  let q = db
    .selectFrom('persons')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('login_email', '=', email)
    .where('deleted_at', 'is', null);
  if (exceptId) q = q.where('id', '!=', exceptId);
  return (await q.executeTakeFirst()) !== undefined;
}

/** Počet aktivních adminů — pojistka, aby Organizace nezůstala bez správce. */
export async function activeAdminCount(tenantId: string): Promise<number> {
  const rows = await db
    .selectFrom('persons')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('is_admin', '=', 1)
    .where('is_active', '=', 1)
    .where('login_email', 'is not', null)
    .where('deleted_at', 'is', null)
    .execute();
  return rows.length;
}

export async function createTeamMember(
  tenantId: string,
  data: { name: string; email: string; isAdmin: boolean; password: string; position?: string | null },
): Promise<string> {
  const id = newId();
  await db
    .insertInto('persons')
    .values({
      id,
      tenant_id: tenantId,
      name: data.name,
      login_email: data.email,
      password_hash: hashPassword(data.password),
      is_admin: data.isAdmin ? 1 : 0,
      is_active: 1,
      position: data.position ?? null,
      note: null,
      created_at: now(),
      deleted_at: null,
    })
    .execute();
  return id;
}

export async function updateTeamMember(
  tenantId: string,
  id: string,
  data: { name: string; email: string; isAdmin: boolean; password?: string | null; position?: string | null },
): Promise<void> {
  await db
    .updateTable('persons')
    .set({
      name: data.name,
      login_email: data.email,
      is_admin: data.isAdmin ? 1 : 0,
      position: data.position ?? null,
      ...(data.password ? { password_hash: hashPassword(data.password) } : {}),
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

export async function setTeamMemberActive(tenantId: string, id: string, active: boolean): Promise<void> {
  await db
    .updateTable('persons')
    .set({ is_active: active ? 1 : 0 })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
  // deaktivace = okamžité odhlášení všude
  if (!active) await db.deleteFrom('sessions').where('person_id', '=', id).execute();
}
