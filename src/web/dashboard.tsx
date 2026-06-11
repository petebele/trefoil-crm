import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { Layout } from './layout';

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
  const today = new Date();
  const dateLine = today.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return c.html(
    <Layout title="Nástěnka" person={person} modules={c.get('modules')} active="nastenka">
      <div class="date-line">{dateLine}</div>
      <h1>
        {greeting(today.getHours())}, {vocative(firstName)}
      </h1>

      <div class="card" style="margin-top:1.5rem">
        <div class="empty">
          <span class="big">✓</span>
          Nástěnka se plní s každým zapnutým modulem.
          <div class="hint">Přehled úkolů, aktivita a naposledy zobrazené záznamy se objeví, jakmile moduly postavíme.</div>
        </div>
      </div>
    </Layout>,
  );
});
