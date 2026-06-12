// Dočasný E2E test Kroku 5 (Služby u zákazníka). Vytváří jen vlastní TestE2E
// záznamy a na konci je beze stopy maže. Spouští se proti běžícímu serveru.
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

async function req(path, { method = 'GET', form, cookie = sid } = {}) {
  const headers = { cookie: `sid=${cookie}` };
  let body;
  if (form) {
    body = new URLSearchParams(form).toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual' });
  const text = res.status === 200 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location') ?? '', text };
}

const cleanup = { clients: [], persons: [], catalogItems: [], sessions: [sid] };
try {
  // --- příprava: dočasná firma + dočasná služba v katalogu ---
  await req('/firmy', { method: 'POST', form: { name: 'TestE2E Firma K5', status: 'active' } });
  const client = db.prepare("SELECT * FROM clients WHERE name = 'TestE2E Firma K5'").get();
  if (client) cleanup.clients.push(client.id);
  ok('temp firma založena', !!client);
  const fbase = `/firmy/${client.id}`;

  await req('/administrace/sluzby', { method: 'POST', form: { name: 'TestE2E Služba K5', description: '', mode: 'retainer', price: '1500' } });
  const cat = db.prepare("SELECT li.* FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.key = 'service_catalog' AND li.label = 'TestE2E Služba K5'").get();
  if (cat) cleanup.catalogItems.push(cat.id);
  ok('temp služba v katalogu', !!cat);

  // --- prázdná záložka ---
  let r = await req(`${fbase}?tab=sluzby`);
  ok('záložka Služby: paušál + přidělení + prázdný stav', r.text.includes('Paušál hodin') && r.text.includes('Přidělit službu') && r.text.includes('Zatím žádné služby'));

  // --- paušál hodin ---
  r = await req(`${fbase}/pausal`, { method: 'POST', form: { hours: '10', price: '15000', rollover: '1' } });
  const c1 = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
  ok('paušál uložen (hodiny, cena, rollover)', r.status === 302 && c1.hours_budget_monthly === 10 && c1.retainer_price === 15000 && c1.hours_rollover === 1);
  r = await req(`${fbase}?tab=sluzby`);
  ok('paušál zobrazen s převáděním', r.text.includes(`${kc(10)} h`) && r.text.includes(`${kc(15000)} Kč/měs`) && r.text.includes('převádějí'));

  // --- přidělení služby (výchozí režim+sazba z katalogu) ---
  r = await req(`${fbase}/sluzby`, { method: 'POST', form: { catalog_item_id: cat.id, mode: '', rate: '', monthly_amount: '', owner_id: admin.id } });
  const svc = db.prepare('SELECT * FROM services WHERE client_id = ?').get(client.id);
  ok('služba přidělena s defaulty z katalogu', !!svc && svc.mode === 'retainer' && svc.rate === 1500 && svc.owner_id === admin.id && svc.status === 'active');
  r = await req(`${fbase}?tab=sluzby`);
  ok('řádek služby (chip, sazba, osoba)', r.text.includes('TestE2E Služba K5') && r.text.includes('Paušál hodin') && r.text.includes(`sazba ${kc(1500)} Kč/h`) && r.text.includes(`odpovídá ${admin.name}`));

  // --- opakované přidělení téže služby s upřesněním + popisem ---
  r = await req(`${fbase}/sluzby`, { method: 'POST', form: { catalog_item_id: cat.id, detail: 'Sklik', description: 'Správa Sklik kampaní', mode: 'payg', rate: '1200', monthly_amount: '', owner_id: '' } });
  const svcs = db.prepare('SELECT * FROM services WHERE client_id = ?').all(client.id);
  const svcB = svcs.find((x) => x.detail === 'Sklik');
  ok('tatáž služba podruhé (s upřesněním)', r.status === 302 && !r.location.includes('err') && svcs.length === 2);
  ok('upřesnění + popis + režim uloženy', !!svcB && svcB.description === 'Správa Sklik kampaní' && svcB.mode === 'payg' && svcB.rate === 1200);
  r = await req(`${fbase}?tab=sluzby`);
  ok('řádek s upřesněním a popisem', r.text.includes('· Sklik') && r.text.includes('Správa Sklik kampaní'));
  ok('formulář: závislá pole + výchozí z katalogu', r.text.includes('data-depends-on="mode"') && r.text.includes('data-defaults') && r.text.includes('data-set-mode'));

  // --- úprava na předplatné s částkou → součet ---
  await req(`${fbase}/sluzby/${svc.id}`, { method: 'POST', form: { detail: '', description: '', mode: 'subscription', rate: '1500', monthly_amount: '2000', owner_id: admin.id } });
  const svc2 = db.prepare('SELECT * FROM services WHERE id = ?').get(svc.id);
  ok('úprava: předplatné s částkou', svc2.mode === 'subscription' && svc2.monthly_amount === 2000);
  r = await req(`${fbase}?tab=sluzby`);
  ok('Měsíčně celkem = paušál + předplatné', r.text.includes('Měsíčně celkem') && r.text.includes(`${kc(17000)} Kč/měs`));

  // --- pozastavení (předplatné se nepočítá) / obnovení / ukončení ---
  await req(`${fbase}/sluzby/${svc.id}/stav`, { method: 'POST', form: { status: 'paused' } });
  r = await req(`${fbase}?tab=sluzby`);
  ok('pozastavená: chip + bez částky v součtu', r.text.includes('Pozastavená') && r.text.includes(`${kc(15000)} Kč/měs`) && !r.text.includes(`${kc(17000)} Kč/měs`));
  await req(`${fbase}/sluzby/${svc.id}/stav`, { method: 'POST', form: { status: 'active' } });
  await req(`${fbase}/sluzby/${svc.id}/stav`, { method: 'POST', form: { status: 'ended' } });
  const svc3 = db.prepare('SELECT status FROM services WHERE id = ?').get(svc.id);
  r = await req(`${fbase}?tab=sluzby`);
  ok('ukončení: stav v DB + chip', svc3.status === 'ended' && r.text.includes('Ukončená'));

  // --- osoba: read-only pohled na služby firem (svcB stále běží) ---
  await req(`${fbase}/osoba`, { method: 'POST', form: { existing: '', new_name: 'TestE2E Osoba K5' } });
  const osoba = db.prepare("SELECT id FROM persons WHERE name = 'TestE2E Osoba K5'").get();
  if (osoba) cleanup.persons.push(osoba.id);
  r = await req(`/osoby/${osoba.id}?tab=sluzby`);
  ok('osoba: služby firem read-only s odkazem', r.text.includes('TestE2E Služba K5') && r.text.includes(`/firmy/${client.id}?tab=sluzby`) && !r.text.includes('Přidělit službu'));

  // --- běžný uživatel: vidí, ale nemění ---
  await req('/administrace/tym', { method: 'POST', form: { name: 'TestE2E User K5', email: 'teste2e-k5@conviu.test', role: 'user', password: 'tajneheslo1' } });
  const user = db.prepare("SELECT id FROM persons WHERE login_email = 'teste2e-k5@conviu.test'").get();
  if (user) cleanup.persons.push(user.id);
  const usid = 'e2etest-' + randomUUID().replace(/-/g, '');
  db.prepare('INSERT INTO sessions (id, person_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    usid, user.id, new Date(Date.now() + 600_000).toISOString(), new Date().toISOString(),
  );
  cleanup.sessions.push(usid);
  r = await req(`${fbase}?tab=sluzby`, { cookie: usid });
  ok('uživatel: vidí služby, bez akcí', r.text.includes('TestE2E Služba K5') && !r.text.includes('Přidělit službu') && !r.text.includes('Nastavit paušál'));
  r = await req(`${fbase}/pausal`, { method: 'POST', form: { hours: '99', price: '1', rollover: '' }, cookie: usid });
  const cGuard = db.prepare('SELECT hours_budget_monthly FROM clients WHERE id = ?').get(client.id);
  ok('uživatel: mutace odmítnuta (redirect, beze změny)', r.status === 302 && cGuard.hours_budget_monthly === 10);

  // --- zrušení paušálu ---
  r = await req(`${fbase}/pausal`, { method: 'POST', form: { hours: '', price: '', rollover: '' } });
  const c2 = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
  ok('paušál zrušen (vše null)', c2.hours_budget_monthly === null && c2.retainer_price === null && c2.hours_rollover === 0);

  // --- Historie ---
  const evt = db.prepare('SELECT COUNT(*) c FROM events WHERE entity_id = ?').get(client.id).c;
  ok('Historie: události zapsány (≥8)', evt >= 8);
} catch (err) {
  fail++;
  console.error('CHYBA TESTU:', err);
} finally {
  for (const id of cleanup.persons) {
    db.prepare('DELETE FROM sessions WHERE person_id = ?').run(id);
    db.prepare('DELETE FROM person_clients WHERE person_id = ?').run(id);
    db.prepare("DELETE FROM person_contacts WHERE owner_kind = 'person' AND owner_id = ?").run(id);
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM persons WHERE id = ?').run(id);
  }
  for (const id of cleanup.clients) {
    db.prepare('DELETE FROM services WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM person_clients WHERE client_id = ?').run(id);
    db.prepare("DELETE FROM person_contacts WHERE owner_kind = 'client' AND owner_id = ?").run(id);
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  }
  for (const id of cleanup.catalogItems) {
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM list_items WHERE id = ?').run(id);
  }
  for (const s of cleanup.sessions) db.prepare('DELETE FROM sessions WHERE id = ?').run(s);
  const leftovers =
    db.prepare("SELECT COUNT(*) c FROM clients WHERE name LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM persons WHERE name LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM list_items WHERE label LIKE 'TestE2E%'").get().c;
  console.log(`Úklid hotov, zbytky TestE2E: ${leftovers}`);
  console.log(`\n${pass} OK, ${fail} FAIL`);
  db.close();
  process.exit(fail ? 1 : 0);
}
