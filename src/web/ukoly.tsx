import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Child } from 'hono/jsx';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { ModalShell, EmptyState, KebabMenu } from './components';
import { logEvent } from '../domain/events';
import { listCoworkers } from '../domain/people';
import { listClients } from '../domain/clients';
import { itemsByKey } from '../domain/lists';
import {
  listTasks,
  tasksForClient,
  getTask,
  createTask,
  updateTask,
  setTaskDone,
  removeTask,
  type TaskRow,
} from '../domain/tasks';
import type { PersonsTable } from '../db/schema';
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
export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
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
};

const safeBack = (v: unknown, fallback = '/ukoly'): string => {
  const s = String(v ?? '');
  return s.startsWith('/') ? s : fallback;
};

// ---------- sdílené komponenty (používá i Nástěnka a detail zákazníka) ----------

const CAT_COLORS = new Set(['teal', 'pink', 'red', 'orange', 'indigo']);

/** Barevný chip kategorie úkolu (plná barva, bílý text). */
export function CatChip(props: { label: string; color: string | null }) {
  const cls = props.color && CAT_COLORS.has(props.color) ? `cat-${props.color}` : 'cat-indigo';
  return <span class={`cat ${cls}`} style="margin-right:.4rem">{props.label}</span>;
}

/** Jeden řádek úkolu: zaškrtnutí (hotovo) · kategorie · text · zákazník · termín · ⋯. */
export function TaskItemRow(props: { t: TaskRow; person: PersonsTable; back: string; target: string; showClient?: boolean }) {
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
        {t.category_label ? <CatChip label={t.category_label} color={t.category_color} /> : null}
        <span style={t.done === 1 ? 'text-decoration:line-through;color:var(--muted)' : ''}>{t.title}</span>
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
}) {
  const order = props.buckets ?? (['overdue', 'today', 'week', 'later', 'none'] as Bucket[]);
  const today = todayStr();
  const groups = order
    .map((b) => ({ b, rows: props.tasks.filter((t) => bucketOf(t.due_at, today) === b) }))
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
            <TaskItemRow t={t} person={props.person} back={props.back} target={props.target} showClient={props.showClient} />
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
  categories: Array<{ id: string; label: string }>;
  meId: string;
  back: string;
  presetClientId?: string;
}) {
  const t = props.task;
  const selClient = t?.client_id ?? props.presetClientId ?? '';
  const selAssignee = t?.assignee_id ?? props.meId;
  return (
    <ModalShell title={t ? tr('Upravit úkol') : tr('Nový úkol')}>
      <form method="post" action={t ? `/ukoly/${t.id}` : '/ukoly'}>
        <input type="hidden" name="back" value={props.back} />
        <div class="field">
          <label>{tr('Co je potřeba udělat')} <span class="req">*</span></label>
          <input class="input" name="title" value={t?.title ?? ''} required autofocus />
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field">
            <label>{tr('Kategorie')}</label>
            <select class="input" name="category_item_id">
              <option value="">{tr('— bez kategorie —')}</option>
              {props.categories.map((cat) => (
                <option value={cat.id} selected={t?.category_label === cat.label}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div class="field">
            <label>{tr('Termín')}</label>
            <input class="input" type="date" name="due_at" value={t?.due_at ?? ''} />
          </div>
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field">
            <label>{tr('Zákazník')}</label>
            <select class="input" name="client_id">
              <option value="">{tr('— bez zákazníka —')}</option>
              {props.clients.map((cl) => (
                <option value={cl.id} selected={cl.id === selClient}>{cl.name}</option>
              ))}
            </select>
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
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{t ? tr('Uložit změny') : tr('Vytvořit úkol')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- stránka /ukoly ----------

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
  const rawFilter = c.req.query('filtr') ?? 'vse';
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : 'vse';
  const scope = isAdmin && c.req.query('tym') === '1' ? 'team' : 'mine';

  const tasks = await listTasks(t, {
    assigneeId: scope === 'mine' ? person.id : undefined,
    includeDone: filter === 'hotove',
  });
  const back = `/ukoly?filtr=${filter}${scope === 'team' ? '&tym=1' : ''}`;
  const hrefFor = (f: FilterKey) => `/ukoly?filtr=${f}${scope === 'team' ? '&tym=1' : ''}`;

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

      <nav class="tabs" aria-label={tr('Filtr úkolů')}>
        {FILTERS.map((f) => (
          <a class={`tab ${filter === f.key ? 'active' : ''}`} href={hrefFor(f.key)}>{tr(f.label)}</a>
        ))}
      </nav>

      {isAdmin ? (
        <div class="frow" style="margin-top:.6rem">
          <a class={`fpill ${scope === 'mine' ? 'active' : ''}`} href={`/ukoly?filtr=${filter}`}>{tr('Moje')}</a>
          <a class={`fpill ${scope === 'team' ? 'active' : ''}`} href={`/ukoly?filtr=${filter}&tym=1`}>{tr('Tým')}</a>
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
                <div>{done.map((tk) => <TaskItemRow t={tk} person={person} back={back} target="#stred" showClient />)}</div>
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
  const [clients, coworkers, categories] = await Promise.all([listClients(t), listCoworkers(t), itemsByKey(t, 'task_categories')]);
  return c.html(
    <TaskModal task={null} clients={clients} coworkers={coworkers} categories={categories} meId={person.id} back={safeBack(c.req.query('back'))} presetClientId={presetClientId} />,
  );
});

ukolyRoutes.get('/ukoly/:id/modal', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const [clients, coworkers, categories] = await Promise.all([listClients(t), listCoworkers(t), itemsByKey(t, 'task_categories')]);
  return c.html(<TaskModal task={task} clients={clients} coworkers={coworkers} categories={categories} meId={person.id} back={safeBack(c.req.query('back'))} />);
});

// ---------- mutace ----------

function parseTaskInput(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim();
  if (!title) return null;
  const due = String(body.due_at ?? '').trim();
  return {
    title,
    categoryItemId: String(body.category_item_id ?? '').trim() || null,
    clientId: String(body.client_id ?? '').trim() || null,
    assigneeId: String(body.assignee_id ?? '').trim() || null,
    dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
  };
}

ukolyRoutes.post('/ukoly', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  const input = parseTaskInput(body as Record<string, unknown>);
  if (!input) return c.redirect(back);
  const id = await createTask(t, person.id, input);
  if (input.clientId) await logEvent(t, 'client', input.clientId, person.id, `Úkol přidán: ${input.title}`);
  void id;
  return c.redirect(back);
});

ukolyRoutes.post('/ukoly/:id', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const task = await getTask(t, c.req.param('id'));
  if (!task) return c.notFound();
  const body = await c.req.parseBody();
  const back = safeBack(body.back);
  const canEdit = person.is_admin === 1 || task.assignee_id === person.id || task.created_by_id === person.id;
  if (!canEdit) return c.redirect(back);
  const input = parseTaskInput(body as Record<string, unknown>);
  if (!input) return c.redirect(back);
  await updateTask(t, task.id, input);
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
  if (canEdit) await removeTask(t, task.id);
  return c.redirect(back);
});

// re-export pro Nástěnku a detail zákazníka
export { tasksForClient };
