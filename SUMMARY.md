🧭 **Znalostní báze:** [mapa](README.md) · [architektura](ARCHITECTURE.md) · [roadmap](ROADMAP.md) · [pravidla](CLAUDE.md) · [UI](docs/UI-ZASADY.md) · [komponenty](docs/KOMPONENTY.md) · [slovník](docs/SLOVNIK.md) · [datový model](docs/DATOVY-MODEL.md)

# Trefoil CRM v2 — Solution Summary

> Projekt dříve „Conviu CRM". Kompletní shrnutí: kontext, historie, rozhodnutí, stav a plán dalších fází.
> Sepsáno: 2026-06-14. Doplňuj při dalších milnících.
> Technický „jak to funguje" je v [ARCHITECTURE.md](ARCHITECTURE.md); tady je „co, proč a kam dál".

> **REBRAND (2026-06-14):** projekt přejmenován Conviu CRM → Trefoil CRM. **HOTOVO i v kódu/repu**:
> složka `D:\Internet\Trefoil CRM`, `package.json` = `trefoil-crm`, titulky/menu aplikace,
> id a soubory skinů `trefoil-*`, GitHub repo `petebele/trefoil-crm`. První admin se zakládá
> průvodcem (žádný hardcoded „conviu" login). Slovo „Conviu" zůstává už jen ve **firemním**
> kontextu (agentura, doména `conviu.cz`) a v historických pasážích níže.

## 0) Rychlý stav k 2026-06-14 (aktualizováno průběžně)

- Aplikace běží lokálně (port 3000, launcher na ploše). Stack: TS + Hono + SQLite + htmx.
- Funguje: Zákazníci (firmy/osoby/kontakty/detail/Historie), Administrace
  (Moduly, Tým, katalog Služeb), Služby u zákazníka (+ „Měsíčně celkem" / billing),
  Výkazy práce (`/vykazy`: Můj výkaz, Schvalování, Přehled), systém SKINŮ (7 motivů).
- Projekt byl 2026-06-14 PŘESUNUT do `D:\Internet\Trefoil CRM`;
  git repo je `petebele/trefoil-crm`.
- Přidáno po 2026-06-14:
  - i18n systém (`src/i18n/`): čeština jako klíč, anglický slovník (`en.ts`),
    AsyncLocalStorage pro locale bez protahování parametru, funkce `tr()`/`fmtDate()` atd.
  - Kontextové akce přepracovány: hover-row + row-actions → KebabMenu (⋯),
    sekční nadpisy mají ⋯ vždy viditelné, řádky v seznamech jen při najetí.
  - TitleBox rozšířen o `children` prop (extra akce v ⋯ menu — Upravit/Smazat firmu).
  - WCAG AA kontrast opraven ve všech 7 skinech (21 hodnot tokenů).
  - OLED dark skin přidán (8. motiv — true `#000000`).
  - `CLAUDE.md` vytvořen (instrukce pro AI asistenta, reference na `docs/`).
  - Levý panel detailu předělán dle mockupu: editace **tužkou ✎**, sekce `.group`/`.idblock`,
    Název firmy v hlavičce + strukturovaná adresa, kontakty (＋ / „Upravit vše"), fonty. Viz 6b(e).
  - Tým (kolegové): **Pozice** (text) + vlastní **Kontakty** (modál v Administraci · Tým).
  - Rebrand Conviu → Trefoil dokončen i v kódu (package.json, skiny `trefoil-*`, titulky);
    revizní Tier-1 nálezy (fmtMinutes, tenant-scope kontaktů, SSE smyčka, try-catch migrace) hotové.
- Další na řadě: ÚKOLY + plnohodnotná NÁSTĚNKA (vč. auto-úkolu „schval výkazy").
  Pak Administrace/RBAC, Zakázky, Obchod, hledání, doleštění.

## 1) Kontext — kdo, co, proč

Conviu = marketingová agentura (Petr Běloch). Staví si INTERNÍ CRM (budoucí
`crm.conviu.com`) pro evidenci zákazníků, služeb, které jim spravuje, výkazů práce
a podkladů pro měsíční fakturaci. CRM zároveň nahrazuje věci, které agentura dnes
řeší mimo systém (uživatelé/role, seznam Služeb se sazbami, předplacené hodiny).

**Důležité o uživateli (Petr):**

- Je NETECHNICKÝ. Přebírej technické volby (git, nástroje, knihovny, struktura),
  chtěj po něm jen lidské/produktové vstupy, vysvětluj bez žargonu. Technické
  nálezy nech pro vývojáře, ne do běžné komunikace.
- Je PERFEKCIONISTA. Potřebuje explicitní „definition of done" a kalibraci hloubky;
  saturaci rámuj jako vyšší standard, ne slevu z kvality. Hodně iteruje na UX detailech.

## 2) Historie v1 → v2

- v1 = funkční prototyp z jiného PC; archiv na GitHubu `conviu-crm/conviu-crm`,
  lokální read-only klon `C:\Users\Jetel\dev\conviu-crm-v1-archiv`. Slouží jako
  know-how (slovník, datový model, technické lekce), NESTAVÍ se z něj — v2 vzniká
  načisto, krok po kroku, s lepší specifikací před každým modulem.
- Hlavní výtka k v1: „humpolácké" rozvržení (velikost prvků neodpovídala významu).
- SMĚR v2: UI „v podstatě replikovat" Capsule CRM (capsulecrm.com) — vizuál, layout,
  hierarchie prvků. Referenční screenshoty: `D:\Download\capsule-crm` (22× `.webp`).
- Platforma zůstává lehká (TS + Hono + SQLite + htmx), bez Dockeru, DB v souboru.

## 3) Proces vývoje (spec-first) — drž se ho

Pro každý modul: SPECIFIKACE (krátká, `docs/specs/`, šablona `_SABLONA.md`)
→ SCHVÁLENÍ Petrem → STAVBA → OVĚŘENÍ (typecheck + E2E) → COMMIT.
Petr typicky po dostavění modul prohlédne a posílá UX připomínky (často několik kol).
Nezačínej další modul bez jeho „jedem".

## 4) Hotové kroky (skutečné pořadí realizace)

> POZN.: Oficiální [ROADMAP.md](ROADMAP.md) má původní číslování; SKUTEČNĚ se pořadí
> přeuspořádalo — Komunikace/Úkoly/Nástěnka se odložily a místo nich se postavily
> Administrace, Služby a Výkazy. Níže je skutečný stav.

- **Krok 0** — prostředí (PC Jetel) + repo `trefoil-crm` + první push.
- **Krok 1** — Capsule UI studie → `docs/UI-ZASADY.md`, `docs/KOMPONENTY.md` (katalog prvků),
  `docs/SLOVNIK.md`, `docs/DATOVY-MODEL.md`, šablona specifikací, mockupy
  (nástěnka, zákazníci, detail zákazníka, komponenty).
- **Krok 2** — Kostra: DB základ, login, layout dle Capsule, ZALOŽENÍ ORGANIZACE průvodcem,
  ZAPÍNATELNÉ MODULY (registr `src/modules.ts` + `tenant_modules`, Administrace →
  Moduly), launcher na plochu.
- **Krok 3** — Modul ZÁKAZNÍCI: přehled (taby s počty, htmx hledání, filtry, řazení,
  quick-view), Firmy + Osoby s vícenásobnými kontakty (štítek typu ze Seznamu,
  inline-create), osoba umí založit firmu, DETAIL = 3 panely (taby Nástěnka/
  Služby/Projekty/Historie, vpravo agenda), Historie (events: čas-osoba-akce).
- **Krok 4 (realizace)** — ADMINISTRACE: Tým (kolegové, role admin/user, last-admin guard)
  + katalog SLUŽEB (Název, Popis, Výchozí režim účtování, Sazba Kč/h).
- **Krok 5 (realizace)** — SLUŽBY U ZÁKAZNÍKA: přidělení služby klientovi (režim/sazba/
  odpovědný per klient, opakované přidělení odlišené „Upřesněním"), archiv
  ukončených, „Paušál hodin" u zákazníka, blok „Měsíčně celkem".
- **Krok 6 (realizace)** — VÝKAZY PRÁCE: „Vykázat práci" odkudkoli (lišta, detail zákazníka,
  ze služby), stránka `/vykazy` (Můj výkaz, Schvalování, Přehled), SCHVALOVÁNÍ
  odpovědnou osobou (auto-approve, když vykazuje sám schvalovatel), výkaz se
  schválením zamkne a počítá do peněz/hodin.

**Klíčové komponenty/principy zavedené průběžně (`docs/KOMPONENTY.md`):**

- INLINE EDITACE ZRUŠENA (§18). Úprava jednoho pole = malý panel/modál; kompletní
  založení/úprava = VELKÝ modál na střed („režim soustředění", tmavé pozadí).
  Spouštěč mini-panelu = **tužka ✎** (hodnota zůstává jen zobrazená a označitelná);
  úprava celého záznamu = **„Upravit ▾"** (split button → velký modál). Viz 6b(e).
- Akce jako TEXT (Upravit/Smazat/Změnit), ikony jen u rychlého přidání a u přiřazení
  odpovědné osoby. Skryté kontextové akce: v pravém rohu sekce vždy indikátor ⋯
  (KebabMenu); nevynechává se bílé místo pro skryté odkazy (akce v řádku nadpisu).
- Historie loguje JEN reálné změny (porovnání starý/nový stav).
- Kontakty: v levém panelu nejdřív přiřazené osoby s údaji, pak firemní údaje.
- Závislá pole (`data-depends-on`) a výchozí hodnoty z katalogu (`data-defaults`) — obecné
  mechanismy v `app.js`, použitelné v každém formuláři.
- REALTIME: změny se hned promítnou všem oknům (SSE `/live` + živé zóny htmx).

## 5) Billing / fakturační model — rozhodnutí a důvody (jádro byznysu)

Rešerše proti Accelo / Productive / PSOHUB (článek uložen v Google Drive:
`Komunikace\Strategie\Retainer management a fakturace - PSOHUB 20260612.md`).
Petr nechtěl vymýšlet kolo → zvolen HYBRIDNÍ RETAINER MODEL.

**Tři režimy účtování služby** (výchozí z katalogu, měnitelný u klienta i u jednotlivého výkazu):

1. **„Předplatné v aplikaci" (subscription)** — naše SaaS služba; částka VOLITELNÁ
   (některým klientům za to posíláme fakturu, jiným ne).
2. **„Domluvený paušál hodin" (retainer)** — klient má domluvený POČET HODIN/měsíc za
   cenu; práce se odečítá z tohoto rozpočtu. Klíčové rozhodnutí: paušál = vždy
   „předplacené hodiny" s definovaným počtem (NE neomezeně). Paušál patří
   ZÁKAZNÍKOVI, ne službě — jeden paušál kryje VŠECHNY retainer služby klienta.
   Volba „převádět nevyčerpané hodiny" (rollover) — DEFAULTNĚ VYPNUTO, zaškrtávátko.
3. **„Samostatná fakturace" (payg)** — práce se účtuje časem × sazba (klienti bez
   paušálu, nebo jednorázové služby).

- Hodinová sazba: firemní default, u konkrétního klienta lze přepsat. V katalogu se
  zadává VŽDY Kč/h (ne za měsíc).
- U KAŽDÉHO výkazu práce lze způsob účtování přepnout (z paušálu / účtovat zvlášť /
  neúčtovat) — default dle režimu služby.
- Do hodin i peněz se počítají SCHVÁLENÉ výkazy. „Měsíčně celkem" ale musí ukazovat
  i ČEKAJÍCÍ (neschválené) jako OČEKÁVANÉ/REZERVOVANÉ příjmy a čas — proto jsou
  vícepráce rozdělené na „schváleno" a „čeká na schválení (rezervace)" a obojí se
  počítá do součtu „Očekávaný měsíc".
- Pozor na intuici: schválená RETAINER práce, která se vejde do paušálu, NEMĚNÍ peníze
  (paušál je fixní) — jen ČERPÁ HODINY. Proto se u řádku paušálu zobrazuje „čerpáno
  X z Y h", aby bylo vidět, že se něco stalo. (Logika: `src/domain/workRecords.ts`.)

**Co se odstranilo/změnilo během ladění (zpětná vazba Petra):**

- „Hodiny v ceně" se NEDÁVAJÍ do katalogu služby (liší se podle klienta) → paušál
  patří zákazníkovi.
- Výchozí cena je Kč/h, ne za měsíc.

## 6) Tato session (2026-06-14) — co jsme řešili

### (a) „Měsíčně celkem" — schválené i rezervované

Petr: schválil úkon a „neprojevil se". Diagnóza: úkon byl účtovaný z paušálu
hodin a vešel se do limitu → správně neměnil peníze, jen čerpal hodiny, ale
čerpání nebylo nikde vidět. Oprava: řádek paušálu ukazuje „čerpáno X z Y h";
přidány samostatné řádky „Vícepráce — schváleno" a „Vícepráce — čeká na schválení
(rezervace)"; obojí se počítá do součtu „Očekávaný měsíc". (commit `48df6cc`)

### (b) Dark mode → systém skinů

Zadání se vyvinulo z „implementuj dark mode" na požadavek, aby vzhled NEBYL
natvrdo, ale aby šlo PŘEPÍNAT mezi SKINY a tvořit další. Architektura: barvy =
CSS tokeny; struktura v `public/theme.css` (jen `var(--token)`); každý skin = sada
tokenů v `public/skins/<id>.css` (blok `:root[data-skin="<id>"]`). Registr
`src/web/skins.ts` generuje styly i přepínač; boot skript v `<head>` nastaví motiv
před vykreslením (bez bliknutí) a zveřejní `window.__skins`; volba v `localStorage`,
bez volby dle systému; přepnutí se přes „storage" event promítne do dalších oken.
(commity `4c7147b` → `1a9694e`)

### (c) 6 skinů ve 3 rodinách (světlý + tmavý)

- **Klasický** (`classic-light` = výchozí / `classic-dark`) — původní Capsule vzhled.
- **Conviu** (`conviu-light` / `conviu-dark`) — postavené na SKUTEČNÝCH barvách z
  conviu.cz (vytaženo z jejich CSS): petrolejová modř `#015280` (hlavní akcent),
  námořnická `#161931` (text + báze tmavého skinu), zlatá `#f8ae0d`, zelená `#7cb342`
  (úspěch), červená `#b3261e`. Petrolejová se v tmavém projasnila (`#46a6e0`) kvůli
  čitelnosti.
- **Vysoký kontrast** (`contrast-light` / `contrast-dark`) — přístupnost (bílé/černé
  plochy, silné rámečky místo stínů, AAA kontrast).

Naming „rodina · varianta" (česky), škáluje na další rodiny.

### (d) Přepínač = submenu „Vzhledy"

V uživatelském menu (vpravo nahoře) je položka „Vzhledy ▸" s vyskakovacím
submenu 6 skinů (otevírá se najetím i klikem). Fajfka u aktivního.

### (e) Přesun projektu na `D:\Internet\Trefoil CRM`

Bezpečně: kopie (bez `node_modules`) → kontrola, že DB soubory jsou byte-identické
→ `pnpm install` na novém místě (čistá obnova `node_modules`; pnpm odkazy nejdou
kopírovat mezi disky) → ověření (typecheck + zkušební start na portu 3999) →
smazání originálu → oprava zástupce na ploše (`D:\Plocha\Conviu CRM.lnk` → nový
`start-crm.bat`; ten je nezávislý na cestě díky `cd /d "%~dp0"`). Název složky je
„Trefoil CRM"; git repo/remote je `petebele/trefoil-crm`.

## 6b) Po 2026-06-14 — co přibylo

### (a) Skiny — WCAG AA opravy + OLED dark + Trefoil rodina

Přidán 7. skin „OLED · tmavý" (true `#000000` = pixely vypnuty). Skiny přejmenov.
`conviu-*` → `trefoil-*` (barvy rostliny jetele: luční zelená `#2d6b31`, jetelová
růžová `#c0186a`). Ve všech 7 skinech opraveny WCAG AA kontrasty (21 tokenů).
`mockupy/styl.css` drží inline kopii tokenů pro standalone mockupy — aktualizovat
souběžně s `public/skins/*.css`.

### (b) i18n systém (`src/i18n/`)

Přidána lokalizace bez protahování locale parametrem. Princip: ČEŠTINA je klíč
→ `tr('Zákazníci')` vrací česky přesně klíč, anglicky překlad z `en.ts`. Chybí-li
překlad, text zůstane česky (nic se nerozbije). AsyncLocalStorage nese locale
pro celý request — `tr()` a formátovače fungují kdekoliv (i hluboko v komponentách).
Exporty: `tr()`, `fmtDate()`, `fmtDateTime()`, `fmtNum()`, `currency()`, `relTime()`,
`monthLabel()`, `fmtDateLong()`. Importovat vždy z `'src/i18n'` (ne z podmodulů).

### (c) Kontextové akce — systémová refaktorace

Problém: skryté hover-akce zobrazovaly sadu textových odkazů „Upravit · Smazat
· Pozastavit" rozložených horizontálně — braly místo obsahu i skryté.

Řešení (v souladu s Capsule/Linear/HubSpot):

- Nadpisy sekcí (`.card-head`, `h4`): KebabMenu (⋯) vždy viditelné.
- Řádky v seznamech: hover-row + row-actions → jediný KebabMenu (⋯) odkrytý
  hoverem. Na dotyku (`@media hover:none`) vždy viditelné.
- Trigger je VŽDY icon-btn s ⋯, nikdy textový odkaz.

Upraveno: `sluzbyZakaznika.tsx` (ServiceRow), `vykazy.tsx` (WorkRecordRow),
`components.tsx` (ContactsSection, PersonRow), `admin.tsx` (TymTab, SluzbyTab),
`firmy.tsx` (Upravit/Smazat firmu přesunuto do TitleBox ⋯ menu).
TitleBox: rozšířen o `children` prop pro extra akce v ⋯ panelu.

### (d) `CLAUDE.md`

Vytvořen instrukční soubor pro AI asistenta — reference na `docs/`, projektová
pravidla (port 3000, spec-first, htmx first, i18n, tokeny), komunikační profil.

### (e) Levý panel detailu zákazníka — předělaný podle mockupu (Capsule styl)

Iterativní redesign levého sloupce detailu (firma i osoba), etalon
`mockupy/example-zakaznik.html`. Promítnuto do aplikace (`firmy.tsx`, `osoby.tsx`,
`components.tsx`, `theme.css`, doména, schéma). Hlavní změny:

- **Spouštěč editace = tužka ✎** (`.pen-ind`, zakulacený čtverec jako ikonky menu;
  hover `--accent-soft` + okamžitý tooltip). Hodnota zůstává **označitelná** (nešlo
  by, kdyby spouštěčem byl klik na hodnotu). Výjimka: víc hodnot na řádku → spouští
  sama hodnota (`.editable-inline`, čárkované podtržení). Komponenty `EditField`/`PencilIcon`.
- **Struktura sekcí**: identita `.idblock` (avatar + „Upravit ▾" + název + štítky + stav),
  pod ní sekce `.group` s UPPERCASE nadpisem `.group-h` a akcemi v nadpisu (`.ha`).
- **Název firmy** (`clients.name`, právní/fakturační) se zobrazuje i v hlavičce detailu.
  *(Samostatný „Název zákazníka"/`display_name` byl po zkoušce zrušen — sloupec v DB zůstal,
  UI ho nepoužívá.)* **Strukturovaná mezinárodní adresa** (nové sloupce, legacy `address`
  jako fallback). **Web přesunut z adresy do Kontaktů.**
- **Tým (kolegové)** má nově **Pozici** (prostý text) a vlastní **Kontakty** (víc, přes
  sdílenou `ContactRowsField`) — editují se v modálu uživatele v Administraci · Tým.
- **Kontakty**: ikona typu `.cico` + hodnota + pilulka **označení** `.tagaft` (typ se
  nepíše textem). Přidání = jeden **＋** (dropdown typ/hodnota/štítek) + **✎ „Upravit vše"**
  (modál `ContactsEditAll`, hromadná správa). U firmy navíc sekce **Lidé** nad Kontakty.
- **Inline prázdné stavy** `.empty-inline` + odkaz `.emptylink` otevírající mini-panel
  („Žádná poznámka. Přidat poznámku." apod.).
- **Fonty**: Inter (tělo) / Poppins (nadpisy) / JetBrains Mono (kód) přes tokeny.
- Vše do `docs/KOMPONENTY.md` (§9, §13b, §18, §20), `docs/DATOVY-MODEL.md`,
  `docs/UI-ZASADY.md` §3. Cache-busting `ASSET_V` zvednut.

## 7) Co řešit v dalších fázích (plán)

**Nejbližší** — dlouho odkládané, vrací se na řadu:

- **ÚKOLY + NÁSTĚNKA** (v posledních sezeních označováno jako „Krok 7"):
  - Úkoly s kategoriemi (barevné chipy ze Seznamu `task_categories`), termíny,
    přehled „Po termínu" / „Dnes".
  - Plnohodnotná hlavní NÁSTĚNKA: pozdrav, „Naposledy zobrazené", stat dlaždice,
    sekce Po termínu/Dnes.
  - AUTO-ÚKOL „schval výkazy" pro odpovědné osoby (slíbeno už u Výkazů/Krok 6).
  - Případně i Komunikace/timeline aktivit (původně plánováno společně).

**Dál** (každý krok spec-first):

- **ADMINISTRACE / RBAC** — formalizace rolí a práv (nahradit dočasné `persons.is_admin`),
  pozvánky kolegů, správa Seznamů.
- **ZAKÁZKY** — delivery projekty s milníky, KANBAN (drag-drop) + list, „update klientovi".
  Sdílená kanban komponenta.
- **OBCHOD** — obchodní příležitosti, PIPELINE kanban + hodnoty/součty (reuse kanbanu).
- **VYHLEDÁVÁNÍ** — horní hledání + Ctrl+K (skok na firmu/osobu/zakázku/deal).
- **DOLEŠTĚNÍ** — UX/responzivita/aria audit proti UI zásadám.

**Později** (mimo MVP): manažerské reporty (hodiny/spendy/tým), e-mail integrace,
nasazení na `crm.conviu.com` (HTTPS, cookie Secure/SameSite, CSRF, rate-limit loginu,
případně PostgreSQL přes DB seam).

Možné další SKINY (Petr se ptal): kromě 6 hotových se zvažovaly Sépie/teplé světlo,
OLED černá, Nord, Solarized. Přidání skinu = 1 soubor + položka v `SKINS`.

## 8) Petrovy preference a tvrdá omezení (respektuj při práci)

- SERVER NA PORTU 3000 je Petrova zkratka (`start-crm.bat`, `tsx watch`). NIKDY
  nezabíjet jeho proces kvůli nasazení (změny se nasadí samy). NIKDY nenechávat
  běžet vlastní instanci na pozadí (pral by se o port → EADDRINUSE). Pro testy
  používej jeho běžící server, nebo zkušebně jiný port a hned vypni.
- NEUTRÁCET API ROZPOČET: nespouštět sám programy s placenými API voláními
  (CRM jako takové žádná placená API nevolá — to je v pohodě; pravidlo míří na jiné
  nástroje agentury). Kompiluj/testuj; ostré běhy nech na Petrovi.
- Pro kolegy tvoř DOCX/XLSX, ne Markdown (tým MD nečte) — týká se výstupů pro lidi,
  ne projektových docs.
- NEMAZAT data v rozpracovaných souborech (když si je Petr naplní vlastními daty,
  needituj regenerací — cílená úprava).
- Čeština všude (UI, komentáře, dokumentace).
- Spec-first, katalog komponent, jednotná terminologie (viz bod 3 a `docs/`).

## 9) Užitečné cesty a fakta

| Položka | Hodnota |
|---|---|
| Projekt | `D:\Internet\Trefoil CRM` (git repo `trefoil-crm`) |
| Spuštění | zástupce na ploše → `start-crm.bat` (název zástupce může být historicky „Conviu CRM") |
| URL | `http://localhost:3000` |
| První přihlášení | zakládá se průvodcem „Založení organizace" (žádný hardcoded admin v kódu) |
| GitHub | `petebele/trefoil-crm` (private); v1 archiv `conviu-crm/conviu-crm` |
| v1 archiv lok. | `C:\Users\Jetel\dev\conviu-crm-v1-archiv` (read-only reference) |
| Capsule screeny | `D:\Download\capsule-crm` (vizuální etalon) |
| Mockupy | `mockupy\*.html` (otevři v prohlížeči — klikací reference) |
| Git identita | Petr Běloch \<246769165+petebele@users.noreply.github.com\> (skrytý gmail kvůli GH007) |

## 10) Otevřené body k rozhodnutí

- **PUSH:** lokálně je víc nepushnutých commitů (`git status` ukazuje „ahead"). Pushnout na GitHub?
  (Petr je netechnický — push nech jako vědomé rozhodnutí, ne automaticky.)
- **VÝCHOZÍ SKIN:** nechat „Klasický · světlý", nebo udělat výchozím „Trefoil · světlý"
  (pro interní firemní nástroj dává smysl)?
- **VS Code:** projekt otevírej na cestě `D:\Internet\Trefoil CRM`.
- **REBRAND HOTOVÝ** (kód i repo) — viz blockquote nahoře; už není co dořešit.
