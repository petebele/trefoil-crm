# Specifikace: Krok 3 — modul Zákazníci

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Stav: **schváleno** (upřesněno Petrem 12. 6. dle reálných Capsule screenshotů
> `D:\Download\capsule-crm\zákazníci`). Vizuální reference: mockupy + Capsule trial.

## 1. Účel

Evidence zákazníků: **Firmy** a **Osoby**, jejich **kontaktní údaje** (vícenásobné, se
štítky typu „práce/domů"), **vazby** osoba↔firma s rolí, **štítky**, **stav**, **odpovědná
osoba** a **Historie** (dohledatelný log všeho, co se u zákazníka stalo).

## 2. Přehled /zakaznici (dle Capsule)

- H1 + vpravo **Přidat osobu** / **Přidat firmu**; „Přidat +" v liště nabídne totéž.
- Taby **Vše / Firmy / Osoby** (s počty) — analogie Capsule „system lists".
- Filtr pilulky: **Štítek**, **Stav**, hledání **Jméno (obsahuje)** — živé přes htmx;
  **Řadit** (Název A→Z / Z→A / Nejnovější). „Zobrazeno X–Y z N".
- Tabulka: Souhrn (avatar, tučné jméno, podtitulek) · E-mail · Telefon · Štítky · Stav.
- **Klik na řádek → quick-view panel** (jméno, chipy, hlavní kontakty, odkaz na profil).
- Prázdné stavy: „Zatím tu nikdo není." + akce; „Nic nenalezeno. Zkus jiné hledání."

## 3. Zakládání

- **Osoba** (`/osoby/nova`): jméno\*, **Firma** (našeptávač — vyber existující NEBO napiš
  novou a založí se s osobou), role u firmy, štítky, **kontakty: více telefonů / e-mailů /
  webů**, každý se **štítkem typu** (Práce, Domů, Mobil… — ze Seznamu, nový jde napsat
  rovnou a uloží se pro příště), poznámka.
- **Firma** (`/firmy/nova`): název\*, web, IČO, DIČ, stav, odpovědná osoba, štítky, kontakty
  (stejný vzor), poznámka.
- Obě nezávisle; po vytvoření → detail.

## 4. Detail zákazníka (firma i osoba) — 3 panely, BEZ mezipanelu ikon

### A) Levý panel — informace, **inline editace (žádné tlačítko Upravit)**
Avatar · název/jméno (klik → uprav na místě) · štítky (přidat psaním s našeptávačem,
× odebere) · kontaktní údaje seskupené (telefony, e-maily, weby) se štítky typu, „+ Přidat
kontakt", × smazat · u firmy: web/IČO/DIČ/stav (inline), **Odpovědná osoba** (výběr) ·
sekce **Lidé** (u firmy): osoby s rolí, + přidat (existující/nová), odebrat · u osoby:
sekce **Firmy** (kde působí, s rolí) · poznámka (inline) · dole malé: Smazat (soft, potvrzení).

### B) Střední panel — feed se záložkami
1. **Nástěnka** — pills statistiky (zatím: poslední aktivita, počet lidí/kontaktů; spendy
   a hodiny přibudou v Kroku 5/6) + feed posledních událostí; komunikace přijde v Kroku 4.
2. **Služby** — zatím prázdný stav „Připravujeme — modul Služby & rozpočty (Krok 5)."
   Pak: aktivní služby se spendem a odpovědnou osobou **za službu u tohoto zákazníka**
   (jiná než obecná odpovědná osoba!) + tracking práce (Krok 6).
3. **Projekty** — prázdný stav „Funkčnost projektů teprve promyslíme."
4. **Historie** — kompletní log: **čas · osoba · co se stalo · ID záznamu** (každá akce
   v modulu se loguje: založení, úprava pole, kontakt, štítek, vazba, poznámka…).

### C) Pravý panel — agenda zákazníka
Karta **Úkoly a události** pro tohoto zákazníka (od kohokoli). Zatím prázdný stav
„Úkoly přijdou s modulem Úkoly (Krok 4)." — panel je připravený.

## 5. Data (migrace modulu)

`clients` · `person_clients` (role_at_client) · `person_contacts` (**type** pevně:
telefon/e-mail/web/jiné; **label** = štítek typu ze Seznamu `contact_labels`, inline-create;
volitelný kontext client_id) · `lists`+`list_items`+`entity_list_items` ·
**`events`** (obecný log: entity_kind, entity_id, person_id, action, created_at — základ
Historie pro celou aplikaci) · `persons.note` (ALTER).

**Seedované Seznamy:** `client_statuses` (Lead šedá · Aktivní teal · Pozastaveno orange ·
Ukončeno tmavá) · `client_tags` (prázdné, vznikají psaním) · `contact_labels` (Práce, Domů,
Mobil, Osobní) · `roles_at_client` (Jednatel/majitel, Marketing, Fakturace).

## 6. Pravidla

- Modul gated: vypnutý modul → routy přesměrují pryč, ikona zmizí.
- Vše tenant-scoped, soft-delete, **každá akce zapisuje událost** do `events`.
- Práva zatím volná (RBAC Krok 7). Registr: `zakaznici.built = true`.
- Inline editace = nová komponenta katalogu (§18) — přidat do katalogu před použitím.

## 7. Hotovo, když…

- [ ] založím osobu s novou firmou jedním formulářem (+ samostatně firmu/osobu)
- [ ] vícenásobné kontakty se štítky typu (vč. nově napsaného štítku → uloží se do Seznamu)
- [ ] přehled: taby s počty, filtr štítek/stav, živé hledání, řazení, quick-view
- [ ] detail: 3 panely dle §4, inline editace bez Edit tlačítka, taby Nástěnka/Služby/Projekty/Historie
- [ ] Historie loguje akce s časem, osobou a ID
- [ ] prázdné stavy doslovně, typecheck + HTTP testy + CI zelené, push
