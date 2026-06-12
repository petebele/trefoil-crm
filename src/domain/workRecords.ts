import { db } from '../db';
import { newId, now } from '../lib/util';
import type { WorkRecordsTable, ClientsTable } from '../db/schema';

/**
 * Výkazy práce (Krok 6). Záznam se váže na zákazníka + jeho službu a má režim
 * účtování (default podle režimu služby, ručně přepnutelný). Do hodin a peněz
 * se počítají až SCHVÁLENÉ záznamy; schválením se záznam zamkne.
 */

export type Billing = WorkRecordsTable['billing'];

export const BILLING_LABELS: Record<Billing, string> = {
  retainer_hours: 'Z paušálu hodin',
  billed: 'Účtovat zvlášť',
  free: 'Neúčtovat',
};

export function isBilling(s: string): s is Billing {
  return s === 'retainer_hours' || s === 'billed' || s === 'free';
}

/** Výchozí účtování podle režimu služby. */
export function defaultBilling(serviceMode: 'subscription' | 'retainer' | 'payg'): Billing {
  if (serviceMode === 'retainer') return 'retainer_hours';
  if (serviceMode === 'payg') return 'billed';
  return 'free';
}

export interface WorkRecord extends WorkRecordsTable {
  client_name: string;
  service_label: string;
  service_detail: string | null;
  service_rate: number | null;
  worker_name: string;
  approved_by_name: string | null;
}

const baseSelect = () =>
  db
    .selectFrom('work_records')
    .innerJoin('clients', 'clients.id', 'work_records.client_id')
    .innerJoin('services', 'services.id', 'work_records.service_id')
    .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
    .innerJoin('persons as worker', 'worker.id', 'work_records.worker_id')
    .leftJoin('persons as approver', 'approver.id', 'work_records.approved_by_id')
    .selectAll('work_records')
    .select([
      'clients.name as client_name',
      'list_items.label as service_label',
      'services.detail as service_detail',
      'services.rate as service_rate',
      'worker.name as worker_name',
      'approver.name as approved_by_name',
    ]);

export async function getWorkRecord(tenantId: string, id: string): Promise<WorkRecord | null> {
  const row = await baseSelect().where('work_records.tenant_id', '=', tenantId).where('work_records.id', '=', id).executeTakeFirst();
  return (row as WorkRecord | undefined) ?? null;
}

/** Výkazy zákazníka v měsíci (YYYY-MM), nejnovější nahoře. */
export async function listForClientMonth(tenantId: string, clientId: string, month: string): Promise<WorkRecord[]> {
  const rows = await baseSelect()
    .where('work_records.tenant_id', '=', tenantId)
    .where('work_records.client_id', '=', clientId)
    .where('work_records.performed_at', 'like', `${month}%`)
    .orderBy('work_records.performed_at', 'desc')
    .orderBy('work_records.created_at', 'desc')
    .execute();
  return rows as WorkRecord[];
}

/** Výkazy pracovníka v měsíci. */
export async function listForWorkerMonth(tenantId: string, workerId: string, month: string): Promise<WorkRecord[]> {
  const rows = await baseSelect()
    .where('work_records.tenant_id', '=', tenantId)
    .where('work_records.worker_id', '=', workerId)
    .where('work_records.performed_at', 'like', `${month}%`)
    .orderBy('work_records.performed_at', 'desc')
    .orderBy('work_records.created_at', 'desc')
    .execute();
  return rows as WorkRecord[];
}

/** Čekající výkazy pro schvalovatele (odpovědná osoba zákazníka; admin vidí vše). */
export async function listPendingForApprover(tenantId: string, personId: string, isAdmin: boolean): Promise<WorkRecord[]> {
  let q = baseSelect().where('work_records.tenant_id', '=', tenantId).where('work_records.status', '=', 'pending');
  if (!isAdmin) q = q.where('clients.owner_id', '=', personId);
  const rows = await q.orderBy('work_records.performed_at').orderBy('work_records.created_at').execute();
  return rows as WorkRecord[];
}

/** Součty minut po pracovnících v měsíci (přehled pro adminy). */
export async function overviewByWorker(tenantId: string, month: string) {
  const rows = await db
    .selectFrom('work_records')
    .innerJoin('persons', 'persons.id', 'work_records.worker_id')
    .where('work_records.tenant_id', '=', tenantId)
    .where('work_records.performed_at', 'like', `${month}%`)
    .select(({ fn }) => [
      'work_records.worker_id as worker_id',
      'persons.name as worker_name',
      fn.sum<number>('work_records.minutes').as('total_minutes'),
      fn.count<number>('work_records.id').as('records'),
    ])
    .groupBy('work_records.worker_id')
    .orderBy('persons.name')
    .execute();
  return rows;
}

export interface WorkRecordInput {
  clientId: string;
  serviceId: string;
  description: string;
  note: string | null;
  minutes: number;
  performedAt: string;
  billing: Billing;
}

export async function createWorkRecord(tenantId: string, workerId: string, data: WorkRecordInput): Promise<string> {
  const id = newId();
  await db
    .insertInto('work_records')
    .values({
      id,
      tenant_id: tenantId,
      client_id: data.clientId,
      service_id: data.serviceId,
      worker_id: workerId,
      description: data.description,
      note: data.note,
      minutes: data.minutes,
      performed_at: data.performedAt,
      billing: data.billing,
      status: 'pending',
      approved_by_id: null,
      approved_at: null,
      created_at: now(),
    })
    .execute();
  return id;
}

