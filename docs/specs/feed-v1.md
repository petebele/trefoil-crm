# Specifikace modulu: Feed „Aktivity" v1 (přehled dění)

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [vize feedu](../VIZE-feed-a-prilezitosti.md) · [ostatní specs](./)

> **Stav: NASAZENO (2026-06-17).** Vychází z [VIZE — Feed · Příležitosti](../VIZE-feed-a-prilezitosti.md).
> Po diskusi zúženo na **read-only přehled** (Petrovo rozhodnutí): feed je **lupa nad událostmi**, ne
> úložiště ani vstup. Poznámky zůstávají **samostatně** (knowledge base). Ruční záznam komunikace
> (hovor/schůzka/e-mail) je **budoucí modul „Komunikace"**, ne součást v1.

## 1. Účel
Na detailu zákazníka (firma i osoba) dát uživateli **rozhled, co se naposledy dělo napříč typy** —
poznámky, úkoly, výkazy, kontakty, systémové změny — **na jednom místě, chronologicky**. Slouží
k rychlé orientaci „co je u klienta nového". Read-only: nic se odtud nezakládá.

## 2. Jak to funguje (klíčové zjednodušení)
Všechny moduly už dnes při zápisu volají `logEvent()` → tabulka **`events`** (kdo / kdy / u jaké entity
/ lidský text). Feed proto **nepotřebuje vlastní úložiště ani nové dotazy** — je to jen **lepší
prezentace `events`**: každý záznam se podle textu **zařadí do typu** (poznámka / úkol / výkaz /
kontakt / systém) a dostane **ikonu**. Žádná změna datového schématu.

## 3. Obrazovka
Záložka **„Aktivity"** na detailu firmy i osoby (přejmenovaná dřívější „Historie"; **Poznámky** mají
i nadále vlastní záložku). Wireframe:

```
┌─ Aktivity ──────────────────────────────────────────────┐
│  Filtr:  (Vše)  Poznámky  Úkoly  Výkazy  Ostatní          │
│                                                            │
│  📝  Petr Běloch · 17. 6. 9:14                            │
│       Přidána poznámka: Klient potvrdil rozpočet Q3        │
│  ✓   Jana N. · 16. 6. 16:20                               │
│       Úkol přidán: Připravit návrh kampaně                │
│  🕒  Petr B. · 3. 6.                                      │
│       Výkaz #a1b2 schválen (Správa PPC, 1 h 30 m)         │
│  👤  Petr B. · 2. 6.      (utlumeně)                       │
│       Přidán kontakt: e-mail jan@acme.cz                  │
│  •   Petr B. · 1. 6.      (utlumeně)                       │
│       Firma založena                                       │
└────────────────────────────────────────────────────────┘
```

- **Řádek** = kruhová **ikona typu** (`.feed-ico`) + autor + čas + text události.
- **Typy s barvou:** poznámka / úkol / výkaz (akcent). **Utlumené:** kontakt / systém.
- **Filtr po typu** (chip taby) přes `?atyp=note|task|work|other` — překreslí seznam.

## 4. Data a pravidla
- Zdroj = **`events`** (beze změny schématu). `listEvents(tenant, kind, id)` už existuje.
- **Klasifikace** (`activityKind` v `components.tsx`) podle prefixu textu: „Přidána/Upravena/Smazána
  poznámka" → note; „Úkol …" → task; „Výkaz …" → work; obsahuje „kontakt" → contact; jinak → system.
- **Read-only:** žádné zakládání/úpravy odtud. (Data se mění ve svých modulech, feed je jen zobrazí.)
- **Realtime:** záložka je živá zóna (`live-update from:body`) — nové dění se objeví samo.

## 5. Co NENÍ ve v1 (záměrně) → budoucí „Komunikace"
- Ruční zápis hovoru / schůzky / e-mailu (přes editor) + skupina „Nadcházející" + follow-up úkol.
- Tyto věci přijdou jako samostatný **modul Komunikace**; feed je pak automaticky pohltí (jsou to taky
  události). Vizuálně je to **naznačeno v mockupu §16** jako „budoucí".

## 6. Prázdné stavy
- Feed prázdný: „**Zatím se tu nic nedělo.**"
- Filtr bez výsledků: „**V tomto filtru zatím nic není.**"

## 7. Hotovo (checklist) — splněno
- [x] Záložka **Aktivity** na firmě i osobě (přejmenovaná „Historie"); Poznámky zůstávají zvlášť.
- [x] Události s **ikonami typu** (poznámka/úkol/výkaz/kontakt/systém); kontakt/systém utlumené.
- [x] **Filtr po typu** (Vše/Poznámky/Úkoly/Výkazy/Ostatní) přes `?atyp=`.
- [x] Read-only, realtime (živá zóna), bez změny schématu.
- [x] `.feed-ico` v `public/theme.css` i `mockupy/styl.css`; `ASSET_V` zvednut (41).
- [x] Katalog [KOMPONENTY §25](../KOMPONENTY.md) + mockup `komponenty.html` §16.
- [x] `pnpm typecheck` zelený; server po reloadu odpovídá.

## 8. Budoucí kroky (mimo v1)
Modul **Komunikace** (ruční hovor/schůzka/e-mail + follow-up), feed na **službě/projektu**, **osobní
dashboard feed** (moje úkoly + dění dle termínu). Viz [VIZE — Feed §7, §8](../VIZE-feed-a-prilezitosti.md).
