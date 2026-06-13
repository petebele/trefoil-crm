// Dočasný E2E test Kroku 6 (Výkazy práce). Vlastní TestE2E záznamy, po sobě uklidí.
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const db = new Database('data/crm.db');
const BASE = 'http://localhost:3000';
const kc = (n) => n.toLocaleString('cs-CZ');
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  OK  ${name}`); } else { fail++; console.log(`  FAIL ${name}`); }
};

const tenant = db.prepare('SELECT id FROM tenants LIMIT 1').get();
const admin = db.prepare(
  'SELECT id, name FROM persons WHERE login_email IS NOT NULL AND is_admin = 1 AND is_active = 1 AND tenant_id = ? ORDER BY created_at LIMIT 1',
).get(tenant.id);

const sid = 'e2etest-' + randomUUID().replace(/-/g, '');
db.prepare('INSERT INTO sessions (id, person_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
  sid, admin.id, new Date(Date.now() + 3600_000).toISOString(), new Date().toISOString(),
);

async function req(path, { method = 'GET', form, cookie = sid, extraHeaders = {} } = {}) {
  const headers = { cookie: `sid=${cookie}`, ...extraHeaders };
  let body;
  if (form) {
    body = new URLSearchParams(form).toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual' });
  const text = res.status === 200 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location') ?? '', text };
}

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const day = (d) => `${month}-${String(d).padStart(2, '0')}`;

const cleanup = { clients: [], persons: [], catalogItems: [], sessions: [sid], vykazyWasOn: true };
try {
  // modul vykazy zapnout (a po testu vrátit)
  cleanup.vykazyWasOn = !!db.prepare("SELECT 1 FROM tenant_modules WHERE tenant_id = ? AND module = 'vykazy'").get(tenant.id);
  if (!cleanup.vykazyWasOn) db.prepare("INSERT INTO tenant_modules (tenant_id, module) VALUES (?, 'vykazy')").run(tenant.id);

  // --- příprava: firma + 2 služby v katalogu + přidělení + paušál 2 h ---
  await req('/firmy', { method: 'POST', form: { name: 'TestE2E Firma K6', status: 'active' } });
  const client = db.prepare("SELECT * FROM clients WHERE name = 'TestE2E Firma K6'").get();
  cleanup.clients.push(client.id);
  const fbase = `/firmy/${client.id}`;

  await req('/administrace/sluzby', { method: 'POST', form: { name: 'TestE2E SEO K6', description: '', mode: 'retainer', price: '1000' } });
  await req('/administrace/sluzby', { method: 'POST', form: { name: 'TestE2E Jednorázovky K6', description: '', mode: 'payg', price: '800' } });
  const catA = db.prepare("SELECT li.* FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.key = 'service_catalog' AND li.label = 'TestE2E SEO K6'").get();
  const catB = db.prepare("SELECT li.* FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.key = 'service_catalog' AND li.label = 'TestE2E Jednorázovky K6'").get();
  cleanup.catalogItems.push(catA.id, catB.id);

  await req(`${fbase}/sluzby`, { method: 'POST', form: { catalog_item_id: catA.id, detail: '', description: '', mode: 'retainer', rate: '1000', monthly_amount: '', owner_id: admin.id } });
  await req(`${fbase}/sluzby`, { method: 'POST', form: { catalog_item_id: catB.id, detail: '', description: '', mode: 'payg', rate: '800', monthly_amount: '', owner_id: '' } });
  const svcA = db.prepare('SELECT * FROM services WHERE client_id = ? AND catalog_item_id = ?').get(client.id, catA.id);
  const svcB = db.prepare('SELECT * FROM services WHERE client_id = ? AND catalog_item_id = ?').get(client.id, catB.id);
  await req(`${fbase}/pausal`, { method: 'POST', form: { hours: '2', price: '5000', rollover: '' } });
  ok('příprava (firma, služby, paušál 2 h)', !!svcA && !!svcB);

  // --- stránka a modály ---
  let r = await req('/vykazy');
  ok('/vykazy: stránka + záložky', r.status === 200 && r.text.includes('Můj výkaz') && r.text.includes('Schvalování') && r.text.includes('Přehled'));
  r = await req('/');
  ok('lišta: Výkaz práce v Přidat+', r.text.includes('/vykazy/modal/novy'));
  r = await req('/vykazy/modal/novy');
  ok('modál: výběr zákazníka', r.text.includes('vyberte zákazníka'));
  r = await req(`/vykazy/modal/novy?klient=${client.id}`);
  ok('modál s klientem: služby + výchozí účtování', r.text.includes('TestE2E SEO K6') && r.text.includes('data-set-billing="retainer_hours"') && r.text.includes('data-set-billing="billed"'));
  r = await req('/vykazy/modal/novy', { extraHeaders: { 'HX-Current-URL': `${BASE}${fbase}?tab=sluzby` } });
  ok('kontext z lišty: klient předvybrán dle aktuální stránky', r.text.includes('TestE2E Firma K6') && !r.text.includes('vyberte zákazníka'));
  r = await req(`/vykazy/modal/novy?klient=${client.id}&sluzba=${svcB.id}`);
  ok('Vykázat ze služby: služba předvybraná + účtování dle ní', r.text.includes(`value="${svcB.id}" selected`) && r.text.includes('value="billed" selected'));

  // --- výkaz A: 1:30 z paušálu ---
  await req('/vykazy', { method: 'POST', form: { client_id: client.id, service_id: svcA.id, description: 'TestE2E optimalizace', note: '', hours: '1', mins: '30', performed_at: day(5), billing: 'retainer_hours', back: `${fbase}?tab=sluzby&mesic=${month}` } });
  const recA = db.prepare('SELECT * FROM work_records WHERE client_id = ?').get(client.id);
  ok('výkaz A: 90 min, rovnou schválen (zadal schvalovatel)', !!recA && recA.minutes === 90 && recA.status === 'approved' && recA.approved_by_id === admin.id && recA.billing === 'retainer_hours');
  r = await req(`${fbase}?tab=sluzby&mesic=${month}`);
  ok('čerpání hned po vykázání: 1:30 z 2:00, zbývá 0:30', r.text.includes('TestE2E optimalizace') && r.text.includes('čerpáno <b>1:30 h</b>') && r.text.includes('zbývá <b>0:30 h</b>'));

  // --- výkaz B: 1:00 z paušálu → přečerpání 0:30 ---
  await req('/vykazy', { method: 'POST', form: { client_id: client.id, service_id: svcA.id, description: 'TestE2E navíc', note: '', hours: '1', mins: '0', performed_at: day(12), billing: 'retainer_hours', back: '/' } });
  const recB = db.prepare("SELECT * FROM work_records WHERE client_id = ? AND description = 'TestE2E navíc'").get(client.id);
  await req(`/vykazy/${recB.id}/schvalit`, { method: 'POST', form: { back: '/' } });
  r = await req(`${fbase}?tab=sluzby&mesic=${month}`);
  ok('přečerpání 0:30 zvýrazněno', r.text.includes('přečerpáno 0:30 h'));

  // --- výkaz C: 1:00 účtovat zvlášť (payg, 800 Kč/h) ---
  await req('/vykazy', { method: 'POST', form: { client_id: client.id, service_id: svcB.id, description: 'TestE2E jednorázovka', note: 'detail', hours: '1', mins: '0', performed_at: day(15), billing: 'billed', back: '/' } });
  const recC = db.prepare("SELECT * FROM work_records WHERE client_id = ? AND description = 'TestE2E jednorázovka'").get(client.id);
  await req(`/vykazy/${recC.id}/schvalit`, { method: 'POST', form: { back: '/' } });
  r = await req(`${fbase}?tab=sluzby&mesic=${month}`);
  // vícepráce = 0:30×1000 + 1:00×800 = 1300; celkem = paušál 5000 + 1300
  ok('Měsíčně celkem: vícepráce 1 300 Kč', r.text.includes('Vícepráce — schváleno') && r.text.includes(`${kc(1300)} Kč`));
  ok('Měsíčně celkem: součet 6 300 Kč', r.text.includes(`${kc(6300)} Kč/měs`));
  ok('Měsíčně celkem: čerpání paušálu v řádku', r.text.includes('Paušál hodin (čerpáno'));

  // --- Můj výkaz + Přehled ---
  r = await req(`/vykazy?tab=muj&mesic=${month}`);
  ok('Můj výkaz: testovací záznamy vidět', r.text.includes('TestE2E optimalizace') && r.text.includes('TestE2E jednorázovka'));
  r = await req(`/vykazy?tab=prehled&mesic=${month}`);
  ok('Přehled: souhrn pracovníka', r.text.includes(admin.name));
  r = await req(`/vykazy?tab=schvalovani`);
  ok('Schvalování: schválené TestE2E záznamy nečekají', !r.text.includes('TestE2E optimalizace') && !r.text.includes('TestE2E jednorázovka'));

  // --- práva: schválený záznam autor needituje; běžný uživatel neschválí ---
  await req('/administrace/tym', { method: 'POST', form: { name: 'TestE2E User K6', email: 'teste2e-k6@trefoil.test', role: 'user', password: 'tajneheslo1' } });
  const user = db.prepare("SELECT id FROM persons WHERE login_email = 'teste2e-k6@trefoil.test'").get();
  cleanup.persons.push(user.id);
  const usid = 'e2etest-' + randomUUID().replace(/-/g, '');
  db.prepare('INSERT INTO sessions (id, person_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    usid, user.id, new Date(Date.now() + 600_000).toISOString(), new Date().toISOString(),
  );
  cleanup.sessions.push(usid);

  await req('/vykazy', { method: 'POST', form: { client_id: client.id, service_id: svcB.id, description: 'TestE2E od usera', note: '', hours: '0', mins: '30', performed_at: day(20), billing: 'billed', back: '/' }, cookie: usid });
  const recD = db.prepare("SELECT * FROM work_records WHERE client_id = ? AND description = 'TestE2E od usera'").get(client.id);
  ok('uživatel vykázal (billed, 30 min, pending)', !!recD && recD.worker_id === user.id && recD.billing === 'billed' && recD.status === 'pending');
  r = await req(`/vykazy/${recD.id}/schvalit`, { method: 'POST', form: { back: '/' }, cookie: usid });
  const recD2 = db.prepare('SELECT status FROM work_records WHERE id = ?').get(recD.id);
  ok('uživatel (ne odpovědný) neschválí', recD2.status === 'pending');
  r = await req(`${fbase}?tab=sluzby&mesic=${month}`);
  // čekající 0:30 × 800 = 400 Kč → očekávaný měsíc 5000+1300+400 = 6700
  ok('čekající vícepráce v součtu (rezervace)', r.text.includes('Vícepráce — čeká na schválení') && r.text.includes(`${kc(400)} Kč`) && r.text.includes(`${kc(6700)} Kč/měs`));
  r = await req(`/vykazy/${recA.id}/modal`, { cookie: usid });
  ok('cizí schválený výkaz needitovatelný', r.status === 302);
  await req(`/vykazy/${recD.id}/smazat`, { method: 'POST', form: { back: '/' }, cookie: usid });
  ok('autor smaže svůj čekající výkaz', !db.prepare('SELECT 1 FROM work_records WHERE id = ?').get(recD.id));

  // --- úprava výkazu (admin) ---
  r = await req(`/vykazy/${recC.id}/modal`);
  ok('edit modál předvyplněn', r.text.includes('Upravit výkaz') && r.text.includes('TestE2E jednorázovka'));
  await req(`/vykazy/${recC.id}`, { method: 'POST', form: { service_id: svcB.id, description: 'TestE2E jednorázovka v2', note: '', hours: '2', mins: '0', performed_at: day(15), billing: 'billed', back: '/' } });
  const recC2 = db.prepare('SELECT minutes, description FROM work_records WHERE id = ?').get(recC.id);
  ok('admin upravil schválený výkaz', recC2.minutes === 120 && recC2.description === 'TestE2E jednorázovka v2');

  // --- Historie s ID ---
  const evt = db.prepare("SELECT COUNT(*) c FROM events WHERE entity_id = ? AND action LIKE 'Vykázána práce%'").get(client.id).c;
  ok('Historie: vykázání s dohledatelným #ID', evt >= 3);
} catch (err) {
  fail++;
  console.error('CHYBA TESTU:', err);
} finally {
  for (const id of cleanup.clients) {
    db.prepare('DELETE FROM work_records WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM services WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM person_clients WHERE client_id = ?').run(id);
    db.prepare("DELETE FROM person_contacts WHERE owner_kind = 'client' AND owner_id = ?").run(id);
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  }
  for (const id of cleanup.persons) {
    db.prepare('DELETE FROM sessions WHERE person_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM persons WHERE id = ?').run(id);
  }
  for (const id of cleanup.catalogItems) {
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM list_items WHERE id = ?').run(id);
  }
  for (const s of cleanup.sessions) db.prepare('DELETE FROM sessions WHERE id = ?').run(s);
  if (!cleanup.vykazyWasOn) db.prepare("DELETE FROM tenant_modules WHERE tenant_id = ? AND module = 'vykazy'").run(tenant.id);
  const leftovers =
    db.prepare("SELECT COUNT(*) c FROM clients WHERE name LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM persons WHERE name LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM list_items WHERE label LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM work_records WHERE description LIKE 'TestE2E%'").get().c;
  console.log(`Úklid hotov, zbytky TestE2E: ${leftovers}`);
  console.log(`\n${pass} OK, ${fail} FAIL`);
  db.close();
  process.exit(fail ? 1 : 0);
}
