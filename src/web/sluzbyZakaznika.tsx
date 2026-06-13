import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { ModalShell, EmptyState, KebabMenu } from './components';
import { logEvent } from '../domain/events';
import { getClient } from '../domain/clients';
import { listCoworkers } from '../domain/people';
import { getCatalogService, listCatalog, isServiceMode, SERVICE_MODE_LABELS, type ServiceMode } from '../domain/services';
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
import type { ClientsTable, PersonsTable } from '../db/schema';
import { WorkRecordRow, MonthNav } from './vykazy';
import { fmtMinutes, type WorkRecord, type MonthMoney } from '../domain/workRecords';

/**
 * Záložka Služby v detailu zákazníka (Krok 5): paušál hodin, přidělené služby
 * (běžící + archiv ukončených), pevné měsíční platby. Zakládání a úpravy přes
 * velké modály (režim soustředění). Ceny/sazby/paušál mění jen admin.
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

// ---------- velké modály (JEDEN formulář pro přidělení i úpravu služby) ----------

function ServiceModal(props: {
  base: string;
  service: ClientService | null; // null = přidělení nové
  available: CatalogService[];
  coworkers: Array<{ id: string; name: string }>;
  defaultOwnerId: string | null;
}) {
  const s = props.service;
  const mode = s?.mode ?? 'retainer';
  return (
    <ModalShell title={s ? `Upravit službu · ${s.label}${s.detail ? ` · ${s.detail}` : ''}` : 'Přidělit službu'}>
      <form method="post" action={s ? `${props.base}/sluzby/${s.id}` : `${props.base}/sluzby`}>
        {s ? null : (
          <div class="field">
            <label>Služba z katalogu <span class="req">*</span></label>
            {/* data-set-* = výchozí hodnoty; app.js je při výběru propíše do polí
                a u odpovídající volby režimu ukáže „(výchozí)" */}
            <select class="input" name="catalog_item_id" required data-defaults autofocus>
              <option value="">— vyberte službu —</option>
              {props.available.map((it) => (
                <option value={it.id} data-set-mode={it.meta.mode} data-set-rate={it.meta.price ?? ''}>
                  {it.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div class="field">
          <label>Upřesnění služby</label>
          <input class="input" name="detail" value={s?.detail ?? ''} placeholder="odliší opakovaná přidělení (např. „Sklik“)" />
        </div>
        <div class="field">
          <label>Režim účtování</label>
          <select class="input" name="mode">
            <option value="retainer" selected={mode === 'retainer'}>{SERVICE_MODE_LABELS.retainer}</option>
            <option value="payg" selected={mode === 'payg'}>{SERVICE_MODE_LABELS.payg}</option>
            <option value="subscription" selected={mode === 'subscription'}>{SERVICE_MODE_LABELS.subscription}</option>
          </select>
        </div>
        <div class={`field ${mode === 'subscription' ? 'hidden' : ''}`} data-depends-on="mode" data-depends-value="retainer,payg">
          <label>Sazba (Kč/h)</label>
          <input class="input" type="number" name="rate" min="0" step="1" value={s?.rate ?? ''} />
        </div>
        <div class={`field ${mode === 'subscription' ? '' : 'hidden'}`} data-depends-on="mode" data-depends-value="subscription">
          <label>Částka předplatného (Kč/měs)</label>
          <input class="input" type="number" name="monthly_amount" min="0" step="1" value={s?.monthly_amount ?? ''} />
        </div>
        <div class="field">
          <label>Popis služby</label>
          <textarea class="input" name="description" rows={2} placeholder="co v rámci služby pro klienta děláme">{s?.description ?? ''}</textarea>
        </div>
        <div class="field">
          <label>Odpovědná osoba za službu</label>
          <select class="input" name="owner_id">
            <option value="">— nikdo —</option>
            {props.coworkers.map((u) => (
              <option value={u.id} selected={(s ? s.owner_id : props.defaultOwnerId) === u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{s ? 'Uložit změny' : 'Přidělit službu'}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>Zavřít</button>
        </div>
      </form>
    </ModalShell>
  );
}

function RetainerModal(props: { base: string; client: ClientsTable }) {
  const c = props.client;
  return (
    <ModalShell title="Paušál hodin">
      <form method="post" action={`${props.base}/pausal`}>
        <div class="field">
          <label>Hodiny měsíčně <span class="req">*</span></label>
          <input class="input" type="number" name="hours" min="0" step="0.5" value={c.hours_budget_monthly ?? ''} required autofocus />
          <span class="help">Jeden paušál na zákazníka — kryje všechny jeho služby v režimu „{SERVICE_MODE_LABELS.retainer}".</span>
        </div>
        <div class="field">
          <label>Cena paušálu (Kč/měs)</label>
          <input class="input" type="number" name="price" min="0" step="1" value={c.retainer_price ?? ''} />
        </div>
        <div class="field">
          <label style="display:flex;gap:.5rem;align-items:center;cursor:pointer">
            <input type="checkbox" name="rollover" value="1" checked={c.hours_rollover === 1} style="width:16px;height:16px;accent-color:var(--accent)" />
            Převádět nevyčerpané hodiny do dalšího měsíce
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Uložit</button>
          <button class="btn btn-ghost" type="button" data-modal-close>Zavřít</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- záložka ----------

function serviceMoneyLine(s: ClientService): string {
  if (s.mode === 'subscription') {
    return s.monthly_amount !== null ? `předplatné ${kc(s.monthly_amount)} Kč/měs` : 'předplatné (bez částky)';
  }
  return s.rate !== null ? `sazba ${kc(s.rate)} Kč/h` : 'sazba neuvedena';
}

function ServiceRow(props: { base: string; s: ClientService; isAdmin: boolean; vykazyMonth?: string }) {
  const { base, s, isAdmin } = props;
  const vykazatBack = props.vykazyMonth ? `${base}?tab=sluzby&mesic=${props.vykazyMonth}` : `${base}?tab=sluzby`;
  return (
    <div class="hover-row" style={`display:flex;gap:.7rem;align-items:flex-start;padding:.6rem 0;border-top:1px solid var(--line);${s.status === 'ended' ? 'opacity:.6' : ''}`}>
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
      {s.status !== 'ended' ? (
        <span class="row-actions" style="white-space:nowrap;display:flex;gap:.8rem">
          {props.vykazyMonth && s.status === 'active' ? (
            <button
              class="subtle-action"
              type="button"
              hx-get={`/vykazy/modal/novy?klient=${s.client_id}&sluzba=${s.id}&back=${encodeURIComponent(vykazatBack)}`}
              hx-target="#modal"
              hx-swap="innerHTML"
            >
              Vykázat
            </button>
          ) : null}
          {isAdmin ? (
            <>
              <button class="subtle-action" type="button" hx-get={`${base}/sluzby/${s.id}/modal`} hx-target="#modal" hx-swap="innerHTML">
                Upravit
              </button>
              <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0">
                <input type="hidden" name="status" value={s.status === 'paused' ? 'active' : 'paused'} />
                <button class="subtle-action" type="submit">{s.status === 'paused' ? 'Obnovit' : 'Pozastavit'}</button>
              </form>
              <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0" onsubmit="return confirm('Ukončit tuto službu? Přesune se do archivu, historie zůstane zachovaná.')">
                <input type="hidden" name="status" value="ended" />
                <button class="subtle-action" type="submit">Ukončit</button>
              </form>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export function SluzbyZakaznikaTab(props: {
  base: string;
  client: ClientsTable;
  services: ClientService[];
  catalog: CatalogService[];
  coworkers: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  err?: string;
  /** Výkazy práce (jen se zapnutým modulem vykazy). */
  vykazy?: { person: PersonsTable; records: WorkRecord[]; money: MonthMoney; month: string };
}) {
  const { base, client, services, isAdmin } = props;
  const available = props.catalog.filter((it) => it.active === 1);
  const running = services.filter((s) => s.status !== 'ended');
  const archived = services.filter((s) => s.status === 'ended');
  const hasRetainer = client.hours_budget_monthly !== null;

  // Pevné měsíční platby: paušál + předplatná. Samostatně účtovaná práce přijde z výkazů.
  const active = services.filter((s) => s.status === 'active');
  const lines: Array<{ label: string; amount: number | null; note: string | null }> = [];
  const vMoney = props.vykazy?.money;
  if (hasRetainer) {
    lines.push({
      label: vMoney
        ? `Paušál hodin (čerpáno ${fmtMinutes(vMoney.usedRetainerMinutes)} z ${fmtMinutes(vMoney.budgetMinutes ?? 0)})`
        : `Paušál hodin (${kc(client.hours_budget_monthly!)} h/měs)`,
      amount: client.retainer_price,
      note: client.retainer_price === null ? 'cena nenastavena' : null,
    });
  } else if (active.some((s) => s.mode === 'retainer')) {
    lines.push({ label: 'Paušál hodin', amount: null, note: 'není nastaven — služby v režimu paušálu se nemají z čeho odečítat' });
  }
  for (const s of active) {
    const name = s.detail ? `${s.label} · ${s.detail}` : s.label;
    if (s.mode === 'subscription') {
      lines.push({ label: name, amount: s.monthly_amount, note: s.monthly_amount === null ? 'bez částky' : null });
    } else if (s.mode === 'payg') {
      lines.push({ label: name, amount: null, note: s.rate !== null ? `dle výkazů × ${kc(s.rate)} Kč/h` : 'dle vykázané práce' });
    }
  }
  const v = props.vykazy;
  if (v && v.money.billedCost + v.money.overageCost > 0) {
    lines.push({
      label: `Vícepráce — schváleno (${fmtMinutes(v.money.billedMinutes + v.money.overageMinutes)})`,
      amount: Math.round(v.money.billedCost + v.money.overageCost),
      note: null,
    });
  }
  // čekající výkazy = rezervovaný čas a očekávané příjmy — do součtu patří také
  if (v && v.money.pendingExtraMinutes > 0) {
    lines.push({
      label: `Vícepráce — čeká na schválení (${fmtMinutes(v.money.pendingExtraMinutes)})`,
      amount: Math.round(v.money.pendingExtraCost),
      note: null,
    });
  }
  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);

  return (
    <>
      {props.err && ERRORS[props.err] ? <div class="form-error">{ERRORS[props.err]}</div> : null}

      {/* Akce sekcí: ⋯ v pravém rohu (vždy viditelné), prázdná sekce má textovou akci. */}
      <div class="card">
        <div class="card-head">
          <h3>Paušál hodin</h3>
          {isAdmin ? (
            hasRetainer ? (
              <KebabMenu id="pausalMenu" label="Možnosti paušálu hodin">
                <button class="opt" type="button" hx-get={`${base}/pausal/modal`} hx-target="#modal" hx-swap="innerHTML">
                  Upravit paušál
                </button>
                <form method="post" action={`${base}/pausal`} class="m0" onsubmit="return confirm('Zrušit paušál hodin u tohoto zákazníka?')">
                  <button class="opt" type="submit" name="hours" value="">Zrušit paušál</button>
                </form>
              </KebabMenu>
            ) : (
              <button class="subtle-action" type="button" hx-get={`${base}/pausal/modal`} hx-target="#modal" hx-swap="innerHTML">
                Nastavit paušál hodin
              </button>
            )
          ) : null}
        </div>
        {hasRetainer ? (
          <div>
            <b>{kc(client.hours_budget_monthly!)} h</b> měsíčně
            {client.retainer_price !== null ? <> za <b>{kc(client.retainer_price)} Kč/měs</b></> : null}
            <span class="sub" style="display:block">
              Nevyčerpané hodiny se {client.hours_rollover === 1 ? 'převádějí do dalšího měsíce' : 'nepřevádějí (propadají)'}.
              Kryje služby v režimu „{SERVICE_MODE_LABELS.retainer}".
            </span>
          </div>
        ) : (
          <p class="sub" style="margin:0">Bez paušálu hodin.</p>
        )}
      </div>

      <div class="card" style="margin-top:1rem">
        <div class="card-head">
          <h3>Služby</h3>
          {isAdmin && available.length > 0 ? (
            running.length > 0 ? (
              <KebabMenu id="svcMenu" label="Možnosti služeb">
                <button class="opt" type="button" hx-get={`${base}/sluzby/modal/nova`} hx-target="#modal" hx-swap="innerHTML">
                  Přidělit službu
                </button>
              </KebabMenu>
            ) : (
              <button class="subtle-action" type="button" hx-get={`${base}/sluzby/modal/nova`} hx-target="#modal" hx-swap="innerHTML">
                Přidělit službu
              </button>
            )
          ) : null}
        </div>
        {isAdmin && available.length === 0 ? (
          <p class="sub" style="margin:0">
            Nejdřív přidejte služby do katalogu v <a href="/administrace?tab=sluzby">Administraci</a>.
          </p>
        ) : null}

        {running.length === 0 && archived.length === 0 ? (
          <EmptyState text="Zatím žádné služby. Přidělte první službu z katalogu." />
        ) : (
          <div style="margin-top:.4rem">
            {running.map((s) => (
              <ServiceRow base={base} s={s} isAdmin={isAdmin} vykazyMonth={props.vykazy?.month} />
            ))}
          </div>
        )}

        {archived.length > 0 ? (
          <div style="margin-top:.8rem">
            <button type="button" class="subtle-action" data-reveal="svcArchive" aria-controls="svcArchive">
              Ukončené služby ({archived.length})
            </button>
            <div id="svcArchive" class="hidden">
              {archived.map((s) => (
                <ServiceRow base={base} s={s} isAdmin={isAdmin} vykazyMonth={props.vykazy?.month} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {v ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head">
            <h3>Výkazy</h3>
            <span style="display:flex;gap:.6rem;align-items:center">
              <MonthNav month={v.month} hrefFor={(m) => `${base}?tab=sluzby&mesic=${m}`} />
              <KebabMenu id="vykazyMenu" label="Možnosti výkazů">
                <button
                  class="opt"
                  type="button"
                  hx-get={`/vykazy/modal/novy?klient=${client.id}&back=${encodeURIComponent(`${base}?tab=sluzby&mesic=${v.month}`)}`}
                  hx-target="#modal"
                  hx-swap="innerHTML"
                >
                  Vykázat práci
                </button>
              </KebabMenu>
            </span>
          </div>
          <p class="sub" style="margin:0 0 .4rem">
            Vykázáno <b>{fmtMinutes(v.money.totalMinutes)}</b>
            {v.money.budgetMinutes !== null ? (
              <>
                {' · '}paušál: čerpáno <b>{fmtMinutes(Math.min(v.money.usedRetainerMinutes, v.money.budgetMinutes))}</b> z {fmtMinutes(v.money.budgetMinutes)}
                {v.money.carryMinutes > 0 ? ` (z toho převedeno ${fmtMinutes(v.money.carryMinutes)})` : ''}
                {v.money.overageMinutes > 0 ? (
                  <span style="color:var(--red);font-weight:600"> · přečerpáno {fmtMinutes(v.money.overageMinutes)}</span>
                ) : (
                  <> · zbývá <b>{fmtMinutes(Math.max(0, v.money.budgetMinutes - v.money.usedRetainerMinutes))}</b></>
                )}
              </>
            ) : null}
            {v.money.pendingCount > 0 ? ` · ${v.money.pendingCount} čeká na schválení` : ''}
          </p>
          {v.records.length === 0 ? (
            <EmptyState text="Tento měsíc zatím nikdo nevykázal žádnou práci." />
          ) : (
            <div>
              {v.records.map((r) => (
                <WorkRecordRow r={r} person={v.person} ownerId={client.owner_id} back={`${base}?tab=sluzby&mesic=${v.month}`} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {lines.length > 0 ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head"><h3>Měsíčně celkem</h3></div>
          {lines.map((l) => (
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-top:1px solid var(--line);font-size:.88rem">
              <span>{l.label}</span>
              {l.amount !== null ? <span style="white-space:nowrap">{kc(l.amount)} Kč</span> : <span class="sub" style="white-space:nowrap">{l.note}</span>}
            </div>
          ))}
          <div style="display:flex;justify-content:space-between;padding:.5rem 0 0;border-top:2px solid var(--line);font-weight:700">
            <span>{v ? `Očekávaný měsíc ${v.month}` : 'Pevné platby celkem'}</span>
            <span>{kc(total)} Kč/měs</span>
          </div>
          <p class="sub" style="margin:.6rem 0 0;font-size:.78rem">
            {v
              ? 'Pevné platby (paušál + předplatná) + vícepráce z výkazů zvoleného měsíce — schválené i čekající (rezervovaný čas a očekávané příjmy). Práce „z paušálu" v rámci limitu nemění částku, jen čerpá hodiny.'
              : 'Jen pevné měsíční platby (paušál + předplatná). Vícepráce se doplní z výkazů práce (zapněte modul Výkazy).'}
          </p>
        </div>
      ) : null}
    </>
  );
}

// ---------- routy (vše jen admin) ----------

type Guarded = { t: string; clientId: string; base: string; client: ClientsTable; person: PersonsTable };

async function guard(c: any): Promise<Guarded | Response> {
  const person = c.get('person');
  if (!person) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  const clientId = c.req.param('id');
  const base = `/firmy/${clientId}`;
  if (person.is_admin !== 1) return c.redirect(`${base}?tab=sluzby`);
  const client = await getClient(person.tenant_id, clientId);
  if (!client) return c.notFound();
  return { t: person.tenant_id, clientId, base, client, person };
}

// --- velké modály ---

sluzbyZakaznikaRoutes.get('/firmy/:id/sluzby/modal/nova', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const [catalog, coworkers] = await Promise.all([listCatalog(g.t), listCoworkers(g.t)]);
  return c.html(
    <ServiceModal base={g.base} service={null} available={catalog.filter((it) => it.active === 1)} coworkers={coworkers} defaultOwnerId={g.client.owner_id} />,
  );
});

sluzbyZakaznikaRoutes.get('/firmy/:id/sluzby/:sid/modal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();
  const coworkers = await listCoworkers(g.t);
  return c.html(<ServiceModal base={g.base} service={svc} available={[]} coworkers={coworkers} defaultOwnerId={g.client.owner_id} />);
});

sluzbyZakaznikaRoutes.get('/firmy/:id/pausal/modal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  return c.html(<RetainerModal base={g.base} client={g.client} />);
});

// --- mutace ---

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

  const body = await c.req.parseBody();
  const catalogItemId = String(body.catalog_item_id ?? '');
  const cat = catalogItemId ? await getCatalogService(g.t, catalogItemId) : null;
  if (!cat) return c.redirect(`${g.base}?tab=sluzby&err=povinne`);

  const input = serviceInputFromBody(body as Record<string, unknown>, cat.meta.mode);
  if (input.rate === null && input.mode !== 'subscription') input.rate = cat.meta.price; // bez JS: výchozí sazba z katalogu

  await assignService(g.t, g.clientId, cat.id, input);
  await logEvent(g.t, 'client', g.clientId, g.person.id, serviceEventText('Přidělena', cat.label, input));
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby/:sid', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();

  const body = await c.req.parseBody();
  const input = serviceInputFromBody(body as Record<string, unknown>, svc.mode);

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  const effMonthly = input.mode === 'subscription' ? input.monthlyAmount : null;
  const unchanged =
    (svc.detail ?? null) === input.detail &&
    (svc.description ?? null) === input.description &&
    svc.mode === input.mode &&
    (svc.rate ?? null) === input.rate &&
    (svc.monthly_amount ?? null) === effMonthly &&
    (svc.owner_id ?? null) === input.ownerId;
  if (!unchanged) {
    await updateClientService(g.t, svc.id, input);
    await logEvent(g.t, 'client', g.clientId, g.person.id, serviceEventText('Upravena', svc.label, input));
  }
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/sluzby/:sid/stav', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();

  const body = await c.req.parseBody();
  const raw = String(body.status ?? '');
  const status = (['active', 'paused', 'ended'] as const).find((s) => s === raw);
  if (!status || svc.status === 'ended') return c.redirect(`${g.base}?tab=sluzby`);

  await setClientServiceStatus(g.t, svc.id, status);
  const verb = status === 'active' ? 'obnovena' : status === 'paused' ? 'pozastavena' : 'ukončena';
  await logEvent(g.t, 'client', g.clientId, g.person.id, `Služba „${svc.label}${svc.detail ? ` · ${svc.detail}` : ''}" ${verb}`);
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/pausal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;

  const body = await c.req.parseBody();
  const hours = num(body.hours);
  const price = num(body.price);
  const rollover = String(body.rollover ?? '') === '1';

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  const cl = g.client;
  if (
    (cl.hours_budget_monthly ?? null) === hours &&
    (cl.retainer_price ?? null) === (hours === null ? null : price) &&
    (cl.hours_rollover === 1) === (hours === null ? false : rollover)
  ) {
    return c.redirect(`${g.base}?tab=sluzby`);
  }

  await setClientRetainer(g.t, g.clientId, { hours, price, rollover });
  await logEvent(
    g.t,
    'client',
    g.clientId,
    g.person.id,
    hours === null
      ? 'Paušál hodin zrušen'
      : `Paušál hodin nastaven: ${kc(hours)} h/měs${price !== null ? ` za ${kc(price)} Kč/měs` : ''}, nevyčerpané hodiny se ${rollover ? 'převádějí' : 'nepřevádějí'}`,
  );
  return c.redirect(`${g.base}?tab=sluzby`);
});
