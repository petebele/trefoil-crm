import type { PersonsTable, TenantsTable } from './db/schema';
import type { Locale } from './i18n';

/** Prostředí Hono — co middleware vkládá do kontextu každého požadavku. */
export type AppEnv = {
  Variables: {
    person: PersonsTable | null; // EFEKTIVNÍ osoba (při impersonaci = cíl, jinak přihlášený)
    impersonator: PersonsTable | null; // skutečný admin, prohlíží‑li „jako někdo jiný" (jinak null)
    tenant: TenantsTable | null;
    modules: Set<string>; // zapnuté moduly Organizace
    locale: Locale; // jazyk UI požadavku
  };
};
