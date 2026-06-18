# Datový model — Trefoil CRM v2 (blueprint)

🧭 **Znalostní báze:** [mapa](../README.md) · [slovník](SLOVNIK.md) · [architektura](ARCHITECTURE.md) · [UI zásady](UI-ZASADY.md) · [komponenty](KOMPONENTY.md) · [sumář](SUMMARY.md) · [roadmap](ROADMAP.md) · [pravidla](../CLAUDE.md) · [specs](specs/)

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
| `persons` | Všichni lidé — kolegové (mají `login_email`+`password_hash`) i kontakty (nemají). Povahu určují **role**. Kolegové (Tým) mají navíc **`position`** (pozice v týmu, prostý text) a mohou mít vlastní **kontakty** (`person_contacts`) stejně jako kontaktní osoby. |
| `clients` | Zákazník: `kind` = company/person; **`name`** (Název firmy — právní/fakturační; zobrazuje se i vlevo nahoře v hlavičce detailu), IČO/DIČ, **strukturovaná adresa** (`street`, `house_no`, `address2`, `city`, `postal_code`, `country`; legacy `address` se drží jako fallback a synchronizuje přes `composeAddress`), `website` (**deprecated v UI** — web patří do kontaktů, sloupec čtou jen staré seznamy), stav (ze Seznamu), odpovědný (`owner_id`→persons), poznámka. Sloupec `display_name` v DB zůstává, ale **UI ho nepoužívá** (samostatný „Název zákazníka" byl zrušen). Helper `composeAddress()` v `src/domain/clients.ts`. Migrace = idempotentní `ALTER TABLE … ADD COLUMN` (`src/db/migrate.ts`). |
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
| `services` | Služba u klienta: `catalog_item_id` (položka Seznamu), `detail`/`description`, `mode` (retainer/subscription/payg), `rate` (Kč/h) / `monthly_amount` (předplatné), `owner_id`, stav active/paused/ended. **Rozpočet z paušálu** (jen retainer): `budget_hours` (alokované h/měs), `allow_overage` (0/1 — smí přečerpat z jiných služeb do stropu klienta), `alert_pct` (práh upozornění %, null=80). Čerpání = vykázané hodiny „z paušálu" v měsíci; detail služby ukazuje burn-up. |
| `work_records` | **Výkaz práce**: `client_id`, volitelně `service_id`, **volitelně `task_id`** (úkol, z něhož se vykazovalo — vazba viz `tasks`), `worker_id` (kdo pracoval), `description` (úkon), `note` (detail, volitelně), `minutes`, `performed_at`, **`status` pending/approved**, `approved_by_id`, `approved_at`. Každý záznam má dohledatelné ID. Při založení se automaticky vytvoří úkol pro odpovědnou osobu zákazníka (schválení). |
| `engagements` | Zakázka: klient, název, cíl, stav (ze Seznamu — kanban), odpovědný, termíny. |
| `milestones` | Milníky zakázky: název, termín, hotovo, pořadí. |
| `deals` | Příležitost: klient (volitelně), titulek, fáze (ze Seznamu — pipeline), hodnota, odpovědný, očekávaná uzávěrka, zdroj. |
| `activities` | Timeline: klient, volitelně osoba, `type` note/email/call/meeting, text, kdy, autor. |
| `tasks` | Úkol: titulek, kategorie (ze Seznamu), volitelně klient/zakázka/deal, termín `due_at`, hotovo, přiřazený. **Kanban (v2):** `status_id`→`task_statuses` (sloupec; null = odvodí se z `done`), `prev_status_id` (návrat po odškrtnutí), `archived` 0/1, `board_month` (`YYYY-MM`; null = trvalý/osobní board), `sort_order`. „Vyřízeno" (`done`) ⇄ stav s `is_done` se drží v synchronu. |
| `task_statuses` | **Stavy = sloupce Kanbanu, PER UŽIVATEL** (`owner_id`→persons): `label`, `color`, `sort_order`, `is_done` (stav vyřízeného úkolu), **`is_default`** (povinný **Inbox/Zásobník** — nové + nezařazené úkoly; nelze smazat, lze přejmenovat). Výchozí sada (lazy): **Nový** (`is_default`) · Vyřizuji · Kontrola · Hotovo (`is_done`). Inbox je na boardu **cross‑month** (vždy viditelný), ostatní sloupce ukazují vybraný měsíc. Správa sloupců (název/barva/pořadí/přidat/smazat) je **přímo na boardu**. |
| `tenants` | Organizace (nositel multi-tenant připravenosti). |
| `person_prefs` | **Per‑uživatelské předvolby** (klíč→hodnota): obecný, znovupoužitelný úložný bod pro drobné volby uživatele. PK `(person_id, key)`. Dnes `ukoly.view` = `agenda`/`kanban` (zvolené zobrazení modulu Úkoly se pamatuje per uživatel; bez `?view` se přistane tam, kde uživatel naposledy byl). Doména `src/domain/prefs.ts` (`getPref`/`setPref` s upsertem). |
| `notes` | **Poznámka**: `title` (volitelný nadpis, prostý text), `body_html` (bezpečné formátované HTML — vlastní editor, allowlist sanitizer v `src/domain/notes.ts`), `created_by_id`, `is_private` (0/1 — soukromá vidí jen autor), časy. Váže se na entity přes `note_links`. Editor = contenteditable (`docs/KOMPONENTY.md §24`), server HTML očistí (allowlist + normalizace; styly se nemíchají — žádné tučné uvnitř nadpisu). Zobrazení Seznam/Mozaika viz `KOMPONENTY.md §26` (volba per uživatel `person_prefs` klíč `poznamky.view`). |
| `note_links` | Vazba poznámky na entitu (M:N): `note_id` + `entity_kind` (`client`/`person`/`service`; později `project`/`task`/`work_record`) + `entity_id` + **`sort_order`** (ruční pořadí poznámek u entity pro drag/drop v mozaice/seznamu; menší = výš; sdílené pro tým, default 0). PK `(note_id, entity_kind, entity_id)`. Propis **osoba→firma** = explicitní vazba (volba „Týká se i firmy"); firma→osoba se nepropisuje (jen tichý počet). |

**Fakturační model (hybrid — finální podoba 12. 6. 2026, vzor Accelo/Productive,
podklad `Komunikace\Strategie\Retainer management a fakturace - PSOHUB 20260612.md`):**

- **Služba u zákazníka** má tři **režimy účtování** (výchozí režim a sazba z katalogu,
  u zákazníka vše přepsatelné — stejná služba může být u každého klienta jinak):
  - **Předplatné v aplikaci** — individuální částka předplatného (typicky SaaS/licence,
    různý rozsah = různá částka). Částka se nastavuje **u zákazníka** (volitelně):
    vyplněná se propisuje do měsíčního reportu/fakturace, prázdná = jen evidence.
  - **Domluvený paušál hodin** — čas práce se odečítá z domluveného paušálu hodin.
  - **Samostatná fakturace** — práci účtujeme samostatně (× hodinová sazba).
    Pro klienty bez paušálu (platí, co se vyčerpá) i pro jednorázovky, které nesmí
    lézt do paušálu.
- **Paušál hodin patří k zákazníkovi, NE ke službě v katalogu** — nastavuje se
  (volitelně) až při přidělování služeb klientovi. Jeden paušál může pokrývat
  **více služeb i celou spolupráci**, nejen jednu službu. Přesnou podobu
  (společný vs. per-služba) určí spec Kroku 5.
- **Nevyčerpané hodiny paušálu defaultně propadají**; zaškrtávátko u zákazníka
  je převede do dalšího měsíce (rollover, zatím bez stropů).
- **Hodinová sazba**: výchozí cena služby v katalogu je **vždy Kč/h** (sazba práce
  na službě, volitelná); u zákazníka jde přepsat — nutné umět odlišit.
- **Výkaz práce** se vždy váže na klienta + jeho službu a má **vlastní pole „účtování"**:
  předvyplní se defaultem podle režimu služby (paušál hodin → z paušálu, samostatná
  fakturace → × sazba, předplatné → v ceně), ale **u každé položky jde ručně změnit**
  na kteroukoli z možností: **z paušálu hodin** / **účtovat zvlášť** (× sazba) /
  **neúčtovat** (v ceně, goodwill — čas se eviduje, peníze ne). Přečerpání paušálu
  se viditelně označí a počítá jako vícepráce × sazba; při schvalování jde přepnout
  na „neúčtovat".
- **Měsíční „fakturace" zákazníka** = Σ předplatných (s cenou) + cena paušálu
  + (přečerpání paušálu + samostatně účtované hodiny) × sazba. Dva pohledy:
  **čas** (vykázáno / z paušálu zbývá) a **peníze** (složení fakturace po položkách).
- Ceny, hodiny a sazby smí měnit jen **manažer** (do zavedení RBAC = admin);
  výkaz může zadat kdokoli, schvaluje odpovědná osoba zákazníka.

## Lekce z v1 (závazné)

- **Všechny `*_id` vazby s referencí** (FK) — žádné volné stringy.
- Tenant scoping ve **všech** dotazech (where tenant_id).
- Seed idempotentní: Seznamy + role + tým doplňovat i do existující DB; ukázková data jen poprvé.
- Kategorie úkolů a stavy = Seznamy s `color` (mapují se na chipy z UI zásad).
