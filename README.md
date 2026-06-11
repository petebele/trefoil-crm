# Conviu CRM (v2)

Interní CRM pro marketingovou agenturu **Conviu**. Budoucí adresa: `https://crm.conviu.com`.

> **Stav: v2 ve výstavbě — spec-first.** Aplikace se staví znovu, krok po kroku;
> před každým modulem vzniká krátká specifikace, která se schvaluje, teprve pak se staví.
>
> Verze 1 (funkční prototyp + dokumenty) je archivovaná v repu
> [`conviu-crm/conviu-crm`](https://github.com/conviu-crm/conviu-crm).

## Směr v2

- **UI podle Capsule CRM** — vizuál, layout a základní prvky se inspirují/replikují
  (čistá vizuální hierarchie, jednoduchost). Vzniká z analýzy referenčních screenshotů.
- **Lehká platforma** (ověřená v1): TypeScript, server-rendered HTML + htmx,
  databáze v jednom souboru (SQLite přes Kysely — přenositelné na PostgreSQL),
  bez Dockeru, bez build kroku. Připravené na pozdější škálování.
- **Flexibilní datový základ** (z v1): Osoby a Firmy (Person/Client), vícenásobné kontaktní
  údaje, konfigurovatelné Seznamy, role a práva (RBAC).

## Postup a dokumentace

- [ROADMAP.md](ROADMAP.md) — kroky vývoje (spec-first)
- [docs/UI-ZASADY.md](docs/UI-ZASADY.md) — designový manuál (replika Capsule)
- [docs/SLOVNIK.md](docs/SLOVNIK.md) — jednotná terminologie
- [docs/DATOVY-MODEL.md](docs/DATOVY-MODEL.md) — datový základ (Person/Client/Seznamy/RBAC)
- [docs/specs/](docs/specs/) — specifikace modulů (vznikají před stavbou)
- [mockupy/](mockupy/) — **klikací ukázky obrazovek** (otevři `nastenka.html` v prohlížeči):
  nástěnka · přehled zákazníků · detail zákazníka

## Důležité

- ⚠️ Repo nepatří na Google Disk (rozbíjí `node_modules`) — klon měj v běžné lokální složce,
  např. `C:\Users\<user>\dev\conviu-crm-2`.
