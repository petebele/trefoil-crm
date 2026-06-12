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
import { listContacts, addContact, updateContact, removeContact, isContactType, CONTACT_TYPE_LABELS } from '../domain/contacts';
import { logEvent, listEvents } from '../domain/events';
import {
  initials,
  avColor,
  relTime,
  EmptyState,
  FieldDisplay,
  FieldEdit,
  TagsSection,
  ContactsSection,
  ContactEditRow,
  DetailTabs,
  EventRow,
  type FieldKind,
} from './components';

export const osobyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  await next();
};
osobyRoutes.use('/osoby', requireModule);
osobyRoutes.use('/osoby/*', requireModule);

const FIELD_META: Record<string, { label: string; kind: FieldKind }> = {
  name: { label: 'Jméno', kind: 'title' },
  note: { label: 'Poznámka', kind: 'textarea' },
};

/** Poznámka: vyplněná = inline editace; prázdná = jen akce „Přidat poznámku". */
function noteBox(base: string, value: string | null) {
  return value ? (
    <FieldDisplay base={base} field="note" label="Poznámka" value={value} kind="textarea" noLabel />
  ) : (
    <div class="field-wrap" id="f-note">
      <button type="button" class="subtle-action" hx-get={`${base}/pole/note/edit`} hx-target="#f-note" hx-swap="outerHTML">
        Přidat poznámku
      </button>
    </div>
  );
}

// ---------- nová osoba ----------

