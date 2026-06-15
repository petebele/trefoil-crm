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

## Další nápady (zatím nezařazené)

*(sem přidávat při brainstormu)*
