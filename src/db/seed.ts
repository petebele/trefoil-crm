import { db } from './index';
import { newId } from '../lib/util';

/**
 * Doplní výchozí Seznamy (číselníky) všem existujícím Organizacím. Idempotentní —
 * doplňuje jen chybějící; uživatelské položky (např. nové štítky) nechává být.
 * Volá se při každém startu (i pro Organizace založené průvodcem dříve).
 */
const DEFAULT_LISTS: Array<{
  key: string;
  label: string;
  items: Array<{ value: string; label: string; color?: string }>;
}> = [
  {
    key: 'client_statuses',
    label: 'Stavy zákazníků',
    items: [
      { value: 'lead', label: 'Lead', color: 'gray' },
      { value: 'active', label: 'Aktivní', color: 'teal' },
      { value: 'paused', label: 'Pozastaveno', color: 'orange' },
      { value: 'ended', label: 'Ukončeno', color: 'dark' },
    ],
  },
  { key: 'client_tags', label: 'Štítky zákazníků', items: [] },
  { key: 'service_catalog', label: 'Katalog služeb', items: [] },
  {
    key: 'contact_labels',
    label: 'Štítky kontaktů',
    items: [
      { value: 'prace', label: 'Práce' },
      { value: 'domu', label: 'Domů' },
      { value: 'mobil', label: 'Mobil' },
      { value: 'osobni', label: 'Osobní' },
    ],
  },
  {
    key: 'roles_at_client',
    label: 'Role osoby u firmy',
    items: [
      { value: 'jednatel', label: 'Jednatel / majitel' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'fakturace', label: 'Fakturace' },
    ],
  },
];

/** Doplní výchozí Seznamy jedné Organizaci (volá průvodce založením i start aplikace). */
export async function seedTenantLists(tenantId: string): Promise<void> {
  for (const def of DEFAULT_LISTS) {
    let list = await db
      .selectFrom('lists')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('key', '=', def.key)
      .executeTakeFirst();
    if (!list) {
      const id = newId();
      await db.insertInto('lists').values({ id, tenant_id: tenantId, key: def.key, label: def.label }).execute();
      list = { id };
    }
    let order = 0;
    for (const it of def.items) {
      const existing = await db
        .selectFrom('list_items')
        .select('id')
        .where('list_id', '=', list.id)
        .where('value', '=', it.value)
        .executeTakeFirst();
      if (!existing) {
        await db
          .insertInto('list_items')
          .values({
            id: newId(),
            tenant_id: tenantId,
            list_id: list.id,
            value: it.value,
            label: it.label,
            color: it.color ?? null,
            sort_order: order,
            active: 1,
            meta: null,
          })
          .execute();
      }
      order += 1;
    }
  }
}

export async function seed(): Promise<void> {
  const tenants = await db.selectFrom('tenants').select('id').execute();
  for (const t of tenants) await seedTenantLists(t.id);
}
