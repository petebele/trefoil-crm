import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { openTasksForPerson } from '../domain/tasks';
import { listRecentEvents } from '../domain/events';
import { TaskGroups } from './ukoly';
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
  const firstName = person.name.split(/\s+/)[0] ?? person.name;
  // český vokativ má smysl jen v češtině; v angličtině jen křestní jméno
  const greetName = getLocale() === 'cs' ? vocative(firstName) : firstName;
  const today = new Date();

  const [tasks, recent] = await Promise.all([
    modules.has('ukoly') ? openTasksForPerson(t, person.id) : Promise.resolve([]),
    listRecentEvents(t, 12),
  ]);

  return c.html(
    <Layout title={tr('Nástěnka')} person={person} modules={modules} active="nastenka">
      <div class="date-line">{fmtDateLong(today)}</div>
      <h1>
        {tr(greeting(today.getHours()))}, {greetName}
      </h1>

      {modules.has('ukoly') ? (
        <div class="card" style="margin-top:1.25rem">
          <div class="card-head">
            <h3>{tr('Moje úkoly')}</h3>
            <button class="btn btn-sm btn-primary" type="button" hx-get="/ukoly/modal/novy?back=/" hx-target="#modal" hx-swap="innerHTML">
              {tr('Přidat úkol')}
            </button>
          </div>
          <div id="dash-tasks">
            <TaskGroups
              tasks={tasks}
              person={person}
              back="/"
              target="#dash-tasks"
              showClient
              buckets={['overdue', 'today', 'week']}
              emptyText={tr('Na dnešek ani na tento týden nic nemáš. 🎉')}
              canVykaz={modules.has('vykazy')}
            />
          </div>
          <p class="sub" style="margin:.7rem 0 0">
            <a href="/ukoly">{tr('Zobrazit všechny úkoly →')}</a>
          </p>
        </div>
      ) : null}

      <div class="card" style="margin-top:1rem">
        <div class="card-head"><h3>{tr('Poslední dění')}</h3></div>
        {recent.length === 0 ? (
          <div class="empty"><span class="big">✓</span>{tr('Zatím se tu nic nestalo.')}</div>
        ) : (
          <div>
            {recent.map((e) => (
              <div style="display:flex;gap:.7rem;padding:.5rem 0;border-top:1px solid var(--line);font-size:.83rem">
                <span class="sub" style="white-space:nowrap">{fmtDateTime(e.created_at)}</span>
                <span style="font-weight:600;white-space:nowrap">{e.person_name ?? '—'}</span>
                <span style="flex:1">
                  {e.action}
                  {e.entity_kind === 'client' && e.client_name ? (
                    <> · <a href={`/firmy/${e.entity_id}`}>{e.client_name}</a></>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!modules.has('ukoly') ? (
        <p class="sub" style="margin-top:.8rem">{tr('Zapni modul Úkoly v Administraci a uvidíš tu svůj přehled úkolů.')}</p>
      ) : null}
    </Layout>,
  );
});
