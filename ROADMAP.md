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
| **2 — Kostra** | DB základ, auth (login), layout dle Capsule (theme.css z mockupů), **založení Organizace průvodcem** (admin + výběr modulů), **zapínatelné moduly** (Administrace → Moduly), launcher na plochu | bez funkčních modulů; běžící prázdná appka |
| **3 — Jádro: Zákazníci** | Firmy + Osoby (+kontaktní údaje, vazby), přehled s filtrem a quick-view, detail = 3sloupcový hub, štítky | dle mockupů `zakaznici` + `zakaznik-detail` |
| **4 — Komunikace + Úkoly + Nástěnka** | Timeline aktivit (typy), úkoly s kategoriemi (barevné chipy), Nástěnka (pozdrav, naposledy zobrazené, stat dlaždice, Po termínu/Dnes) | dle mockupu `nastenka` |
| **5 — Služby & rozpočty** | Aktivní služby u zákazníka (katalog, stav, odpovědný, **orientační měsíční spend**), součet spendů za zákazníka, **měsíční rozpočet hodin** (nastaveno/zbývá; jen manažeři), stat dlaždice na detailu ožívají | jádro agenturní evidence |
| **6 — Výkazy práce** | „Záznam práce" odkudkoli (lišta, Nástěnka, detail zákazníka): zákazník + volitelně služba + popis úkonu + poznámka + čas + pracovník + ID. **Schvalování** odpovědnou osobou (auto-úkol). Odečet z rozpočtu hodin / kumulace k fakturaci, výkaz pracovníka | navazuje na 3+4+5 |
| **7 — Administrace** | Tým + pozvánky kolegů, správa Seznamů, **role/práva (RBAC)** — formalizace „manažera", nahrazení dočasného is_admin | |
| **8 — Zakázky** | Zakázky + milníky, kanban (drag-drop) + list, „update klientovi" | sdílená kanban komponenta |
| **9 — Obchod** | Příležitosti, pipeline kanban + hodnoty/součty, list | reuse kanbanu |
| **10 — Vyhledávání** | Horní hledání + Ctrl+K (skok na firmu/osobu/zakázku/deal) | |
| **11 — Doleštění** | UX/responzivita/aria audit proti UI zásadám, drobnosti | |
| Později | manažerské reporty (hodiny/spendy/tým), e-mail integrace, nasazení na crm.conviu.com | mimo MVP |

## Technické lekce z v1 (aplikovat průběžně)

better-sqlite3 ≥ 12 (prebuildy pro Node 24) · povolit build skripty v pnpm (`approve-builds`/`allowBuilds`)
· `packageManager` v package.json (CI) · `.bat` s CRLF (.gitattributes) · kód nikdy na Google Disk
· UTF-8 (pozor na diakritiku v curl testech) · FK na všech vazbách · idempotentní seed.

## Výchozí přihlášení (dev — od Kroku 2)

`admin@conviu.com` / `admin123` — změnit před ostrým provozem.
