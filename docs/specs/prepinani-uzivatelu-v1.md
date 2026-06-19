# Specifikace: Přepínání uživatelů (admin „Zobrazit jako…") — v1

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [sumář](../SUMMARY.md) · [architektura](../ARCHITECTURE.md) · [komponenty](../KOMPONENTY.md) · [datový model](../DATOVY-MODEL.md) · [ostatní specs](./)

> ✅ **POSTAVENO (2026-06-19, dávka N).** Schváleno Petrem („udělej A").

## 1. Účel
Administrátor si potřebuje **prohlédnout (a otestovat) aplikaci očima konkrétního uživatele** — jeho Nástěnku, úkoly, výkazy ke schválení, **notifikace**, oprávnění. Např. „uvidí Ivana svůj zvonek správně?", „má Adéla na boardu, co má?". Bez znalosti cizího hesla.

## 2. Jak to funguje (chování)
- **Plná impersonace** (ne jen náhled): admin se pro celé zpracování požadavku stává cílovým uživatelem — vidí i **jedná** jako on (akce se evidují pod cílovým uživatelem). Proto je **trvale viditelný banner** a snadný návrat.
- **Oprávnění se přebírají od cíle:** prohlížíš‑li jako neadmin, nevidíš Administraci a nesmíš víc než on. Výjimka: banner „Zpět na sebe" je vždy.
- **Smí jen admin.** Autorizaci hlídá server podle **skutečné** session (cookie `sid`), ne podle přepnutého stavu — podvrhnutá cookie `imp` se bez admin session ignoruje.
- **Krátká životnost:** cookie `imp` (httpOnly) vyprší po pár hodinách; odhlášení i „Zpět na sebe" ji ruší.

## 3. Obrazovky / UI
- **Spuštění:** uživatelské menu (vpravo nahoře, jen adminům) → **„Zobrazit jako…"** → **modál** se seznamem aktivních členů týmu (avatar, jméno, pozice, role); u každého tlačítko **„Zobrazit jako"**.
- **Banner:** přes celou šířku pod horním panelem, výrazný (akcentový): **„Prohlížíš jako {Jméno}"** + tlačítko **„Zpět na sebe"**. Viditelný na všech stránkách, dokud impersonace trvá.
- **Návrat:** „Zpět na sebe" (banner) → zpět do vlastní identity.

## 4. Data a technika (bez nové tabulky)
- Žádná migrace. Stav nese **cookie `imp`** = `person_id` cíle (httpOnly, krátká platnost).
- **Middleware** (`server.ts`): po načtení skutečné osoby ze session — je‑li `imp` nastaveno **a skutečná osoba je admin** a cíl je aktivní člen téhož tenanta (≠ já) → `c.set('person', cíl)` (efektivní identita) a `c.set('impersonator', admin)`. Jazyk se odvodí od **efektivní** osoby (vidíš jeho UI).
- **Banner** čte `getImpersonator()` přes request‑scoped `AsyncLocalStorage` (stejný vzor jako jazyk) — `Layout` ho vykreslí bez protahování přes všechna volání.
- Pomocné: `src/auth/impersonation.ts` (cookie set/clear, ALS, lookup cíle). Routy `src/web/impersonace.tsx`.

## 5. Akce (kontextové)
- `GET /impersonace` → modál se seznamem (admin).
- `POST /impersonace/start` (`person_id`) → ověří admin + cíl → nastaví cookii → redirect `/`.
- `POST /impersonace/konec` → smaže cookii → redirect `/`.

## 6. Mimo rozsah v1 (fáze 2+)
- **Audit:** akce při impersonaci se zatím evidují pod cílem; budoucí stopa „provedeno adminem X jako Y" (až bude RBAC/audit log).
- Přepnutí přímo z banneru na *jiného* uživatele (teď: nejdřív „Zpět na sebe", pak znovu vybrat).
- Read‑only režim náhledu.

## 7. Hotovo, když… (checklist)
- [ ] Admin spustí „Zobrazit jako…" → vidí appku jako vybraný uživatel (Nástěnka, úkoly, **zvonek/notifikace**).
- [ ] Banner je vidět všude; „Zpět na sebe" vrátí identitu.
- [ ] Neadmin ani podvrhnutá cookie impersonaci nespustí (server hlídá skutečnou session).
- [ ] Odhlášení ukončí i impersonaci.
- [ ] i18n EN; `pnpm typecheck` zelený; ověřeno v prohlížeči.
