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
  task_statuses: TaskStatusesTable;
  person_prefs: PersonPrefsTable;
  notes: NotesTable;
  note_links: NoteLinksTable;
  notifications: NotificationsTable;
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
  retainer_hourly_rate: number | null; // sazba za 1 paušální hodinu (Kč/h)
  retainer_price: number | null; // cena paušálu (Kč/měs) — odvozeno = hodiny × sazba
  overage_rate: number | null; // sazba za vícepráce nad paušál (Kč/h); null = sazba služby
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
  budget_hours: number | null; // alokované hodiny z klientského paušálu (h/měs); null = bez alokace
  allow_overage: number; // 0/1 — smí přečerpat svou alokaci (čerpá z jiných služeb do stropu klienta)
  alert_pct: number | null; // práh upozornění na čerpání v % (null = výchozí 80)
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
  entity_kind: 'client' | 'person' | 'task'; // task = štítky úkolu (Seznam task_labels)
  entity_id: string;
  list_item_id: string;
}

/** Výkaz práce — čas na zákazníka+službu; schválením se zamkne a počítá do peněz. */
export interface WorkRecordsTable {
  id: string;
  tenant_id: string;
  client_id: string;
  service_id: string; // služba zákazníka (services)
  task_id: string | null; // volitelná vazba na úkol, z něhož se vykazovalo
  worker_id: string; // kdo pracoval
  description: string; // úkon
  note: string | null;
  minutes: number;
  performed_at: string; // den práce (YYYY-MM-DD)
  billing: 'retainer_hours' | 'billed' | 'free'; // z paušálu / účtovat zvlášť / neúčtovat
  status: 'pending' | 'approved' | 'returned' | 'rejected'; // čeká / schváleno / vráceno k přepracování / zamítnuto
  approved_by_id: string | null;
  approved_at: string | null;
  // poznámka schvalovatele k rozhodnutí: instrukce (returned) nebo důvod zamítnutí (rejected). Uvidí ji pracovník.
  rejection_reason: string | null;
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
  done: number; // 0/1 — „vyřízeno"; drží se v synchronu se stavem is_done
  done_at: string | null;
  // Kanban (Úkoly v2)
  status_id: string | null; // sloupec/stav (task_statuses řešitele); null = odvodí se z done
  prev_status_id: string | null; // stav před přesunem do „Hotovo" (pro odškrtnutí)
  archived: number; // 0/1 — skryto z boardu, zůstává v historii
  board_month: string | null; // YYYY-MM; null = trvalý/osobní board
  sort_order: number; // pořadí karty ve sloupci
  source_kind: string | null; // u auto‑úkolů původ záznamu, např. 'work_record'
  source_id: string | null;
  created_by_id: string | null;
  created_at: string;
}

/**
 * Poznámka — samostatný objekt s formátovaným textem. Obsah je **očištěné HTML**
 * (allowlist, viz src/domain/notes.ts). Váže se na entity přes `note_links` (víc naráz).
 */
export interface NotesTable {
  id: string;
  tenant_id: string;
  title: string | null; // volitelný nadpis poznámky
  body_html: string; // bezpečné formátované HTML (po sanitizaci)
  created_by_id: string | null;
  is_private: number; // 0/1 — soukromá vidí jen autor
  created_at: string;
  updated_at: string;
}

/** Vazba poznámky na entitu (zákazník/osoba; později projekt/úkol/výkaz). M:N. */
export interface NoteLinksTable {
  tenant_id: string;
  note_id: string;
  entity_kind: string; // 'client' | 'person' | …
  entity_id: string;
  sort_order: number; // ruční pořadí poznámek u entity (drag/drop v mozaice); menší = výš
}

/**
 * Notifikace — adresná schránka „co se týká tebe" (na rozdíl od neadresného logu `events`).
 * Přečtení je měkký stav (`read_at`); záznam se nemaže (princip „nic se nemaže").
 */
export interface NotificationsTable {
  id: string;
  tenant_id: string;
  recipient_id: string; // komu je oznámení určeno
  actor_id: string | null; // kdo akci vyvolal
  type: string; // druh oznámení (NotificationType v domain/notifications.ts)
  title: string; // lidský titulek
  body: string | null; // krátký detail (název úkonu, výňatek instrukcí)
  entity_kind: string; // k čemu se váže (work_record | task | client …)
  entity_id: string;
  link: string; // kam vede kliknutí
  read_at: string | null; // čas přečtení; null = nepřečteno
  created_at: string;
}

/**
 * Per‑uživatelské předvolby (klíč → hodnota). Obecný úložný bod pro drobné volby
 * uživatele, např. zvolené zobrazení modulu (`ukoly.view` = 'agenda' | 'kanban').
 */
export interface PersonPrefsTable {
  tenant_id: string;
  person_id: string;
  key: string;
  value: string;
}

/** Stavy úkolů = sloupce Kanbanu, konfigurovatelné PER UŽIVATEL (Úkoly v2). */
export interface TaskStatusesTable {
  id: string;
  tenant_id: string;
  owner_id: string; // čí board (persons.id)
  label: string;
  color: string | null;
  sort_order: number;
  is_done: number; // 0/1 — „stav vyřízeného úkolu" (default u „Hotovo")
  is_default: number; // 0/1 — povinný „Inbox/Zásobník": nové + nezařazené úkoly, nelze smazat
  created_at: string;
}
