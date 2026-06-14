# Roadmapa — Trefoil CRM v2

🧭 **Znalostní báze:** [mapa](../README.md) · [sumář](SUMMARY.md) · [architektura](ARCHITECTURE.md) · [pravidla](../CLAUDE.md) · [UI](UI-ZASADY.md) · [komponenty](KOMPONENTY.md) · [slovník](SLOVNIK.md) · [datový model](DATOVY-MODEL.md) · [vize práce](VIZE-ukoly-projekty-poznamky.md) · [specs](specs/)

Proces: **spec → schválení → stavba → ověření → commit**, modul po modulu.
Vizuální reference: `UI-ZASADY.md` + `/mockupy`. Datový základ: `DATOVY-MODEL.md`.
Aktuální stav realizace (skutečné pořadí) je v [SUMMARY.md](SUMMARY.md) — postaveno:
Zákazníci, Administrace (Tým), Služby, Výkazy práce, **Úkoly + Nástěnka**.

## Hotovo

- [x] **Krok 0** — prostředí (PC Jetel) + repo `trefoil-crm` + push
- [x] **Krok 1** — Capsule UI studie (19 screenshotů) → UI zásady, slovník, datový model,
      šablona specifikací, roadmapa + **mockupy** (nástěnka, zákazníci, detail zákazníka)

## Kroky (každý začíná specifikací ke schválení)

| Krok | Obsah | Pozn. |
|---|---|---|
| **2 — Kostra** | DB základ, auth (login), layout dle Capsule (theme.css z mockupů), **založení Organizace průvodcem** (admin + výběr modulů), **zapínatelné moduly** (Administrace → Moduly), launcher na plochu | bez funkčních modulů; běžící prázdná appka |
| **3 — Jádro: Zákazníci** | Firmy + Osoby (+kontaktní údaje, vazby), přehled s filtrem a quick-view, detail = 3sloupcový hub, štítky | dle mockupů `zakaznici` + `zakaznik-detail` |
| **4 — Komunikace + Úkoly + Nástěnka** | Timeline aktivit (typy); **poznámky/komunikace** v příjemném editoru (inspirace Bear — čistota a rychlost psaní, ale v našich komponentách/UI); úkoly s kategoriemi (barevné chipy); Nástěnka (pozdrav, naposledy zobrazené, stat dlaždice, Po termínu/Dnes). **Inbox „Vyžaduje moji pozornost"** (čeká na mé schválení · přiřazeno mně · po termínu · zmínky @mě) = srdce Nástěnky. **@mention kdekoliv v textu** → osoba / firma / zakázka: propojení záznamů + zdroj upozornění do Inboxu | dle mockupu `nastenka`; inspirace Linear (Inbox) + Bear (poznámky/odkazy); @mention propojit s realtime (SSE) |
| **5 — Služby & rozpočty** | Aktivní služby u zákazníka (katalog, stav, odpovědný, **orientační měsíční spend**), součet spendů za zákazníka, **měsíční rozpočet hodin** (nastaveno/zbývá; jen manažeři), stat dlaždice na detailu ožívají | jádro agenturní evidence |
| **6 — Výkazy práce** | „Záznam práce" odkudkoli (lišta, Nástěnka, detail zákazníka): zákazník + volitelně služba + popis úkonu + poznámka + čas + pracovník + ID. **Schvalování** odpovědnou osobou (auto-úkol). Odečet z rozpočtu hodin / kumulace k fakturaci, výkaz pracovníka | navazuje na 3+4+5 |
| **7 — Administrace** | Tým + pozvánky kolegů, správa Seznamů, **role/práva (RBAC)** — formalizace „manažera", nahrazení dočasného is_admin | |
| **8 — Zakázky / Projekty** | Projekt = cíl + úkoly + **milníky** + **návaznosti** („blokuje/blokováno") + **šablony projektů**; kanban (drag-drop) + list, „update klientovi" | sdílená kanban komponenta; viz [vize práce](VIZE-ukoly-projekty-poznamky.md) §5 |
| **9 — Obchod** | Příležitosti, pipeline kanban + hodnoty/součty, list | reuse kanbanu |
| **10 — Příkazová paleta (Ctrl+K) + klávesové zkratky** | Ctrl+K jako **„udělej cokoliv"**: nejen skok na firmu/osobu/zakázku/deal, ale i akce (založit, změnit stav, přiřadit, vykázat práci…). **Klávesové zkratky** napříč aplikací (rychlé založení, procházení j/k, změna stavů) | inspirace Linear |
| **11 — Doleštění** | UX/responzivita/aria audit proti UI zásadám, drobnosti | |
| Později | manažerské reporty (hodiny/spendy/tým), e-mail integrace, nasazení na crm.trefoil.cz | mimo MVP |

## Směr práce: Úkoly · Projekty · Poznámky (vize)

> Detailní směr (průzkum trhu Asana/ClickUp/monday/Linear/Trello + agenturní Accelo/Productive
> a Petrova konkrétní rozhodnutí) je v **[VIZE-ukoly-projekty-poznamky.md](VIZE-ukoly-projekty-poznamky.md)**.
> Níže jen kotvy do roadmapy; každý kus pořád dostane vlastní specifikaci ke schválení.

- **Úkoly v2 — pohledy + hloubka objektu:** druhý pohled **Kanban** (sdílená komponenta) vedle
  agendy; **stavy/workflow s akceptací** (čeká na přijetí → akceptováno → … → k ověření → hotovo),
  priorita, **podúkoly/checklist** (s vyčleněním do samostatného úkolu), štítky, začátek+deadline,
  **opakování** (i „od dokončení"), odložení. Úkoly jde řešit **nezávisle na klientovi** i **provázaně**
  (klient / projekt / osoba). Pohledy do budoucna: **Kalendář** (vlastní → později integrace) a
  **Časová osa / Gantt** s návaznostmi.
- **Poznámky — záložka „Poznámky" u klienta:** více poznámek od různých uživatelů, **typy/charakter**
  (číselník), editor (inspirace Bear), přílohy/komentáře/@zmínky; **vazby na zákazníka / projekt /
  osobu** (i víc naráz); **převod poznámky na úkol**. Sdílí obsahový základ s komentáři/přílohami.
- **Projekty/Zakázky** (Krok 8): cíl + milníky + návaznosti + **šablony**; modelování milníků jako
  „bran"/handoffů s notifikací — viz vize §5/§5b.
- **Automatizace (nadstavba):** událostní jádro **spouštěč → podmínka → akce** (zobecnění dnešního
  auto‑úkolu „schval výkaz"); architektura to musí umožnit bez přepisu modulů.
- **Notifikace:** „máš N úkolů k přijetí, komentáře, narozeniny klienta…"; kooperuje s automatizacemi;
  napojení na **Inbox „Vyžaduje moji pozornost"** (Krok 4) + realtime.
- **Kontextové prolínání / lokální dashboardy:** úkol/poznámka/komentář označený u entity se objeví v
  jejím feedu (i když vznikl jinde) — jeden obsahový/aktivitní základ napříč moduly.

## Technické lekce z v1 (aplikovat průběžně)

better-sqlite3 ≥ 12 (prebuildy pro Node 24) · povolit build skripty v pnpm (`approve-builds`/`allowBuilds`)
· `packageManager` v package.json (CI) · `.bat` s CRLF (.gitattributes) · kód nikdy na Google Disk
· UTF-8 (pozor na diakritiku v curl testech) · FK na všech vazbách · idempotentní seed.

## Výchozí přihlášení (dev — od Kroku 2)

`admin@trefoil.cz` / `admin123` — změnit před ostrým provozem.
