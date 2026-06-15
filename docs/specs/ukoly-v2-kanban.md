# Specifikace: Úkoly v2 — Kanban + měsíční loop

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [vize práce](../VIZE-ukoly-projekty-poznamky.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Druhý pohled na úkoly = **Kanban** (sloupce = **konfigurovatelné stavy, per uživatel**) vedle
> dnešní **Agendy** — tatáž data, jiná struktura. Přidává **měsíční čočku** a **„Uzavřít měsíc"**.
> Realizuje vizi §2 (pohledy) a §4 (stavy). Navazuje na modul Úkoly (`krok7-ukoly-nastenka.md`).

## 1. Účel

Sledovat práci jako **tok karet po sloupcích** a podpořit **měsíční rytmus správy klientů**: každý
vede svůj **osobní měsíční board** (vlastní pojmenované sloupce), posouvá karty mezi stavy a měsíc
na konci **uzavře** (nehotové se přetáhnou dál, hotové zůstanou v historii). Osobní trvalý board =
„moje úkoly bez měsíce".

## 2. Obrazovky

1. **`/ukoly` — přepínač „Agenda | Kanban"** (pod H1). Agenda = dnešní seznam.
2. **Kanban (osobní board):**
   - **Lišta:** přepínač **měsíce** (◀ červen 2026 ▶) + **„Bez měsíce"**; **čí board** (Moje;
     **manažer/admin** navíc otevře *board kolegy*); **menu kanbanu (⋯ Nastavení)**; **„Přidat úkol"**.
   - **Sloupce = stavy** (z `task_statuses` daného uživatele). Hlavička sloupce: **název · počet ·
     ＋** (úkol rovnou do tohoto stavu). Sloupce jde **přetahovat** (pořadí). **Karty se přetahují**
     mezi sloupci i uvnitř (pořadí).
   - **Sloupec „Hotovo"** (stav s `is_done`) má **dole odkaz „Archivované úkoly (N)"** — rozbalí
     archivované s možností **obnovit**.
   - **Karta:** **zaškrtávátko „vyřízeno"** · název · chip kategorie · (zákazník) · termín (po termínu
     červeně) · avatar. Klik = úprava (modál). ⋯ = Smazat · Archivovat.
