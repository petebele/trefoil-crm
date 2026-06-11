import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { listClients, getClient, primaryClientsFor, clientsOfPerson } from '../domain/clients';
import { listCustomerPersons, getCustomerPerson } from '../domain/people';
import { itemsByKey, tagsForEntities, listEntityTags } from '../domain/lists';
import { primaryContactsFor, listContacts } from '../domain/contacts';
import { initials, avColor, StatusChip, EmptyState } from './components';

export const zakazniciRoutes = new Hono<AppEnv>();

/** Modul musí být zapnutý. */
const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  await next();
};
zakazniciRoutes.use('/zakaznici', requireModule);
zakazniciRoutes.use('/zakaznici/*', requireModule);

type Row = {
  kind: 'firma' | 'osoba';
  id: string;
  href: string;
  name: string;
  subtitle: string | null;
  subtitleLink?: { href: string; text: string } | null;
  email?: string;
  emailLabel?: string | null;
  phone?: string;
  phoneLabel?: string | null;
  tags: Array<{ id: string; label: string }>;
  status?: string;
  createdAt: string;
};

async function buildRows(
  tenantId: string,
  opts: { typ: string; q?: string; stitek?: string; stav?: string; sort: string },
) {
  const [clients, persons] = await Promise.all([
    opts.typ === 'osoby' ? Promise.resolve([]) : listClients(tenantId, opts.q),
    opts.typ === 'firmy' || opts.stav ? Promise.resolve([]) : listCustomerPersons(tenantId, opts.q),
  ]);

  const clientIds = clients.map((c) => c.id);
  const personIds = persons.map((p) => p.id);
  const [clientTags, personTags, clientContacts, personContacts, primFirms] = await Promise.all([
    tagsForEntities(tenantId, 'client', clientIds),
    tagsForEntities(tenantId, 'person', personIds),
    primaryContactsFor(tenantId, 'client', clientIds),
    primaryContactsFor(tenantId, 'person', personIds),
    primaryClientsFor(tenantId, personIds),
  ]);

  let rows: Row[] = [
    ...clients.map((c): Row => ({
      kind: 'firma',
      id: c.id,
      href: `/firmy/${c.id}`,
      name: c.name,
      subtitle: c.website ? `Firma · ${c.website.replace(/^https?:\/\//, '')}` : 'Firma',
      subtitleLink: null,
      ...clientContacts.get(c.id),
      tags: clientTags.get(c.id) ?? [],
      status: c.status,
      createdAt: c.created_at,
    })),
    ...persons.map((p): Row => {
      const firm = primFirms.get(p.id);
      return {
        kind: 'osoba',
        id: p.id,
        href: `/osoby/${p.id}`,
        name: p.name,
        subtitle: firm ? null : 'Osoba',
        subtitleLink: firm ? { href: `/firmy/${firm.clientId}`, text: `${firm.role ?? 'Kontakt'} v ${firm.clientName}` } : null,
        ...personContacts.get(p.id),
        tags: personTags.get(p.id) ?? [],
        createdAt: p.created_at,
      };
    }),
  ];

  if (opts.stitek) rows = rows.filter((r) => r.tags.some((t) => t.id === opts.stitek));
  if (opts.stav) rows = rows.filter((r) => r.kind === 'firma' && r.status === opts.stav);

  if (opts.sort === 'za') rows.sort((a, b) => b.name.localeCompare(a.name, 'cs'));
  else if (opts.sort === 'new') rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else rows.sort((a, b) => a.name.localeCompare(b.name, 'cs'));

  return rows;
}

