import { db } from '../db';
import { newId, now } from '../lib/util';
import type { TaskStatusesTable } from '../db/schema';

/** Stavy úkolů = sloupce Kanbanu, konfigurovatelné per uživatel (Úkoly v2). */

const DEFAULTS: Array<{ label: string; color: string; is_done: number; is_default: number }> = [
  { label: 'Nový', color: 'gray', is_done: 0, is_default: 1 }, // Inbox/Zásobník — povinný, nesmazatelný
  { label: 'Vyřizuji', color: 'teal', is_done: 0, is_default: 0 },
  { label: 'Kontrola', color: 'orange', is_done: 0, is_default: 0 },
  { label: 'Hotovo', color: 'indigo', is_done: 1, is_default: 0 },
];

export async function listStatuses(tenantId: string, ownerId: string): Promise<TaskStatusesTable[]> {
  return db
    .selectFrom('task_statuses')
    .selectAll()
    .where('tenant_id', '=', tenantId)
    .where('owner_id', '=', ownerId)
    .orderBy('sort_order')
    .orderBy('label')
    .execute();
}

/** Vrátí stavy uživatele; když žádné nemá, nasadí výchozí sadu (lazy). */
export async function ensureStatuses(tenantId: string, ownerId: string): Promise<TaskStatusesTable[]> {
  const existing = await listStatuses(tenantId, ownerId);
  if (existing.length) return existing;
  let order = 0;
  for (const d of DEFAULTS) {
    await db
      .insertInto('task_statuses')
      .values({ id: newId(), tenant_id: tenantId, owner_id: ownerId, label: d.label, color: d.color, sort_order: order++, is_done: d.is_done, is_default: d.is_default, created_at: now() })
      .execute();
  }
  return listStatuses(tenantId, ownerId);
}

export async function getStatus(tenantId: string, id: string): Promise<TaskStatusesTable | null> {
  const r = await db.selectFrom('task_statuses').selectAll().where('tenant_id', '=', tenantId).where('id', '=', id).executeTakeFirst();
  return r ?? null;
}

export function firstStatusId(statuses: TaskStatusesTable[]): string | null {
  return statuses[0]?.id ?? null;
}
export function firstNonDoneId(statuses: TaskStatusesTable[]): string | null {
  return (statuses.find((s) => s.is_done !== 1) ?? statuses[0])?.id ?? null;
}
export function doneStatusId(statuses: TaskStatusesTable[]): string | null {
  return statuses.find((s) => s.is_done === 1)?.id ?? null;
}
/** Povinný „Inbox/Zásobník" stav (nové + nezařazené úkoly). */
export function defaultStatusId(statuses: TaskStatusesTable[]): string | null {
  return (statuses.find((s) => s.is_default === 1) ?? statuses[0])?.id ?? null;
}

export async function createStatus(tenantId: string, ownerId: string, label: string): Promise<void> {
  const clean = label.trim();
  if (!clean) return;
  const max = await db
    .selectFrom('task_statuses')
    .select((eb) => eb.fn.max('sort_order').as('m'))
    .where('tenant_id', '=', tenantId)
    .where('owner_id', '=', ownerId)
    .executeTakeFirst();
  await db
    .insertInto('task_statuses')
    .values({ id: newId(), tenant_id: tenantId, owner_id: ownerId, label: clean, color: 'gray', sort_order: Number(max?.m ?? 0) + 1, is_done: 0, is_default: 0, created_at: now() })
    .execute();
}

export async function updateStatus(tenantId: string, id: string, data: { label?: string; color?: string | null; is_done?: number }): Promise<void> {
  const set: Record<string, unknown> = {};
  if (data.label !== undefined) set.label = data.label.trim();
  if (data.color !== undefined) set.color = data.color;
  if (data.is_done !== undefined) set.is_done = data.is_done ? 1 : 0;
  if (Object.keys(set).length === 0) return;
  await db.updateTable('task_statuses').set(set).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** Nastaví „stav vyřízeného" (is_done) — VÝLUČNĚ: zapnutí u jednoho vypne u ostatních. */
export async function setStatusDone(tenantId: string, ownerId: string, id: string, on: boolean): Promise<void> {
  if (on) {
    await db.updateTable('task_statuses').set({ is_done: 0 }).where('tenant_id', '=', tenantId).where('owner_id', '=', ownerId).execute();
  }
  await db.updateTable('task_statuses').set({ is_done: on ? 1 : 0 }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

export async function reorderStatuses(tenantId: string, ownerId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .updateTable('task_statuses')
      .set({ sort_order: i })
      .where('tenant_id', '=', tenantId)
      .where('owner_id', '=', ownerId)
      .where('id', '=', orderedIds[i]!)
      .execute();
  }
}

/** Smaže stav; jeho úkoly přesune na Inbox (default). Inbox/Zásobník nelze smazat. */
export async function deleteStatus(tenantId: string, ownerId: string, id: string): Promise<void> {
  const statuses = await listStatuses(tenantId, ownerId);
  const target = statuses.find((s) => s.id === id);
  if (!target || target.is_default === 1) return; // povinný Inbox nemazat
  const fallback = statuses.find((s) => s.is_default === 1) ?? statuses.find((s) => s.id !== id);
  if (!fallback) return;
  await db.updateTable('tasks').set({ status_id: fallback.id }).where('tenant_id', '=', tenantId).where('status_id', '=', id).execute();
  await db.deleteFrom('task_statuses').where('tenant_id', '=', tenantId).where('owner_id', '=', ownerId).where('id', '=', id).execute();
}
