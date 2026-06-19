import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { ModalShell, initials } from './components';
import { listTeam } from '../domain/team';
import { setImpersonationCookie, clearImpersonationCookie, getImpersonationTarget } from '../auth/impersonation';
import { tr } from '../i18n';

export const impersonaceRoutes = new Hono<AppEnv>();

/** Skutečná identita i během impersonace (admin = impersonator, jinak přihlášený). */
const realUser = (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => c.get('impersonator') ?? c.get('person');

// Spustit/vybrat smí jen admin — hlídá se podle SKUTEČNÉ session (ne podle přepnutého stavu).
const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const u = realUser(c);
  if (!u) return c.redirect('/login');
  if (u.is_admin !== 1) return c.redirect('/');
  await next();
};
impersonaceRoutes.use('/impersonace', requireAdmin);
impersonaceRoutes.use('/impersonace/start', requireAdmin);

/** Modál se seznamem uživatelů, na koho se přepnout. */
impersonaceRoutes.get('/impersonace', async (c) => {
  const t = c.get('tenant')!.id;
  const me = realUser(c)!;
  const team = (await listTeam(t)).filter((p) => p.is_active === 1 && p.id !== me.id);
  return c.html(
    <ModalShell title={tr('Zobrazit jako…')}>
      <p class="sub" style="margin:-.4rem 0 1rem">
        {tr('Prohlédni si aplikaci očima jiného uživatele. Kdykoli se vrátíš zpět na sebe.')}
      </p>
      {team.length === 0 ? (
        <div class="empty-inline">{tr('Žádní další uživatelé.')}</div>
      ) : (
        <div class="imp-list">
          {team.map((p) => (
            <form method="post" action="/impersonace/start" class="m0 imp-row">
              <input type="hidden" name="person_id" value={p.id} />
              <span class="av av-i">{initials(p.name)}</span>
              <span class="imp-row-main">
                <span class="imp-row-name">{p.name}</span>
                {p.position ? <span class="sub">{p.position}</span> : null}
              </span>
              {p.is_admin === 1 ? <span class="chip chip-soft-dark">{tr('Admin')}</span> : null}
              <button class="btn btn-sm" type="submit">
                {tr('Zobrazit jako')}
              </button>
            </form>
          ))}
        </div>
      )}
    </ModalShell>,
  );
});

/** Spuštění impersonace (jen admin, jen platný cíl). */
impersonaceRoutes.post('/impersonace/start', async (c) => {
  const t = c.get('tenant')!.id;
  const me = realUser(c)!;
  const body = await c.req.parseBody();
  const targetId = String(body.person_id ?? '');
  if (targetId && targetId !== me.id && (await getImpersonationTarget(t, targetId))) {
    setImpersonationCookie(c, targetId);
  }
  return c.redirect('/');
});

/** Návrat zpět na sebe — smaže impersonační cookii. */
impersonaceRoutes.post('/impersonace/konec', async (c) => {
  clearImpersonationCookie(c);
  return c.redirect('/');
});