export async function updateWorkRecord(tenantId: string, id: string, data: Omit<WorkRecordInput, 'clientId'>): Promise<void> {
  await db
    .updateTable('work_records')
    .set({
      service_id: data.serviceId,
      description: data.description,
      note: data.note,
      minutes: data.minutes,
      performed_at: data.performedAt,
      billing: data.billing,
    })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

export async function deleteWorkRecord(tenantId: string, id: string): Promise<void> {
  await db.deleteFrom('work_records').where('tenant_id', '=', tenantId).where('id', '=', id).execute();
}

export async function approveWorkRecord(tenantId: string, id: string, approverId: string): Promise<void> {
  await db
    .updateTable('work_records')
    .set({ status: 'approved', approved_by_id: approverId, approved_at: now() })
    .where('tenant_id', '=', tenantId)
    .where('id', '=', id)
    .execute();
}

// ---------- čerpání paušálu a peníze měsíce ----------

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y!, m! - 1 + delta, 1));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

async function approvedRetainerMinutes(tenantId: string, clientId: string, month: string): Promise<number> {
  const row = await db
    .selectFrom('work_records')
    .where('tenant_id', '=', tenantId)
    .where('client_id', '=', clientId)
    .where('status', '=', 'approved')
    .where('billing', '=', 'retainer_hours')
    .where('performed_at', 'like', `${month}%`)
    .select(({ fn }) => fn.sum<number>('minutes').as('m'))
    .executeTakeFirst();
  return Number(row?.m ?? 0);
}

/**
 * Převedené minuty z dřívějších měsíců (rollover). Počítá řetězově od prvního
 * měsíce s výkazy; bez zaškrtnutého převádění vždy 0.
 */
export async function carryoverMinutes(tenantId: string, client: ClientsTable, month: string): Promise<number> {
  if (client.hours_budget_monthly === null || client.hours_rollover !== 1) return 0;
  const budgetMin = Math.round(client.hours_budget_monthly * 60);

  const first = await db
    .selectFrom('work_records')
    .where('tenant_id', '=', tenantId)
    .where('client_id', '=', client.id)
    .where('status', '=', 'approved')
    .where('billing', '=', 'retainer_hours')
    .select(({ fn }) => fn.min<string>('performed_at').as('d'))
    .executeTakeFirst();
  if (!first?.d) return 0;

  let cursor = first.d.slice(0, 7);
  let carry = 0;
  for (let i = 0; cursor < month && i < 120; i++) {
    const used = await approvedRetainerMinutes(tenantId, client.id, cursor);
    carry = Math.max(0, budgetMin + carry - used);
    cursor = shiftMonth(cursor, 1);
  }
  return carry;
}

export interface MonthMoney {
  totalMinutes: number; // vykázáno celkem (vč. čekajících)
  pendingCount: number;
  budgetMinutes: number | null; // paušál (vč. převedených), null = bez paušálu
  carryMinutes: number;
  usedRetainerMinutes: number; // schválené z paušálu
  overageMinutes: number; // přečerpání
  overageCost: number; // přečerpané minuty × sazba služby záznamu
  billedMinutes: number; // schválené „účtovat zvlášť"
  billedCost: number;
}

/** Měsíční souhrn výkazů zákazníka: hodiny (čerpání paušálu) i peníze (vícepráce). */
export async function clientMonthMoney(tenantId: string, client: ClientsTable, month: string): Promise<MonthMoney> {
  const records = await listForClientMonth(tenantId, client.id, month);
  const approved = records.filter((r) => r.status === 'approved');

  const carryMinutes = await carryoverMinutes(tenantId, client, month);
  const budgetMinutes = client.hours_budget_monthly === null ? null : Math.round(client.hours_budget_monthly * 60) + carryMinutes;

  // přečerpání: schválené paušálové minuty chronologicky; co přeteče, účtuje se sazbou služby záznamu
  const retainerAsc = approved
    .filter((r) => r.billing === 'retainer_hours')
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at) || a.created_at.localeCompare(b.created_at));
  let cumulative = 0;
  let overageMinutes = 0;
  let overageCost = 0;
  const allowance = budgetMinutes ?? 0;
  for (const r of retainerAsc) {
    const over = Math.max(0, Math.min(r.minutes, cumulative + r.minutes - allowance));
    cumulative += r.minutes;
    if (over > 0) {
      overageMinutes += over;
      overageCost += (over / 60) * (r.service_rate ?? 0);
    }
  }

  const billed = approved.filter((r) => r.billing === 'billed');
  const billedMinutes = billed.reduce((s, r) => s + r.minutes, 0);
  const billedCost = billed.reduce((s, r) => s + (r.minutes / 60) * (r.service_rate ?? 0), 0);

  return {
    totalMinutes: records.reduce((s, r) => s + r.minutes, 0),
    pendingCount: records.filter((r) => r.status === 'pending').length,
    budgetMinutes,
    carryMinutes,
    usedRetainerMinutes: cumulative,
    overageMinutes,
    overageCost,
    billedMinutes,
    billedCost,
  };
}

/** Formát minut: „12:30 h". */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')} h`;
}
