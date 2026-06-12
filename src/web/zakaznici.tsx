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
        subtitleLink: firm ? { href: `/firmy/${firm.clientId}`, text: firm.role ? `${firm.role} v ${firm.clientName}` : firm.clientName } : null,
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
                <button class="btn btn-sm btn-primary" type="button" style="margin-right:.4rem" hx-get="/firmy/modal/nova" hx-target="#modal" hx-swap="innerHTML">Přidat firmu</button>
                <button class="btn btn-sm" type="button" hx-get="/osoby/modal/nova" hx-target="#modal" hx-swap="innerHTML">Přidat osobu</button>
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

  /** Odkaz na přehled se změněným filtrem (ostatní parametry zůstávají). */
  const href = (o: Partial<Record<'typ' | 'q' | 'stitek' | 'stav' | 'sort', string>>) => {
    const v = { typ, q, stitek, stav, sort, ...o };
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/zakaznici?${p.toString()}`;
  };
  const tabHref = (k: string) => href({ typ: k });

  return c.html(
    <Layout title="Zákazníci" person={person} modules={c.get('modules')} active="zakaznici">
      <div class="page-head">
        <h1>Zákazníci</h1>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" hx-get="/osoby/modal/nova" hx-target="#modal" hx-swap="innerHTML">Přidat osobu</button>
          <button class="btn btn-primary" type="button" hx-get="/firmy/modal/nova" hx-target="#modal" hx-swap="innerHTML">Přidat firmu</button>
        </div>
      </div>

      <nav class="tabs" aria-label="Typ zákazníka">
        <a class={`tab ${typ === 'vse' ? 'active' : ''}`} href={tabHref('vse')}>Vše <span class="cnt">{firmCount + personCount}</span></a>
        <a class={`tab ${typ === 'firmy' ? 'active' : ''}`} href={tabHref('firmy')}>Firmy <span class="cnt">{firmCount}</span></a>
        <a class={`tab ${typ === 'osoby' ? 'active' : ''}`} href={tabHref('osoby')}>Osoby <span class="cnt">{personCount}</span></a>
      </nav>

      <div class="frow" style="align-items:center">
        <form
          method="get"
          action="/zakaznici"
          class="m0"
          hx-get="/zakaznici"
          hx-target="#cl-tbody"
          hx-select="#cl-tbody"
          hx-swap="outerHTML"
          hx-trigger="submit, keyup changed delay:300ms from:find input[name='q']"
          hx-push-url="true"
        >
          <input type="hidden" name="typ" value={typ} />
          <input type="hidden" name="stitek" value={stitek} />
          <input type="hidden" name="stav" value={stav} />
          <input type="hidden" name="sort" value={sort} />
          <input class="input" type="search" name="q" value={q} placeholder="Jméno obsahuje…" aria-label="Hledat podle jména" style="max-width:14rem" />
        </form>

        <div class="menu" id="fltStitek">
          <button type="button" class="fpill" data-menu-toggle="fltStitek" aria-haspopup="true">
            Štítek: <b>{allTags.find((x) => x.id === stitek)?.label ?? 'Vše'}</b> <span class="chev">▾</span>
          </button>
          <div class="menu-list panel" role="menu">
            {allTags.length > 6 ? <input class="input" data-filter-list placeholder="Hledat štítek…" aria-label="Hledat štítek" /> : null}
            <a class="opt" href={href({ stitek: '' })}>Vše {!stitek ? <span class="tick">✓</span> : null}</a>
            {allTags.map((tg) => (
              <a class="opt" href={href({ stitek: tg.id })}>
                {tg.label}
                {stitek === tg.id ? <span class="tick">✓</span> : null}
              </a>
            ))}
            {allTags.length === 0 ? <div class="sub" style="padding:.4rem .6rem">Zatím žádné štítky.</div> : null}
          </div>
        </div>

        <div class="menu" id="fltStav">
          <button type="button" class="fpill" data-menu-toggle="fltStav" aria-haspopup="true">
            Stav: <b>{statusItems.find((x) => x.value === stav)?.label ?? 'Vše'}</b> <span class="chev">▾</span>
          </button>
          <div class="menu-list panel" role="menu">
            <a class="opt" href={href({ stav: '' })}>Vše {!stav ? <span class="tick">✓</span> : null}</a>
            {statusItems.map((s) => (
              <a class="opt" href={href({ stav: s.value })}>
                {s.label}
                {stav === s.value ? <span class="tick">✓</span> : null}
              </a>
            ))}
          </div>
        </div>

        <span style="margin-left:auto"></span>

        <div class="menu" id="fltSort">
          <button type="button" class="fpill" data-menu-toggle="fltSort" aria-haspopup="true">
            Řadit: <b>{sort === 'za' ? 'Název Z→A' : sort === 'new' ? 'Nejnovější' : 'Název A→Z'}</b> <span class="chev">▾</span>
          </button>
          <div class="menu-list panel" role="menu">
            <a class="opt" href={href({ sort: 'az' })}>Název A→Z {sort === 'az' ? <span class="tick">✓</span> : null}</a>
            <a class="opt" href={href({ sort: 'za' })}>Název Z→A {sort === 'za' ? <span class="tick">✓</span> : null}</a>
            <a class="opt" href={href({ sort: 'new' })}>Nejnovější {sort === 'new' ? <span class="tick">✓</span> : null}</a>
          </div>
        </div>
      </div>

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
      sub={firm ? (firm.role_at_client ? `${firm.role_at_client} v ${firm.name}` : firm.name) : 'Osoba'}
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
