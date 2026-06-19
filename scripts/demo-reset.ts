/**
 * RESET DEMO dat: vyčistí všechny úkoly a výkazy (+ jejich události ve feedu) a nasází čerstvá
 * dummy data pro VŠECHNY přihlašované uživatele.
 *
 * Vkládá přes doménové funkce (žádné syrové SQL pro zápis modelu):
 *   • úkoly pro každého uživatele — napříč termíny (po termínu / dnes / tento týden / bez termínu)
 *     i kategoriemi, část už „hotová",
 *   • výkazy práce ve všech 4 stavech (čeká / schváleno / vráceno k přepracování / zamítnuto),
 *     s realistickým čerpáním paušálu Conviu (úmyslně lehce přečerpáno → demo přečerpání),
 *   • události „Vykázána práce" do feedu „Poslední dění".
 *
 * Mazání je tu legitimní administrátorský úklid demo dat (princip „nic se nemaže" platí pro
 * aplikační akce uživatelů, ne pro seed). Bezpečné vůči běžícímu serveru (WAL, vlastní spojení).
 * Spusť: `npx tsx scripts/demo-reset.ts`.
 */
import { db } from '../src/db';
import { createTask, setTaskDone } from '../src/domain/tasks';
import {
  createWorkRecord,
  approveWorkRecord,
  returnWorkRecord,
  rejectWorkRecord,
  fmtMinutes,
  BILLING_LABELS,
} from '../src/domain/workRecords';
import { logEvent } from '../src/domain/events';
import { notify, notifyPendingApproval, unreadCount, type NotificationType } from '../src/domain/notifications';

type Billing = 'retainer_hours' | 'billed' | 'free';

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const t = (await db.selectFrom('tenants').select('id').executeTakeFirstOrThrow()).id;

// ---------- Uživatelé (jen reální členové týmu = mají přihlášení) ----------
const users = await db
  .selectFrom('persons')
  .select(['id', 'name', 'is_admin'])
  .where('tenant_id', '=', t)
  .where('deleted_at', 'is', null)
  .where('is_active', '=', 1)
  .where('login_email', 'is not', null)
  .execute();
const U = (firstName: string) => {
  const u = users.find((x) => x.name.startsWith(firstName));
  if (!u) throw new Error(`Uživatel „${firstName}" nenalezen`);
  return u;
};
const admins = users.filter((u) => u.is_admin === 1);
// schvalovatel = nějaký admin jiný než autor (jinak první admin / první uživatel)
const approverFor = (workerId: string) => (admins.find((a) => a.id !== workerId) ?? admins[0] ?? users[0]!).id;

const Petr = U('Petr');
const Ivana = U('Ivana');
const Alena = U('Alena');
const Denisa = U('Denisa');
const Adela = U('Adéla');

// ---------- Klient + služby ----------
const conviu = await db
  .selectFrom('clients')
  .select(['id', 'name', 'display_name', 'owner_id'])
  .where('tenant_id', '=', t)
  .where('deleted_at', 'is', null)
  .executeTakeFirstOrThrow();

const services = await db
  .selectFrom('services')
  .innerJoin('list_items', 'list_items.id', 'services.catalog_item_id')
  .where('services.tenant_id', '=', t)
  .where('services.status', '!=', 'ended')
  .select(['services.id as id', 'services.client_id as cid', 'list_items.label as label', 'services.detail as detail'])
  .execute();
const svc = (match: string) => {
  const s = services.find((x) => `${x.label}${x.detail ? ` · ${x.detail}` : ''}`.includes(match));
  if (!s) throw new Error(`Služba „${match}" nenalezena`);
  return s;
};
const PPC = svc('Správa PPC kampaní'); // první match = čistá PPC (bez detailu)
const Plan = svc('Publikační plán'); // první match = obsah (bez detailu)
const Mastodont = svc('Mastodont');
const Lenochod = svc('lenochod');
const Market = svc('marketplaces');

// ---------- Štítky úkolů (barevné chipy; „ukol" už neexistuje → bez štítku) ----------
const catRows = await db
  .selectFrom('list_items')
  .innerJoin('lists', 'lists.id', 'list_items.list_id')
  .where('lists.tenant_id', '=', t)
  .where('lists.key', '=', 'task_labels')
  .select(['list_items.id as id', 'list_items.value as value'])
  .execute();
