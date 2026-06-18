import { AsyncLocalStorage } from 'node:async_hooks';
import { EN } from './en';

/**
 * Lokalizace (i18n). Princip: **čeština je zároveň klíč** — `t('Zákazníci')`
 * vrací v češtině přesně klíč, v angličtině překlad ze slovníku `EN`. Díky tomu
 * česká verze nikdy neregreduje a nepřeložené texty zůstanou (dočasně) česky.
 *
 * Aktivní jazyk se nese přes AsyncLocalStorage (nastaví ho middleware pro celý
 * požadavek), takže `t()` i formátovače fungují kdekoliv — i hluboko v komponentách
 * — bez protahování parametru. Formáty (datum, čísla, měna) jdou podle jazyka.
 */

export type Locale = 'cs' | 'en';

export interface LocaleDef {
  id: Locale;
  /** Název jazyka ve vlastním jazyce (do přepínače). */
  label: string;
  /** BCP-47 kód pro Intl (formáty data a čísel). */
  intl: string;
  /** Token měny (Kč → CZK). Číslo formátuje fmtNum, jednotku dodává slovník. */
  currency: string;
}

export const LOCALES: LocaleDef[] = [
  { id: 'cs', label: 'Čeština', intl: 'cs-CZ', currency: 'Kč' },
  { id: 'en', label: 'English', intl: 'en-GB', currency: 'CZK' },
];

export const DEFAULT_LOCALE: Locale = 'cs';

export function isLocale(s: string | null | undefined): s is Locale {
  return s === 'cs' || s === 'en';
}

const store = new AsyncLocalStorage<Locale>();

/** Spustí funkci (typicky zpracování požadavku) v kontextu daného jazyka. */
export function runWithLocale<T>(locale: Locale, fn: () => T): T {
  return store.run(locale, fn);
}

/** Aktivní jazyk požadavku (mimo požadavek → výchozí). */
export function getLocale(): Locale {
  return store.getStore() ?? DEFAULT_LOCALE;
}

function localeDef(): LocaleDef {
  const id = getLocale();
  return LOCALES.find((l) => l.id === id) ?? LOCALES[0]!;
}

/**
 * Překlad textu. V češtině vrací klíč beze změny, v angličtině překlad ze
 * slovníku (chybí-li, vrátí klíč). Parametry: `tr('Smazat {name}?', { name })`.
 * Pojmenováno `tr` (ne `t`) — `t` je v kódu zaběhlé pro tenant_id.
 */
export function tr(key: string, params?: Record<string, string | number>): string {
  let s = getLocale() === 'cs' ? key : (EN[key] ?? key);
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// ---------- formátování podle jazyka ----------

/** Datum (např. 14. 6. 2026 / 14/06/2026). */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeDef().intl, { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** Datum a čas. */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(localeDef().intl, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Číslo podle jazyka (oddělovače tisíců i desetinné). */
export function fmtNum(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(localeDef().intl, opts);
}

/** Token měny aktivního jazyka (Kč / CZK). */
export function currency(): string {
  return localeDef().currency;
}

/** Relativní čas („před 5 min" / „5 min ago"). */
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return tr('právě teď');
  if (min < 60) return tr('před {n} min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return tr('před {n} h', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? tr('včera') : tr('před {n} dny', { n: d });
}

/** Čerstvé relativně (do 2 dnů: „před 5 min", „včera"), starší absolutním datem. */
export function relOrDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 2 ? relTime(iso) : fmtDate(iso);
}

/** Měsíc a rok dlouze (např. „červen 2026" / „June 2026"). */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(localeDef().intl, { month: 'long', year: 'numeric' });
}

/** Datum dlouze i s dnem v týdnu (pozdrav na nástěnce). */
export function fmtDateLong(d: Date): string {
  return d.toLocaleDateString(localeDef().intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
