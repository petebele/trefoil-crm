import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { listClients, createClient, linkPersonToClient, clientsOfPerson } from '../domain/clients';
import {
  getCustomerPerson,
  createCustomerPerson,
  updatePersonField,
  isEditablePersonField,
  softDeletePerson,
} from '../domain/people';
import { itemsByKey, listEntityTags, addEntityTag, removeEntityTag } from '../domain/lists';
import { listContacts, addContact, updateContact, removeContact, clearOwnerContacts, isContactType, CONTACT_TYPE_LABELS } from '../domain/contacts';
import { logEvent, listEvents } from '../domain/events';
import { readForm } from '../lib/util';
import {
  initials,
  avColor,
  EmptyState,
  TitleBox,
  NoteSection,
  TagsSection,
  ContactsSection,
  DetailTabs,
  EventRow,
  ActivityFeed,
  Picker,
  ModalShell,
  ModalContactRows,
  ContactsEditAll,
} from './components';
import { tr, relTime } from '../i18n';
import { servicesOfPersonFirms, SERVICE_STATUS_LABELS } from '../domain/clientServices';
import { SERVICE_MODE_LABELS } from '../domain/services';
import { NotesTab } from './poznamky';
import { notesForEntity } from '../domain/notes';

export const osobyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  await next();
};
osobyRoutes.use('/osoby', requireModule);
osobyRoutes.use('/osoby/*', requireModule);

/** Pole editovatelná malým panelem (jméno v hlavičce, poznámka v sekci). */
const FIELD_META: Record<string, { label: string }> = {
  name: { label: 'Jméno' },
  note: { label: 'Poznámka' },
};

// ---------- nová osoba ----------

// Stará stránka nahrazena jednotným velkým modálem.
osobyRoutes.get('/osoby/nova', (c) => c.redirect('/zakaznici'));

osobyRoutes.get('/osoby/modal/nova', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const [firms, roles, labels] = await Promise.all([
    listClients(t),
    itemsByKey(t, 'roles_at_client'),
    itemsByKey(t, 'contact_labels'),
  ]);

  return c.html(
    <ModalShell title={tr('Nová osoba')}>
      <form method="post" action="/osoby">
        <div class="field">
          <label>{tr('Jméno a příjmení')} <span class="req">*</span></label>
          <input class="input" name="name" required autofocus />
        </div>
        <div class="field">
          <label>{tr('Firma')}</label>
          <input class="input" name="firm_name" list="allFirmsModal" placeholder={tr('Najdi firmu… (nová se rovnou založí)')} autocomplete="off" />
          <datalist id="allFirmsModal">
            {firms.map((f) => (
              <option value={f.name}></option>
            ))}
          </datalist>
          <span class="help">{tr('Když napíšeš firmu, která ještě neexistuje, založí se spolu s osobou.')}</span>
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
        <div class="field"><label>{tr('Štítky')} <span class="help" style="display:inline;margin-left:.4rem">{tr('oddělené čárkou')}</span></label><input class="input" name="tags" placeholder="VIP…" /></div>
        <div class="field"><label>{tr('Poznámka')}</label><textarea class="input" name="note"></textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Vytvořit osobu')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>,
  );
});

osobyRoutes.post('/osoby', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody({ all: true });
  const f = readForm(body);
  const name = f.str('name');
  if (!name) return c.redirect('/osoby/nova');

  const personId = await createCustomerPerson(t, { name, note: f.strOrNull('note') });
  await logEvent(t, 'person', personId, person.id, 'Osoba založena');

  // firma: existující podle jména, jinak rovnou založit
  const firmName = f.str('firm_name');
  let clientContext: string | null = null;
  if (firmName) {
    const firms = await listClients(t);
    let firm = firms.find((f) => f.name.toLowerCase() === firmName.toLowerCase());
    if (!firm) {
      const newId = await createClient(t, { name: firmName, ownerId: person.id });
      await logEvent(t, 'client', newId, person.id, `Firma založena (při zakládání osoby ${name})`);
      firm = { id: newId } as (typeof firms)[number];
    }
    const role = f.strOrNull('role');
    await linkPersonToClient(t, personId, firm.id, role);
    clientContext = firm.id;
    await logEvent(t, 'client', firm.id, person.id, `Přidána osoba ${name}${role ? ` (${role})` : ''}`);
    await logEvent(t, 'person', personId, person.id, `Přiřazena k firmě ${firmName}${role ? ` (${role})` : ''}`);
  }

  // kontakty z formuláře
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : v !== undefined ? [String(v)] : []);
  const types = arr(body.c_type);
  const values = arr(body.c_value);
  const lab = arr(body.c_label);
  for (let i = 0; i < values.length; i++) {
    const value = (values[i] ?? '').trim();
    const type = types[i] ?? 'other';
    if (!value || !isContactType(type)) continue;
    const added = await addContact(t, 'person', personId, { type, value, label: lab[i] ?? null, clientId: clientContext });
    if (added) {
      await logEvent(t, 'person', personId, person.id, `Přidán kontakt: ${CONTACT_TYPE_LABELS[added.type]} ${added.value}${added.label ? ` (${added.label})` : ''}`);
    }
  }

  // štítky
  const tags = String(body.tags ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const tag of tags) {
    const label = await addEntityTag(t, 'person', personId, tag);
    if (label) await logEvent(t, 'person', personId, person.id, `Přidán štítek „${label}"`);
  }

  return c.redirect(`/osoby/${personId}`);
});

