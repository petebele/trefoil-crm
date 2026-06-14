# Specifikace: Krok 2 — Kostra aplikace (se zapínatelnými moduly)

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Stav: **schváleno + rozšířeno Petrem** (zapínatelné moduly, založení Organizace,
> výběr modulů při prvním spuštění). Žádné moduly se nestaví — jen kostra, na kterou se věší.

## 1. Účel

Spustitelná aplikace s přihlášením a horní lištou podle katalogu. Nově navíc **obecný
základ pro více organizací a zapínatelné moduly**: uživatel si při prvním spuštění založí
**Organizaci** (svou společnost), stane se jejím **adminem**, vybere si **moduly** — a jen ty
se pak zobrazují všem uživatelům v Organizaci. Admini mohou moduly kdykoli zapnout/vypnout
v Administraci.

## 2. Pojmy (doplňuje slovník)

- **Organizace** = společnost, která CRM používá (prostor týmu). Nezaměňovat s **Firmou**
  (= zákazník). Zakládá ji první uživatel, který se tím stává adminem; další admini jdou
  přidat později. Kolegové se do Organizace zvou (pozvánky = součást modulu Administrace, Krok 5).
- **Modul** = zapínatelná část aplikace. Přednastavené: **Zákazníci, Úkoly, Zakázky, Obchod**
  (registr je rozšiřitelný). **Nástěnka** a **Administrace** nejsou moduly — Nástěnka je vždy,
  Administrace vždy pro adminy.

## 3. Obrazovky

| Obrazovka | Obsah |
|---|---|
| **/zalozeni** (jen při prázdné DB) | Průvodce prvním spuštěním, jedna stránka: ① Název organizace · ② Účet správce (jméno, e-mail, heslo) · ③ **Výběr modulů** (checkboxy s popisem, vše předvybrané) · „Založit a vstoupit". Po odeslání rovnou přihlášen na Nástěnku. |
| **/login** | Vycentrovaná karta (katalog §16): e-mail + heslo, chyba lidsky: „Neplatný e-mail nebo heslo." |
| **/** Nástěnka (kostra) | Pozdrav dle denní doby + oslovení („Dobré ráno, Petře"), datum, prázdný stav: „Nástěnka se plní s každým zapnutým modulem." |
| **/administrace** | Zatím jediná karta **Moduly**: checkbox + název + popis pro každý modul z registru, Uložit. Jen pro adminy (ostatním se nezobrazuje ikona ani stránka). |
| Horní lišta | Nástěnka (vždy) · **jen zapnuté moduly** · Administrace (jen admin). Zapnuté, ale dosud nepostavené moduly: šedé s popiskem „Připravujeme". Vyhledávání a „Přidat +" zatím jen vzhled. Vpravo uživatel → menu „Odhlásit". |

## 4. Technický základ

- **Stack:** TypeScript (`tsx`, bez buildu), **Hono** + server-side JSX, **SQLite**
  (`better-sqlite3` ≥ 12) přes **Kysely**, **htmx** připravené v `public/`. **Bez Bootstrapu** —
  `public/theme.css` = kopie `mockupy/styl.css` (jediný zdroj vzhledu) + `public/app.js`
  (pár řádků: rozbalovací menu).
- **Registr modulů v kódu** (`src/modules.ts`): klíč, název, popis, ikona, cesta, `built`
  (zda už je modul postavený). Zapnuté moduly per Organizace v tabulce `tenant_modules`.
- **Databáze (jen základ):** `tenants` (Organizace), `tenant_modules`, `persons`
  (jméno, login e-mail, heslo-hash, `is_admin` — dočasné, v Kroku 5 nahradí RBAC role),
  `sessions`. **Žádný seed uživatelů** — vše vytvoří průvodce založením. DB `data/crm.db`.
- **Tok přístupu:** prázdná DB → vše přesměruje na `/zalozeni` · existuje Organizace →
  `/zalozeni` přesměruje pryč · nepřihlášený → `/login` · přihlášený na `/login` → Nástěnka.
- **Přihlášení:** scrypt + httpOnly cookie session (vzor v1).
- **Repo náležitosti:** `package.json` (`packageManager`), `tsconfig.json`, `.env.example`,
  CI (install + typecheck), `start-crm.bat` (CRLF) + zástupce „Trefoil CRM" na ploše.

## 5. Pravidla

- Vzhled výhradně z katalogu komponent; průvodce a stránka Modulů skládají jen existující prvky.
- Multi-tenant připravenost dle datového modelu (`tenant_id` všude); zakládání **druhé a další**
  Organizace v jedné instalaci je záměrně vypnuté (přijde až s případným SaaS režimem).
- Texty lidsky, `aria-label` u ikon, hesla nikdy v plaintextu, `.env`/`data/` mimo git.

## 6. Mimo rozsah

Funkční moduly · pozvánky kolegů (Krok 5 — Administrace) · RBAC (Krok 5) · funkční hledání
a „Přidat +" (Krok 8) · více Organizací v jedné instalaci.

## 7. Hotovo, když…

- [ ] `pnpm dev` → prázdná DB přesměruje na /zalozeni; průvodce založí Organizaci + admina + moduly a rovnou přihlásí
- [ ] lišta ukazuje jen zapnuté moduly („Připravujeme"), Administraci jen adminovi
- [ ] /administrace umí moduly zapnout/vypnout a lišta to hned odráží
- [ ] login/logout funguje, špatné heslo ukáže lidskou chybu, nepřihlášený se nikam nedostane
- [ ] Nástěnka: pozdrav dle denní doby + datum + prázdný stav
- [ ] dvojklik na zástupce na ploše spustí vše jedním klikem
- [ ] `pnpm typecheck` zelený lokálně i v CI; push na GitHub
