# Automatizace a vylepšení — Trefoil CRM v2

🧭 **Znalostní báze:** [mapa](../README.md) · [sumář](SUMMARY.md) · [architektura](ARCHITECTURE.md) · [roadmapa](ROADMAP.md) · [pravidla](../CLAUDE.md) · [datový model](DATOVY-MODEL.md) · [vize práce](VIZE-ukoly-projekty-poznamky.md)

Zápisník nápadů na **automatizace** (věci, které má systém dělat sám)
a **vylepšení procesů**. Není to závazek ani roadmapa — je to seznam příležitostí,
ze kterého budeme čerpat. Co se zrealizuje, přesune se do [ROADMAP.md](ROADMAP.md)
/ [SUMMARY.md](SUMMARY.md).

---

## Uzávěrka měsíce — dvoustupňová

Měsíční loop kanbanu (specialistka uzavře svůj board a jede nový) je provázaný
s fakturací klienta. Na jednom klientovi může pracovat **víc specialistů**, proto
oddělujeme **provozní** a **finanční** uzávěrku.

### 1) Provozní uzávěrka (specialista, per uživatel/board)

Fakticky **nezamyká** — je to jen dávka úkonů „mám hotovo za sebe":

- nehotové úkoly se **přesunou do dalšího období** (stav zůstává zachován),
- hotové úkoly se v dalším období **archivují**,
- vygeneruje se **report „za svoji práci"** (co jsem udělal),
- **notifikace manažerovi**: „specialista X uzavřel měsíc u klienta Y".

**Automatizace k tomu:**

- 🤖 **Auto-úkol manažerovi „Zkontrolovat závěrku pracovníka"** — vznikne, jakmile
  specialista provede provozní uzávěrku.
