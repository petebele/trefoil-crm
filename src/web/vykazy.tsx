import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { ModalShell, EmptyState, KebabMenu } from './components';
import { IconCheckPlain, IconChevronLeft, IconChevronRight } from './icons';
import { flash } from './flash';
import { logEvent } from '../domain/events';
import { notify, notifyPendingApproval } from '../domain/notifications';
import { createApprovalTask, closeSourceTasks, getTask } from '../domain/tasks';
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
  returnWorkRecord,
  rejectWorkRecord,
  resubmitWorkRecord,
  monthKey,
  shiftMonth,
  monthLabel,
  fmtMinutes,
  type WorkRecord,
  type WorkRecordInput,
} from '../domain/workRecords';
import type { PersonsTable } from '../db/schema';
import { tr, fmtDate, fmtNum, currency } from '../i18n';

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
  // autor smí upravovat, dokud výkaz čeká nebo byl vrácen k přepracování (ne schválený, ne zamítnutý); admin vždy
  return person.is_admin === 1 || (r.worker_id === person.id && (r.status === 'pending' || r.status === 'returned'));
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
  task?: { id: string; title: string } | null; // „Vykázat práci" z úkolu (vazba + předvyplnění)
  canEdit?: boolean; // smí měnit pole + uložit (autor čekajícího / admin); default true
  canApprove?: boolean; // je schvalovatel → ukáže sekci rozhodnutí
}) {
  const r = props.record;
  const editable = props.canEdit !== false; // pole jdou měnit; u čistého schvalovatele jsou jen ke čtení
  const showDecision = !!r && !!props.canApprove && r.status === 'pending';
  const isReturned = !!r && r.status === 'returned';
  const isRejected = !!r && r.status === 'rejected';
  const today = new Date().toISOString().slice(0, 10);
  const running = props.services.filter((s) => s.status !== 'ended');
  // z úkolu a zákazník má jedinou běžící službu → předvyplň ji
  const autoServiceId = props.preselectServiceId ?? (props.task && running.length === 1 ? running[0]!.id : undefined);
  const preselected = running.find((s) => s.id === autoServiceId);
  const billingDefault = r?.billing ?? (preselected ? defaultBilling(preselected.mode) : 'retainer_hours');
  return (
    <ModalShell title={r ? `${tr('Upravit výkaz')} · ${r.client_name}` : tr('Vykázat práci')}>
      <form method="post" action={r ? `/vykazy/${r.id}` : '/vykazy'}>
        <input type="hidden" name="back" value={props.back} />
        {r ? null : props.client ? (
          <input type="hidden" name="client_id" value={props.client.id} />
        ) : null}
        {!r && props.task ? <input type="hidden" name="task_id" value={props.task.id} /> : null}
        {!r && props.task ? (
          <p class="sub" style="margin:0 0 .4rem">{tr('Úkol')}: <b>{props.task.title}</b></p>
        ) : null}
        {r ? (
          <p class="sub" style="margin:0 0 .8rem">
            {tr('Zákazník')}: <b>{r.client_name}</b> · {tr('pracoval(a) {name}', { name: r.worker_name })}
            {r.task_title ? <> · {tr('úkol')}: {r.task_title}</> : null}
          </p>
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
              hx-vals={JSON.stringify(props.task ? { back: props.back, ukol: props.task.id } : { back: props.back })}
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
        {isReturned ? (
          <div style="background:var(--chip-orange-bg);border:1px solid var(--chip-orange-ink);border-radius:8px;padding:.6rem .75rem;margin:0 0 1rem">
            <p style="margin:0;font-weight:600;color:var(--chip-orange-ink)">{tr('Výkaz byl vrácen k přepracování')}</p>
            {r!.rejection_reason ? <p style="margin:.35rem 0 0">{tr('Instrukce')}: {r!.rejection_reason}</p> : null}
            {editable ? <p class="sub" style="margin:.35rem 0 0">{tr('Uprav výkaz a ulož — znovu se odešle ke schválení.')}</p> : null}
          </div>
        ) : null}
        {isRejected ? (
          <div style="background:var(--red-soft);border:1px solid var(--red);border-radius:8px;padding:.6rem .75rem;margin:0 0 1rem">
            <p style="margin:0;font-weight:600;color:var(--red)">{tr('Výkaz byl zamítnut')}</p>
            {r!.rejection_reason ? <p style="margin:.35rem 0 0">{tr('Důvod zamítnutí')}: {r!.rejection_reason}</p> : null}
          </div>
        ) : null}
        {showDecision ? (
          <div style="background:var(--teal-soft);border:1px solid var(--teal);border-radius:8px;padding:.6rem .75rem;margin:0 0 1rem">
            <p style="margin:0 0 .5rem;font-weight:600;color:var(--teal-ink)">{tr('Tento výkaz čeká na tvé schválení')}</p>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
              {/* schválení uloží i aktuální stav formuláře (manažer může před schválením doladit) */}
              <button class="btn btn-success-solid" type="submit" formaction={editable ? `/vykazy/${r!.id}/ulozit-schvalit` : `/vykazy/${r!.id}/schvalit`} formmethod="post">
                {editable ? tr('Uložit a schválit') : tr('Schválit')}
              </button>
              <button class="btn" type="button" data-reveal={`ret-${r!.id}`} aria-controls={`ret-${r!.id}`}>
                {tr('Vrátit k přepracování')}
              </button>
              <button class="btn btn-danger" type="button" data-reveal={`rej-${r!.id}`} aria-controls={`rej-${r!.id}`}>
                {tr('Zamítnout')}
              </button>
            </div>
            {/* Vrátit k přepracování → instrukce; výkaz se vrátí pracovníkovi k opravě (v původní podobě) */}
            <div id={`ret-${r!.id}`} class="hidden" style="margin-top:.6rem">
              <label style="display:block;font-size:.8rem;margin-bottom:.25rem">
                {tr('Instrukce')} <span class="sub">({tr('uvidí je pracovník')})</span>
              </label>
              <textarea class="input" name="instructions" rows={2} placeholder={tr('Co je potřeba opravit?')}></textarea>
              <div style="margin-top:.45rem">
                <button class="btn btn-primary" type="submit" formaction={`/vykazy/${r!.id}/vratit`} formmethod="post">
                  {tr('Vrátit k přepracování')}
                </button>
              </div>
            </div>
            {/* Zamítnout → důvod; výkaz zůstane (zamítnuto), do času ani peněz nevstupuje */}
            <div id={`rej-${r!.id}`} class="hidden" style="margin-top:.6rem">
              <label style="display:block;font-size:.8rem;margin-bottom:.25rem">
                {tr('Důvod zamítnutí')} <span class="sub">({tr('uvidí ho pracovník')})</span>
              </label>
              <textarea class="input" name="reason" rows={2} placeholder={tr('Proč výkaz zamítáš?')}></textarea>
              <div style="margin-top:.45rem">
                <button class="btn btn-danger-solid" type="submit" formaction={`/vykazy/${r!.id}/zamitnout`} formmethod="post">
                  {tr('Zamítnout výkaz')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {r || props.client ? (
          <>
            <fieldset disabled={!editable} style="border:none;padding:0;margin:0;min-width:0">
            <div class="field">
              <label>{tr('Služba')} <span class="req">*</span></label>
              {/* data-set-billing = výchozí účtování dle režimu služby (app.js) */}
              <select class="input" name="service_id" required data-defaults>
                <option value="">{tr('— vyberte službu —')}</option>
                {running.map((s) => (
                  <option
                    value={s.id}
                    selected={(r ? r.service_id : autoServiceId) === s.id}
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
              <label>
                {tr('Popis úkonu')} <span class="req">*</span>{' '}
                <span class="sub" style="font-weight:400">({tr('zobrazí se jako titulek u výkazu')})</span>
              </label>
              <input class="input" name="description" value={r?.description ?? ''} required />
            </div>
            <div class="field">
              <label>{tr('Detaily úkonu / Poznámka')}</label>
              <textarea class="input" name="note" rows={2}>{r?.note ?? ''}</textarea>
            </div>
            <div class="field">
              <label>{tr('Čas')} <span class="req">*</span></label>
              <div style="display:flex;gap:.5rem;align-items:center">
                <input class="input" type="number" name="hours" min="0" max="24" step="1" value={r ? Math.floor(r.minutes / 60) : ''} style="max-width:6rem" aria-label={tr('Hodiny')} />
                <span class="sub">{tr('h')}</span>
                <input class="input" type="number" name="mins" min="0" max="59" step="1" value={r ? r.minutes % 60 : ''} style="max-width:6rem" aria-label={tr('Minuty')} />
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
            </fieldset>
            <div class="form-actions">
              {editable && !showDecision ? <button class="btn btn-primary" type="submit">{isReturned ? tr('Uložit a znovu odeslat') : r ? tr('Uložit změny') : tr('Vykázat')}</button> : null}
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

export function WorkRecordRow(props: { r: WorkRecord; person: PersonsTable; ownerId: string | null; back: string; showClient?: boolean; showAmount?: boolean }) {
  const { r, person, back } = props;
  const amount = r.billing === 'free' ? null : Math.round((r.minutes / 60) * (r.service_rate ?? 0));
  const canApprove = r.status === 'pending' && canApproveFor(person, props.ownerId);
  const canEdit = canEditRecord(person, r);
  const openable = canEdit || canApprove; // přístup do modálu má i schvalovatel (rozhodnutí), nejen autor
  return (
    <div class="hover-row" style="padding:.5rem 0;border-top:1px solid var(--line);font-size:.86rem">
      {/* datum · popis + meta + badges (pod textem, lícují s popisem) · čas + částka · schválit + ⋯ */}
      <div style="display:flex;gap:.7rem;align-items:flex-start">
        <span class="sub" style="white-space:nowrap">{fmtDay(r.performed_at)}</span>
        <div style="flex:1;min-width:0">
          {openable ? (
            <span
              role="button"
              tabindex={0}
              data-activate
              style="font-weight:600;cursor:pointer"
              hx-get={`/vykazy/${r.id}/modal?back=${encodeURIComponent(back)}`}
              hx-target="#modal"
              hx-swap="innerHTML"
              title={canApprove ? tr('Zkontrolovat') : canEdit ? tr('Upravit výkaz') : tr('Otevřít výkaz')}
            >
              {r.description}
            </span>
          ) : (
            <span style="font-weight:600">{r.description}</span>
          )}
          <span class="sub" style="display:block">
            {props.showClient ? <>{r.client_name} · </> : null}
            {r.service_label}
            {r.service_detail ? ` · ${r.service_detail}` : ''} · {r.worker_name}
            {r.note ? <span style="display:block;font-size:.78rem">{r.note}</span> : null}
          </span>
          {r.status === 'returned' && r.rejection_reason ? (
            <span class="sub" style="display:block;color:var(--chip-orange-ink)">{tr('Instrukce')}: {r.rejection_reason}</span>
          ) : r.status === 'rejected' && r.rejection_reason ? (
            <span class="sub" style="display:block;color:var(--red)">{tr('Důvod zamítnutí')}: {r.rejection_reason}</span>
          ) : null}
          {/* badges — způsob účtování, stav, (úkol). Projekt: chip se ukáže, AŽ bude výkaz na projekt navázaný (modul Projekty) — „bez projektu" se nezobrazuje. */}
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;margin-top:.3rem">
            <span class={`chip ${r.billing === 'retainer_hours' ? 'chip-soft-teal' : r.billing === 'billed' ? 'chip-soft-orange' : 'chip-soft-gray'}`}>
              {tr(BILLING_LABELS[r.billing])}
            </span>
            {r.status === 'pending' ? (
              <span class="chip chip-soft-gray">{tr('Čeká')}</span>
            ) : r.status === 'returned' ? (
              <span class="chip chip-soft-orange">{tr('Vráceno k přepracování')}</span>
            ) : r.status === 'rejected' ? (
              <span class="chip chip-soft-red">{tr('Zamítnuto')}</span>
            ) : (
              <span class="chip chip-soft-teal" title={r.approved_by_name ? tr('Schválil(a) {name}', { name: r.approved_by_name }) : ''}>{tr('Schváleno')}</span>
            )}
            {r.task_title ? <span class="chip chip-soft-gray">{tr('úkol')}: {r.task_title}</span> : null}
          </div>
        </div>
        {props.showAmount && amount !== null ? (
          <span style="font-weight:600;white-space:nowrap">{fmtNum(amount)} {currency()}</span>
        ) : props.showAmount ? (
          <span class="sub" style="white-space:nowrap">{tr('neúčtováno')}</span>
        ) : null}
        <span style="font-weight:600;white-space:nowrap">{fmtMinutes(r.minutes)}</span>
        {/* primární akce „Schválit" = vždy viditelná fajfka před menu */}
        {canApprove ? (
          <form method="post" action={`/vykazy/${r.id}/schvalit`} class="m0" style="display:inline-flex">
            <input type="hidden" name="back" value={back} />
            <button class="icon-btn icon-btn--ok" type="submit" title={tr('Schválit')} aria-label={tr('Schválit výkaz')}>
              <IconCheckPlain />
            </button>
          </form>
        ) : null}
        {canEdit ? (
          <span class="row-actions">
            <KebabMenu id={`wkRow-${r.id}`} label={tr('Možnosti výkazu')}>
              <button class="opt" type="button" hx-get={`/vykazy/${r.id}/modal?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
                {canApprove ? tr('Zkontrolovat') : tr('Upravit')}
              </button>
              {/* mazat smí jen administrátor (princip „nic se nemaže"); ostatní řeší stavem (vrácení k přepracování) */}
              {person.is_admin === 1 ? (
                <form method="post" action={`/vykazy/${r.id}/smazat`} class="m0" onsubmit={`return confirm('${tr('Smazat tento výkaz?')}')`}>
                  <input type="hidden" name="back" value={back} />
                  <button class="opt" type="submit" style="color:var(--red)">{tr('Smazat')}</button>
                </form>
              ) : null}
            </KebabMenu>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Řádek výkazu pro manažerský Inbox „Vyžaduje moji pozornost" — víc kontextu pro ROZHODNUTÍ
 * (co se dělalo · kdy · kolik · poznámka pracovníka). Jméno vykonavatele a zákazník jsou
 * v záhlaví skupiny, tady se neopakují. Akce Zkontrolovat + Schválit jsou rovnou viditelné.
 */
export function ApprovalRow(props: { r: WorkRecord; person: PersonsTable; ownerId: string | null; back: string }) {
  const { r, person, back } = props;
  const canApprove = r.status === 'pending' && canApproveFor(person, props.ownerId);
  return (
    <div class="hover-row" style="display:flex;gap:.7rem;align-items:flex-start;padding:.5rem 0;border-top:1px solid var(--line);font-size:.86rem">
      <div style="flex:1;min-width:0">
        <span
          role="button"
          tabindex={0}
          data-activate
          style="font-weight:600;cursor:pointer"
          hx-get={`/vykazy/${r.id}/modal?back=${encodeURIComponent(back)}`}
          hx-target="#modal"
          hx-swap="innerHTML"
          title={tr('Zkontrolovat')}
        >
          {r.description}
        </span>
        <span class="sub" style="display:block">
          {r.service_label}
          {r.service_detail ? ` · ${r.service_detail}` : ''} · {fmtDay(r.performed_at)} · {fmtMinutes(r.minutes)}
        </span>
        {r.note ? <span class="sub" style="display:block;font-style:italic">„{r.note}"</span> : null}
        <div style="margin-top:.3rem">
          <span class={`chip ${r.billing === 'retainer_hours' ? 'chip-soft-teal' : r.billing === 'billed' ? 'chip-soft-orange' : 'chip-soft-gray'}`}>
            {tr(BILLING_LABELS[r.billing])}
          </span>
        </div>
      </div>
      {canApprove ? (
        <div style="display:flex;gap:.3rem;align-items:center;white-space:nowrap">
          <button class="btn btn-sm" type="button" hx-get={`/vykazy/${r.id}/modal?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
            {tr('Zkontrolovat')}
          </button>
          <form method="post" action={`/vykazy/${r.id}/schvalit`} class="m0" style="display:inline-flex">
            <input type="hidden" name="back" value={back} />
            <button class="btn btn-sm btn-success-solid" type="submit">{tr('Schválit')}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** Přepínač měsíce — šipky jako ikonová tlačítka, název měsíce mezi nimi. */
export function MonthNav(props: { month: string; hrefFor: (m: string) => string }) {
  return (
    <span style="display:inline-flex;align-items:center;gap:.15rem;border:1px solid var(--line);border-radius:999px;padding:.1rem .35rem;background:var(--card)">
      <a class="icon-btn" style="text-decoration:none" href={props.hrefFor(shiftMonth(props.month, -1))} aria-label={tr('Předchozí měsíc')}><IconChevronLeft /></a>
      <span style="min-width:8.5rem;text-align:center;text-transform:capitalize;font-weight:600;font-size:.85rem">{monthLabel(props.month)}</span>
      <a class="icon-btn" style="text-decoration:none" href={props.hrefFor(shiftMonth(props.month, 1))} aria-label={tr('Další měsíc')}><IconChevronRight /></a>
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

  // Filtry (odkazovatelné přes URL): stav výkazu (tab „muj") a vykonavatel (tab „schvalovani", jen admin)
  const STAV_KEYS = ['pending', 'approved', 'returned', 'rejected'] as const;
  const stav = (STAV_KEYS as readonly string[]).includes(c.req.query('stav') ?? '') ? c.req.query('stav')! : '';
  const kdo = (isAdmin && c.req.query('kdo')) || '';

  const [mineAll, pendingAll, overview] = await Promise.all([
    tab === 'muj' ? listForWorkerMonth(t, person.id, month) : Promise.resolve([]),
    tab === 'schvalovani' ? listPendingForApprover(t, person.id, isAdmin) : Promise.resolve([]),
    tab === 'prehled' && isAdmin ? overviewByWorker(t, month) : Promise.resolve([]),
  ]);
  const mine = stav ? mineAll.filter((r) => r.status === stav) : mineAll;
  const pending = kdo ? pendingAll.filter((r) => r.worker_id === kdo) : pendingAll;
  // sestavení URL se zachováním aktivních filtrů (filtr-pilulky i MonthNav i živá zóna)
  const buildUrl = (over: Record<string, string>) => {
    const p = new URLSearchParams({ tab, mesic: month });
    if (stav) p.set('stav', stav);
    if (kdo) p.set('kdo', kdo);
    for (const [k, v] of Object.entries(over)) v === '' ? p.delete(k) : p.set(k, v);
    return `/vykazy?${p.toString()}`;
  };
  const back = buildUrl({});
  const hrefFor = (m: string) => buildUrl({ mesic: m });
  const myTotal = mine.reduce((s, r) => s + r.minutes, 0);
  // odlišní vykonavatelé v čekajících (pro pilulky filtru na tabu Schvalování)
  const pendingWorkers = [...new Map(pendingAll.map((r) => [r.worker_id, r.worker_name])).entries()];

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
            <div class="fpill-row">
              <a class={`fpill ${!stav ? 'active' : ''}`} href={buildUrl({ stav: '' })}>{tr('Vše')}</a>
              <a class={`fpill ${stav === 'pending' ? 'active' : ''}`} href={buildUrl({ stav: 'pending' })}>{tr('Čeká')}</a>
              <a class={`fpill ${stav === 'approved' ? 'active' : ''}`} href={buildUrl({ stav: 'approved' })}>{tr('Schváleno')}</a>
              <a class={`fpill ${stav === 'returned' ? 'active' : ''}`} href={buildUrl({ stav: 'returned' })}>{tr('Vráceno')}</a>
              <a class={`fpill ${stav === 'rejected' ? 'active' : ''}`} href={buildUrl({ stav: 'rejected' })}>{tr('Zamítnuto')}</a>
            </div>
            {mineAll.length === 0 ? (
              <EmptyState text={tr('Zatím jsi v tomto měsíci nevykázal žádnou práci.')} />
            ) : mine.length === 0 ? (
              <EmptyState text={tr('Žádné výkazy neodpovídají filtru.')} />
            ) : (
              <div>{mine.map((r) => <WorkRecordRow r={r} person={person} ownerId={null} back={back} showClient />)}</div>
            )}
          </div>
        ) : null}

        {tab === 'schvalovani' ? (
          <div class="card">
            <div class="card-head"><h3>{tr('Čeká na schválení')}</h3></div>
            {isAdmin && pendingWorkers.length > 1 ? (
              <div class="fpill-row">
                <a class={`fpill ${!kdo ? 'active' : ''}`} href={buildUrl({ kdo: '' })}>{tr('Všichni')}</a>
                {pendingWorkers.map(([id, name]) => (
                  <a class={`fpill ${kdo === id ? 'active' : ''}`} href={buildUrl({ kdo: id })}>{name}</a>
                ))}
              </div>
            ) : null}
            {pendingAll.length === 0 ? (
              <EmptyState text={tr('Nic nečeká na schválení. 🎉')} />
            ) : pending.length === 0 ? (
              <EmptyState text={tr('Žádné výkazy neodpovídají filtru.')} />
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

  // kontext: „Vykázat práci" z úkolu → vazba na úkol + zákazník z úkolu
  const taskId = c.req.query('ukol') || '';
  const task = taskId ? await getTask(t, taskId) : null;
  if (task?.client_id) clientId = task.client_id;

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
      task={task ? { id: task.id, title: task.title } : null}
    />,
  );
});

vykazyRoutes.get('/vykazy/:id/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const client = await getClient(t, record.client_id);
  const canEdit = canEditRecord(person, record);
  const canApprove = record.status === 'pending' && canApproveFor(person, client?.owner_id ?? null);
  if (!canEdit && !canApprove) return c.redirect('/vykazy'); // ani autor/admin, ani schvalovatel
  const back = c.req.query('back') || '/vykazy';
  const services = await listClientServices(t, record.client_id);
  return c.html(<WorkRecordModal record={record} client={null} clients={[]} services={services} back={back} canEdit={canEdit} canApprove={canApprove} />);
});

// ---------- mutace ----------

function parseInput(body: Record<string, unknown>): Omit<WorkRecordInput, 'clientId' | 'serviceId' | 'taskId'> & { serviceId: string } | null {
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

  // volitelná vazba na úkol (jen existující úkol tohoto tenanta)
  const rawTaskId = String(body.task_id ?? '');
  const taskId = rawTaskId && (await getTask(t, rawTaskId)) ? rawTaskId : null;

  const id = await createWorkRecord(t, person.id, { ...input, clientId: client.id, taskId });
  // kdo by výkaz stejně schvaloval (odpovědná osoba / admin), má ho rovnou schválený
  const autoApprove = canApproveFor(person, client.owner_id ?? null);
  if (autoApprove) {
    await approveWorkRecord(t, id, person.id);
  } else {
    if (c.get('modules').has('ukoly')) {
      // auto‑úkol „schválit výkaz" pro odpovědnou osobu zákazníka
      await createApprovalTask(t, {
        clientId: client.id,
        assigneeId: client.owner_id ?? null,
        recordId: id,
        title: `${tr('Schválit výkaz')}: ${input.description} (${fmtMinutes(input.minutes)})`,
        createdById: person.id,
      });
    }
    // upozorni schvalovatele (vlastník klienta + admini), že přibyl výkaz ke schválení
    await notifyPendingApproval(t, {
      clientOwnerId: client.owner_id ?? null,
      actorId: person.id,
      body: `${input.description} (${fmtMinutes(input.minutes)})`,
      entityId: id,
      link: '/vykazy?tab=schvalovani',
    });
  }
  await logEvent(
    t,
    'client',
    client.id,
    person.id,
    `Vykázána práce: ${input.description} (${svc.label}${svc.detail ? ` · ${svc.detail}` : ''}, ${fmtMinutes(input.minutes)}, ${BILLING_LABELS[input.billing]}${autoApprove ? ', schváleno' : ''}) #${id.slice(0, 8)}`,
  );
  flash(c, autoApprove ? tr('Práce byla vykázána a schválena.') : tr('Práce byla vykázána.'));
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

  if (record.status === 'returned') {
    // úprava vráceného výkazu = znovuodeslání ke schválení (auto‑schválení, pokud editor sám schvaluje)
    const client = await getClient(t, record.client_id);
    if (canApproveFor(person, client?.owner_id ?? null)) {
      await approveWorkRecord(t, record.id, person.id);
      await closeSourceTasks(t, 'work_record', record.id);
      await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} upraven a schválen: ${input.description} (${fmtMinutes(input.minutes)})`);
      flash(c, tr('Výkaz byl uložen a schválen.'));
    } else {
      await resubmitWorkRecord(t, record.id);
      if (c.get('modules').has('ukoly') && client) {
        await createApprovalTask(t, {
          clientId: client.id,
          assigneeId: client.owner_id ?? null,
          recordId: record.id,
          title: `${tr('Schválit výkaz')}: ${input.description} (${fmtMinutes(input.minutes)})`,
          createdById: person.id,
        });
      }
      await notifyPendingApproval(t, {
        clientOwnerId: client?.owner_id ?? null,
        actorId: person.id,
        body: `${input.description} (${fmtMinutes(input.minutes)})`,
        entityId: record.id,
        link: '/vykazy?tab=schvalovani',
      });
      await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} opraven a znovu odeslán ke schválení: ${input.description} (${fmtMinutes(input.minutes)})`);
      flash(c, tr('Výkaz byl upraven a znovu odeslán ke schválení.'));
    }
  } else {
    await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} upraven: ${input.description} (${fmtMinutes(input.minutes)}, ${BILLING_LABELS[input.billing]})`);
    flash(c, tr('Výkaz byl upraven.'));
  }
  return c.redirect(back);
});

vykazyRoutes.post('/vykazy/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  if (person.is_admin !== 1) return c.redirect(back); // mazat smí jen administrátor (princip „nic se nemaže")

  await deleteWorkRecord(t, record.id);
  await closeSourceTasks(t, 'work_record', record.id); // uzavři auto‑úkol „schválit výkaz"
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} smazán (${record.description}, ${fmtMinutes(record.minutes)})`);
  flash(c, tr('Výkaz byl smazán.'));
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
  await closeSourceTasks(t, 'work_record', record.id); // uzavři auto‑úkol „schválit výkaz"
  await notify(t, {
    recipientId: record.worker_id,
    actorId: person.id,
    type: 'work_record_approved',
    title: 'Výkaz byl schválen',
    body: `${record.description} (${fmtMinutes(record.minutes)})`,
    entityKind: 'work_record',
    entityId: record.id,
    link: '/vykazy?tab=muj&stav=approved',
  });
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} schválen (${record.description}, ${fmtMinutes(record.minutes)})`);
  flash(c, tr('Výkaz byl schválen.'));
  return c.redirect(back);
});

vykazyRoutes.post('/vykazy/:id/zamitnout', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);

  const client = await getClient(t, record.client_id);
  if (record.status !== 'pending' || !canApproveFor(person, client?.owner_id ?? null)) return c.redirect(back);

  const reason = String(body.reason ?? '').trim() || null;
  await rejectWorkRecord(t, record.id, reason);
  await closeSourceTasks(t, 'work_record', record.id); // schvalovatel rozhodl → auto‑úkol „schválit výkaz" zavřít
  await notify(t, {
    recipientId: record.worker_id,
    actorId: person.id,
    type: 'work_record_rejected',
    title: 'Výkaz byl zamítnut',
    body: reason ? `${record.description} — ${reason}` : record.description,
    entityKind: 'work_record',
    entityId: record.id,
    link: '/vykazy?tab=muj&stav=rejected',
  });
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} zamítnut${reason ? `: ${reason}` : ''} (${record.description}, ${fmtMinutes(record.minutes)})`);
  flash(c, tr('Výkaz byl zamítnut.'));
  return c.redirect(back);
});

// Vrátit k přepracování: výkaz se vrátí pracovníkovi s instrukcemi; ten ho opraví a znovu pošle.
vykazyRoutes.post('/vykazy/:id/vratit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);

  const client = await getClient(t, record.client_id);
  if (record.status !== 'pending' || !canApproveFor(person, client?.owner_id ?? null)) return c.redirect(back);

  const instructions = String(body.instructions ?? '').trim() || null;
  await returnWorkRecord(t, record.id, instructions);
  await closeSourceTasks(t, 'work_record', record.id); // schvalovatel rozhodl → auto‑úkol „schválit výkaz" zavřít
  await notify(t, {
    recipientId: record.worker_id,
    actorId: person.id,
    type: 'work_record_returned',
    title: 'Výkaz byl vrácen k přepracování',
    body: instructions ? `${record.description} — ${instructions}` : record.description,
    entityKind: 'work_record',
    entityId: record.id,
    link: '/vykazy?tab=muj&stav=returned',
  });
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} vrácen k přepracování${instructions ? `: ${instructions}` : ''} (${record.description}, ${fmtMinutes(record.minutes)})`);
  flash(c, tr('Výkaz byl vrácen k přepracování.'));
  return c.redirect(back);
});

// „Uložit a schválit" z review‑modálu: schvalovatel uloží aktuální stav formuláře a rovnou schválí.
vykazyRoutes.post('/vykazy/:id/ulozit-schvalit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const record = await getWorkRecord(t, c.req.param('id'));
  if (!record) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);

  const client = await getClient(t, record.client_id);
  if (record.status !== 'pending' || !canApproveFor(person, client?.owner_id ?? null)) return c.redirect(back);

  // uložit úpravy z formuláře (jsou‑li platné a služba sedí); pak schválit
  const input = parseInput(body as Record<string, unknown>);
  let edited = false;
  if (input) {
    const services = await listClientServices(t, record.client_id);
    if (services.some((s) => s.id === input.serviceId)) {
      await updateWorkRecord(t, record.id, input);
      edited = true;
    }
  }
  await approveWorkRecord(t, record.id, person.id);
  await closeSourceTasks(t, 'work_record', record.id);
  const what = edited && input ? `${input.description} (${fmtMinutes(input.minutes)})` : `${record.description} (${fmtMinutes(record.minutes)})`;
  await notify(t, {
    recipientId: record.worker_id,
    actorId: person.id,
    type: 'work_record_approved',
    title: 'Výkaz byl schválen',
    body: what,
    entityKind: 'work_record',
    entityId: record.id,
    link: '/vykazy?tab=muj&stav=approved',
  });
  await logEvent(t, 'client', record.client_id, person.id, `Výkaz #${record.id.slice(0, 8)} schválen${edited ? ' (s úpravou)' : ''}: ${what}`);
  flash(c, edited ? tr('Výkaz byl uložen a schválen.') : tr('Výkaz byl schválen.'));
  return c.redirect(back);
});
