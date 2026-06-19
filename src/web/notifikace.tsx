import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { IconBell } from './icons';
import { tr, relOrDate } from '../i18n';
import {
  listForRecipient,
  unreadCount,
  markAllRead,
  markTypeRead,
  openNotification,
  isAggregatable,
  type NotificationRow,
} from '../domain/notifications';

export const notifikaceRoutes = new Hono<AppEnv>();

const requireLogin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('person')) return c.redirect('/login');
  await next();
};
notifikaceRoutes.use('/notifikace', requireLogin);
notifikaceRoutes.use('/notifikace/*', requireLogin);

// ---------- pomocné mapy typů ----------
/** Sloučené (aggregatable) typy → titulek skupiny + kam vede klik. */
const GROUP_META: Record<string, { title: string; link: string }> = {
  work_record_pending: { title: 'Výkazy ke schválení', link: '/vykazy?tab=schvalovani' },
  work_record_approved: { title: 'Schválené výkazy', link: '/vykazy?tab=muj&stav=approved' },
};
/** Modifikátor barvy řádku podle typu (CSS proměnná --nc). */
function typeClass(type: string): string {
  switch (type) {
    case 'work_record_approved':
      return 'approved';
    case 'work_record_returned':
      return 'returned';
    case 'work_record_rejected':
      return 'rejected';
    case 'work_record_pending':
      return 'pending';
    default:
      return 'task';
  }
}

// ---------- komponenty ----------

/** Jeden detailní řádek oznámení (klik = označí přečtené + přejde k věci). */
function NotifItemRow(props: { n: NotificationRow }) {
  const { n } = props;
  return (
    <form method="post" action={`/notifikace/${n.id}/otevrit`} class="m0">
      <button class={`notif-item notif-item--${typeClass(n.type)} ${n.read_at ? '' : 'is-unread'}`} type="submit">
        <span class="notif-dot" aria-hidden="true"></span>
        <span class="notif-text">
          <span class="notif-title">{tr(n.title)}</span>
          {n.body ? <span class="notif-sub">{n.body}</span> : null}
          <span class="notif-time">
            {n.actor_name ? `${n.actor_name} · ` : ''}
            {relOrDate(n.created_at)}
          </span>
        </span>
      </button>
    </form>
  );
}

/** Sloučený řádek skupiny stejného typu (počet + odkaz na společnou stránku). */
function NotifGroupRow(props: { type: string; count: number }) {
  const meta = GROUP_META[props.type];
  if (!meta) return null;
  return (
    <form method="post" action={`/notifikace/skupina/${props.type}/otevrit`} class="m0">
      <button class={`notif-item notif-item--${typeClass(props.type)} is-unread`} type="submit">
        <span class="notif-dot" aria-hidden="true"></span>
        <span class="notif-text">
          <span class="notif-title">{tr(meta.title)}</span>
        </span>
        <span class="notif-count" aria-label={tr('{n} nepřečtených', { n: props.count })}>{props.count}</span>
      </button>
    </form>
  );
}

/** Obsah rozbalovacího panelu (hlavička + seznam se seskupením + patička). */
function NotifPanel(props: { items: NotificationRow[] }) {
  const items = props.items;
  const unread = items.filter((n) => !n.read_at);
  // skupiny = aggregatable typy s ≥2 nepřečtenými
  const groupTypes = [...new Set(unread.filter((n) => isAggregatable(n.type)).map((n) => n.type))];
  const groups = groupTypes
    .map((type) => ({ type, count: unread.filter((n) => n.type === type).length }))
    .filter((g) => g.count >= 2);
  const collapsed = new Set(groups.map((g) => g.type));
  // jednotlivě = vše KROMĚ nepřečtených patřících do sbalené skupiny
  const rows = items.filter((n) => !(collapsed.has(n.type) && !n.read_at));
  const empty = items.length === 0;

  return (
    <>
      <div class="notif-head">
        <strong>{tr('Oznámení')}</strong>
        {unread.length > 0 ? (
          <button
            class="notif-markall"
            type="button"
            hx-post="/notifikace/precteno-vse"
            hx-target="#notifBell"
            hx-swap="innerHTML"
          >
            {tr('Označit vše jako přečtené')}
          </button>
        ) : null}
      </div>
      <div class="notif-scroll">
        {empty ? (
          <div class="notif-empty">{tr('Zatím nemáš žádná oznámení.')}</div>
        ) : (
          <>
            {groups.map((g) => (
              <NotifGroupRow type={g.type} count={g.count} />
            ))}
            {rows.map((n) => (
              <NotifItemRow n={n} />
            ))}
          </>
        )}
      </div>
      <a class="notif-foot" href="/notifikace">
        {tr('Zobrazit vše')}
      </a>
    </>
  );
}

