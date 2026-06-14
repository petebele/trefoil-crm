import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { db } from '../db';
import { Layout } from './layout';
import { MODULES, isModuleKey } from '../modules';
import { ModalShell, EmptyState, initials, avColor, KebabMenu, ContactRowsField } from './components';
import { readForm } from '../lib/util';
import { logEvent } from '../domain/events';
import { listContacts, clearOwnerContacts, addContact, isContactType } from '../domain/contacts';
import { itemsByKey } from '../domain/lists';
import type { PersonContactsTable } from '../db/schema';
import {
  listTeam,
  getTeamMember,
  loginEmailTaken,
  activeAdminCount,
  createTeamMember,
  updateTeamMember,
  setTeamMemberActive,
} from '../domain/team';
import {
  listCatalog,
  getCatalogService,
  createCatalogService,
  updateCatalogService,
  setCatalogServiceActive,
  isServiceMode,
  normalizeMeta,
  SERVICE_MODE_LABELS,
  type ServiceMeta,
} from '../domain/services';
import type { PersonsTable } from '../db/schema';
import type { CatalogService } from '../domain/services';
import { tr, fmtNum } from '../i18n';

export const adminRoutes = new Hono<AppEnv>();

/** Administrace jen pro adminy Organizace. */
const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const person = c.get('person');
  if (!person || person.is_admin !== 1) return c.redirect('/');
  await next();
};
adminRoutes.use('/administrace', requireAdmin);
adminRoutes.use('/administrace/*', requireAdmin);

