# Trefoil CRM (v2)

Interní CRM systém **Trefoil**. Budoucí adresa: `https://crm.trefoil.cz`.

> **Stav: v2 ve výstavbě — spec-first.** Aplikace se staví znovu, krok po kroku;
> před každým modulem vzniká krátká specifikace, která se schvaluje, teprve pak se staví.

## Směr v2

- **UI podle Capsule CRM** — vizuál, layout a základní prvky se inspirují/replikují
  (čistá vizuální hierarchie, jednoduchost). Vzniká z analýzy referenčních screenshotů.
- **Lehká platforma** (ověřená v1): TypeScript, server-rendered HTML + htmx,
  databáze v jednom souboru (SQLite přes Kysely — přenositelné na PostgreSQL),
  bez Dockeru, bez build kroku. Připravené na pozdější škálování.
- **Flexibilní datový základ** (z v1): Osoby a Firmy (Person/Client), vícenásobné kontaktní
  údaje, konfigurovatelné Seznamy, role a práva (RBAC).

## Znalostní báze

Dokumentace je **jeden provázaný celek a tahle stránka je jeho jediná mapa**. Každý dokument
má nahoře navigační lištu zpět sem i na příbuzné. Co se změní, promítni i do příslušného
dokumentu — pravidla viz [CLAUDE.md](CLAUDE.md) („Kdy aktualizovat dokumentaci").

**Než začneš — orientace a pravidla**
- [CLAUDE.md](CLAUDE.md) — jak se na projektu pracuje: role, pravidla, konvence. **Číst první.**
- [SUMMARY.md](docs/SUMMARY.md) — kontext, historie spolupráce, rozhodnutí, stav a plán („co, proč, kam dál").
- [ROADMAP.md](docs/ROADMAP.md) — kroky vývoje (spec-first), co je hotové a co dál.
- [VIZE — Úkoly · Projekty · Poznámky](docs/VIZE-ukoly-projekty-poznamky.md) — směr oblasti „práce" (průzkum trhu + rozhodnutí).
- [VIZE — Feed · Příležitosti · Log komunikace](docs/VIZE-feed-a-prilezitosti.md) — směr oblasti „dění u zákazníka" (analýza konkurence: feed, příležitosti, follow-up).
- [AUTOMATION.md](docs/AUTOMATION.md) — zápisník automatizací a vylepšení procesů (dvoustupňová uzávěrka, napojení výkazů na úkoly).

**Jak to funguje uvnitř — architektura a data**
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — technický přehled: stack, vrstvy, request lifecycle, realtime, i18n, bezpečnost.
- [docs/DATOVY-MODEL.md](docs/DATOVY-MODEL.md) — tabulky, vazby, konvence (Person/Client/Seznamy/RBAC).

**Jak to vypadá a z čeho se skládá — UI a vzory**
- [docs/UI-ZASADY.md](docs/UI-ZASADY.md) — designový manuál (replika Capsule): layout, tokeny, skiny, chování.
- [docs/KOMPONENTY.md](docs/KOMPONENTY.md) — katalog znovupoužitelných UI vzorů (markup + kdy co). **Hledej tu, než vymyslíš nový prvek.**
- [mockupy/](mockupy/) — klikací ukázky obrazovek (otevři v prohlížeči):
  [nástěnka](mockupy/nastenka.html) · [zákazníci](mockupy/zakaznici.html) · [detail zákazníka](mockupy/zakaznik-detail.html) · [komponenty](mockupy/komponenty.html).

**Jazyk a specifikace**
- [docs/SLOVNIK.md](docs/SLOVNIK.md) — jednotná terminologie (stejné slovo v UI i v kódu).
- [docs/specs/](docs/specs/) — specifikace modulů (vznikají PŘED stavbou; šablona [_SABLONA.md](docs/specs/_SABLONA.md)):
  [krok 2 — kostra](docs/specs/krok2-kostra.md) · [krok 3 — zákazníci](docs/specs/krok3-zakaznici.md) · [krok 4 — administrace](docs/specs/krok4-administrace.md) · [krok 5 — služby](docs/specs/krok5-sluzby-zakaznika.md) · [krok 6 — výkazy](docs/specs/krok6-vykazy-prace.md) · [Feed v1](docs/specs/feed-v1.md).

**Kudy číst** (nový na projektu): CLAUDE.md → SUMMARY.md → ARCHITECTURE.md → podle úkolu buď UI
([UI-ZASADY](docs/UI-ZASADY.md) + [KOMPONENTY](docs/KOMPONENTY.md)), nebo data ([DATOVY-MODEL](docs/DATOVY-MODEL.md));
pro konkrétní modul jeho spec v [docs/specs/](docs/specs/).

## Důležité

- ⚠️ Repo nepatří na Google Disk (rozbíjí `node_modules`) — klon měj v běžné lokální složce,
  např. `C:\Users\<user>\dev\trefoil-crm`.
