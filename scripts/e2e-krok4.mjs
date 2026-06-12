// Dočasný E2E test Kroku 4 (Administrace: Tým + Služby). Vytváří jen vlastní
// TestE2E záznamy a na konci je beze stopy maže. Spouští se proti běžícímu serveru.
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const db = new Database('data/crm.db');
const BASE = 'http://localhost:3000';
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  OK  ${name}`); } else { fail++; console.log(`  FAIL ${name}`); }
};

const tenant = db.prepare('SELECT id FROM tenants LIMIT 1').get();
const admin = db.prepare(
  "SELECT id, name, is_admin FROM persons WHERE login_email IS NOT NULL AND is_admin = 1 AND is_active = 1 AND tenant_id = ? ORDER BY created_at LIMIT 1",
).get(tenant.id);
console.log(`Tenant ${tenant.id.slice(0, 8)}, admin ${admin.name}`);

// dočasná session admina (na konci smažeme)
const sid = 'e2etest-' + randomUUID().replace(/-/g, '');
db.prepare('INSERT INTO sessions (id, person_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
  sid, admin.id, new Date(Date.now() + 3600_000).toISOString(), new Date().toISOString(),
);

const jar = { sid };
async function req(path, { method = 'GET', form, cookie = jar.sid } = {}) {
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

const createdPersons = [];
const createdServices = [];
try {
  // --- záložky ---
  let r = await req('/administrace');
  ok('administrace 200', r.status === 200);
  ok('záložky Moduly/Tým/Služby', r.text.includes('?tab=moduly') && r.text.includes('?tab=tym') && r.text.includes('?tab=sluzby'));
  ok('Moduly obsah na výchozí záložce', r.text.includes('Zapnuté moduly vidí všichni'));

  r = await req('/administrace?tab=tym');
  ok('Tým: tabulka s adminem', r.text.includes(admin.name) && r.text.includes('chip-soft-dark'));
  ok('Tým: live zóna', r.text.includes('live-update from:body'));
  ok('Tým: tlačítko Přidat uživatele', r.text.includes('/administrace/tym/modal/novy'));

  // --- modály ---
  r = await req('/administrace/tym/modal/novy');
  ok('modál Nový uživatel', r.text.includes('Nový uživatel') && r.text.includes('name="password"') && r.text.includes('name="role"'));
  r = await req('/administrace/sluzby/modal/nova');
  ok('modál Nová služba', r.text.includes('Nová služba') && r.text.includes('name="mode"') && r.text.includes('Domluvený paušál hodin'));

  // --- Tým: create / login / práva / edit / deaktivace ---
  r = await req('/administrace/tym', { method: 'POST', form: { name: 'TestE2E Žofie', email: 'teste2e@conviu.test', role: 'user', password: 'tajneheslo1' } });
  ok('POST nový uživatel → redirect tym', r.status === 302 && r.location.includes('tab=tym') && !r.location.includes('err'));
  const u = db.prepare("SELECT * FROM persons WHERE login_email = 'teste2e@conviu.test'").get();
  if (u) createdPersons.push(u.id);
  ok('uživatel v DB s hashem', !!u && !!u.password_hash && u.is_admin === 0);
  r = await req('/administrace?tab=tym');
  ok('uživatel v tabulce (UTF-8 jméno)', r.text.includes('TestE2E Žofie') && r.text.includes('teste2e@conviu.test'));

  // duplicitní e-mail
  r = await req('/administrace/tym', { method: 'POST', form: { name: 'Dup', email: 'teste2e@conviu.test', role: 'user', password: 'x12345678' } });
  ok('duplicitní e-mail → err=email', r.location.includes('err=email'));

  // login nového uživatele + že nevidí administraci
  let res = await fetch(BASE + '/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'teste2e@conviu.test', password: 'tajneheslo1' }).toString(), redirect: 'manual' });
  const setc = res.headers.get('set-cookie') ?? '';
  const usid = /sid=([^;]+)/.exec(setc)?.[1];
  ok('login nového uživatele', res.status === 302 && !!usid);
  r = await req('/administrace', { cookie: usid });
  ok('běžný uživatel: /administrace → redirect', r.status === 302);

  // edit: jméno + role → admin
  r = await req(`/administrace/tym/${u.id}`, { method: 'POST', form: { name: 'TestE2E Žofie Nová', email: 'teste2e@conviu.test', role: 'admin', password: '' } });
  const u2 = db.prepare('SELECT * FROM persons WHERE id = ?').get(u.id);
  ok('edit uživatele (jméno+role, heslo beze změny)', u2.name === 'TestE2E Žofie Nová' && u2.is_admin === 1 && u2.password_hash === u.password_hash);

  // pojistka posledního admina: degradace TestE2E zpět + pokus o degradaci hlavního admina
  await req(`/administrace/tym/${u.id}`, { method: 'POST', form: { name: u2.name, email: 'teste2e@conviu.test', role: 'user', password: '' } });
  r = await req(`/administrace/tym/${admin.id}`, { method: 'POST', form: { name: admin.name, email: db.prepare('SELECT login_email e FROM persons WHERE id=?').get(admin.id).e, role: 'user', password: '' } });
  const adminAfter = db.prepare('SELECT is_admin FROM persons WHERE id = ?').get(admin.id);
  ok('poslední admin nejde degradovat (err=lastadmin, role zachována)', r.location.includes('err=lastadmin') && adminAfter.is_admin === 1);
  r = await req(`/administrace/tym/${admin.id}/aktivni`, { method: 'POST', form: { active: '0' } });
  const adminAct = db.prepare('SELECT is_active FROM persons WHERE id = ?').get(admin.id);
  ok('poslední admin nejde deaktivovat', r.location.includes('err=lastadmin') && adminAct.is_active === 1);
  r = await req('/administrace?tab=tym&err=lastadmin');
  ok('hláška o posledním adminovi se zobrazí', r.text.includes('Poslední administrátor'));

  // deaktivace TestE2E → session zrušena, login odmítnut
  r = await req(`/administrace/tym/${u.id}/aktivni`, { method: 'POST', form: { active: '0' } });
  const u3 = db.prepare('SELECT is_active FROM persons WHERE id = ?').get(u.id);
  ok('deaktivace uživatele', r.status === 302 && u3.is_active === 0);
  r = await req('/', { cookie: usid });
  ok('deaktivovaný: stará session neplatí', r.status === 302 && r.location.includes('/login'));
  res = await fetch(BASE + '/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'teste2e@conviu.test', password: 'tajneheslo1' }).toString(), redirect: 'manual' });
  ok('deaktivovaný: login odmítnut', res.status === 401);
  await req(`/administrace/tym/${u.id}/aktivni`, { method: 'POST', form: { active: '1' } });
  ok('aktivace zpět', db.prepare('SELECT is_active FROM persons WHERE id = ?').get(u.id).is_active === 1);

  // --- Služby ---
  r = await req('/administrace?tab=sluzby');
  ok('Služby: prázdný stav nebo tabulka', r.text.includes('Přidat službu'));

  r = await req('/administrace/sluzby', { method: 'POST', form: { name: 'TestE2E Správa PPC', description: 'Kampaně vč. úprav', mode: 'retainer', price: '12000' } });
  ok('POST nová služba → redirect', r.status === 302 && !r.location.includes('err'));
  const s = db.prepare("SELECT li.* FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.key = 'service_catalog' AND li.label = 'TestE2E Správa PPC'").get();
  if (s) createdServices.push(s.id);
  const meta = s ? JSON.parse(s.meta) : {};
  ok('služba v DB s JSON meta', !!s && meta.mode === 'retainer' && meta.price === 12000 && meta.description === 'Kampaně vč. úprav');
  r = await req('/administrace?tab=sluzby');
  ok('služba v tabulce (chip, sazba Kč/h)', r.text.includes('TestE2E Správa PPC') && r.text.includes('Paušál hodin') && r.text.includes('Kč/h'));

  // duplicitní název
  r = await req('/administrace/sluzby', { method: 'POST', form: { name: 'TestE2E Správa PPC', mode: 'payg' } });
  ok('duplicitní název → err=nazev', r.location.includes('err=nazev'));

  // edit: na předplatné bez ceny → cena volitelná (null)
  r = await req(`/administrace/sluzby/${s.id}`, { method: 'POST', form: { name: 'TestE2E Správa PPC', description: '', mode: 'subscription', price: '' } });
  const meta2 = JSON.parse(db.prepare('SELECT meta FROM list_items WHERE id = ?').get(s.id).meta);
  ok('edit na předplatné (cena volitelná)', meta2.mode === 'subscription' && meta2.price === null);

  // edit modál předvyplněný
  r = await req(`/administrace/sluzby/${s.id}/modal`);
  ok('edit modál služby předvyplněn', r.text.includes('Upravit službu') && r.text.includes('TestE2E Správa PPC'));

  // deaktivace / aktivace
  await req(`/administrace/sluzby/${s.id}/aktivni`, { method: 'POST', form: { active: '0' } });
  ok('deaktivace služby', db.prepare('SELECT active FROM list_items WHERE id = ?').get(s.id).active === 0);
  r = await req('/administrace?tab=sluzby');
  ok('deaktivovaná v tabulce šedě', r.text.includes('Deaktivována'));

  // Historie: events zapsané
  const evtTeam = db.prepare("SELECT COUNT(*) c FROM events WHERE entity_id = ?").get(u.id).c;
  const evtSvc = db.prepare("SELECT COUNT(*) c FROM events WHERE entity_id = ?").get(s.id).c;
  ok('Historie: události týmu i služby zapsány', evtTeam >= 4 && evtSvc >= 3);
} finally {
  // --- úklid: smazat vše TestE2E + události + sessions ---
  for (const id of createdPersons) {
    db.prepare('DELETE FROM sessions WHERE person_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM persons WHERE id = ?').run(id);
  }
  for (const id of createdServices) {
    db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM list_items WHERE id = ?').run(id);
  }
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
  const leftovers = db.prepare("SELECT COUNT(*) c FROM persons WHERE name LIKE 'TestE2E%'").get().c +
    db.prepare("SELECT COUNT(*) c FROM list_items WHERE label LIKE 'TestE2E%'").get().c;
  console.log(`Úklid hotov, zbytky TestE2E: ${leftovers}`);
  console.log(`\n${pass} OK, ${fail} FAIL`);
  db.close();
  process.exit(fail ? 1 : 0);
}
