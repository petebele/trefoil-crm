import { db } from '../db';
import { newId } from '../lib/util';
import { slugify } from './lists';

/**
 * Katalog služeb (Seznam `service_catalog`). Detaily položky (režim, cena, hodiny,
 * popis) žijí v JSON sloupci `meta` — první reálné využití konvence „detaily jako
 * JSON snippety". Výchozí hodnoty z katalogu se při aktivaci služby u zákazníka
 * kopírují a dají se tam přepsat (Krok 5).
 */

export type ServiceMode = 'subscription' | 'retainer' | 'payg';

export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  subscription: 'Předplatné',
  retainer: 'Paušál hodin',
  payg: 'Samostatná fakturace',
};

export function isServiceMode(s: string): s is ServiceMode {
  return s === 'subscription' || s === 'retainer' || s === 'payg';
}

export interface ServiceMeta {
  description: string | null;
  mode: ServiceMode;
  /** Výchozí měsíční cena v Kč (u předplatného volitelná, u samostatné fakturace žádná). */
  price: number | null;
  // Pozor: paušál hodin se NEnastavuje u služby — patří k zákazníkovi (jeden paušál
  // může pokrývat víc služeb). Implementuje Krok 5.
}

export interface CatalogService {
  id: string;
  value: string;
  label: string;
  active: number;
  meta: ServiceMeta;
}

function parseMeta(raw: string | null): ServiceMeta {
  const fallback: ServiceMeta = { description: null, mode: 'retainer', price: null };
  if (!raw) return fallback;
  try {
    const m = JSON.parse(raw) as Partial<ServiceMeta>;
    return {
      description: typeof m.description === 'string' && m.description ? m.description : null,
      mode: typeof m.mode === 'string' && isServiceMode(m.mode) ? m.mode : 'retainer',
      price: typeof m.price === 'number' ? m.price : null,
    };
  } catch {
    return fallback;
  }
}

/** Podle režimu nechá jen smysluplné hodnoty (samostatná fakturace nemá cenu předem). */
export function normalizeMeta(meta: ServiceMeta): ServiceMeta {
  return {
    description: meta.description?.trim() || null,
    mode: meta.mode,
    price: meta.mode === 'payg' ? null : meta.price,
  };
}

async function catalogListId(tenantId: string): Promise<string | null> {
  const list = await db
    .selectFrom('lists')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('key', '=', 'service_catalog')
    .executeTakeFirst();
  return list?.id ?? null;
}

/** Celý katalog včetně deaktivovaných (pro Administraci); aktivní první. */
export async function listCatalog(tenantId: string): Promise<CatalogService[]> {
  const listId = await catalogListId(tenantId);
  if (!listId) return [];
  const rows = await db
    .selectFrom('list_items')
    .selectAll()
    .where('list_id', '=', listId)
    .orderBy('active', 'desc')
    .orderBy('sort_order')
    .orderBy('label')
    .execute();
  return rows.map((r) => ({ id: r.id, value: r.value, label: r.label, active: r.active, meta: parseMeta(r.meta) }));
}

export async function getCatalogService(tenantId: string, id: string): Promise<CatalogService | null> {
  const listId = await catalogListId(tenantId);
  if (!listId) return null;
  const r = await db
    .selectFrom('list_items')
    .selectAll()
    .where('list_id', '=', listId)
    .where('id', '=', id)
    .executeTakeFirst();
  return r ? { id: r.id, value: r.value, label: r.label, active: r.active, meta: parseMeta(r.meta) } : null;
}

/** Založí službu; vrátí id, nebo null při duplicitním názvu. */
export async function createCatalogService(tenantId: string, label: string, meta: ServiceMeta): Promise<string | null> {
  const listId = await catalogListId(tenantId);
  const clean = label.trim();
  if (!listId || !clean) return null;

  const dup = await db
    .selectFrom('list_items')
    .select('id')
    .where('list_id', '=', listId)
    .where('label', '=', clean)
    .executeTakeFirst();
  if (dup) return null;

  const id = newId();
  await db
    .insertInto('list_items')
    .values({
      id,
      tenant_id: tenantId,
      list_id: listId,
      value: slugify(clean),
      label: clean,
      color: null,
      sort_order: 99,
      active: 1,
      meta: JSON.stringify(normalizeMeta(meta)),
    })
    .execute();
  return id;
}

/** Upraví službu; vrátí false při duplicitním názvu. */
export async function updateCatalogService(tenantId: string, id: string, label: string, meta: ServiceMeta): Promise<boolean> {
  const listId = await catalogListId(tenantId);
  const clean = label.trim();
  if (!listId || !clean) return false;

  const dup = await db
    .selectFrom('list_items')
    .select('id')
    .where('list_id', '=', listId)
    .where('label', '=', clean)
    .where('id', '!=', id)
    .executeTakeFirst();
  if (dup) return false;

  await db
    .updateTable('list_items')
    .set({ label: clean, meta: JSON.stringify(normalizeMeta(meta)) })
    .where('id', '=', id)
    .where('list_id', '=', listId)
    .execute();
  return true;
}

export async function setCatalogServiceActive(tenantId: string, id: string, active: boolean): Promise<void> {
  const listId = await catalogListId(tenantId);
  if (!listId) return;
  await db
    .updateTable('list_items')
    .set({ active: active ? 1 : 0 })
    .where('id', '=', id)
    .where('list_id', '=', listId)
    .execute();
}
