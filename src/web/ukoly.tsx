import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Child } from 'hono/jsx';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { ModalShell, EmptyState, KebabMenu, Picker } from './components';
import { IconPlus, IconX } from './icons';
import { flash } from './flash';
import { notify } from '../domain/notifications';
import { logEvent } from '../domain/events';
import { listCoworkers } from '../domain/people';
import { listClients } from '../domain/clients';
import { itemsByKey, type EntityTag } from '../domain/lists';
import {
  listTasks,
  tasksForClient,
  getTask,
  createTask,
  updateTask,
  setTaskDone,
  removeTask,
  listBoardTasks,
  listOwnerActiveTasks,
  setTaskBoardMonth,
  setTaskStatus,
  setColumnOrder,
  archiveTask,
  closeMonth,
  monthKey,
  type TaskRow,
} from '../domain/tasks';
import {
  ensureStatuses,
  getStatus,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  setStatusDone,
  doneStatusId,
  defaultStatusId,
} from '../domain/taskStatuses';
import { listForTask, fmtMinutes, type WorkRecord } from '../domain/workRecords';
import { canEditRecord } from './vykazy';
import { getPref, setPref } from '../domain/prefs';
import type { PersonsTable, TaskStatusesTable } from '../db/schema';
import { tr, fmtDate } from '../i18n';

export const ukolyRoutes = new Hono<AppEnv>();

const requireModule: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  if (!c.get('modules').has('ukoly')) return c.redirect('/');
  await next();
};
ukolyRoutes.use('/ukoly', requireModule);
ukolyRoutes.use('/ukoly/*', requireModule);

// ---------- datové pomůcky (buckety podle termínu) ----------

export const todayStr = (): string => new Date().toISOString().slice(0, 10);
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done';
export function bucketOf(due: string | null, today = todayStr()): Bucket {
  if (!due) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due <= addDays(today, 7)) return 'week';
  return 'later';
}
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Po termínu',
  today: 'Dnes',
  week: 'Tento týden',
  later: 'Později',
  none: 'Bez termínu',
  done: 'Hotové',
};

const safeBack = (v: unknown, fallback = '/ukoly'): string => {
  const s = String(v ?? '');
  return s.startsWith('/') ? s : fallback;
};

// ---------- sdílené komponenty (používá i Nástěnka a detail zákazníka) ----------

const CAT_COLORS = new Set(['teal', 'pink', 'red', 'orange', 'indigo']);

/** Barevný chip štítku úkolu (plná barva, bílý text). */
export function CatChip(props: { label: string; color: string | null }) {
  const cls = props.color && CAT_COLORS.has(props.color) ? `cat-${props.color}` : 'cat-indigo';
  return <span class={`cat ${cls}`} style="margin-right:.4rem">{props.label}</span>;
}

/** Štítky úkolu (může jich být víc) — řada barevných chipů. */
export function TaskLabels(props: { labels: EntityTag[] }) {
  return <>{props.labels.map((l) => <CatChip label={l.label} color={l.color} />)}</>;
}

/** Jeden řádek úkolu: zaškrtnutí (hotovo) · kategorie · text · zákazník · termín · ⋯. */
export function TaskItemRow(props: { t: TaskRow; person: PersonsTable; back: string; target: string; showClient?: boolean; canVykaz?: boolean }) {
  const { t, person, back, target } = props;
  const canEdit = person.is_admin === 1 || t.assignee_id === person.id || t.created_by_id === person.id;
  const overdue = !!t.due_at && t.done !== 1 && t.due_at < todayStr();
  const metaParts: Child[] = [];
  if (props.showClient && t.client_name) metaParts.push(<a href={`/firmy/${t.client_id}`}>{t.client_name}</a>);
  if (t.due_at) metaParts.push(<span style={overdue ? 'color:var(--red);font-weight:600' : ''}>{fmtDate(t.due_at)}</span>);
  if (t.assignee_name) metaParts.push(<span>{t.assignee_name}</span>);
  return (
    <div class="task-item">
      <input
        type="checkbox"
        checked={t.done === 1}
        aria-label={tr('Hotovo')}
        hx-post={`/ukoly/${t.id}/hotovo`}
        hx-vals={JSON.stringify({ done: t.done === 1 ? 0 : 1, back })}
        hx-trigger="change"
        hx-target={target}
        hx-select={target}
        hx-swap="outerHTML"
      />
      <div class="task-txt" style="flex:1">
        <TaskLabels labels={t.labels} />
        {canEdit ? (
          <span
            role="button"
            tabindex={0}
            data-activate
            style="cursor:pointer"
            hx-get={`/ukoly/${t.id}/modal?back=${encodeURIComponent(back)}`}
            hx-target="#modal"
            hx-swap="innerHTML"
            title={tr('Upravit úkol')}
          >
            {t.title}
          </span>
        ) : (
          <span>{t.title}</span>
        )}
        {metaParts.length ? (
          <span class="when">
            {metaParts.map((m, i) => (
              <>
                {i > 0 ? ' · ' : ''}
                {m}
              </>
            ))}
          </span>
        ) : null}
      </div>
      {canEdit ? (
        <span class="row-actions">
          <KebabMenu id={`tMenu-${t.id}`} label={tr('Možnosti úkolu')}>
            <button class="opt" type="button" hx-get={`/ukoly/${t.id}/modal?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
              {tr('Upravit')}
            </button>
            {props.canVykaz ? (
              <button class="opt" type="button" hx-get={`/vykazy/modal/novy?ukol=${t.id}&back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
                {tr('Vykázat práci')}
              </button>
            ) : null}
            <button
              class="opt"
              type="button"
              style="color:var(--red)"
              hx-post={`/ukoly/${t.id}/smazat`}
              hx-vals={JSON.stringify({ back })}
              hx-confirm={tr('Smazat tento úkol?')}
              hx-target={target}
              hx-select={target}
              hx-swap="outerHTML"
            >
              {tr('Smazat')}
            </button>
          </KebabMenu>
        </span>
      ) : null}
    </div>
  );
}