// Úprava osoby — stejný velký modál jako založení, jen předvyplněný (kontakty,
// štítky a vazby na firmy se spravují přímo v levém panelu).
osobyRoutes.get('/osoby/:id/modal/upravit', async (c) => {
  const person = c.get('person')!;
  const p = await getCustomerPerson(person.tenant_id, c.req.param('id'));
  if (!p) return c.notFound();

  return c.html(
    <ModalShell title={`${tr('Upravit osobu')} · ${p.name}`}>
      <form method="post" action={`/osoby/${p.id}/upravit`}>
        <div class="field">
          <label>{tr('Jméno a příjmení')} <span class="req">*</span></label>
          <input class="input" name="name" value={p.name} required autofocus />
        </div>
        <div class="field"><label>{tr('Poznámka')}</label><textarea class="input" name="note">{p.note ?? ''}</textarea></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Uložit změny')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>,
  );
});

osobyRoutes.post('/osoby/:id/upravit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const p = await getCustomerPerson(t, c.req.param('id'));
  if (!p) return c.notFound();

  const f = readForm(await c.req.parseBody());
  const name = f.str('name');
  if (!name) return c.redirect(`/osoby/${p.id}`);
  const note = f.strOrNull('note');

  const changes: string[] = [];
  if (p.name !== name) changes.push('jméno');
  if ((p.note ?? null) !== note) changes.push('poznámka');

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  if (changes.length) {
    await updatePersonField(t, p.id, 'name', name);
    await updatePersonField(t, p.id, 'note', note);
    await logEvent(t, 'person', p.id, person.id, `Osoba upravena (${changes.join(', ')})`);
  }
  return c.redirect(`/osoby/${p.id}`);
});

// ---------- detail osoby ----------

