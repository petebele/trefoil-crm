import { randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

export const now = (): string => new Date().toISOString();

/**
 * Pomocník pro čtení hodnot z odeslaného formuláře (`c.req.parseBody()`).
 * Sjednocuje opakovaný vzor `String(body.x ?? '').trim()` napříč handlery.
 */
export function readForm(body: Record<string, unknown>) {
  return {
    /** Surový text bez ořezu (např. heslo — mezery můžou být záměr). */
    raw: (k: string): string => String(body[k] ?? ''),
    /** Ořezaný text. */
    str: (k: string): string => String(body[k] ?? '').trim(),
    /** Ořezaný text; prázdný → null. */
    strOrNull: (k: string): string | null => String(body[k] ?? '').trim() || null,
    /** E-mail: ořez + malá písmena. */
    email: (k: string): string => String(body[k] ?? '').trim().toLowerCase(),
    /** Zaškrtnutí (checkbox/hidden) je true, pokud hodnota === '1'. */
    flag: (k: string): boolean => String(body[k] ?? '') === '1',
  };
}
