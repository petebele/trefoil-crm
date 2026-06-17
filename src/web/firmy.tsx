import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import {
  getClient,
  createClient,
  updateClientField,
  updateClientMain,
  isEditableClientField,
  setClientOwner,
  softDeleteClient,
  peopleOfClient,
  linkPersonToClient,
  unlinkPersonFromClient,
  composeAddress,
} from '../domain/clients';
import { listCustomerPersons, createCustomerPerson, listCoworkers } from '../domain/people';
import { itemsByKey, listEntityTags, addEntityTag, removeEntityTag } from '../domain/lists';
import { listContacts, contactsForOwners, addContact, updateContact, removeContact, clearOwnerContacts, isContactType, CONTACT_TYPE_LABELS } from '../domain/contacts';
import { logEvent, listEvents } from '../domain/events';
import { readForm } from '../lib/util';
import {
  initials,
  avColor,
  EditField,
  EmptyState,
  PencilIcon,
  NoteSection,
  StatusBox,
  OwnerBox,
  TagsSection,
  ContactsSection,
  DetailTabs,
  EventRow,
  Picker,
  ModalShell,
  ModalContactRows,
  ContactsEditAll,
} from './components';
import { tr, relTime, fmtNum, currency } from '../i18n';
import { tasksForClient, TaskItemRow } from './ukoly';
import { NotesTab } from './poznamky';
import { notesForEntity } from '../domain/notes';
import { IconPhone, IconMail, IconUsers } from './icons';
import { SluzbyZakaznikaTab } from './sluzbyZakaznika';
import { listClientServices } from '../domain/clientServices';
import { listCatalog } from '../domain/services';
import { listForClientMonth, clientMonthMoney, monthKey, fmtMinutes, billingTotal } from '../domain/workRecords';

export const firmyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  await next();
};
firmyRoutes.use('/firmy', requireModule);
firmyRoutes.use('/firmy/*', requireModule);

/** Pole editovatelná malým panelem (název v hlavičce, poznámka v sekci). */
const FIELD_META: Record<string, { label: string }> = {
  name: { label: 'Název' },
  website: { label: 'Web' },
  ico: { label: 'IČO' },
  dic: { label: 'DIČ' },
  address: { label: 'Adresa' },
  note: { label: 'Poznámka' },
};

// ---------- nová firma (jednotně přes velký modál) ----------

// Stará stránka nahrazena jednotným velkým modálem.
firmyRoutes.get('/firmy/nova', (c) => c.redirect('/zakaznici'));

