import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import {
  getClient,
  createClient,
  updateClientField,
  isEditableClientField,
  setClientOwner,
  softDeleteClient,
  peopleOfClient,
  linkPersonToClient,
  unlinkPersonFromClient,
} from '../domain/clients';
import { listCustomerPersons, createCustomerPerson, listCoworkers } from '../domain/people';
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
  StatusBox,
  OwnerBox,
  TagsSection,
  ContactsSection,
  ContactEditRow,
  DetailTabs,
  EventRow,
  type FieldKind,
} from './components';

export const firmyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  await next();
};
firmyRoutes.use('/firmy', requireModule);
firmyRoutes.use('/firmy/*', requireModule);

const FIELD_META: Record<string, { label: string; kind: FieldKind }> = {
  name: { label: 'Název', kind: 'title' },
  website: { label: 'Web', kind: 'text' },
  ico: { label: 'IČO', kind: 'text' },
  dic: { label: 'DIČ', kind: 'text' },
  note: { label: 'Poznámka', kind: 'textarea' },
};

// ---------- nová firma ----------

function ContactRowsFields() {
  return (
    <>
      <div class="field">
        <label>Kontakty <span class="help" style="display:inline;margin-left:.4rem">telefon, e-mail, web — další přidáš tlačítkem nebo později na detailu</span></label>
        <div id="contactRows">
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
              <option value="email">E-mail</option>
              <option value="web">Web</option>
              <option value="other">Jiné</option>
            </select>
            <input class="input" name="c_value" placeholder="Hodnota" style="flex:1" />
            <input class="input" name="c_label" list="contactLabels" placeholder="Štítek (Práce…)" autocomplete="off" style="max-width:8rem" />
          </div>
        </div>
        <button class="btn btn-ghost" type="button" data-add-row="contactRowTpl">+ další kontakt</button>
      </div>
    </>
  );
}