const TABS = [
  { key: 'moduly', label: 'Moduly' },
  { key: 'tym', label: 'Tým' },
  { key: 'sluzby', label: 'Služby' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const ERRORS: Record<string, string> = {
  lastadmin: 'Poslední administrátor nemůže přijít o roli ani být deaktivován — nejdřív jmenujte dalšího admina.',
  email: 'Tento přihlašovací e-mail už používá jiný uživatel.',
  povinne: 'Vyplňte prosím všechna povinná pole.',
  nazev: 'Služba s tímto názvem už v katalogu je.',
};

function fmtPrice(n: number | null): string {
  return n === null ? '—' : `${fmtNum(n)} ${tr('Kč/h')}`;
}

// ---------- záložka Moduly ----------

function ModulyTab(props: { enabled: Set<string> }) {
  return (
    <div class="card" style="max-width:560px">
      <div class="card-head">
        <h3>{tr('Moduly')}</h3>
      </div>
      <p class="sub" style="margin-top:-.4rem">
        {tr('Zapnuté moduly vidí všichni v organizaci. Vypnutím se nic nemaže — modul jen zmizí z aplikace a po zapnutí je vše zpátky.')}
      </p>
      <form method="post" action="/administrace/moduly">
        {MODULES.map((m) => (
          <label style="display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;cursor:pointer">
            <input
              type="checkbox"
              name="modules"
              value={m.key}
              checked={props.enabled.has(m.key)}
              style="width:17px;height:17px;margin-top:.15rem;accent-color:var(--accent)"
            />
            <span>
              <span style="font-weight:600">{tr(m.label)}</span>
              {m.built ? null : <span class="chip chip-soft-gray" style="margin-left:.45rem">{tr('připravujeme')}</span>}
              <span class="sub" style="display:block">{tr(m.desc)}</span>
            </span>
          </label>
        ))}
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">
            {tr('Uložit')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- záložka Tým ----------

function TymTab(props: { team: PersonsTable[]; meId: string }) {
  return (
    <div class="card card-table" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>{tr('Jméno')}</th>
            <th>{tr('Přihlašovací e-mail')}</th>
            <th>{tr('Role')}</th>
            <th>{tr('Stav')}</th>
            <th style="width:1%"></th>
          </tr>
        </thead>
        <tbody>
          {props.team.map((u) => (
            <tr class="hover-row" style={u.is_active === 1 ? '' : 'opacity:.55'}>
              <td>
                <span style="display:flex;align-items:center;gap:.6rem">
                  <span class={`av ${avColor(u.name)}`}>{initials(u.name)}</span>
                  <span>
                    <span style="font-weight:600">
                      {u.name}
                      {u.id === props.meId ? <span class="sub" style="font-weight:400"> {tr('(vy)')}</span> : null}
                    </span>
                    {u.position ? <span class="sub" style="display:block">{u.position}</span> : null}
                  </span>
                </span>
              </td>
              <td>{u.login_email}</td>
              <td>
                <span class={`chip ${u.is_admin === 1 ? 'chip-soft-dark' : 'chip-soft-gray'}`}>
                  {u.is_admin === 1 ? tr('Admin') : tr('Uživatel')}
                </span>
              </td>
              <td>
                <span class={`chip ${u.is_active === 1 ? 'chip-soft-teal' : 'chip-soft-gray'}`}>
                  {u.is_active === 1 ? tr('Aktivní') : tr('Deaktivován')}
                </span>
              </td>
              <td style="text-align:right">
                <span class="row-actions">
                  <KebabMenu id={`tmRow-${u.id}`} label={tr('Možnosti pro {name}', { name: u.name })}>
                    <button class="opt" type="button" hx-get={`/administrace/tym/${u.id}/modal`} hx-target="#modal" hx-swap="innerHTML">
                      {tr('Upravit')}
                    </button>
                    <form method="post" action={`/administrace/tym/${u.id}/aktivni`} class="m0">
                      <input type="hidden" name="active" value={u.is_active === 1 ? '0' : '1'} />
                      <button class="opt" type="submit">{u.is_active === 1 ? tr('Deaktivovat') : tr('Aktivovat')}</button>
                    </form>
                  </KebabMenu>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamModal(props: { member: PersonsTable | null; contacts: PersonContactsTable[]; labels: Array<{ label: string }> }) {
  const m = props.member;
  return (
    <ModalShell title={m ? `${tr('Upravit uživatele')} · ${m.name}` : tr('Nový uživatel')}>
      <form method="post" action={m ? `/administrace/tym/${m.id}` : '/administrace/tym'}>
        <div class="field">
          <label>{tr('Jméno a příjmení')} <span class="req">*</span></label>
          <input class="input" name="name" value={m?.name ?? ''} required autofocus />
        </div>
        <div class="field">
          <label>{tr('Přihlašovací e-mail')} <span class="req">*</span></label>
          <input class="input" type="email" name="email" value={m?.login_email ?? ''} required />
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field">
            <label>{tr('Role')}</label>
            <select class="input" name="role">
              <option value="user" selected={!m || m.is_admin !== 1}>{tr('Uživatel')}</option>
              <option value="admin" selected={m?.is_admin === 1}>{tr('Admin')}</option>
            </select>
          </div>
          <div class="field">
            <label>{tr('Pozice')}</label>
            <input class="input" name="position" value={m?.position ?? ''} placeholder={tr('např. SEO specialista')} />
          </div>
        </div>
        <div class="field">
          <label>{tr('Heslo')} {m ? null : <span class="req">*</span>}</label>
          <input
            class="input"
            type="password"
            name="password"
            autocomplete="new-password"
            required={!m}
            placeholder={m ? tr('Vyplňte jen pro změnu hesla') : ''}
          />
          {m ? null : <span class="help">{tr('Nastavte první heslo a předejte ho kolegovi — změní si ho po přihlášení. Pozvánky e-mailem připravujeme.')}</span>}
        </div>
        <ContactRowsField contacts={props.contacts} labels={props.labels} />
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{m ? tr('Uložit změny') : tr('Vytvořit uživatele')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- záložka Služby ----------

function SluzbyTab(props: { catalog: CatalogService[] }) {
  if (props.catalog.length === 0) {
    return (
      <EmptyState text={tr('Zatím žádné služby. Přidejte první službu, kterou klientům poskytujete.')}>
        <button class="btn btn-primary" type="button" hx-get="/administrace/sluzby/modal/nova" hx-target="#modal" hx-swap="innerHTML">
          {tr('Přidat službu')}
        </button>
      </EmptyState>
    );
  }
  return (
    <div class="card card-table" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>{tr('Služba')}</th>
            <th>{tr('Režim účtování')}</th>
            <th>{tr('Výchozí cena')}</th>
            <th>{tr('Stav')}</th>
            <th style="width:1%"></th>
          </tr>
        </thead>
        <tbody>
          {props.catalog.map((s) => (
            <tr class="hover-row" style={s.active === 1 ? '' : 'opacity:.55'}>
              <td>
                <span style="font-weight:600">{s.label}</span>
                {s.meta.description ? (
                  <span class="sub" style="display:block;max-width:26rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {s.meta.description}
                  </span>
                ) : null}
              </td>
              <td>
                <span class={`chip ${s.meta.mode === 'retainer' ? 'chip-soft-teal' : s.meta.mode === 'subscription' ? 'chip-soft-dark' : 'chip-soft-gray'}`}>
                  {tr(SERVICE_MODE_LABELS[s.meta.mode])}
                </span>
              </td>
              <td>{fmtPrice(s.meta.price)}</td>
              <td>
                <span class={`chip ${s.active === 1 ? 'chip-soft-teal' : 'chip-soft-gray'}`}>
                  {s.active === 1 ? tr('Aktivní') : tr('Deaktivována')}
                </span>
              </td>
              <td style="text-align:right">
                <span class="row-actions">
                  <KebabMenu id={`svcAdmin-${s.id}`} label={tr('Možnosti pro {name}', { name: s.label })}>
                    <button class="opt" type="button" hx-get={`/administrace/sluzby/${s.id}/modal`} hx-target="#modal" hx-swap="innerHTML">
                      {tr('Upravit')}
                    </button>
                    <form method="post" action={`/administrace/sluzby/${s.id}/aktivni`} class="m0">
                      <input type="hidden" name="active" value={s.active === 1 ? '0' : '1'} />
                      <button class="opt" type="submit">{s.active === 1 ? tr('Deaktivovat') : tr('Aktivovat')}</button>
                    </form>
                  </KebabMenu>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceModal(props: { service: CatalogService | null }) {
  const s = props.service;
  const mode = s?.meta.mode ?? 'retainer';
  return (
    <ModalShell title={s ? `${tr('Upravit službu')} · ${s.label}` : tr('Nová služba')}>
      <form method="post" action={s ? `/administrace/sluzby/${s.id}` : '/administrace/sluzby'}>
        <div class="field">
          <label>{tr('Název')} <span class="req">*</span></label>
          <input class="input" name="name" value={s?.label ?? ''} required autofocus />
        </div>
        <div class="field">
          <label>{tr('Popis')}</label>
          <textarea class="input" name="description" rows={2}>{s?.meta.description ?? ''}</textarea>
        </div>
        <div class="field">
          <label>{tr('Výchozí režim účtování')}</label>
          <select class="input" name="mode">
            <option value="retainer" selected={mode === 'retainer'}>{tr('Domluvený paušál hodin — čas práce se odečítá z domluveného paušálu')}</option>
            <option value="payg" selected={mode === 'payg'}>{tr('Samostatná fakturace — práci účtujeme samostatně')}</option>
            <option value="subscription" selected={mode === 'subscription'}>{tr('Předplatné v aplikaci — individuální částka předplatného')}</option>
          </select>
        </div>
        <div class="field">
          <label>{tr('Výchozí cena')} ({tr('Kč/h')})</label>
          <input class="input" type="number" name="price" min="0" step="1" value={s?.meta.price ?? ''} />
          <span class="help">{tr('Hodinová sazba práce na službě, volitelná.')}</span>
        </div>
        <p class="sub" style="font-size:.78rem">
          {tr('Tohle jsou výchozí hodnoty pro celou firmu — při přidělení služby konkrétnímu zákazníkovi půjde vše nastavit jinak. Paušál hodin a měsíční částky (předplatné) se nastavují u zákazníka.')}
        </p>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{s ? tr('Uložit změny') : tr('Vytvořit službu')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- stránka se záložkami ----------

adminRoutes.get('/administrace', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const enabled = c.get('modules');
  const rawTab = c.req.query('tab') ?? 'moduly';
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'moduly';
  const err = c.req.query('err') ?? '';

  const [team, catalog] = await Promise.all([
    tab === 'tym' ? listTeam(tenant.id) : Promise.resolve([]),
    tab === 'sluzby' ? listCatalog(tenant.id) : Promise.resolve([]),
  ]);

  return c.html(
    <Layout title={tr('Administrace')} person={person} modules={enabled} active="administrace">
      <div class="page-head">
        <h1>{tr('Administrace')}</h1>
        {tab === 'tym' ? (
          <button class="btn btn-primary" type="button" hx-get="/administrace/tym/modal/novy" hx-target="#modal" hx-swap="innerHTML">
            {tr('Přidat uživatele')}
          </button>
        ) : null}
        {tab === 'sluzby' ? (
          <button class="btn btn-primary" type="button" hx-get="/administrace/sluzby/modal/nova" hx-target="#modal" hx-swap="innerHTML">
            {tr('Přidat službu')}
          </button>
        ) : null}
      </div>
      <p class="sub" style="margin-top:.2rem">{tr('Organizace')}: <b>{tenant.name}</b></p>

      <nav class="tabs" aria-label={tr('Sekce administrace')}>
        {TABS.map((t) => (
          <a class={`tab ${tab === t.key ? 'active' : ''}`} href={`/administrace?tab=${t.key}`}>
            {tr(t.label)}
          </a>
        ))}
      </nav>

      <section
        id="stred"
        hx-get={`/administrace?tab=${tab}`}
        hx-select="#stred"
        hx-target="this"
        hx-swap="outerHTML"
        hx-trigger="live-update from:body"
        hx-disinherit="*"
        style="margin-top:1rem"
      >
        {err && ERRORS[err] ? <div class="form-error">{tr(ERRORS[err]!)}</div> : null}
        {tab === 'moduly' ? <ModulyTab enabled={enabled} /> : null}
        {tab === 'tym' ? <TymTab team={team} meId={person.id} /> : null}
        {tab === 'sluzby' ? <SluzbyTab catalog={catalog} /> : null}
      </section>
    </Layout>,
  );
});

adminRoutes.post('/administrace/moduly', async (c) => {
  const tenant = c.get('tenant')!;
  const body = await c.req.parseBody({ all: true });
  const raw = body.modules;
  const keys = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).filter(isModuleKey);

  await db.deleteFrom('tenant_modules').where('tenant_id', '=', tenant.id).execute();
  for (const key of keys) {
    await db.insertInto('tenant_modules').values({ tenant_id: tenant.id, module: key }).execute();
  }
  return c.redirect('/administrace');
});

// ---------- Tým: routy ----------

/** Nahradí všechny kontakty člena týmu podle polí c_type[]/c_value[]/c_label[].
 *  Vrací true, když se sada kontaktů reálně změnila (kvůli zápisu do Historie). */
async function syncTeamContacts(tenantId: string, personId: string, body: Record<string, unknown>): Promise<boolean> {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : v !== undefined ? [String(v)] : []);
  const types = arr(body.c_type);
  const values = arr(body.c_value);
  const labels = arr(body.c_label);
  const next: Array<{ type: PersonContactsTable['type']; value: string; label: string | null }> = [];
  for (let i = 0; i < values.length; i++) {
    const value = (values[i] ?? '').trim();
    const type = types[i] ?? 'other';
    if (!value || !isContactType(type)) continue;
    next.push({ type, value, label: (labels[i] ?? '').trim() || null });
  }
  const norm = (xs: Array<{ type: string; value: string; label: string | null }>) =>
    xs.map((x) => `${x.type}|${x.value}|${x.label ?? ''}`).sort().join('\n');
  const before = await listContacts(tenantId, 'person', personId);
  if (norm(before) === norm(next)) return false;
  await clearOwnerContacts(tenantId, 'person', personId);
  for (const cc of next) await addContact(tenantId, 'person', personId, { type: cc.type, value: cc.value, label: cc.label, clientId: null });
  return true;
}

adminRoutes.get('/administrace/tym/modal/novy', async (c) => {
  const tenant = c.get('tenant')!;
  const labels = await itemsByKey(tenant.id, 'contact_labels');
  return c.html(<TeamModal member={null} contacts={[]} labels={labels} />);
});

adminRoutes.get('/administrace/tym/:id/modal', async (c) => {
  const tenant = c.get('tenant')!;
  const member = await getTeamMember(tenant.id, c.req.param('id'));
  if (!member) return c.notFound();
  const [contacts, labels] = await Promise.all([listContacts(tenant.id, 'person', member.id), itemsByKey(tenant.id, 'contact_labels')]);
  return c.html(<TeamModal member={member} contacts={contacts} labels={labels} />);
});

adminRoutes.post('/administrace/tym', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const name = f.str('name');
  const email = f.email('email');
  const password = f.raw('password');
  const isAdmin = f.str('role') === 'admin';
  const position = f.strOrNull('position');

  if (!name || !email || !password) return c.redirect('/administrace?tab=tym&err=povinne');
  if (await loginEmailTaken(tenant.id, email)) return c.redirect('/administrace?tab=tym&err=email');

  const id = await createTeamMember(tenant.id, { name, email, isAdmin, password, position });
  await syncTeamContacts(tenant.id, id, body);
  await logEvent(tenant.id, 'person', id, person.id, `Uživatel ${name} přidán do týmu (${isAdmin ? 'Admin' : 'Uživatel'})`);
  return c.redirect('/administrace?tab=tym');
});

adminRoutes.post('/administrace/tym/:id', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const id = c.req.param('id');
  const member = await getTeamMember(tenant.id, id);
  if (!member) return c.notFound();

  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const name = f.str('name');
  const email = f.email('email');
  const password = f.strOrNull('password');
  const isAdmin = f.str('role') === 'admin';
  const position = f.strOrNull('position');

  if (!name || !email) return c.redirect('/administrace?tab=tym&err=povinne');
  if (await loginEmailTaken(tenant.id, email, id)) return c.redirect('/administrace?tab=tym&err=email');

  // pojistka: poslední aktivní admin nesmí přijít o roli
  if (member.is_admin === 1 && member.is_active === 1 && !isAdmin && (await activeAdminCount(tenant.id)) <= 1) {
    return c.redirect('/administrace?tab=tym&err=lastadmin');
  }

  const contactsChanged = await syncTeamContacts(tenant.id, id, body);
  const changes: string[] = [];
  if (member.name !== name) changes.push(`jméno → ${name}`);
  if (member.login_email !== email) changes.push(`e-mail → ${email}`);
  if ((member.is_admin === 1) !== isAdmin) changes.push(`role → ${isAdmin ? 'Admin' : 'Uživatel'}`);
  if ((member.position ?? null) !== position) changes.push(`pozice → ${position ?? '—'}`);
  if (password) changes.push('změna hesla');
  if (contactsChanged) changes.push('kontakty');

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  if (changes.length) {
    await updateTeamMember(tenant.id, id, { name, email, isAdmin, password, position });
    await logEvent(tenant.id, 'person', id, person.id, `Uživatel ${name} upraven: ${changes.join(', ')}`);
  }
  return c.redirect('/administrace?tab=tym');
});

adminRoutes.post('/administrace/tym/:id/aktivni', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const id = c.req.param('id');
  const member = await getTeamMember(tenant.id, id);
  if (!member) return c.notFound();

  const active = readForm(await c.req.parseBody()).flag('active');

  // pojistka: poslední aktivní admin nesmí být deaktivován
  if (!active && member.is_admin === 1 && member.is_active === 1 && (await activeAdminCount(tenant.id)) <= 1) {
    return c.redirect('/administrace?tab=tym&err=lastadmin');
  }

  await setTeamMemberActive(tenant.id, id, active);
  await logEvent(tenant.id, 'person', id, person.id, active ? `Uživatel ${member.name} aktivován` : `Uživatel ${member.name} deaktivován`);
  return c.redirect('/administrace?tab=tym');
});

// ---------- Služby: routy ----------

function metaFromBody(body: Record<string, unknown>): ServiceMeta {
  const rawMode = String(body.mode ?? 'retainer');
  const mode = isServiceMode(rawMode) ? rawMode : 'retainer';
  const num = (v: unknown): number | null => {
    const s = String(v ?? '').trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    description: String(body.description ?? '').trim() || null,
    mode,
    price: num(body.price),
  };
}

adminRoutes.get('/administrace/sluzby/modal/nova', (c) => c.html(<ServiceModal service={null} />));

adminRoutes.get('/administrace/sluzby/:id/modal', async (c) => {
  const tenant = c.get('tenant')!;
  const service = await getCatalogService(tenant.id, c.req.param('id'));
  if (!service) return c.notFound();
  return c.html(<ServiceModal service={service} />);
});

adminRoutes.post('/administrace/sluzby', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const body = await c.req.parseBody();
  const name = readForm(body).str('name');
  if (!name) return c.redirect('/administrace?tab=sluzby&err=povinne');

  const meta = metaFromBody(body as Record<string, unknown>);
  const id = await createCatalogService(tenant.id, name, meta);
  if (!id) return c.redirect('/administrace?tab=sluzby&err=nazev');

  await logEvent(tenant.id, 'sluzba', id, person.id, `Služba „${name}" přidána do katalogu (${SERVICE_MODE_LABELS[meta.mode]})`);
  return c.redirect('/administrace?tab=sluzby');
});

adminRoutes.post('/administrace/sluzby/:id', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const id = c.req.param('id');
  const service = await getCatalogService(tenant.id, id);
  if (!service) return c.notFound();

  const body = await c.req.parseBody();
  const name = readForm(body).str('name');
  if (!name) return c.redirect('/administrace?tab=sluzby&err=povinne');

  const meta = normalizeMeta(metaFromBody(body as Record<string, unknown>));
  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  if (service.label === name && JSON.stringify(service.meta) === JSON.stringify(meta)) {
    return c.redirect('/administrace?tab=sluzby');
  }
  const ok = await updateCatalogService(tenant.id, id, name, meta);
  if (!ok) return c.redirect('/administrace?tab=sluzby&err=nazev');

  await logEvent(tenant.id, 'sluzba', id, person.id, `Služba „${name}" upravena (${SERVICE_MODE_LABELS[meta.mode]})`);
  return c.redirect('/administrace?tab=sluzby');
});

adminRoutes.post('/administrace/sluzby/:id/aktivni', async (c) => {
  const person = c.get('person')!;
  const tenant = c.get('tenant')!;
  const id = c.req.param('id');
  const service = await getCatalogService(tenant.id, id);
  if (!service) return c.notFound();

  const active = readForm(await c.req.parseBody()).flag('active');
  await setCatalogServiceActive(tenant.id, id, active);
  await logEvent(
    tenant.id,
    'sluzba',
    id,
    person.id,
    active ? `Služba „${service.label}" aktivována` : `Služba „${service.label}" deaktivována (u běžících zákazníků zůstává)`,
  );
  return c.redirect('/administrace?tab=sluzby');
});
