🧭 **Znalostní báze:** [mapa](../README.md) · [sumář](SUMMARY.md) · [roadmap](ROADMAP.md) · [pravidla](../CLAUDE.md) · [UI](UI-ZASADY.md) · [komponenty](KOMPONENTY.md) · [slovník](SLOVNIK.md) · [datový model](DATOVY-MODEL.md)

# Trefoil CRM v2 — Architektura aplikace

> Začni tady. Ucelený technický přehled pro kohokoli, kdo na aplikaci naváže.
> Aktualizováno: 2026-06-14.

Tento soubor je „rozcestník a celkový obraz". Detailní dokumentace je v `docs/`:

- [docs/UI-ZASADY.md](UI-ZASADY.md) — designový manuál (replika Capsule CRM), barvy/skiny
- [docs/KOMPONENTY.md](KOMPONENTY.md) — katalog znovupoužitelných UI komponent (kódy + pravidla)
- [docs/DATOVY-MODEL.md](DATOVY-MODEL.md) — datový model (Person/Client/Seznamy/RBAC, billing)
- [docs/SLOVNIK.md](SLOVNIK.md) — jednotná terminologie (pojmy = stejná slova v UI i kódu)
- [docs/specs/](specs/) — specifikace jednotlivých modulů (vznikají PŘED stavbou)
- [mockupy/](../mockupy/) `*.html` — klikací vizuální reference obrazovek (otevři v prohlížeči)
- [SUMMARY.md](SUMMARY.md) — historie projektu, rozhodnutí a plán dalších fází

## 1) Co to je

Trefoil CRM (budoucí adresa `crm.trefoil.cz`).
Eviduje zákazníky (firmy + osoby), kontakty, služby, které jim agentura spravuje,
výkazy práce a z nich plynoucí podklady pro měsíční fakturaci. Cíl UI: čistota a
hierarchie à la Capsule CRM (capsulecrm.com).

Verze 2 je přepis od nuly s důrazem na lepší specifikaci před každým modulem.
Verze 1 (funkční prototyp) je archiv v původním repu.

## 2) Technologický stack (a proč)

Záměrně LEHKÝ stack, bez build kroku, bez Dockeru, databáze v jednom souboru.
Důvod: jednoduchý provoz, snadné pochopení, rychlý vývoj; škálování je připravené,
ale neřeší se předčasně.

