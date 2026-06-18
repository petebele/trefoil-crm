# Specifikace: Poznámky

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [vize práce](../VIZE-ukoly-projekty-poznamky.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Vychází z [VIZE §6](../VIZE-ukoly-projekty-poznamky.md) a z průzkumu konkurence (Trello —
> model obsahu; HubSpot — poznámka na víc entit; Folk/Attio — viditelnost; Linear/Gmail/GitHub —
> „jednoduché vložené / bohaté samostatné"). Rozhodnutí Petra (2026-06-16): **vlastní editor bez
> externích knihoven, formátování viditelné rovnou při psaní; výchozí viditelnost = tým.**

## 1. Účel

**Poznámka = samostatný objekt** (text + autor + čas), který jde „nalepit" na různé prvky
(zákazník, osoba; později projekt, úkol, výkaz). V základu jednoduchá, ale rozšiřitelná
(později obrázky, přílohy, komentáře). Stejná komponenta funguje dvojmo:

- **Nástavba (dashboard poznámek)** — u zákazníka a osoby vlastní **záložka „Poznámky"**:
  sdružuje poznámky dané entity i poznámky **propsané přes vazby** (osoba↔firma).
- **Vložené pole (1 poznámka)** — později u úkolu/výkazu: jedna poznámka, bez nástavby,
  v kompaktní podobě, která „nevyčnívá".

## 2. Obrazovky

**Záložka „Poznámky" (firma i osoba):**
- V záhlaví vždy viditelné **„Nová poznámka"** (＋), `KebabMenu` (⋯) sekce dle katalogu.
- Seznam karet poznámek (nejnovější nahoře; připnuté později nad nimi). Karta = avatar+jméno
  autora, čas (`relTime`), **obsah** (vyrenderované formátování), případně štítek **viditelnosti**
  („Soukromá"). Na kartě `hover-row` + `row-actions` ⋯.
- **U firmy:** přímé firemní poznámky **+ propsané** poznámky jejích osob (viz §4), propsané
  s jemným štítkem původu **„u osoby Jan Novák"** (je jasné, že nevznikly přímo u firmy).
- **U osoby:** jen **přímé** poznámky osoby (čistý feed). Pokud má osoba u svých firem další
  poznámky, dole jen **nehlučný odkaz** „U firmy <název> je dalších X poznámek →" (skok na
  Poznámky firmy), ne jejich plný výpis.

**Editor poznámky (mini-panel u vložení, nebo modál pro plné psaní):**
- Plocha pro psaní s **živým formátováním** (vlastní `contenteditable`, viz §3).
- **Lišta tlačítek** (progresivní — vzor Linear/Gmail): tučné, kurzíva, nadpis, odrážkový/číslovaný
  seznam, odkaz. (Obrázek/příloha = později, lišta na to počítá s místem.)
- Volba **viditelnosti** (Tým / Soukromá) a **„čeho se týká"** (předvyplněno aktuální entitou;
  lze přidat další — osobu, firmu).
- Vzhled = katalogové prvky (`.field`, `.btn`); samotný editor je **nový vzor → nejdřív do
  `docs/KOMPONENTY.md` + `mockupy/komponenty.html`**, pak implementace (pravidlo UI=katalog).

## 3. Pole a data

- **`notes`** — `id`, `tenant_id`, `body_html` (uložené **bezpečné** HTML), `created_by_id`,
  `created_at`, `updated_at`, `is_private` (0/1). (Rozšiřitelnost: `meta` JSON pro budoucí pole.)
- **`note_links`** — `tenant_id`, `note_id`, `entity_kind` (`client`|`person`|později
  `project`/`task`/`work_record`), `entity_id`. PK `(note_id, entity_kind, entity_id)`.
  Umožní **jednu poznámku na víc entit** (HubSpot‑style). Idempotentní migrace (`ALTER`/`createTable`).
- **Editor & obsah (vlastní, bez knihoven):** `contenteditable` plocha + drobná lišta v
  `public/app.js` (formátování přes `document.execCommand` — bez závislostí, podpora ve všech
  prohlížečích). **Odřádkování:** `defaultParagraphSeparator='p'` → Enter = nový odstavec `<p>`,
  Shift+Enter = tvrdé zalomení `<br>`. Ukládá se **HTML omezené na allowlist**: `p, br, strong,
  em, u, h1, h2, h3, ul, ol, li, a[href], blockquote`. **Server allowlistem přebuduje/očistí**
  vstup (interní nástroj, ale klient není bezpečnostní hranice — zahodit
  `script`/`style`/`on*`/`javascript:`/`data:` URL i vše mimo seznam). Vlastní mini‑sanitizer ve
  `domain/` (žádná knihovna). Sanitizer zároveň **normalizuje strukturu** (kvůli rozdílům
  prohlížečů — Safari umí `<div>` místo `<p>`): volný text obalí do `<p>`, `<div>` převede na
  `<p>`, zahodí prázdné odstavce. Uložené HTML je tak konzistentní bez ohledu na prohlížeč.
  `<br>` (Shift+Enter) zůstává jako měkké zalomení uvnitř odstavce. Render = uložené HTML do
  obalu `.note-content`.
- **Styly se nemíchají.** Tučné a nadpisy jsou nezávislé, jasně oddělené styly: nadpis je tučný
  **ze stylu** (CSS), ne přes `<strong>`. Tlačítko B je v nadpisu **neaktivní** (nesvítí ani
  nereaguje) a sanitizer uvnitř nadpisů `<strong>`/`<b>` **neukládá**. Aktivní stav v liště svítí
  přesně podle stylu/úrovně (H1 jen v H1; B jen u tučného, ne u kurzívy/podtržení).
- **Propis JEN osoba→firma (řízený autorem):** propis = **explicitní vazba**, ne automatika.
  Při psaní poznámky u osoby lze zaškrtnout **„Týká se i firmy <název>"** (má‑li osoba firmu/y;
  u více firem výběr které). Tím vznikne `note_link` i na firmu → poznámka se ukáže ve feedu
  firmy se štítkem „u osoby <jméno>". Bez zaškrtnutí zůstává jen u osoby. **Firemní poznámky se
  na osoby nepropisují** (proti hluku). `person_clients` se použije jen pro odkaz‑ukazatel u
  osoby („U firmy X je dalších Y poznámek") a pro nabídku firem v zaškrtávátku.
- **Realtime:** založení/změna/smazání volá `logEvent()` → živé zóny (`hx-trigger="live-update"`)
  se překreslí. Poznámka se objeví ve feedu všech dotčených entit.

## 4. Pravidla a stavy

- **Viditelnost:** výchozí **Tým** (vidí každý s přístupem k entitě). Lze přepnout na **Soukromá**
  (vidí jen autor). Soukromá se nepropisuje ostatním ani přes vazby.
- **Práva:** upravit/smazat poznámku smí **autor** a **admin** (do RBAC; pak `notes.edit_*`).
- **Propis pouze osoba→firma, řízený** (viz §3): poznámka u osoby se ukáže u firmy jen když
  autor zaškrtne „Týká se i firmy". **Firma→osoba se nepropisuje** — u osoby je místo toho jen
  tichý odkaz na počet poznámek u jejích firem. Soukromá poznámka se nepropisuje vůbec.
- **Více vazeb:** autor může poznámce přidat další „čeho se týká" (např. osoba + firma).
- **Mazání entity:** smazání zákazníka/osoby odpojí její `note_links` (poznámka zůstane, dokud
  má aspoň jednu vazbu; bez vazeb → skrytá/smazaná — dořešit při stavbě).

## 5. Akce (kontextové)

- **„Nová poznámka"** — v záhlaví záložky Poznámky (vždy viditelné; prázdný stav má vlastní akci).
- Na kartě poznámky **⋯** (`row-actions`, odkryje se najetím): **Upravit**, **Soukromá/Sdílená**,
  **Vytvořit úkol**, **Smazat**.
- **Vytvořit úkol** se **NEzakládá rovnou** — otevře **modál nového úkolu** předvyplněný z poznámky
  (název = nadpis/výřez, klient z vazby, skrytá **vazba na poznámku** `source_kind='note'`/`source_id`),
  kde uživatel dopíše řešitele, termín a detaily a teprve pak uloží. (Úkol si tak drží odkaz na původ.)
- Klik na obsah/kartu → editace (vzor jako u výkazů/úkolů), komu je povolena.

## 6. Prázdné stavy

- Záložka bez poznámek: **„Zatím žádná poznámka."** + akce **„Napsat poznámku."**
- Vložené pole (později) bez obsahu: **„Bez poznámky. Přidat poznámku."**

## 7. Fázování

- **v1 (teď):** objekt `notes` + `note_links`; vlastní editor (formátování: tučné/kurzíva/
  nadpis/seznam/odkaz); **záložka „Poznámky" u firmy i osoby** s propisem osoba↔firma;
  viditelnost Tým/Soukromá; **Vytvořit úkol**; zobrazení ve feedu (realtime).
- **v1.5:** **vložené pole** (1 poznámka) u úkolu/výkazu; **připnutí** důležité poznámky nahoru.
- **později:** záložka u **projektů** (nástavba i přes úkoly/klienty projektu); **obrázky a
  přílohy**; **komentáře a @zmínky**; plnohodnotná editorová lišta. **@zmínka** osoby/firmy
  poznámku automaticky zařadí do feedu/dashboardu zmíněné entity (rozšíří tichý ukazatel u
  osoby na „poznámky jmenovitě zmiňující tuto osobu").

## 8. Hotovo, když… (checklist)

- [ ] U firmy i osoby je záložka **Poznámky**; jde založit, upravit, smazat poznámku.
- [ ] Editor **bez externí knihovny**, formátování (tučné/kurzíva/nadpis/seznam/odkaz) je vidět
      rovnou při psaní; uložený obsah se správně vyrenderuje.
- [ ] Uložené HTML je **očištěné** na allowlist (žádný skript/handler/nebezpečná URL projde).
- [ ] Poznámka u osoby se zaškrtnutým „Týká se i firmy" se ukáže u firmy se **štítkem „u osoby <jméno>"**;
      bez zaškrtnutí zůstane jen u osoby; soukromá se nepropisuje. U osoby je tichý odkaz „U firmy X je dalších Y poznámek".
- [ ] **Viditelnost** Tým/Soukromá funguje; soukromou vidí jen autor.
- [ ] **Vytvořit úkol** z poznámky přenese text i vazby na entity.
- [ ] Poznámka se objeví ve feedu dotčených entit **realtime** (`logEvent` + živé zóny).
- [ ] Nový editor je v **`docs/KOMPONENTY.md` + `mockupy/komponenty.html`**.
- [ ] `pnpm typecheck` zelený, proklik v prohlížeči, odpovídá UI zásadám (⋯, prázdné stavy, čeština, aria).

## 9. Stav rozšíření

- **Nadpis + Seznam/Mozaika (HOTOVO 2026-06-18):** poznámka má volitelný `notes.title`; přepínač
  zobrazení per uživatel (`person_prefs` klíč `poznamky.view`). Detaily v `KOMPONENTY.md §26`.
- **Jednotná karta + řazení (UPRAVENO 2026-06-18):** Poznámky jsou **vždy karty** (Seznam = 1 sloupec,
  Mozaika = 2). Karta: **nadpis nahoře + ⋯ vždy vpravo nahoře** (ne hover), 2. řádek **autor · datum**
  (`relOrDate`: do 2 dnů relativně, starší absolutně), pak text. **Pevná výška náhledu** s **rozbalením**
  (`.note-expand`, JS detekuje ořez). **Drag/drop řazení** v obou pohledech → `POST /poznamky/poradi`
  → `note_links.sort_order` (**sdílené pro tým**). `NoteCard` prop `layout`: `card` (Poznámky) /
  `feed` (řádek ve „Dění u služby", neřadí se). Bez změny tabulek kromě `note_links.sort_order`.
