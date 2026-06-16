# Specifikace: Propojení Výkazů a Úkolů

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [automatizace](../AUTOMATION.md) · [vize práce](../VIZE-ukoly-projekty-poznamky.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Malý krok, ne nový modul: spojuje dva hotové moduly (Úkoly · Výkazy).
> Vychází z domluvy v [AUTOMATION.md](../AUTOMATION.md) („Úkoly ↔ výkazy ↔ čas ↔ fakturace").

## 1. Účel

Když pracuju na úkolu, chci z něj **jedním klikem vykázat odvedenou práci** — bez
zdlouhavého hledání zákazníka a služby. Výkaz si zapamatuje, **ke kterému úkolu** patří;
u úkolu pak vidím, **kolik času už na něm bylo vykázáno**.

Pravidla, na kterých jsme se shodli:

- Výkaz **může**, ale **nemusí** odkazovat na úkol; **vždy** musí mít zákazníka.
- Většina úkolů žádný čas ani výkaz mít nebude. Čas i výkaz jde zadat **i bez úkolu** (jako dnes).
- **Časovač zatím neřešíme** — čas se zadává ručně.

## 2. Obrazovky

Žádná nová obrazovka. Zásahy do tří míst:

1. **Úkol → akce „Vykázat práci"** v jeho ⋯ menu:
   - v **Agendě** (řádek úkolu `TaskItemRow`),
   - na **Kanbanu** (karta `KanbanCard`),
   - v **modálu úpravy úkolu** jako tlačítko (sekundární, vedle „Uložit").
   Akce se zobrazí, jen když je zapnutý modul **Výkazy**.
2. **Modál „Vykázat práci"** (`WorkRecordModal`) — rozšířený: když přijde z úkolu, ukáže
   nahoře řádek **„Úkol: <název>"**, předvyplní zákazníka (má-li úkol zákazníka) a — pokud
   má zákazník jen jednu běžící službu — i tu službu. Zbytek beze změny.
3. **Zpětná vazba u úkolu** — v modálu úpravy úkolu přibude blok **„Vykázaná práce"**:
   seznam navázaných výkazů (datum · popis · čas, dohromady součet). Prázdný stav: viz §6.

## 3. Pole a data

- **Nový sloupec `work_records.task_id`** (text, nullable, FK `tasks.id`). Idempotentně
  přes `ALTER TABLE … ADD COLUMN` (vzor v `src/db/migrate.ts`), doplnit i `WorkRecordsTable`
  v `src/db/schema.ts`.
- **`WorkRecordInput`** + `createWorkRecord` → přidat `taskId: string | null`.
  `WorkRecord` (čtecí typ) → přidat `task_title` (LEFT JOIN na `tasks`).
- **Úprava výkazu** vazbu na úkol needituje (drží se z založení) — `task_id` se při editaci
  zachová beze změny.
- Vykázaný čas u úkolu se **nepočítá do seznamů ani boardu** (kvůli výkonu) — sečte se
  až při otevření modálu úkolu, cíleným dotazem (`listForTask` / součet minut).

> Pozn.: `tasks.source_kind/source_id` se **nemění** — to je opačný směr (auto‑úkol
> „schválit výkaz" vzniklý *z* výkazu). Nový `task_id` je směr „výkaz patří k úkolu".

## 4. Pravidla a stavy

- **Zákazník je povinný.** Má-li úkol zákazníka → předvyplní se a zamkne (jako dnes při
  vykázání z detailu firmy). Nemá-li úkol zákazníka → modál nabídne výběr zákazníka; po
  jeho zvolení se výkaz uloží navázaný na úkol i zákazníka.
- **Služba je povinná** (výkaz ji vyžaduje). Úkol službu nenese, takže:
  - zákazník má 1 běžící službu → předvyplní se,
  - víc služeb → uživatel vybere,
  - žádná běžící služba → stávající hláška „Zákazník nemá žádnou běžící službu…".
- **Kdo smí vykázat:** kdokoli (výkaz se založí na aktuálního uživatele jako pracovníka) —
  beze změny oproti dnešku. Auto‑schválení / auto‑úkol „schválit výkaz" zůstává, jak je.
- **Smazání výkazu** úkol nemaže ani nemění (jen zmizí z bloku „Vykázaná práce").
- **Smazání úkolu**, na který je výkaz navázán: výkaz zůstává, jeho `task_id` se vynuluje
  (FK `ON DELETE SET NULL`, případně ošetřit při mazání úkolu).

## 5. Akce (kontextové)

- **„Vykázat práci"** — v ⋯ menu úkolu (agenda i kanban) a tlačítkem v modálu úpravy úkolu.
  Otevře `WorkRecordModal` (velký modál) s předvyplněným úkolem/zákazníkem.
- Z modálu úpravy úkolu vede i seznam **„Vykázaná práce"** — každý řádek umožní výkaz
  **upravit** (otevře modál výkazu), když na to má uživatel právo.

## 6. Prázdné stavy

- Blok „Vykázaná práce" u úkolu bez výkazů: **„Zatím nevykázána žádná práce."** + akce
  **„Vykázat práci"** (otevře modál).
- Modál výkazu z úkolu, jehož zákazník nemá službu: stávající hláška
  **„Zákazník nemá žádnou běžící službu — nejdřív mu ji přidělte (detail → Služby)."**

## 7. Hotovo, když… (checklist)

- [ ] U úkolu (agenda, kanban, modál úpravy) je akce **„Vykázat práci"** — jen při zapnutém modulu Výkazy.
- [ ] Akce otevře modál s předvyplněným **úkolem** a **zákazníkem** (a službou, je-li jediná).
- [ ] Úkol bez zákazníka → modál nechá zákazníka vybrat; výkaz se uloží navázaný na úkol i zákazníka.
- [ ] Založený výkaz nese `task_id`; v modálu úkolu je vidět v bloku **„Vykázaná práce"** (se součtem).
- [ ] Ve výkazu (řádek `WorkRecordRow`) je vidět, **ke kterému úkolu** patří.
- [ ] Smazání výkazu / úkolu nerozbije druhou stranu (žádné osiřelé odkazy).
- [ ] `pnpm typecheck` zelený, proklik v prohlížeči OK.
- [ ] Odpovídá UI zásadám (⋯ menu, velký modál na úpravu, prázdné stavy, čeština, aria).
