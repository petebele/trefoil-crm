# UI zásady Conviu CRM v2 — podle Capsule CRM

> Designový manuál v2. Vychází z vizuální analýzy 19 referenčních screenshotů Capsule CRM
> (`D:\Download\capsule-crm`; 3 marketingové hlavičky přeskočeny — neobsahují UI navíc).
> Cíl: **replikovat vizuální jazyk Capsule** v našem lehkém stacku.
> Živá ukázka: složka [`/mockupy`](../mockupy) (nástěnka, zákazníci, detail zákazníka).

---

## 1. Celkový layout

- **Horní lišta** (bílá, ~60 px, jemná spodní linka) — žádný levý sidebar:
  - vlevo **ikonová navigace** (jen ikony, bez textu): Nástěnka, Zákazníci, Úkoly, Zakázky, Obchod, Administrace.
    Aktivní ikona = tmavší + světle šedý čtverec pod ní.
  - uprostřed **vyhledávací pole** (zaoblené, světle šedé pozadí, lupa + hint „Hledat… `/`").
  - vpravo **„Přidat +"** (bílé tlačítko s rámečkem), avatar + jméno + firma + šipka.
- **Obsah**: světle šedé pozadí stránky (`--bg`), obsah v bílých kartách. Max šířka ~1400 px, středění.
- **Hlavička stránky**: H1 vlevo (název modulu), **primární akce vpravo** (indigo solid + bílé outline).
- **Přepínač pohledů** pod H1: ikona + text, aktivní = indigo text + 3px indigo podtržení.
- **Řádek filtrů**: bílé pilulky s rámečkem `Štítek: Hodnota ▾`.

## 2. Barvy (CSS tokeny)

| Token | Hodnota | Použití |
|---|---|---|
| `--ink` | `#1e2235` | primární text (téměř černá, do modra) |
| `--muted` | `#6b7280` | sekundární text, popisky, meta |
| `--bg` | `#f6f7f9` | pozadí stránky |
| `--card` | `#ffffff` | karty, lišta, tabulky |
| `--line` | `#e7e9ee` | rámečky, oddělovače (1px) |
| `--accent` | `#635df5` | primární akce, odkazy, aktivní taby (indigo) |
| `--accent-soft` | `#eceafd` | světlé indigo pozadí (počty na kanbanu, vybraná položka) |
| `--teal` | `#0aa789` | úspěch, progress bary, „Vyhráno", stav Aktivní/Open |
| `--red` | `#e5484d` | destrukce, „Prohráno", Po termínu |
| `--orange` | `#f59e0b` | kategorie Follow-up/Úkol, stav Upcoming |
| `--pink` | `#ec5b78` | kategorie E-mail |

**Kategorie úkolů = barevné plné chipy s bílým textem** (jako Capsule): Hovor=teal, E-mail=pink,
Schůzka=red, Follow-up=orange, Milník=indigo. **Štítky (tagy) = naopak tlumené**: světle šedé
pilulky (`#eef0f3`, text `--ink`, 12 px) — nikdy nesmí křičet.

**Avatary**: kruh s iniciálami, pastelové pozadí (zelená/růžová/modrá/žlutá), tmavší text téže barvy.

## 3. Typografie

- Font: systémový sans (`Inter`-like stack: `-apple-system, "Segoe UI", Roboto, sans-serif`).
- Škála: **H1 stránky 26–28 px / 650** · **název záznamu 22–24 px / 700** · sekce 15–16 px / 600 ·
  tělo 14 px · meta/popisky 12–13 px `--muted`.
- **Velikost = význam.** Název záznamu je největší věc na stránce. Web, IČO, telefon = malé,
  šedé popisky s hodnotou. Štítky malé. (Hlavní poučení z v1!)

## 4. Komponenty

- **Tlačítka** (radius 10 px, 14 px text): primární = indigo solid bílý text; sekundární = bílé,
  1px rámeček, tmavý text; ghost/link = indigo text bez pozadí; destruktivní = červený text/solid.
  Split button (Edit ▾). Velikosti: normální 36 px, malé 30 px.
- **Karty**: bílé, 1px `--line`, radius 12 px, padding 16–20 px, žádný/minimální stín.
  Hlavička karty: název vlevo (15px/600), akce vpravo (malé outline tlačítko nebo link).
- **Tabulky/seznamy**: vzdušné řádky (~60 px), 1px oddělovače, bez zebra. Vzor řádku:
  checkbox · avatar · **tučné jméno** + malý šedý podtitulek („Jednatel v …" jako odkaz) ·
  další sloupce obyčejně, odkazy indigo, meta malé šedé („Práce" u e-mailu).
- **Stat dlaždice** (detail/nástěnka): řádek bílých karet — ikona + **velké tučné číslo** + malý šedý popisek.
- **Taby obsahu**: Historie | Soubory | Zakázky `2` — aktivní indigo + podtržení; počty jako malé šedé číslo.
- **Progress bar**: tenký (6 px), teal, segmentovaný u fází; vedle „Milník: Nabídka (40 %)".
- **Kanban**: hlavička sloupce mimo karty (název 600 + počet ve světle indigo pilulce + součet vpravo + „+" a „⋯");
  karta = bílá, radius 12: logo kruh + šedý název firmy (12px) / **tučný titulek** + hodnota vpravo;
  meta řádek: 📅 datum + ✓/📎 počty + avatar 20 px. Ghost „+" pruh dole.
- **Timeline**: záznam = ikona typu + „**Poznámka od Petra** · 9. 6." (tučné jméno, šedé datum) + text;
  přílohy jako malé orámované soubory-chipy; akční řádek nad timeline: filtr ▾ + hledání +
  „Poslat e-mail" (outline) + „Zapsat aktivitu" (indigo).
- **Formuláře/modály**: malý šedý label NAD polem (12 px, povinné s `*`), input bílý, 1px rámeček,
  radius 8 px; doplňkové akce jako indigo linky („Přidat kategorii"); Uložit (indigo) + Zrušit (link).
- **Quick-view panel**: kliknutí na řádek otevře pravý panel/kartu se souhrnem a Edit — ne hned celou stránku.
- **Prázdné stavy**: krátká věta + kontextová akce (`Zatím žádná zakázka.` + [Vytvořit zakázku]).
  Nikdy „Přidej tlačítkem X" (pravidlo z v1).

## 5. Vzory obrazovek

### Nástěnka (landing po přihlášení)
Malé šedé datum → **H1 „Dobré ráno, Petře"** → taby (Můj přehled | Nedávná aktivita | Komentáře) →
„Naposledy zobrazené" (řádek avatar-chipů) → „Aktivita" (stat dlaždice). **Pravý sloupec**: karta
Kalendář (prázdný stav se ✔ ikonou) + karta **Úkoly** se sekcemi **Po termínu** (červený nadpis) /
**Dnes** — položky: barevný chip kategorie + text + šedé datum + indigo odkazy na záznamy.

### Přehled zákazníků (seznam)
H1 + akce vpravo (Import outline · Přidat osobu · Přidat firmu — indigo). Filtr pilulky.
„Zobrazeno 1–50 z 240" vlevo, hromadné akce vpravo (Export, Přiřadit, E-mail). Tabulka dle §4.
Klik na řádek → quick-view panel vpravo.

### Detail záznamu (3 sloupce — „srdce" aplikace)
- **Levý sloupec (~320 px)**: logo/avatar 72 px · Edit ▾ · **název** · „pro [Firmu]" (indigo link) ·
  štítky (malé šedé chipy) · svislý seznam faktů (hodnota + malý šedý popisek: telefon/e-mail/web/adresa)
  · sekce s tenkou linkou: Odpovědná osoba, Lidé/Kontakty (avatar + tučné jméno + šedá role-odkaz).
- **Střed (pružný)**: nahoře **stat dlaždice** (Aktivní služby · Poslední kontakt · Kč/měs · Zakázky) →
  taby → akční řádek → **timeline**.
- **Pravý sloupec (~320 px)**: karty Úkoly (chip kategorie + text + termín, Přidat úkol),
  Aktivní služby, Poslední komentář (avatar + text + „Zobrazit vše ›").

### Kanban (Zakázky, Obchod)
Dle §4; nad tabulí H1 + přepínač Pipeline/List(/Dashboard) + souhrn vpravo
(„Očekávaná hodnota: 57 840 Kč · Celkem: 96 400 Kč").

## 6. Jazyk a chování (přenáší se z v1 — platí dál)

- **Lidský jazyk, žádný žargon** („Zatím žádná zakázka.", ne „No records found").
- **Kontextové akce** — akce tam, kde je potřeba, ne odkazy na tlačítka jinde.
- **aria-label** u ikonových tlačítek, viditelný focus, kontrast textů.
- **Responzivita**: tabulky scrollují vodorovně; detail se na mobilu skládá: levý sloupec → střed → pravý;
  kanban scrolluje vodorovně.

## 7. Implementace v našem stacku

- **Katalog komponent**: přesné kódy a pravidla každého prvku → `docs/KOMPONENTY.md`,
  živý náhled všech prvků → `mockupy/komponenty.html`. Moduly **nevymýšlejí nové prvky** —
  používají katalog; co chybí, nejdřív přibude do katalogu.
- Tokeny z §2 = CSS proměnné v `public/theme.css` (vznikne v Kroku 2 z `mockupy/styl.css`).
- **Bootstrap 5 jen jako podvozek chování** (dropdown, collapse, modal) — vzhled určuje náš theme;
  Bootstrap proměnné přemapovat na naše tokeny, komponenty z §4 jako vlastní třídy (`.chip`, `.kanban-card`…).
- Mockupy v `/mockupy` jsou čisté HTML+CSS (bez závislostí, fungují offline) a jsou **závazná
  vizuální reference** pro implementaci modulů.
