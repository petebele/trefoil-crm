import { db } from '../db';
import { newId, now } from '../lib/util';

/** Zákaznické osoby (bez přihlášení). Kolegové (s loginem) se v Zákaznících nezobrazují. */

export async function listCustomerPersons(tenantId: string, q?: string) {
  let query = db
    .selectFrom('persons')
    .select(['id', 'name', 'note', 'created_at'])
    .where('tenant_id', '=', tenantId)
    .where('login_email', 'is', null)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null);
  const term = q?.trim();
  if (term) query = query.where('name', 'like', `%${term}%`);
  return query.orderBy('name').execute();
}

export async function getCustomerPerson(tenantId: string, id: string) {
  return db
    .selectFrom('persons')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('login_email', 'is', null)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
}

export async function createCustomerPerson(tenantId: string, data: { name: string; note?: string | null }): Promise<string> {
  const id = newId();
  await db
    .insertInto('persons')
    .values({
      id,
      tenant_id: tenantId,
      name: data.name,
      login_email: null,
      password_hash: null,
      is_admin: 0,
      is_active: 1,
      note: data.note ?? null,
      created_at: now(),
      deleted_at: null,
    })
    .execute();
  return id;
}

export type EditablePersonField = 'name' | 'note';
export function isEditablePersonField(f: string): f is EditablePersonField {
  return f === 'name' || f === 'note';
}

export async function updatePersonField(tenantId: string, id: string, field: EditablePersonField, value: string | null): Promise<void> {
  const patch = field === 'name' ? { name: value ?? '' } : { note: value };
  await db.updateTable('persons').set(patch).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

export async function softDeletePerson(tenantId: string, id: string): Promise<void> {
  await db.updateTable('persons').set({ deleted_at: now() }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** Kolegové (pro výběr odpovědné osoby). */
export async function listCoworkers(tenantId: string) {
  return db
    .selectFrom('persons')
    .select(['id', 'name'])
    .where('tenant_id', '=', tenantId)
    .where('login_email', 'is not', null)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .orderBy('name')
    .execute();
}