osobyRoutes.get('/osoby/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const p = await getCustomerPerson(t, c.req.param('id'));
  if (!p) return c.notFound();
  const tab = c.req.query('tab') ?? 'nastenka';
  const atyp = c.req.query('atyp') ?? '';

  const [contacts, tags, allTags, labels, firms, events, firmServices] = await Promise.all([
    listContacts(t, 'person', p.id),
    listEntityTags(t, 'person', p.id),
    itemsByKey(t, 'client_tags'),
    itemsByKey(t, 'contact_labels'),
    clientsOfPerson(t, p.id),
    listEvents(t, 'person', p.id),
    servicesOfPersonFirms(t, p.id),
  ]);
  const base = `/osoby/${p.id}`;
  const modules = c.get('modules');
  const notes = tab === 'poznamky' ? await notesForEntity(t, 'person', p.id, person.id) : [];

  return c.html(
    <Layout title={p.name} person={person} modules={modules} active="zakaznici">
      <div class="detail-grid">
        {/* A) Levý panel */}
        <aside class="card">
          {/* Hlavička (identita): avatar + akce, jméno, štítky */}
          <div class="idblock">
            <div class="id-top">
              <span class={`av av-lg ${avColor(p.name)}`}>{initials(p.name)}</span>
              <Picker id="personActions" trigger={<>{tr('Upravit')} <span class="btn-split">▾</span></>} triggerClass="btn btn-sm" triggerLabel={tr('Akce osoby')} alignRight>
                <button class="opt" type="button" hx-get={`${base}/modal/upravit`} hx-target="#modal" hx-swap="innerHTML">{tr('Upravit osobu')}</button>
                <form method="post" action={`${base}/smazat`} class="m0" onsubmit={`return confirm('${tr('Opravdu smazat tuto osobu?')}')`}>
                  <button class="opt" type="submit" style="color:var(--red)">{tr('Smazat osobu')}</button>
                </form>
              </Picker>
            </div>
            <TitleBox base={base} label="Jméno a příjmení" value={p.name} />
            <TagsSection base={base} tags={tags} allTags={allTags} />
          </div>

          {/* Kontakty */}
          <ContactsSection base={base} contacts={contacts} labels={labels} />

          {/* Firmy (napojení) */}
          <div class="group">
            <div class="group-h">{tr('Firmy')}</div>
            {firms.length ? (
              firms.map((f) => (
                <a class="prow" href={`/firmy/${f.id}`}>
                  <span class={`av av-sm ${avColor(f.name)}`}>{initials(f.name)}</span>
                  <span>
                    <span class="nm">{f.name}</span>
                    {f.role_at_client ? <span class="sub" style="display:block">{f.role_at_client}</span> : null}
                  </span>
                </a>
              ))
            ) : (
              <p class="empty-inline m0" style="padding:.25rem 0">{tr('Žádná firma.')}</p>
            )}
          </div>

          <NoteSection base={base} value={p.note} />
        </aside>

        {/* B) Střední panel — živá zóna (realtime) */}
        <section id="stred" hx-get={`${base}?tab=${tab}`} hx-select="#stred" hx-target="this" hx-swap="outerHTML" hx-trigger="live-update from:body" hx-disinherit="*">
          <DetailTabs base={base} active={tab} />
          {tab === 'sluzby' ? (
            <div class="card">
              <div class="card-head"><h3>{tr('Služby firem této osoby')}</h3></div>
              {firmServices.length === 0 ? (
                <EmptyState text={tr('Žádné běžící služby. Služby se přidělují na detailu firmy (záložka Služby).')} />
              ) : (
                <div>
                  {firmServices.map((s) => (
                    <div style="display:flex;gap:.7rem;align-items:center;padding:.55rem 0;border-top:1px solid var(--line)">
                      <span style="flex:1">
                        <span style="font-weight:600">{s.label}</span>
                        <span class={`chip ${s.mode === 'retainer' ? 'chip-soft-teal' : s.mode === 'subscription' ? 'chip-soft-dark' : 'chip-soft-gray'}`} style="margin-left:.5rem">
                          {tr(SERVICE_MODE_LABELS[s.mode])}
                        </span>
                        {s.status === 'paused' ? <span class="chip chip-soft-orange" style="margin-left:.35rem">{tr(SERVICE_STATUS_LABELS.paused)}</span> : null}
                      </span>
                      <a class="subtle-action" href={`/firmy/${s.client_id}?tab=sluzby`}>{s.client_name}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'poznamky' ? (
            <NotesTab base={base} kind="person" entityId={p.id} notes={notes} person={person} canTask={modules.has('ukoly')} />
          ) : tab === 'projekty' ? (
            <div class="card"><EmptyState text={tr('Funkčnost projektů teprve promyslíme.')} /></div>
          ) : tab === 'aktivity' ? (
            <ActivityFeed events={events} base={base} active={atyp} />
          ) : (
            <>
              <div class="stats" style="grid-template-columns:repeat(3,1fr)">
                <div class="stat"><b>{events.length ? relTime(events[0]!.created_at) : '—'}</b><span>{tr('poslední aktivita')}</span></div>
                <div class="stat"><b>{firms.length}</b><span>{tr('firmy')}</span></div>
                <div class="stat"><b>{contacts.length}</b><span>{tr('kontakty')}</span></div>
              </div>
              <div class="card" style="margin-top:1rem">
                <div class="card-head"><h3>{tr('Poslední dění')}</h3></div>
                {events.length ? (
                  <div>{events.slice(0, 8).map((e) => <EventRow e={e} />)}</div>
                ) : (
                  <EmptyState text={tr('Zatím se tu nic nestalo.')} />
                )}
                <p class="sub" style="margin:.8rem 0 0">{tr('Komunikace přibude s dalšími moduly.')}</p>
              </div>
            </>
          )}
        </section>

        {/* C) Pravý panel */}
        <aside>
          <div class="card">
            <div class="card-head"><h3>{tr('Úkoly')}</h3></div>
            <EmptyState text={tr('Úkoly vedeme u firem — otevři firmu této osoby.')} />
          </div>
        </aside>
      </div>
    </Layout>,
  );
});

// ---------- editace jednoho pole (malé panely — žádný inline edit) ----------

osobyRoutes.post('/osoby/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const field = c.req.param('field');
  if (!isEditablePersonField(field)) return c.notFound();
  const p = await getCustomerPerson(t, id);
  if (!p) return c.notFound();

  let value: string | null = readForm(await c.req.parseBody()).strOrNull('value');
  if (field === 'name' && !value) value = p.name;
  const meta = FIELD_META[field]!;
  if (value !== (p[field] ?? null)) {
    await updatePersonField(t, id, field, value);
    await logEvent(t, 'person', id, person.id, `${meta.label}: ${value ?? '—'}`);
  }
  if (field === 'note') return c.html(<NoteSection base={`/osoby/${id}`} value={value} />);
  return c.html(<TitleBox base={`/osoby/${id}`} label="Jméno a příjmení" value={value ?? p.name} />);
});

// ---------- štítky ----------

async function tagsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, personId: string) {
  const [tags, allTags] = await Promise.all([listEntityTags(tenantId, 'person', personId), itemsByKey(tenantId, 'client_tags')]);
  return c.html(<TagsSection base={`/osoby/${personId}`} tags={tags} allTags={allTags} />);
}

osobyRoutes.post('/osoby/:id/stitek', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const label = await addEntityTag(t, 'person', id, String((await c.req.parseBody()).label ?? ''));
  if (label) await logEvent(t, 'person', id, person.id, `Přidán štítek „${label}"`);
  return tagsFragment(c, t, id);
});

osobyRoutes.post('/osoby/:id/stitek/:itemId/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const label = await removeEntityTag(t, 'person', id, c.req.param('itemId'));
  if (label) await logEvent(t, 'person', id, person.id, `Odebrán štítek „${label}"`);
  return tagsFragment(c, t, id);
});

// ---------- kontakty ----------

async function contactsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, personId: string, closeModal = false) {
  const [contacts, labels] = await Promise.all([listContacts(tenantId, 'person', personId), itemsByKey(tenantId, 'contact_labels')]);
  const section = <ContactsSection base={`/osoby/${personId}`} contacts={contacts} labels={labels} />;
  return c.html(closeModal ? <>{section}<div id="modal" hx-swap-oob="true"></div></> : section);
}

