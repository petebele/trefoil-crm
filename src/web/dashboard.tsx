import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { openTasksForPerson } from '../domain/tasks';
import { listRecentEvents } from '../domain/events';
import { listPendingForApprover, listReturnedForWorker, type WorkRecord } from '../domain/workRecords';
import { TaskGroups } from './ukoly';
import { WorkRecordRow, ApprovalRow } from './vykazy';
import { EmptyState, ActIcon, activityKind } from './components';
import { tr, getLocale, fmtDateLong, fmtDateTime } from '../i18n';

export const dashboardRoutes = new Hono<AppEnv>();

/** Jednoduchý český vokativ pro pozdrav (nejčastější vzory; jinak nominativ). */
function vocative(firstName: string): string {
  const n = firstName.trim();
  if (!n) return n;
  const lower = n.toLowerCase();
  if (lower.endsWith('a')) return n.slice(0, -1) + 'o'; // Jana → Jano
  if (lower.endsWith('r')) return n.slice(0, -1) + 'ře'; // Petr → Petře
  if (lower.endsWith('k')) return n + 'u'; // Marek → Marku
  if (lower.endsWith('š') || lower.endsWith('č') || lower.endsWith('j')) return n + 'i'; // Tomáš → Tomáši
  if (/[lndtmbvsz]$/.test(lower)) return n + 'e'; // Pavel → Pavle, Jan → Jane
  return n;
}

function greeting(hour: number): string {
  if (hour < 10) return 'Dobré ráno';
  if (hour < 18) return 'Dobré odpoledne';
  return 'Dobrý večer';
}

