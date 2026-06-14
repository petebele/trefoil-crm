# Specifikace modulu: Krok 7 — Úkoly + Nástěnka

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Úkoly = osobní/týmové to‑do s kategoriemi a termíny, volitelně navázané na zákazníka.
> Nástěnka = denní vstupní obrazovka, která úkoly sesbírá (Po termínu / Dnes) a ukáže
> poslední dění. Uzavírá slib z Kroku 6: **auto‑úkol „schválit výkaz"** odpovědné osobě.

## 1. Účel

Tým si eviduje úkoly (termín, kategorie, volitelně k zákazníkovi) a hned po přihlášení
je vidí pohromadě na **Nástěnce** — co je po termínu a co dnes. Úkoly drží denní rytmus;
automatický úkol upozorní odpovědné osoby, že mají schválit vykázanou práci.

## 2. Obrazovky

1. **Nástěnka `/`** (vždy, vstupní obrazovka po přihlášení) — nahradí dnešní placeholder:
   pozdrav dle denní doby + datum → **Moje úkoly** v sekcích **Po termínu** (červený
   nadpis) / **Dnes** / **Tento týden** (řádky dle UI‑ZASADY §5: chip kategorie + text +
   odkaz na zákazníka + termín) → karta **Poslední dění** (events napříč zákazníky).
   Pravý sloupec: karta **Úkoly** s rychlým přidáním. *(Kalendář zatím jen placeholder.)*

2. **Modul Úkoly `/ukoly`** (ikona v liště, zapínatelný — v registru už je, `built:false`):
   seznam s filtr‑pilulkami **Vše / Po termínu / Dnes / Tento týden / Hotové**, skupiny
   dle termínu; řádek = zaškrtávátko + chip kategorie + text + (zákazník odkaz) + termín;
   přepínač **Moje / Tým** (Tým jen pro admina). Přidání = velký modál (§21).

3. **Detail zákazníka → pravý panel „Úkoly a události"** (dnes placeholder): úkoly
   navázané na zákazníka + akce **Přidat úkol** (předvyplní zákazníka).

4. **Rychlé přidání**: lišta **„Přidat +" → Úkol** (velký modál, vždy po ruce) + rychlé
   přidání přímo na Nástěnce.

## 3. Pole a data

- Nová tabulka **`tasks`**: `id`, `tenant_id`, `title`, `category_item_id` (Seznam
  `task_categories`, volitelné), `client_id?` (vazba na zákazníka), `due_at?` (den),
  `done` 0/1, `done_at?`, `assignee_id` (kdo má splnit), `created_by_id`, `created_at`.
  *(Pole pro zakázku/deal a `remind_at`/opakování přidáme, až budou ty moduly — viz „K rozhodnutí".)*
- Číselník **`task_categories`** (Seznam, barevné plné chipy dle UI‑ZASADY §2):
  **Hovor** (teal) · **E‑mail** (pink) · **Schůzka** (red) · **Follow‑up** (orange) ·
  **Úkol** (indigo). Nasadí se idempotentně v seedu.
- Navázaný úkol zapisuje do `events` zákazníka (založení / hotovo) → **realtime** všude.

## 4. Pravidla a stavy

- Úkol má dva stavy: **otevřený / hotový** (přepíná zaškrtávátko). „Po termínu" =
  otevřený s `due_at` < dnes.
- **Přiřazení**: výchozí = já; jde přiřadit kolegovi. Vidím svoje úkoly; **admin** navíc
  cizí (přepínač „Tým"). *(Plné role doplní RBAC; teď stačí admin × ne‑admin.)*
- **Auto‑úkol „schválit výkaz"**: když někdo zadá výkaz (pending) a **není** sám
  schvalovatelem, vznikne úkol pro **odpovědnou osobu zákazníka**: „Schválit výkaz …
  (#id)", kategorie **Follow‑up**, termín **dnes**, navázaný na zákazníka. Při
  **schválení i smazání** výkazu se úkol automaticky **uzavře**. (Bez odpovědné osoby
  se úkol nevytváří.)
- Upravit/smazat úkol smí jeho **autor, přiřazený, nebo admin**.
- Validace: **text povinný**, termín i kategorie volitelné.

## 5. Akce (kontextové)

- Lišta „Přidat +" → **Úkol**. Nástěnka: rychlé přidání. Detail zákazníka: **Přidat úkol**.
- Řádek úkolu: **zaškrtnout = hotovo** · Upravit · Smazat (⋯ / hover, dle práv).
- Klik na zákazníka v úkolu → jeho detail.

## 6. Prázdné stavy

- Nástěnka — Po termínu: „Nic po termínu. 🎉"; Dnes: „Na dnes nemáš žádný úkol.
  **Přidat úkol.**"
- `/ukoly`: „Zatím žádné úkoly. **Přidat první úkol.**"
- Detail zákazníka: „K tomuto zákazníkovi není žádný úkol. **Přidat úkol.**"

## 7. Hotovo, když… (checklist)

- [ ] Úkol jde přidat z lišty, Nástěnky i detailu zákazníka; přiřadit, dát termín + kategorii
- [ ] Nástěnka ukazuje Po termínu / Dnes / Tento týden + Poslední dění; prázdné stavy sedí
- [ ] `/ukoly`: filtry, skupiny dle termínu, přepínač Moje/Tým, zaškrtnutí = hotovo (realtime)
- [ ] Auto‑úkol „schválit výkaz" vzniká odpovědné osobě a po schválení/smazání výkazu mizí
- [ ] `task_categories` nasazené v seedu (barevné chipy); modul zapínatelný; vše v Historii + realtime
- [ ] typecheck zelený, HTTP testy projdou; odpovídá UI zásadám (hierarchie, chipy, prázdné stavy, aria, mobil)

---

## Rozhodnuto (2026-06-14, schváleno Petrem)

1. **„Naposledy zobrazené"** se do MVP **vynechává** — na Nástěnce bude „Poslední dění"
   (events). Sledování zobrazení případně později.
2. **Rozsah úkolu v1 = termín + hotovo** (štíhlé) — bez odkladu/snooze a bez opakování.
3. **Pohled „Tým"** — cizí úkoly vidí **jen admin** (plné role až s RBAC).
