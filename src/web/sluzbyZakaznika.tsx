import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Picker, EmptyState } from './components';
import { logEvent } from '../domain/events';
import { getClient } from '../domain/clients';
import { getCatalogService, isServiceMode, SERVICE_MODE_LABELS, type ServiceMode } from '../domain/services';
import type { CatalogService } from '../domain/services';
import {
  getClientService,
  assignService,
  updateClientService,
  setClientServiceStatus,
  setClientRetainer,
  SERVICE_STATUS_LABELS,
  type ClientService,
  type ClientServiceInput,
} from '../domain/clientServices';
import type { ClientsTable } from '../db/schema';

/**
 * Záložka Služby v detailu zákazníka (Krok 5): paušál hodin, přidělené služby,
 * orientační měsíční spend. Ceny/sazby/paušál mění jen admin; ostatní vše vidí.
 */

export const sluzbyZakaznikaRoutes = new Hono<AppEnv>();

const ERRORS: Record<string, string> = {
  povinne: 'Vyberte službu z katalogu.',
};

const kc = (n: number) => n.toLocaleString('cs-CZ');

function num(v: unknown): number | null {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------- formulář (JEDEN pro přidělení i úpravu — úprava jen předvyplní) ----------

function ServiceForm(props: {
  action: string;
  service: ClientService | null; // null = přidělení nové
  available: CatalogService[];
  coworkers: Array<{ id: string; name: string }>;
  defaultOwnerId: string | null;
}) {
  const s = props.service;
  const mode = s?.mode ?? 'retainer';
  return (
    <form method="post" action={props.action} class="m0">
      {s ? null : (
        <>
          <div class="opt-group" style="padding-left:0">Služba z katalogu</div>
          {/* data-set-* = výchozí hodnoty; app.js je při výběru propíše do polí
              a u odpovídající volby režimu ukáže „(výchozí)" */}
          <select class="input" name="catalog_item_id" required data-defaults aria-label="Služba z katalogu">
            <option value="">— vyberte službu —</option>
            {props.available.map((it) => (
              <option value={it.id} data-set-mode={it.meta.mode} data-set-rate={it.meta.price ?? ''}>
                {it.label}
              </option>
            ))}
          </select>
        </>
      )}
      <div class="opt-group" style="padding-left:0">Upřesnění služby</div>
      <input class="input" name="detail" value={s?.detail ?? ''} placeholder="odliší opakovaná přidělení (např. „Sklik“)" aria-label="Upřesnění služby" />
      <div class="opt-group" style="padding-left:0">Režim účtování</div>
      <select class="input" name="mode" aria-label="Režim účtování">
        <option value="retainer" selected={mode === 'retainer'}>{SERVICE_MODE_LABELS.retainer}</option>
        <option value="payg" selected={mode === 'payg'}>{SERVICE_MODE_LABELS.payg}</option>
        <option value="subscription" selected={mode === 'subscription'}>{SERVICE_MODE_LABELS.subscription}</option>
      </select>
      <div data-depends-on="mode" data-depends-value="retainer,payg" class={mode === 'subscription' ? 'hidden' : ''}>
        <div class="opt-group" style="padding-left:0">Sazba (Kč/h)</div>
        <input class="input" type="number" name="rate" min="0" step="1" value={s?.rate ?? ''} aria-label="Sazba Kč/h" />
      </div>
      <div data-depends-on="mode" data-depends-value="subscription" class={mode === 'subscription' ? '' : 'hidden'}>
        <div class="opt-group" style="padding-left:0">Částka předplatného (Kč/měs)</div>
        <input class="input" type="number" name="monthly_amount" min="0" step="1" value={s?.monthly_amount ?? ''} aria-label="Částka předplatného Kč/měs" />
      </div>
      <div class="opt-group" style="padding-left:0">Popis služby</div>
      <textarea class="input" name="description" rows={2} placeholder="co v rámci služby pro klienta děláme" aria-label="Popis služby">{s?.description ?? ''}</textarea>
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
    </form>
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
  const available = props.catalog.filter((it) => it.active === 1);
  const hasRetainer = client.hours_budget_monthly !== null;

  // orientační měsíční spend
  const lines: Array<{ label: string; amount: number }> = [];
  if (hasRetainer && client.retainer_price !== null) lines.push({ label: 'Paušál hodin', amount: client.retainer_price });
  for (const s of services) {
    if (s.status === 'active' && s.mode === 'subscription' && s.monthly_amount !== null) {
      lines.push({ label: s.detail ? `${s.label} · ${s.detail}` : s.label, amount: s.monthly_amount });
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
                <ServiceForm action={`${base}/sluzby`} service={null} available={available} coworkers={coworkers} defaultOwnerId={client.owner_id} />
              </Picker>
            </span>
          ) : (
            <p class="sub" style="margin:0">
              Nejdřív přidejte služby do katalogu v <a href="/administrace?tab=sluzby">Administraci</a>.
            </p>
          )
        ) : null}

        {services.length === 0 ? (
          <EmptyState text="Zatím žádné služby. Přidělte první službu z katalogu." />
        ) : (
          <div style="margin-top:.4rem">
            {services.map((s) => (
              <div class="hover-row" style={`display:flex;gap:.7rem;align-items:flex-start;padding:.6rem 0;border-top:1px solid var(--line);${s.status === 'ended' ? 'opacity:.55' : ''}`}>
                <span style="flex:1">
                  <span style="font-weight:600">{s.label}</span>
                  {s.detail ? <span class="sub" style="font-weight:600"> · {s.detail}</span> : null}
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
                  {s.description ? <span class="sub" style="display:block;font-size:.78rem">{s.description}</span> : null}
                </span>
                {isAdmin && s.status !== 'ended' ? (
                  <span class="row-actions" style="white-space:nowrap;display:flex;gap:.8rem">
                    <Picker id={`svcEdit-${s.id}`} trigger="Upravit" triggerLabel={`Upravit službu ${s.label}`}>
                      <ServiceForm action={`${base}/sluzby/${s.id}`} service={s} available={available} coworkers={coworkers} defaultOwnerId={client.owner_id} />
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

/** Společné čtení formuláře služby (jeden formulář pro přidělení i úpravu). */
function serviceInputFromBody(body: Record<string, unknown>, fallbackMode: ServiceMode): ClientServiceInput {
  const rawMode = String(body.mode ?? '');
  return {
    detail: String(body.detail ?? '').trim() || null,
    description: String(body.description ?? '').trim() || null,
    mode: isServiceMode(rawMode) ? rawMode : fallbackMode,
    rate: num(body.rate),
    monthlyAmount: num(body.monthly_amount),
    ownerId: String(body.owner_id ?? '') || null,
  };
}

function serviceEventText(verb: string, label: string, input: ClientServiceInput): string {
  const name = input.detail ? `${label} · ${input.detail}` : label;
  const money =
    input.mode === 'subscription'
      ? input.monthlyAmount !== null
        ? `, ${kc(input.monthlyAmount)} Kč/měs`
        : ''
      : input.rate !== null
        ? `, ${kc(input.rate)} Kč/h`
        : '';
  return `${verb} služba „${name}" (${SERVICE_MODE_LABELS[input.mode]}${money})`;
}

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const body = await c.req.parseBody();

  const catalogItemId = String(body.catalog_item_id ?? '');
  const cat = catalogItemId ? await getCatalogService(g.t, catalogItemId) : null;
  if (!cat) return c.redirect(`${g.base}?tab=sluzby&err=povinne`);

  const input = serviceInputFromBody(body as Record<string, unknown>, cat.meta.mode);
  if (input.rate === null && input.mode !== 'subscription') input.rate = cat.meta.price; // bez JS: výchozí sazba z katalogu

  await assignService(g.t, g.clientId, cat.id, input);
  await logEvent(g.t, 'client', g.clientId, person.id, serviceEventText('Přidělena', cat.label, input));
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby/:sid', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const person = c.get('person')!;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();

  const body = await c.req.parseBody();
  const input = serviceInputFromBody(body as Record<string, unknown>, svc.mode);

  await updateClientService(g.t, svc.id, input);
  await logEvent(g.t, 'client', g.clientId, person.id, serviceEventText('Upravena', svc.label, input));
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
