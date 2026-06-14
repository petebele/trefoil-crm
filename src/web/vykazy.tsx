import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { ModalShell, EmptyState, KebabMenu } from './components';
import { logEvent } from '../domain/events';
import { getClient, listClients } from '../domain/clients';
import { listClientServices, type ClientService } from '../domain/clientServices';
import {
  BILLING_LABELS,
  isBilling,
  defaultBilling,
  getWorkRecord,
  listForWorkerMonth,
  listPendingForApprover,
  overviewByWorker,
  createWorkRecord,
  updateWorkRecord,
  deleteWorkRecord,
  approveWorkRecord,
  monthKey,
  shiftMonth,
  monthLabel,
  fmtMinutes,
  type WorkRecord,
  type WorkRecordInput,
} from '../domain/workRecords';
import type { PersonsTable } from '../db/schema';
import { tr, fmtDate } from '../i18n';

export const vykazyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('vykazy')) return c.redirect('/');
  await next();
};
vykazyRoutes.use('/vykazy', requireModule);
vykazyRoutes.use('/vykazy/*', requireModule);

const validMonth = (s: string | undefined): string => (s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : monthKey(new Date()));

const fmtDay = (iso: string) => fmtDate(iso);

// ---------- práva ----------

export function canEditRecord(person: PersonsTable, r: WorkRecord): boolean {
  return person.is_admin === 1 || (r.worker_id === person.id && r.status === 'pending');
}

export function canApproveFor(person: PersonsTable, clientOwnerId: string | null): boolean {
  return person.is_admin === 1 || (clientOwnerId !== null && clientOwnerId === person.id);
}

// ---------- velký modál (JEDEN formulář pro vykázání i úpravu) ----------

