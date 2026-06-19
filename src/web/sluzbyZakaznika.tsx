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
  listClientServices,
  assignService,
  updateClientService,
  setClientServiceStatus,
  setClientRetainer,
  SERVICE_STATUS_LABELS,
  type ClientService,
  type ClientServiceInput,
} from '../domain/clientServices';
import type { ClientsTable, PersonsTable } from '../db/schema';
import { Layout } from './layout';
import { WorkRecordRow, MonthNav } from './vykazy';
import { fmtMinutes, monthLabel, monthKey, billingTotal, listForService, type WorkRecord, type MonthMoney } from '../domain/workRecords';
import { notesForEntity, type NoteRow } from '../domain/notes';
import { NoteCard } from './poznamky';
import { tr, fmtNum, fmtDate } from '../i18n';

/**
 * Záložka Služby v detailu zákazníka (Krok 5): paušál hodin, přidělené služby
 * (běžící + archiv ukončených), pevné měsíční platby. Zakládání a úpravy přes
 * velké modály (režim soustředění). Ceny/sazby/paušál mění jen admin.
 */

export const sluzbyZakaznikaRoutes = new Hono<AppEnv>();

const ERRORS: Record<string, string> = {
  povinne: 'Vyberte službu z katalogu.',
};

const kc = (n: number) => fmtNum(n);

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
  clientBudgetHours: number | null; // paušál klienta (h/měs) — kontext pro alokaci
  allocatedOther: number; // už přiděleno jiným službám (h)
}) {
  const s = props.service;
  const mode = s?.mode ?? 'retainer';
  const hasPausal = props.clientBudgetHours != null && props.clientBudgetHours > 0;
  const remainingH = hasPausal ? Math.max(0, props.clientBudgetHours! - props.allocatedOther) : 0;
  return (
    <ModalShell title={s ? `${tr('Upravit službu')} · ${s.label}${s.detail ? ` · ${s.detail}` : ''}` : tr('Přidělit službu')}>
      <form method="post" action={s ? `${props.base}/sluzby/${s.id}` : `${props.base}/sluzby`}>
        {s ? null : (
          <div class="field">
            <label>{tr('Služba z katalogu')} <span class="req">*</span></label>
            {/* data-set-* = výchozí hodnoty; app.js je při výběru propíše do polí
                a u odpovídající volby režimu ukáže „(výchozí)" */}
            <select class="input" name="catalog_item_id" required data-defaults autofocus>
              <option value="">{tr('— vyberte službu —')}</option>
              {props.available.map((it) => (
                <option value={it.id} data-set-mode={it.meta.mode} data-set-rate={it.meta.price ?? ''}>
                  {it.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div class="field">
          <label>{tr('Upřesnění služby')}</label>
          <input class="input" name="detail" value={s?.detail ?? ''} placeholder={tr('odliší opakovaná přidělení (např. „Sklik“)')} />
        </div>
        <div class="field">
          <label>{tr('Režim účtování')}</label>
          <select class="input" name="mode">
            <option value="retainer" selected={mode === 'retainer'}>{tr(SERVICE_MODE_LABELS.retainer)}</option>
            <option value="payg" selected={mode === 'payg'}>{tr(SERVICE_MODE_LABELS.payg)}</option>
            <option value="subscription" selected={mode === 'subscription'}>{tr(SERVICE_MODE_LABELS.subscription)}</option>
          </select>
        </div>
        <div class={`field ${mode === 'subscription' ? 'hidden' : ''}`} data-depends-on="mode" data-depends-value="retainer,payg">
          <label>{tr('Sazba')} ({tr('Kč/h')})</label>
          <input class="input" type="number" name="rate" min="0" step="1" value={s?.rate ?? ''} />
        </div>
        <div class={`field ${mode === 'subscription' ? '' : 'hidden'}`} data-depends-on="mode" data-depends-value="subscription">
          <label>{tr('Částka předplatného')} ({tr('Kč/měs')})</label>
          <input class="input" type="number" name="monthly_amount" min="0" step="1" value={s?.monthly_amount ?? ''} />
        </div>
        <div class={`field ${mode === 'retainer' ? '' : 'hidden'}`} data-depends-on="mode" data-depends-value="retainer">
          <label>{tr('Rozpočet z paušálu')} ({tr('h/měs')})</label>
          <input class="input" type="number" name="budget_hours" min="0" step="0.5" value={s?.budget_hours ?? ''} placeholder={tr('např. 6 (z celkového paušálu klienta)')} />
          <span class="help">
            {hasPausal ? (
              <>
                {tr('Paušál klienta {b} h/měs', { b: kc(props.clientBudgetHours!) })}
                {' · '}
                {tr('jiným službám přiděleno {a} h', { a: kc(props.allocatedOther) })}
                {' · '}
                <b>{tr('zbývá rozdělit {r} h', { r: kc(remainingH) })}</b>
              </>
            ) : (
              tr('Klient nemá nastavený paušál hodin — nastavte ho v sekci „Paušál hodin“, jinak je alokace jen orientační.')
            )}
          </span>
          <label style="display:flex;align-items:center;gap:.45rem;font-size:.84rem;margin:.4rem 0 0">
            <input type="checkbox" name="allow_overage" value="1" checked={s?.allow_overage === 1} /> {tr('Povolit přečerpání (čerpat z rozpočtu jiných služeb)')}
          </label>
          <label style="display:block;font-size:.8rem;color:var(--muted);margin:.5rem 0 .15rem">{tr('Upozornit při vyčerpání (%)')}</label>
          <input class="input" type="number" name="alert_pct" min="1" max="100" step="1" value={s?.alert_pct ?? ''} placeholder="80" />
        </div>
        <div class="field">
          <label>{tr('Popis služby')}</label>
          <textarea class="input" name="description" rows={2} placeholder={tr('co v rámci služby pro klienta děláme')}>{s?.description ?? ''}</textarea>
        </div>
        <div class="field">
          <label>{tr('Odpovědná osoba za službu')}</label>
          <select class="input" name="owner_id">
            <option value="">{tr('— nikdo —')}</option>
            {props.coworkers.map((u) => (
              <option value={u.id} selected={(s ? s.owner_id : props.defaultOwnerId) === u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{s ? tr('Uložit změny') : tr('Přidělit službu')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function RetainerModal(props: { base: string; client: ClientsTable }) {
  const c = props.client;
  return (
    <ModalShell title={tr('Paušál hodin')}>
      <form method="post" action={`${props.base}/pausal`}>
        <div class="field">
          <label>{tr('Hodiny měsíčně')} <span class="req">*</span></label>
          <input class="input" type="number" name="hours" min="0" step="0.5" value={c.hours_budget_monthly ?? ''} required autofocus />
          <span class="help">{tr('Jeden paušál na zákazníka — kryje všechny jeho služby v režimu „{mode}".', { mode: tr(SERVICE_MODE_LABELS.retainer) })}</span>
        </div>
        <div class="field-row2" style="grid-template-columns:1fr 1fr">
          <div class="field">
            <label>{tr('Standardní hodinová sazba / za vícepráce')} ({tr('Kč/h')})</label>
            <input class="input" type="number" name="overage_rate" min="0" step="1" value={c.overage_rate ?? ''} />
            <span class="help">{tr('Běžná sazba; účtuje se jí práce nad paušál. Prázdné = sazba služby.')}</span>
          </div>
          <div class="field">
            <label>{tr('Zvýhodněná sazba za paušální hodinu')} ({tr('Kč/h')})</label>
            <input class="input" type="number" name="rate" min="0" step="1" value={c.retainer_hourly_rate ?? ''} />
            <span class="help">{tr('Měsíční cena paušálu = hodiny × tato sazba.')}</span>
          </div>
        </div>
        <div class="field">
          <label style="display:flex;gap:.5rem;align-items:center;cursor:pointer">
            <input type="checkbox" name="rollover" value="1" checked={c.hours_rollover === 1} style="width:16px;height:16px;accent-color:var(--accent)" />
            {tr('Převádět nevyčerpané hodiny do dalšího měsíce')}
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">{tr('Uložit')}</button>
          <button class="btn btn-ghost" type="button" data-modal-close>{tr('Zavřít')}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- záložka ----------

function serviceMoneyLine(s: ClientService): string {
  if (s.mode === 'subscription') {
    return s.monthly_amount !== null ? `${tr('předplatné')} ${kc(s.monthly_amount)} ${tr('Kč/měs')}` : tr('předplatné (bez částky)');
  }
  return s.rate !== null ? `${tr('sazba')} ${kc(s.rate)} ${tr('Kč/h')}` : tr('sazba neuvedena');
}

function ServiceRow(props: { base: string; s: ClientService; isAdmin: boolean; vykazyMonth?: string }) {
  const { base, s, isAdmin } = props;
  const vykazatBack = props.vykazyMonth ? `${base}?tab=vykazy&mesic=${props.vykazyMonth}` : `${base}?tab=vykazy`;
  const canVykaz = !!(props.vykazyMonth && s.status === 'active');
  const isEnded = s.status === 'ended';
  const hasMenu = isEnded ? isAdmin : isAdmin || canVykaz;
  return (
    <div class="hover-row" style={`display:flex;gap:.7rem;align-items:flex-start;padding:.6rem 0;border-top:1px solid var(--line);${s.status === 'ended' ? 'opacity:.6' : ''}`}>
      <span style="flex:1">
        <a href={`${base}/sluzby/${s.id}`} style="font-weight:600;color:inherit;text-decoration:none" data-tip={tr('Otevřít detail služby')}>{s.label}</a>
        {s.detail ? <span class="sub" style="font-weight:600"> · {s.detail}</span> : null}
        <span class={`chip ${s.mode === 'retainer' ? 'chip-soft-teal' : s.mode === 'subscription' ? 'chip-soft-dark' : 'chip-soft-gray'}`} style="margin-left:.5rem">
          {tr(SERVICE_MODE_LABELS[s.mode])}
        </span>
        {s.status !== 'active' ? (
          <span class={`chip ${s.status === 'paused' ? 'chip-soft-orange' : 'chip-soft-gray'}`} style="margin-left:.35rem">
            {tr(SERVICE_STATUS_LABELS[s.status])}
          </span>
        ) : null}
        {s.allow_overage === 1 && s.budget_hours != null ? (
          <span class="chip chip-soft-orange" style="margin-left:.35rem" data-tip={tr('Smí přečerpat alokaci z rozpočtu jiných služeb')}>{tr('přečerpání povoleno')}</span>
        ) : null}
        <span class="sub" style="display:block">
          {serviceMoneyLine(s)}
          {s.budget_hours != null ? <> · {s.budget_hours} {tr('h z paušálu')}</> : null}
          {' · '}
          {s.owner_name ? tr('odpovídá {name}', { name: s.owner_name }) : tr('bez odpovědné osoby')}
        </span>
        {s.description ? <span class="sub" style="display:block;font-size:.78rem">{s.description}</span> : null}
      </span>
      {hasMenu ? (
        <span class="row-actions"><KebabMenu id={`svcRow-${s.id}`} label={tr('Možnosti služby')}>
          {isEnded ? (
            <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0">
              <input type="hidden" name="status" value="active" />
              <button class="opt" type="submit">{tr('Aktivovat službu')}</button>
            </form>
          ) : (
            <>
              {canVykaz ? (
                <button
                  class="opt"
                  type="button"
                  hx-get={`/vykazy/modal/novy?klient=${s.client_id}&sluzba=${s.id}&back=${encodeURIComponent(vykazatBack)}`}
                  hx-target="#modal"
                  hx-swap="innerHTML"
                >
                  {tr('Vykázat')}
                </button>
              ) : null}
              {isAdmin ? (
                <>
                  <button class="opt" type="button" hx-get={`${base}/sluzby/${s.id}/modal`} hx-target="#modal" hx-swap="innerHTML">
                    {tr('Upravit')}
                  </button>
                  <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0">
                    <input type="hidden" name="status" value={s.status === 'paused' ? 'active' : 'paused'} />
                    <button class="opt" type="submit">{s.status === 'paused' ? tr('Obnovit') : tr('Pozastavit')}</button>
                  </form>
                  <form method="post" action={`${base}/sluzby/${s.id}/stav`} class="m0" onsubmit={`return confirm('${tr('Ukončit tuto službu? Přesune se do archivu, historie zůstane zachovaná.')}')`}>
                    <input type="hidden" name="status" value="ended" />
                    <button class="opt" type="submit">{tr('Ukončit')}</button>
                  </form>
                </>
              ) : null}
            </>
          )}
        </KebabMenu></span>
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
  /** Která polovina sekce se renderuje: „sluzby" = paušál + služby (nastavení),
   *  „vykazy" = výkazy + vyúčtování (měsíční report). Dvě záložky, jedna komponenta. */
  view: 'sluzby' | 'vykazy';
  /** Aktuální měsíc pro akci „Vykázat" v řádku služby (jen se zapnutým modulem vykazy). */
  vykazyMonth?: string;
  /** Data reportingu — výkazy/vyúčtování (jen view='vykazy'). */
  vykazy?: { person: PersonsTable; records: WorkRecord[]; money: MonthMoney; month: string };
}) {
  const { base, client, services, isAdmin } = props;
  const available = props.catalog.filter((it) => it.active === 1);
  const running = services.filter((s) => s.status !== 'ended');
  const archived = services.filter((s) => s.status === 'ended');
  const hasRetainer = client.hours_budget_monthly !== null;
  // aktivní paušál = nastavený A nenulový; nulový/nedefinovaný = vše se účtuje sazbou
  const hasActivePausal = (client.hours_budget_monthly ?? 0) > 0;

  // ── Vyúčtování: paušál (dohodnutá cena) + čerpání/nevyčerpáno/přečerpáno + nepaušální služby ──
  const active = services.filter((s) => s.status === 'active');
  const v = props.vykazy;
  const money = v?.money;
  const approved = (v?.records ?? []).filter((r) => r.status === 'approved');

  const P = client.retainer_price ?? 0; // dohodnutá cena paušálu
  const ratePausal = client.hours_budget_monthly && client.hours_budget_monthly > 0 ? P / client.hours_budget_monthly : 0; // Kč/h paušálu
  const allowanceMin = money?.budgetMinutes ?? (client.hours_budget_monthly !== null ? Math.round(client.hours_budget_monthly * 60) : 0);
  const usedMin = money?.usedRetainerMinutes ?? 0;
  const overMin = money?.overageMinutes ?? 0;
  const unusedMin = Math.max(0, allowanceMin - usedMin);

  // KAŽDÁ ČINNOST ZVLÁŠŤ (žádné sčítání po službách): hrazené z paušálu (bez částky, jen při
  // aktivním paušálu) a účtované (čas × sazba). Bez aktivního paušálu se i „z paušálu" účtuje sazbou.
  const svcLabel = (r: WorkRecord) => (r.service_detail ? `${r.service_label} · ${r.service_detail}` : r.service_label);
  const retainerLines: WorkRecord[] = [];
  const billableLines: Array<{ r: WorkRecord; amount: number; rate: number | null }> = [];
  for (const r of approved) {
    if (r.billing === 'free') continue; // neúčtovat
    if (hasActivePausal && r.billing === 'retainer_hours') {
      retainerLines.push(r);
    } else {
      const effRate = !hasActivePausal && r.billing === 'retainer_hours' ? client.overage_rate ?? r.service_rate : r.service_rate;
      billableLines.push({ r, amount: (r.minutes / 60) * (effRate ?? 0), rate: effRate });
    }
  }
  const subscriptions = active.filter((s) => s.mode === 'subscription');

  const overageCost = Math.round(money?.overageCost ?? 0);
  // při převodu nevyčerpané hodiny snižují přínos měsíce (jejich hodnota se přesouvá dál)
  const unusedDeduction = v && hasRetainer && client.hours_rollover === 1 ? Math.round((unusedMin / 60) * ratePausal) : 0;
  // jeden zdroj pravdy pro celek (shodný s dlaždicí na nástěnce firmy)
  const total = billingTotal({
    hoursBudget: client.hours_budget_monthly,
    retainerPrice: client.retainer_price,
    rollover: client.hours_rollover === 1,
    money,
    subscriptionAmounts: subscriptions.map((s) => s.monthly_amount ?? 0),
  });
  const showVyuctovani = hasActivePausal || subscriptions.length > 0 || billableLines.length > 0;

  return (
    <>
      {props.view === 'sluzby' && props.err && ERRORS[props.err] ? <div class="form-error">{tr(ERRORS[props.err]!)}</div> : null}

      {/* === Nastavení: Paušál + Služby (záložka „Služby a rozpočty") === */}
      {props.view === 'sluzby' ? (
        <>
      {/* Akce sekcí: ⋯ v pravém rohu (vždy viditelné), prázdná sekce má textovou akci. */}
      <div class="card">
        <div class="card-head">
          <h3>{tr('Paušál hodin')}</h3>
          {isAdmin ? (
            hasRetainer ? (
              <KebabMenu id="pausalMenu" label={tr('Možnosti paušálu hodin')}>
                <button class="opt" type="button" hx-get={`${base}/pausal/modal`} hx-target="#modal" hx-swap="innerHTML">
                  {tr('Upravit paušál')}
                </button>
                <form method="post" action={`${base}/pausal`} class="m0" onsubmit={`return confirm('${tr('Zrušit paušál hodin u tohoto zákazníka?')}')`}>
                  <button class="opt" type="submit" name="hours" value="">{tr('Zrušit paušál')}</button>
                </form>
              </KebabMenu>
            ) : (
              <button class="subtle-action" type="button" hx-get={`${base}/pausal/modal`} hx-target="#modal" hx-swap="innerHTML">
                {tr('Nastavit paušál hodin')}
              </button>
            )
          ) : null}
        </div>
        {hasActivePausal ? (
          <div>
            <b>{kc(client.hours_budget_monthly!)} {tr('h')}</b> {tr('měsíčně')}
            {client.retainer_hourly_rate !== null ? <> × <b>{kc(client.retainer_hourly_rate)} {tr('Kč/h')}</b></> : null}
            {client.retainer_price !== null ? <> = <b>{kc(client.retainer_price)} {tr('Kč/měs')}</b></> : null}
            <span class="sub" style="display:block">
              {client.hours_rollover === 1 ? tr('Nevyčerpané hodiny se převádějí do dalšího měsíce.') : tr('Nevyčerpané hodiny se nepřevádějí (propadají).')}
              {' '}
              {tr('Kryje služby v režimu „{mode}".', { mode: tr(SERVICE_MODE_LABELS.retainer) })}
              {client.overage_rate !== null ? <> {tr('Vícepráce {rate} Kč/h.', { rate: kc(client.overage_rate) })}</> : null}
            </span>
          </div>
        ) : (
          <p class="sub" style="margin:0">
            <b>{tr('Paušál hodin není definovaný.')}</b>{' '}
            {client.overage_rate !== null
              ? tr('Práci účtujeme {rate} Kč/h.', { rate: kc(client.overage_rate) })
              : tr('Práci účtujeme sazbou u jednotlivých služeb.')}
          </p>
        )}
      </div>

      <div class="card" style="margin-top:1rem">
        <div class="card-head">
          <h3>{tr('Služby')}</h3>
          {isAdmin && available.length > 0 ? (
            running.length > 0 ? (
              <KebabMenu id="svcMenu" label={tr('Možnosti služeb')}>
                <button class="opt" type="button" hx-get={`${base}/sluzby/modal/nova`} hx-target="#modal" hx-swap="innerHTML">
                  {tr('Přidělit službu')}
                </button>
              </KebabMenu>
            ) : (
              <button class="subtle-action" type="button" hx-get={`${base}/sluzby/modal/nova`} hx-target="#modal" hx-swap="innerHTML">
                {tr('Přidělit službu')}
              </button>
            )
          ) : null}
        </div>
        {isAdmin && available.length === 0 ? (
          <p class="sub" style="margin:0">
            {tr('Nejdřív přidejte služby do katalogu v')} <a href="/administrace?tab=sluzby">{tr('Administraci')}</a>.
          </p>
        ) : null}

        {running.length === 0 && archived.length === 0 ? (
          <EmptyState text={tr('Zatím žádné služby. Přidělte první službu z katalogu.')} />
        ) : (
          <div style="margin-top:.4rem">
            {running.map((s) => (
              <ServiceRow base={base} s={s} isAdmin={isAdmin} vykazyMonth={props.vykazyMonth} />
            ))}
          </div>
        )}

        {archived.length > 0 ? (
          <div style="margin-top:.8rem">
            <button type="button" class="subtle-action" data-reveal="svcArchive" aria-controls="svcArchive">
              {tr('Ukončené služby ({n})', { n: archived.length })}
            </button>
            <div id="svcArchive" class="hidden">
              {archived.map((s) => (
                <ServiceRow base={base} s={s} isAdmin={isAdmin} vykazyMonth={props.vykazyMonth} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
        </>
      ) : null}

      {/* === Report: Výkazy + Vyúčtování (záložka „Výkazy a vyúčtování") === */}
      {props.view === 'vykazy' && v ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head">
            <h3>{tr('Výkazy')}</h3>
            <span style="display:flex;gap:.6rem;align-items:center">
              <MonthNav month={v.month} hrefFor={(m) => `${base}?tab=vykazy&mesic=${m}`} />
              <KebabMenu id="vykazyMenu" label={tr('Možnosti výkazů')}>
                <button
                  class="opt"
                  type="button"
                  hx-get={`/vykazy/modal/novy?klient=${client.id}&back=${encodeURIComponent(`${base}?tab=vykazy&mesic=${v.month}`)}`}
                  hx-target="#modal"
                  hx-swap="innerHTML"
                >
                  {tr('Vykázat práci')}
                </button>
              </KebabMenu>
            </span>
          </div>
          <p class="sub" style="margin:0 0 .4rem">
            {tr('Vykázáno')} <b>{fmtMinutes(v.money.totalMinutes)}</b>
            {v.money.budgetMinutes !== null ? (
              <>
                {' · '}{tr('paušál: čerpáno')} <b>{fmtMinutes(Math.min(v.money.usedRetainerMinutes, v.money.budgetMinutes))}</b> {tr('z')} {fmtMinutes(v.money.budgetMinutes)}
                {v.money.carryMinutes > 0 ? ` ${tr('(z toho převedeno {mins})', { mins: fmtMinutes(v.money.carryMinutes) })}` : ''}
                {v.money.overageMinutes > 0 ? (
                  <span style="color:var(--red);font-weight:600"> · {tr('přečerpáno')} {fmtMinutes(v.money.overageMinutes)}</span>
                ) : (
                  <> · {tr('zbývá')} <b>{fmtMinutes(Math.max(0, v.money.budgetMinutes - v.money.usedRetainerMinutes))}</b></>
                )}
              </>
            ) : null}
            {v.money.pendingCount > 0 ? ` ${tr('· {n} čeká na schválení', { n: v.money.pendingCount })}` : ''}
          </p>
          {v.records.length === 0 ? (
            <EmptyState text={tr('Tento měsíc zatím nikdo nevykázal žádnou práci.')} />
          ) : (
            <div>
              {v.records.map((r) => (
                <WorkRecordRow r={r} person={v.person} ownerId={client.owner_id} back={`${base}?tab=vykazy&mesic=${v.month}`} showAmount={!hasActivePausal} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {props.view === 'vykazy' && showVyuctovani ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head"><h3>{tr('Vyúčtování')}{v ? <span class="sub" style="font-weight:400;text-transform:capitalize"> · {monthLabel(v.month)}</span> : ''}</h3></div>

          {hasActivePausal ? (
            <>
              <div style="display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;border-top:1px solid var(--line);font-size:.88rem">
                <span>
                  <b>{tr('Měsíční paušál')}</b>
                  {v ? <> · {fmtMinutes(allowanceMin)} {tr('(čerpáno {used})', { used: fmtMinutes(Math.min(usedMin, allowanceMin)) })}</> : <> · {fmtMinutes(allowanceMin)}</>}
                  <span class="sub" style="display:block;font-size:.78rem">
                    {client.hours_rollover === 1 ? tr('Nevyčerpané hodiny se převádějí.') : tr('Nevyčerpané hodiny propadají.')}
                  </span>
                </span>
                <span style="white-space:nowrap;font-weight:600">{client.retainer_price !== null ? <>{kc(P)} {tr('Kč')}</> : <span class="sub">{tr('cena nenastavena')}</span>}</span>
              </div>
              {retainerLines.map((r) => (
                <div style="display:flex;justify-content:space-between;gap:1rem;padding:.12rem 0 .12rem 1.1rem;font-size:.8rem;color:var(--muted)">
                  <span>• {r.description} <span class="sub">· {svcLabel(r)}</span></span>
                  <span style="white-space:nowrap">{fmtMinutes(r.minutes)}</span>
                </div>
              ))}
              {v && overMin > 0 ? (
                <div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;font-size:.88rem">
                  <span style="color:var(--red)">{tr('Přečerpáno {mins}', { mins: fmtMinutes(overMin) })}{client.overage_rate !== null ? ` × ${kc(client.overage_rate)} ${tr('Kč/h')}` : ''}</span>
                  <span style="white-space:nowrap;font-weight:600">+ {kc(overageCost)} {tr('Kč')}</span>
                </div>
              ) : v && unusedMin > 0 ? (
                client.hours_rollover === 1 ? (
                  <div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;font-size:.88rem">
                    <span>{tr('Nevyčerpáno {mins} (převádí se)', { mins: fmtMinutes(unusedMin) })}</span>
                    <span style="white-space:nowrap;font-weight:600">− {kc(unusedDeduction)} {tr('Kč')}</span>
                  </div>
                ) : (
                  <div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;font-size:.88rem">
                    <span class="sub">{tr('Zbývá vyčerpat {mins} (propadá)', { mins: fmtMinutes(unusedMin) })}</span>
                    <span class="sub" style="white-space:nowrap">—</span>
                  </div>
                )
              ) : null}
            </>
          ) : null}

          {billableLines.map(({ r, amount, rate }) => (
            <div style="padding:.4rem 0;border-top:1px solid var(--line);font-size:.88rem">
              {/* ř. 1: popis (co jsem dělal) + služba · hodiny × sazba (pod tím) + částka vpravo */}
              <div style="display:flex;gap:.7rem;align-items:flex-start">
                <span style="flex:1;min-width:0">
                  <span style="font-weight:600">{r.description}</span>
                  <span class="sub" style="display:block">{svcLabel(r)} · {fmtMinutes(r.minutes)}{rate !== null ? ` × ${kc(rate)} ${tr('Kč/h')}` : ''}</span>
                </span>
                <span style="white-space:nowrap;font-weight:600">{kc(Math.round(amount))} {tr('Kč')}</span>
              </div>
            </div>
          ))}

          {subscriptions.map((s) => (
            <div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-top:1px solid var(--line);font-size:.88rem">
              <span>{s.detail ? `${s.label} · ${s.detail}` : s.label}</span>
              {s.monthly_amount !== null ? <span style="white-space:nowrap;font-weight:600">{kc(s.monthly_amount)} {tr('Kč')}</span> : <span class="sub" style="white-space:nowrap">{tr('bez částky')}</span>}
            </div>
          ))}

          <div style="display:flex;justify-content:space-between;padding:.5rem 0 0;border-top:2px solid var(--line);font-weight:700">
            <span>{tr('Celkem')}</span>
            <span>{kc(total)} {tr('Kč/měs')}</span>
          </div>
          {v && v.money.pendingCount > 0 ? (
            <p class="sub" style="margin:.6rem 0 0;font-size:.78rem">{tr('+ {n} výkazů čeká na schválení (do součtu se započte po schválení)', { n: v.money.pendingCount })}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// ---------- detail služby (/firmy/:id/sluzby/:sid) ----------

/**
 * Stručný „systémový" řádek výkazu do feedu Dění — výkazy mají kompletní detail
 * v bloku Čerpání, tady zůstává jen jednořádková zpráva pro úplnost (bez akcí).
 */
function WorkLogLine(props: { r: WorkRecord }) {
  const { r } = props;
  return (
    <div style="display:flex;gap:.6rem;align-items:baseline;padding:.4rem 0;border-top:1px solid var(--line);font-size:.82rem;color:var(--muted)">
      <span style="white-space:nowrap">{fmtDate(r.performed_at)}</span>
      <span style="flex:1;min-width:0">
        <b style="font-weight:600">{tr('Výkaz')}:</b> {r.description}
        <span style="white-space:nowrap"> · {r.worker_name} · {fmtMinutes(r.minutes)}</span>
      </span>
    </div>
  );
}

function ServiceDetail(props: {
  base: string;
  detailBase: string;
  client: ClientsTable;
  svc: ClientService;
  isAdmin: boolean;
  canVykaz: boolean;
  allocatedTotal: number;
  month: string;
  records: WorkRecord[];
  notes: NoteRow[];
  person: PersonsTable;
  canTask: boolean;
}) {
  const { base, detailBase, client, svc, isAdmin } = props;
  const sid = svc.id;
  const hasActivePausal = (client.hours_budget_monthly ?? 0) > 0;
  const vykBack = `${detailBase}?mesic=${props.month}`;
  // Čerpání služby = vykázané hodiny „z paušálu" v měsíci, měřené proti referenci.
  // Reference = vlastní rozpočet služby (budget_hours), jinak celý paušál klienta
  // (aby uživatel viděl reálné „vyčerpáno X z Y h" i bez per-službové alokace).
  const budgetH = svc.budget_hours;
  const spentMin = props.records.filter((r) => r.billing === 'retainer_hours' && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + r.minutes, 0);
  const hasSvcBudget = budgetH != null && budgetH > 0;
  const refH = hasSvcBudget ? budgetH! : hasActivePausal ? client.hours_budget_monthly! : null;
  const burnPct = refH && refH > 0 ? Math.round((spentMin / 60 / refH) * 100) : 0;
  const alertPct = svc.alert_pct ?? 80;
  // Limit/přečerpání má smysl jen u vlastního rozpočtu služby (proti paušálu klienta jen ukazujeme podíl).
  const over = hasSvcBudget && spentMin / 60 > budgetH!;
  const alertHit = hasSvcBudget && burnPct >= alertPct;
  // Blok Čerpání = mini-graf (je-li rozpočet/paušál) + kompletní výkazy služby.
  const showCerpani = props.canVykaz || hasActivePausal || hasSvcBudget;
  const novaPoznamkaUrl = `/poznamky/novy?kind=service&id=${sid}&back=${encodeURIComponent(detailBase)}`;
  // sloučený proud „dění": výkazy (měsíc) + poznámky (měsíc) promíchané podle data, nejnovější nahoře
  const monthNotes = props.notes.filter((n) => n.created_at.startsWith(props.month));
  type FeedItem = { at: string; kind: 'work'; r: WorkRecord } | { at: string; kind: 'note'; n: NoteRow };
  const feed: FeedItem[] = [
    ...props.records.map((r): FeedItem => ({ at: r.performed_at, kind: 'work', r })),
    ...monthNotes.map((n): FeedItem => ({ at: n.created_at, kind: 'note', n })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return (
    <>
      <p style="margin:.2rem 0 .8rem">
        <a href={`${base}?tab=sluzby`} class="subtle-action">‹ {tr('Zpět na firmu {name}', { name: client.name })}</a>
      </p>

      <div class="card">
        <div class="card-head">
          <h3 style="font-size:1.05rem">
            {svc.label}
            {svc.detail ? <span class="sub" style="font-weight:600"> · {svc.detail}</span> : null}
          </h3>
          {isAdmin && svc.status !== 'ended' ? (
            <KebabMenu id="svcDetailMenu" label={tr('Možnosti služby')}>
              <button class="opt" type="button" hx-get={`${base}/sluzby/${sid}/modal`} hx-target="#modal" hx-swap="innerHTML">{tr('Upravit')}</button>
              <form method="post" action={`${base}/sluzby/${sid}/stav`} class="m0">
                <input type="hidden" name="status" value={svc.status === 'paused' ? 'active' : 'paused'} />
                <button class="opt" type="submit">{svc.status === 'paused' ? tr('Obnovit') : tr('Pozastavit')}</button>
              </form>
              <form method="post" action={`${base}/sluzby/${sid}/stav`} class="m0" onsubmit={`return confirm('${tr('Ukončit tuto službu? Přesune se do archivu, historie zůstane zachovaná.')}')`}>
                <input type="hidden" name="status" value="ended" />
                <button class="opt" type="submit">{tr('Ukončit')}</button>
              </form>
            </KebabMenu>
          ) : isAdmin && svc.status === 'ended' ? (
            <KebabMenu id="svcDetailMenu" label={tr('Možnosti služby')}>
              <form method="post" action={`${base}/sluzby/${sid}/stav`} class="m0">
                <input type="hidden" name="status" value="active" />
                <button class="opt" type="submit">{tr('Aktivovat službu')}</button>
              </form>
            </KebabMenu>
          ) : null}
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
          <a href={`${base}?tab=sluzby`} class="chip chip-soft-gray" style="text-decoration:none">{client.name}</a>
          <span class={`chip ${svc.mode === 'retainer' ? 'chip-soft-teal' : svc.mode === 'subscription' ? 'chip-soft-dark' : 'chip-soft-gray'}`}>{tr(SERVICE_MODE_LABELS[svc.mode])}</span>
          <span class={`chip ${svc.status === 'active' ? 'chip-soft-teal' : svc.status === 'paused' ? 'chip-soft-orange' : 'chip-soft-gray'}`}>{tr(SERVICE_STATUS_LABELS[svc.status])}</span>
        </div>
        <p class="sub" style="margin:.5rem 0 0">
          {serviceMoneyLine(svc)} · {svc.owner_name ? tr('odpovídá {name}', { name: svc.owner_name }) : tr('bez odpovědné osoby')}
        </p>
        {svc.description ? <p class="sub" style="margin:.3rem 0 0">{svc.description}</p> : null}
      </div>

      {/* Čerpání — kompletní zpráva: mini-graf burn-up + jednotlivé výkazy (vše o čerpání pohromadě) */}
      {showCerpani ? (
        <div class="card" style="margin-top:1rem">
          <div class="card-head">
            <h3>{tr('Čerpání')}</h3>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              <MonthNav month={props.month} hrefFor={(m) => `${detailBase}?mesic=${m}`} />
              {props.canVykaz && svc.status === 'active' ? (
                <button class="btn btn-sm" type="button" hx-get={`/vykazy/modal/novy?klient=${client.id}&sluzba=${sid}&back=${encodeURIComponent(vykBack)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Vykázat práci')}</button>
              ) : null}
            </div>
          </div>

          {/* mini-graf burn-up — nad jednotlivými záznamy čerpání */}
          {refH != null ? (
            <>
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:.3rem">
                <span style="font-size:.95rem">
                  {tr('Vyčerpáno')} <b>{fmtMinutes(spentMin)}</b>
                  <span class="sub"> {tr('z')} {kc(refH)} {tr('h')} {hasSvcBudget ? tr('rozpočtu služby') : tr('paušálu klienta')}</span>
                </span>
                <span style={over ? 'color:var(--red);font-weight:700' : 'font-weight:700'}>{burnPct} %</span>
              </div>
              <div class="progress"><i style={`width:${Math.min(100, burnPct)}%${over ? ';background:var(--red)' : ''}`}></i></div>
              {over || alertHit || (svc.allow_overage === 1 && hasSvcBudget) ? (
                <div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">
                  {over ? (
                    <span class="chip chip-soft-orange">{svc.allow_overage === 1 ? tr('Přečerpáno (povoleno)') : tr('Přečerpáno bez povolení')}</span>
                  ) : alertHit ? (
                    <span class="chip chip-soft-orange">{tr('Blíží se limitu ({pct} %)', { pct: String(alertPct) })}</span>
                  ) : null}
                  {svc.allow_overage === 1 && hasSvcBudget && !over ? <span class="chip chip-soft-gray">{tr('přečerpání povoleno')}</span> : null}
                </div>
              ) : null}
              {hasActivePausal ? (
                <p class="sub" style="margin:.55rem 0 0;font-size:.78rem">
                  {tr('Z paušálu klienta je službám předem přiděleno celkem {a} z {b} h', { a: kc(props.allocatedTotal), b: kc(client.hours_budget_monthly!) })}
                </p>
              ) : null}
            </>
          ) : null}

          {/* jednotlivé záznamy čerpání — kompletní výkazy služby (detail, editace, schválení) */}
          {props.canVykaz ? (
            props.records.length === 0 ? (
              <div style={refH != null ? 'margin-top:.7rem;padding-top:.2rem;border-top:1px solid var(--line)' : ''}>
                <EmptyState text={tr('U této služby zatím není v tomto měsíci vykázaná žádná práce.')}>
                  {svc.status === 'active' ? (
                    <button class="btn btn-sm btn-primary" type="button" hx-get={`/vykazy/modal/novy?klient=${client.id}&sluzba=${sid}&back=${encodeURIComponent(vykBack)}`} hx-target="#modal" hx-swap="innerHTML">{tr('Vykázat práci')}</button>
                  ) : null}
                </EmptyState>
              </div>
            ) : (
              <div style={refH != null ? 'margin-top:.6rem' : ''}>
                {props.records.map((r) => (
                  <WorkRecordRow r={r} person={props.person} ownerId={client.owner_id} back={vykBack} showAmount={!hasActivePausal} />
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {/* Dění u služby — stručný log (výkazy jen jednořádkově „pro úplnost") + poznámky/komentáře */}
      <div class="card" style="margin-top:1rem">
        <div class="card-head">
          <h3>{tr('Dění u služby')}</h3>
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            {showCerpani ? (
              <span class="sub" style="text-transform:capitalize">{monthLabel(props.month)}</span>
            ) : (
              <MonthNav month={props.month} hrefFor={(m) => `${detailBase}?mesic=${m}`} />
            )}
            <button class="btn btn-sm" type="button" hx-get={novaPoznamkaUrl} hx-target="#modal" hx-swap="innerHTML">{tr('Nová poznámka')}</button>
          </div>
        </div>
        {feed.length === 0 ? (
          <EmptyState text={tr('V tomto měsíci se u služby nic nedělo.')}>
            <button class="btn btn-sm btn-primary" type="button" hx-get={novaPoznamkaUrl} hx-target="#modal" hx-swap="innerHTML">{tr('Napsat poznámku')}</button>
          </EmptyState>
        ) : (
          <div>
            {feed.map((it) =>
              it.kind === 'work' ? (
                <WorkLogLine r={it.r} />
              ) : (
                <NoteCard n={it.n} person={props.person} back={detailBase} feedKind="service" subjectId={sid} canTask={props.canTask} layout="feed" />
              ),
            )}
          </div>
        )}
      </div>
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
  const [catalog, coworkers, services] = await Promise.all([listCatalog(g.t), listCoworkers(g.t), listClientServices(g.t, g.clientId)]);
  const allocatedOther = services.filter((x) => x.status !== 'ended').reduce((sum, x) => sum + (x.budget_hours ?? 0), 0);
  return c.html(
    <ServiceModal
      base={g.base}
      service={null}
      available={catalog.filter((it) => it.active === 1)}
      coworkers={coworkers}
      defaultOwnerId={g.client.owner_id}
      clientBudgetHours={g.client.hours_budget_monthly}
      allocatedOther={allocatedOther}
    />,
  );
});

sluzbyZakaznikaRoutes.get('/firmy/:id/sluzby/:sid/modal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const svc = await getClientService(g.t, c.req.param('sid'));
  if (!svc || svc.client_id !== g.clientId) return c.notFound();
  const [coworkers, services] = await Promise.all([listCoworkers(g.t), listClientServices(g.t, g.clientId)]);
  const allocatedOther = services.filter((x) => x.status !== 'ended' && x.id !== svc.id).reduce((sum, x) => sum + (x.budget_hours ?? 0), 0);
  return c.html(
    <ServiceModal
      base={g.base}
      service={svc}
      available={[]}
      coworkers={coworkers}
      defaultOwnerId={g.client.owner_id}
      clientBudgetHours={g.client.hours_budget_monthly}
      allocatedOther={allocatedOther}
    />,
  );
});

sluzbyZakaznikaRoutes.get('/firmy/:id/pausal/modal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;
  return c.html(<RetainerModal base={g.base} client={g.client} />);
});

// --- detail služby (čte i nepadmin; akce úprav jen admin) ---
sluzbyZakaznikaRoutes.get('/firmy/:id/sluzby/:sid', async (c) => {
  const person = c.get('person');
  if (!person) return c.redirect('/login');
  if (!c.get('modules').has('zakaznici')) return c.redirect('/');
  const t = person.tenant_id;
  const clientId = c.req.param('id');
  const sid = c.req.param('sid');
  const [client, svc] = await Promise.all([getClient(t, clientId), getClientService(t, sid)]);
  if (!client || !svc || svc.client_id !== clientId) return c.notFound();
  const base = `/firmy/${clientId}`;
  const detailBase = `${base}/sluzby/${sid}`;
  const canVykaz = c.get('modules').has('vykazy');
  const rawMonth = c.req.query('mesic') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : monthKey(new Date());
  const [records, notes, allServices] = await Promise.all([
    canVykaz ? listForService(t, sid, month) : Promise.resolve([] as WorkRecord[]),
    notesForEntity(t, 'service', sid, person.id),
    listClientServices(t, clientId),
  ]);
  const allocatedTotal = allServices.filter((x) => x.status !== 'ended').reduce((sum, x) => sum + (x.budget_hours ?? 0), 0);
  return c.html(
    <Layout title={svc.label} person={person} modules={c.get('modules')} active="zakaznici">
      <ServiceDetail
        base={base}
        detailBase={detailBase}
        client={client}
        svc={svc}
        isAdmin={person.is_admin === 1}
        canVykaz={canVykaz}
        allocatedTotal={allocatedTotal}
        month={month}
        records={records}
        notes={notes}
        person={person}
        canTask={c.get('modules').has('ukoly')}
      />
    </Layout>,
  );
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
    budgetHours: num(body.budget_hours),
    allowOverage: String(body.allow_overage ?? '') === '1',
    alertPct: num(body.alert_pct),
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
    (svc.budget_hours ?? null) === input.budgetHours &&
    (svc.allow_overage === 1) === input.allowOverage &&
    (svc.alert_pct ?? null) === input.alertPct &&
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
  if (!status || status === svc.status) return c.redirect(`${g.base}?tab=sluzby`);

  await setClientServiceStatus(g.t, svc.id, status);
  // ukončenou službu lze znovu aktivovat (Aktivovat službu) — odliš od obnovení pozastavené
  const verb =
    status === 'active' ? (svc.status === 'ended' ? 'znovu aktivována' : 'obnovena') : status === 'paused' ? 'pozastavena' : 'ukončena';
  await logEvent(g.t, 'client', g.clientId, g.person.id, `Služba „${svc.label}${svc.detail ? ` · ${svc.detail}` : ''}" ${verb}`);
  return c.redirect(`${g.base}?tab=sluzby`);
});

sluzbyZakaznikaRoutes.post('/firmy/:id/pausal', async (c) => {
  const g = await guard(c);
  if (g instanceof Response) return g;

  const body = await c.req.parseBody();
  const hours = num(body.hours);
  const hourlyRate = num(body.rate);
  const overageRate = num(body.overage_rate);
  const rollover = String(body.rollover ?? '') === '1';

  // beze změn → nic neukládat ani nelogovat (Historie = jen reálné změny)
  const cl = g.client;
  if (
    (cl.hours_budget_monthly ?? null) === hours &&
    (cl.retainer_hourly_rate ?? null) === (hours === null ? null : hourlyRate) &&
    (cl.overage_rate ?? null) === (hours === null ? null : overageRate) &&
    (cl.hours_rollover === 1) === (hours === null ? false : rollover)
  ) {
    return c.redirect(`${g.base}?tab=sluzby`);
  }

  await setClientRetainer(g.t, g.clientId, { hours, hourlyRate, overageRate, rollover });
  await logEvent(
    g.t,
    'client',
    g.clientId,
    g.person.id,
    hours === null
      ? 'Paušál hodin zrušen'
      : `Paušál nastaven: ${kc(hours)} h/měs${hourlyRate !== null ? ` × ${kc(hourlyRate)} Kč/h` : ''}${overageRate !== null ? `, vícepráce ${kc(overageRate)} Kč/h` : ''}, nevyčerpané hodiny se ${rollover ? 'převádějí' : 'nepřevádějí'}`,
  );
  return c.redirect(`${g.base}?tab=sluzby`);
});
