# Specifikace: Krok 2 — Kostra aplikace

> Stav: **ke schválení**. Žádné moduly ani funkce — jen běžící prázdná aplikace
> ve vzhledu design systému, na kterou se budou moduly postupně věšet.

## 1. Účel

Mít spustitelnou aplikaci (lokálně, jedním klikem) s přihlášením a horní lištou podle
katalogu komponent. Vše ostatní (Zákazníci, Úkoly, …) přijde v dalších krocích — tady
vzniká jen „prázdný dům" se základy: databáze, přihlášení, vzhled, spouštění.

## 2. Obrazovky

| Obrazovka | Obsah |
|---|---|
| **/login** | Vycentrovaná karta: „Conviu CRM" + podtitulek, pole E-mail a Heslo (dle katalogu §16), tlačítko „Přihlásit se" (primární). Chybové hlášení lidsky: „Neplatný e-mail nebo heslo." |
| **/** (Nástěnka — zatím kostra) | Horní lišta (katalog §17) + datum a pozdrav „Dobré ráno/odpoledne/večer, Petře" + prázdný stav: „Nástěnka se plní s každým dalším modulem. Začneme Zákazníky." (bez akce — moduly ještě nejsou). |
| Horní lišta | Ikonová navigace: Nástěnka (aktivní) · Zákazníci · Úkoly · Zakázky · Obchod · Administrace — **neaktivní položky ukazují title „Připravujeme"** a nikam nevedou. Vyhledávání = zatím jen vzhled (funkce v Kroku 8). „Přidat +" = zatím neaktivní. Vpravo avatar + jméno + menu s jedinou položkou „Odhlásit". |

## 3. Technický základ (bez UI)

- **Stack:** TypeScript přes `tsx` (bez build kroku), **Hono** + server-side JSX,
  **SQLite** (`better-sqlite3` ≥ 12) přes **Kysely**, **htmx** (lokálně v `public/`).
- **Bez Bootstrapu.** Mockupy prokázaly, že vlastní `theme.css` stačí → `mockupy/styl.css`
  se zkopíruje do `public/theme.css` (jediný zdroj vzhledu). Drobné chování (rozbalení
  user menu) = pár řádků vlastního JS v `public/app.js`. Méně závislostí.
- **Databáze (jen základ):** tabulky `tenants`, `persons`, `sessions` (zbytek přidají moduly
  svými migracemi). Seed: tenant Conviu + kolegové s přihlášením:
  `admin@conviu.com`/`admin123` (dev), `petr.beloch@conviu.com`, `jana@conviu.com`,
  `tomas@conviu.com` (vše `conviu123`). DB soubor `data/crm.db`, vzniká a seeduje se sám.
- **Přihlášení:** scrypt (vestavěné Node crypto) + httpOnly cookie session (vzor z v1).
- **Struktura:** `src/config.ts · db/ (schema, migrate, seed) · auth/ · web/ (layout, login, dashboard) · server.ts · index.ts`.
- **Repo náležitosti:** `package.json` (s `packageManager` kvůli CI), `tsconfig.json`,
  `.env.example`, CI workflow (install + typecheck), `start-crm.bat` (CRLF) + **zástupce
  „Conviu CRM" na ploše** (spustí server a otevře prohlížeč na http://localhost:3000).

## 4. Pravidla

- Vzhled **výhradně z katalogu komponent** (`docs/KOMPONENTY.md`) — kostra nezavádí žádný nový prvek.
- Texty lidsky česky, `aria-label` u ikon, viditelný focus (je v theme.css).
- Hesla nikdy v plaintextu; `.env` a `data/` v `.gitignore`.

## 5. Mimo rozsah (přijde později)

Moduly Zákazníci/Úkoly/Zakázky/Obchod/Administrace · funkční vyhledávání a „Přidat +" ·
RBAC (zatím se po přihlášení smí vše; práva přijdou s Administrací) · htmx interakce
(knihovna se jen připraví do `public/`).

## 6. Hotovo, když…

- [ ] `pnpm install && pnpm dev` → běží na http://localhost:3000
- [ ] dvojklik na zástupce na ploše → server + prohlížeč se otevřou samy
- [ ] přihlášení admin@conviu.com / admin123 funguje; špatné heslo ukáže lidskou chybu; odhlášení funguje
- [ ] nepřihlášený je vždy přesměrován na /login
- [ ] Nástěnka ukazuje pozdrav dle denní doby + prázdný stav; lišta odpovídá katalogu
- [ ] `pnpm typecheck` zelený lokálně i v CI; commit + push na GitHub