// velký modál „Upravit kontakty" osoby + hromadné uložení
osobyRoutes.get('/osoby/:id/kontakty/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const p = await getCustomerPerson(t, id);
  if (!p) return c.notFound();
  const [contacts, labels] = await Promise.all([listContacts(t, 'person', id), itemsByKey(t, 'contact_labels')]);
  return c.html(<ContactsEditAll base={`/osoby/${id}`} title={`${tr('Kontakty')} · ${p.name}`} contacts={contacts} labels={labels} />);
});

osobyRoutes.post('/osoby/:id/kontakty', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const body = await c.req.parseBody({ all: true });
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : v !== undefined ? [String(v)] : []);
  const types = arr(body.c_type);
  const values = arr(body.c_value);
  const labels = arr(body.c_label);
  await clearOwnerContacts(t, 'person', id);
  for (let i = 0; i < values.length; i++) {
    const value = (values[i] ?? '').trim();
    const type = types[i] ?? 'other';
    if (!value || !isContactType(type)) continue;
    await addContact(t, 'person', id, { type, value, label: (labels[i] ?? '').trim() || null });
  }
  await logEvent(t, 'person', id, person.id, 'Kontakty upraveny');
  return contactsFragment(c, t, id, true);
});

osobyRoutes.post('/osoby/:id/kontakt', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const f = readForm(await c.req.parseBody());
  const type = f.str('type') || 'other';
  if (isContactType(type)) {
    const added = await addContact(t, 'person', id, {
      type,
      value: f.raw('value'),
      label: f.strOrNull('label'),
    });
    if (added) {
      await logEvent(t, 'person', id, person.id, `Přidán kontakt: ${CONTACT_TYPE_LABELS[added.type]} ${added.value}${added.label ? ` (${added.label})` : ''}`);
    }
  }
  return contactsFragment(c, t, id);
});

osobyRoutes.get('/osoby/:id/kontakty', async (c) => {
  const person = c.get('person')!;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(person.tenant_id, id))) return c.notFound();
  return contactsFragment(c, person.tenant_id, id);
});

osobyRoutes.post('/osoby/:id/kontakt/:cid', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const f = readForm(await c.req.parseBody());
  const old = (await listContacts(t, 'person', id)).find((x) => x.id === c.req.param('cid'));
  const updated = await updateContact(t, c.req.param('cid'), {
    value: f.raw('value'),
    label: f.strOrNull('label'),
  });
  if (updated && (!old || old.value !== updated.value || (old.label ?? null) !== (updated.label ?? null))) {
    await logEvent(t, 'person', id, person.id, `Upraven kontakt: ${CONTACT_TYPE_LABELS[updated.type]} ${updated.value}${updated.label ? ` (${updated.label})` : ''}`);
  }
  return contactsFragment(c, t, id);
});

osobyRoutes.post('/osoby/:id/kontakt/:cid/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const removed = await removeContact(t, c.req.param('cid'));
  if (removed) await logEvent(t, 'person', id, person.id, `Odebrán kontakt: ${CONTACT_TYPE_LABELS[removed.type]} ${removed.value}`);
  return contactsFragment(c, t, id);
});

// ---------- smazání ----------

osobyRoutes.post('/osoby/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  await logEvent(t, 'person', id, person.id, 'Osoba smazána');
  await softDeletePerson(t, id);
  return c.redirect('/zakaznici');
});
