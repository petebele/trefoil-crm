import { db } from '../db';
import { newId, now } from '../lib/util';
import type { Updateable } from 'kysely';
import type { ClientsTable } from '../db/schema';

/** Firmy (zákazníci typu společnost) a vazby na osoby. */

export type ClientAddressInput = {
  street: string | null;
  house_no: string | null;
  address2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

/** Adresa pro zobrazení: poskládá strukturovaná pole; fallback na legacy volný text. */
export function composeAddress(c: {
  street?: string | null; house_no?: string | null; address2?: string | null;
  city?: string | null; postal_code?: string | null; country?: string | null; address?: string | null;
}): string[] {
  const clean = (x: string | null | undefined) => (x ?? '').trim();
  const l1 = [clean(c.street), clean(c.house_no)].filter(Boolean).join(' ');
  const l3 = [clean(c.postal_code), clean(c.city)].filter(Boolean).join(' ');
  const lines = [l1, clean(c.address2), l3, clean(c.country)].filter(Boolean);
  if (lines.length) return lines;
  const legacy = clean(c.address);
  return legacy ? legacy.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
}

export async function listClients(tenantId: string, q?: string) {
  let query = db
    .selectFrom('clients')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('deleted_at', 'is', null);
  const term = q?.trim();
  if (term) query = query.where('name', 'like', `%${term}%`);
  return query.orderBy('name').execute();
}

export async function getClient(tenantId: string, id: string) {
  return db
    .selectFrom('clients')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
}

export async function createClient(
  tenantId: string,
  data: {
    name: string;
    ico?: string | null;
    dic?: string | null;
    status?: string;
    ownerId?: string | null;
    note?: string | null;
    address?: Partial<ClientAddressInput> | null;
  },
): Promise<string> {
  const id = newId();
  const ts = now();
  const a = data.address ?? {};
  await db
    .insertInto('clients')
    .values({
      id,
      tenant_id: tenantId,
      kind: 'company',
      name: data.name,
      ico: data.ico ?? null,
      dic: data.dic ?? null,
      website: null,
      address: null,
      street: a.street ?? null,
      house_no: a.house_no ?? null,
      address2: a.address2 ?? null,
      city: a.city ?? null,
      postal_code: a.postal_code ?? null,
      country: a.country ?? null,
      status: data.status ?? 'lead',
      owner_id: data.ownerId ?? null,
      note: data.note ?? null,
      hours_budget_monthly: null,
      retainer_price: null,
      hours_rollover: 0,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    })
    .execute();
  return id;
}

export type EditableClientField = 'name' | 'website' | 'ico' | 'dic' | 'address' | 'status' | 'note';
/** Hromadná úprava hlavních údajů (velký modál „Upravit firmu"). */
export async function updateClientMain(
  tenantId: string,
  id: string,
  data: {
    name: string;
    ico: string | null;
    dic: string | null;
    address: ClientAddressInput;
    status: string;
    ownerId: string | null;
    note: string | null;
  },
): Promise<void> {
  const a = data.address;
  // legacy `address` držíme synchronní s poskládanou strukturou (kvůli starším výpisům)
  const legacy = composeAddress(a).join('\n') || null;
  await db
    .updateTable('clients')
    .set({
      name: data.name,
      ico: data.ico,
      dic: data.dic,
      street: a.street,
      house_no: a.house_no,
      address2: a.address2,
      city: a.city,
      postal_code: a.postal_code,
      country: a.country,
      address: legacy,
      status: data.status,
      owner_id: data.ownerId,
      note: data.note,
      updated_at: now(),
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

export function isEditableClientField(f: string): f is EditableClientField {
  return ['name', 'website', 'ico', 'dic', 'address', 'status', 'note'].includes(f);
}

export async function updateClientField(
  tenantId: string,
  id: string,
  field: EditableClientField,
  value: string | null,
): Promise<void> {
  const patch: Updateable<ClientsTable> = { updated_at: now() };
  switch (field) {
    case 'name': patch.name = value ?? ''; break;
    case 'website': patch.website = value; break;
    case 'ico': patch.ico = value; break;
    case 'dic': patch.dic = value; break;
    case 'address': patch.address = value; break;
    case 'status': patch.status = value ?? 'lead'; break;
    case 'note': patch.note = value; break;
  }
  await db.updateTable('clients').set(patch).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

export async function setClientOwner(tenantId: string, id: string, ownerId: string | null): Promise<void> {
  await db
    .updateTable('clients')
    .set({ owner_id: ownerId, updated_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

export async function softDeleteClient(tenantId: string, id: string): Promise<void> {
  await db
    .updateTable('clients')
    .set({ deleted_at: now(), updated_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

/** Osoby napojené na firmu (s rolí a hlavními kontakty osoby). */
export async function peopleOfClient(tenantId: string, clientId: string) {
  return db
    .selectFrom('person_clients')
    .innerJoin('persons', 'persons.id', 'person_clients.person_id')
    .where('person_clients.tenant_id', '=', tenantId)
    .where('person_clients.client_id', '=', clientId)
    .where('persons.deleted_at', 'is', null)
    .select([
      'persons.id as id',
      'persons.name as name',
      'person_clients.role_at_client as role_at_client',
      'person_clients.is_primary as is_primary',
    ])
    .orderBy('person_clients.is_primary', 'desc')
    .orderBy('persons.name')
    .execute();
}

export async function linkPersonToClient(
  tenantId: string,
  personId: string,
  clientId: string,
  roleAtClient?: string | null,
): Promise<void> {
  const existing = await db
    .selectFrom('person_clients')
    .select('person_id')
    .where('tenant_id', '=', tenantId)
    .where('person_id', '=', personId)
    .where('client_id', '=', clientId)
    .executeTakeFirst();
  if (existing) return;
  await db
    .insertInto('person_clients')
    .values({ tenant_id: tenantId, person_id: personId, client_id: clientId, role_at_client: roleAtClient ?? null, is_primary: 0 })
    .execute();
}

export async function unlinkPersonFromClient(tenantId: string, personId: string, clientId: string): Promise<void> {
  await db
    .deleteFrom('person_clients')
    .where('tenant_id', '=', tenantId)
    .where('person_id', '=', personId)
    .where('client_id', '=', clientId)
    .execute();
}

/** Firmy, u kterých osoba působí. */
export async function clientsOfPerson(tenantId: string, personId: string) {
  return db
    .selectFrom('person_clients')
    .innerJoin('clients', 'clients.id', 'person_clients.client_id')
    .where('person_clients.tenant_id', '=', tenantId)
    .where('person_clients.person_id', '=', personId)
    .where('clients.deleted_at', 'is', null)
    .select([
      'clients.id as id',
      'clients.name as name',
      'person_clients.role_at_client as role_at_client',
    ])
    .orderBy('clients.name')
    .execute();
}

/** Hlavní firma pro množinu osob (podtitulek v přehledu). */
export async function primaryClientsFor(tenantId: string, personIds: string[]) {
  const map = new Map<string, { clientId: string; clientName: string; role: string | null }>();
  if (personIds.length === 0) return map;
  const rows = await db
    .selectFrom('person_clients')
    .innerJoin('clients', 'clients.id', 'person_clients.client_id')
    .where('person_clients.tenant_id', '=', tenantId)
    .where('person_clients.person_id', 'in', personIds)
    .where('clients.deleted_at', 'is', null)
    .select([
      'person_clients.person_id as person_id',
      'person_clients.role_at_client as role',
      'clients.id as client_id',
      'clients.name as client_name',
    ])
    .orderBy('person_clients.is_primary', 'desc')
    .execute();
  for (const r of rows) {
    if (!map.has(r.person_id)) map.set(r.person_id, { clientId: r.client_id, clientName: r.client_name, role: r.role });
  }
  return map;
}