const labelIdsFor = (v: string): string[] => {
  const id = catRows.find((c) => c.value === v)?.id;
  return id ? [id] : [];
};

// ================= ÚKLID =================
const wr = await db.deleteFrom('work_records').where('tenant_id', '=', t).executeTakeFirst();
const tk = await db.deleteFrom('tasks').where('tenant_id', '=', t).executeTakeFirst();
const nt = await db.deleteFrom('notifications').where('tenant_id', '=', t).executeTakeFirst();
// štítky úkolů (entity_list_items se nemažou kaskádou s úkolem) — ať nezůstávají osiřelé
await db.deleteFrom('entity_list_items').where('tenant_id', '=', t).where('entity_kind', '=', 'task').execute();
const ev = await db
  .deleteFrom('events')
  .where('tenant_id', '=', t)
  .where('action', 'like', 'Vykázána práce%')
  .executeTakeFirst();
console.log(
  `Vyčištěno: výkazy=${wr.numDeletedRows} úkoly=${tk.numDeletedRows} oznámení=${nt.numDeletedRows} události(výkazy)=${ev.numDeletedRows}\n`,
);

// ================= ÚKOLY =================
type T = { title: string; cat: string; due: number | null; client?: boolean; done?: boolean };
const TASKS: Array<{ owner: typeof Petr; items: T[] }> = [
  {
    owner: Petr,
    items: [
      { title: 'Zkontrolovat nastavení měření na webu', cat: 'ukol', due: -2 },
      { title: 'Schválit výkazy týmu za tento týden', cat: 'ukol', due: -1 },
      { title: 'Hovor s klientem — rozšíření obsahu', cat: 'hovor', due: 0 },
      { title: 'Revize publikačního plánu na červenec', cat: 'ukol', due: 3 },
      { title: 'Follow‑up nabídky na projekt lenochod', cat: 'follow_up', due: 5 },
      { title: 'Odeslán měsíční report za květen', cat: 'email', due: -3, done: true },
    ],
  },
  {
    owner: Ivana,
    items: [
      { title: 'Kontrola feedu na marketplaces', cat: 'ukol', due: -1 },
      { title: 'Optimalizace PPC kampaní v Google Ads', cat: 'ukol', due: 0 },
      { title: 'Nastavit nové publikum pro remarketing', cat: 'ukol', due: 1 },
      { title: 'Schůzka — strategie PPC na Q3', cat: 'schuzka', due: 2 },
      { title: 'Týdenní reporting výkonu kampaní', cat: 'ukol', due: 4 },
      { title: 'Úprava rozpočtů kampaní dle výkonu', cat: 'ukol', due: -2, done: true },
    ],
  },
  {
    owner: Alena,
    items: [
      { title: 'Vyžádat od klienta podklady k článku', cat: 'email', due: -1 },
      { title: 'Korektura textů na web', cat: 'ukol', due: 0 },
      { title: 'Sepsat 2 články na blog', cat: 'ukol', due: 1 },
      { title: 'Najít témata na příští měsíc', cat: 'ukol', due: 3 },
      { title: 'Publikace článku o trendech v obsahu', cat: 'ukol', due: -2, done: true },
    ],
  },
  {
    owner: Denisa,
    items: [
      { title: 'Reportovat dosah příspěvků', cat: 'ukol', due: -1 },
      { title: 'Příprava grafiky pro příspěvky', cat: 'ukol', due: 0 },
      { title: 'Naplánovat příspěvky na sociální sítě', cat: 'ukol', due: 2 },
      { title: 'Aktualizace produktových popisů', cat: 'ukol', due: 4 },
      { title: 'Grafika pro newsletter', cat: 'ukol', due: -3, done: true },
    ],
  },
  {
    owner: Adela,
    items: [
      { title: 'Zkontrolovat čerpání hodin paušálu', cat: 'ukol', due: -1 },
      { title: 'Projít vyúčtování za tento měsíc', cat: 'ukol', due: 0 },
      { title: 'Měsíční sync s klientem', cat: 'schuzka', due: 1 },
      { title: 'Připravit podklady k fakturaci', cat: 'ukol', due: 2 },
      { title: 'Follow‑up: rozšíření spolupráce', cat: 'follow_up', due: 5 },
      { title: 'Schválen rozpočet na Q3', cat: 'ukol', due: -2, done: true },
    ],
  },
];