firmyRoutes.get('/firmy/modal/nova', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const [statusItems, coworkers, labels] = await Promise.all([
    itemsByKey(t, 'client_statuses'),
    listCoworkers(t),
    itemsByKey(t, 'contact_labels'),
  ]);

  return c.html(
    <ModalShell title={tr('Nová firma')}>
      <form method="post" action="/firmy">
        <div class="field">
          <label>{tr('Název firmy')} <span class="req">*</span></label>
          <input class="input" name="name" required autofocus />
        </div>
        <div class="field"><label>{tr('IČO')}</label><input class="input" name="ico" /></div>
        <div class="field"><label>{tr('DIČ')}</label><input class="input" name="dic" /></div>
        <div class="field"><label>{tr('Adresa')}</label><textarea class="input" name="address" rows={2}></textarea></div>
        <div class="field">
          <label>{tr('Stav')}</label>
          <select class="input" name="status">
            {statusItems.map((s) => (
              <option value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <label>{tr('Odpovědná osoba')}</label>
          <select class="input" name="owner_id">
            <option value="">{tr('— nikdo —')}</option>
            {coworkers.map((u) => (
              <option value={u.id} selected={u.id === person.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <ModalContactRows labels={labels} />
        <div class="field"><label>{tr('Štítky')} <span class="help" style="display:inline;margin-left:.4rem">{tr('oddělené čárkou')}</span></label><input class="input" name="tags" placeholder="VIP, E-shop…" /></div>
        <div class="field"><label>{tr('Poznámka')}</label><textarea class="input" name="note"></textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Vytvořit firmu')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>,
  );
});

// Úprava firmy — stejný velký modál jako založení, jen předvyplněný (kontakty
// a štítky se spravují přímo v levém panelu, proto tu nejsou).
firmyRoutes.get('/firmy/:id/modal/upravit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const client = await getClient(t, c.req.param('id'));
  if (!client) return c.notFound();
  const [statusItems, coworkers] = await Promise.all([itemsByKey(t, 'client_statuses'), listCoworkers(t)]);
  const countries = ['Česká republika', 'Slovensko', 'Polsko', 'Německo', 'Rakousko', 'Maďarsko', 'Ukrajina'];
  const curCountry = client.country ?? '';
  const countryOpts = curCountry && !countries.includes(curCountry) ? [curCountry, ...countries] : countries;

  return c.html(
    <ModalShell title={`${tr('Upravit firmu')} · ${client.name}`}>
      <form method="post" action={`/firmy/${client.id}/upravit`}>
        <div class="field">
          <label>{tr('Název firmy')} <span class="req">*</span></label>
          <input class="input" name="name" value={client.name} required autofocus />
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>{tr('IČO')}</label><input class="input" name="ico" value={client.ico ?? ''} /></div>
          <div class="field"><label>{tr('DIČ')}</label><input class="input" name="dic" value={client.dic ?? ''} /></div>
        </div>
        <div class="opt-group">{tr('Adresa')}</div>
        <div class="field-row2" style="grid-template-columns:3fr 1fr">
          <div class="field"><label>{tr('Ulice')}</label><input class="input" name="street" value={client.street ?? ''} /></div>
          <div class="field"><label>{tr('Č.p./č.o.')}</label><input class="input" name="house_no" value={client.house_no ?? ''} /></div>
        </div>
        <div class="field"><label>{tr('Adresa, 2. řádek')}</label><input class="input" name="address2" value={client.address2 ?? ''} /></div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>{tr('Město')}</label><input class="input" name="city" value={client.city ?? ''} /></div>
          <div class="field"><label>{tr('PSČ')}</label><input class="input" name="postal_code" value={client.postal_code ?? ''} /></div>
        </div>
        <div class="field">
          <label>{tr('Stát')}</label>
          <select class="input" name="country">
            <option value="">{tr('— stát —')}</option>
            {countryOpts.map((co) => (
              <option value={co} selected={co === curCountry}>{co}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <label>{tr('Stav')}</label>
          <select class="input" name="status">
            {statusItems.map((s) => (
              <option value={s.value} selected={s.value === client.status}>{s.label}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <label>{tr('Odpovědná osoba')}</label>
          <select class="input" name="owner_id">
            <option value="">{tr('— nikdo —')}</option>
            {coworkers.map((u) => (
              <option value={u.id} selected={u.id === client.owner_id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div class="field"><label>{tr('Poznámka')}</label><textarea class="input" name="note">{client.note ?? ''}</textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Uložit změny')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>,
  );
});

firmyRoutes.post('/firmy/:id/upravit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const client = await getClient(t, c.req.param('id'));
  if (!client) return c.notFound();

  const f = readForm(await c.req.parseBody());
  const name = f.str('name');
  if (!name) return c.redirect(`/firmy/${client.id}`);

  const addr = {
    street: f.strOrNull('street'),
    house_no: f.strOrNull('house_no'),
    address2: f.strOrNull('address2'),
    city: f.strOrNull('city'),
    postal_code: f.strOrNull('postal_code'),
    country: f.strOrNull('country'),
  };
  const data = {
    name,
    ico: f.strOrNull('ico'),
    dic: f.strOrNull('dic'),
    address: addr,
    status: f.str('status') || client.status,
    ownerId: f.raw('owner_id') || null,
    note: f.strOrNull('note'),
  };
  const newAddr = composeAddress(addr).join('\n') || null;
  const changes: string[] = [];
  if (client.name !== data.name) changes.push('název firmy');
  if ((client.ico ?? null) !== data.ico) changes.push('IČO');
  if ((client.dic ?? null) !== data.dic) changes.push('DIČ');
  if ((client.address ?? null) !== newAddr) changes.push('adresa');
  if (client.status !== data.status) changes.push('stav');
  if ((client.owner_id ?? null) !== data.ownerId) changes.push('odpovědná osoba');
  if ((client.note ?? null) !== data.note) changes.push('poznámka');

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  if (changes.length) {
    await updateClientMain(t, client.id, data);
    await logEvent(t, 'client', client.id, person.id, `Firma upravena (${changes.join(', ')})`);
  }
  return c.redirect(`/firmy/${client.id}`);
});

async function saveContactsFromForm(
  tenantId: string,
  ownerKind: 'person' | 'client',
  ownerId: string,
  body: Record<string, unknown>,
  actorId: string,
  entityKind: string,
  clientContext?: string | null,
): Promise<void> {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : v !== undefined ? [String(v)] : []);
  const types = arr(body.c_type);
  const values = arr(body.c_value);
  const labels = arr(body.c_label);
  for (let i = 0; i < values.length; i++) {
    const value = (values[i] ?? '').trim();
    const type = types[i] ?? 'other';
    if (!value || !isContactType(type)) continue;
    const added = await addContact(tenantId, ownerKind, ownerId, {
      type,
      value,
      label: labels[i] ?? null,
      clientId: clientContext ?? null,
    });
    if (added) {
      await logEvent(tenantId, entityKind, ownerId, actorId, `Přidán kontakt: ${CONTACT_TYPE_LABELS[added.type]} ${added.value}${added.label ? ` (${added.label})` : ''}`);
    }
  }
}

async function saveTagsFromForm(
  tenantId: string,
  entityKind: 'client' | 'person',
  entityId: string,
  raw: unknown,
  actorId: string,
): Promise<void> {
  const tags = String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const tag of tags) {
    const label = await addEntityTag(tenantId, entityKind, entityId, tag);
    if (label) await logEvent(tenantId, entityKind, entityId, actorId, `Přidán štítek „${label}"`);
  }
}

firmyRoutes.post('/firmy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const name = f.str('name');
  if (!name) return c.redirect('/firmy/nova');

  const id = await createClient(t, {
    name,
    ico: f.strOrNull('ico'),
    dic: f.strOrNull('dic'),
    status: f.str('status') || 'lead',
    ownerId: f.strOrNull('owner_id'),
    note: f.strOrNull('note'),
  });
  const address = f.strOrNull('address');
  if (address) await updateClientField(t, id, 'address', address);
  await logEvent(t, 'client', id, person.id, 'Firma založena');
  await saveTagsFromForm(t, 'client', id, body.tags, person.id);
  await saveContactsFromForm(t, 'client', id, body, person.id, 'client', id);
  return c.redirect(`/firmy/${id}`);
});

type FirmField = 'website' | 'ico' | 'dic' | 'address';

/** Jeden firemní údaj — klik na hodnotu (nebo „— doplnit —") otevře mini-panel. */
export function ClientField(props: { base: string; field: FirmField; label: string; value: string | null; textarea?: boolean }) {
  const id = `f-${props.field}`;
  return (
    <EditField
      id={id}
      topLabel={props.label}
      label={props.label}
      wide
      value={props.value ? <span style="white-space:pre-wrap">{props.value}</span> : <span class="placeholder">{tr('— doplnit —')}</span>}
    >
      <form hx-post={`${props.base}/pole/${props.field}`} hx-target={`#${id}`} hx-swap="outerHTML" class="m0">
        <div class="opt-group" style="padding-left:0">{props.label}</div>
        {props.textarea ? (
          <textarea class="input" name="value" rows={2} data-autogrow aria-label={props.label} style="width:100%">{props.value ?? ''}</textarea>
        ) : (
          <input class="input" name="value" value={props.value ?? ''} aria-label={props.label} style="width:100%" />
        )}
        <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:.4rem">{tr('Uložit')}</button>
      </form>
    </EditField>
  );
}

/** Firemní údaje (fakturační) — celý blok otevírá velký modál; spouštěč = tužka. */
function FirmInfoBlock(props: {
  base: string;
  client: {
    name: string; ico: string | null; dic: string | null;
    street: string | null; house_no: string | null; address2: string | null;
    city: string | null; postal_code: string | null; country: string | null; address: string | null;
  };
}) {
  const c = props.client;
  const addr = composeAddress(c);
  return (
    <div class="group" id="f-firma-info">
      <div class="group-h">{tr('Firemní údaje')}</div>
      <div class="editable" style="display:block;padding:.3rem .4rem;font-weight:400">
        <div>{c.name}</div>
        {addr.length ? (
          <div style="margin-top:.1rem">{addr.map((l) => <div>{l}</div>)}</div>
        ) : (
          <div style="margin-top:.1rem">
            <span class="empty-inline">
              {tr('Žádná uvedená adresa.')}{' '}
              <a class="emptylink" hx-get={`${props.base}/modal/upravit`} hx-target="#modal" hx-swap="innerHTML">{tr('Vyplnit adresu.')}</a>
            </span>
          </div>
        )}
        <div class="minirow">
          <div><span class="field-label">{tr('IČO')}</span>{c.ico ?? '—'}</div>
          <div><span class="field-label">{tr('DIČ')}</span>{c.dic ?? '—'}</div>
        </div>
        <button type="button" class="pen-ind" data-tip={tr('Upravit firemní údaje')} aria-label={tr('Upravit firemní údaje')} hx-get={`${props.base}/modal/upravit`} hx-target="#modal" hx-swap="innerHTML">
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}

/** Panel „přidat osobu k firmě" — ikonka v rychlém přidání sekce Kontakty. */
function personAddPicker(base: string, persons: Array<{ id: string; name: string }>, linkedIds: Set<string>) {
  return (
    <Picker id="personAdd" trigger={<IconUsers />} triggerClass="icon-btn" triggerLabel={tr('Přidat osobu k firmě')}>
      <form method="post" action={`${base}/osoba`} class="m0">
        <div class="opt-group" style="padding-left:0">{tr('Najít existující')}</div>
        <input class="input" name="existing" list="existingPersons" placeholder={tr('Hledat osobu…')} autocomplete="off" aria-label={tr('Najít existující osobu')} />
        <datalist id="existingPersons">
          {persons.filter((p) => !linkedIds.has(p.id)).map((p) => (
            <option value={p.name}></option>
          ))}
        </datalist>
        <div class="opt-group" style="padding-left:0">{tr('… nebo nová')}</div>
        <input class="input" name="new_name" placeholder={tr('Jméno a příjmení')} aria-label={tr('Jméno nové osoby')} />
        <div id="personAddPhone" class="hidden">
          <input class="input" name="new_phone" placeholder={tr('Telefon')} aria-label={tr('Telefon nové osoby')} />
        </div>
        <div id="personAddEmail" class="hidden">
          <input class="input" name="new_email" placeholder={tr('E-mail')} aria-label={tr('E-mail nové osoby')} />
        </div>
        <div class="quick-add" style="margin:.15rem 0 .5rem">
          <button type="button" class="icon-btn" data-reveal="personAddPhone" aria-label={tr('Přidat pole telefonu')} title={tr('Telefon')}><IconPhone /></button>
          <button type="button" class="icon-btn" data-reveal="personAddEmail" aria-label={tr('Přidat pole e-mailu')} title={tr('E-mail')}><IconMail /></button>
          <button type="button" class="icon-btn" aria-label={tr('Kompletní editace osoby')} title={tr('Kompletní editace')} hx-get={`${base}/osoba/modal`} hx-target="#modal" hx-swap="innerHTML">…</button>
        </div>
        <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center">{tr('Přidat')}</button>
      </form>
    </Picker>
  );
}

// ---------- detail firmy ----------

firmyRoutes.get('/firmy/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const client = await getClient(t, c.req.param('id'));
  if (!client) return c.notFound();
  const tab = c.req.query('tab') ?? 'nastenka';

  const [contacts, tags, allTags, labels, statusItems, coworkers, people, persons, events, services, catalog] = await Promise.all([
    listContacts(t, 'client', client.id),
    listEntityTags(t, 'client', client.id),
    itemsByKey(t, 'client_tags'),
    itemsByKey(t, 'contact_labels'),
    itemsByKey(t, 'client_statuses'),
    listCoworkers(t),
    peopleOfClient(t, client.id),
    listCustomerPersons(t),
    listEvents(t, 'client', client.id),
    listClientServices(t, client.id),
    listCatalog(t),
  ]);
  const base = `/firmy/${client.id}`;
  const dn = client.name;
  const modules = c.get('modules');
  const tasks = modules.has('ukoly') ? await tasksForClient(t, client.id) : [];
  const linkedIds = new Set(people.map((p) => p.id));
  const peopleContacts = await contactsForOwners(t, 'person', people.map((p) => p.id));
  const peopleWith = people.map((p) => ({ ...p, contacts: peopleContacts.filter((x) => x.owner_id === p.id) }));

  // výkazy práce v záložce Služby (jen se zapnutým modulem)
  const rawMonth = c.req.query('mesic') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : monthKey(new Date());
  const vykazyData =
    tab === 'sluzby' && c.get('modules').has('vykazy')
      ? { person, records: await listForClientMonth(t, client.id, month), money: await clientMonthMoney(t, client, month), month }
      : undefined;

  const notes = tab === 'poznamky' ? await notesForEntity(t, 'client', client.id, person.id) : [];

  // Statistické dlaždice na Nástěnce firmy (počítáme jen pro tento pohled).
  const isNastenka = tab !== 'sluzby' && tab !== 'poznamky' && tab !== 'projekty' && tab !== 'historie';
  let nast: { running: number; workMinutes: number; workMoney: number; expected: number } | null = null;
  if (isNastenka) {
    const money = await clientMonthMoney(t, client, month);
    const active = services.filter((s) => s.status === 'active');
    nast = {
      running: active.length,
      workMinutes: money.totalMinutes,
      workMoney: Math.round(money.billedCost + money.overageCost),
      expected: billingTotal({
        hoursBudget: client.hours_budget_monthly,
        retainerPrice: client.retainer_price,
        rollover: client.hours_rollover === 1,
        money,
        subscriptionAmounts: active.filter((s) => s.mode === 'subscription').map((s) => s.monthly_amount ?? 0),
      }),
    };
  }

  return c.html(
    <Layout title={dn} person={person} modules={c.get('modules')} active="zakaznici">
      <div class="detail-grid">
        {/* A) Levý panel */}
        <aside class="card">
          {/* Hlavička (identita): avatar + akce, název, stav, štítky */}
          <div class="idblock">
            <div class="id-top">
              <span class={`av av-lg ${avColor(dn)}`}>{initials(dn)}</span>
              <Picker id="firmActions" trigger={<>{tr('Upravit')} <span class="btn-split">▾</span></>} triggerClass="btn btn-sm" triggerLabel={tr('Akce firmy')} alignRight>
                <button class="opt" type="button" hx-get={`${base}/modal/upravit`} hx-target="#modal" hx-swap="innerHTML">{tr('Upravit firemní údaje')}</button>
                <form method="post" action={`${base}/smazat`} class="m0" onsubmit={`return confirm('${tr('Opravdu smazat tuto firmu? Osoby zůstanou zachované.')}')`}>
                  <button class="opt" type="submit" style="color:var(--red)">{tr('Smazat firmu')}</button>
                </form>
              </Picker>
            </div>
            <div class="editable" style="display:block;margin-top:.45rem">
              <span class="idname field-strong">{dn}</span>
              <button type="button" class="pen-ind" data-tip={tr('Upravit firemní údaje')} aria-label={tr('Upravit firemní údaje')} hx-get={`${base}/modal/upravit`} hx-target="#modal" hx-swap="innerHTML">
                <PencilIcon />
              </button>
            </div>
            <StatusBox base={base} value={client.status} items={statusItems} />
            <TagsSection base={base} tags={tags} allTags={allTags} />
          </div>

          {/* Lidé + Kontakty */}
          <ContactsSection
            base={base}
            contacts={contacts}
            labels={labels}
            allTags={allTags}
            assignedTags={tags}
            people={peopleWith}
            personAdd={personAddPicker(base, persons, linkedIds)}
            unlinkBase={base}
          />

          {/* Firemní údaje (fakturační) */}
          <FirmInfoBlock base={base} client={client} />

          {/* Odpovědná osoba */}
          <OwnerBox
            base={base}
            owner={coworkers.find((u) => u.id === client.owner_id) ?? null}
            coworkers={coworkers}
          />

          <NoteSection base={base} value={client.note} />
        </aside>

        {/* B) Střední panel — živá zóna (realtime) */}
        <section id="stred" hx-get={`${base}?tab=${tab}`} hx-select="#stred" hx-target="this" hx-swap="outerHTML" hx-trigger="live-update from:body" hx-disinherit="*">
          <DetailTabs base={base} active={tab} />
          {tab === 'sluzby' ? (
            <SluzbyZakaznikaTab
              base={base}
              client={client}
              services={services}
              catalog={catalog}
              coworkers={coworkers}
              isAdmin={person.is_admin === 1}
              err={c.req.query('err')}
              vykazy={vykazyData}
            />
          ) : tab === 'poznamky' ? (
            <NotesTab base={base} kind="client" entityId={client.id} notes={notes} person={person} canTask={modules.has('ukoly')} />
          ) : tab === 'projekty' ? (
            <div class="card"><EmptyState text={tr('Funkčnost projektů teprve promyslíme.')} /></div>
          ) : tab === 'historie' ? (
            <div class="card">
              <div class="card-head"><h3>{tr('Historie')}</h3></div>
              {events.length ? (
                <div>{events.map((e) => <EventRow e={e} />)}</div>
              ) : (
                <EmptyState text={tr('Zatím žádná událost.')} />
              )}
            </div>
          ) : (
            <>
              <div class="stats" style="grid-template-columns:repeat(4,1fr)">
                <a class="stat" href={`${base}?tab=historie`}><b>{events.length ? relTime(events[0]!.created_at) : '—'}</b><span>{tr('poslední aktivita')}</span></a>
                <a class="stat" href={`${base}?tab=sluzby`}><b>{nast!.running}</b><span>{tr('běžící služby')}</span></a>
                <a class="stat" href={`${base}?tab=sluzby&mesic=${month}`}><b>{fmtMinutes(nast!.workMinutes)}</b><span>{tr('výkaz')} · {fmtNum(nast!.workMoney)} {currency()}</span></a>
                <a class="stat" href={`${base}?tab=sluzby&mesic=${month}`}><b>{fmtNum(nast!.expected)} {currency()}</b><span>{tr('očekávaný měsíc')}</span></a>
              </div>
              <div class="card" style="margin-top:1rem">
                <div class="card-head"><h3>{tr('Poslední dění')}</h3></div>
                {events.length ? (
                  <div>{events.slice(0, 8).map((e) => <EventRow e={e} />)}</div>
                ) : (
                  <EmptyState text={tr('Zatím se tu nic nestalo.')} />
                )}
                <p class="sub" style="margin:.8rem 0 0">{tr('Komunikace a úkoly přibudou s modulem Úkoly (Krok 4).')}</p>
              </div>
            </>
          )}
        </section>

        {/* C) Pravý panel — úkoly zákazníka */}
        <aside>
          <div class="card">
            <div class="card-head">
              <h3>{tr('Úkoly')}</h3>
              {modules.has('ukoly') ? (
                <button class="btn btn-sm" type="button" hx-get={`/ukoly/modal/novy?klient=${client.id}&back=${encodeURIComponent(base)}`} hx-target="#modal" hx-swap="innerHTML">
                  {tr('Přidat úkol')}
                </button>
              ) : null}
            </div>
            {modules.has('ukoly') ? (
              <div id="client-tasks">
                {tasks.length ? (
                  tasks.map((tk) => <TaskItemRow t={tk} person={person} back={base} target="#client-tasks" canVykaz={modules.has('vykazy')} />)
                ) : (
                  <EmptyState text={tr('K tomuto zákazníkovi není žádný úkol.')} />
                )}
              </div>
            ) : (
              <EmptyState text={tr('Úkoly se zapnou s modulem Úkoly.')} />
            )}
          </div>
        </aside>
      </div>
    </Layout>,
  );
});

// ---------- editace jednoho pole (malé panely — žádný inline edit) ----------

firmyRoutes.post('/firmy/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const field = c.req.param('field');
  if (!isEditableClientField(field)) return c.notFound();
  const client = await getClient(t, id);
  if (!client) return c.notFound();

  let value: string | null = readForm(await c.req.parseBody()).strOrNull('value');
  if (field === 'name' && !value) value = client.name;

  if (field === 'status') {
    const items = await itemsByKey(t, 'client_statuses');
    const status = items.some((s) => s.value === value) ? (value as string) : client.status;
    if (status !== client.status) {
      await updateClientField(t, id, 'status', status);
      const label = items.find((s) => s.value === status)?.label ?? status;
      await logEvent(t, 'client', id, person.id, `Stav: ${label}`);
    }
    return c.html(<StatusBox base={`/firmy/${id}`} value={status} items={items} />);
  }

  const meta = FIELD_META[field];
  if (!meta) return c.notFound();
  if (value !== (client[field] ?? null)) {
    await updateClientField(t, id, field, value);
    await logEvent(t, 'client', id, person.id, `${meta.label}: ${value ?? '—'}`);
  }
  if (field === 'note') return c.html(<NoteSection base={`/firmy/${id}`} value={value} />);
  // název / web / IČO / DIČ / adresa se editují přes velký modál „Firemní údaje" → sem už UI nechodí
  return c.redirect(`/firmy/${id}`);
});

// ---------- odpovědná osoba ----------

firmyRoutes.post('/firmy/:id/owner', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  const ownerId = readForm(await c.req.parseBody()).strOrNull('owner_id');
  const coworkers = await listCoworkers(t);
  const owner = coworkers.find((u) => u.id === ownerId) ?? null;
  if (ownerId !== (client.owner_id ?? null)) {
    await setClientOwner(t, id, ownerId);
    await logEvent(t, 'client', id, person.id, `Odpovědná osoba: ${owner?.name ?? '— nikdo —'}`);
  }
  return c.html(<OwnerBox base={`/firmy/${id}`} owner={owner} coworkers={coworkers} />);
});

// ---------- štítky ----------

async function tagsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, clientId: string) {
  const [tags, allTags] = await Promise.all([listEntityTags(tenantId, 'client', clientId), itemsByKey(tenantId, 'client_tags')]);
  return c.html(<TagsSection base={`/firmy/${clientId}`} tags={tags} allTags={allTags} />);
}

firmyRoutes.post('/firmy/:id/stitek', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const label = await addEntityTag(t, 'client', id, String((await c.req.parseBody()).label ?? ''));
  if (label) await logEvent(t, 'client', id, person.id, `Přidán štítek „${label}"`);
  return tagsFragment(c, t, id);
});

firmyRoutes.post('/firmy/:id/stitek/:itemId/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const label = await removeEntityTag(t, 'client', id, c.req.param('itemId'));
  if (label) await logEvent(t, 'client', id, person.id, `Odebrán štítek „${label}"`);
  return tagsFragment(c, t, id);
});

// ---------- kontakty ----------

async function contactsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, clientId: string, closeModal = false) {
  const [contacts, labels, allTags, assignedTags, people, persons] = await Promise.all([
    listContacts(tenantId, 'client', clientId),
    itemsByKey(tenantId, 'contact_labels'),
    itemsByKey(tenantId, 'client_tags'),
    listEntityTags(tenantId, 'client', clientId),
    peopleOfClient(tenantId, clientId),
    listCustomerPersons(tenantId),
  ]);
  const base = `/firmy/${clientId}`;
  const linkedIds = new Set(people.map((p) => p.id));
  const peopleContacts = await contactsForOwners(tenantId, 'person', people.map((p) => p.id));
  const peopleWith = people.map((p) => ({ ...p, contacts: peopleContacts.filter((x) => x.owner_id === p.id) }));
  const section = (
    <ContactsSection
      base={base}
      contacts={contacts}
      labels={labels}
      allTags={allTags}
      assignedTags={assignedTags}
      people={peopleWith}
      personAdd={personAddPicker(base, persons, linkedIds)}
      unlinkBase={base}
    />
  );
  // při uložení z velkého modálu zároveň zavři #modal (OOB swap)
  return c.html(closeModal ? <>{section}<div id="modal" hx-swap-oob="true"></div></> : section);
}

// velký modál „Upravit kontakty" + hromadné uložení (náhrada všech firemních kontaktů)
firmyRoutes.get('/firmy/:id/kontakty/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  const [contacts, labels] = await Promise.all([listContacts(t, 'client', id), itemsByKey(t, 'contact_labels')]);
  return c.html(<ContactsEditAll base={`/firmy/${id}`} title={`${tr('Kontakty')} · ${client.name}`} contacts={contacts} labels={labels} />);
});

firmyRoutes.post('/firmy/:id/kontakty', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const body = await c.req.parseBody({ all: true });
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : v !== undefined ? [String(v)] : []);
  const types = arr(body.c_type);
  const values = arr(body.c_value);
  const labels = arr(body.c_label);
  await clearOwnerContacts(t, 'client', id);
  for (let i = 0; i < values.length; i++) {
    const value = (values[i] ?? '').trim();
    const type = types[i] ?? 'other';
    if (!value || !isContactType(type)) continue;
    await addContact(t, 'client', id, { type, value, label: (labels[i] ?? '').trim() || null, clientId: id });
  }
  await logEvent(t, 'client', id, person.id, 'Kontakty upraveny');
  return contactsFragment(c, t, id, true);
});

firmyRoutes.post('/firmy/:id/kontakt', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const f = readForm(await c.req.parseBody());
  const type = f.str('type') || 'other';
  if (isContactType(type)) {
    const added = await addContact(t, 'client', id, {
      type,
      value: f.raw('value'),
      label: f.strOrNull('label'),
      clientId: id,
    });
    if (added) {
      await logEvent(t, 'client', id, person.id, `Přidán kontakt: ${CONTACT_TYPE_LABELS[added.type]} ${added.value}${added.label ? ` (${added.label})` : ''}`);
    }
  }
  return contactsFragment(c, t, id);
});

firmyRoutes.get('/firmy/:id/kontakty', async (c) => {
  const person = c.get('person')!;
  const id = c.req.param('id');
  if (!(await getClient(person.tenant_id, id))) return c.notFound();
  return contactsFragment(c, person.tenant_id, id);
});

firmyRoutes.post('/firmy/:id/kontakt/:cid', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const f = readForm(await c.req.parseBody());
  const old = (await listContacts(t, 'client', id)).find((x) => x.id === c.req.param('cid'));
  const updated = await updateContact(t, c.req.param('cid'), {
    value: f.raw('value'),
    label: f.strOrNull('label'),
  });
  if (updated && (!old || old.value !== updated.value || (old.label ?? null) !== (updated.label ?? null))) {
    await logEvent(t, 'client', id, person.id, `Upraven kontakt: ${CONTACT_TYPE_LABELS[updated.type]} ${updated.value}${updated.label ? ` (${updated.label})` : ''}`);
  }
  return contactsFragment(c, t, id);
});