firmyRoutes.get('/firmy/nova', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const [statusItems, coworkers, labels] = await Promise.all([
    itemsByKey(t, 'client_statuses'),
    listCoworkers(t),
    itemsByKey(t, 'contact_labels'),
  ]);

  return c.html(
    <Layout title="Nová firma" person={person} modules={c.get('modules')} active="zakaznici">
      <h1>Nová firma</h1>
      <div class="card" style="max-width:36rem;margin-top:1rem">
        <form method="post" action="/firmy">
          <div class="field">
            <label>Název firmy <span class="req">*</span></label>
            <input class="input" name="name" required autofocus />
          </div>
          <div class="field"><label>Web</label><input class="input" name="website" placeholder="https://…" /></div>
          <div style="display:flex;gap:.75rem">
            <div class="field" style="flex:1"><label>IČO</label><input class="input" name="ico" /></div>
            <div class="field" style="flex:1"><label>DIČ</label><input class="input" name="dic" /></div>
          </div>
          <div class="field">
            <label>Stav</label>
            <select class="input" name="status">
              {statusItems.map((s) => (
                <option value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div class="field">
            <label>Odpovědná osoba</label>
            <select class="input" name="owner_id">
              <option value="">— nikdo —</option>
              {coworkers.map((u) => (
                <option value={u.id} selected={u.id === person.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <ContactRowsFields />
          <datalist id="contactLabels">
            {labels.map((l) => (
              <option value={l.label}></option>
            ))}
          </datalist>
          <div class="field"><label>Štítky <span class="help" style="display:inline;margin-left:.4rem">oddělené čárkou</span></label><input class="input" name="tags" placeholder="VIP, E-shop…" /></div>
          <div class="field"><label>Poznámka</label><textarea class="input" name="note"></textarea></div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Vytvořit firmu</button>
            <a class="btn btn-ghost" href="/zakaznici">Zrušit</a>
          </div>
        </form>
      </div>
    </Layout>,
  );
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
  const name = String(body.name ?? '').trim();
  if (!name) return c.redirect('/firmy/nova');

  const id = await createClient(t, {
    name,
    website: String(body.website ?? '').trim() || null,
    ico: String(body.ico ?? '').trim() || null,
    dic: String(body.dic ?? '').trim() || null,
    status: String(body.status ?? 'lead'),
    ownerId: String(body.owner_id ?? '').trim() || null,
    note: String(body.note ?? '').trim() || null,
  });
  await logEvent(t, 'client', id, person.id, 'Firma založena');
  await saveTagsFromForm(t, 'client', id, body.tags, person.id);
  await saveContactsFromForm(t, 'client', id, body, person.id, 'client', id);
  return c.redirect(`/firmy/${id}`);
});

// ---------- detail firmy ----------

firmyRoutes.get('/firmy/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const client = await getClient(t, c.req.param('id'));
  if (!client) return c.notFound();
  const tab = c.req.query('tab') ?? 'nastenka';

  const [contacts, tags, allTags, labels, statusItems, coworkers, people, persons, roles, events] = await Promise.all([
    listContacts(t, 'client', client.id),
    listEntityTags(t, 'client', client.id),
    itemsByKey(t, 'client_tags'),
    itemsByKey(t, 'contact_labels'),
    itemsByKey(t, 'client_statuses'),
    listCoworkers(t),
    peopleOfClient(t, client.id),
    listCustomerPersons(t),
    itemsByKey(t, 'roles_at_client'),
    listEvents(t, 'client', client.id),
  ]);
  const base = `/firmy/${client.id}`;
  const linkedIds = new Set(people.map((p) => p.id));

  return c.html(
    <Layout title={client.name} person={person} modules={c.get('modules')} active="zakaznici">
      <div class="detail-grid">
        {/* A) Levý panel */}
        <aside class="card">
          <span class={`av av-lg ${avColor(client.name)}`}>{initials(client.name)}</span>
          <div style="margin-top:.7rem">
            <FieldDisplay base={base} field="name" label="Název" value={client.name} kind="title" />
          </div>
          <div style="margin:.6rem 0 1rem">
            <TagsSection base={base} tags={tags} allTags={allTags} />
          </div>

          <ContactsSection base={base} contacts={contacts} labels={labels} />

          <div class="side-section">
            <FieldDisplay base={base} field="website" label="Web" value={client.website} kind="text" />
            <div style="display:flex;gap:1.2rem">
              <FieldDisplay base={base} field="ico" label="IČO" value={client.ico} kind="text" />
              <FieldDisplay base={base} field="dic" label="DIČ" value={client.dic} kind="text" />
            </div>
            <StatusBox base={base} value={client.status} items={statusItems} />
          </div>

          <OwnerBox
            base={base}
            owner={coworkers.find((u) => u.id === client.owner_id) ?? null}
            coworkers={coworkers}
          />

          <div class="side-section">
            <h4>Lidé</h4>
            {people.map((p) => (
              <div class="person-row">
                <span class={`av av-sm ${avColor(p.name)}`}>{initials(p.name)}</span>
                <span style="flex:1">
                  <a class="nm" href={`/osoby/${p.id}`} style="color:inherit">{p.name}</a>
                  <span class="sub">{p.role_at_client ?? 'Kontakt'}</span>
                </span>
                <form method="post" action={`${base}/osoba/${p.id}/odebrat`} class="m0" onsubmit="return confirm('Odebrat osobu z této firmy?')">
                  <button type="submit" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:.75rem" aria-label={`Odebrat ${p.name}`}>✕</button>
                </form>
              </div>
            ))}
            {people.length === 0 ? <p class="sub m0" style="padding:.2rem 0 .5rem">Zatím žádná osoba.</p> : null}

            <details style="margin-top:.4rem">
              <summary class="sub" style="cursor:pointer">+ Přidat osobu</summary>
              <form method="post" action={`${base}/osoba`} style="margin-top:.6rem">
                <div class="field" style="margin-bottom:.6rem">
                  <label>Existující osoba</label>
                  <select class="input" name="person_id">
                    <option value="">— vyber —</option>
                    {persons.filter((p) => !linkedIds.has(p.id)).map((p) => (
                      <option value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div class="field" style="margin-bottom:.6rem">
                  <label>… nebo nová osoba</label>
                  <input class="input" name="new_name" placeholder="Jméno a příjmení" />
                </div>
                <div class="field" style="margin-bottom:.6rem">
                  <label>Role u firmy</label>
                  <select class="input" name="role">
                    <option value="">— role —</option>
                    {roles.map((r) => (
                      <option value={r.label}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style="display:flex;gap:.4rem;margin-bottom:.6rem">
                  <input class="input" name="new_phone" placeholder="Telefon (u nové)" style="flex:1" />
                  <input class="input" name="new_email" placeholder="E-mail (u nové)" style="flex:1" />
                </div>
                <button class="btn btn-sm btn-primary" type="submit">Přidat</button>
              </form>
            </details>
          </div>

          <div class="side-section">
            <FieldDisplay base={base} field="note" label="Poznámka" value={client.note} kind="textarea" />
          </div>

          <div class="side-section" style="border-top-style:dashed">
            <form method="post" action={`${base}/smazat`} class="m0" onsubmit="return confirm('Opravdu smazat tuto firmu? Osoby zůstanou zachované.')">
              <button class="btn btn-sm btn-danger" type="submit">Smazat firmu</button>
            </form>
          </div>
        </aside>

        {/* B) Střední panel */}
        <section>
          <DetailTabs base={base} active={tab} />
          {tab === 'sluzby' ? (
            <div class="card"><EmptyState text="Připravujeme — modul Služby & rozpočty (Krok 5)." /></div>
          ) : tab === 'projekty' ? (
            <div class="card"><EmptyState text="Funkčnost projektů teprve promyslíme." /></div>
          ) : tab === 'historie' ? (
            <div class="card">
              <div class="card-head"><h3>Historie</h3></div>
              {events.length ? (
                <div>{events.map((e) => <EventRow e={e} />)}</div>
              ) : (
                <EmptyState text="Zatím žádná událost." />
              )}
            </div>
          ) : (
            <>
              <div class="stats" style="grid-template-columns:repeat(3,1fr)">
                <div class="stat"><b>{events.length ? relTime(events[0]!.created_at) : '—'}</b><span>poslední aktivita</span></div>
                <div class="stat"><b>{people.length}</b><span>lidé</span></div>
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

firmyRoutes.get('/firmy/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const field = c.req.param('field');
  if (!isEditableClientField(field)) return c.notFound();
  const client = await getClient(person.tenant_id, c.req.param('id'));
  if (!client) return c.notFound();
  if (field === 'status') {
    const items = await itemsByKey(person.tenant_id, 'client_statuses');
    return c.html(<StatusBox base={`/firmy/${client.id}`} value={client.status} items={items} />);
  }
  const meta = FIELD_META[field];
  if (!meta) return c.notFound();
  return c.html(<FieldDisplay base={`/firmy/${client.id}`} field={field} label={meta.label} value={client[field]} kind={meta.kind} />);
});

firmyRoutes.get('/firmy/:id/pole/:field/edit', async (c) => {
  const person = c.get('person')!;
  const field = c.req.param('field');
  if (!isEditableClientField(field)) return c.notFound();
  const client = await getClient(person.tenant_id, c.req.param('id'));
  if (!client) return c.notFound();
  const meta = FIELD_META[field];
  if (!meta) return c.notFound();
  return c.html(<FieldEdit base={`/firmy/${client.id}`} field={field} label={meta.label} value={client[field]} kind={meta.kind} />);
});

firmyRoutes.post('/firmy/:id/pole/:field', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const field = c.req.param('field');
  if (!isEditableClientField(field)) return c.notFound();
  const client = await getClient(t, id);
  if (!client) return c.notFound();

  const body = await c.req.parseBody();
  let value: string | null = String(body.value ?? '').trim() || null;
  if (field === 'name' && !value) value = client.name;

  if (field === 'status') {
    const items = await itemsByKey(t, 'client_statuses');
    const status = items.some((s) => s.value === value) ? (value as string) : client.status;
    await updateClientField(t, id, 'status', status);
    const label = items.find((s) => s.value === status)?.label ?? status;
    await logEvent(t, 'client', id, person.id, `Stav: ${label}`);
    return c.html(<StatusBox base={`/firmy/${id}`} value={status} items={items} />);
  }

  const meta = FIELD_META[field];
  if (!meta) return c.notFound();
  await updateClientField(t, id, field, value);
  await logEvent(t, 'client', id, person.id, `${meta.label}: ${value ?? '—'}`);
  return c.html(<FieldDisplay base={`/firmy/${id}`} field={field} label={meta.label} value={value} kind={meta.kind} />);
});

// ---------- odpovědná osoba ----------

firmyRoutes.post('/firmy/:id/owner', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();
  const ownerId = String((await c.req.parseBody()).owner_id ?? '').trim() || null;
  await setClientOwner(t, id, ownerId);
  const coworkers = await listCoworkers(t);
  const owner = coworkers.find((u) => u.id === ownerId) ?? null;
  await logEvent(t, 'client', id, person.id, `Odpovědná osoba: ${owner?.name ?? '— nikdo —'}`);
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

async function contactsFragment(c: { html: (x: unknown) => Response | Promise<Response> }, tenantId: string, clientId: string) {
  const [contacts, labels] = await Promise.all([listContacts(tenantId, 'client', clientId), itemsByKey(tenantId, 'contact_labels')]);
  return c.html(<ContactsSection base={`/firmy/${clientId}`} contacts={contacts} labels={labels} />);
}

firmyRoutes.post('/firmy/:id/kontakt', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const body = await c.req.parseBody();
  const type = String(body.type ?? 'other');
  if (isContactType(type)) {
    const added = await addContact(t, 'client', id, {
      type,
      value: String(body.value ?? ''),
      label: String(body.label ?? '').trim() || null,
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

firmyRoutes.get('/firmy/:id/kontakt/:cid/edit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const contacts = await listContacts(t, 'client', id);
  const contact = contacts.find((x) => x.id === c.req.param('cid'));
  if (!contact) return c.notFound();
  return c.html(<ContactEditRow base={`/firmy/${id}`} contact={contact} />);
});

firmyRoutes.post('/firmy/:id/kontakt/:cid', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  if (!(await getClient(t, id))) return c.notFound();
  const body = await c.req.parseBody();
  const updated = await updateContact(t, c.req.param('cid'), {
    value: String(body.value ?? ''),
    label: String(body.label ?? '').trim() || null,
  });
  if (updated) {
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

firmyRoutes.post('/firmy/:id/osoba', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const client = await getClient(t, id);
  if (!client) return c.notFound();

  const body = await c.req.parseBody();
  const role = String(body.role ?? '').trim() || null;
  const newName = String(body.new_name ?? '').trim();
  let personId = String(body.person_id ?? '').trim();

  if (newName) {
    personId = await createCustomerPerson(t, { name: newName });
    await logEvent(t, 'person', personId, person.id, `Osoba založena (u firmy ${client.name})`);
    const phone = String(body.new_phone ?? '').trim();
    const email = String(body.new_email ?? '').trim();
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
