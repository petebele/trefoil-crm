import { sql } from 'kysely';
import { db } from '../db';
import { newId, now } from '../lib/util';
import { getStatus, listStatuses, doneStatusId, firstNonDoneId } from './taskStatuses';

/** Úkoly — osobní/týmové to‑do, volitelně navázané na zákazníka (Krok 7 + Kanban v2). */

export interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  done: number;
  done_at: string | null;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  category_label: string | null;
  category_color: string | null;
  source_kind: string | null;
  source_id: string | null;
  created_by_id: string | null;
  status_id: string | null;
  archived: number;
  board_month: string | null;
  sort_order: number;
}

export interface TaskInput {
  title: string;
  categoryItemId: string | null;
  clientId: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  boardMonth?: string | null; // YYYY-MM; undefined = aktuální měsíc
  statusId?: string | null;
}

const today = (): string => new Date().toISOString().slice(0, 10);
export const monthKey = (d: Date = new Date()): string => d.toISOString().slice(0, 7);
export function nextMonthKey(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y!, mo!, 1)).toISOString().slice(0, 7);
}

function baseQuery(tenantId: string) {
  return db
    .selectFrom('tasks')
    .leftJoin('list_items', 'list_items.id', 'tasks.category_item_id')
    .leftJoin('clients', 'clients.id', 'tasks.client_id')
    .leftJoin('persons', 'persons.id', 'tasks.assignee_id')
    .where('tasks.tenant_id', '=', tenantId)
    .select([
      'tasks.id as id',
      'tasks.title as title',
      'tasks.due_at as due_at',
      'tasks.done as done',
      'tasks.done_at as done_at',
      'tasks.client_id as client_id',
      'clients.name as client_name',
      'tasks.assignee_id as assignee_id',
      'persons.name as assignee_name',
      'list_items.label as category_label',
      'list_items.color as category_color',
      'tasks.source_kind as source_kind',
      'tasks.source_id as source_id',
      'tasks.created_by_id as created_by_id',
      'tasks.status_id as status_id',
      'tasks.archived as archived',
      'tasks.board_month as board_month',
      'tasks.sort_order as sort_order',
    ]);
}

// otevřené nahoře, pak dle termínu (bez termínu naspod), nejnovější naposled
const orderTasks = <T extends ReturnType<typeof baseQuery>>(q: T) =>
  q
    .orderBy('tasks.done')
    .orderBy(sql`tasks.due_at is null`)
    .orderBy('tasks.due_at')
    .orderBy('tasks.created_at', 'desc') as T;

/** Úkoly pro stránku /ukoly. `assigneeId` = jen moje; `undefined` = celý tým (admin). */
export async function listTasks(
  tenantId: string,
  opts: { assigneeId?: string; includeDone?: boolean } = {},
): Promise<TaskRow[]> {
  let q = baseQuery(tenantId).where('tasks.archived', '=', 0);
  if (opts.assigneeId) q = q.where('tasks.assignee_id', '=', opts.assigneeId);
  if (!opts.includeDone) q = q.where('tasks.done', '=', 0);
  return orderTasks(q).execute();
}

/** Otevřené úkoly přiřazené osobě (pro Nástěnku). */
export async function openTasksForPerson(tenantId: string, personId: string): Promise<TaskRow[]> {
  return orderTasks(baseQuery(tenantId).where('tasks.assignee_id', '=', personId).where('tasks.done', '=', 0).where('tasks.archived', '=', 0)).execute();
}

/** Úkoly navázané na zákazníka (pravý panel detailu) — otevřené nahoře. */
export async function tasksForClient(tenantId: string, clientId: string): Promise<TaskRow[]> {
  return orderTasks(baseQuery(tenantId).where('tasks.client_id', '=', clientId).where('tasks.archived', '=', 0)).execute();
}

export async function getTask(tenantId: string, id: string): Promise<TaskRow | null> {
  const r = await baseQuery(tenantId).where('tasks.id', '=', id).executeTakeFirst();
  return r ?? null;
}

