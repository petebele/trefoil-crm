import { db } from '../db';
import { newId, now } from '../lib/util';
import type { ServicesTable } from '../db/schema';
import type { ServiceMode } from './services';

/**
 * Služby přidělené zákazníkovi (Krok 5). Výchozí režim a sazba se při přidělení
 * kopírují z katalogu a u klienta jdou přepsat — stejná služba může být u každého
 * klienta jinak. Služba se nemaže: pozastavuje / ukončuje (výkazy zůstávají vázané).
 */

export const SERVICE_STATUS_LABELS: Record<ServicesTable['status'], string> = {
  active: 'Aktivní',
  paused: 'Pozastavená',
  ended: 'Ukončená',
};

export interface ClientService extends ServicesTable {
  label: string; // název z katalogu
  owner_name: string | null;
}

export async function listClientServices(tenantId: string, clientId: string): Promise<ClientService[]> {
  const rows = await db
    .selectFrom('services')
    .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
    .leftJoin('persons', 'persons.id', 'services.owner_id')
    .where('services.tenant_id', '=', tenantId)
    .where('services.client_id', '=', clientId)
    .selectAll('services')
    .select(['list_items.label as label', 'persons.name as owner_name'])
    .orderBy('services.status')
    .orderBy('list_items.label')
    .execute();
  return rows as ClientService[];
}

export async function getClientService(tenantId: string, id: string): Promise<ClientService | null> {
  const row = await db
    .selectFrom('services')
    .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
    .leftJoin('persons', 'persons.id', 'services.owner_id')
    .where('services.tenant_id', '=', tenantId)
    .where('services.id', '=', id)
    .selectAll('services')
    .select(['list_items.label as label', 'persons.name as owner_name'])
    .executeTakeFirst();
  return (row as ClientService | undefined) ?? null;
}

/** Údaje služby u klienta společné pro přidělení i úpravu (jeden formulář v UI). */
export interface ClientServiceInput {
  detail: string | null;
  description: string | null;
  mode: ServiceMode;
  rate: number | null;
  monthlyAmount: number | null;
  ownerId: string | null;
}

export async function assignService(
  tenantId: string,
  clientId: string,
  catalogItemId: string,
  data: ClientServiceInput,
): Promise<string> {
  const id = newId();
  await db
    .insertInto('services')
    .values({
      id,
      tenant_id: tenantId,
      client_id: clientId,
      catalog_item_id: catalogItemId,
      detail: data.detail,
      description: data.description,
      mode: data.mode,
      rate: data.rate,
      monthly_amount: data.mode === 'subscription' ? data.monthlyAmount : null,
      owner_id: data.ownerId,
      status: 'active',
      created_at: now(),
    })
    .execute();
  return id;
}

export async function updateClientService(tenantId: string, id: string, data: ClientServiceInput): Promise<void> {
  await db
    .updateTable('services')
    .set({
      detail: data.detail,
      description: data.description,
      mode: data.mode,
      rate: data.rate,
      monthly_amount: data.mode === 'subscription' ? data.monthlyAmount : null,
      owner_id: data.ownerId,
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

export async function setClientServiceStatus(tenantId: string, id: string, status: ServicesTable['status']): Promise<void> {
  await db.updateTable('services').set({ status }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** Paušál hodin zákazníka — hodiny prázdné = paušál zrušen (smaže i cenu a rollover). */
export async function setClientRetainer(
  tenantId: string,
  clientId: string,
  data: { hours: number | null; hourlyRate: number | null; overageRate: number | null; rollover: boolean },
): Promise<void> {
  const clear = data.hours === null;
  // měsíční cena paušálu = hodiny × sazba za paušální hodinu (odvozená, ať s ní počítá fakturace)
  const price = clear || data.hourlyRate === null ? null : Math.round(data.hours! * data.hourlyRate);
  await db
    .updateTable('clients')
    .set({
      hours_budget_monthly: data.hours,
      retainer_hourly_rate: clear ? null : data.hourlyRate,
      retainer_price: price,
      overage_rate: clear ? null : data.overageRate,
      hours_rollover: clear ? 0 : data.rollover ? 1 : 0,
      updated_at: now(),
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', clientId)
    .execute();
}

/** Služby firem, u kterých osoba působí (read-only pohled v detailu osoby). */
export async function servicesOfPersonFirms(tenantId: string, personId: string) {
  return db
    .selectFrom('person_clients')
    .innerJoin('clients', 'clients.id', 'person_clients.client_id')
    .innerJoin('services', 'services.client_id', 'clients.id')
    .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
    .where('person_clients.tenant_id', '=', tenantId)
    .where('person_clients.person_id', '=', personId)
    .where('clients.deleted_at', 'is', null)
    .where('services.status', '!=', 'ended')
    .select([
      'services.id as id',
      'services.mode as mode',
      'services.status as status',
      'list_items.label as label',
      'clients.id as client_id',
      'clients.name as client_name',
    ])
    .orderBy('clients.name')
    .orderBy('list_items.label')
    .execute();
}