function RowsTable(props: { rows: Row[]; statusItems: Array<{ value: string; label: string; color: string | null }>; hasFilter: boolean }) {
  return (
    <tbody id="cl-tbody">
      {props.rows.map((r) => (
        <tr hx-get={`/zakaznici/nahled/${r.kind}/${r.id}`} hx-target="#quickview" hx-swap="innerHTML" style="cursor:pointer">
          <td>
            <span class="cell-name">
              <span class={`av ${avColor(r.name)}`}>{initials(r.name)}</span>
              <span>
                <span class="nm"><a href={r.href} style="color:inherit">{r.name}</a></span>
                <span class="sub">
                  {r.subtitleLink ? (
                    <>
                      {r.subtitleLink.text.split(' v ')[0]} v <a href={r.subtitleLink.href}>{r.subtitleLink.text.split(' v ').slice(1).join(' v ')}</a>
                    </>
                  ) : (
                    r.subtitle
                  )}
                </span>
              </span>
            </span>
          </td>
          <td>
            {r.email ? (
              <>
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.emailLabel ? <span class="meta-lbl">{r.emailLabel}</span> : null}
              </>
            ) : (
              <span class="sub">—</span>
            )}
          </td>
          <td>
            {r.phone ?? <span class="sub">—</span>}
            {r.phone && r.phoneLabel ? <span class="meta-lbl">{r.phoneLabel}</span> : null}
          </td>
          <td>
            <span class="chips">
              {r.tags.map((t) => (
                <span class="chip">{t.label}</span>
              ))}
            </span>
          </td>
          <td>{r.kind === 'firma' && r.status ? <StatusChip value={r.status} items={props.statusItems} /> : null}</td>
        </tr>
      ))}
      {props.rows.length === 0 ? (
        <tr>
          <td colspan={5}>
            {props.hasFilter ? (
              <EmptyState text="Nic nenalezeno. Zkus jiné hledání." />
            ) : (
              <EmptyState text="Zatím tu nikdo není.">
                <a class="btn btn-sm btn-primary" href="/firmy/nova" style="margin-right:.4rem">Přidat firmu</a>
                <a class="btn btn-sm" href="/osoby/nova">Přidat osobu</a>
              </EmptyState>
            )}
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

zakazniciRoutes.get('/zakaznici', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const typ = c.req.query('typ') ?? 'vse';
  const q = c.req.query('q') ?? '';
  const stitek = c.req.query('stitek') ?? '';
  const stav = c.req.query('stav') ?? '';
  const sort = c.req.query('sort') ?? 'az';

  const [rows, allRows, statusItems, allTags] = await Promise.all([
    buildRows(t, { typ, q, stitek, stav, sort }),
    buildRows(t, { typ: 'vse', q, stitek, stav, sort }),
    itemsByKey(t, 'client_statuses'),
    itemsByKey(t, 'client_tags'),
  ]);
  const firmCount = allRows.filter((r) => r.kind === 'firma').length;
  const personCount = allRows.filter((r) => r.kind === 'osoba').length;
  const hasFilter = Boolean(q || stitek || stav);

  const tabHref = (k: string) =>
    `/zakaznici?typ=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}${stitek ? `&stitek=${stitek}` : ''}${stav ? `&stav=${stav}` : ''}&sort=${sort}`;

  return c.html(
    <Layout title="Zákazníci" person={person} modules={c.get('modules')} active="zakaznici">
      <div class="page-head">
        <h1>Zákazníci</h1>
        <div class="page-actions">
          <a class="btn btn-primary" href="/osoby/nova">Přidat osobu</a>
          <a class="btn btn-primary" href="/firmy/nova">Přidat firmu</a>
        </div>
      </div>

      <nav class="tabs" aria-label="Typ zákazníka">
        <a class={`tab ${typ === 'vse' ? 'active' : ''}`} href={tabHref('vse')}>Vše <span class="cnt">{firmCount + personCount}</span></a>
        <a class={`tab ${typ === 'firmy' ? 'active' : ''}`} href={tabHref('firmy')}>Firmy <span class="cnt">{firmCount}</span></a>
        <a class={`tab ${typ === 'osoby' ? 'active' : ''}`} href={tabHref('osoby')}>Osoby <span class="cnt">{personCount}</span></a>
      </nav>

      <form
        method="get"
        action="/zakaznici"
        hx-get="/zakaznici"
        hx-target="#cl-tbody"
        hx-select="#cl-tbody"
        hx-swap="outerHTML"
        hx-trigger="change, keyup changed delay:300ms from:find input[name='q']"
        hx-push-url="true"
      >
        <input type="hidden" name="typ" value={typ} />
        <div class="frow" style="align-items:center">
          <input class="input" type="search" name="q" value={q} placeholder="Jméno obsahuje…" aria-label="Hledat podle jména" style="max-width:14rem" />
          <select class="input" name="stitek" aria-label="Filtr podle štítku" style="max-width:11rem">
            <option value="">Štítek: vše</option>
            {allTags.map((tg) => (
              <option value={tg.id} selected={stitek === tg.id}>{tg.label}</option>
            ))}
          </select>
          <select class="input" name="stav" aria-label="Filtr podle stavu" style="max-width:11rem">
            <option value="">Stav: vše</option>
            {statusItems.map((s) => (
              <option value={s.value} selected={stav === s.value}>{s.label}</option>
            ))}
          </select>
          <span style="margin-left:auto"></span>
          <select class="input" name="sort" aria-label="Řazení" style="max-width:11rem">
            <option value="az" selected={sort === 'az'}>Řadit: Název A→Z</option>
            <option value="za" selected={sort === 'za'}>Řadit: Název Z→A</option>
            <option value="new" selected={sort === 'new'}>Řadit: Nejnovější</option>
          </select>
        </div>
      </form>

      <div class="list-meta">
        <span>Zobrazeno 1–{rows.length} z {rows.length}</span>
      </div>

      <div class="card card-table" style="overflow-x:auto">
        <table class="tbl">
          <thead>
            <tr>
              <th>Souhrn</th>
              <th>E-mail</th>
              <th>Telefon</th>
              <th>Štítky</th>
              <th>Stav</th>
            </tr>
          </thead>
          <RowsTable rows={rows} statusItems={statusItems} hasFilter={hasFilter} />
        </table>
      </div>

      <div id="quickview"></div>
    </Layout>,
  );
});

// ---- quick-view panel ----
zakazniciRoutes.get('/zakaznici/nahled/:kind/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const kind = c.req.param('kind');
  const id = c.req.param('id');

  if (kind === 'firma') {
    const client = await getClient(t, id);
    if (!client) return c.notFound();
    const [contacts, tags] = await Promise.all([listContacts(t, 'client', id), listEntityTags(t, 'client', id)]);
    return c.html(
      <QuickView
        name={client.name}
        sub={client.website ? client.website.replace(/^https?:\/\//, '') : 'Firma'}
        href={`/firmy/${client.id}`}
        tags={tags}
        contacts={contacts.map((x) => ({ value: x.value, label: x.label, type: x.type }))}
      />,
    );
  }

  const p = await getCustomerPerson(t, id);
  if (!p) return c.notFound();
  const [contacts, tags, firms] = await Promise.all([
    listContacts(t, 'person', id),
    listEntityTags(t, 'person', id),
    clientsOfPerson(t, id),
  ]);
  const firm = firms[0];
  return c.html(
    <QuickView
      name={p.name}
      sub={firm ? `${firm.role_at_client ?? 'Kontakt'} v ${firm.name}` : 'Osoba'}
      href={`/osoby/${p.id}`}
      tags={tags}
      contacts={contacts.map((x) => ({ value: x.value, label: x.label, type: x.type }))}
    />,
  );
});

function QuickView(props: {
  name: string;
  sub: string;
  href: string;
  tags: Array<{ label: string }>;
  contacts: Array<{ value: string; label: string | null; type: string }>;
}) {
  return (
    <aside class="quickview" aria-label="Rychlý náhled">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class={`av av-lg ${avColor(props.name)}`}>{initials(props.name)}</span>
        <button
          type="button"
          class="btn btn-sm"
          aria-label="Zavřít náhled"
          onclick="document.getElementById('quickview').innerHTML=''"
        >
          ✕
        </button>
      </div>
      <h2 class="record-name">{props.name}</h2>
      <div class="sub" style="margin-bottom:.7rem">{props.sub}</div>
      {props.tags.length ? (
        <div class="chips" style="margin-bottom:.9rem">
          {props.tags.map((t) => (
            <span class="chip">{t.label}</span>
          ))}
        </div>
      ) : null}
      {props.contacts.slice(0, 4).map((x) => (
        <div class="fact">
          <span class="val">{x.type === 'email' ? <a href={`mailto:${x.value}`}>{x.value}</a> : x.value}</span>
          <span class="lbl">
            {x.type === 'phone' ? 'Telefon' : x.type === 'email' ? 'E-mail' : x.type === 'web' ? 'Web' : 'Jiné'}
            {x.label ? ` · ${x.label}` : ''}
          </span>
        </div>
      ))}
      <div class="side-section" style="margin-top:.9rem;padding-top:.9rem">
        <a href={props.href}>Zobrazit celý profil ›</a>
      </div>
    </aside>
  );
}
