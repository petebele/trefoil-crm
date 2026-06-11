import type { PersonsTable, TenantsTable } from './db/schema';

/** Prostředí Hono — co middleware vkládá do kontextu každého požadavku. */
export type AppEnv = {
  Variables: {
    person: PersonsTable | null;
    tenant: TenantsTable | null;
    modules: Set<string>; // zapnuté moduly Organizace
  };
};
