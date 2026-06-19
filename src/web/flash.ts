import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { AppEnv } from '../types';

export type FlashType = 'success' | 'error' | 'info';

/**
 * Jednorázová „hláška" (toast) po akci. Server ji uloží do krátké cookie `flash`; `app.js` ji po
 * načtení stránky **i po htmx swapu** přečte, zobrazí jako bublinu a cookie smaže. Tím funguje jak
 * pro plné navigace (form POST → redirect, např. schválení), tak pro htmx fragmenty. Hodnota je
 * JSON `{m,t}` — `setCookie` ho sám URL‑enkóduje (kvůli diakritice a cookie‑bezpečnosti), proto tu
 * **nesmíme** enkódovat ručně (jinak dvojité enkódování → `JSON.parse` na klientu spadne). Volá se
 * před `c.redirect(...)`.
 */
export function flash(c: Context<AppEnv>, message: string, type: FlashType = 'success'): void {
  setCookie(c, 'flash', JSON.stringify({ m: message, t: type }), {
    path: '/',
    maxAge: 30,
    sameSite: 'Lax',
  });
}
