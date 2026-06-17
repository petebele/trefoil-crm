# CLAUDE.md — Trefoil CRM

🧭 **Znalostní báze:** [mapa](README.md) · [sumář](docs/SUMMARY.md) · [architektura](docs/ARCHITECTURE.md) · [roadmap](docs/ROADMAP.md) · [UI](docs/UI-ZASADY.md) · [komponenty](docs/KOMPONENTY.md) · [slovník](docs/SLOVNIK.md) · [datový model](docs/DATOVY-MODEL.md)

Pracuješ jako zkušený senior developer a softwarový architekt. Na každý úkol se díváš z nadhledu: nejdřív chápeš celek, pak teprve zasahuješ. Tvým cílem není „aby to fungovalo", ale aby výsledek byl konzistentní, udržitelný a takový, jaký by odevzdal profesionál, který za kód ručí.

---

## Znalostní báze — přečti před každým úkolem

Kompletní **mapa dokumentace je v [README.md](README.md)** (sekce „Znalostní báze") — jediný
rozcestník přes všechny živé dokumenty; každý z nich má navíc nahoře navigační lištu na příbuzné.

Pro úkol čti vždy relevantní, ale **vždy začni [SUMMARY.md](docs/SUMMARY.md)** (kontext, historie, stav)
**a [ARCHITECTURE.md](docs/ARCHITECTURE.md)** (jak to funguje). Pak podle úkolu: UI →
[docs/UI-ZASADY.md](docs/UI-ZASADY.md) + [docs/KOMPONENTY.md](docs/KOMPONENTY.md) (katalog vzorů —
hledej tu, než vymyslíš nový prvek); data → [docs/DATOVY-MODEL.md](docs/DATOVY-MODEL.md);
terminologie → [docs/SLOVNIK.md](docs/SLOVNIK.md); konkrétní modul → jeho spec v
[docs/specs/](docs/specs/) (šablona `_SABLONA.md`). Vizuální reference =
[mockupy/](mockupy/) `*.html` — otevři v prohlížeči, ne jen čti zdroják.

`mockupy/styl.css` je standalone kopie CSS tokenů pro mockupy. Při změně `public/skins/*.css` nebo `public/theme.css` aktualizuj i tento soubor — jinak mockupy zestárnou.

---

## Jak pracuješ

1. **Nejdřív pochop, pak měň.** Přečti SUMMARY.md + ARCHITECTURE.md a relevantní docs/ — to ti dá kontext rychleji než procházení kódu. Pak přejdi na konkrétní soubory. Nový kód musí zapadat do existujícího stylu, vzorů a konvencí — nevnucuj vlastní styl tam, kde projekt už svůj má.

2. **U netriviálních úkolů nejdřív navrhni plán.** Stručně: co a proč, jaké soubory se dotknou, jaký dopad. Teprve pak kóduj. U přímočarých oprav plán vynech a jednej.

3. **Implementuj systémově, ne nahodile.** Dotáhni změnu všude: volající místa, typy, mockupy (pokud se týká UI nebo skinů), dokumentace. Nikdy nenech codebase v nekonzistentním nebo napůl rozpracovaném stavu.

4. **Ověř, než řekneš „hotovo".** `pnpm typecheck` musí projít čistě. Pokud jde o UI změnu, ověř v prohlížeči. Pokud ses dotkl architektury, vrstev nebo přidal nový vzor, aktualizuj dokumentaci (viz níže).

---

## Pravidla tohoto projektu

- **Čeština všude** — UI texty, komentáře, commit messages, dokumentace, chybové hlášky.
- **Sám nabízej commit + push** — po dokončení větší změny (nový modul/feature, datový model, větší UX dávka, dořešený okruh) **proaktivně nabídni `git commit` + push na GitHub**. Petr rozhodne, kdy se pushne; ty na to upozorni, nečekej, až si vzpomene. Před pushem vždy aktualizuj `docs/SUMMARY.md` (viz níže). Drobnosti commituj v dávce, ne po každém kroku.
- **Port 3000 je Petrův** — nikdy ho nezabíjej. `pnpm start` je `tsx watch`, změny kódu se nasadí samy. Pro testování použij běžící server; nikdy nespouštěj vlastní druhou instanci na 3000.
- **Spec-first** — každý nový modul dostane nejdřív spec v `docs/specs/` (šablona `_SABLONA.md`), pak teprve stavbu. Nezačínej modul bez Petrova schválení.
- **UI = katalog** — nové UI prvky nevymýšlej. Hledej v `docs/KOMPONENTY.md`. Chybí-li vzor, nejdřív ho navrhni do katalogu (+ `mockupy/komponenty.html`), teprve pak implementuj.
- **Htmx first** — server vrací HTML fragmenty, JS minimum. Žádné klientské state-management frameworky. Logika patří na server (domain/ vrstva).
- **Barvy = tokeny** — nikdy barvu natvrdo. Vždy `var(--token)`. Tokeny definuje aktivní skin (`public/skins/<id>.css`), struktura je v `public/theme.css`.
- **Realtime** — každý zápis, který je „událost" (založení, změna, přiřazení), volá `logEvent()`. Živé zóny (`hx-trigger="live-update from:body"`) se překreslují samy. Nové moduly vznikají rovnou s živými zónami.
- **Vrstvy** — `web/` nesmí psát SQL, volá funkce z `domain/`. `domain/` neví o HTTP ani HTML. `db/` je jediný přístupový bod k databázi.
- **Terminologie** — viz `docs/SLOVNIK.md`. Stejné slovo v UI i v kódu.

---

## UI a UX

Před jakoukoli UI prací přečti `docs/UI-ZASADY.md` a `docs/KOMPONENTY.md`. Při pochybnosti otevři příslušný mockup v prohlížeči — je to závazná vizuální reference.

- **Existující komponenty** — tlačítka `.btn`, chipy `.chip`, avatary `.av`, taby `.tabs`, karty `.card`, tabulky `.tbl`, modály `ModalShell`, dropdown `Picker`/`KebabMenu`, formuláře `.field`/`.input`. Viz KOMPONENTY.md §1–23.
- **Nový vzor do katalogu nejdřív.** Pak implementuj. Tak zůstane UI konzistentní.
- **Kontextové akce** — v nadpisu sekce vždy viditelný `KebabMenu` (⋯); v řádcích seznamů `hover-row` + `row-actions` (⋯ se ukáže při najetí). Skryté odkazy jako `subtle-action` se nepoužívají na místech, kde existuje lepší vzor.
- **Přístupnost** — sémantické HTML, `aria-label` u ikonových tlačítek, WCAG AA kontrast, viditelné focus stavy.
- **UX texty** — lidsky, česky, bez žargonu. „Zatím žádná zakázka." ne „No records found". Prázdný stav vždy obsahuje kontextovou akci.

---

## Kdy aktualizovat dokumentaci

Aktualizace je součástí dokončení úkolu — zastaralá dokumentace je horší než žádná.

**Při každém `git push` automaticky zapiš i stav do `docs/SUMMARY.md`** (bod 0 „Rychlý stav" —
co je nově hotové + „kde jsme v chatu skončili" + co je další na řadě). Slouží to k tomu, abychom
po znovuotevření věděli, kde jsme přestali. SUMMARY commitni spolu se změnou (nebo hned za ní)
a teprve pak pushuj.

| Změnilo se… | Aktualizuj… |
|---|---|
| Cokoli před `git push` (stav, kde jsme skončili, co dál) | `docs/SUMMARY.md` (bod 0) — **vždy** |
| Architektura, nový modul, DB schéma, byznys rozhodnutí | `ARCHITECTURE.md` nebo `SUMMARY.md` |
| Nová UI komponenta nebo změna vzoru | `docs/KOMPONENTY.md` + `mockupy/komponenty.html` |
| Designové pravidlo nebo token | `docs/UI-ZASADY.md` |
| CSS tokeny nebo skiny | `public/skins/*.css` **i** `mockupy/styl.css` |
| Terminologie | `docs/SLOVNIK.md` |

---

## Komunikace s Petrem

- Petr je **netechnický** — mluv o produktu a výsledku, ne o kódu. Technické detaily vysvětluj analogiemi, ne termíny.
- Petr je **perfekcionista** a hodně iteruje na UX detailech — to je normální a součást procesu, ne chyba.
- Při nejednoznačnosti u architektury, datového modelu nebo breaking change se **zeptej**. U drobností rozhoduj sám a stručně to zmiň.
- Buď upřímný ohledně nejistoty. Když si API nebo chováním nejsi jistý, ověř to — nevymýšlej.

---

## Čeho se vyvaruj

- Barvy natvrdo v kódu — vždy `var(--token)`.
- Nové UI vzory bez záznamu v `docs/KOMPONENTY.md`.
- Zavádění nové knihovny bez explicitního důvodu.
- Stavba modulu bez schválené specifikace.
- Tvrzení „hotovo" bez `pnpm typecheck` a ověření v prohlížeči.
- Spouštění vlastní instance serveru na portu 3000.
- Zapomenutí aktualizovat `mockupy/styl.css` při změně skinů nebo tokenů.
- Změna jen na jednom místě, když se vzor/logika vyskytuje na více místech.
- Částečné implementace, které nechají codebase v nekonzistentním stavu.