export function WorkRecordModal(props: {
  record: WorkRecord | null; // null = nový
  client: { id: string; name: string } | null; // zvolený zákazník (předvyplnění)
  clients: Array<{ id: string; name: string }>; // pro výběr zákazníka (nový bez kontextu)
  services: ClientService[]; // běžící služby zvoleného zákazníka
  back: string;
  preselectServiceId?: string; // „Vykázat" přímo ze služby
}) {
  const r = props.record;
  const today = new Date().toISOString().slice(0, 10);
  const running = props.services.filter((s) => s.status !== 'ended');
  const preselected = running.find((s) => s.id === props.preselectServiceId);
  const billingDefault = r?.billing ?? (preselected ? defaultBilling(preselected.mode) : 'retainer_hours');
  return (
    <ModalShell title={r ? `${tr('Upravit výkaz')} · ${r.client_name}` : tr('Vykázat práci')}>
      <form method="post" action={r ? `/vykazy/${r.id}` : '/vykazy'}>
        <input type="hidden" name="back" value={props.back} />
        {r ? null : props.client ? (
          <input type="hidden" name="client_id" value={props.client.id} />
        ) : null}
        {r ? (
          <p class="sub" style="margin:0 0 .8rem">{tr('Zákazník')}: <b>{r.client_name}</b> · {tr('pracoval(a) {name}', { name: r.worker_name })}</p>
        ) : props.client ? (
          <p class="sub" style="margin:0 0 .8rem">{tr('Zákazník')}: <b>{props.client.name}</b></p>
        ) : (
          <div class="field">
            <label>{tr('Zákazník')} <span class="req">*</span></label>
            {/* výběr zákazníka načte modál znovu s jeho službami */}
            <select
              class="input"
              name="client_pick"
              required
              hx-get="/vykazy/modal/novy"
              hx-trigger="change"
              hx-target="#modal"
              hx-swap="innerHTML"
              hx-vals={JSON.stringify({ back: props.back })}
              hx-include="this"
              autofocus
            >
              <option value="">{tr('— vyberte zákazníka —')}</option>
              {props.clients.map((cl) => (
                <option value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </div>
        )}
        {r || props.client ? (
          <>
            <div class="field">
              <label>{tr('Služba')} <span class="req">*</span></label>
              {/* data-set-billing = výchozí účtování dle režimu služby (app.js) */}
              <select class="input" name="service_id" required data-defaults>
                <option value="">{tr('— vyberte službu —')}</option>
                {running.map((s) => (
                  <option
                    value={s.id}
                    selected={(r ? r.service_id : props.preselectServiceId) === s.id}
                    data-set-billing={defaultBilling(s.mode)}
                  >
                    {s.label}
                    {s.detail ? ` · ${s.detail}` : ''}
                  </option>
                ))}
              </select>
              {running.length === 0 ? <span class="help">{tr('Zákazník nemá žádnou běžící službu — nejdřív mu ji přidělte (detail → Služby).')}</span> : null}
            </div>
            <div class="field">
              <label>{tr('Popis úkonu')} <span class="req">*</span></label>
              <input class="input" name="description" value={r?.description ?? ''} required />
            </div>
            <div class="field">
              <label>{tr('Poznámka')}</label>
              <textarea class="input" name="note" rows={2}>{r?.note ?? ''}</textarea>
            </div>
            <div class="field">
              <label>{tr('Čas')} <span class="req">*</span></label>
              <div style="display:flex;gap:.5rem;align-items:center">
                <input class="input" type="number" name="hours" min="0" max="24" step="1" value={r ? Math.floor(r.minutes / 60) : ''} style="max-width:6rem" aria-label={tr('Hodiny')} />
                <span class="sub">{tr('h')}</span>
                <input class="input" type="number" name="mins" min="0" max="59" step="5" value={r ? r.minutes % 60 : ''} style="max-width:6rem" aria-label={tr('Minuty')} />
                <span class="sub">{tr('min')}</span>
              </div>
            </div>
            <div class="field">
              <label>{tr('Datum')}</label>
              <input class="input" type="date" name="performed_at" value={r?.performed_at ?? today} required />
            </div>
            <div class="field">
              <label>{tr('Účtování')}</label>
              <select class="input" name="billing">
                <option value="retainer_hours" selected={billingDefault === 'retainer_hours'}>{tr(BILLING_LABELS.retainer_hours)}</option>
                <option value="billed" selected={billingDefault === 'billed'}>{tr(BILLING_LABELS.billed)}</option>
                <option value="free" selected={billingDefault === 'free'}>{tr(BILLING_LABELS.free)}</option>
              </select>
              <span class="help">{tr('Předvyplní se podle režimu služby; u každého výkazu jde změnit.')}</span>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit">{r ? tr('Uložit změny') : tr('Vykázat')}</button>
              <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
            </div>
          </>
        ) : (
          <div class="form-actions">
            <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
          </div>
        )}
      </form>
    </ModalShell>
  );
}

// ---------- sdílený řádek a blok výkazů (používá i detail zákazníka) ----------

export function WorkRecordRow(props: { r: WorkRecord; person: PersonsTable; ownerId: string | null; back: string; showClient?: boolean }) {
  const { r, person, back } = props;
  return (
    <div class="hover-row" style="display:flex;gap:.7rem;align-items:flex-start;padding:.5rem 0;border-top:1px solid var(--line);font-size:.86rem">
      <span class="sub" style="white-space:nowrap">{fmtDay(r.performed_at)}</span>
      <span style="flex:1">
        <span style="font-weight:600">{r.description}</span>
        <span class="sub" style="display:block">
          {props.showClient ? <>{r.client_name} · </> : null}
          {r.service_label}
          {r.service_detail ? ` · ${r.service_detail}` : ''} · {r.worker_name}
          {r.note ? <span style="display:block;font-size:.78rem">{r.note}</span> : null}
        </span>
      </span>
      <span class={`chip ${r.billing === 'retainer_hours' ? 'chip-soft-teal' : r.billing === 'billed' ? 'chip-soft-orange' : 'chip-soft-gray'}`}>
        {tr(BILLING_LABELS[r.billing])}
      </span>
      <span style="font-weight:600;white-space:nowrap">{fmtMinutes(r.minutes)}</span>
      {r.status === 'pending' ? <span class="chip chip-soft-gray">{tr('Čeká')}</span> : <span class="chip chip-soft-teal" title={r.approved_by_name ? tr('Schválil(a) {name}', { name: r.approved_by_name }) : ''}>{tr('Schváleno')}</span>}
      {(r.status === 'pending' && canApproveFor(person, props.ownerId)) || canEditRecord(person, r) ? (
        <span class="row-actions">
          <KebabMenu id={`wkRow-${r.id}`} label={tr('Možnosti výkazu')}>
            {r.status === 'pending' && canApproveFor(person, props.ownerId) ? (
              <form method="post" action={`/vykazy/${r.id}/schvalit`} class="m0">
                <input type="hidden" name="back" value={back} />
                <button class="opt" type="submit">{tr('Schválit')}</button>
              </form>
            ) : null}
            {canEditRecord(person, r) ? (
              <>
                <button class="opt" type="button" hx-get={`/vykazy/${r.id}/modal?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
                  {tr('Upravit')}
                </button>
                <form method="post" action={`/vykazy/${r.id}/smazat`} class="m0" onsubmit={`return confirm('${tr('Smazat tento výkaz?')}')`}>
                  <input type="hidden" name="back" value={back} />
                  <button class="opt" type="submit" style="color:var(--red)">{tr('Smazat')}</button>
                </form>
              </>
            ) : null}
          </KebabMenu>
        </span>
      ) : null}
    </div>
  );
}

/** Přepínač měsíce — šipky jako ikonová tlačítka, název měsíce mezi nimi. */
export function MonthNav(props: { month: string; hrefFor: (m: string) => string }) {
  return (
    <span style="display:inline-flex;align-items:center;gap:.15rem;border:1px solid var(--line);border-radius:999px;padding:.1rem .35rem;background:var(--card)">
      <a class="icon-btn" style="text-decoration:none" href={props.hrefFor(shiftMonth(props.month, -1))} aria-label={tr('Předchozí měsíc')}>‹</a>
      <span style="min-width:8.5rem;text-align:center;text-transform:capitalize;font-weight:600;font-size:.85rem">{monthLabel(props.month)}</span>
      <a class="icon-btn" style="text-decoration:none" href={props.hrefFor(shiftMonth(props.month, 1))} aria-label={tr('Další měsíc')}>›</a>
    </span>
  );
}

// ---------- stránka /vykazy ----------

const TABS = [
  { key: 'muj', label: 'Můj výkaz' },
  { key: 'schvalovani', label: 'Schvalování' },
  { key: 'prehled', label: 'Přehled' },
] as const;

vykazyRoutes.get('/vykazy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const month = validMonth(c.req.query('mesic'));
  const rawTab = c.req.query('tab') ?? 'muj';
  const isAdmin = person.is_admin === 1;
  const tab = TABS.some((x) => x.key === rawTab && (x.key !== 'prehled' || isAdmin)) ? rawTab : 'muj';

  const [mine, pending, overview] = await Promise.all([
    tab === 'muj' ? listForWorkerMonth(t, person.id, month) : Promise.resolve([]),
    tab === 'schvalovani' ? listPendingForApprover(t, person.id, isAdmin) : Promise.resolve([]),
    tab === 'prehled' && isAdmin ? overviewByWorker(t, month) : Promise.resolve([]),
  ]);
  const back = `/vykazy?tab=${tab}&mesic=${month}`;
  const hrefFor = (m: string) => `/vykazy?tab=${tab}&mesic=${m}`;
  const myTotal = mine.reduce((s, r) => s + r.minutes, 0);

  return c.html(
    <Layout title={tr('Výkazy práce')} person={person} modules={c.get('modules')} active="vykazy">
      <div class="page-head">
        <h1>{tr('Výkazy práce')}</h1>
        <button class="btn btn-primary" type="button" hx-get={`/vykazy/modal/novy?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
          {tr('Vykázat práci')}
        </button>
      </div>

      <nav class="tabs" aria-label={tr('Sekce výkazů')}>
        {TABS.filter((x) => x.key !== 'prehled' || isAdmin).map((x) => (
          <a class={`tab ${tab === x.key ? 'active' : ''}`} href={`/vykazy?tab=${x.key}&mesic=${month}`}>
            {tr(x.label)}
          </a>
        ))}
      </nav>

      <section
        id="stred"
        hx-get={back}
        hx-select="#stred"
        hx-target="this"
        hx-swap="outerHTML"
        hx-trigger="live-update from:body"
        hx-disinherit="*"
        style="margin-top:1rem"
      >
        {tab !== 'schvalovani' ? (
          <p style="margin:.2rem 0 .8rem"><MonthNav month={month} hrefFor={hrefFor} /></p>
        ) : null}

        {tab === 'muj' ? (
          <div class="card">
            <div class="card-head">
              <h3>{tr('Můj výkaz')}</h3>
              <b>{fmtMinutes(myTotal)}</b>
            </div>
            {mine.length === 0 ? (
              <EmptyState text={tr('Zatím jsi v tomto měsíci nevykázal žádnou práci.')} />
            ) : (
              <div>{mine.map((r) => <WorkRecordRow r={r} person={person} ownerId={null} back={back} showClient />)}</div>
            )}
          </div>
        ) : null}

        {tab === 'schvalovani' ? (
          <div class="card">
            <div class="card-head"><h3>{tr('Čeká na schválení')}</h3></div>
            {pending.length === 0 ? (
              <EmptyState text={tr('Nic nečeká na schválení. 🎉')} />
            ) : (
              <div>{pending.map((r) => <WorkRecordRow r={r} person={person} ownerId={isAdmin ? person.id : person.id} back={back} showClient />)}</div>
            )}
            <p class="sub" style="margin:.6rem 0 0;font-size:.78rem">
              {isAdmin ? tr('Zobrazují se výkazy zákazníků, za které odpovídáš (admin vidí všechny).') : tr('Zobrazují se výkazy zákazníků, za které odpovídáš.')}
            </p>
          </div>
        ) : null}

        {tab === 'prehled' ? (
          <div class="card card-table" style="overflow-x:auto">
            <table class="tbl">
              <thead>
                <tr><th>{tr('Pracovník')}</th><th>{tr('Výkazů')}</th><th>{tr('Celkem čas')}</th></tr>
              </thead>
              <tbody>
                {overview.length === 0 ? (
                  <tr><td colspan={3}><EmptyState text={tr('V tomto měsíci zatím nikdo nevykázal žádnou práci.')} /></td></tr>
                ) : (
                  overview.map((o) => (
                    <tr>
                      <td style="font-weight:600">{o.worker_name}</td>
                      <td>{o.records}</td>
                      <td>{fmtMinutes(Number(o.total_minutes))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </Layout>,
  );
});

// ---------- modály ----------

vykazyRoutes.get('/vykazy/modal/novy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  let back = c.req.query('back') || '';
  let clientId = c.req.query('klient') || c.req.query('client_pick') || '';

  // kontext: otevřeno z detailu zákazníka (htmx posílá aktuální URL) → předvybrat ho
  const currentUrl = c.req.header('HX-Current-URL') ?? '';
  if (!clientId) {
    const m = /\/firmy\/([0-9a-fA-F-]{8,})/.exec(currentUrl);
    if (m) clientId = m[1]!;
  }
  if (!back) {
    try {
      const u = new URL(currentUrl);
      back = u.pathname + u.search;
    } catch {
      back = '/vykazy';
    }
  }

  const client = clientId ? await getClient(t, clientId) : null;
  const [clients, services] = await Promise.all([
    client ? Promise.resolve([]) : listClients(t),
    client ? listClientServices(t, client.id) : Promise.resolve([]),
  ]);
  return c.html(
    <WorkRecordModal
      record={null}
      client={client ? { id: client.id, name: client.name } : null}
      clients={clients}
      services={services}
      back={back || '/vykazy'}
      preselectServiceId={c.req.query('sluzba')}
    />,
  );
});

vykazyRoutes.get('/vykazy/:id/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  if (!canEditRecord(person, record)) return c.redirect('/vykazy');
  const back = c.req.query('back') || '/vykazy';
  const services = await listClientServices(t, record.client_id);
  return c.html(<WorkRecordModal record={record} client={null} clients={[]} services={services} back={back} />);
});

// ---------- mutace ----------

function parseInput(body: Record<string, unknown>): Omit<WorkRecordInput, 'clientId' | 'serviceId'> & { serviceId: string } | null {
  const serviceId = String(body.service_id ?? '');
  const description = String(body.description ?? '').trim();
  const hours = Number(String(body.hours ?? '0').trim() || 0);
  const mins = Number(String(body.mins ?? '0').trim() || 0);
  const minutes = Math.round(hours * 60 + mins);
  const performedAt = String(body.performed_at ?? '');
  const rawBilling = String(body.billing ?? '');
  if (!serviceId || !description || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedAt)) return null;
  return {
    serviceId,
    description,
    note: String(body.note ?? '').trim() || null,
    minutes,
    performedAt,
    billing: isBilling(rawBilling) ? rawBilling : 'retainer_hours',
  };
}

const safeBack = (v: unknown): string => {
  const s = String(v ?? '');
  return s.startsWith('/') ? s : '/vykazy';
};

vykazyRoutes.post('/vykazy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody();
  const back = safeBack(body.back);

  const clientId = String(body.client_id ?? '');
  const client = clientId ? await getClient(t, clientId) : null;
  const input = parseInput(body as Record<string, unknown>);
  if (!client || !input) return c.redirect(back);

  const services = await listClientServices(t, client.id);
  const svc = services.find((s) => s.id === input.serviceId && s.status !== 'ended');
  if (!svc) return c.redirect(back);

  const id = await createWorkRecord(t, person.id, { ...input, clientId: client.id });
  // kdo by výkaz stejně schvaloval (odpovědná osoba / admin), má ho rovnou schválený
  const autoApprove = canApproveFor(person, client.owner_id ?? null);
  if (autoApprove) await approveWorkRecord(t, id, person.id);
  await logEvent(
    t,
    'client',
    client.id,
    person.id,
    `Vykázána práce: ${input.description} (${svc.label}${svc.detail ? ` · ${svc.detail}` : ''}, ${fmtMinutes(input.minutes)}, ${BILLING_LABELS[input.billing]}${autoApprove ? ', schváleno' : ''}) #${id.slice(0, 8)}`,
  );
  return c.redirect(back);
});

vykazyRoutes.post('/vykazy/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (!canEditRecord(person, record)) return c.redirect(back);

  const input = parseInput(body as Record<string, unknown>);
  if (!input) return c.redirect(back);
  const services = await listClientServices(t, record.client_id);
  if (!services.some((s) => s.id === input.serviceId)) return c.redirect(back);

  await updateWorkRecord(t, record.id, input);
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} upraven: ${input.description} (${fmtMinutes(input.minutes)}, ${BILLING_LABELS[input.billing]})`);
  return c.redirect(back);
});

vykazyRoutes.post('/vykazy/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (!canEditRecord(person, record)) return c.redirect(back);

  await deleteWorkRecord(t, record.id);
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} smazán (${record.description}, ${fmtMinutes(record.minutes)})`);
  return c.redirect(back);
});

vykazyRoutes.post('/vykazy/:id/schvalit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);

  const client = await getClient(t, record.client_id);
  if (record.status !== 'pending' || !canApproveFor(person, client?.owner_id ?? null)) return c.redirect(back);

  await approveWorkRecord(t, record.id, person.id);
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} schválen (${record.description}, ${fmtMinutes(record.minutes)})`);
  return c.redirect(back);
});
