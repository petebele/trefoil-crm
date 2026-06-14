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
  services: ServicesTable;
  work_records: WorkRecordsTable;
  tasks: TasksTable;
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
  position: string | null; // pozice v týmu (prostý text, např. „SEO specialista")
  note: string | null;
  lang: string | null; // jazyk UI ('cs' | 'en'); null = výchozí
  created_at: string;
  deleted_at: string | null;
}

/** Firma (zákazník typu společnost). kind připraven i na person-klienta. */
export interface ClientsTable {
  id: string;
  tenant_id: string;
  kind: 'company' | 'person';
  name: string; // Název firmy (právní/fakturační název)
  display_name: string | null; // Název zákazníka (zkrácený, do hlavičky); prázdné → fallback na name
  ico: string | null;
  dic: string | null;
  website: string | null;
  address: string | null; // legacy volný text — fallback, když nejsou strukturovaná pole
  // strukturovaná (mezinárodní) adresa
  street: string | null;
  house_no: string | null; // č.p./č.o.
  address2: string | null; // 2. řádek adresy
  city: string | null;
  postal_code: string | null;
  country: string | null;
  status: string; // hodnota ze Seznamu client_statuses
  owner_id: string | null; // odpovědná osoba (kolega)
  note: string | null;
  hours_budget_monthly: number | null; // paušál hodin (h/měs) — jeden na zákazníka
  retainer_price: number | null; // cena paušálu (Kč/měs)
  hours_rollover: number; // 0/1 — převádět nevyčerpané hodiny do dalšího měsíce
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Služba přidělená zákazníkovi — režim/sazba/osoba per klient (výchozí z katalogu).
 *  Stejná služba může běžet u klienta vícekrát; rozlišuje ji `detail` (upřesnění). */
export interface ServicesTable {
  id: string;
  tenant_id: string;
  client_id: string;
  catalog_item_id: string; // položka Seznamu service_catalog
  detail: string | null; // upřesnění služby (odlišení opakovaných přidělení)
  description: string | null; // popis — co v rámci služby pro klienta děláme
  mode: 'subscription' | 'retainer' | 'payg';
  rate: number | null; // hodinová sazba Kč/h (override katalogu)
  monthly_amount: number | null; // částka předplatného Kč/měs (jen subscription)
  owner_id: string | null; // odpovědná osoba za službu u TOHOTO klienta
  status: 'active' | 'paused' | 'ended';
  created_at: string;
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

/** Výkaz práce — čas na zákazníka+službu; schválením se zamkne a počítá do peněz. */
export interface WorkRecordsTable {
  id: string;
  tenant_id: string;
  client_id: string;
  service_id: string; // služba zákazníka (services)
  worker_id: string; // kdo pracoval
  description: string; // úkon
  note: string | null;
  minutes: number;
  performed_at: string; // den práce (YYYY-MM-DD)
  billing: 'retainer_hours' | 'billed' | 'free'; // z paušálu / účtovat zvlášť / neúčtovat
  status: 'pending' | 'approved';
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
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

/** Úkol — osobní/týmové to‑do, volitelně navázané na zákazníka. */
export interface TasksTable {
  id: string;
  tenant_id: string;
  title: string;
  category_item_id: string | null; // Seznam task_categories (barevný chip)
  client_id: string | null; // vazba na zákazníka (volitelná)
  assignee_id: string | null; // kdo má úkol splnit
  due_at: string | null; // termín (YYYY-MM-DD)
  done: number; // 0/1
  done_at: string | null;
  source_kind: string | null; // u auto‑úkolů původ záznamu, např. 'work_record'
  source_id: string | null;
  created_by_id: string | null;
  created_at: string;
}
