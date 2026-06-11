/**
 * Popis databáze pro Kysely (typový kontrakt nad tabulkami) — kostra.
 * Moduly si své tabulky přidají vlastními migracemi (viz docs/DATOVY-MODEL.md).
 * Booleany = integer 0/1. Časy = text v ISO formátu (přenositelné na PostgreSQL).
 */
export interface Database {
  tenants: TenantsTable;
  tenant_modules: TenantModulesTable;
  persons: PersonsTable;
  sessions: SessionsTable;
}

/** Organizace = společnost, která CRM používá (prostor týmu). */
export interface TenantsTable {
  id: string;
  name: string;
  created_at: string;
}

/** Zapnuté moduly Organizace (přítomnost řádku = zapnuto). */
export interface TenantModulesTable {
  tenant_id: string;
  module: string; // klíč z registru modulů (src/modules.ts)
}

/** Osoba — kolega s přihlášením i (později) kontakt u zákazníka. */
export interface PersonsTable {
  id: string;
  tenant_id: string;
  name: string;
  login_email: string | null;
  password_hash: string | null;
  is_admin: number; // dočasné — v Kroku 5 nahradí RBAC role
  is_active: number;
  created_at: string;
  deleted_at: string | null;
}

export interface SessionsTable {
  id: string;
  person_id: string;
  expires_at: string;
  created_at: string;
}
