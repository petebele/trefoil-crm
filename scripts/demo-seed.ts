/**
 * Jednorázový seed DEMO dat pro osobní Nástěnku (Inbox „Vyžaduje moji pozornost").
 * Vkládá přes doménové funkce (žádné syrové SQL mimo model):
 *   • pár úkolů pro přihlášeného admina (po termínu / dnes / tento týden),
 *   • pár ČEKAJÍCÍCH výkazů (věci ke schválení),
 *   • události do feedu „Poslední dění".
 * Bezpečné vůči běžícímu serveru (WAL, vlastní spojení). Spusť: `npx tsx scripts/demo-seed.ts`.
 */
import { db } from '../src/db';
import { createTask } from '../src/domain/tasks';
import { createWorkRecord } from '../src/domain/workRecords';
import { logEvent } from '../src/domain/events';
import { fmtMinutes, BILLING_LABELS } from '../src/domain/workRecords';

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const tenant = await db.selectFrom('tenants').select('id').executeTakeFirstOrThrow();
const t = tenant.id;

// Přihlašuje se admin (Petr) — jemu patří úkoly a jako admin vidí všechny čekající výkazy.
const admin = await db
  .selectFrom('persons')
  .select(['id', 'name'])
  .where('tenant_id', '=', t)
  .where('is_admin', '=', 1)
  .where('deleted_at', 'is', null)
  .executeTakeFirstOrThrow();

// Kolega, jehož práci bude admin schvalovat — jednoznačná osoba (má login, jméno ≠ admin).
const colleague =
  (await db
    .selectFrom('persons')
    .select(['id', 'name'])
    .where('tenant_id', '=', t)
    .where('is_admin', '=', 0)
    .where('is_active', '=', 1)
    .where('deleted_at', 'is', null)
    .where('login_email', 'is not', null)
    .where('name', '!=', admin.name)
    .executeTakeFirst()) ?? admin;

const client = await db
  .selectFrom('clients')
  .select(['id', 'name'])
  .where('tenant_id', '=', t)
  .where('deleted_at', 'is', null)
  .executeTakeFirstOrThrow();

// Mapa kategorií úkolů (barevné chipy) podle value.
const catRows = await db
  .selectFrom('list_items')
  .innerJoin('lists', 'lists.id', 'list_items.list_id')
  .where('lists.tenant_id', '=', t)
  .where('lists.key', '=', 'task_categories')
  .select(['list_items.id as id', 'list_items.value as value'])
  .execute();
const cat = (v: string) => catRows.find((c) => c.value === v)?.id ?? null;

// Služby klienta (pro výkazy) — vybíráme podle labelu/detailu.
const services = await db
  .selectFrom('services')
  .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
  .where('services.tenant_id', '=', t)
  .where('services.client_id', '=', client.id)
  .where('services.status', '!=', 'ended')
  .select(['services.id as id', 'list_items.label as label', 'services.detail as detail'])
  .execute();
const svc = (match: string) => services.find((s) => `${s.label}${s.detail ? ` · ${s.detail}` : ''}`.includes(match)) ?? services[0]!;

console.log(`Tenant: ${tenant.id}\nAdmin (komu patří úkoly): ${admin.name}\nKolega (autor výkazů): ${colleague.name}\nKlient: ${client.name}\n`);

// ---------- 1) Úkoly pro admina (po termínu / dnes / tento týden) ----------
const demoTasks: Array<{ title: string; cat: string; due: string }> = [
  { title: 'Zavolat klientovi ohledně rozšíření PPC', cat: 'hovor', due: addDays(-2) },
  { title: 'Odeslat měsíční report za minulý měsíc', cat: 'email', due: addDays(-1) },
  { title: 'Schůzka — obsahová strategie na Q3', cat: 'schuzka', due: addDays(0) },
  { title: 'Připravit podklady pro fakturaci', cat: 'ukol', due: addDays(0) },
  { title: 'Revize klíčových slov pro marketplace', cat: 'ukol', due: addDays(1) },
  { title: 'Follow‑up: nabídka na projekt Mastodont', cat: 'follow_up', due: addDays(2) },
  { title: 'Aktualizovat publikační plán', cat: 'ukol', due: addDays(4) },
];

let tasksCreated = 0;
for (const d of demoTasks) {
  await createTask(t, admin.id, {
    title: d.title,
    categoryItemId: cat(d.cat),
    clientId: client.id,
    assigneeId: admin.id,
    dueAt: d.due,
  });
  tasksCreated++;
}
console.log(`✓ Úkoly: ${tasksCreated} (2 po termínu, 2 dnes, 3 tento týden)`);

// ---------- 2) Čekající výkazy (věci ke schválení) ----------
const demoRecords: Array<{ service: string; description: string; minutes: number; billing: 'retainer_hours' | 'billed' | 'free'; performed: string }> = [
  { service: 'Správa PPC kampaní', description: 'Optimalizace kampaní v Google Ads', minutes: 90, billing: 'retainer_hours', performed: addDays(-1) },
  { service: 'Publikační plán', description: 'Tvorba 3 článků na blog', minutes: 180, billing: 'retainer_hours', performed: addDays(-2) },
  { service: 'Správa marketplaces', description: 'Nastavení produktového feedu na Heureku', minutes: 60, billing: 'billed', performed: addDays(-2) },
  { service: 'projekt Mastodont', description: 'Reportní dashboard výkonu kampaní', minutes: 45, billing: 'retainer_hours', performed: addDays(0) },
];

let recCreated = 0;
for (const r of demoRecords) {
  const s = svc(r.service);
  const id = await createWorkRecord(t, colleague.id, {
    clientId: client.id,
    serviceId: s.id,
    taskId: null,
    description: r.description,
    note: null,
    minutes: r.minutes,
    performedAt: r.performed,
    billing: r.billing,
  });
  // událost do feedu „Poslední dění" (stejný formát jako web vrstva)
  await logEvent(
    t,
    'client',
    client.id,
    colleague.id,
    `Vykázána práce: ${r.description} (${s.label}${s.detail ? ` · ${s.detail}` : ''}, ${fmtMinutes(r.minutes)}, ${BILLING_LABELS[r.billing]}) #${id.slice(0, 8)}`,
  );
  recCreated++;
}
console.log(`✓ Čekající výkazy (ke schválení): ${recCreated}`);

console.log('\nHotovo. Otevři / (Nástěnka) jako admin — Inbox „Vyžaduje moji pozornost" je naplněný.');
process.exit(0);