- **Jazyk:** TypeScript (běží PŘÍMO přes `tsx`, žádná kompilace/bundling)
- **Runtime:** Node.js >= 22 (vyvíjeno na Node 24)
- **Web framework:** Hono (https://hono.dev) — malý, rychlý, JSX na serveru
- **Šablony:** Hono JSX = HTML se renderuje na SERVERU (`jsxImportSource: "hono/jsx"`).
  Žádný React na klientu! JSX je jen způsob, jak skládat HTML.
- **Databáze:** SQLite přes better-sqlite3 (synchronní, rychlé, soubor `data/crm.db`)
- **Dotazy:** Kysely — typovaný query builder (žádné ruční SQL stringy)
- **Interaktivita:** htmx 2.x (`public/htmx.min.js`) — výměny kousků HTML přes AJAX
  bez psaní JS; plus malý vanilla `public/app.js` pro drobné chování
- **Realtime:** Server-Sent Events (SSE) — změny se hned promítnou všem oknům
- **Styly:** vlastní CSS (`public/theme.css` = struktura, `public/skins/*.css` = barvy)
- **Správce balíčků:** pnpm (>= 11)

**Proč tyto volby:**

- `tsx` = vývoj i běh bez build kroku; `pnpm start` = `tsx watch` → změna souboru
  se nasadí sama (~1 s). Žádný webpack/vite/esbuild pipeline k údržbě.
- htmx + server-side JSX = drtivá většina logiky je na serveru (jednoduché,
  SEO-friendly, málo klientského JS). UI je „HTML over the wire".
- SQLite/Kysely = nulová infrastruktura; Kysely je napsaný tak, aby přechod na
  PostgreSQL byl výměna jednoho dialektu (viz bod 7), dotazy zůstanou stejné.

## 3) Jak to spustit a vyvíjet

Prerekvizity: Node >= 22, pnpm. Kód NESMÍ ležet na Google Disku (rozbíjí `node_modules`).
Aktuální umístění: `D:\Internet\Trefoil CRM` (git repo: `trefoil-crm`).

- Instalace závislostí: `pnpm install`
- Spuštění (vývoj+ostro): `pnpm start` → tsx watch, http://localhost:3000
- Typová kontrola: `pnpm typecheck` → `tsc --noEmit` (musí projít čistě)
- E2E testy: `node scripts/e2e-krok6.mjs` (a krok4/krok5) — viz bod 14

**Launcher pro netechnické spuštění:**
`start-crm.bat` — černé okno; `cd /d "%~dp0"` (nezávislé na cestě), uvolní port 3000,
za 5 s otevře prohlížeč a spustí `pnpm start`. Zavřením okna se CRM vypne.
Na ploše je zástupce „Trefoil CRM" → tento `.bat`.

> POZN.: Petr běžně drží server spuštěný přes tento zástupce. Protože `pnpm start`
> je `tsx watch`, změny kódu se nasadí samy — NENÍ potřeba server restartovat ani
> zabíjet. Pro testy používej běžící server; nikdy nenechávej běžet vlastní druhou
> instanci na portu 3000.

**Konfigurace** (vše má default, `.env` není potřeba) — `src/config.ts`:

| Proměnná | Význam |
|---|---|
| `PORT` | port serveru (default 3000) |
| `DB_FILE` | cesta k SQLite souboru (default `./data/crm.db`, relativně k pracovnímu adresáři) |
| `sessionTtlDays` | platnost přihlášení (= 30) |

První spuštění s prázdnou DB tě průvodcem provede založením Organizace (admin účet
+ výběr modulů). Dev přihlášení (od Kroku 2): `admin@trefoil.cz` / `admin123`.

## 4) Struktura projektu

```
src/
  index.ts            Vstupní bod: migrate() + seed() → listen() (s EADDRINUSE retry)
  server.ts           Sestavení Hono appky: statika, kontext-middleware, tok přístupu,
                      SSE /live, připojení všech route modulů
  config.ts           Konfigurace (PORT, DB_FILE, sessionTtlDays)
  types.ts            AppEnv — co middleware vkládá do kontextu (person, tenant, modules)
  modules.ts          REGISTR MODULŮ (klíč, popisek, ikona, cesta, built?)
  realtime.ts         In-memory SSE event bus (addClient/removeClient/broadcast)
  lib/util.ts         newId(), now() a další drobnosti
  i18n/
    index.ts          Lokalizační jádro: tr(), fmtDate/Num/DateTime/relTime…,
                      AsyncLocalStorage pro locale, LOCALES registr
    en.ts             Anglický slovník (klíč = čeština, hodnota = angličtina)
  db/
    index.ts          Jediný přístupový bod k DB (Kysely nad better-sqlite3, WAL, FK)
    schema.ts         Typový popis všech tabulek (kontrakt pro Kysely)
    migrate.ts        Vytvoření tabulek (idempotentní, createTable ifNotExists + ALTERy)
    seed.ts           Naplnění výchozími daty (idempotentní): Seznamy, dev admin…
  auth/
    password.ts       Hashování hesel (scrypt z node:crypto, bez závislosti)
    session.ts        Serverové session (tabulka sessions, httpOnly cookie „sid")
  domain/             VRSTVA LOGIKY (čistá data/byznys, vrací prostá data; bez HTML)
    clients.ts, people.ts, contacts.ts, lists.ts, services.ts, clientServices.ts,
    team.ts, workRecords.ts, events.ts (logEvent + Historie)
  web/                VRSTVA HTTP+UI (Hono routy vracející server-rendered JSX)
    layout.tsx        Společný obal stránky (horní lišta, navigace, uživatelské menu)
    head.tsx          HeadAssets — společné <head> (meta, skin-init skript, styly)
    components.tsx    Znovupoužitelné komponenty (Picker, KebabMenu, modály, sekce…)
    icons.tsx         Inline SVG ikony (Feather styl) — jediný zdroj ikon
    skins.ts          REGISTR SKINŮ (motivů) + boot skript do <head>
    setup.tsx         Průvodce založením Organizace (prázdná DB)
    auth.tsx          Login / logout
    dashboard.tsx     Nástěnka (zatím základ)
    zakaznici.tsx     Přehled zákazníků (seznam, filtry, quick-view)
    firmy.tsx         Detail firmy (3sloupcový hub)
    osoby.tsx         Detail osoby
    sluzbyZakaznika.tsx  Záložka Služby u zákazníka + „Měsíčně celkem"
    vykazy.tsx        Modul Výkazy práce (/vykazy: Můj výkaz, Schvalování, Přehled)
    admin.tsx         Administrace (Moduly, Tým, katalog Služeb)
public/               STATIKA (servíruje se na /static/*)
  theme.css           STRUKTURA UI (jen var(--token), žádné barvy natvrdo)
  skins/*.css         6 skinů = sady barevných tokenů (viz bod 12)
  app.js              Drobné chování UI (menu, modály, závislá pole, přepínání skinů)
  htmx.min.js         knihovna htmx
docs/                 dokumentace (viz hlavička)
mockupy/              statické HTML ukázky obrazovek + styl.css (standalone snapshot)
scripts/              E2E testy (e2e-krok4/5/6.mjs)
data/                 SQLite databáze (crm.db + WAL) — NENÍ v gitu (gitignore)
start-crm.bat         launcher
```

## 5) Jak teče požadavek (request lifecycle)

1. **Statika:** `/static/*` se servíruje přímo ze složky `public/` (mimo další logiku).
2. **Kontext-middleware** (`server.ts`): ke každému requestu načte z DB
   - tenant (Organizace; bere se první/jediná),
   - zapnuté moduly (`tenant_modules`),
   - přihlášenou osobu (podle cookie „sid" → tabulka `sessions`),

   a vloží je do kontextu (`c.get('person')` / `'tenant'` / `'modules'`).
3. **Tok přístupu** (access middleware):
   - prázdná DB (bez Organizace) → přesměrování na `/zalozeni` (průvodce),
   - bez přihlášení → `/login`,
   - přihlášený na `/login` → domů, apod.
4. **Route handler** (`web/*.tsx`) vrátí buď celou stránku (Layout + obsah), nebo —
   u htmx požadavků — jen fragment (kus HTML, který si htmx vymění v cíli).
5. Handler volá doménovou vrstvu (`domain/*`) pro data a po zápisech `logEvent()`
   (Historie + realtime broadcast).

Moduly se připojují přes `app.route('/', xRoutes)` v `server.ts`. Gating modulů
(zda je modul zapnutý) řídí lišta v Layoutu + middleware u příslušných cest.

## 6) Vrstvy a pravidla

```
web/ (Hono routy + JSX)  →  domain/ (logika nad Kysely)  →  db/ (Kysely instance)
```

- `web/` NEPÍŠE SQL. Volá funkce z `domain/`. Vrací HTML (JSX).
- `domain/` NEVÍ o HTTP ani HTML. Bere/vrací prostá data, používá `db` z `db/index`.
- `db/` je jediné místo, kde se vytváří spojení s databází (SEAM pro PostgreSQL).
- Každý zápis, který je „událost" (založení, změna, přiřazení…), volá `logEvent()`.
- Pouze REÁLNÉ změny se logují (porovnává se starý a nový stav) — otevření a
  zavření formuláře bez změny se do Historie nezapíše.

## 7) Databáze

- SQLite (better-sqlite3), WAL mód, zapnuté cizí klíče (`foreign_keys = ON`).
- Kysely = typovaný query builder; typy tabulek v `src/db/schema.ts`.
- Konvence:
  - ID = textový identifikátor (`newId()`), časy = TEXT v ISO formátu
    (přenositelné na PostgreSQL), booleany = INTEGER 0/1.
  - FK na všech vazbách. Idempotentní migrace i seed.
  - Sloupec `meta` (JSON text) = dohodnutá konvence pro rozšiřitelnost bez
    přidávání nových sloupců (poprvé použito u katalogu služeb).
- Tabulky (`schema.ts`): `tenants`, `tenant_modules`, `persons`, `sessions`, `clients`,
  `person_clients`, `person_contacts`, `lists`, `list_items`, `entity_list_items`, `events`,
  `services`, `work_records`. (Detailní význam: [docs/DATOVY-MODEL.md](DATOVY-MODEL.md).)
- MULTI-TENANT: vše je scoped přes `tenant_id` (Organizace). V praxi běží jedna
  Organizace (agentura), ale model je připraven na víc.
- SEAM pro škálování: přechod na PostgreSQL = výměna dialektu v `src/db/index.ts`
  (SqliteDialect → PostgresDialect); doménové dotazy zůstanou beze změny.
  Stejně tak realtime (in-memory bus) lze vyměnit za Redis pub/sub.

**Datový základ** (z v1, klíčový pro pochopení modelu):

- Person (osoba) = kolega s přihlášením I zákaznická osoba/kontakt (bez přihlášení).
- Client (klient) = firma (`kind=company`) nebo osoba (`kind=person`).
- Osoba ↔ firma je vazba M:N (`person_clients`) — osoba může působit u více firem.
- Kontaktní údaje (`person_contacts`) patří osobě NEBO firmě a mohou být vázané
  na konkrétní firmu (kontext).
- Seznamy (`lists`/`list_items`) = konfigurovatelné číselníky (stavy, štítky,
  kategorie, katalog služeb…). Nalepení na záznam přes `entity_list_items`.
- RBAC zatím zjednodušeno na `persons.is_admin` (0/1); plné role/práva přijdou
  v Kroku 7 (Administrace).

## 8) Autentizace a session

- Hesla: scrypt (node:crypto), formát `scrypt$<salt>$<hash>`, bez externí závislosti.
  Ověření přes `timingSafeEqual`. (`src/auth/password.ts`)
- Session: serverová (tabulka `sessions`), token = 32 náhodných bajtů, uložený
  v httpOnly cookie „sid", platnost 30 dní; po vypršení se maže. Deaktivace osoby
  (`is_active=0`) zneplatní přihlášení. (`src/auth/session.ts`)

## 9) Moduly (zapínatelné části)

- Registr: `src/modules.ts` (klíč, popisek, ikona, cesta, `built`).
- Zapnutí: řádek v tabulce `tenant_modules` (spravuje Administrace → Moduly).
- `built=false` = modul je v registru, ale ještě nepostavený → v liště šedě
  „Připravujeme". Po dostavění se přepne na true.
- Stav: `zakaznici` ✓, `vykazy` ✓ (built). `ukoly`, `sluzby`, `zakazky`, `obchod` = připravené.
- Nástěnka a Administrace NEJSOU moduly (Nástěnka je vždy, Administrace pro adminy).

## 10) Realtime (změny se hned projeví všem)

- `src/realtime.ts`: in-memory Set odběratelů, `broadcast(payload)`.
- Endpoint `GET /live` (`server.ts`): SSE stream pro každé otevřené okno.
- `src/domain/events.ts` `logEvent()`: zapíše událost do tabulky `events` (Historie)
  A zavolá `broadcast({kind, id})`.
- Klient (`public/app.js`): poslouchá `/live` a při události vyšle DOM event
  „live-update". „Živé zóny" v UI mají `hx-trigger="live-update from:body"` a samy
  se překreslí (htmx).
- Pravidla: živá zóna = vše, kde se zobrazuje dění ostatních (feedy, úkoly,
  Nástěnka). Živá zóna NESMÍ obsahovat rozepsaný formulář (přepsal by se uživateli).

## 11) Frontend (bez frameworku a bez bundleru)

- HTML se generuje na serveru (Hono JSX). htmx zajišťuje výměny fragmentů
  (`hx-get`/`post`/`target`/`swap`). Typické vzory: `#stred` jako cíl, `hx-select` pro výřez,
  `hx-disinherit` u živých zón (aby tlačítka uvnitř nedědila `hx-select`).
- `public/app.js` (vanilla, bez závislostí) řeší: rozbalovací menu/panely, velké
  modály (Esc/klik na pozadí), odkrývání polí, přidávání řádků, ZÁVISLÁ POLE
  (`data-depends-on` / `data-depends-value`), VÝCHOZÍ HODNOTY z číselníku
  (`data-defaults` / `data-set-<pole>`) a PŘEPÍNÁNÍ SKINŮ.
- Žádný build: prohlížeč dostává hotové HTML + jedno CSS + dva JS soubory.
- Cache-busting statiky: `ASSET_V` v `src/web/head.tsx` (zvednout při změně CSS/JS).

## 11b) Lokalizace (i18n) — `src/i18n/`

Lokalizace bez protahování locale parametrem přes celý strom.

**PRINCIP:** čeština je zároveň klíč. `tr('Zákazníci')` vrací v češtině přesně klíč,
v angličtině překlad ze slovníku EN (`en.ts`). Chybí-li překlad, text zůstane česky
— nic se nerozbije, přeložené věci fungují, nepřeložené zůstanou jako stub.

**LOCALE KONTEXT:** AsyncLocalStorage (node:async_hooks). Middleware v `server.ts`
obalí každý request do `runWithLocale(locale, () => next())`. Kdekoliv v kódu
(i hluboko v komponentách) stačí zavolat `tr()` nebo formátovač — locale se
přenese automaticky, žádný parametr `locale` není třeba protahovat.

**EXPORTY z `'src/i18n'`** (importuj vždy z tohoto aliasu):

| Export | Popis |
|---|---|
| `tr(key, params?)` | překlad s parametry: `tr('Smazat {name}?', { name })` |
| `fmtDate(iso)` | datum (14. 6. 2026 / 14/06/2026) |
| `fmtDateTime(iso)` | datum + čas |
| `fmtNum(n, opts?)` | číslo s oddělovači (cs: mezera tisíce, en: čárka) |
| `currency()` | token měny aktivního jazyka (Kč / CZK) |
| `relTime(iso)` | relativní čas (před 5 min / 5 min ago) |
| `monthLabel(month)` | měsíc+rok dlouze (červen 2026 / June 2026) |
| `fmtDateLong(date)` | s dnem v týdnu (sobota 14. června 2026 / Saturday…) |

**SLOVNÍK `en.ts`:** klíč = česky přesně (vč. interpunkce), hodnota = anglicky.
Parametry v klíči jako `{name}`. Přidávej průběžně k novým UI textům.

**PŘIDÁNÍ JAZYKA:** nový soubor `src/i18n/<id>.ts` + položka v `LOCALES` + podmínka
v `tr()`. Formáty se přizpůsobí přes Intl (`intl: 'cs-CZ'` / `'en-GB'`).

## 12) Skiny (motivy vzhledu) — vzhled NENÍ natvrdo

Barvy jsou výhradně CSS tokeny. Strukturu drží `public/theme.css` (jen `var(--token)`),
konkrétní barvy dodává aktivní skin z `public/skins/<id>.css` blokem
`:root[data-skin="<id>"]{…}`. Aktivní skin = atribut `data-skin` na `<html>`.

**6 skinů ve 3 rodinách** (světlý + tmavý):

- **Klasický** (`classic-light` = výchozí / `classic-dark`) — Capsule styl
- **Trefoil** (`trefoil-light` / `trefoil-dark`) — barvy rostliny jetele
  (luční zelená `#2d6b31` akcent/listy, jetelová růžová `#c0186a` květ)
- **Vysoký kontrast** (`contrast-light` / `contrast-dark`) — přístupnost (AAA)

Registr `src/web/skins.ts` (id + štítek) generuje `<link>`y i přepínač (submenu
„Vzhledy" v uživatelském menu). Volba v `localStorage['skin']`; bez volby dle
systému (`prefers-color-scheme`). Boot skript v `<head>` (`skinBootScript`) nastaví
motiv ještě před vykreslením (žádné bliknutí) a zveřejní `window.__skins` (čte `app.js`).
PŘIDÁNÍ SKINU = nový soubor `public/skins/<id>.css` + položka v `SKINS`. Nic víc.
Detaily: [docs/UI-ZASADY.md](UI-ZASADY.md) §2 a [docs/KOMPONENTY.md](KOMPONENTY.md) §23.

## 13) Billing / fakturační model (jádro byznys logiky)

Hybridní retainer model (vzor Accelo/Productive). Každá služba u zákazníka má
jeden ze TŘÍ režimů účtování (výchozí z katalogu, měnitelný):

1. „Předplatné v aplikaci" (subscription) — SaaS; volitelná měsíční částka.
2. „Domluvený paušál hodin" (retainer) — práce se odečítá z měsíčního rozpočtu
   hodin zákazníka. Paušál (počet hodin + cena) patří ZÁKAZNÍKOVI, ne službě
   (jeden paušál kryje všechny retainer služby), s volbou převodu nevyčerpaných
   hodin (rollover).
3. „Samostatná fakturace" (payg) — účtuje se odpracovaný čas × sazba.

Sazba v katalogu je vždy Kč/h. Výkaz práce má pole „billing" (z paušálu / účtovat
zvlášť / neúčtovat), výchozí dle režimu služby, měnitelné per záznam.
Do peněz a hodin se počítají SCHVÁLENÉ výkazy; „Měsíčně celkem" ukazuje i ČEKAJÍCÍ
(očekávané/rezervované) jako samostatnou položku. Logika: `src/domain/workRecords.ts`.
Detaily a důvody: [SUMMARY.md](SUMMARY.md) + [docs/DATOVY-MODEL.md](DATOVY-MODEL.md).

## 14) Testy a ověřování

- Typová kontrola: `pnpm typecheck` (musí být čistá; je to hlavní „kompilační" síto).
- E2E: `scripts/e2e-krok4/5/6.mjs` — jednoduché Node skripty, které jedou proti
  BĚŽÍCÍMU serveru (port 3000), zakládají záznamy s prefixem „TestE2E" a po sobě
  uklízejí. Spuštění: `node scripts/e2e-krok6.mjs`.
- Před commitem: typecheck + relevantní E2E.

## 15) Bezpečnost (současný stav)

- Hesla scrypt + `timingSafeEqual`; session token náhodný, httpOnly cookie.
- Vše scoped přes `tenant_id`; FK na vazbách; idempotentní migrace.
- Pozn.: zatím interní nástroj na localhostu. Před nasazením na `crm.trefoil.cz`
  dořešit: HTTPS, cookie Secure/SameSite, CSRF u formulářů, rate-limiting loginu,
  plné RBAC (Krok 7) místo dočasného `is_admin`.

## 16) Nasazení

- Dnes: lokálně přes `start-crm.bat` (port 3000), data v souboru `data/crm.db`.
- Budoucnost: `crm.trefoil.cz`. Díky DB seamu (bod 7) lze přejít na PostgreSQL;
  in-memory realtime vyměnit za Redis pub/sub. Aplikace je bezstavová kromě DB
  a SSE odběratelů, takže horizontální škálování je proveditelné.
- Git: lokálně `D:\Internet\Trefoil CRM` (`trefoil-crm`).

## 17) Důležité konvence (drž se jich při rozvoji)

- Spec-first: nový modul = nejdřív krátká specifikace (`docs/specs/`, šablona
  `_SABLONA.md`) → schválení → stavba → ověření → commit.
- UI nevymýšlí nové prvky — používá KATALOG ([docs/KOMPONENTY.md](KOMPONENTY.md) +
  `mockupy/komponenty.html`). Co chybí, nejdřív přibude do katalogu.
- Jednotná terminologie ([docs/SLOVNIK.md](SLOVNIK.md)): stejné slovo v UI i v kódu.
- Lokalizace: všechny UI texty přes `tr()` z `'src/i18n'`. Anglický překlad
  přidat do `en.ts`. Čeština je klíč — nepřeložené texty zůstanou česky.
- Kontextové akce ([docs/KOMPONENTY.md](KOMPONENTY.md) §20):
  - Nadpisy sekcí (`card-head`, `h4`): KebabMenu (⋯) VŽDY viditelné.
  - Řádky v seznamech: `class="hover-row"` + `span.row-actions` s KebabMenu
    (⋯ se ukáže najetím). Na dotyku vždy viditelné (`@media hover:none`).
  - Trigger JE VŽDY icon-btn s ⋯ — nikdy textový odkaz v `row-actions`.
- Barvy NIKDY natvrdo — vždy `var(--token)`. Tokeny v `public/skins/*.css`,
  struktura v `public/theme.css`. Při změně tokenů aktualizovat i `mockupy/styl.css`.
- better-sqlite3 >= 12 (prebuildy pro nové Node), build skripty povolené v
  `pnpm-workspace.yaml` (`allowBuilds: better-sqlite3, esbuild`).
- Kód nikdy na Google Disk. `.bat` soubory s CRLF (`.gitattributes`).
