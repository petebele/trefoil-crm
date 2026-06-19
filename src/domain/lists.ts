import { db } from '../db';
import { newId } from '../lib/util';

/** Konfigurovatelné Seznamy: čtení položek, inline zakládání, štítky na záznamech. */

export async function itemsByKey(tenantId: string, key: string) {
  return db
    .selectFrom('list_items')
    .innerJoin('lists', 'lists.id', 'list_items.list_id')
    .where('lists.tenant_id', '=', tenantId)
    .where('lists.key', '=', key)
    .where('list_items.active', '=', 1)
    .select([
      'list_items.id as id',
      'list_items.value as value',
      'list_items.label as label',
      'list_items.color as color',
    ])
    .orderBy('list_items.sort_order')
    .orderBy('list_items.label')
    .execute();
}

export function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || newId().slice(0, 8)
  );
}

/**
 * Najde položku Seznamu podle labelu; když neexistuje, založí ji (inline create).
 * Tím se nově napsaný štítek uloží pro další použití i našeptávač.
 */
export async function ensureItemByLabel(tenantId: string, key: string, label: string) {
  const clean = label.trim();
  if (!clean) return null;

  const list = await db
    .selectFrom('lists')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('key', '=', key)
    .executeTakeFirst();
  if (!list) return null;

  const existing = await db
    .selectFrom('list_items')
    .selectAll()
    .where('list_id', '=', list.id)
    .where((eb) => eb.or([eb('label', '=', clean), eb('value', '=', slugify(clean))]))
    .executeTakeFirst();
  if (existing) return existing;

  const id = newId();
  await db
    .insertInto('list_items')
    .values({
      id,
      tenant_id: tenantId,
      list_id: list.id,
      value: slugify(clean),
      label: clean,
      color: null,
      sort_order: 99,
      active: 1,
      meta: null,
    })
    .execute();
  return db.selectFrom('list_items').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
}

// ---- štítky na záznamech (entity_list_items) ----
// Druh záznamu → Seznam štítků: client/person sdílí `client_tags`, task má vlastní `task_labels`.
export type TagKind = 'client' | 'person' | 'task';
export const tagListKey = (kind: TagKind): string => (kind === 'task' ? 'task_labels' : 'client_tags');

export async function listEntityTags(tenantId: string, entityKind: TagKind, entityId: string) {
  return db
    .selectFrom('entity_list_items')
    .innerJoin('list_items', 'list_items.id', 'entity_list_items.list_item_id')
    .where('entity_list_items.tenant_id', '=', tenantId)
    .where('entity_list_items.entity_kind', '=', entityKind)
    .where('entity_list_items.entity_id', '=', entityId)
    .select(['list_items.id as id', 'list_items.label as label', 'list_items.color as color'])
    .orderBy('list_items.label')
    .execute();
}

export async function addEntityTag(
  tenantId: string,
  entityKind: TagKind,
  entityId: string,
  label: string,
): Promise<string | null> {
  const item = await ensureItemByLabel(tenantId, tagListKey(entityKind), label);
  if (!item) return null;
  const link = await db
    .selectFrom('entity_list_items')
    .select('list_item_id')
    .where('entity_kind', '=', entityKind)
    .where('entity_id', '=', entityId)
    .where('list_item_id', '=', item.id)
    .executeTakeFirst();
  if (!link) {
    await db
      .insertInto('entity_list_items')
      .values({ tenant_id: tenantId, entity_kind: entityKind, entity_id: entityId, list_item_id: item.id })
      .execute();
  }
  return item.label;
}

export async function removeEntityTag(
  tenantId: string,
  entityKind: TagKind,
  entityId: string,
  listItemId: string,
): Promise<string | null> {
  const item = await db.selectFrom('list_items').select('label').where('id', '=', listItemId).executeTakeFirst();
  await db
    .deleteFrom('entity_list_items')
    .where('tenant_id', '=', tenantId)
    .where('entity_kind', '=', entityKind)
    .where('entity_id', '=', entityId)
    .where('list_item_id', '=', listItemId)
    .execute();
  return item?.label ?? null;
}

export type EntityTag = { id: string; label: string; color: string | null };

/** Štítky pro množinu záznamů najednou (pro řádky přehledu). */
export async function tagsForEntities(tenantId: string, entityKind: TagKind, ids: string[]) {
  if (ids.length === 0) return new Map<string, EntityTag[]>();
  const rows = await db
    .selectFrom('entity_list_items')
    .innerJoin('list_items', 'list_items.id', 'entity_list_items.list_item_id')
    .where('entity_list_items.tenant_id', '=', tenantId)
    .where('entity_list_items.entity_kind', '=', entityKind)
    .where('entity_list_items.entity_id', 'in', ids)
    .select([
      'entity_list_items.entity_id as entity_id',
      'list_items.id as id',
      'list_items.label as label',
      'list_items.color as color',
    ])
    .execute();
  const map = new Map<string, EntityTag[]>();
  for (const r of rows) {
    if (!map.has(r.entity_id)) map.set(r.entity_id, []);
    map.get(r.entity_id)!.push({ id: r.id, label: r.label, color: r.color });
  }
  return map;
}

/** Nastaví štítky úkolu na přesně daný výběr (přepíše stávající). */
export async function setEntityTags(tenantId: string, entityKind: TagKind, entityId: string, listItemIds: string[]): Promise<void> {
  await db
    .deleteFrom('entity_list_items')
    .where('tenant_id', '=', tenantId)
    .where('entity_kind', '=', entityKind)
    .where('entity_id', '=', entityId)
    .execute();
  const ids = [...new Set(listItemIds.filter(Boolean))];
  if (ids.length === 0) return;
  await db
    .insertInto('entity_list_items')
    .values(ids.map((list_item_id) => ({ tenant_id: tenantId, entity_kind: entityKind, entity_id: entityId, list_item_id })))
    .execute();
}
