# Specifikace: Osobní Nástěnka — Inbox „Vyžaduje moji pozornost" v1

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [sumář](../SUMMARY.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [datový model](../DATOVY-MODEL.md) · [slovník](../SLOVNIK.md) · [feed](feed-v1.md) · [úkoly+nástěnka](krok7-ukoly-nastenka.md) · [ostatní specs](./)

> Krátký dokument ke **schválení PŘED stavbou**. Naplňuje **roadmapu Krok 4** („Inbox „Vyžaduje moji
> pozornost" = srdce Nástěnky") a bod „další na řadě" v SUMMARY. **Bez změny databáze** — jen lepší
> složení už existujících dat (čekající výkazy + úkoly + události).

## 1. Účel
Globální Nástěnka (`/`) = **osobní velín**. Úplně nahoře **Inbox „Vyžaduje moji pozornost"** = jedno
místo s tím, co čeká na **mou akci** (schválit · po termínu). Pod tím moje úkoly (dnes/týden) a poslední
dění. Cíl: ráno otevřu appku a hned vidím, co musím udělat — nemusím to lovit po kartách klientů.

## 2. Obrazovka (`/`)
```
Dobré ráno, Petře                                   <datum>
┌─ Vyžaduje moji pozornost ───────────────────────────────┐
│  Ke schválení (3)                                        │
│   3. 6.  Jana N.  Optimalizace kampaní  1 h · Acme  [Schválit] [⋯]
│   …                                                      │
│  Po termínu (2)                                          │
│   ⏰ Zavolat klientovi · Acme · včera                     │
│   …                                                      │
└──────────────────────────────────────────────────────────┘
┌─ Moje úkoly ─────────────────────────────[Přidat úkol]──┐
│  Dnes / Tento týden (bez schvalovaček — ty jsou nahoře)  │
└──────────────────────────────────────────────────────────┘
┌─ Poslední dění ─────────────────────────────────────────┐
│  (vzhled feedu Aktivit — ikony typů)                     │
└──────────────────────────────────────────────────────────┘
```

## 3. Pole a data (vše pro přihlášeného uživatele)
- **Ke schválení** = `listPendingForApprover(t, person.id, isAdmin)` → **čekající výkazy**, kde jsem
  odpovědná osoba zákazníka (admin vidí vše). Render přes **`WorkRecordRow`** (`showClient`) → inline
  **Schválit** (`POST /vykazy/:id/schvalit`, back `/`). **Bez nové domény** — funkce i komponenta už
  existují.
- **Po termínu** = moje otevřené úkoly s `due_at` v minulosti (z `openTasksForPerson`, bucket `overdue`),
  **mimo** auto‑schvalovací úkoly (`source_kind = 'work_record'`) — ty zastupuje řádek výkazu výše.
- **Moje úkoly** = `openTasksForPerson` **bez** schvalovacích úkolů (`source_kind = 'work_record'`),
  buckety **dnes + tento týden** (`TaskGroups`).
- **Poslední dění** = `listRecentEvents` → **sjednotit na vzhled feedu Aktivit** (`ActivityList`) +
  odkaz „Zobrazit vše".
- *(Budoucí, ne ve v1)* **@zmínky na mě** — až bude @mention (roadmapa Krok 4).

## 4. Pravidla a stavy
- **Žádné duplicity:** schválení = řádek výkazu v „Ke schválení"; auto‑úkol „schválit výkaz" se
  z úkolových sekcí **vyfiltruje** (pozná se podle `source_kind = 'work_record'`).
- **Práva:** schvaluje odpovědná osoba zákazníka (admin vše) — řeší `listPendingForApprover` +
  `WorkRecordRow` (`canApproveFor`).
- **Realtime:** střední zóna Nástěnky je živá (`live-update from:body`) — po schválení se Inbox
  překreslí, výkaz zmizí a auto‑úkol se zavře (`closeSourceTasks`).
- **Moduly:** bez `vykazy` se „Ke schválení" neukáže; bez `ukoly` se úkolové sekce neukážou.

## 5. Akce (kontextové)
- **Schválit** u řádku výkazu (inline, jako v záložce Výkazy).
- Klik na výkaz → úprava výkazu (modál) jako jinde.
- Úkol po termínu → otevřít / odškrtnout (chování `TaskGroups`).
- **Přidat úkol** (zůstává v hlavičce „Moje úkoly").

## 6. Prázdné stavy
- Inbox bez položek → „**Nic nečeká — máš čisto.** 🎉".
- Po sekcích: „Žádné výkazy ke schválení." / „Nic po termínu.".

## 7. Hotovo, když… (checklist)
- [ ] `/` má nahoře **Inbox „Vyžaduje moji pozornost"** s „Ke schválení" (výkazy + inline Schválit)
      a „Po termínu" (úkoly).
- [ ] **„Moje úkoly"** = dnes/týden, **bez** schvalovaček (žádné duplicity proti Inboxu).
- [ ] **„Poslední dění"** = vzhled feedu Aktivit (`ActivityList`).
- [ ] **Realtime** překreslení po schválení; **prázdné stavy**; čeština; `aria`; mobil.
- [ ] `pnpm typecheck` zelený; ověřeno v prohlížeči; dokumentace (KOMPONENTY/SUMMARY) doplněna.

## 8. Otevřené otázky
1. **Po termínu** úkoly: jen v Inboxu (návrh — ať se neopakují), nebo i v „Moje úkoly"?
2. **„Poslední dění"**: sjednotit na `ActivityList` hned v této dávce (návrh — je to malé), nebo zvlášť?
3. Pořadí „Ke schválení": **nejdéle čekající nahoře** (default `listPendingForApprover`) — OK?
