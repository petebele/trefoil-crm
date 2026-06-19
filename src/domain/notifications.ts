import { db } from '../db';
import { newId, now } from '../lib/util';
import { broadcast } from '../realtime';

/**
 * Notifikace — adresná oznámení „co se týká tebe" se stavem přečteno.
 * Liší se od `events` (neadresný log dění). Vznik oznámení se vysílá realtime,
 * aby se odznak u příjemce sám rozsvítil. Princip „nic se nemaže": přečtení je měkký stav.
 */

export type NotificationType =
  | 'work_record_approved'
  | 'work_record_returned'
  | 'work_record_rejected'
  | 'work_record_pending'
  | 'task_assigned';

/**
 * Typy bez vlastního detailu, které se v panelu slučují do jednoho řádku s počtem
 * (přání: „6 výkazů čeká na schválení"). Detailní typy (vrácení/zamítnutí s instrukcemi,
 * přidělený úkol) se neslučují — je potřeba si je přečíst po jednom.
 */
const AGGREGATABLE = new Set<string>(['work_record_pending', 'work_record_approved']);
export function isAggregatable(type: string): boolean {
  return AGGREGATABLE.has(type);
}

export type NotifyInput = {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityKind: string;
  entityId: string;
  link: string;
};

/** Vytvoří oznámení pro příjemce. Nikdy neupozorňuje sám na sebe. Po zápisu pošle realtime nudge. */
export async function notify(tenantId: string, input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return; // neupozorňuj sám sebe
  await db
    .insertInto('notifications')
    .values({
      id: newId(),
      tenant_id: tenantId,
      recipient_id: input.recipientId,
      actor_id: input.actorId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_kind: input.entityKind,
      entity_id: input.entityId,
      link: input.link,
      read_at: null,
      created_at: now(),
    })
    .execute();
  broadcast({ kind: 'notification', id: input.recipientId });
}

/**
 * Upozorní schvalovatele na nový výkaz čekající na schválení: vlastníka klienta i všechny
 * aktivní adminy (kdokoli z nich smí schválit — `canApproveFor`), kromě autora výkazu.
 * Sloučí se v panelu do „Výkazy ke schválení (N)".
 */
export async function notifyPendingApproval(
  tenantId: string,
  opts: { clientOwnerId: string | null; actorId: string; body: string; entityId: string; link: string },
): Promise<void> {
  const admins = await db
    .selectFrom('persons')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('is_admin', '=', 1)
    .where('is_active', '=', 1)
    .where('login_email', 'is not', null)
    .where('deleted_at', 'is', null)
    .execute();
  const ids = new Set<string>();
  if (opts.clientOwnerId) ids.add(opts.clientOwnerId);
  for (const a of admins) ids.add(a.id);
  ids.delete(opts.actorId); // ne sám sobě
  for (const recipientId of ids) {
    await notify(tenantId, {
      recipientId,
      actorId: opts.actorId,
      type: 'work_record_pending',
      title: 'Nový výkaz ke schválení',
      body: opts.body,
      entityKind: 'work_record',
      entityId: opts.entityId,
      link: opts.link,
    });
  }
}

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_kind: string;
  entity_id: string;
  link: string;
  read_at: string | null;
  created_at: string;
  actor_name: string | null;
};

/** Oznámení příjemce (nejnovější první), včetně jména původce akce. */
export async function listForRecipient(tenantId: string, recipientId: string, limit = 30): Promise<NotificationRow[]> {
  return db
    .selectFrom('notifications')
    .leftJoin('persons', 'persons.id', 'notifications.actor_id')
    .where('notifications.tenant_id', '=', tenantId)
    .where('notifications.recipient_id', '=', recipientId)
    .select([
      'notifications.id as id',
      'notifications.type as type',
      'notifications.title as title',
      'notifications.body as body',
      'notifications.entity_kind as entity_kind',
      'notifications.entity_id as entity_id',
      'notifications.link as link',
      'notifications.read_at as read_at',
      'notifications.created_at as created_at',
      'persons.name as actor_name',
    ])
    .orderBy('notifications.created_at', 'desc')
    .limit(limit)
    .execute();
}

/** Počet nepřečtených oznámení příjemce (pro odznak u zvonku). */
export async function unreadCount(tenantId: string, recipientId: string): Promise<number> {
  const r = await db
    .selectFrom('notifications')
    .select((eb) => eb.fn.count<number>('id').as('n'))
    .where('tenant_id', '=', tenantId)
    .where('recipient_id', '=', recipientId)
    .where('read_at', 'is', null)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

/** Označí jedno oznámení přečteným (jen vlastníkovi, jen pokud bylo nepřečtené). */
export async function markRead(tenantId: string, id: string, recipientId: string): Promise<void> {
  await db
    .updateTable('notifications')
    .set({ read_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('recipient_id', '=', recipientId)
    .where('read_at', 'is', null)
    .execute();
}

/** Otevření oznámení: označí ho přečteným a vrátí cílový odkaz (null, když neexistuje / není můj). */
export async function openNotification(tenantId: string, id: string, recipientId: string): Promise<string | null> {
  const n = await db
    .selectFrom('notifications')
    .select(['link'])
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .where('recipient_id', '=', recipientId)
    .executeTakeFirst();
  if (!n) return null;
  await markRead(tenantId, id, recipientId);
  return n.link;
}

/** Označí přečtenými všechna nepřečtená oznámení daného typu (skupinový řádek). */
export async function markTypeRead(tenantId: string, recipientId: string, type: string): Promise<void> {
  await db
    .updateTable('notifications')
    .set({ read_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('recipient_id', '=', recipientId)
    .where('type', '=', type)
    .where('read_at', 'is', null)
    .execute();
}

/** Označí přečtenými všechna nepřečtená oznámení příjemce. */
export async function markAllRead(tenantId: string, recipientId: string): Promise<void> {
  await db
    .updateTable('notifications')
    .set({ read_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('recipient_id', '=', recipientId)
    .where('read_at', 'is', null)
    .execute();
}
