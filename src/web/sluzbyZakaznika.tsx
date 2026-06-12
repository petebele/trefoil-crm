import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Picker, EmptyState } from './components';
import { logEvent } from '../domain/events';
import { getClient } from '../domain/clients';
import { getCatalogService, isServiceMode, SERVICE_MODE_LABELS, type ServiceMode } from '../domain/services';
import type { CatalogService } from '../domain/services';
import {
  getClientService,
  hasRunningService,
  assignService,
  updateClientService,
  setClientServiceStatus,
  setClientRetainer,
  SERVICE_STATUS_LABELS,
  type ClientService,
} from '../domain/clientServices';
import type { ClientsTable } from '../db/schema';

/**
 * Záložka Služby v detailu zákazníka (Krok 5): paušál hodin, přidělené služby,
 * orientační měsíční spend. Ceny/sazby/paušál mění jen admin; ostatní vše vidí.
 */

export const sluzbyZakaznikaRoutes = new Hono<AppEnv>();

const ERRORS: Record<string, string> = {
  dup: 'Tato služba už u zákazníka běží — upravte ji, nebo ji nejdřív ukončete.',
  povinne: 'Vyberte službu z katalogu.',
};

const kc = (n: number) => n.toLocaleString('cs-CZ');

function num(v: unknown): number | null {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------- formuláře (sdílené pro přidělení i úpravu) ----------

function ServiceFormFields(props: {
  service: ClientService | null; // null = přidělení nové
  available: CatalogService[];
  coworkers: Array<{ id: string; name: string }>;
  defaultOwnerId: string | null;
}) {
  const s = props.service;
  return (
    <>
      {s ? null : (
        <>
          <div class="opt-group" style="padding-left:0">Služba z katalogu</div>
          <select class="input" name="catalog_item_id" required aria-label="Služba z katalogu">
            <option value="">— vyberte službu —</option>
            {props.available.map((it) => (
              <option value={it.id}>
                {it.label}
                {it.meta.price !== null ? ` (${kc(it.meta.price)} Kč/h)` : ''}
              </option>
            ))}
          </select>
        </>
      )}
      <div class="opt-group" style="padding-left:0">Režim účtování</div>
      <select class="input" name="mode" aria-label="Režim účtování">
        {s ? null : <option value="">— výchozí z katalogu —</option>}
        <option value="retainer" selected={s?.mode === 'retainer'}>{SERVICE_MODE_LABELS.retainer}</option>
        <option value="payg" selected={s?.mode === 'payg'}>{SERVICE_MODE_LABELS.payg}</option>
        <option value="subscription" selected={s?.mode === 'subscription'}>{SERVICE_MODE_LABELS.subscription}</option>
      </select>
      <div class="opt-group" style="padding-left:0">Sazba (Kč/h)</div>
      <input
        class="input"
        type="number"
        name="rate"
        min="0"
        step="1"
        value={s?.rate ?? ''}
        placeholder={s ? '' : 'prázdné = výchozí z katalogu'}
        aria-label="Sazba Kč/h"
      />
      <div class="opt-group" style="padding-left:0">Částka předplatného (Kč/měs)</div>
      <input
        class="input"
        type="number"
        name="monthly_amount"
        min="0"
        step="1"
        value={s?.monthly_amount ?? ''}
        placeholder="jen u režimu Předplatné"
        aria-label="Částka předplatného Kč/měs"
      />
      <div class="opt-group" style="padding-left:0">Odpovědná osoba za službu</div>
      <select class="input" name="owner_id" aria-label="Odpovědná osoba za službu">
        <option value="">— nikdo —</option>
        {props.coworkers.map((u) => (
          <option value={u.id} selected={(s ? s.owner_id : props.defaultOwnerId) === u.id}>{u.name}</option>
        ))}
      </select>
      <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:.5rem">
        {s ? 'Uložit' : 'Přidělit'}
      </button>
    </>
  );
}

function RetainerPanelForm(props: { base: string; client: ClientsTable }) {
  const c = props.client;
  return (
    <form method="post" action={`${props.base}/pausal`} class="m0">
      <div class="opt-group" style="padding-left:0">Hodiny měsíčně</div>
      <input class="input" type="number" name="hours" min="0" step="0.5" value={c.hours_budget_monthly ?? ''} aria-label="Hodiny měsíčně" />
      <div class="opt-group" style="padding-left:0">Cena paušálu (Kč/měs)</div>
      <input class="input" type="number" name="price" min="0" step="1" value={c.retainer_price ?? ''} aria-label="Cena paušálu Kč/měs" />
      <label style="display:flex;gap:.5rem;align-items:center;margin:.5rem 0;cursor:pointer;font-size:.85rem">
        <input type="checkbox" name="rollover" value="1" checked={c.hours_rollover === 1} style="width:15px;height:15px;accent-color:var(--accent)" />
        Převádět nevyčerpané hodiny do dalšího měsíce
      </label>
      <button class="btn btn-sm btn-primary" type="submit" style="width:100%;justify-content:center">Uložit</button>
    </form>
  );
}

// ---------- záložka ----------

function serviceMoneyLine(s: ClientService): string {
  if (s.mode === 'subscription') {
    return s.monthly_amount !== null ? `předplatné ${kc(s.monthly_amount)} Kč/měs` : 'předplatné (bez částky)';
  }
  return s.rate !== null ? `sazba ${kc(s.rate)} Kč/h` : 'sazba neuvedena';
}

export function SluzbyZakaznikaTab(props: {
  base: string;
  client: ClientsTable;
  services: ClientService[];
  catalog: CatalogService[];
  coworkers: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  err?: string;
}) {
  const { base, client, services, coworkers, isAdmin } = props;
  const running = services.filter((s) => s.status !== 'ended');
  const available = props.catalog.filter(
    (it) => it.active === 1 && !running.some((s) => s.catalog_item_id === it.id),
  );
  const hasRetainer = client.hours_budget_monthly !== null;

  // orientační měsíční spend
  const lines: Array<{ label: string; amount: number }> = [];
  if (hasRetainer && client.retainer_price !== null) lines.push({ label: 'Paušál hodin', amount: client.retainer_price });
  for (const s of services) {
    if (s.status === 'active' && s.mode === 'subscription' && s.monthly_amount !== null) {
      lines.push({ label: s.label, amount: s.monthly_amount });
    }
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <>
      {props.err && ERRORS[props.err] ? <div class="form-error">{ERRORS[props.err]}</div> : null}

      <div class="card hover-area">
        <div class="card-head"><h3>Paušál hodin</h3></div>
        {hasRetainer ? (
          <div style="display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap">
            <span>
              <b>{kc(client.hours_budget_monthly!)} h</b> měsíčně
              {client.retainer_price !== null ? <> za <b>{kc(client.retainer_price)} Kč/měs</b></> : null}
              <span class="sub" style="display:block">
                Nevyčerpané hodiny se {client.hours_rollover === 1 ? 'převádějí do dalšího měsíce' : 'nepřevádějí (propadají)'}.
                Kryje služby v režimu „{SERVICE_MODE_LABELS.retainer}".
              </span>
            </span>
            {isAdmin ? (
              <span class="area-actions" style="margin-left:auto;display:flex;gap:.8rem">
                <Picker id="pausalEdit" trigger="Upravit" triggerLabel="Upravit paušál hodin">
                  <RetainerPanelForm base={base} client={client} />
                </Picker>
                <form method="post" action={`${base}/pausal`} class="m0" onsubmit="return confirm('Zrušit paušál hodin u tohoto zákazníka?')">
                  <button class="subtle-action" type="submit" name="hours" value="">Zrušit</button>
                </form>
              </span>
            ) : null}
          </div>
        ) : isAdmin ? (
          <Picker id="pausalSet" trigger="Nastavit paušál hodin" triggerLabel="Nastavit paušál hodin">
            <RetainerPanelForm base={base} client={client} />
          </Picker>
        ) : (
          <p class="sub" style="margin:0">Bez paušálu hodin.</p>
        )}
      </div>

      <div class="card hover-area" style="margin-top:1rem">
        <div class="card-head"><h3>Služby</h3></div>
        {isAdmin ? (
          available.length > 0 ? (
            <span class={services.length > 0 ? 'area-actions' : ''}>
              <Picker id="svcAssign" trigger="Přidělit službu" triggerLabel="Přidělit službu z katalogu">
                <form method="post" action={`${base}/sluzby`} class="m0">
                  <ServiceFormFields service={null} available={available} coworkers={coworkers} defaultOwnerId={client.owner_id} />
                </form>
              </Picker>
            </span>
          ) : props.catalog.filter((it) => it.active === 1).length === 0 ? (
            <p class="sub" style="margin:0">
              Nejdřív přidejte služby do katalogu v <a href="/administrace?tab=sluzby">Administraci</a>.
            </p>
          ) : null
        ) : null}

        {services.length === 0 ? (
          <EmptyState text="Zatím žádné služby. Přidělte první službu z katalogu." />
        ) : (
          <div style="margin-top:.4rem">
            {services.map((s) => (
              <div class="hover-row" style={`display:flex;gap:.7rem;align-items:flex-start;padding:.6rem 0;border-top:1px solid var(--line);${s.status === 'ended' ? 'opacity:.55' : ''}`}>
                <span style="flex:1">
                  <span style="font-weight:600">{s.label}</span>
                  <span class={`chip ${s.mode === 'retainer' ? 'chip-soft-teal' : s.mode === 'subscription' ? 'chip-soft-dark' : 'chip-soft-gray'}`} style="margin-left:.5rem">
                    {SERVICE_MODE_LABELS[s.mode]}
                  </span>
                  {s.status !== 'active' ? (
                    <span class={`chip ${s.status === 'paused' ? 'chip-soft-orange' : 'chip-soft-gray'}`} style="margin-left:.35rem">
                      {SERVICE_STATUS_LABELS[s.status]}
                    </span>
                  ) : null}
                  <span class="sub" style="display:block">
                    {serviceMoneyLine(s)}
                    {' · '}
                    {s.owner_name ? `odpovídá ${s.owner_name}` : 'bez odpovědné osoby'}
                  </span>
                </span>
                {isAdmin && s.status !== 'ended' ? (
                  <span class="row-actions" style="white-space:nowrap;display:flex;gap:.8rem">
                    <Picker id={`svcEdit-${s.id}`} trigger="Upravit" triggerLabel={`Upravit službu ${s.label}`}>
                      <form method="post" action={`${base}/sluzby/${s.id}`} class="m0">
                        <ServiceFormFields service={s} available={available} coworkers={coworkers} defaultOwnerId={client.owner_id} />
                      </form>
                    </Picker>
                    <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0">
                      <input type="hidden" name="status" value={s.status === 'paused' ? 'active' : 'paused'} />
                      <button class="subtle-action" type="submit">{s.status === 'paused' ? 'Obnovit' : 'Pozastavit'}</button>
                    </form>
                    <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0" onsubmit="return confirm('Ukončit tuto službu? Historie a výkazy zůstanou zachované.')">
                      <input type="hidden" name="status" value="ended" />
                      <button class="subtle-action" type="submit">Ukončit</button>
                    </form>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head"><h3>Měsíčně celkem</h3></div>
          {lines.map((l) => (
            <div style="display:flex;justify-content:space-between;padding:.35rem 0;border-top:1px solid var(--line);font-size:.88rem">
              <span>{l.label}</span>
              <span>{kc(l.amount)} Kč</span>
            </div>
          ))}
          <div style="display:flex;justify-content:space-between;padding:.5rem 0 0;border-top:2px solid var(--line);font-weight:700">
            <span>Celkem</span>
            <span>{kc(total)} Kč/měs</span>
          </div>
          <p class="sub" style="margin:.6rem 0 0;font-size:.78rem">
            Orientační měsíční spend. Práce účtovaná samostatně a vícepráce se dopočítají
            z výkazů práce (připravujeme).
          </p>
        </div>
      ) : null}
    </>
  );
}

// ---------- routy (mutace jen admin) ----------

async function guard(c: any): Promise<{ t: string; clientId: string; base: string } | Response> {
  const person = c.get('person');
  if (!person) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  const clientId = c.req.param('id');
  const base = `/firmy/${clientId}`;
  if (person.is_admin !== 1) return c.redirect(`${base}?tab=sluzby`);
  const client = await getClient(person.tenant_id, clientId);
  if (!client) return c.notFound();
  return { t: person.tenant_id, clientId, base };
}

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const body = await c.req.parseBody();

  const catalogItemId = String(body.catalog_item_id ?? '');
  const cat = catalogItemId ? await getCatalogService(g.t, catalogItemId) : null;
  if (!cat) return c.redirect(`${g.base}?tab=sluzby&err=povinne`);
  if (await hasRunningService(g.t, g.clientId, cat.id)) return c.redirect(`${g.base}?tab=sluzby&err=dup`);

  const rawMode = String(body.mode ?? '');
  const mode: ServiceMode = isServiceMode(rawMode) ? rawMode : cat.meta.mode;
  const rate = num(body.rate) ?? cat.meta.price;
  const monthlyAmount = num(body.monthly_amount);
  const ownerId = String(body.owner_id ?? '') || null;

  await assignService(g.t, g.clientId, { catalogItemId: cat.id, mode, rate, monthlyAmount, ownerId });
  await logEvent(
    g.t,
    'client',
    g.clientId,
    person.id,
    `Přidělena služba „${cat.label}" (${SERVICE_MODE_LABELS[mode]}${rate !== null ? `, ${kc(rate)} Kč/h` : ''}${mode === 'subscription' && monthlyAmount !== null ? `, ${kc(monthlyAmount)} Kč/měs` : ''})`,
  );
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby/:sid', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();

  const body = await c.req.parseBody();
  const rawMode = String(body.mode ?? '');
  const mode: ServiceMode = isServiceMode(rawMode) ? rawMode : svc.mode;
  const rate = num(body.rate);
  const monthlyAmount = num(body.monthly_amount);
  const ownerId = String(body.owner_id ?? '') || null;

  await updateClientService(g.t, svc.id, { mode, rate, monthlyAmount, ownerId });
  await logEvent(
    g.t,
    'client',
    g.clientId,
    person.id,
    `Upravena služba „${svc.label}" (${SERVICE_MODE_LABELS[mode]}${rate !== null ? `, ${kc(rate)} Kč/h` : ''}${mode === 'subscription' && monthlyAmount !== null ? `, ${kc(monthlyAmount)} Kč/měs` : ''})`,
  );
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby/:sid/stav', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();

  const body = await c.req.parseBody();
  const raw = String(body.status ?? '');
  const status = (['active', 'paused', 'ended'] as const).find((s) => s === raw);
  if (!status || svc.status === 'ended') return c.redirect(`${g.base}?tab=sluzby`);

  await setClientServiceStatus(g.t, svc.id, status);
  const verb = status === 'active' ? 'obnovena' : status === 'paused' ? 'pozastavena' : 'ukončena';
  await logEvent(g.t, 'client', g.clientId, person.id, `Služba „${svc.label}" ${verb}`);
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/pausal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const body = await c.req.parseBody();

  const hours = num(body.hours);
  const price = num(body.price);
  const rollover = String(body.rollover ?? '') === '1';

  await setClientRetainer(g.t, g.clientId, { hours, price, rollover });
  await logEvent(
    g.t,
    'client',
    g.clientId,
    person.id,
    hours === null
      ? 'Paušál hodin zrušen'
      : `Paušál hodin nastaven: ${kc(hours)} h/měs${price !== null ? ` za ${kc(price)} Kč/měs` : ''}, nevyčerpané hodiny se ${rollover ? 'převádějí' : 'nepřevádějí'}`,
  );
  return c.redirect(`${g.base}?tab=sluzby`);
});
