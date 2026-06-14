import { sql } from 'kysely';
import { db } from '../db';
import { newId, now } from '../lib/util';

/** Úkoly — osobní/týmové to‑do, volitelně navázané na zákazníka (Krok 7). */

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
}

export interface TaskInput {
  title: string;
  categoryItemId: string | null;
  clientId: string | null;
  assigneeId: string | null;
  dueAt: string | null;
}

const today = (): string => new Date().toISOString().slice(0, 10);

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
  let q = baseQuery(tenantId);
  if (opts.assigneeId) q = q.where('tasks.assignee_id', '=', opts.assigneeId);
  if (!opts.includeDone) q = q.where('tasks.done', '=', 0);
  return orderTasks(q).execute();
}

/** Otevřené úkoly přiřazené osobě (pro Nástěnku). */
export async function openTasksForPerson(tenantId: string, personId: string): Promise<TaskRow[]> {
  return orderTasks(baseQuery(tenantId).where('tasks.assignee_id', '=', personId).where('tasks.done', '=', 0)).execute();
}

/** Úkoly navázané na zákazníka (pravý panel detailu) — otevřené nahoře. */
export async function tasksForClient(tenantId: string, clientId: string): Promise<TaskRow[]> {
  return orderTasks(baseQuery(tenantId).where('tasks.client_id', '=', clientId)).execute();
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

export async function setTaskDone(tenantId: string, id: string, done: boolean): Promise<void> {
  await db
    .updateTable('tasks')
    .set({ done: done ? 1 : 0, done_at: done ? now() : null })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
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
