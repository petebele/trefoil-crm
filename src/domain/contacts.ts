import { db } from '../db';
import { newId, now } from '../lib/util';
import { ensureItemByLabel } from './lists';
import type { PersonContactsTable } from '../db/schema';

/** Kontaktní údaje (telefony, e-maily, weby…) osoby nebo firmy. */

export type ContactType = PersonContactsTable['type'];
export function isContactType(s: string): s is ContactType {
  return s === 'phone' || s === 'email' || s === 'web' || s === 'other';
}

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  phone: 'Telefon',
  email: 'E-mail',
  web: 'Web',
  other: 'Jiné',
};

export async function listContacts(tenantId: string, ownerKind: 'person' | 'client', ownerId: string) {
  return db
    .selectFrom('person_contacts')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('owner_kind', '=', ownerKind)
    .where('owner_id', '=', ownerId)
    .orderBy('type')
    .orderBy('created_at')
    .execute();
}

/**
 * Přidá kontakt. `label` = štítek typu („Práce", „Domů"…) — uloží se do Seznamu
 * contact_labels (inline create), takže se příště našeptává.
 */
export async function addContact(
  tenantId: string,
  ownerKind: 'person' | 'client',
  ownerId: string,
  data: { type: ContactType; value: string; label?: string | null; clientId?: string | null },
): Promise<PersonContactsTable | null> {
  const value = data.value.trim();
  if (!value) return null;

  let label: string | null = null;
  if (data.label?.trim()) {
    const item = await ensureItemByLabel(tenantId, 'contact_labels', data.label);
    label = item?.label ?? data.label.trim();
  }

  const id = newId();
  await db
    .insertInto('person_contacts')
    .values({
      id,
      tenant_id: tenantId,
      owner_kind: ownerKind,
      owner_id: ownerId,
      type: data.type,
      value,
      label,
      client_id: data.clientId ?? null,
      is_primary: 0,
      created_at: now(),
    })
    .execute();
  return db.selectFrom('person_contacts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
}

/** Upraví hodnotu/štítek kontaktu (inline ✎). Štítek se opět zakládá do Seznamu. */
export async function updateContact(
  tenantId: string,
  id: string,
  data: { value: string; label?: string | null },
): Promise<PersonContactsTable | null> {
  const row = await db
    .selectFrom('person_contacts')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) return null;
  const value = data.value.trim() || row.value;
  let label: string | null = null;
  if (data.label?.trim()) {
    const item = await ensureItemByLabel(tenantId, 'contact_labels', data.label);
    label = item?.label ?? data.label.trim();
  }
  await db.updateTable('person_contacts').set({ value, label }).where('id', '=', id).execute();
  return { ...row, value, label };
}

export async function removeContact(tenantId: string, id: string): Promise<PersonContactsTable | null> {
  const row = await db
    .selectFrom('person_contacts')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) return null;
  await db.deleteFrom('person_contacts').where('id', '=', id).execute();
  return row;
}

/** První e-mail a telefon pro množinu vlastníků (řádky přehledu). */
export async function primaryContactsFor(tenantId: string, ownerKind: 'person' | 'client', ids: string[]) {
  const map = new Map<string, { email?: string; emailLabel?: string | null; phone?: string; phoneLabel?: string | null }>();
  if (ids.length === 0) return map;
  const rows = await db
    .selectFrom('person_contacts')
    .select(['owner_id', 'type', 'value', 'label'])
    .where('tenant_id', '=', tenantId)
    .where('owner_kind', '=', ownerKind)
    .where('owner_id', 'in', ids)
    .orderBy('created_at')
    .execute();
  for (const r of rows) {
    const entry = map.get(r.owner_id) ?? {};
    if (r.type === 'email' && !entry.email) {
      entry.email = r.value;
      entry.emailLabel = r.label;
    }
    if (r.type === 'phone' && !entry.phone) {
      entry.phone = r.value;
      entry.phoneLabel = r.label;
    }
    map.set(r.owner_id, entry);
  }
  return map;
}
