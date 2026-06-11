import { resolve } from 'node:path';

/** Konfigurace aplikace. Vše má rozumný default, takže appka běží i bez .env. */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbFile: process.env.DB_FILE ?? resolve('data', 'crm.db'),
  sessionTtlDays: 30,
};