/** Skupiny otevřených úkolů podle termínu (Po termínu / Dnes / …). `buckets` = které sekce. */
export function TaskGroups(props: {
  tasks: TaskRow[];
  person: PersonsTable;
  back: string;
  target: string;
  showClient?: boolean;
  buckets?: Bucket[];
  emptyText: string;
  canVykaz?: boolean;
}) {
  const order = props.buckets ?? (['overdue', 'today', 'week', 'later', 'none', 'done'] as Bucket[]);
  const today = todayStr();
  const groups = order
    .map((b) => ({ b, rows: props.tasks.filter((t) => (t.done === 1 ? 'done' : bucketOf(t.due_at, today)) === b) }))
    .filter((g) => g.rows.length > 0);
  if (groups.length === 0) return <EmptyState text={props.emptyText} />;
  return (
    <>
      {groups.map((g) => (
        <>
          <div class={`task-group ${g.b === 'overdue' ? 'overdue' : ''}`}>
            {g.b === 'overdue' ? '● ' : ''}
            {tr(BUCKET_LABEL[g.b])}
          </div>
          {g.rows.map((t) => (
            <TaskItemRow t={t} person={props.person} back={props.back} target={props.target} showClient={props.showClient} canVykaz={props.canVykaz} />
          ))}
        </>
      ))}
    </>
  );
}

// ---------- velký modál (nový / úprava úkolu) ----------