let nTasks = 0;
for (const grp of TASKS) {
  for (const it of grp.items) {
    const id = await createTask(t, grp.owner.id, {
      title: it.title,
      labelIds: labelIdsFor(it.cat),
      clientId: it.client === false ? null : conviu.id,
      assigneeId: grp.owner.id,
      dueAt: it.due === null ? null : addDays(it.due),
    });
    if (it.done) await setTaskDone(t, id, true);
    nTasks++;
  }
}
console.log(`✓ Úkoly: ${nTasks} (pro ${TASKS.length} uživatelů, mix termínů + pár hotových)`);

// ================= VÝKAZY =================
type R = {
  worker: typeof Petr;
  svc: typeof PPC;
  desc: string;
  min: number;
  billing: Billing;
  day: number;
  status?: 'pending' | 'approved' | 'returned' | 'rejected';
  reason?: string; // instrukce (returned) / důvod (rejected)
  note?: string;
};
const RECORDS: R[] = [
  // Ivana — PPC + marketplaces
  { worker: Ivana, svc: PPC, desc: 'Optimalizace nabídek a rozpočtů', min: 90, billing: 'retainer_hours', day: -2, status: 'approved' },
  { worker: Ivana, svc: PPC, desc: 'Tvorba nových reklamních sestav', min: 75, billing: 'retainer_hours', day: -5, status: 'approved' },
  { worker: Ivana, svc: Market, desc: 'Aktualizace produktového feedu na Heureku', min: 60, billing: 'retainer_hours', day: -1, status: 'pending' },
  { worker: Ivana, svc: Market, desc: 'Řešení zamítnutých nabídek na Zboží.cz', min: 45, billing: 'billed', day: -3, status: 'pending' },
  { worker: Ivana, svc: PPC, desc: 'A/B test reklamních textů', min: 30, billing: 'retainer_hours', day: -8, status: 'returned', reason: 'Doplň prosím konkrétní varianty textů a výsledky testu.' },
  // Petr — obsah + Mastodont + lenochod
  { worker: Petr, svc: Plan, desc: 'Tvorba 3 článků na blog', min: 180, billing: 'retainer_hours', day: -4, status: 'approved' },
  { worker: Petr, svc: Plan, desc: 'Editace a korektura obsahu', min: 60, billing: 'retainer_hours', day: -6, status: 'returned', reason: 'Sjednoť prosím tonalitu napříč články.' },
  { worker: Petr, svc: Mastodont, desc: 'Reportní dashboard výkonu kampaní', min: 90, billing: 'retainer_hours', day: -2, status: 'pending' },
  { worker: Petr, svc: Lenochod, desc: 'Konzultace zadání projektu', min: 60, billing: 'billed', day: -7, status: 'approved' },
  { worker: Petr, svc: Plan, desc: 'Brainstorming témat na další měsíc', min: 45, billing: 'free', day: -9, status: 'pending' },
  // Adéla — koordinace napříč službami
  { worker: Adela, svc: Plan, desc: 'Příprava obsahového plánu na červenec', min: 60, billing: 'retainer_hours', day: -1, status: 'pending' },
  { worker: Adela, svc: PPC, desc: 'Strategická porada k PPC', min: 30, billing: 'retainer_hours', day: -3, status: 'pending' },
  { worker: Adela, svc: Market, desc: 'Analýza konkurence na marketplaces', min: 45, billing: 'billed', day: -5, status: 'rejected', reason: 'Analýza nebyla klientem objednána, nelze ji účtovat.' },
  // Alena — obsah
  { worker: Alena, svc: Plan, desc: 'Sepsání článku: trendy v obsahu', min: 120, billing: 'retainer_hours', day: -2, status: 'approved' },
  { worker: Alena, svc: Plan, desc: 'Korektura webových textů', min: 45, billing: 'retainer_hours', day: -4, status: 'pending' },
  { worker: Alena, svc: Plan, desc: 'Research zdrojů k článku', min: 30, billing: 'free', day: -6, status: 'pending' },
  // Denisa — obsah + marketplaces
  { worker: Denisa, svc: Plan, desc: 'Grafika k příspěvkům na sociální sítě', min: 90, billing: 'retainer_hours', day: -1, status: 'pending' },
  { worker: Denisa, svc: Market, desc: 'Úprava produktových popisů', min: 60, billing: 'retainer_hours', day: -3, status: 'returned', reason: 'Sjednoť prosím tonalitu popisů podle brand manuálu.' },
  { worker: Denisa, svc: Plan, desc: 'Naplánování příspěvků', min: 30, billing: 'retainer_hours', day: -5, status: 'approved' },
];

