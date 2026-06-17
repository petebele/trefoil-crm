# Vize: Feed · Příležitosti · Log komunikace (analýza konkurence)

🧭 **Znalostní báze:** [mapa](../README.md) · [roadmap](ROADMAP.md) · [datový model](DATOVY-MODEL.md) · [komponenty](KOMPONENTY.md) · [UI zásady](UI-ZASADY.md) · [slovník](SLOVNIK.md) · [sumář](SUMMARY.md) · [automatizace](AUTOMATION.md) · [vize práce](VIZE-ukoly-projekty-poznamky.md) · [specs](specs/)

> **North-star pro oblast „dění u zákazníka"** — aktivitní **feed** (na zákazníkovi i osobní na
> dashboardu), **příležitosti / obchodní případy**, evidence **zájmů** a **log komunikace** s
> navazujícími kroky. Není to specifikace ke stavbě — je to **směr** + **analýza, jak to řeší
> špička**, ze které budou čerpat jednotlivé specifikace (každá pořád prochází `spec → schválení →
> stavba`). Vychází z **fan-out rešerše** (2026-06-17) primární dokumentace HubSpot, Salesforce,
> Pipedrive, Attio, Close a Raynet; tvrzení prošla adversariálním ověřením (3 hlasy, 2/3 vyvrací).
> Doplňuje [VIZE — Úkoly · Projekty · Poznámky](VIZE-ukoly-projekty-poznamky.md), která řeší oblast „práce".

---

## 0. TL;DR — co z toho plyne pro Trefoil

1. **Feed = jeden chronologický agregát** mnoha typů „aktivit" (hovor, e-mail, schůzka, poznámka,
   úkol, změna stavu) na detailu entity. **Naše „Historie" je už 80 % tohoto feedu** — chybí jí
   jen (a) ruční zápisy uživatele, (b) typy/ikony, (c) navazující krok.
2. **Aktivita je polymorfní** — jeden záznam visí na víc entitách zároveň (firma + osoba +
   příležitost). To je doporučené schéma a přesně to, co umožní „feed krmený odjinud". Náš log
   událostí má dnes jednu vazbu (entity_kind+entity_id); pro feed ho rozšíříme na **vazební tabulku**.
3. **Příležitost / obchodní případ** je samostatná entita (ne úkol, ne firma) s **fázemi (pipeline)**,
   napojená na firmu+osobu. „Lead" je nekvalifikovaná před-fáze — pro malou agenturu ji lze zpočátku
   vynechat a začít rovnou Příležitostí s fázemi.
4. **Osobní dashboard feed** není „zeď novinek", ale **prioritizační pohled** „co je po termínu / dnes
   / nadcházející", krmený hlavně z **mých úkolů a mých příležitostí**.
