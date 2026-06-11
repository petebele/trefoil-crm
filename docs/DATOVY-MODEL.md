# Datový model — Conviu CRM v2 (blueprint)

> Převzatý a osvědčený flexibilní základ z v1 (tam prošel architektonickou revizí a praxí).
> Detailní sloupce se definují ve specifikaci příslušného modulu; tady je závazná kostra.
> Zásady: SQLite (soubor) přes **Kysely** — dotazy přenositelné na PostgreSQL; časy jako ISO text;
> booleany 0/1; všude `tenant_id` (single-tenant teď, multi-tenant možný později); soft-delete
> `deleted_at` u uživatelsky mazaných entit.

## Princip

Pár obecných stavebních kamenů místo zadrátovaných tabulek — **rozšiřitelné, ale jednoduše
spravovatelné**. Flexibilita v backendu (typy, role, konfigurovatelné Seznamy), UI zůstává
jednoduché a rozdělené (Zákazníci × Administrace). Žádný „object builder".

## Tabulky

### Lidé a klienti
| Tabulka | Účel |
|---|---|
| `persons` | Všichni lidé — kolegové (mají `login_email`+`password_hash`) i kontakty (nemají). Povahu určují **role**. |
| `clients` | Zákazník: `kind` = company/person; název, IČO/DIČ, web, stav (ze Seznamu), odpovědný (`owner_id`→persons), poznámka. |
| `person_clients` | M:N Osoba↔Firma + `role_at_client` (ze Seznamu) + `is_primary`. Osoba může působit u více Firem. |
| `person_contacts` | Kontaktní údaje: `owner_kind` person/client + `owner_id`, `type` (ze Seznamu), `value`, `label`, volitelně `client_id` (kontext: firemní mobil), `is_primary`. |

### Konfigurovatelné Seznamy
| Tabulka | Účel |
|---|---|
| `lists` | Definice číselníku: `key` (`client_statuses`, `client_tags`, `service_catalog`, `contact_types`, `roles_at_client`, `engagement_statuses`, `deal_stages`, `task_categories`…), `label`. |
| `list_items` | Položky: `value`, `label`, `color`, `sort_order`, `active`. |
| `entity_list_items` | „Nalepení" položky na záznam (štítky): `entity_kind`+`entity_id`+`list_item_id`. |

### Role a práva (RBAC)
| Tabulka | Účel |
|---|---|
| `roles` | Pojmenovaná sada práv; `is_system`, `auto_for_customer` (role Zákazník se přiřazuje automaticky). |
| `role_permissions` | role → permission (klíče pevně v kódu: `clients.view/create/edit_own/edit_any/delete_any`, `tasks.*`, `services.manage`, `admin.team/lists/roles`…). |
| `person_roles` | Osoba má 1+ rolí. |
| `person_permissions` | Override na osobě (allow 0/1) nad součtem rolí. |

Výpočet: sjednocení práv ze všech rolí ∪/∖ override. Helper `effectivePermissions(personId)`.

### Provoz
| Tabulka | Účel |
|---|---|
| `sessions` | Cookie session (httpOnly token, expirace). Hesla scrypt (Node crypto). |
| `services` | Aktivní služba u klienta: `catalog_item_id` (položka Seznamu), stav active/paused/ended, od/do, cena, `owner_id`. |
| `engagements` | Zakázka: klient, název, cíl, stav (ze Seznamu — kanban), odpovědný, termíny. |
| `milestones` | Milníky zakázky: název, termín, hotovo, pořadí. |
| `deals` | Příležitost: klient (volitelně), titulek, fáze (ze Seznamu — pipeline), hodnota, odpovědný, očekávaná uzávěrka, zdroj. |
| `activities` | Timeline: klient, volitelně osoba, `type` note/email/call/meeting, text, kdy, autor. |
| `tasks` | Úkol: titulek, kategorie (ze Seznamu), volitelně klient/zakázka/deal, termín `due_at`, odklad `remind_at`, hotovo, přiřazený. |
| `tenants` | Nositel multi-tenant připravenosti (teď 1 řádek „Conviu"). |

## Lekce z v1 (závazné)

- **Všechny `*_id` vazby s referencí** (FK) — žádné volné stringy.
- Tenant scoping ve **všech** dotazech (where tenant_id).
- Seed idempotentní: Seznamy + role + tým doplňovat i do existující DB; ukázková data jen poprvé.
- Kategorie úkolů a stavy = Seznamy s `color` (mapují se na chipy z UI zásad).