const tally: Record<string, number> = { pending: 0, approved: 0, returned: 0, rejected: 0 };
for (const r of RECORDS) {
  const id = await createWorkRecord(t, r.worker.id, {
    clientId: r.svc.cid,
    serviceId: r.svc.id,
    taskId: null,
    description: r.desc,
    note: r.note ?? null,
    minutes: r.min,
    performedAt: addDays(r.day),
    billing: r.billing,
  });
  const status = r.status ?? 'pending';
  const decidedBy = approverFor(r.worker.id);
  if (status === 'approved') await approveWorkRecord(t, id, decidedBy);
  else if (status === 'returned') await returnWorkRecord(t, id, r.reason ?? null);
  else if (status === 'rejected') await rejectWorkRecord(t, id, r.reason ?? null);
  tally[status]!++;

  // Notifikace — replikuje, co dělá web vrstva (ať má admin po resetu plný zvonek vč. seskupení).
  const body = `${r.desc} (${fmtMinutes(r.min)})`;
  if (status === 'pending') {
    await notifyPendingApproval(t, { clientOwnerId: conviu.owner_id ?? null, actorId: r.worker.id, body, entityId: id, link: '/vykazy?tab=schvalovani' });
  } else {
    const TITLE: Record<'approved' | 'returned' | 'rejected', string> = {
      approved: 'Výkaz byl schválen',
      returned: 'Výkaz byl vrácen k přepracování',
      rejected: 'Výkaz byl zamítnut',
    };
    const TYPE: Record<'approved' | 'returned' | 'rejected', NotificationType> = {
      approved: 'work_record_approved',
      returned: 'work_record_returned',
      rejected: 'work_record_rejected',
    };
    await notify(t, {
      recipientId: r.worker.id,
      actorId: decidedBy,
      type: TYPE[status],
      title: TITLE[status],
      body: r.reason ? `${r.desc} — ${r.reason}` : body,
      entityKind: 'work_record',
      entityId: id,
      link: `/vykazy?tab=muj&stav=${status}`,
    });
  }

  await logEvent(
    t,
    'client',
    r.svc.cid,
    r.worker.id,
    `Vykázána práce: ${r.desc} (${r.svc.label}${r.svc.detail ? ` · ${r.svc.detail}` : ''}, ${fmtMinutes(r.min)}, ${BILLING_LABELS[r.billing]}) #${id.slice(0, 8)}`,
  );
}
console.log(
  `✓ Výkazy: ${RECORDS.length} — čeká:${tally.pending} schváleno:${tally.approved} vráceno:${tally.returned} zamítnuto:${tally.rejected}`,
);

// ================= SOUHRN NOTIFIKACÍ =================
console.log('✓ Notifikace (nepřečtených na uživatele):');
for (const u of users) {
  const n = await unreadCount(t, u.id);
  if (n > 0) console.log(`   • ${u.name}: ${n}`);
}

console.log(
  `\nHotovo pro ${users.length} uživatelů (${users.map((u) => u.name).join(', ')}).\n` +
    `Klient: ${conviu.display_name || conviu.name}. Otevři / (Nástěnka), /vykazy a zvonek vpravo nahoře.`,
);
process.exit(0);
