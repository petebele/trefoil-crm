import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';
import { tr, getLocale, fmtDateLong } from '../i18n';

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

dashboardRoutes.get('/', (c) => {
  const person = c.get('person')!;
  const firstName = person.name.split(/\s+/)[0] ?? person.name;
  // český vokativ má smysl jen v češtině; v angličtině jen křestní jméno
  const greetName = getLocale() === 'cs' ? vocative(firstName) : firstName;
  const today = new Date();

  return c.html(
    <Layout title={tr('Nástěnka')} person={person} modules={c.get('modules')} active="nastenka">
      <div class="date-line">{fmtDateLong(today)}</div>
      <h1>
        {tr(greeting(today.getHours()))}, {greetName}
      </h1>

      <div class="card" style="margin-top:1.5rem">
        <div class="empty">
          <span class="big">✓</span>
          {tr('Nástěnka se plní s každým zapnutým modulem.')}
          <div class="hint">{tr('Přehled úkolů, aktivita a naposledy zobrazené záznamy se objeví, jakmile moduly postavíme.')}</div>
        </div>
      </div>
    </Layout>,
  );
});