dashboardRoutes.get('/', async (c) => {
  const person = c.get('person')!;
  const t = person.tenant_id;
  const modules = c.get('modules');
  const isAdmin = person.is_admin === 1;
  const firstName = person.name.split(/\s+/)[0] ?? person.name;
  // český vokativ má smysl jen v češtině; v angličtině jen křestní jméno
  const greetName = getLocale() === 'cs' ? vocative(firstName) : firstName;
  const today = new Date();

  const [tasks, approvals, returned, recent] = await Promise.all([
    modules.has('ukoly') ? openTasksForPerson(t, person.id) : Promise.resolve([]),
    modules.has('vykazy') ? listPendingForApprover(t, person.id, isAdmin) : Promise.resolve([]),
    modules.has('vykazy') ? listReturnedForWorker(t, person.id) : Promise.resolve([]),
    listRecentEvents(t, 12),
  ]);

  // Schvalovací auto‑úkoly („schválit výkaz", source_kind='work_record') do úkolových sekcí NEpatří —
  // schválení řešíme přímo řádkem výkazu v Inboxu (žádné duplicity).
  const mineTasks = tasks.filter((x) => x.source_kind !== 'work_record');
  // Inbox „Vyžaduje moji pozornost" = jen věci k ROZHODNUTÍ (schválení). Úkoly po termínu patří
  // mezi ostatní úkoly (jediná „po termínu" položka jsou dnes úkoly), proto je má „Moje úkoly".
  const showInbox = modules.has('vykazy');

  // Schvalování seskupené dvouúrovňově: vykonavatel → zákazník → jeho výkazy (manažerský pohled).
  const approvalsByWorker: Array<{ worker: string; clients: Array<{ client: string; clientId: string; records: WorkRecord[] }> }> = [];
  const wIdx = new Map<string, number>();
  for (const r of approvals) {
    let wi = wIdx.get(r.worker_id);
    if (wi === undefined) {
      wi = approvalsByWorker.length;
      wIdx.set(r.worker_id, wi);
      approvalsByWorker.push({ worker: r.worker_name, clients: [] });
    }
    const grp = approvalsByWorker[wi]!;
    let ci = grp.clients.findIndex((c) => c.clientId === r.client_id);
    if (ci === -1) {
      ci = grp.clients.length;
      grp.clients.push({ client: r.client_name, clientId: r.client_id, records: [] });
    }
    grp.clients[ci]!.records.push(r);
  }

  return c.html(
    <Layout title={tr('Nástěnka')} person={person} modules={modules} active="nastenka">
      <div class="date-line">{fmtDateLong(today)}</div>
      <h1>
        {tr(greeting(today.getHours()))}, {greetName}
      </h1>

      {/* Střed Nástěnky je živá zóna — po schválení/odškrtnutí/novém dění se Inbox sám překreslí. */}
      <section
        id="dashlive"
        hx-get="/"
        hx-select="#dashlive"
        hx-target="this"
        hx-swap="outerHTML"
        hx-trigger="live-update from:body"
        hx-disinherit="*"
      >
        {/* Inbox „Vyžaduje moji pozornost" — co čeká na mé rozhodnutí (schválit) i na mou opravu (vráceno) */}
        {showInbox ? (
          <div class="card" style="margin-top:1.25rem">
            <div class="card-head"><h3>{tr('Vyžaduje moji pozornost')}</h3></div>
            {approvals.length === 0 && returned.length === 0 ? (
              <EmptyState text={tr('Nic nečeká — máš čisto. 🎉')} />
            ) : (
              <>
                {approvalsByWorker.map((w) => (
                  <div style="margin:0 0 .8rem">
                    <p style="margin:.2rem 0 .35rem">
                      <b>{w.worker}</b> <span class="sub">{tr('vykázal(a) práci ke schválení')}:</span>
                    </p>
                    {w.clients.map((cl) => (
                      <div style="margin:0 0 .35rem .25rem;padding-left:.6rem;border-left:2px solid var(--line)">
                        <p class="sub" style="margin:.1rem 0 0;font-weight:600">
                          <a href={`/firmy/${cl.clientId}`}>{cl.client}</a>
                        </p>
                        {cl.records.map((r) => (
                          <ApprovalRow r={r} person={person} ownerId={person.id} back="/" />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                {returned.length > 0 ? (
                  <div style="margin-top:.7rem">
                    <p class="sub" style="margin:.2rem 0 .2rem;font-weight:600;color:var(--chip-orange-ink)">{tr('Vrácené k přepracování')} ({returned.length})</p>
                    {returned.map((r) => (
                      <WorkRecordRow r={r} person={person} ownerId={null} back="/" showClient />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* Moje úkoly — dnes a tento týden (schvalovačky jsou v Inboxu výše) */}
        {modules.has('ukoly') ? (
          <div class="card" style="margin-top:1rem">
            <div class="card-head">
              <h3>{tr('Moje úkoly')}</h3>
              <button class="btn btn-sm btn-primary" type="button" hx-get="/ukoly/modal/novy?back=/" hx-target="#modal" hx-swap="innerHTML">
                {tr('Přidat úkol')}
              </button>
            </div>
            <TaskGroups
              tasks={mineTasks}
              person={person}
              back="/"
              target="#dashlive"
              showClient
              buckets={['overdue', 'today', 'week']}
              emptyText={tr('Žádné úkoly po termínu, na dnešek ani na tento týden. 🎉')}
              canVykaz={modules.has('vykazy')}
            />
            <p class="sub" style="margin:.7rem 0 0">
              <a href="/ukoly">{tr('Zobrazit všechny úkoly →')}</a>
            </p>
          </div>
        ) : null}

        {/* Poslední dění — vzhled feedu Aktivit (ikony typů), napříč klienty s odkazem na firmu */}
        <div class="card" style="margin-top:1rem">
          <div class="card-head"><h3>{tr('Poslední dění')}</h3></div>
          {recent.length === 0 ? (
            <EmptyState text={tr('Zatím se tu nic nestalo.')} />
          ) : (
            <div>
              {recent.map((e) => {
                const k = activityKind(e.action);
                const muted = k === 'contact' || k === 'system';
                return (
                  <div style={`display:flex;gap:.7rem;padding:.55rem 0;border-top:1px solid var(--line)${muted ? ';opacity:.62' : ''}`}>
                    <span class={`feed-ico feed-ico--${k}`} aria-hidden="true"><ActIcon kind={k} /></span>
                    <div style="flex:1;min-width:0">
                      <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;font-size:.82rem">
                        <b>{e.person_name ?? tr('Systém')}</b>
                        <span class="sub">· {fmtDateTime(e.created_at)}</span>
                      </div>
                      <div style="font-size:.86rem">
                        {e.action}
                        {e.entity_kind === 'client' && e.client_name ? (
                          <> · <a href={`/firmy/${e.entity_id}`}>{e.client_name}</a></>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {!modules.has('ukoly') ? (
        <p class="sub" style="margin-top:.8rem">{tr('Zapni modul Úkoly v Administraci a uvidíš tu svůj přehled úkolů.')}</p>
      ) : null}
    </Layout>,
  );
});
