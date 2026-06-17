import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { config } from '../config';
import type { Database as DB } from './schema';

mkdirSync(dirname(config.dbFile), { recursive: true });

const sqlite = new Database(config.dbFile);
sqlite.pragma('journal_mode = WAL'); // čtenáři neblokují zapisovatele (a naopak) — víc uživatelů naráz
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000'); // počkej až 5 s, kdyby DB krátce držel zámek (např. záloha), místo chyby

/**
 * Jediný přístupový bod k databázi.
 * SEAM pro budoucí škálování: přechod na PostgreSQL = výměna dialektu zde,
 * dotazy v doménové vrstvě zůstanou beze změny.
 */
export const db = new Kysely<DB>({
  dialect: new SqliteDialect({ database: sqlite }),
});
