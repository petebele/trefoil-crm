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
| `services` | Aktivní služba u klienta: `catalog_item_id` (položka Seznamu), stav active/paused/ended, od/do, **`monthly_spend` (orientační měsíční spend Kč)**, `owner_id`. Součet spendů = celkový orientační spend zákazníka. |
| `work_records` | **Výkaz práce**: `client_id`, volitelně `service_id`, `worker_id` (kdo pracoval), `description` (úkon), `note` (detail, volitelně), `minutes`, `performed_at`, **`status` pending/approved**, `approved_by_id`, `approved_at`. Každý záznam má dohledatelné ID. Při založení se automaticky vytvoří úkol pro odpovědnou osobu zákazníka (schválení). |
| `engagements` | Zakázka: klient, název, cíl, stav (ze Seznamu — kanban), odpovědný, termíny. |
| `milestones` | Milníky zakázky: název, termín, hotovo, pořadí. |
| `deals` | Příležitost: klient (volitelně), titulek, fáze (ze Seznamu — pipeline), hodnota, odpovědný, očekávaná uzávěrka, zdroj. |
| `activities` | Timeline: klient, volitelně osoba, `type` note/email/call/meeting, text, kdy, autor. |
| `tasks` | Úkol: titulek, kategorie (ze Seznamu), volitelně klient/zakázka/deal, termín `due_at`, odklad `remind_at`, hotovo, přiřazený. |
| `tenants` | Organizace (nositel multi-tenant připravenosti). |

**Fakturační model (hybrid — finální podoba 12. 6. 2026, vzor Accelo/Productive,
podklad `Komunikace\Strategie\Retainer management a fakturace - PSOHUB 20260612.md`):**

- **Služba u zákazníka** má dva režimy (výchozí hodnoty z katalogu, u zákazníka vše
  přepsatelné — stejná služba může být u každého klienta nastavená jinak):
  - **Předplatné** — fixní položka bez hodin (typicky SaaS/licence/nástroj, různý
    rozsah = různá částka). Cena **volitelná**: vyplněná se propisuje do měsíčního
    reportu/fakturace, prázdná = jen evidence, že službu má.
  - **Paušál s hodinami** — cena (Kč/měs) + počet hodin v ceně (h/měs). Žádný
    zvláštní „balík hodin" u klienta neexistuje — obecné předplacené hodiny jsou
    položka katalogu „Předplacené hodiny" aktivovaná jako každá jiná služba.
- **Nevyčerpané hodiny defaultně propadají**; zaškrtávátko **u služby u zákazníka**
  je převede do dalšího měsíce (rollover, zatím bez stropů).
- **Hodinová sazba** za vícepráce: firemní výchozí (nastavení Organizace)
  + volitelný override u zákazníka — nutné umět odlišit.
- **Výkaz práce** má fakturační režim (default chytře podle kontextu, ručně
  přepnutelný): **„ze služby"** (odečítá hodiny přiřazené služby) /
  **„účtovat zvlášť"** (jednorázovka mimo služby, × sazba klienta — nesmí lézt
  do paušálu) / **„neúčtovat"** (práce v ceně/goodwill — čas se eviduje, peníze ne).
  Přečerpání hodin služby se viditelně označí a počítá jako vícepráce × sazba;
  při schvalování jde přepnout na „neúčtovat".
- **Měsíční „fakturace" zákazníka** = Σ předplatných (s cenou) + Σ paušálů
  + (přečerpání + „účtovat zvlášť" hodiny) × sazba. Dva pohledy: **čas**
  (vykázáno / z hodin služby zbývá) a **peníze** (složení fakturace po položkách).
- Ceny, hodiny a sazby smí měnit jen **manažer** (do zavedení RBAC = admin);
  výkaz může zadat kdokoli, schvaluje odpovědná osoba zákazníka.

## Lekce z v1 (závazné)

- **Všechny `*_id` vazby s referencí** (FK) — žádné volné stringy.
- Tenant scoping ve **všech** dotazech (where tenant_id).
- Seed idempotentní: Seznamy + role + tým doplňovat i do existující DB; ukázková data jen poprvé.
- Kategorie úkolů a stavy = Seznamy s `color` (mapují se na chipy z UI zásad).