3. **Menu kanbanu (⋯ Nastavení):** **„Uzavřít měsíc"** · **„Spravovat sloupce"** (název, barva,
   pořadí, příznak **„stav vyřízeného úkolu" `is_done`**; přidat/odebrat) · přepínač **„Při uzavření
   měsíce archivovat hotové"** (default ON).
4. **Úprava úkolu** = modál z Kroku 7 + pole **Stav**.

## 3. Pole a data

Rozšíření **`tasks`** (idempotentní migrace):
- **`status`** (text, FK `list_items` číselníku `task_statuses`) — sloupec/stav (výchozí „Nový").
- **`done`** (zůstává, 0/1) — „vyřízeno"; **drží se v synchronu** se stavem `is_done` (viz §4) —
  jeden fakt, dvě ovládací páčky (checkbox a sloupec „Hotovo").
- **`archived`** (0/1) — skryto z aktivního boardu, **zůstává v historii** (lze obnovit). *(Příznak, ne sloupec.)*
- **`board_month`** (text `YYYY-MM`, **nullable**) — měsíční board; `null` = trvalý/osobní.
- **`sort_order`** (real) — pořadí karty ve sloupci.

Číselník **`task_statuses`** — **per uživatel** (`owner_id` → persons), konfigurovatelný: `label`,
`color`, `sort_order`, v `meta` příznak **`is_done`**. Při prvním použití se uživateli nasadí
**výchozí sada**: **Nový** · **Vyřizuji** · **Kontrola** · **Hotovo** (`is_done`). Stav úkolu patří
do sady jeho **řešitele**; přeřazení na jiného kolegu zmapuje stav na řešitelovo „Nový".
*(Sdílené „šablony stavů" a vynucení per‑Organizaci = budoucnost, viz vize §4.)*

## 4. Pravidla a stavy — „vyřízeno" = stav „Hotovo" (jeden fakt)

- **Sloupec = stav** (právě jeden). Přetažení karty = změna `status` (+ `sort_order`).
- **„Vyřízeno" a stav „Hotovo" jsou JEDEN fakt, drží se v synchronu** (žádné dvě nezávislé „done"):
  - Stav s příznakem **`is_done`** (default „Hotovo") = vyřízeno.
  - **Zaškrtnutí „vyřízeno"** ⇒ úkol jde do „Hotovo" (`done=1`). **Odškrtnutí** ⇒ vrátí se do
    **předchozího** stavu (jinak „Nový"), `done=0`.
  - **Přetažení do „Hotovo"** ⇒ zaškrtne; **přetažení z „Hotovo"** jinam ⇒ odškrtne.
  - Důsledek: **konzistence napříč pohledy** — co je vyřízené v kanbanu, je vyřízené i v Agendě;
    vyřízený úkol **nikdy nezůstane mezi nehotovými**.
- **Mezi ne‑done sloupci** (Nový ↔ Vyřizuji ↔ Kontrola) se `done` nemění (nezávislé osy, dokud nejde o „Hotovo").
- **Archiv = příznak** (`archived`), ne sloupec: vyřízené se dají **skrýt z boardu**, zůstanou v
  historii. Přístup: **patička sloupce „Hotovo" → „Archivované úkoly (N)"**; per‑karta „Archivovat";
  hromadně „Archivovat hotové"; **při „Uzavřít měsíc" se hotové archivují** (default, lze vypnout).
- **Akceptace/delegace NENÍ sloupec** (samostatný delegační příznak, řeší se později — vize §4).
- **Čí board:** běžný uživatel = svůj; **admin** otevře board kolegy. **Board podle klienta** patří
  k modulu **Projekty/Zakázky** — není součástí této verze.
- **„Uzavřít měsíc"** (zvolený board + měsíc): **nehotové** (`done=0`) → `board_month` další měsíc
  (stav zůstává); **hotové** nechá (a dle nastavení archivuje). Smí **specialistka pro svůj board** i
  **admin**. V1 = přesun + krátký souhrn (počty). Jen na konkrétní měsíc (ne „Bez měsíce").
- Vše loguje do `events` (úkoly s klientem) → realtime; živá zóna překresluje board.

## 5. Akce (kontextové)

- Pod H1: **Agenda | Kanban**. Lišta: **◀ měsíc ▶**, **čí board** (admin), **⋯ Nastavení**
  (Uzavřít měsíc · Spravovat sloupce · auto‑archiv), **Přidat úkol**.
- Sloupec: **＋** (úkol do stavu) · **drag** pro pořadí · u „Hotovo" patička **Archivované úkoly**.
- Karta: **drag‑drop** · **zaškrtnout vyřízeno** · klik = úprava · ⋯ Smazat/Archivovat.

## 6. Prázdné stavy

- Nový uživatel ⇒ nasadí se **výchozí sada** stavů (Nový/Vyřizuji/Kontrola/Hotovo).
- Prázdný board měsíce: „V tomto měsíci tu zatím nic není. **Přidat úkol.**"
- Prázdný sloupec: tichá plocha pro drop.

## 7. Hotovo, když… (checklist)

- [ ] `/ukoly` má **Agenda | Kanban** nad stejnými daty; **vyřízeno je konzistentní v obou** (jeden fakt)
- [ ] Sloupce = stavy **per uživatel**: přejmenovat · přebarvit · přeřadit · přidat/odebrat; **＋** zakládá do sloupce
- [ ] **Drag‑drop** karet mění `status` (+ pořadí); zaškrtnutí ⇄ „Hotovo" (synchron `done`)
- [ ] **Archiv = příznak**: patička „Hotovo" → „Archivované úkoly (N)", per‑karta archiv, obnova
- [ ] **Měsíční čočka** (◀▶ + „Bez měsíce") + **„Uzavřít měsíc"** (nehotové dál, hotové archivovat); specialistka i admin
- [ ] **Admin** otevře board kolegy; Nástěnka i agenda konzistentní; Historie + realtime
- [ ] typecheck zelený, HTTP testy projdou; kanban dle KOMPONENTY/UI‑ZASADY

---

## K rozhodnutí — vše odsouhlaseno ✅

1. Výchozí stavy per uživatel: **Nový · Vyřizuji · Kontrola · Hotovo** (`is_done`).
2. **„Vyřízeno" = stav „Hotovo"** (checkbox a sloupec synchronně; konzistentní v agendě i kanbanu).
3. **Archiv = příznak**; patička „Archivované úkoly" ve sloupci „Hotovo"; auto‑archiv při uzávěrce.
4. **v1 = osobní boardy** (+ admin board kolegy); board podle klienta až s Projekty.

## Realizováno (upřesnění oproti návrhu výše)

Po dalším ladění s Petrem (2026‑06‑15) je výsledná podoba:

- **Žádný přepínač „měsíc / bez měsíce".** Místo toho je **první stav povinný „Inbox/Zásobník"**
  (`task_statuses.is_default`): sem padají **nové i nezařazené úkoly** (status `null` → Inbox přes
  `effColumn`). Inbox **nelze smazat**, lze **přejmenovat** a měnit barvu/`is_done`. Pokud je jediný
  sloupec, slouží zároveň jako sklad hotových.
- **Inbox je cross‑month** (vždy viditelný, napříč měsíci) — nic se „neztratí". **Ostatní sloupce**
  ukazují jen vybraný měsíc (◀ měsíc ▶). Přetažením z Inboxu do sloupce se úkol **naplánuje** do
  zobrazeného měsíce; přetažením do Inboxu se vrátí mezi nezařazené (`board_month = null`).
- **Správa sloupců přímo na boardu** (ne v modálu): inline **přejmenování**, **drag‑drop řazení**
  (úchyt ⠿), ⋯ menu (barva, „stav vyřízeného", smazat), a **„+ Sloupec"** na konci. Vše přes htmx,
  překresluje `#board`.
- Datově navíc: `task_statuses.is_default`. Plná šířka boardu = full‑bleed jen u `.kanban`
  (hlavička/lišta standardní šířka).