- 🤖 **Hlídač chybějící závěrky** — když se blíží konec období a manažer ještě
  **nedostal** od některého specialisty notifikaci o uzavření, dostane upozornění
  („od specialisty X u klienta Y zatím nemáš uzávěrku").

### 2) Finanční uzávěrka (pouze manažer / key account, per klient)

Dělá ji **jen manažer**, a to **až když uzavřou všichni specialisté** daného klienta:

- převede **nevyčerpaný paušál** (tam, kde se převádí),
- vygeneruje **podklady pro fakturaci** per klient,
- (volitelně, do budoucna) **uzamkne období** klienta.

**Automatizace k tomu:**

- 🤖 **Auto-úkol manažerovi „Uzavřít měsíc klienta Y"** — vznikne, jakmile uzavřou
  **všichni** specialisté pracující na klientovi.

> Reporty (přesný obsah a forma) zatím nejsou dořešené — chybí zkušenost,
> dořeší se s kolegy. Zde držíme jen, **že** report z provozní uzávěrky vzniká.

---

## Úkoly ↔ výkazy ↔ čas ↔ fakturace (návrh napojení)

> **Stav: ZÁKLAD POSTAVEN (2026-06-16)** — „Vykázat práci" z úkolu, vazba `work_records.task_id`,
> blok „Vykázaná práce" u úkolu. Spec: [vykazy-ukoly-propojeni.md](specs/vykazy-ukoly-propojeni.md).
> Níže původní dohoda pravidel; čas/timer a hlubší automatizace zůstávají do budoucna.

Detailní zadání ke stavbě — viz [VIZE-ukoly-projekty-poznamky.md](VIZE-ukoly-projekty-poznamky.md).
Shrnutí pravidel, na kterých jsme se shodli:

- **„Vykázat práci" z úkolu** — na kartě úkolu (při editaci) i v ⋯ menu položka
  **„Vykázat práci"**. Otevře nový výkaz s **předvyplněným úkolem** a podle něj
  **předvyplněným klientem**.
- Výkaz **může, ale nemusí** odkazovat na úkol; **vždy** ale musí odkazovat na
  **klienta**.
- Většina úkolů **nemusí** mít čas ani výkaz.
- Čas i výkaz jde zadat **i bez úkolu**.
- **Timer zatím neřešíme** — zadává se jen čas ručně.

---

## Vyúčtování a paušál (retainer) — model, fázování, budoucí konfigurace

> Vychází z rešerše PSA nástrojů (Accelo, Productive, Harvest, Scoro, Teamwork, Kantata,
> FreshBooks, Monograph…). Závěr: paušál + rollover + přečerpání je standard; **explicitní
> schvalovací stav přečerpání** (zaplatí/odepíše, i částečně) nemá nikdo → náš diferenciátor.

**Paušál u klienta (POSTAVENO 2026-06-17):** zadává se **počet hodin** + **sazba za 1 paušální
hodinu** (Kč/h) → měsíční cena = hodiny × sazba (odvozená). Volitelně **sazba za vícepráce**
(Kč/h, obvykle vyšší; prázdné = sazba služby). Převod nevyčerpaných hodin (rollover) zap/vyp.

**Vyúčtování v1 (POSTAVENO):** karta „Vyúčtování" na detailu firmy → Služby:
- Měsíční paušál (dohodnutá cena) · čerpáno X z Y · pozn. převod/propadnutí.
- Odrážky služeb hrazených z paušálu (čas, bez částky).
- Nevyčerpáno (jen při převodu) −Kč · nebo Přečerpáno +Kč (sazbou vícepráce/služby) · nebo „zbývá (propadá)".
- Nepaušální služby (payg čas × sazba; předplatné fixně). Celkem dole.
- Jeden zdroj pravdy `billingTotal()` (sdílí karta i dlaždice na nástěnce).

**v2 — schvalování víceprací (5 scénářů, napojené na uzávěrku):**
1) schválit vše · 2) schválit do částky (zbytek = odpis, jen reporting) · 3) schválit po službách
(zaškrtávátka) · 4) převést do příštího období (vznikne značená služba „převod z MM/RRRR", blokuje
část paušálu) · 5) neschválit = odpis (write-off; do součtu 0, eviduje se „kolik jsme darovali").
> Pojmy: **write-off** (uděláno, neúčtujeme) × **non-billable** (smlouva nekryje) × **write-down**
> (účtováno méně). Negativní rollover / „borrow forward" = scénář 4.

**Budoucí konfigurace u klienta (návrh, nestavěno):**
- **Domluvené přečerpání** v hodinách nebo % (auto-akceptovaná tolerance nad paušál).
- **Defaultní hodnoty pro schvalování víceprací** per klient (předvyplní volbu z v2).
- Strop rolloveru (best practice ~25 %, okno 1 měsíc).

**Vyúčtování projektu (návrh, nestavěno):** každý řádek činnosti ve Vyúčtování má dostat
**badge s názvem projektu** (druhý řádek řádku). Badge bude **klikací → přechod na vyúčtování
projektu** (souhrn za projekt napříč klienty/činnostmi). Vyžaduje **modul Projekty/Zakázky**
a vazbu výkazu na projekt (`work_records` → projekt, příp. přes úkol). V kartě Vyúčtování už je
připravená struktura řádku (placeholder pro badge). Mezikrok: badge by mohl prozatím ukázat
**navázaný úkol** (výkaz už `task_id` má) — k rozhodnutí.

---

## Obchod, leady a oslovování (inspirace Raynet)

> Zdroj: přání kolegyně, inspirace nástrojem **Raynet** (CZ CRM). **Zatím jen evidence** — budoucí
> okruh, žádný závazek. Spadá z větší části do budoucího modulu **Zakázky/Obchod (leady)**. U bodů,
> kde už dnes máme stavební kámen, je značka **✅ částečně už teď**.

### Sledování obchodních případů (pipeline)
- Vést **obchodní případ / lead** u kontaktu: koho jsme oslovili, **kdy**, jaký je **stav**
  (oslovili jsme ho / čekáme / domluveno / ztracený…), **kdy oslovit znovu**.
- **Upozornění na budoucí oslovení** — připomínka „ozvi se klientovi X dne …". Navazuje na
  budoucí **Nástěnku / Inbox „Vyžaduje moji pozornost"** a na termíny úkolů (`tasks.due_at`).
- ✅ **částečně už teď:** stav leadu lze zachytit jako **Seznam** (číselník `lead_statuses`,
  barevný chip přes `entity_list_items`); připomenutí jako úkol s termínem.

### Komunikace z CRM
- **Rozesílání e-mailů** přímo ze systému (jednotlivě i hromadně), vidět historii odeslaného.
- **Rezervace schůzky** v systému (kalendář) — a v záznamu vidět stav (domluveno / proběhlo).
- Pozn.: vyžaduje napojení na e-mail (SMTP/API) a kalendář — **nová infrastruktura**, do budoucna.

### Návazné úkoly (řetězení)
- Možnost vytvořit **návazný úkol**: jeden úkol uzavřu (nebo ne) a na to **automaticky/ručně vznikne
  navazující úkol** (např. „oslovit → po týdnu follow-up → nabídka → …").
- ✅ **částečně už teď:** úkoly mají `source_kind`/`source_id` (původ auto‑úkolu) a koncept
  auto‑úkolů (viz uzávěrka výše) — řetězení by se na to dalo navázat.

### Nabídky + automatický follow-up
- **Vytvořit nabídku** klientovi; v kalendáři **nastavit follow-up po týdnu**.
- Pak **automaticky**: notifikace + **vygenerování obsahu e‑mailu** + **automatická rozesílka**
  follow-up e-mailu. (Generování obsahu = prostor pro AI; rozesílka = e‑mail infrastruktura.)
- Pozn.: největší kus — kombinuje nabídky, kalendář, e‑mail i generování textu; daleká budoucnost.

### Zájmy klienta (oblasti zájmu) — štítky s follow-upem
- Evidovat, **o co klient projevil zájem** / o jaké **oblasti** — formou **štítků**.
- Použití pro **cílené, personalizované oslovení**: „máme nově *automatický bidding* — koho můžu
  oslovit, kdo o to **opravdu** měl zájem" → výběr klientů podle štítku zájmu.
- Zužitkovat i jako **vstup do leadů/obchodu** a pro **kategorizaci klientů**.
- ✅ **částečně už teď:** štítky zájmů = **Seznam** `client_interests` + přiřazení přes
  `entity_list_items` (barevné chipy). Sběr zájmů můžeme začít evidovat hned; cílené oslovení
  (filtr podle štítku → seznam ke kontaktu) dořešíme s modulem Obchod.

### Typy zákazníků (segmentace)
- V seznamu zákazníků **rozlišovat typ**: **agentura**, **eshopař** (rozšiřitelné).
- Slouží k filtrování, jinému oslovení i reportům.
- ✅ **částečně už teď:** buď nový **Seznam** `client_types` (chip přes `entity_list_items`),
  nebo samostatné pole na firmě. Reuse stávajícího vykreslování chipů — levné zavést dřív než
  celý modul Obchod.

> **Společný jmenovatel:** štítky/segmentace (zájmy, typ zákazníka, stav leadu) stojí na už
> existujícím systému **Seznamů** (`lists`/`list_items`/`entity_list_items`, barevné chipy) — dají
> se zavést **inkrementálně už teď** a později se z nich „nakrmí" plnohodnotný modul **Obchod/Leady**
> (pipeline, oslovování, nabídky, e‑maily). Komunikační část (e‑mail, kalendář, generování+rozesílka)
> je samostatná infrastruktura na později.

---

## Další nápady (zatím nezařazené)

### Jednoduchý chat (interní)

Lehký interní chat — v podstatě **„streamování" poznámek za sebou** od různých uživatelů
(u klienta / projektu / obecný kanál). Postavit nad **komponentou Poznámek** (stejný editor
i ukládání), jen jiný pohled: chronologický tok krátkých zpráv místo karet.

- **Reuse:** `notes` + `note_links` (vazba na entitu = „kanál"), `note_content`/editor, realtime
  přes `logEvent()` + SSE (`/live`) už máme. Chat = poznámky řazené vzestupně + kompaktní bublina.
- **Notifikace:** in‑app (Inbox „Vyžaduje moji pozornost") + **volitelně browser notifikace**
  (Web Notifications API — vyžádat povolení, posílat při nové zprávě/zmínce). Napojit na @zmínky.
- **Infrastruktura do budoucna:** počítat s tím, že chat = vyšší frekvence krátkých zápisů.
  Náš stack to zvládne (viz níže), ale event/realtime vrstvu navrhnout obecně (kanál + odběr),
  ať jde později vyměnit transport (SSE → WebSocket) bez přepisu modulů.

> **SQLite a víc uživatelů (odpověď na dotaz):** současná **SQLite v souboru** (better‑sqlite3)
> je pro tým agentury **dostačující i pro chat**. Máme zapnutý **WAL** (čtenáři neblokují
> zapisovatele a naopak) + `busy_timeout`. Zápisy jsou mikrosekundové a v jednom procesu se
> přirozeně serializují, takže běžný souběh uživatelů se neprojeví. Limity SQLite (jeden
> zapisovatel naráz, jeden soubor/proces) by vadily až při **vysoké frekvenci zápisů od mnoha
> lidí** nebo **běhu na více serverech** — pak je připravený **seam na PostgreSQL**
> (`src/db/index.ts`, dotazy přes Kysely zůstanou). Pro současný rozsah měnit nic netřeba.