/** Vnitřek zvonku = ikona s odznakem + panel. Načítá se do #notifBell (live zóna). */
function NotifBellContent(props: { count: number; items: NotificationRow[] }) {
  const { count, items } = props;
  return (
    <>
      <button
        class="icon-btn notif-trigger"
        type="button"
        data-menu-toggle="notifBell"
        aria-haspopup="true"
        aria-label={tr('Oznámení')}
        title={tr('Oznámení')}
      >
        <IconBell />
        <span class="notif-badge">{count > 0 ? (count > 99 ? '99+' : String(count)) : ''}</span>
      </button>
      <div class="menu-list notif-panel" id="notifPanel" role="menu">
        <NotifPanel items={items} />
      </div>
    </>
  );
}

/**
 * Statická skořápka zvonku do horního panelu (layout). Obsah (ikona + odznak + panel) se
 * dotáhne přes htmx hned po načtení a sám se obnovuje při každé realtime události — odznak
 * tak naskočí bez obnovy stránky. Uvnitř je dočasná ikona, ať lišta nepoposkočí.
 */
export function NotifBell() {
  return (
    <div
      class="menu align-right notif"
      id="notifBell"
      data-keep-open
      hx-get="/notifikace/zvonek"
      hx-trigger="load, live-update from:body"
      hx-swap="innerHTML"
    >
      <button class="icon-btn notif-trigger" type="button" data-menu-toggle="notifBell" aria-label={tr('Oznámení')} title={tr('Oznámení')}>
        <IconBell />
      </button>
    </div>
  );
}

// ---------- routy ----------

/** Obsah zvonku (ikona + odznak + panel) — live zóna #notifBell. */
notifikaceRoutes.get('/notifikace/zvonek', async (c) => {
  const person = c.get('person')!;
  const t = c.get('tenant')!.id;
  const [count, items] = await Promise.all([unreadCount(t, person.id), listForRecipient(t, person.id)]);
  return c.html(<NotifBellContent count={count} items={items} />);
});

/** Otevření jednoho oznámení: označí přečtené a přejde k věci. */
notifikaceRoutes.post('/notifikace/:id/otevrit', async (c) => {
  const person = c.get('person')!;
  const t = c.get('tenant')!.id;
  const link = await openNotification(t, c.req.param('id'), person.id);
  return c.redirect(link ?? '/');
});

/** Otevření skupiny (sloučený typ): označí celý typ přečtený a přejde na společnou stránku. */
notifikaceRoutes.post('/notifikace/skupina/:type/otevrit', async (c) => {
  const person = c.get('person')!;
  const t = c.get('tenant')!.id;
  const type = c.req.param('type');
  await markTypeRead(t, person.id, type);
  return c.redirect(GROUP_META[type]?.link ?? '/');
});

/** Označit vše jako přečtené → vrátí obnovený zvonek (odznak i panel). */
notifikaceRoutes.post('/notifikace/precteno-vse', async (c) => {
  const person = c.get('person')!;
  const t = c.get('tenant')!.id;
  await markAllRead(t, person.id);
  const items = await listForRecipient(t, person.id);
  return c.html(<NotifBellContent count={0} items={items} />);
});

/** Plná stránka s historií oznámení. */
notifikaceRoutes.get('/notifikace', async (c) => {
  const person = c.get('person')!;
  const t = c.get('tenant')!.id;
  const items = await listForRecipient(t, person.id, 100);
  return c.html(
    <Layout title={tr('Oznámení')} person={person} modules={c.get('modules')} active="">
      <div class="page-head">
        <h1>{tr('Oznámení')}</h1>
      </div>
      {items.length === 0 ? (
        <div class="empty">{tr('Zatím tu nic není. Až se objeví něco, co se tě týká, najdeš to tady.')}</div>
      ) : (
        <div class="card notif-page-list">
          {items.map((n) => (
            <NotifItemRow n={n} />
          ))}
        </div>
      )}
    </Layout>,
  );
});