function TaskModal(props: {
  task: TaskRow | null;
  clients: Array<{ id: string; name: string }>;
  coworkers: Array<{ id: string; name: string }>;
  labels: EntityTag[]; // dostupné štítky (Seznam task_labels)
  person: PersonsTable;
  back: string;
  presetClientId?: string;
  presetStatusId?: string;
  presetMonth?: string;
  presetTitle?: string;
  sourceKind?: string;
  sourceId?: string;
  canVykaz?: boolean;
  workRecords?: WorkRecord[];
}) {
  const t = props.task;
  const selClient = t?.client_id ?? props.presetClientId ?? '';
  const selAssignee = t?.assignee_id ?? props.person.id;
  const selLabels = new Set((t?.labels ?? []).map((l) => l.id));
  const wr = props.workRecords ?? [];
  const wrTotal = wr.reduce((s, w) => s + w.minutes, 0);
  return (
    <ModalShell title={t ? tr('Upravit úkol') : tr('Nový úkol')}>
      <form method="post" action={t ? `/ukoly/${t.id}` : '/ukoly'}>
        <input type="hidden" name="back" value={props.back} />
        {!t && props.presetStatusId ? <input type="hidden" name="status_id" value={props.presetStatusId} /> : null}
        {!t && props.presetMonth ? <input type="hidden" name="board_month" value={props.presetMonth} /> : null}
        {!t && props.sourceKind ? <input type="hidden" name="source_kind" value={props.sourceKind} /> : null}
        {!t && props.sourceId ? <input type="hidden" name="source_id" value={props.sourceId} /> : null}
        <div class="field">
          <label>{tr('Co je potřeba udělat')} <span class="req">*</span></label>
          <input class="input" name="title" value={t?.title ?? props.presetTitle ?? ''} required autofocus />
        </div>
        <div class="field">
          <label>{tr('Štítky')}</label>
          {props.labels.length === 0 ? (
            <span class="help">{tr('Štítky se spravují v Administraci → Seznamy.')}</span>
          ) : (
            <div class="label-picker">
              {props.labels.map((l) => {
                const on = selLabels.has(l.id);
                const cls = l.color && CAT_COLORS.has(l.color) ? `cat-${l.color}` : 'cat-indigo';
                return (
                  <label class={`chip-toggle ${cls} ${on ? 'is-on' : ''}`}>
                    <input type="checkbox" name="label_ids" value={l.id} checked={on} />
                    {l.label}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field">
            <label>{tr('Termín')}</label>
            <input class="input" type="date" name="due_at" value={t?.due_at ?? ''} />
          </div>
          <div class="field">
            <label>{tr('Zákazník')}</label>
            <select class="input" name="client_id">
              <option value="">{tr('— bez zákazníka —')}</option>
              {props.clients.map((cl) => (
                <option value={cl.id} selected={cl.id === selClient}>{cl.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div class="field">
          <label>{tr('Přiřazeno')}</label>
          <select class="input" name="assignee_id">
            <option value="">{tr('— nikdo —')}</option>
            {props.coworkers.map((u) => (
              <option value={u.id} selected={u.id === selAssignee}>{u.name}</option>
            ))}
          </select>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{t ? tr('Uložit změny') : tr('Vytvořit úkol')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
      {t ? (
        <div style="margin-top:1rem;border-top:1px solid var(--line);padding-top:.8rem">
          <div class="card-head" style="margin-bottom:.3rem">
            <h4 style="margin:0">{tr('Vykázaná práce')}{wr.length ? <> · <b>{fmtMinutes(wrTotal)}</b></> : null}</h4>
            {props.canVykaz ? (
              <button class="btn btn-sm" type="button" hx-get={`/vykazy/modal/novy?ukol=${t.id}&back=${encodeURIComponent(props.back)}`} hx-target="#modal" hx-swap="innerHTML">
                {tr('Vykázat práci')}
              </button>
            ) : null}
          </div>
          {wr.length === 0 ? (
            <p class="sub" style="margin:.2rem 0 0">{props.canVykaz ? tr('Zatím nevykázána žádná práce.') : tr('Zatím nevykázána žádná práce. Zapni modul Výkazy.')}</p>
          ) : (
            <div>
              {wr.map((w) => {
                const base = 'display:flex;gap:.5rem;align-items:baseline;padding:.3rem 0;border-top:1px solid var(--line);font-size:.84rem';
                const cells = (
                  <>
                    <span class="sub" style="white-space:nowrap">{fmtDate(w.performed_at)}</span>
                    <span style="flex:1">{w.description}</span>
                    <span class="sub" style="white-space:nowrap">{w.worker_name}</span>
                    <b style="white-space:nowrap">{fmtMinutes(w.minutes)}</b>
                  </>
                );
                return canEditRecord(props.person, w) ? (
                  <div
                    class="hover-row"
                    role="button"
                    tabindex={0}
                    data-activate
                    style={`${base};cursor:pointer`}
                    hx-get={`/vykazy/${w.id}/modal?back=${encodeURIComponent(props.back)}`}
                    hx-target="#modal"
                    hx-swap="innerHTML"
                    title={tr('Upravit výkaz')}
                  >
                    {cells}
                  </div>
                ) : (
                  <div style={base}>{cells}</div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </ModalShell>
  );
}

// ---------- KANBAN (Úkoly v2) ----------

function shiftMonth(m: string, d: number): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y!, mo! - 1 + d, 1)).toISOString().slice(0, 7);
}
const CS_MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
function monthLabelCs(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${CS_MONTHS[mo! - 1]} ${y}`;
}
function colorVar(color: string | null): string {
  if (!color) return 'var(--muted)';
  const map: Record<string, string> = { teal: 'var(--teal)', pink: 'var(--pink)', red: 'var(--red)', orange: 'var(--orange)', indigo: 'var(--accent)', gray: 'var(--muted)' };
  return map[color] ?? color; // token → var(); jinak přímá barva (hex z palety)
}

export interface BoardParams {
  ownerId: string;
  month: string; // vždy konkrétní měsíc (YYYY-MM)
  showArchived: boolean;
}
function readBoardParams(c: { req: { query: (k: string) => string | undefined } }, person: PersonsTable): BoardParams {
  const isAdmin = person.is_admin === 1;
  const qOwner = c.req.query('owner') || '';
  const ownerId = isAdmin && qOwner ? qOwner : person.id;
  const rawM = c.req.query('mesic') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawM) ? rawM : monthKey();
  return { ownerId, month, showArchived: c.req.query('archiv') === '1' };
}
/** URL fragmentu boardu (pro htmx swapy #board). */
function boardUrl(p: BoardParams, meId: string, over: { archived?: boolean } = {}): string {
  const qs = [`mesic=${p.month}`];
  if (p.ownerId !== meId) qs.unshift(`owner=${p.ownerId}`);
  if (over.archived ?? p.showArchived) qs.push('archiv=1');
  return `/ukoly/board?${qs.join('&')}`;
}
/** URL celé kanban stránky (pro modály / plné překreslení). */
function pageUrl(p: BoardParams, meId: string): string {
  const qs = ['view=kanban', `mesic=${p.month}`];
  if (p.ownerId !== meId) qs.splice(1, 0, `owner=${p.ownerId}`);
  return `/ukoly?${qs.join('&')}`;
}
function effColumn(t: TaskRow, statuses: TaskStatusesTable[]): string | null {
  if (t.status_id && statuses.some((s) => s.id === t.status_id)) return t.status_id;
  // nezařazené: hotové → done-stav (jinak Inbox), ostatní → Inbox/Zásobník
  return t.done === 1 ? doneStatusId(statuses) ?? defaultStatusId(statuses) : defaultStatusId(statuses);
}

interface KUrls { board: string; boardArch: string; page: string; pageArch: string; q: string; mesic: string }

function KanbanCard(props: { t: TaskRow; person: PersonsTable; urls: KUrls; color?: string | null; canVykaz?: boolean }) {
  const { t, person, urls } = props;
  const canEdit = person.is_admin === 1 || t.assignee_id === person.id || t.created_by_id === person.id;
  const overdue = !!t.due_at && t.done !== 1 && t.due_at < todayStr();
  const hasMeta = t.labels.length > 0 || t.client_name || t.due_at;
  return (
    <div class="kcard" draggable={canEdit ? 'true' : undefined} data-task-id={t.id} style={`border-left:3px solid ${colorVar(props.color ?? null)}`}>
      <div class="kcard-top">
        <input
          type="checkbox"
          checked={t.done === 1}
          aria-label={tr('Hotovo')}
          style={`accent-color:${colorVar(props.color ?? null)}`}
          hx-post={`/ukoly/${t.id}/hotovo`}
          hx-vals={JSON.stringify({ done: t.done === 1 ? 0 : 1, back: urls.board })}
          hx-trigger="change"
          hx-target="#board"
          hx-swap="outerHTML"
        />
        {canEdit ? (
          <span
            class="kcard-title"
            role="button"
            tabindex={0}
            data-activate
            style="cursor:pointer"
            hx-get={`/ukoly/${t.id}/modal?back=${encodeURIComponent(urls.page)}`}
            hx-target="#modal"
            hx-swap="innerHTML"
            title={tr('Upravit úkol')}
          >
            {t.title}
          </span>
        ) : (
          <span class="kcard-title">{t.title}</span>
        )}
        {canEdit ? (
          <span class="row-actions" style="opacity:1">
            <KebabMenu id={`kc-${t.id}`} label={tr('Možnosti úkolu')}>
              <button class="opt" type="button" hx-get={`/ukoly/${t.id}/modal?back=${encodeURIComponent(urls.page)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Upravit')}</button>
              {props.canVykaz ? (
                <button class="opt" type="button" hx-get={`/vykazy/modal/novy?ukol=${t.id}&back=${encodeURIComponent(urls.page)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Vykázat práci')}</button>
              ) : null}
              <button class="opt" type="button" hx-post={`/ukoly/${t.id}/archiv`} hx-vals={JSON.stringify({ archived: t.archived === 1 ? 0 : 1, back: urls.board })} hx-target="#board" hx-swap="outerHTML">{t.archived === 1 ? tr('Obnovit') : tr('Archivovat')}</button>
              <button class="opt" type="button" style="color:var(--red)" hx-post={`/ukoly/${t.id}/smazat`} hx-vals={JSON.stringify({ back: urls.board })} hx-confirm={tr('Smazat tento úkol?')} hx-target="#board" hx-swap="outerHTML">{tr('Smazat')}</button>
            </KebabMenu>
          </span>
        ) : null}
      </div>
      {hasMeta ? (
        <div class="kcard-meta">
          <TaskLabels labels={t.labels} />
          {t.client_name ? <a href={`/firmy/${t.client_id}`}>{t.client_name}</a> : null}
          {t.due_at ? <span style={overdue ? 'color:var(--red);font-weight:600' : 'color:var(--muted)'}>{fmtDate(t.due_at)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// 12 přednastavených barev sloupců (vlastní barva = do budoucna)
const COL_COLORS = ['#64748b', '#0aa789', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

/**
 * Položka menu „Stav vyřízeného úkolu" jako přepínač (switch): popisek vlevo, přepínač vpravo.
 * Překresluje JEN sebe (hx-target="this") — menu po přepnutí zůstává otevřené, ať je vidět, že
 * se přepnulo; zavře ho až klik mimo. Sloupcové chování (řazení do „hotovo") drží server.
 */
function DoneToggleItem(props: { status: TaskStatusesTable; q: string }) {
  const on = props.status.is_done === 1;
  return (
    <button
      class="opt opt-switch"
      type="button"
      role="menuitemcheckbox"
      aria-checked={on ? 'true' : 'false'}
      data-keep-open
      hx-post={`/ukoly/kanban/sloupce/${props.status.id}/dokonceni${props.q}`}
      hx-target="this"
      hx-swap="outerHTML"
    >
      <span>{tr('Stav vyřízeného úkolu')}</span>
      <span class="switch" aria-hidden="true"></span>
    </button>
  );
}

/** Tělo boardu (sekce #board): sloupce = stavy (první = povinný Inbox); správa sloupců na boardu. */
export function KanbanBoard(props: {
  statuses: TaskStatusesTable[];
  active: TaskRow[];
  archived: TaskRow[];
  month: string;
  inboxId: string | null;
  person: PersonsTable;
  urls: KUrls;
  showArchived: boolean;
  owner: string;
  canVykaz?: boolean;
}) {
  const { statuses, active, archived, month, inboxId, person, urls } = props;
  if (props.showArchived) {
    return (
      <section id="board" hx-get={urls.boardArch} hx-trigger="live-update from:body" hx-target="this" hx-swap="outerHTML" hx-disinherit="*">
        <div class="card">
          <div class="card-head">
            <h3>{tr('Archivované úkoly')}</h3>
            <a class="btn btn-sm" href={urls.page}>{tr('← zpět na board')}</a>
          </div>
          {archived.length === 0 ? (
            <EmptyState text={tr('Žádné archivované úkoly.')} />
          ) : (
            archived.map((t) => (
              <div class="task-item">
                <div class="task-txt" style="flex:1">
                  <TaskLabels labels={t.labels} />
                  <span style="color:var(--muted)">{t.title}</span>
                  {t.client_name ? <span class="when"><a href={`/firmy/${t.client_id}`}>{t.client_name}</a></span> : null}
                </div>
                <button class="btn btn-sm" type="button" hx-post={`/ukoly/${t.id}/archiv`} hx-vals={JSON.stringify({ archived: 0, back: urls.boardArch })} hx-target="#board" hx-swap="outerHTML">{tr('Obnovit')}</button>
                <button class="icon-btn icon-btn--danger" type="button" hx-post={`/ukoly/${t.id}/smazat`} hx-vals={JSON.stringify({ back: urls.boardArch })} hx-confirm={tr('Smazat tento úkol?')} hx-target="#board" hx-swap="outerHTML" aria-label={tr('Smazat')}><IconX /></button>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }
  const canManage = person.is_admin === 1 || props.owner === person.id;
  return (
    <section id="board" class="kanban" hx-get={urls.board} hx-trigger="live-update from:body" hx-target="this" hx-swap="outerHTML" hx-disinherit="*">
      {statuses.map((s) => {
        const isInbox = s.id === inboxId;
        // Inbox je cross‑month (nové + nezařazené), ostatní sloupce ukazují jen vybraný měsíc
        const cards = active.filter((t) => effColumn(t, statuses) === s.id && (isInbox || t.board_month === month));
        const addUrl = isInbox
          ? `/ukoly/modal/novy?status=${s.id}&mesic=none&back=${encodeURIComponent(urls.page)}`
          : `/ukoly/modal/novy?status=${s.id}&mesic=${month}&back=${encodeURIComponent(urls.page)}`;
        return (
          <div class={`kcol ${isInbox ? 'kcol-inbox' : ''}`}>
            <div class="kcol-head">
              <span class="kcol-dot" style={`background:${colorVar(s.color)}`}></span>
              <span
                class={`kcol-name ${canManage ? 'kcol-drag' : ''}`}
                draggable={canManage ? 'true' : undefined}
                data-col-id={canManage ? s.id : undefined}
                title={canManage ? tr('Přetáhnout sloupec') : undefined}
              >
                {s.label}
              </span>
              <span class="kcol-count">{cards.length}</span>
              {canManage ? (
                <KebabMenu id={`col-${s.id}`} label={tr('Možnosti sloupce')}>
                  <form hx-post={`/ukoly/kanban/sloupce/${s.id}/nazev${urls.q}`} hx-target="#board" hx-swap="outerHTML" class="m0" style="padding:.2rem .4rem .35rem">
                    <input class="input" name="label" value={s.label} required aria-label={tr('Název stavu')} placeholder={tr('Název stavu')} autocomplete="off" />
                  </form>
                  <div class="opt-group">{tr('Barva')}</div>
                  <div class="kcol-swatches">
                    {COL_COLORS.map((co) => (
                      <button type="button" class={`kcol-swatch ${s.color === co ? 'sel' : ''}`} style={`background:${colorVar(co)}`} aria-label={tr('Barva')} hx-post={`/ukoly/kanban/sloupce/${s.id}/barva${urls.q}`} hx-vals={JSON.stringify({ color: co })} hx-target="#board" hx-swap="outerHTML"></button>
                    ))}
                  </div>
                  <DoneToggleItem status={s} q={urls.q} />
                  {isInbox ? (
                    <div class="opt" style="color:var(--muted);cursor:default;font-style:italic;white-space:normal;display:block;line-height:1.35;max-width:230px" aria-disabled="true">{tr('Toto je výchozí sloupec a nelze ho smazat. Sem budou přistávat nové úkoly vytvořené jinde.')}</div>
                  ) : (
                    <button class="opt" type="button" style="color:var(--red)" hx-post={`/ukoly/kanban/sloupce/${s.id}/smazat${urls.q}`} hx-confirm={tr('Smazat sloupec? Úkoly se přesunou do Inboxu.')} hx-target="#board" hx-swap="outerHTML">{tr('Smazat sloupec')}</button>
                  )}
                </KebabMenu>
              ) : null}
              <button class="icon-btn" type="button" hx-get={addUrl} hx-target="#modal" hx-swap="innerHTML" aria-label={tr('Přidat úkol')} title={tr('Přidat úkol')}><IconPlus /></button>
            </div>
            <div class="kcol-body" data-status-id={s.id} data-inbox={isInbox ? '1' : undefined}>
              {cards.map((t) => <KanbanCard t={t} person={person} urls={urls} color={s.color} canVykaz={props.canVykaz} />)}
            </div>
            {s.is_done === 1 && archived.length > 0 ? (
              <a class="kcol-archive" href={urls.pageArch}>{tr('Archivované úkoly')} ({archived.length})</a>
            ) : null}
          </div>
        );
      })}

      {canManage ? (
        <form class="kcol kcol-add" hx-post={`/ukoly/kanban/sloupce${urls.q}`} hx-target="#board" hx-swap="outerHTML">
          <input type="hidden" name="owner" value={props.owner} />
          <input class="input" name="label" placeholder={tr('+ Sloupec')} aria-label={tr('Nový sloupec')} autocomplete="off" />
        </form>
      ) : null}
    </section>
  );
}

/** Přepínač pohledu Agenda | Kanban. */
function ViewSwitch(props: { view: 'agenda' | 'kanban' }) {
  return (
    <nav class="tabs" aria-label={tr('Pohled')} style="margin-bottom:.2rem">
      <a class={`tab ${props.view === 'agenda' ? 'active' : ''}`} href="/ukoly?view=agenda">{tr('Agenda')}</a>
      <a class={`tab ${props.view === 'kanban' ? 'active' : ''}`} href="/ukoly?view=kanban">{tr('Kanban')}</a>
    </nav>
  );
}

async function buildBoard(tenantId: string, person: PersonsTable, bp: BoardParams) {
  const statuses = await ensureStatuses(tenantId, bp.ownerId);
  const active = await listOwnerActiveTasks(tenantId, bp.ownerId); // všechny měsíce (Inbox je cross‑month)
  const archived = await listBoardTasks(tenantId, bp.ownerId, { month: bp.month, archived: 'archived' });
  const q = '?' + (boardUrl(bp, person.id).split('?')[1] ?? '');
  const page = pageUrl(bp, person.id);
  const pageNoArch = page.replace(/&archiv=1\b/, '');
  const urls: KUrls = {
    board: boardUrl(bp, person.id),
    boardArch: boardUrl(bp, person.id, { archived: true }),
    page: pageNoArch,
    pageArch: pageNoArch + '&archiv=1',
    q,
    mesic: bp.month ?? monthKey(),
  };
  return { statuses, active, archived, month: bp.month ?? monthKey(), inboxId: defaultStatusId(statuses), urls };
}
async function boardFragment(c: {
  get: { (k: 'person'): PersonsTable | null; (k: 'modules'): Set<string> };
  req: { query: (k: string) => string | undefined };
  html: (x: unknown) => Response | Promise<Response>;
}) {
  const person = c.get('person')!;
  const bp = readBoardParams(c, person);
  const b = await buildBoard(person.tenant_id, person, bp);
  const canVykaz = c.get('modules').has('vykazy');
  return c.html(<KanbanBoard statuses={b.statuses} active={b.active} archived={b.archived} month={b.month} inboxId={b.inboxId} person={person} urls={b.urls} showArchived={bp.showArchived} owner={bp.ownerId} canVykaz={canVykaz} />);
}

/** Modál „Uzavřít měsíc" — přesun nehotových dál + volitelně archivace hotových. */
function CloseMonthModal(props: { bp: BoardParams; back: string }) {
  const m = props.bp.month!;
  return (
    <ModalShell title={`${tr('Uzavřít měsíc')} · ${monthLabelCs(m)}`}>
      <form method="post" action="/ukoly/kanban/uzavrit">
        <input type="hidden" name="back" value={props.back} />
        <input type="hidden" name="owner" value={props.bp.ownerId} />
        <input type="hidden" name="mesic" value={m} />
        <p class="sub" style="margin:0 0 .8rem">{tr('Nehotové úkoly se přesunou do dalšího měsíce (stav zůstává), hotové zůstanou v historii.')}</p>
        <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem">
          <input type="checkbox" name="archive_done" value="1" checked /> {tr('Archivovat hotové úkoly tohoto měsíce')}
        </label>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Uzavřít měsíc')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- stránka /ukoly ----------

/** Klíč per‑uživatelské předvolby zvoleného zobrazení modulu Úkoly. */
const UKOLY_VIEW_KEY = 'ukoly.view';

const FILTERS = [
  { key: 'vse', label: 'Vše' },
  { key: 'po_terminu', label: 'Po termínu' },
  { key: 'dnes', label: 'Dnes' },
  { key: 'tyden', label: 'Tento týden' },
  { key: 'hotove', label: 'Hotové' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

ukolyRoutes.get('/ukoly', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const isAdmin = person.is_admin === 1;

  // Zvolené zobrazení (Agenda/Kanban) si pamatujeme per uživatel (klíč 'ukoly.view').
  // Bez ?view (např. z horní navigace) přistaneme tam, kde uživatel naposledy byl.
  const storedView = await getPref(t, person.id, UKOLY_VIEW_KEY);
  const rawView = c.req.query('view');
  const view: 'agenda' | 'kanban' = rawView === 'kanban' || rawView === 'agenda' ? rawView : storedView === 'kanban' ? 'kanban' : 'agenda';
  if ((rawView === 'kanban' || rawView === 'agenda') && rawView !== storedView) {
    await setPref(t, person.id, UKOLY_VIEW_KEY, view); // ulož jen při skutečné změně
  }

  // === KANBAN pohled ===
  if (view === 'kanban') {
    const bp = readBoardParams(c, person);
    const b = await buildBoard(t, person, bp);
    const coworkers = isAdmin ? await listCoworkers(t) : [];
    const ownerName = bp.ownerId === person.id ? person.name : coworkers.find((u) => u.id === bp.ownerId)?.name ?? person.name;
    const ownerQ = bp.ownerId !== person.id ? `&owner=${bp.ownerId}` : '';
    const ph = (m: string) => `/ukoly?view=kanban${ownerQ}&mesic=${m}`;
    const mq = bp.month;
    return c.html(
      <Layout title={tr('Úkoly')} person={person} modules={c.get('modules')} active="ukoly">
        <div class="page-head">
          <h1>{tr('Úkoly')}</h1>
          <button class="btn btn-primary" type="button" hx-get={`/ukoly/modal/novy?mesic=none&status=${defaultStatusId(b.statuses) ?? ''}&back=${encodeURIComponent(b.urls.page)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Přidat úkol')}</button>
        </div>
        <ViewSwitch view="kanban" />
        <div class="kbar">
          <span class="monthnav">
            <a class="icon-btn" href={ph(shiftMonth(mq, -1))} aria-label={tr('Předchozí měsíc')}>‹</a>
            <span class="mlabel">{monthLabelCs(mq)}</span>
            <a class="icon-btn" href={ph(shiftMonth(mq, 1))} aria-label={tr('Další měsíc')}>›</a>
          </span>
          {mq !== monthKey() ? <a class="fpill" href={ph(monthKey())}>{tr('Tento měsíc')}</a> : null}
          {isAdmin ? (
            <Picker id="boardOwner" trigger={<>{ownerName} ▾</>} triggerClass="btn btn-sm">
              <a class="opt" href={`/ukoly?view=kanban&mesic=${mq}`}>{person.name} ({tr('moje')})</a>
              {coworkers.filter((u) => u.id !== person.id).map((u) => (
                <a class="opt" href={`/ukoly?view=kanban&owner=${u.id}&mesic=${mq}`}>{u.name}</a>
              ))}
            </Picker>
          ) : null}
          <span style="margin-left:auto">
            <button class="btn btn-sm" type="button" hx-get={`/ukoly/kanban/uzavrit/modal?mesic=${mq}&owner=${bp.ownerId}&back=${encodeURIComponent(b.urls.page)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Uzavřít měsíc')}</button>
          </span>
        </div>
        <KanbanBoard statuses={b.statuses} active={b.active} archived={b.archived} month={b.month} inboxId={b.inboxId} person={person} urls={b.urls} showArchived={bp.showArchived} owner={bp.ownerId} canVykaz={c.get('modules').has('vykazy')} />
      </Layout>,
    );
  }

  const rawFilter = c.req.query('filtr') ?? 'vse';
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : 'vse';
  const scope = isAdmin && c.req.query('tym') === '1' ? 'team' : 'mine';
  const canVykaz = c.get('modules').has('vykazy');
  const stitek = c.req.query('stitek') || ''; // filtr podle štítku (list_items.id)
  const labels = await itemsByKey(t, 'task_labels');

  const allTasks = await listTasks(t, {
    assigneeId: scope === 'mine' ? person.id : undefined,
    includeDone: filter === 'hotove' || filter === 'vse',
  });
  const tasks = stitek ? allTasks.filter((tk) => tk.labels.some((l) => l.id === stitek)) : allTasks;
  const teamSfx = scope === 'team' ? '&tym=1' : '';
  const stitekSfx = stitek ? `&stitek=${stitek}` : '';
  const back = `/ukoly?filtr=${filter}${teamSfx}${stitekSfx}`;
  const hrefFor = (f: FilterKey) => `/ukoly?filtr=${f}${teamSfx}${stitekSfx}`;
  const labelHref = (id: string) => `/ukoly?filtr=${filter}${teamSfx}${id ? `&stitek=${id}` : ''}`;

  // filtr na konkrétní bucket (Po termínu / Dnes / Tento týden)
  const buckets: Bucket[] | undefined =
    filter === 'po_terminu' ? ['overdue'] : filter === 'dnes' ? ['today'] : filter === 'tyden' ? ['overdue', 'today', 'week'] : undefined;

  return c.html(
    <Layout title={tr('Úkoly')} person={person} modules={c.get('modules')} active="ukoly">
      <div class="page-head">
        <h1>{tr('Úkoly')}</h1>
        <button class="btn btn-primary" type="button" hx-get={`/ukoly/modal/novy?back=${encodeURIComponent(back)}`} hx-target="#modal" hx-swap="innerHTML">
          {tr('Přidat úkol')}
        </button>
      </div>

      <ViewSwitch view="agenda" />

      <nav class="tabs" aria-label={tr('Filtr úkolů')}>
        {FILTERS.map((f) => (
          <a class={`tab ${filter === f.key ? 'active' : ''}`} href={hrefFor(f.key)}>{tr(f.label)}</a>
        ))}
      </nav>

      {isAdmin ? (
        <div class="frow" style="margin-top:.6rem">
          <a class={`fpill ${scope === 'mine' ? 'active' : ''}`} href={`/ukoly?filtr=${filter}${stitekSfx}`}>{tr('Moje')}</a>
          <a class={`fpill ${scope === 'team' ? 'active' : ''}`} href={`/ukoly?filtr=${filter}&tym=1${stitekSfx}`}>{tr('Tým')}</a>
        </div>
      ) : null}

      {labels.length ? (
        <div class="fpill-row" style="margin-top:.6rem">
          <a class={`fpill ${!stitek ? 'active' : ''}`} href={labelHref('')}>{tr('Všechny štítky')}</a>
          {labels.map((l) => (
            <a class={`fpill ${stitek === l.id ? 'active' : ''}`} href={labelHref(l.id)}>{l.label}</a>
          ))}
        </div>
      ) : null}

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
        <div class="card">
          {filter === 'hotove' ? (
            (() => {
              const done = tasks.filter((tk) => tk.done === 1);
              return done.length === 0 ? (
                <EmptyState text={tr('Žádné hotové úkoly.')} />
              ) : (
                <div>{done.map((tk) => <TaskItemRow t={tk} person={person} back={back} target="#stred" showClient canVykaz={canVykaz} />)}</div>
              );
            })()
          ) : (
            <TaskGroups
              tasks={tasks}
              person={person}
              back={back}
              target="#stred"
              showClient
              buckets={buckets}
              emptyText={scope === 'team' ? tr('Tým nemá žádné otevřené úkoly. 🎉') : tr('Nemáš žádné otevřené úkoly. 🎉')}
              canVykaz={canVykaz}
            />
          )}
        </div>
      </section>
    </Layout>,
  );
});

// ---------- modály ----------

ukolyRoutes.get('/ukoly/modal/novy', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  let presetClientId = c.req.query('klient') || '';
  // kontext z detailu zákazníka (htmx posílá aktuální URL)
  const currentUrl = c.req.header('HX-Current-URL') ?? '';
  if (!presetClientId) {
    const m = /\/firmy\/([0-9a-fA-F-]{8,})/.exec(currentUrl);
    if (m) presetClientId = m[1]!;
  }
  const [clients, coworkers, labels] = await Promise.all([listClients(t), listCoworkers(t), itemsByKey(t, 'task_labels')]);
  return c.html(
    <TaskModal task={null} clients={clients} coworkers={coworkers} labels={labels} person={person} back={safeBack(c.req.query('back'))} presetClientId={presetClientId} presetStatusId={c.req.query('status') || undefined} presetMonth={c.req.query('mesic') || undefined} presetTitle={c.req.query('nazev') || undefined} sourceKind={c.req.query('source_kind') || undefined} sourceId={c.req.query('source_id') || undefined} />,
  );
});

ukolyRoutes.get('/ukoly/:id/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const canVykaz = c.get('modules').has('vykazy');
  const [clients, coworkers, labels, workRecords] = await Promise.all([
    listClients(t),
    listCoworkers(t),
    itemsByKey(t, 'task_labels'),
    canVykaz ? listForTask(t, task.id) : Promise.resolve([]),
  ]);
  return c.html(<TaskModal task={task} clients={clients} coworkers={coworkers} labels={labels} person={person} back={safeBack(c.req.query('back'))} canVykaz={canVykaz} workRecords={workRecords} />);
});

// ---------- mutace ----------

function parseTaskInput(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim();
  if (!title) return null;
  const due = String(body.due_at ?? '').trim();
  const bm = String(body.board_month ?? '');
  const rawLabels = body.label_ids;
  const labelIds = (Array.isArray(rawLabels) ? rawLabels : rawLabels != null && rawLabels !== '' ? [rawLabels] : []).map(String);
  return {
    title,
    labelIds,
    clientId: String(body.client_id ?? '').trim() || null,
    assigneeId: String(body.assignee_id ?? '').trim() || null,
    dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    boardMonth: bm === 'none' ? null : /^\d{4}-(0[1-9]|1[0-2])$/.test(bm) ? bm : undefined,
    statusId: String(body.status_id ?? '').trim() || null,
    sourceKind: String(body.source_kind ?? '').trim() || null,
    sourceId: String(body.source_id ?? '').trim() || null,
  };
}

ukolyRoutes.post('/ukoly', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody({ all: true });
  const back = safeBack(body.back);
  const input = parseTaskInput(body as Record<string, unknown>);
  if (!input) return c.redirect(back);
  const id = await createTask(t, person.id, input);
  if (input.statusId) await setTaskStatus(t, id, input.statusId); // sync done dle is_done sloupce
  if (input.clientId) await logEvent(t, 'client', input.clientId, person.id, `Úkol přidán: ${input.title}`);
  if (input.assigneeId && input.assigneeId !== person.id) {
    await notify(t, {
      recipientId: input.assigneeId,
      actorId: person.id,
      type: 'task_assigned',
      title: 'Byl ti přidělen úkol',
      body: input.title,
      entityKind: 'task',
      entityId: id,
      link: '/ukoly',
    });
  }
  flash(c, tr('Úkol byl vytvořen.'));
  return c.redirect(back);
});

ukolyRoutes.post('/ukoly/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody({ all: true });
  const back = safeBack(body.back);
  const canEdit = person.is_admin === 1 || task.assignee_id === person.id || task.created_by_id === person.id;
  if (!canEdit) return c.redirect(back);
  const input = parseTaskInput(body as Record<string, unknown>);
  if (!input) return c.redirect(back);
  await updateTask(t, task.id, input);
  // nově přiřazený řešitel (jiný než dosud a jiný než já) → upozornit
  if (input.assigneeId && input.assigneeId !== person.id && input.assigneeId !== task.assignee_id) {
    await notify(t, {
      recipientId: input.assigneeId,
      actorId: person.id,
      type: 'task_assigned',
      title: 'Byl ti přidělen úkol',
      body: input.title,
      entityKind: 'task',
      entityId: task.id,
      link: '/ukoly',
    });
  }
  flash(c, tr('Úkol byl uložen.'));
  return c.redirect(back);
});

ukolyRoutes.post('/ukoly/:id/hotovo', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  await setTaskDone(t, task.id, String(body.done ?? '') === '1');
  return c.redirect(back);
});

ukolyRoutes.post('/ukoly/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  const canEdit = person.is_admin === 1 || task.assignee_id === person.id || task.created_by_id === person.id;
  if (canEdit) {
    await removeTask(t, task.id);
    flash(c, tr('Úkol byl smazán.'));
  }
  return c.redirect(back);
});

// ---------- KANBAN routy ----------

/** Fragment boardu (#board) — pro htmx swapy (drag‑drop, checkbox, archiv, správa sloupců, live‑update). */
ukolyRoutes.get('/ukoly/board', (c) => boardFragment(c));

ukolyRoutes.get('/ukoly/kanban/uzavrit/modal', async (c) => {
  const person = c.get('person')!;
  const bp = readBoardParams(c, person);
  return c.html(<CloseMonthModal bp={bp} back={safeBack(c.req.query('back'), '/ukoly?view=kanban')} />);
});

/** Přesun karty (drag‑drop): stav + zařazení do měsíce/Inboxu + pořadí. Vrací fragment boardu. */
ukolyRoutes.post('/ukoly/:id/presun', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody();
  const bp = readBoardParams(c, person);
  const canEdit = person.is_admin === 1 || task.assignee_id === person.id || task.created_by_id === person.id;
  const statusId = String(body.status_id ?? '');
  const toInbox = String(body.inbox ?? '') === '1';
  const order = String(body.order ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const target = statusId ? await getStatus(t, statusId) : null;
  if (canEdit && target) {
    await setTaskStatus(t, task.id, statusId);
    await setTaskBoardMonth(t, task.id, toInbox ? null : bp.month); // Inbox = nezařazené; jinak naplánuj do měsíce
    if (order.length) await setColumnOrder(t, statusId, order);
  }
  return boardFragment(c);
});

ukolyRoutes.post('/ukoly/:id/archiv', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back, '/ukoly?view=kanban');
  const canEdit = person.is_admin === 1 || task.assignee_id === person.id || task.created_by_id === person.id;
  if (canEdit) await archiveTask(t, task.id, String(body.archived ?? '') === '1');
  return c.redirect(back);
});

ukolyRoutes.post('/ukoly/kanban/uzavrit', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody();
  const back = safeBack(body.back, '/ukoly?view=kanban');
  const owner = person.is_admin === 1 && body.owner ? String(body.owner) : person.id;
  const month = String(body.mesic ?? '');
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    await closeMonth(t, owner, month, String(body.archive_done ?? '') === '1');
  }
  return c.redirect(back);
});

// --- správa sloupců (stavů) přímo na boardu; vše vrací fragment #board ---
function canEditStatus(person: PersonsTable, status: { owner_id: string }): boolean {
  return person.is_admin === 1 || status.owner_id === person.id;
}

ukolyRoutes.post('/ukoly/kanban/sloupce', async (c) => {
  const person = c.get('person')!;
  const body = await c.req.parseBody();
  const owner = person.is_admin === 1 && body.owner ? String(body.owner) : person.id;
  await createStatus(person.tenant_id, owner, String(body.label ?? ''));
  return boardFragment(c);
});

ukolyRoutes.post('/ukoly/kanban/sloupce/poradi', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody();
  const ids = String(body.order ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const first = ids[0] ? await getStatus(t, ids[0]) : null;
  if (first && canEditStatus(person, first)) await reorderStatuses(t, first.owner_id, ids);
  return boardFragment(c);
});

ukolyRoutes.post('/ukoly/kanban/sloupce/:id/nazev', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const status = await getStatus(t, c.req.param('id'));
  const body = await c.req.parseBody();
  const label = String(body.label ?? '').trim();
  if (status && canEditStatus(person, status) && label) await updateStatus(t, status.id, { label }); // prázdný název ignoruj
  return boardFragment(c);
});

ukolyRoutes.post('/ukoly/kanban/sloupce/:id/barva', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const status = await getStatus(t, c.req.param('id'));
  const body = await c.req.parseBody();
  if (status && canEditStatus(person, status)) await updateStatus(t, status.id, { color: String(body.color ?? '') || null });
  return boardFragment(c);
});

ukolyRoutes.post('/ukoly/kanban/sloupce/:id/dokonceni', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const id = c.req.param('id');
  const status = await getStatus(t, id);
  if (!status) return c.notFound();
  if (canEditStatus(person, status)) await setStatusDone(t, status.owner_id, status.id, status.is_done !== 1);
  // vrať JEN přepnutý prvek (ne celý board) → menu zůstane otevřené a přepínač se viditelně přepne
  const updated = (await getStatus(t, id)) ?? status;
  return c.html(<DoneToggleItem status={updated} q={new URL(c.req.url).search} />);
});

ukolyRoutes.post('/ukoly/kanban/sloupce/:id/smazat', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const status = await getStatus(t, c.req.param('id'));
  if (status && canEditStatus(person, status)) await deleteStatus(t, status.owner_id, status.id);
  return boardFragment(c);
});

// re-export pro Nástěnku a detail zákazníka
export { tasksForClient };
