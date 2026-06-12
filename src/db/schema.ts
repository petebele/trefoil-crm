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
  clients: ClientsTable;
  person_clients: PersonClientsTable;
  person_contacts: PersonContactsTable;
  lists: ListsTable;
  list_items: ListItemsTable;
  entity_list_items: EntityListItemsTable;
  events: EventsTable;
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

/** Osoba — kolega s přihlášením i zákaznická osoba/kontakt (bez přihlášení). */
export interface PersonsTable {
  id: string;
  tenant_id: string;
  name: string;
  login_email: string | null;
  password_hash: string | null;
  is_admin: number; // dočasné — nahradí RBAC role
  is_active: number;
  note: string | null;
  created_at: string;
  deleted_at: string | null;
}

/** Firma (zákazník typu společnost). kind připraven i na person-klienta. */
export interface ClientsTable {
  id: string;
  tenant_id: string;
  kind: 'company' | 'person';
  name: string;
  ico: string | null;
  dic: string | null;
  website: string | null;
  address: string | null;
  status: string; // hodnota ze Seznamu client_statuses
  owner_id: string | null; // odpovědná osoba (kolega)
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Vazba osoba ↔ firma (osoba může působit u více firem). */
export interface PersonClientsTable {
  tenant_id: string;
  person_id: string;
  client_id: string;
  role_at_client: string | null; // hodnota ze Seznamu roles_at_client
  is_primary: number;
}

/** Kontaktní údaj — patří osobě nebo firmě; label = štítek typu ze Seznamu contact_labels. */
export interface PersonContactsTable {
  id: string;
  tenant_id: string;
  owner_kind: 'person' | 'client';
  owner_id: string;
  type: 'phone' | 'email' | 'web' | 'other';
  value: string;
  label: string | null;
  client_id: string | null; // kontext: kontakt platí pro tuto firmu
  is_primary: number;
  created_at: string;
}

/** Konfigurovatelný Seznam (číselník). */
export interface ListsTable {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
}

export interface ListItemsTable {
  id: string;
  tenant_id: string;
  list_id: string;
  value: string;
  label: string;
  color: string | null;
  sort_order: number;
  active: number;
  meta: string | null; // JSON snippet s detaily položky (konvence: rozšiřitelnost bez nových sloupců)
}

/** Nalepení položky Seznamu na záznam (štítky). */
export interface EntityListItemsTable {
  tenant_id: string;
  entity_kind: 'client' | 'person';
  entity_id: string;
  list_item_id: string;
}

/** Obecný log událostí (Historie) — kdo, kdy, u čeho, co se stalo. */
export interface EventsTable {
  id: string;
  tenant_id: string;
  entity_kind: string; // 'client' | 'person' | …
  entity_id: string;
  person_id: string | null; // kdo akci provedl
  action: string; // lidský popis: „Firma založena", „Přidán kontakt…"
  created_at: string;
}

export interface SessionsTable {
  id: string;
  person_id: string;
  expires_at: string;
  created_at: string;
}