firmyRoutes.post('/firmy/:id/kontakt/:cid/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const removed = await removeContact(t, c.req.param('cid'));
  if (removed) {
    await logEvent(t, 'client', id, person.id, `Odebrán kontakt: ${CONTACT_TYPE_LABELS[removed.type]} ${removed.value}`);
  }
  return contactsFragment(c, t, id);
});

// ---------- lidé (vazby) ----------

// ---------- velký modál: kompletní nová osoba ----------

firmyRoutes.get('/firmy/:id/osoba/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  const [roles, labels] = await Promise.all([itemsByKey(t, 'roles_at_client'), itemsByKey(t, 'contact_labels')]);

  return c.html(
    <ModalShell title={`${tr('Nová osoba')} · ${client.name}`}>
      <form method="post" action={`/firmy/${id}/osoba/komplet`}>
        <div class="field">
          <label>{tr('Jméno a příjmení')} <span class="req">*</span></label>
          <input class="input" name="name" required autofocus />
        </div>
        <div class="field">
          <label>{tr('Role u firmy')}</label>
          <select class="input" name="role">
            <option value="">{tr('— role —')}</option>
            {roles.map((r) => (
              <option value={r.label}>{r.label}</option>
            ))}
          </select>
        </div>
        <ModalContactRows labels={labels} />
        <div class="field"><label>{tr('Štítky')} <span class="help" style="display:inline;margin-left:.4rem">{tr('oddělené čárkou')}</span></label><input class="input" name="tags" /></div>
        <div class="field"><label>{tr('Poznámka')}</label><textarea class="input" name="note"></textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Vytvořit osobu')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>,
  );
});