export async function createTask(tenantId: string, createdById: string, data: TaskInput): Promise<string> {
  const id = newId();
  await db
    .insertInto('tasks')
    .values({
      id,
      tenant_id: tenantId,
      title: data.title,
      category_item_id: data.categoryItemId,
      client_id: data.clientId,
      assignee_id: data.assigneeId,
      due_at: data.dueAt,
      done: 0,
      done_at: null,
      status_id: data.statusId ?? null,
      prev_status_id: null,
      archived: 0,
      board_month: data.boardMonth !== undefined ? data.boardMonth : monthKey(),
      sort_order: 0,
      source_kind: null,
      source_id: null,
      created_by_id: createdById,
      created_at: now(),
    })
    .execute();
  return id;
}

export async function updateTask(tenantId: string, id: string, data: TaskInput): Promise<void> {
  await db
    .updateTable('tasks')
    .set({
      title: data.title,
      category_item_id: data.categoryItemId,
      client_id: data.clientId,
      assignee_id: data.assigneeId,
      due_at: data.dueAt,
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

/**
 * „Vyřízeno" ⇄ stav „Hotovo" (jeden fakt). Zaškrtnutí přesune do done‑stavu (a `done=1`),
 * odškrtnutí vrátí do předchozího stavu (jinak první ne‑done), `done=0`. Drží agendu i kanban v synchronu.
 */
export async function setTaskDone(tenantId: string, id: string, done: boolean): Promise<void> {
  const task = await db
    .selectFrom('tasks')
    .select(['assignee_id', 'prev_status_id'])
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .executeTakeFirst();
  if (!task) return;
  const statuses = task.assignee_id ? await listStatuses(tenantId, task.assignee_id) : [];
  const target = done ? doneStatusId(statuses) : task.prev_status_id ?? firstNonDoneId(statuses);
  if (target) {
    await setTaskStatus(tenantId, id, target);
  } else {
    // bez stavů (žádný kanban board) → jen příznak
    await db.updateTable('tasks').set({ done: done ? 1 : 0, done_at: done ? now() : null }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
  }
}

/** Přesun úkolu do stavu (sloupce). Synchronizuje `done` dle is_done stavu a pamatuje předchozí stav. */
export async function setTaskStatus(tenantId: string, taskId: string, statusId: string): Promise<void> {
  const target = await getStatus(tenantId, statusId);
  if (!target) return;
  const task = await db.selectFrom('tasks').select(['status_id', 'done']).where('tenant_id', '=', tenantId).where('id', '=', taskId).executeTakeFirst();
  if (!task) return;
  const isDone = target.is_done === 1;
  const set: { status_id: string; done: number; done_at: string | null; prev_status_id?: string | null } = {
    status_id: statusId,
    done: isDone ? 1 : 0,
    done_at: isDone ? now() : null,
  };
  if (isDone && task.done !== 1) set.prev_status_id = task.status_id; // zapamatuj, odkud přišel
  await db.updateTable('tasks').set(set).where('tenant_id', '=', tenantId).where('id', '=', taskId).execute();
}

/** Nastaví pořadí karet v sloupci (po drag‑drop). Materializuje i status_id (legacy null karty). */
export async function setColumnOrder(tenantId: string, statusId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.updateTable('tasks').set({ status_id: statusId, sort_order: i }).where('tenant_id', '=', tenantId).where('id', '=', orderedIds[i]!).execute();
  }
}

export async function archiveTask(tenantId: string, id: string, archived: boolean): Promise<void> {
  await db.updateTable('tasks').set({ archived: archived ? 1 : 0 }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** Zařadí úkol do měsíce (naplánuje) nebo do zásobníku (`null`). */
export async function setTaskBoardMonth(tenantId: string, id: string, month: string | null): Promise<void> {
  await db.updateTable('tasks').set({ board_month: month }).where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** Hromadně archivuje vyřízené úkoly daného boardu/měsíce. */
export async function archiveDoneInBoard(tenantId: string, ownerId: string, month: string | null): Promise<void> {
  let q = db.updateTable('tasks').set({ archived: 1 }).where('tenant_id', '=', tenantId).where('assignee_id', '=', ownerId).where('done', '=', 1).where('archived', '=', 0);
  q = month === null ? q.where('board_month', 'is', null) : q.where('board_month', '=', month);
  await q.execute();
}

/** Všechny aktivní (nearchivované) úkoly vlastníka napříč měsíci — pro kanban (Inbox je cross‑month). */
export async function listOwnerActiveTasks(tenantId: string, ownerId: string): Promise<TaskRow[]> {
  return baseQuery(tenantId)
    .where('tasks.assignee_id', '=', ownerId)
    .where('tasks.archived', '=', 0)
    .orderBy('tasks.sort_order')
    .orderBy('tasks.created_at', 'desc')
    .execute();
}

/** Úkoly boardu (osobní kanban): assignee = owner, měsíc, stav archivace. */
export async function listBoardTasks(
  tenantId: string,
  ownerId: string,
  opts: { month: string | null; archived?: 'active' | 'archived' },
): Promise<TaskRow[]> {
  let q = baseQuery(tenantId).where('tasks.assignee_id', '=', ownerId);
  q = (opts.archived ?? 'active') === 'archived' ? q.where('tasks.archived', '=', 1) : q.where('tasks.archived', '=', 0);
  q = opts.month === null ? q.where('tasks.board_month', 'is', null) : q.where('tasks.board_month', '=', opts.month);
  return q.orderBy('tasks.sort_order').orderBy('tasks.created_at', 'desc').execute();
}

/** Uzavře měsíc boardu: nehotové → další měsíc (stav zůstává); volitelně hotové archivuje. */
export async function closeMonth(
  tenantId: string,
  ownerId: string,
  month: string,
  archiveDone: boolean,
): Promise<{ moved: number; archived: number }> {
  const cnt = async (done: number) => {
    const rows = await db
      .selectFrom('tasks')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('assignee_id', '=', ownerId)
      .where('board_month', '=', month)
      .where('archived', '=', 0)
      .where('done', '=', done)
      .execute();
    return rows.length;
  };
  const moved = await cnt(0);
  await db
    .updateTable('tasks')
    .set({ board_month: nextMonthKey(month) })
    .where('tenant_id', '=', tenantId)
    .where('assignee_id', '=', ownerId)
    .where('board_month', '=', month)
    .where('archived', '=', 0)
    .where('done', '=', 0)
    .execute();
  let archived = 0;
  if (archiveDone) {
    archived = await cnt(1);
    await archiveDoneInBoard(tenantId, ownerId, month);
  }
  return { moved, archived };
}

export async function removeTask(tenantId: string, id: string): Promise<void> {
  await db.deleteFrom('tasks').where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

/** ID položky číselníku task_categories podle hodnoty (pro auto‑úkoly). */
export async function taskCategoryByValue(tenantId: string, value: string): Promise<string | null> {
  const row = await db
    .selectFrom('list_items')
    .innerJoin('lists', 'lists.id', 'list_items.list_id')
    .where('lists.tenant_id', '=', tenantId)
    .where('lists.key', '=', 'task_categories')
    .where('list_items.value', '=', value)
    .select('list_items.id as id')
    .executeTakeFirst();
  return row?.id ?? null;
}

/**
 * Auto‑úkol „schválit výkaz" pro odpovědnou osobu zákazníka. Bez odpovědné osoby
 * (assigneeId) se nevytváří. Idempotentní — neduplikuje pro stejný výkaz.
 */
export async function createApprovalTask(
  tenantId: string,
  data: { clientId: string; assigneeId: string | null; recordId: string; title: string; createdById: string },
): Promise<void> {
  if (!data.assigneeId) return;
  const existing = await db
    .selectFrom('tasks')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('source_kind', '=', 'work_record')
    .where('source_id', '=', data.recordId)
    .where('done', '=', 0)
    .executeTakeFirst();
  if (existing) return;

  await db
    .insertInto('tasks')
    .values({
      id: newId(),
      tenant_id: tenantId,
      title: data.title,
      category_item_id: await taskCategoryByValue(tenantId, 'follow_up'),
      client_id: data.clientId,
      assignee_id: data.assigneeId,
      due_at: today(),
      done: 0,
      done_at: null,
      status_id: null,
      prev_status_id: null,
      archived: 0,
      board_month: monthKey(),
      sort_order: 0,
      source_kind: 'work_record',
      source_id: data.recordId,
      created_by_id: data.createdById,
      created_at: now(),
    })
    .execute();
}

/** Uzavře (hotovo) všechny otevřené úkoly navázané na daný zdroj — např. schválený/smazaný výkaz. */
export async function closeSourceTasks(tenantId: string, sourceKind: string, sourceId: string): Promise<void> {
  await db
    .updateTable('tasks')
    .set({ done: 1, done_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('source_kind', '=', sourceKind)
    .where('source_id', '=', sourceId)
    .where('done', '=', 0)
    .execute();
}