5. **Zájmy klienta** = barevné **chipy ze systému Seznamů** přiřazené k firmě/osobě/příležitosti →
   segmentace a cílené oslovení („kdo měl zájem o X").
6. **Klíčový vzor follow-up:** každá zaznamenaná komunikace umí rovnou založit **navazující úkol k datu**
   („zavolat za týden") + reporty „otevřené případy bez naplánované aktivity / X dní bez aktivity".
7. **Projekt je v agenturních nástrojích kontejner pro práci i fakturaci** (PSA: Productive, Teamwork,
   Accelo) — feed bývá **na projektu**, retainer/rozpočet **na projektu**, čas se loguje proti **službě**
   v projektu. **Feed se ale NEMÍCHÁ s financemi** (faktury/čas nejsou ve feedu). Pro nás: zavést
   **Projekt jako volitelný kontejner** mezi klientem a výkazy; **paušál nechat defaultně na klientovi**
   s možností pozdější vazby na projekt. Detail v §7.

> ✅ **Doplněno (2. rešerše, 2026-06-17):** agenturní/PSA segment je teď pokrytý — viz §7. Zbylé dílčí
> mezery (Scoro/Paymo/Kantata neověřeny, patří finance do feedu, paušál u klienta s více projekty)
> jsou v §9.

---

## ✅ Rozhodnutí (2026-06-17): Služby = stavební kámen, Projekt = budoucí modul

> Petrovo rozhodnutí po analýze — **vědomě se odchylujeme od PSA vzoru „vše je projekt".** Trefoil je
> primárně **CRM**, ne nástroj projektového řízení.

- **Služba u klienta = základní stavební kámen** (funguje jako „mini-projekt"): nese úkoly, výkazy,
  poznámky, **feed** a **vlastní dílčí rozpočet**. Dostane **vlastní detail/dashboard** — vše, co se
  u služby dělo, kdo zasáhl, poznámky. *(Většina uživatelů vystačí jen se službami — projekty vytvářet nemusí.)*
- **Projekt = budoucí aktivovatelný modul „Projektové řízení".** Samostatná „nafukovací" entita, která
  **zastřešuje víc služeb**, prací/zakázek, řešitelů, úkolů, nástěnek a může mít **fáze / milníky /
  dílčí cíle**. **Nestaví se teď** — jen se na něj datově/architektonicky **připravíme** (zapnutelný
  modul). Sem patří i PSA vzor „vyhraná příležitost → projekt" (§7.6) — až bude modul.
- **Nevolat všechno „projekt".** Projekt = něco vyššího/mimořádného; běžný provoz = služby.
- **Rozpočet (POTVRZENO 2026-06-17):** na **klientovi** (paušál = celkový strop / smlouva) **+ volitelně
  per služba** (alokace). Stávající klientský paušál se neruší, jen přibude volitelný rozpočet na službu.
  - **Tvrdý rozpočet** je default. Per služba **checkbox „povolit přečerpání"** → smí čerpat
    **z nevyčerpaného rozpočtu ostatních služeb** (tj. do výše klientského stropu).
  - **Dvě úrovně přečerpání:** (1) služba nad svou alokaci, ale klient v rámci stropu → „půjčí si" od
    ostatních služeb (jen když je zapnutý checkbox); (2) klient **nad** strop → **vícepráce** (už máme
    `overage_rate`).
  - **Prahové upozornění** „upozornit na vyčerpání **X %** nebo **X Kč**" (na službě i na klientovi),
    **default 80 %** — ať o blížícím se limitu víme **předem**, ne až po překročení. Napojí se na
    realtime + plánovaný **Inbox „Vyžaduje moji pozornost"**.
  - Souvisí s **Vyúčtováním v2** (schvalování víceprací) — viz [AUTOMATION.md](AUTOMATION.md).
- **Pojem „Služba"** zatím ponecháváme (mapuje se na katalog i vyúčtování); přejmenování na výstižnější
  (oblast / agenda / péče…) je otevřené, ne blokující.

→ Důsledek pro stavbu: místo „modulu Projekty" je teď na řadě **(a) feed, (b) detail/dashboard služby,
(c) dílčí rozpočet na službě**. Projekty zůstávají jako připravený, zatím **vypnutý** směr.

### Přečerpání rozpočtu — tři cesty řešení (a jak se nezavřít do kouta)

Když se služba blíží limitu (default **80 %**), je to **moment k rozhodnutí / domluvě s klientem**.
Jsou **tři cesty**, odkud vzít chybějící část:

1. **Realokace v rámci období** — vzít z **nevyčerpaného rozpočtu jiné služby** (kterou tím omezíme).
   Klientský strop beze změny. *(= „povolit přečerpání" / půjčit si od sourozenců.)*
2. **Z dalších období (borrow forward)** — vzít z budoucích měsíců (negativní rollover). ⚠️ **Riziko:**
   opakuje se → 4měsíční rozpočet vyčerpán za 3 → nutné **přenastavit služby** nebo **jednat s klientem**.
   Doporučit **strop na borrow-forward**, ať se to nevymkne.
3. **Navýšení klientského rozpočtu** — klient schválí víc → **vícepráce** (`overage_rate`). Jednorázově
   v daném měsíci, nebo trvale zvednout paušál.

**Aby nás model nezavedl do slepé uličky** (i když stavíme později), stačí ho navrhnout takto:
- **Rozpočty drž po obdobích**, ne jako jedno statické číslo (umožní rollover i borrow-forward).
  *(Měsíční model + rollover už máme.)*
- **Klientský strop a alokace služeb = oddělené hodnoty**; jejich vztah (součet vs strop) **počítej**,
  neukládej natvrdo.
- **Změny rozpočtu a rozhodnutí o přečerpání zapisuj jako události** (do feedu/historie) s **typem**
  (realokace / borrow-forward / navýšení / odpis) — ne jen ano/ne. *(= scénáře Vyúčtování v2, viz
  [AUTOMATION.md](AUTOMATION.md).)*
- **Nikdy neblokuj zápis práce** — tvrdý limit řeší jen **zařazení do účtování**, ne možnost vykázat realitu.

**Nice to have (později):** systém z **tempa čerpání + alokace predikuje** („při tomto tempu vyčerpáš PPC
do 22. dne") a **doporučí úpravu** k probrání s klientem (realokovat ze SEO / navýšit / borrow-forward).
Je to **čistě nadstavba** — když držíme rozpočty po obdobích a máme časované výkazy (`performed_at`),
predikce je kdykoli dopočitatelná, takže **žádné riziko pro datové schéma**.

---

## 1. Feed na detailu zákazníka (activity timeline)

### Jak to řeší špička
- **Jeden chronologický agregát** mnoha typů aktivit: hovory, e-maily, schůzky, poznámky, úkoly a
  další komunikace (LinkedIn/SMS/WhatsApp). HubSpot i Salesforce řadí **chronologicky**, s
  **nadcházejícími nahoře** a proběhlými níže (vzor „upcoming vs past"). [HubSpot, Salesforce]
- **Mísí se systémové události s ručními zápisy.** Ručně logované aktivity (e-mail, hovor, poznámka)
  jsou **editovatelné a drží historii úprav** — tím se vizuálně/datově liší od automatických
  systémových záznamů. [HubSpot]
- **Rychlé akce „log a call / log a meeting / log a note" jsou prvotřídní vstup.** HubSpot rozlišuje
  *create* (iniciace v systému) vs *log* (záznam toho, co proběhlo mimo systém), má 5 výchozích
  rychlých tlačítek v sidebaru; Salesforce má **inline kompozer přímo nad časovou osou**. [HubSpot, Salesforce]
- **Filtrování dle typu aktivity**, seskupení, a vazby zobrazené jako **preview karty** souvisejících
  objektů v pravém sidebaru. [HubSpot]

### Společný vzor
Feed = stream řádků „kdo / kdy / co / u čeho", kde každý řádek má **typ** (s ikonou), volitelně
**navazující krok**, a může být **ruční** nebo **automatický**. Nadcházející věci nahoře.

### Terminologie
| EN | CZ návrh |
|---|---|
| Activity timeline / feed | **Feed** / **Časová osa** / **Dění** |
| Activity | **Aktivita** (záznam ve feedu) |
| Log a call / meeting / note | **Zaznamenat hovor / schůzku / poznámku** |
| Upcoming vs past | **Nadcházející** vs **Proběhlé** |

### Co z toho pro Trefoil
Naši **„Historii"** povýšit na **Feed**: (1) přidat **ruční zápis** přímo do feedu (kompozer s typem:
poznámka / hovor / schůzka / e-mail), (2) **typy + ikony** a vizuální odlišení ruční vs automatické,
(3) **nadcházející nahoře**, (4) filtr dle typu. Ruční zápisy = editovatelné (autor + historie úprav),
automatické = read-only. Poznámky (už máme editor) se stanou jedním z typů aktivity ve feedu.

---

## 2. Osobní „my work" feed na dashboardu

### Jak to řeší špička
- **Není to zeď novinek, ale prioritizační pohled.** HubSpot „Summary" seskupuje úkoly podle termínu
  (**due today / overdue / due tomorrow**). Pipedrive „Focus view" po otevření ukáže naléhavé:
  **počty aktivit po termínu** a po termínu uzavření obchodů, pak aktivity „dnes" a v následujících
  dnech (chronologicky, ne dle typu). [HubSpot, Pipedrive]
- Krmí se **hlavně z úkolů a z dealů/příležitostí** přihlášeného uživatele.

### Co z toho pro Trefoil
Dashboardový feed = **agregace MÝCH úkolů + MÝCH příležitostí seřazená dle termínu**, s bloky
**„po termínu / dnes / nadcházející"**. Tohle se přímo potkává s plánovanou **Nástěnkou / Inbox
„Vyžaduje moji pozornost"** (viz [VIZE práce](VIZE-ukoly-projekty-poznamky.md)) — je to její obsah.
Pozn.: Pipedrive Focus view je primárně **mobilní** funkce — přebírat **koncepčně**, ne 1:1.

---

## 3. Příležitosti, leady, obchodní případy (deals)

### Jak to řeší špička
- **Příležitost = samostatná entita** „deal" (HubSpot) / „opportunity" (Salesforce) / „obchodní
  případ" (Raynet) pro sledování potenciální tržby. Odlišná od kontaktů a firem, ale **napojená na ně
  asociacemi**. Nese pole: **hodnota, pravděpodobnost, očekávané datum uzavření, vlastník**. [HubSpot, Raynet]
- **Lead vs Deal = otázka kvalifikace a pipeline.** Lead = nekvalifikovaná příležitost **mimo
  pipeline**, žije v samostatné **„Leads Inbox" (staging)**. Deal = kvalifikovaná příležitost
  procházející **fázemi pipeline** k „won/lost". Lead **musí** být napojen na kontakt nebo firmu. [Pipedrive]
- **Fáze pipeline jsou konfigurovatelné** dle vlastního prodejního procesu. [Raynet, Pipedrive]

### Terminologie
| EN | CZ návrh |
|---|---|
| Lead (unqualified) | **Tip** / **Lead** (mimo pipeline) |
| Deal / Opportunity | **Příležitost** nebo **Obchodní případ** |
| Pipeline / Stage | **Pipeline** / **Fáze** |
| Won / Lost | **Vyhráno** / **Prohráno** |

### Co z toho pro Trefoil
Zavést entitu **Příležitost** (= obchodní případ) s **konfigurovatelnými fázemi** (Seznam!), napojenou
na **firmu + osobu**. **Lead-vrstvu zpočátku vynechat** — pro malou agenturu stačí začít rovnou
Příležitostí s fázemi; „tip" lze přidat později jako před-fázi. Fáze = další **Seznam** (barevné chipy,
jako stavy úkolů na Kanbanu — máme vzor). Pozn. k budoucím **Zakázkám/Projektům**: „příležitost" (před
podpisem) je něco jiného než „zakázka/projekt" (po podpisu, realizace) — vyhraná příležitost se může
**překlopit v projekt**.

---

## 4. Zájmy klienta (co poptává / „interested in")

### Jak to řeší špička
Eviduje se, **o co klient projevil zájem** / o jaké oblasti — typicky formou **tagů / property
„interested in"**, a používá se k **segmentaci** a **cílenému, personalizovanému oslovení** („máme
nově X — koho můžu oslovit, kdo o to měl opravdu zájem"). [HubSpot community]

### Co z toho pro Trefoil
**Postavit nad stávajícím systémem Seznamů** — Seznam `client_interests` → barevné chipy přiřazené
k firmě/osobě (a později i k příležitosti). Sběr zájmů můžeme **začít evidovat hned** (chip na kartě),
filtr „kdo má zájem o X" a cílené oslovení dořešíme s modulem Příležitosti. Stejný mechanismus pokryje
i **typ zákazníka** (agentura/eshopař) a **stav leadu** — viz [AUTOMATION.md](AUTOMATION.md).

---

## 5. Log komunikace + navazující kroky (follow-up)

### Jak to řeší špička
- Při zalogování aktivity systém **rovnou nabídne navazující úkol** (hovor/e-mail/to-do) k vybranému
  datu — komunikace je přímo provázána s **dalším krokem** („zaloguj e-mail a vytvoř úkol s termínem
  za 2 dny"). [HubSpot]
- **Raynet jde dál:** předdefinované filtry „otevřené případy **bez naplánované aktivity**", „**60 dní
  bez aktivity**", „s aktivitou **po termínu**" + nastavitelný **povinný follow-up** — systém tím
  **nutí** mít vždy naplánovaný další krok a hlídá „kdy oslovit znovu". [Raynet]

### Terminologie
| EN | CZ návrh |
|---|---|
| Next step / next activity | **Další krok** |
| Follow-up task | **Navazující úkol** |
| Reminder | **Připomenutí oslovení** |

### Co z toho pro Trefoil
Každá aktivita ve feedu (a každá příležitost) umí mít **„Další krok"** = navazující úkol k datu
(úkoly už máme, vazba `task_id`/`source_kind` taky). Reporty typu „příležitosti bez naplánované
aktivity" / „X dní ticho" se napojí na **dashboard / Inbox**. Tohle je most mezi feedem a úkoly.

---

## 6. Datový model a souvztažnosti (jádro)

### Klíčové zjištění: aktivita je polymorfní (many-to-many)
Jedna zalogovaná aktivita **může být současně napojená na víc záznamů** (kontakt + firma + deal +
ticket); vztahy lze per aktivita přidávat/měnit/odebírat. **To je doporučené schéma pro feed napříč
entitami** a přímá odpověď na otázku „je log polymorfní?" → **ano**. [HubSpot — pozn. říká tomu
„associations", ne „polymorphic"; existuje strop na počet asociací.]

### Antipattern, kterému se vyhnout
**Jedna FK aktivity na jednu entitu** — zabrání ukázat tutéž aktivitu na kartě firmy i u příležitosti.
Pozor i na „naivní polymorfní FK" (jeden sloupec `entity_id` bez cizího klíče, typ v druhém sloupci) —
ztrácí se referenční integrita ([SQL Antipatterns], [GitLab], [DoltHub]). Lepší: **vazební tabulka
`activity_links (activity_id, entity_kind, entity_id)`** s indexy, případně samostatné vazební tabulky
per entita (čisté FK) — k rozhodnutí ve specu.

### Náš stav vs cíl
- **Dnes:** `events` (Historie) má `entity_kind` + `entity_id` (jedna vazba) → stačí na log, ne na
  sdílený feed.
- **Cíl:** zachovat `events` jako zápis, ale **feed číst přes vazební tabulku** (aktivita ↔ {firma,
  osoba, příležitost, projekt}). Stávající `note_links` už přesně tenhle M:N vzor používá pro poznámky
  — **máme prototyp** a šel by zobecnit na „aktivity".

### Vztahy v kostce
```
Firma ──┐
Osoba ──┼─< Aktivita (feed: poznámka, hovor, schůzka, e-mail, systémová událost)
Příležitost ─┤         └─ může mít → Další krok (= Úkol s termínem)
Projekt ──┘
Příležitost >── Firma + Osoba ; Příležitost má Fázi (Seznam) ; (vyhráno → Projekt)
Zájmy/Typ/Stav = položky Seznamů přiřazené přes entity_list_items
```

---

## 7. Agenturní vrstva (PSA): Projekt ↔ Výkazy ↔ Vyúčtování ↔ Feed

> Doplněno cílenou rešerší (2026-06-17) PSA nástrojů — **Productive, Teamwork, Accelo, Harvest**
> (dobře doloženo). ⚠️ **Scoro, Paymo, Kantata se NEPODAŘILO ověřit** — o nich žádné závěry (viz §9).

### 7.1 Feed je na PROJEKTU, ne na klientovi — a NEMÍCHÁ se s financemi
- V PSA nástrojích je „feed" stream dění **na projektu**: změny úkolů, komentáře týmu, e-maily,
  dokumenty. Productive feed čerpá přesně ze **tří zdrojů**: projekt (změny/komentáře), úkoly, dokumenty.
- **Důležité: time entries, faktury ani příležitosti NEJSOU součástí feedu.** Feed = komunikace a
  změny, finance žijí v samostatném pohledu. „Vystavená faktura" jako událost ve feedu nebyla
  potvrzena u žádného nástroje.
- **Klientský feed = agregace** dění napříč projekty (Teamwork „Everything › Comments"), ne samostatné
  úložiště. Komentáře/aktivita visí na podkladových entitách (úkol/milník/soubor/poznámka) — což
  potvrzuje náš plán: klientský feed = **agregovaný pohled**, ne duplicitní data.
- → **Pro Trefoil:** dvě úrovně feedu — **projektový** (dění projektu) + **klientský** (agregace napříč
  projekty + přímé klientské události). **Vyúčtování drž v samostatném pohledu, ne ve feedu.**

### 7.2 Výkaz se váže na SLUŽBU uvnitř projektu, úkol je volitelný
- Productive: time entry → **služba** (povinné) uvnitř **rozpočtu/projektu**, **úkol volitelný** (jen
  pohodlný přístupový bod, čas se reálně loguje proti službě).
- → **Pro Trefoil:** náš model (klient + služba + úkol + minuty) je **kompatibilní** — stačí přidat
  **volitelné `project_id`** na výkaz (nebo ho odvodit přes úkol/službu).

### 7.3 Schválení času = brána k fakturovatelnosti
- Schválený čas se stává „recognized & billable", schválení záznam **zamyká**. Billable vs non-billable
  je **per záznam**.
- → **Pro Trefoil:** náš `billing` flag (retainer/billed/free) + schvalování **přesně sedí** na tento
  vzor. Schválené → vstupuje do čerpání paušálu / fakturace.

### 7.4 Billing typ je per SLUŽBA; jeden projekt míchá modely
- Productive: 4 billing typy **na úrovni služby** — **Fixed**, **Time & Materials**, **Non-billable**,
  **Percentage**; jeden rozpočet je **mixuje**.
- → **Pro Trefoil:** náš flag mapuje 1:1 — `retainer` ≈ čerpá paušál, `billed` ≈ T&M („účtovat zvlášť"),
  `free` ≈ non-billable. Tenhle kus už máme správně.

### 7.5 ⚠️ Retainer/paušál mají velké nástroje na PROJEKTU, ne na klientovi
- **Teamwork:** retainer rozpočet je **na projektu** (jeden aktivní rozpočet/projekt), volba **čas vs
  peníze**, opakuje se po obdobích (měsíc/kvartál), **rollover** přebytku i deficitu (overage).
- **Accelo:** víc billing modelů na projektu + retainery jako **samostatný modul**; **budget vs actual**
  (burn-up) a detekce přečerpání v reálném čase.
- **Harvest:** sazby **per projekt/úkol** (ne jedna klientská), čas → faktura přímo, recurring + retainer.
- **ALE:** to je vzor **velkých nástrojů** pro střední/velké agentury. Pro **malou agenturu** je
  klientský paušál legitimní zjednodušení — náš dnešní model (paušál na klientovi) **není špatně**.
- → **Doporučení (kompromis):** paušál **nechat defaultně na klientovi**, ale datově navrhnout tak, aby
  šel **volitelně vázat na projekt** (a později alokovat/rozpadnout). Samotný model (hodiny × sazba,
  vícepráce, rollover) máme správně — mění se jen **kam se vazba věší**.

### 7.6 Hierarchie: Klient → Příležitost → Projekt (fakturovatelný kontejner)
- Productive: **vyhraná příležitost (deal) → rozpočet/projekt** (kopírují se služby; ikona kufříku
  značí původ z dealu). Lze linkovat jen příležitosti **téhož klienta**. Feed rozpočtu dokonce dělí
  **Sales** (příležitost) vs **Production** (projekt).
- → **Pro Trefoil:** plánovaná **Příležitost** při výhře **založí Projekt**. Projekt = kontejner pro
  výkazy i vyúčtování (ekvivalent „budget"). Řetězec:
  `Klient → Příležitost → Projekt → {Úkol, Výkaz} → (Faktura)`.

---

## 8. Doporučené pořadí stavby (jak na to)

Inkrementálně, ať každý krok hned přináší hodnotu a „krmí feed":

1. **Feed v1 na kartě firmy** = re-prezentace dnešní Historie + **ruční zápis** (kompozer: poznámka /
   hovor / schůzka), typy + ikony, nadcházející nahoře, filtr dle typu. *(Rozšíří log událostí o ruční
   záznamy a o vazební tabulku.)*
2. **Další krok / follow-up** — z aktivity i odjinud založit **navazující úkol k datu**; napojit na
   Inbox „Vyžaduje moji pozornost".
3. **Osobní dashboard feed** = moje úkoly + (později) mé příležitosti dle termínu, bloky „po termínu /
   dnes / nadcházející".
4. **Zájmy + typ zákazníka** přes Seznamy (chipy) — levné, lze i dřív paralelně.
5. **Příležitost / obchodní případ** s konfigurovatelnými fázemi (Seznam), napojená na firmu+osobu a
   **polymorfně přes feed**; nad ní seznamy a follow-up reporty („bez naplánované aktivity").
6. **Projekt jako volitelný kontejner** — entita `Projekt(klient, název, stav, období)` + volitelné
   `project_id` na **úkol** a **výkaz**; **projektový feed** = agregace stávajícího `logEvent` nad
   projektem. **Příležitost při výhře → Projekt** (§7.6).
7. **Vyúčtování per projekt + burn-up** — volitelně vázat paušál/rozpočet na projekt; **burn-up
   komponenta** (vyčerpáno z rozpočtu, budget vs actual, přečerpání).
8. *(později)* **Lead** jako před-fáze, **faktury / napojení na účetní**, e-mail/kalendář integrace
   (viz [AUTOMATION.md](AUTOMATION.md)).

---

## 9. Mezery a otevřené otázky (k dozkoumání před specem)

- ⚠️ **Scoro, Paymo, Kantata/Mavenlink neověřeny** — 2. rešerše je sice jmenovala (Scoro i s důrazem),
  ale **žádné jejich tvrzení neprošlo ověřením**. Pokud je chceme jako referenci, je třeba samostatná
  rešerše. Závěry §7 stojí na Productive + Teamwork + Accelo + Harvest.
- **Patří finanční události do feedu?** „Vystavená faktura" / zalogovaný čas ve feedu **nebyly
  potvrzeny** — Productive je drží **mimo feed**. Rozhodnout v designu: finance ve feedu vs samostatný
  finanční pohled (kloníme se k oddělení).
- **Klient s VÍCE projekty pod jedním paušálem** — agreguje se čerpání na klientovi, nebo striktně per
  projekt? Tohle **přímo rozhoduje**, zda paušál necháme na klientovi (agregace) nebo přesuneme na
  projekt. Ověřené claimy ukazují project-level (Teamwork), ale neřeší klienta s víc souběžnými projekty.
- **Konkrétní UX burn-upu** a jak schválený čas teče do generování faktury (dávka vs auto, uzamčení
  fakturovaného záznamu) — claimy popisují jen obecně („budget vs actual", „detect overruns").
- **Agregace aktivit na příležitost** a **pinned/důležité** ve feedu — konkrétní UX neověřen (z 1. rešerše).
- **Datové modelování zájmů** tak, aby sloužilo pro segmentaci/filtr i pro personalizované oslovení —
  rozhodnout ve specu nad Seznamy.

---

## 10. Zdroje (primární, ověřené 2026-06-17)

**Obecné CRM (1. rešerše):**

- HubSpot — [record timeline & filtrování](https://knowledge.hubspot.com/records/filter-activities-on-a-record-timeline) ·
  [práce se záznamy](https://knowledge.hubspot.com/records/work-with-records) ·
  [ruční log hovoru/e-mailu/schůzky](https://knowledge.hubspot.com/contacts/manually-log-a-call-email-or-meeting-on-a-record) ·
  [asociace aktivit](https://knowledge.hubspot.com/records/associate-activities-with-records) ·
  [Sales Workspace / Summary](https://knowledge.hubspot.com/prospecting/review-sales-activity-in-the-sales-workspace) ·
  [vytváření dealů](https://knowledge.hubspot.com/records/create-deals)
- Salesforce — [Activity Timeline](https://help.salesforce.com/s/articleView?id=xcloud.lex_pro_tips_activity_timeline.htm)
- Pipedrive — [leads vs deals](https://support.pipedrive.com/en/article/leads-vs-deals) ·
  [Leads Inbox](https://support.pipedrive.com/en/article/leads-inbox) ·
  [Focus view](https://support.pipedrive.com/en/article/focus-view-in-the-mobile-app) ·
  [aktivity](https://www.pipedrive.com/en/features/activities-goals)
- Raynet — [obchodní případy](https://raynet.cz/jak-zacit/jak-na-obchodni-pripady/)
- Attio — [aktivity záznamu](https://attio.com/help/reference/managing-your-data/records/add-record-activities) ·
  [datový model](https://attio.com/help/reference/attio-101/attios-data-model/understanding-records)
- Close — [Inbox](https://help.close.com/docs/inbox)
- Datový model / antipatterny — [SQL Antipatterns](https://www.oreilly.com/library/view/sql-antipatterns/9781680500073/f_0043.html) ·
  [GitLab — polymorphic associations](https://docs.gitlab.com/development/database/polymorphic_associations/) ·
  [DoltHub](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/)

**Agenturní / PSA (2. rešerše — k §7):**

- Productive — [aktivita v projektech](https://help.productive.io/en/articles/14524950-activity-in-projects) ·
  [čas v rozpočtech](https://help.productive.io/en/articles/2179623-tracking-and-managing-time-entries-in-budgets) ·
  [schvalování času](https://help.productive.io/en/articles/2179594-approving-time) ·
  [billing typy](https://help.productive.io/en/articles/12048976-billing-types) ·
  [deal → budget](https://help.productive.io/en/articles/9819347-understanding-the-link-between-deals-and-budgets) ·
  [rollover hodin](https://help.productive.io/en/articles/9902502-retainer-hours-rollover)
- Teamwork — [retainer rozpočty (na projektu)](https://support.teamwork.com/projects/project-budgets/retainer-budgets) ·
  [Everything › Comments (agregace)](https://support.teamwork.com/projects/everything/everything-all-comments)
- Accelo — [project financials](https://www.accelo.com/solution/project-financials)
- Harvest — [fakturace z času](https://www.getharvest.com/time-tracking/invoicing-with-time-tracking)

> Statistiky rešerší: **1.** 6 úhlů · 27 zdrojů · 126 tvrzení · 25 ověřených (22 potvrzeno, 3 zamítnuto)
> · 110 agentů. **2.** 5 úhlů · 23 zdrojů · 108 tvrzení · 25 ověřených (23 potvrzeno, 2 zamítnuto) ·
> 105 agentů. Zamítnutá tvrzení obou rešerší jsou zohledněna v §9 a v textu.