osobyRoutes.get('/osoby/nova', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const [firms, roles, labels] = await Promise.all([
    listClients(t),
    itemsByKey(t, 'roles_at_client'),
    itemsByKey(t, 'contact_labels'),
  ]);

  return c.html(
    <Layout title="Nová osoba" person={person} modules={c.get('modules')} active="zakaznici">
      <h1>Nová osoba</h1>
      <div class="card" style="max-width:36rem;margin-top:1rem">
        <form method="post" action="/osoby">
          <div class="field">
            <label>Jméno a příjmení <span class="req">*</span></label>
            <input class="input" name="name" required autofocus />
          </div>
          <div class="field">
            <label>Firma</label>
            <input class="input" name="firm_name" list="allFirms" placeholder="Najdi firmu… (nová se rovnou založí)" autocomplete="off" />
            <datalist id="allFirms">
              {firms.map((f) => (
                <option value={f.name}></option>
              ))}
            </datalist>
            <span class="help">Když napíšeš firmu, která ještě neexistuje, založí se spolu s osobou.</span>
          </div>
          <div class="field">
            <label>Role u firmy</label>
            <select class="input" name="role">
              <option value="">— role —</option>
              {roles.map((r) => (
                <option value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>

          <div class="field">
            <label>Kontakty <span class="help" style="display:inline;margin-left:.4rem">další přidáš tlačítkem nebo později na detailu</span></label>
            <div>
              <template id="contactRowTpl">
                <div style="display:flex;gap:.4rem;margin-bottom:.4rem">
                  <select class="input" name="c_type" style="max-width:6.5rem">
                    <option value="phone">Telefon</option>
                    <option value="email">E-mail</option>
                    <option value="web">Web</option>
                    <option value="other">Jiné</option>
                  </select>
                  <input class="input" name="c_value" placeholder="Hodnota" style="flex:1" />
                  <input class="input" name="c_label" list="contactLabels" placeholder="Štítek (Práce…)" autocomplete="off" style="max-width:8rem" />
                </div>
              </template>
              <div style="display:flex;gap:.4rem;margin-bottom:.4rem">
                <select class="input" name="c_type" style="max-width:6.5rem">
                  <option value="phone">Telefon</option>
                  <option value="email" selected>E-mail</option>
                  <option value="web">Web</option>
                  <option value="other">Jiné</option>
                </select>
                <input class="input" name="c_value" placeholder="Hodnota" style="flex:1" />
                <input class="input" name="c_label" list="contactLabels" placeholder="Štítek (Práce…)" autocomplete="off" style="max-width:8rem" />
              </div>
            </div>
            <button class="btn btn-ghost" type="button" data-add-row="contactRowTpl">+ další kontakt</button>
            <datalist id="contactLabels">
              {labels.map((l) => (
                <option value={l.label}></option>
              ))}
            </datalist>
          </div>

          <div class="field"><label>Štítky <span class="help" style="display:inline;margin-left:.4rem">oddělené čárkou</span></label><input class="input" name="tags" placeholder="VIP…" /></div>
          <div class="field"><label>Poznámka</label><textarea class="input" name="note"></textarea></div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Vytvořit osobu</button>
            <a class="btn btn-ghost" href="/zakaznici">Zrušit</a>
          </div>
        </form>
      </div>
    </Layout>,
  );
});

osobyRoutes.post('/osoby', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody({ all: true });
  const name = String(body.name ?? '').trim();
  if (!name) return c.redirect('/osoby/nova');

  const personId = await createCustomerPerson(t, { name, note: String(body.note ?? '').trim() || null });
  await logEvent(t, 'person', personId, person.id, 'Osoba založena');

  // firma: existující podle jména, jinak rovnou založit
  const firmName = String(body.firm_name ?? '').trim();
  let clientContext: string | null = null;
  if (firmName) {
    const firms = await listClients(t);
    let firm = firms.find((f) => f.name.toLowerCase() === firmName.toLowerCase());
    if (!firm) {
      const newId = await createClient(t, { name: firmName, ownerId: person.id });
      await logEvent(t, 'client', newId, person.id, `Firma založena (při zakládání osoby ${name})`);
      firm = { id: newId } as (typeof firms)[number];
    }
    const role = String(body.role ?? '').trim() || null;
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

// ---------- detail osoby ----------

osobyRoutes.get('/osoby/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const p = await getCustomerPerson(t, c.req.param('id'));
  if (!p) return c.notFound();
  const tab = c.req.query('tab') ?? 'nastenka';

  const [contacts, tags, allTags, labels, firms, events] = await Promise.all([
    listContacts(t, 'person', p.id),
    listEntityTags(t, 'person', p.id),
    itemsByKey(t, 'client_tags'),
    itemsByKey(t, 'contact_labels'),
    clientsOfPerson(t, p.id),
    listEvents(t, 'person', p.id),
  ]);
  const base = `/osoby/${p.id}`;

  return c.html(
    <Layout title={p.name} person={person} modules={c.get('modules')} active="zakaznici">
      <div class="detail-grid">
        {/* A) Levý panel */}
        <aside class="card">
          <span class={`av av-lg ${avColor(p.name)}`}>{initials(p.name)}</span>
          <div style="margin-top:.7rem">
            <FieldDisplay base={base} field="name" label="Jméno" value={p.name} kind="title" />
          </div>
          <div style="margin:.6rem 0 1rem">
            <TagsSection base={base} tags={tags} />
          </div>

          <ContactsSection base={base} contacts={contacts} labels={labels} allTags={allTags} assignedTags={tags} />

          <div class="side-section">
            <h4>Firmy</h4>
            {firms.map((f) => (
              <div class="person-row">
                <span class={`av av-sm ${avColor(f.name)}`}>{initials(f.name)}</span>
                <span>
                  <a class="nm" href={`/firmy/${f.id}`} style="color:inherit">{f.name}</a>
                  <span class="sub">{f.role_at_client ?? 'Kontakt'}</span>
                </span>
              </div>
            ))}
            {firms.length === 0 ? (
              <p class="sub m0" style="padding:.2rem 0">Zatím není u žádné firmy. Přiřadíš ji na detailu firmy.</p>
            ) : null}
          </div>

          <div class="side-section"><h4>Poznámka</h4>{noteBox(base, p.note)}</div>

          <div class="side-section" style="border-top-style:dashed">
            <form method="post" action={`${base}/smazat`} class="m0" onsubmit="return confirm('Opravdu smazat tuto osobu?')">
              <button class="btn btn-sm btn-danger" type="submit">Smazat osobu</button>
            </form>
          </div>
        </aside>

        {/* B) Střední panel — živá zóna (realtime) */}
        <section id="stred" hx-get={`${base}?tab=${tab}`} hx-select="#stred" hx-target="this" hx-swap="outerHTML" hx-trigger="live-update from:body">
          <DetailTabs base={base} active={tab} />
          {tab === 'sluzby' ? (
            <div class="card"><EmptyState text="Připravujeme — modul Služby & rozpočty (Krok 5)." /></div>
          ) : tab === 'projekty' ? (
            <div class="card"><EmptyState text="Funkčnost projektů teprve promyslíme." /></div>
          ) : tab === 'historie' ? (
            <div class="card">
              <div class="card-head"><h3>Historie</h3></div>
              {events.length ? <div>{events.map((e) => <EventRow e={e} />)}</div> : <EmptyState text="Zatím žádná událost." />}
            </div>
          ) : (
            <>
              <div class="stats" style="grid-template-columns:repeat(3,1fr)">
                <div class="stat"><b>{events.length ? relTime(events[0]!.created_at) : '—'}</b><span>poslední aktivita</span></div>
                <div class="stat"><b>{firms.length}</b><span>firmy</span></div>
                <div class="stat"><b>{contacts.length}</b><span>kontakty</span></div>
              </div>
              <div class="card" style="margin-top:1rem">
                <div class="card-head"><h3>Poslední dění</h3></div>
                {events.length ? (
                  <div>{events.slice(0, 8).map((e) => <EventRow e={e} />)}</div>
                ) : (
                  <EmptyState text="Zatím se tu nic nestalo." />
                )}
                <p class="sub" style="margin:.8rem 0 0">Komunikace a úkoly přibudou s modulem Úkoly (Krok 4).</p>
              </div>
            </>
          )}
        </section>

        {/* C) Pravý panel */}
        <aside>
          <div class="card">
            <div class="card-head"><h3>Úkoly a události</h3></div>
            <EmptyState text="Úkoly přijdou s modulem Úkoly (Krok 4)." />
          </div>
        </aside>
      </div>
    </Layout>,
  );
});

// ---------- inline pole ----------

osobyRoutes.get('/osoby/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const field = c.req.param('field');
  if (!isEditablePersonField(field)) return c.notFound();
  const p = await getCustomerPerson(person.tenant_id, c.req.param('id'));
  if (!p) return c.notFound();
  if (field === 'note') return c.html(noteBox(`/osoby/${p.id}`, p.note));
  const meta = FIELD_META[field]!;
  return c.html(<FieldDisplay base={`/osoby/${p.id}`} field={field} label={meta.label} value={p[field]} kind={meta.kind} />);
});

osobyRoutes.get('/osoby/:id/pole/:field/edit', async (c) => {
  const person = c.get('person')!;
  const field = c.req.param('field');
  if (!isEditablePersonField(field)) return c.notFound();
  const p = await getCustomerPerson(person.tenant_id, c.req.param('id'));
  if (!p) return c.notFound();
  const meta = FIELD_META[field]!;
  return c.html(<FieldEdit base={`/osoby/${p.id}`} field={field} label={meta.label} value={p[field]} kind={meta.kind} noLabel={field === 'note'} />);
});

osobyRoutes.post('/osoby/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const field = c.req.param('field');
  if (!isEditablePersonField(field)) return c.notFound();
  const p = await getCustomerPerson(t, id);
  if (!p) return c.notFound();

  let value: string | null = String((await c.req.parseBody()).value ?? '').trim() || null;
  if (field === 'name' && !value) value = p.name;
  await updatePersonField(t, id, field, value);
  const meta = FIELD_META[field]!;
  await logEvent(t, 'person', id, person.id, `${meta.label}: ${value ?? '—'}`);
  if (field === 'note') return c.html(noteBox(`/osoby/${id}`, value));
  return c.html(<FieldDisplay base={`/osoby/${id}`} field={field} label={meta.label} value={value} kind={meta.kind} />);
});

// ---------- štítky ----------

async function tagsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, personId: string) {
  const tags = await listEntityTags(tenantId, 'person', personId);
  return c.html(<TagsSection base={`/osoby/${personId}`} tags={tags} />);
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

async function contactsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, personId: string) {
  const [contacts, labels, allTags, assignedTags] = await Promise.all([
    listContacts(tenantId, 'person', personId),
    itemsByKey(tenantId, 'contact_labels'),
    itemsByKey(tenantId, 'client_tags'),
    listEntityTags(tenantId, 'person', personId),
  ]);
  return c.html(
    <ContactsSection base={`/osoby/${personId}`} contacts={contacts} labels={labels} allTags={allTags} assignedTags={assignedTags} />,
  );
}

osobyRoutes.post('/osoby/:id/kontakt', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const body = await c.req.parseBody();
  const type = String(body.type ?? 'other');
  if (isContactType(type)) {
    const added = await addContact(t, 'person', id, {
      type,
      value: String(body.value ?? ''),
      label: String(body.label ?? '').trim() || null,
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

osobyRoutes.get('/osoby/:id/kontakt/:cid/edit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const contacts = await listContacts(t, 'person', id);
  const contact = contacts.find((x) => x.id === c.req.param('cid'));
  if (!contact) return c.notFound();
  return c.html(<ContactEditRow base={`/osoby/${id}`} contact={contact} />);
});

osobyRoutes.post('/osoby/:id/kontakt/:cid', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getCustomerPerson(t, id))) return c.notFound();
  const body = await c.req.parseBody();
  const updated = await updateContact(t, c.req.param('cid'), {
    value: String(body.value ?? ''),
    label: String(body.label ?? '').trim() || null,
  });
  if (updated) {
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