firmyRoutes.post('/firmy/:id/osoba/komplet', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();

  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const name = f.str('name');
  if (!name) return c.redirect(`/firmy/${id}`);
  const role = f.strOrNull('role');

  const personId = await createCustomerPerson(t, { name, note: f.strOrNull('note') });
  await logEvent(t, 'person', personId, person.id, `Osoba založena (u firmy ${client.name})`);
  await linkPersonToClient(t, personId, id, role);
  await logEvent(t, 'client', id, person.id, `Přidána osoba ${name}${role ? ` (${role})` : ''}`);
  await logEvent(t, 'person', personId, person.id, `Přiřazena k firmě ${client.name}${role ? ` (${role})` : ''}`);
  await saveContactsFromForm(t, 'person', personId, body, person.id, 'person', id);
  await saveTagsFromForm(t, 'person', personId, body.tags, person.id);
  return c.redirect(`/firmy/${id}`);
});

firmyRoutes.post('/firmy/:id/osoba', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();

  const f = readForm(await c.req.parseBody());
  const role = f.strOrNull('role');
  const existingName = f.str('existing');
  const newName = f.str('new_name');
  let personId = '';

  if (existingName) {
    const all = await listCustomerPersons(t);
    personId = all.find((p) => p.name.toLowerCase() === existingName.toLowerCase())?.id ?? '';
  }
  if (!personId && newName) {
    personId = await createCustomerPerson(t, { name: newName });
    await logEvent(t, 'person', personId, person.id, `Osoba založena (u firmy ${client.name})`);
    const phone = f.str('new_phone');
    const email = f.str('new_email');
    if (phone) await addContact(t, 'person', personId, { type: 'phone', value: phone, clientId: id });
    if (email) await addContact(t, 'person', personId, { type: 'email', value: email, clientId: id });
  }
  if (!personId) return c.redirect(`/firmy/${id}`);

  await linkPersonToClient(t, personId, id, role);
  const linked = await listCustomerPersons(t);
  const linkedName = linked.find((p) => p.id === personId)?.name ?? newName;
  await logEvent(t, 'client', id, person.id, `Přidána osoba ${linkedName}${role ? ` (${role})` : ''}`);
  await logEvent(t, 'person', personId, person.id, `Přiřazena k firmě ${client.name}${role ? ` (${role})` : ''}`);
  return c.redirect(`/firmy/${id}`);
});

firmyRoutes.post('/firmy/:id/osoba/:pid/odebrat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const pid = c.req.param('pid');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  await unlinkPersonFromClient(t, pid, id);
  await logEvent(t, 'client', id, person.id, 'Odebrána osoba z firmy');
  await logEvent(t, 'person', pid, person.id, `Odebrána vazba na firmu ${client.name}`);
  return c.redirect(`/firmy/${id}`);
});

// ---------- smazání ----------

firmyRoutes.post('/firmy/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  await logEvent(t, 'client', id, person.id, 'Firma smazána');
  await softDeleteClient(t, id);
  return c.redirect('/zakaznici');
});
