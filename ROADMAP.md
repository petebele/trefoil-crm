# Roadmapa — Conviu CRM v2

Proces: **spec → schválení → stavba → ověření → commit**, modul po modulu.
Vizuální reference: `docs/UI-ZASADY.md` + `/mockupy`. Datový základ: `docs/DATOVY-MODEL.md`.

## Hotovo

- [x] **Krok 0** — prostředí (PC Jetel) + repo `conviu-crm-2` + push
- [x] **Krok 1** — Capsule UI studie (19 screenshotů) → UI zásady, slovník, datový model,
      šablona specifikací, roadmapa + **mockupy** (nástěnka, zákazníci, detail zákazníka)

## Kroky (každý začíná specifikací ke schválení)

| Krok | Obsah | Pozn. |
|---|---|---|
| **2 — Kostra** | package.json, tsconfig, DB+migrace+seed základ, auth (login), layout dle Capsule (horní ikonová lišta, theme.css z mockupů), launcher na plochu | bez modulů; běžící prázdná appka |
| **3 — Jádro: Zákazníci** | Firmy + Osoby (+kontaktní údaje, vazby), přehled s filtrem a quick-view, detail = 3sloupcový hub, štítky | dle mockupů `zakaznici` + `zakaznik-detail` |
| **4 — Komunikace + Úkoly + Nástěnka** | Timeline aktivit (typy), úkoly s kategoriemi (barevné chipy), Nástěnka (pozdrav, naposledy zobrazené, stat dlaždice, Po termínu/Dnes) | dle mockupu `nastenka` |
| **5 — Služby + Seznamy + Administrace** | Katalog služeb, aktivní služby u klienta, správa Seznamů, tým + role/práva (RBAC) | |
| **6 — Zakázky** | Zakázky + milníky, kanban (drag-drop) + list, „update klientovi" | sdílená kanban komponenta |
| **7 — Obchod** | Příležitosti, pipeline kanban + hodnoty/součty, list | reuse kanbanu |
| **8 — Vyhledávání** | Horní hledání + Ctrl+K (skok na firmu/osobu/zakázku/deal) | |
| **9 — Doleštění** | UX/responzivita/aria audit proti UI zásadám, drobnosti | |
| Později | reporting (Přehledy), e-mail integrace, nasazení na crm.conviu.com | mimo MVP |

## Technické lekce z v1 (aplikovat průběžně)

better-sqlite3 ≥ 12 (prebuildy pro Node 24) · povolit build skripty v pnpm (`approve-builds`/`allowBuilds`)
· `packageManager` v package.json (CI) · `.bat` s CRLF (.gitattributes) · kód nikdy na Google Disk
· UTF-8 (pozor na diakritiku v curl testech) · FK na všech vazbách · idempotentní seed.

## Výchozí přihlášení (dev — od Kroku 2)

`admin@conviu.com` / `admin123` — změnit před ostrým provozem.
