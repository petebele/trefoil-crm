# Specifikace: Krok 3 — modul Zákazníci

> Stav: **ke schválení**. První skutečný modul. Vizuální reference: `mockupy/zakaznici.html`
> a `mockupy/zakaznik-detail.html`; prvky výhradně z katalogu (`docs/KOMPONENTY.md`).

## 1. Účel

Evidence zákazníků: **Firmy** a **Osoby** (slovník!), jejich **kontaktní údaje**, vzájemné
**vazby** (osoba ↔ firma s rolí), **štítky**, **stav** a **odpovědná osoba**. Historie
komunikace, úkoly a služby přijdou v dalších krocích — detail je na ně připravený a poroste.

## 2. Obrazovky

### /zakaznici — přehled
- H1 „Zákazníci" + vpravo **Přidat osobu** a **Přidat firmu** (primární).
- Taby **Vše / Firmy / Osoby** (s počty) · filtr: **hledání** (živé, přes htmx),
  výběr **Štítek** a **Stav**.
- Tabulka dle katalogu §8: Souhrn (avatar, tučné jméno, podtitulek: firma → web,
  osoba → „Jednatel v [Firma]" jako odkaz) · E-mail (+ malé „Práce/Osobní") · Telefon ·
  Štítky (chipy) · Stav (jen firmy).
- **Klik na řádek → quick-view panel** (katalog §15, načítá se přes htmx): avatar, jméno,
  chipy, hlavní kontakty, „Zobrazit celý profil ›" + Upravit.
- Prázdné stavy: nikdo → „Zatím tu nikdo není." + [Přidat firmu] [Přidat osobu];
  nic nenalezeno → „Nic nenalezeno. Zkus jiné hledání."

### /firmy/nova · /osoby/nova — založení (formulář dle katalogu §16)
- **Firma:** název\*, web, IČO, DIČ, stav (výchozí Lead), odpovědná osoba, poznámka.
- **Osoba:** jméno\*, poznámka. (Kontakty a vazby se přidávají na detailu.)
- Po vytvoření → detail. **„Přidat +" v liště ožívá**: menu „Nová firma" / „Nová osoba"
  (zobrazuje se jen se zapnutým modulem).

### /firmy/:id — detail firmy (3sloupcový hub dle mockupu)
- **Levý sloupec:** avatar (iniciály) · **Upravit** · název · chipy (štítky + stav) ·
  **štítky přidat/odebrat přímo zde** (input s našeptáním, × na chipu) · fakta: kontaktní
  údaje firmy (telefon/e-mail/…) s „+ Přidat", web, IČO, DIČ · sekce **Odpovědná osoba**
  (výběr kolegy, uloží se hned) · sekce **Lidé**: napojené osoby s rolí u firmy
  („Jednatel · telefon") + **„+ Přidat"** → vybrat existující osobu NEBO rovnou založit
  novou (jméno, role u firmy, telefon/e-mail — kontakty se naváží na tuto firmu).
- **Střed:** karta Historie s prázdným stavem: „Historie komunikace přijde s modulem
  Úkoly & komunikace." (plní se v Kroku 4; stat dlaždice přibudou, až budou mít data).
- **Pravý sloupec:** karta **Poznámka** (interní poznámka, editace na místě tlačítkem).

### /osoby/:id — detail osoby
- Levý: jméno, štítky, kontaktní údaje (+ přidat). Střed: prázdný stav historie.
  Pravý: karta **Firmy** (kde působí, s rolí, odkazy) + karta Poznámka.
- **Vazba osoba↔firma se spravuje z detailu firmy** (sekce Lidé) — osoba k osobě nejde (slovník).

### Úpravy a mazání
- **Upravit** → formulář se stejnými poli; dole oddělená zóna **Smazat** (soft-delete,
  potvrzení; firma jde smazat i s vazbami — osoby zůstávají).

## 3. Pole a data (migrace modulu)

Nové tabulky dle `docs/DATOVY-MODEL.md`: `clients` (Firma; `kind` v DB připraven, UI zatím
jen company), `person_clients` (vazba + `role_at_client` + `is_primary`), `person_contacts`
(typ/hodnota/label, `owner_kind` person|client, volitelný kontext `client_id`),
`lists` + `list_items` + `entity_list_items`.

**Seedované Seznamy** (idempotentně; správa UI až v Kroku 5):
- `client_statuses`: Lead (šedá) · Aktivní (teal) · Pozastaveno (orange) · Ukončeno (tmavá)
- `client_tags`: prázdné — štítky vznikají psaním přímo u zákazníka
- `contact_types`: Telefon · E-mail · Jiné
- `roles_at_client`: Jednatel/majitel · Marketing · Fakturace

Osoby = stávající `persons` (zákaznická osoba bez přihlášení; kolegové se v Zákaznících nezobrazují).

## 4. Pravidla a stavy

- Vše scoped na Organizaci (`tenant_id`), soft-delete přes `deleted_at`.
- Práva zatím bez omezení (každý přihlášený může vše) — RBAC přijde v Kroku 5.
- Štítek vzniká napsáním (když neexistuje, vytvoří se v Seznamu `client_tags`).
- Modul v registru přepnout na `built: true` → ikona v liště ožije.

## 5. Akce (kontextové)

Přidání čehokoli tam, kde to je: štítek u štítků, kontakt u kontaktů, osoba v sekci Lidé,
poznámka v kartě Poznámka. Quick-view nabízí Upravit + celý profil. Žádné akce „schované jinde".

## 6. Prázdné stavy (doslovně)

| Kde | Text + akce |
|---|---|
| Přehled bez záznamů | „Zatím tu nikdo není." + [Přidat firmu] [Přidat osobu] |
| Výsledek hledání | „Nic nenalezeno. Zkus jiné hledání." |
| Lidé u firmy | „Zatím žádná osoba." + [Přidat osobu] |
| Kontakty | „Zatím žádný kontakt." + [Přidat kontakt] |
| Firmy u osoby | „Zatím není u žádné firmy. Přiřadíš ji na detailu firmy." |
| Historie (střed) | „Historie komunikace přijde s modulem Úkoly & komunikace." (bez akce) |

## 7. Hotovo, když…

- [ ] založím firmu i osobu (formulářem i přes „Přidat +"), vidím je v přehledu s filtrem Vše/Firmy/Osoby
- [ ] hledání živě filtruje; filtr Štítek a Stav funguje
- [ ] klik na řádek otevře quick-view; z něj se dostanu na detail
- [ ] detail firmy: štítky (přidat/odebrat), kontakty (+ smazat), odpovědná osoba, Lidé (existující i nová osoba s rolí), poznámka
- [ ] detail osoby: kontakty, štítky, seznam firem s rolí, poznámka
- [ ] úprava i smazání (soft) firmy a osoby s potvrzením
- [ ] všechny prázdné stavy dle §6; vzhled odpovídá mockupům a katalogu
- [ ] `pnpm typecheck` zelený, HTTP testy projdou, commit + push, CI zelená
