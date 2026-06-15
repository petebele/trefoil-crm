# Vize: Úkoly · Projekty · Poznámky (a kontextové prolínání)

🧭 **Znalostní báze:** [mapa](../README.md) · [roadmap](ROADMAP.md) · [datový model](DATOVY-MODEL.md) · [komponenty](KOMPONENTY.md) · [UI zásady](UI-ZASADY.md) · [slovník](SLOVNIK.md) · [sumář](SUMMARY.md) · [specs](specs/)

> **North‑star pro oblast „práce"** (úkoly, projekty, poznámky, notifikace, automatizace).
> Není to specifikace ke stavbě — je to **směr**, ze kterého budou čerpat jednotlivé specifikace
> (každá pořád prochází `spec → schválení → stavba`). Vychází z **průzkumu trhu** (Asana, ClickUp,
> monday, Linear, Trello + agenturní Accelo/Productive/Teamwork a CRM‑native Capsule/HubSpot)
> a z **konkrétních rozhodnutí Petra** (2026‑06‑14). Modul Úkoly v1 (agenda + Nástěnka + auto‑úkol
> „schval výkaz") je už postavený — viz `docs/specs/krok7-ukoly-nastenka.md`; tohle je kam dál.

---

## 1. Filozofie — CRM‑native, „kontextové prolínání"

- Úkoly, poznámky, komentáře, přílohy jsou **samostatné objekty**, které se **prolínají** napříč
  moduly. Když je u úkolu/poznámky označen **klient / projekt / osoba**, objeví se i u nich —
  i když byl záznam založený jinde (např. z osobní agendy).
- Každá entita (zákazník, projekt, osoba) má **lokální dashboard / feed**, který sdružuje **vše
  relevantní**: poznámky, komentáře, založené i vyřešené úkoly, přílohy, události.
- Cíl: **najdu to, co zrovna řeším, kontextově tam, kde to potřebuju.**
- **Odlišovač Trefoilu** vs. generické PM nástroje = kontext **klienta + času + fakturace** v jednom.
  Nesnažíme se být ClickUp; bereme z trhu selektivně to, co tomuhle slouží.

## 2. Úkoly — nezávislé i provázané

- Úkol jde založit a řešit **bez vazby na klienta** = osobní/týmová agenda (náhrada dnešního
  Trello + Google kalendář). To je výslovný požadavek.
- Zároveň lze úkol **provázat** s klientem, projektem, osobou (volitelné vazby, klidně víc naráz).
- **Pohledy nad stejnými daty** (definuješ úkol jednou, koukáš na něj víc způsoby):
  - **Teď:** **Agenda** (seznam, skupiny podle termínu / projektu) + **Kanban** (sloupce = stav,
    karty se přetahují). Kanban je sdílená komponenta — využije ji i Projekty/Zakázky a Obchod.
  - **Budoucnost:** **Kalendář** a **Časová osa / Gantt** s návaznostmi.

## 3. Úkol jako objekt (rozšíření — co úkol „umí")

- **Podúkoly / checklist** — s možností **vyčlenit podúkol do samostatného úkolu**.
- **Návaznosti (dependencies)** — „A blokuje B"; základ pro plánování, milníky, Gantt (viz §5b).
- **Opakování** — klasické (kalendářní) i **„od dokončení"** (další se založí X dní po splnění
  předchozího — sedí na pravidelnou správu klientů a retainery); **odložení (snooze)**.
- **Priorita** a **stavy/workflow** (viz §4).
- **Začátek + deadline**, **připomenutí**, **štítky**.
- **Přílohy, komentáře, @zmínky** (zmínka osoby/firmy/projektu = propojení + zdroj notifikace).
- **Custom pole** — architektura s nimi **počítá**, ale **zatím NEstavět**.
- **Šablony** — spíš na úrovni projektů (viz §5).

## 4. Stavy (= sloupce Kanbanu) a „vyřízeno"

- **Stavy = sloupce Kanbanu**, číselník **konfigurovatelný per uživatel** (přejmenovat, přebarvit,
  **přeřadit drag‑drop přímo na boardu**, přidat/odebrat) — do budoucna možnost **vynutit sdílené
  stavy per Organizaci**. Úkol má **právě jeden stav** (≠ štítky, kterých může mít víc). Výchozí sada:
  **Nový · Vyřizuji · Kontrola · Hotovo**.
- **První stav = povinný „Inbox/Zásobník" (`is_default`)** — sem padají **nové i nezařazené** úkoly
  („k roztřídění a naplánování"). **Nelze smazat**, lze přejmenovat. Na měsíčním boardu je
  **cross‑month** (vždy viditelný), ostatní sloupce ukazují vybraný měsíc; přetažení z Inboxu do
  sloupce = naplánování do měsíce. Když je jediný sloupec, slouží i jako sklad hotových.
- **„Vyřízeno" = stav „Hotovo" (jeden fakt, drží se v synchronu).** Stav s příznakem **`is_done`**
  (default „Hotovo") znamená vyřízeno; **zaškrtnutí checkboxu** úkol do „Hotovo" přesune (a `done=1`),
  **odškrtnutí** vrátí zpět. Checkbox a sloupec „Hotovo" jsou tak **dvě páčky na tutéž věc** →
  konzistence napříč pohledy (agenda × kanban); vyřízený úkol nikdy „nezůstane mezi nehotovými".
- **Archiv = příznak (`archived`), ne sloupec** (vzor Trello/Linear): hotové se jedním klikem
  („Archivovat hotové") nebo při uzávěrce měsíce **skryjí z boardu, ale zůstanou v historii** (lze
  obnovit). Detaily v `docs/specs/ukoly-v2-kanban.md`.
- **„Šablony stavů"** (à la ClickUp) — předdefinované sady stavů / podoby kanbanu (např. jiná sada
  pro projekty, jiná pro osobní agendu). **Budoucnost**, teď jen jedna výchozí sada.
- **Akceptace / delegace je SAMOSTATNÁ od stavů** — „čeká na přijetí / přijato" je **delegační
  příznak** úkolu (vědomé převzetí odpovědnosti přiřazeným), **ne sloupec boardu**. Stejně tak
  případné „k ověření" manažerem řešíme jako krok schválení, ne nutně jako extra sloupec. (Řeší se
  později, váže se na notifikace §8 a automatizace §7.)

## 5. Projektová vrstva (plánování)

- **Projekt** = **cíl** + skupina úkolů + **milníky** + odpovědní lidé + termíny. Volitelně navázaný
  na zákazníka (ale projekt může být i interní, bez klienta).
- **Milníky** = pojmenované **kontrolní body / výstupy (deliverables)**, volitelně s termínem a
  odpovědnou osobou. Příklad: *„Odeslané podklady pro kolegu"*.
- **Šablony projektů** — předdefinované úkoly (rovnou přiřazené kolegům), návaznosti, milníky a
  cíle. Příklad: *„Nabídka SEO služeb pro zákazníka"* → z šablony se založí projekt; úkoly v něm
  čekají na **akceptaci** přiřazenými kolegy. **Pro agenturu jedna z nejcennějších funkcí.**

### 5b. Jak modelovat milníky / handoffy / návaznosti (doporučení)

Tohle byl Petrův dotaz „jak to řešit". Návrh (a jak to dělají jiní):

- **Návaznost = obecná hrana „A blokuje B"** mezi položkami (úkol↔úkol, úkol↔milník, milník↔úkol).
  Dokud není A hotové, B je **„čeká / zamčené"** a nedá se spustit.
- **Milník = „brána" (gate) + výstup bez trvání.** Splní se buď **ručně** (osoba potvrdí „předáno"),
  nebo **automaticky**, když jsou hotové jeho vstupní úkoly. (Na časové ose je milník kosočtverec —
  bod, ne pruh.)
- **Handoff mezi lidmi = milník jako rozhraní:** výstup osoby A (např. *„Odeslané podklady"*) je
  milník, na kterém **závisí** úkol osoby B. Jakmile A milník splní → B dostane **notifikaci** a její
  úkol se **odemkne** (z „čeká" → „čeká na přijetí / připraveno"). Milník je tak přirozené místo
  zprávy *„je řada na tobě"*.
- **Doporučení pro start:** jen **jednoduchá závislost „blokuje/blokováno"** + **milník jako
  ručně/automaticky splnitelný bod s notifikací**. Kritickou cestu a 4 typy závislostí (ClickUp)
  **neřešit** — zbytečná váha pro malý tým.

## 6. Poznámky (nový modul/feature)

- **Záložka „Poznámky" u klienta** — **více poznámek** od **různých uživatelů**.
- Poznámka = objekt: **autor, čas, typ/charakter** (číselník — např. interní, z jednání, telefonát,
  nápad…), **text** v příjemném editoru (inspirace Bear — čistota a rychlost psaní, v našich
  komponentách), **přílohy, komentáře, @zmínky**.
- **Vazby:** poznámku lze přiřadit k **zákazníkovi, projektu i osobě** (klidně víc vazeb naráz).
- **Z poznámky vytvořit úkol** („udělat z toho úkol" — převede text/část na úkol s vazbou).
- Poznámky se objevují v **lokálních dashboardech** dotčených entit (§9).
- **Sdílí infrastrukturu** s komentáři a přílohami → viz §9 (jeden „obsahový" základ).

## 7. Automatizace (nadstavba — architektura s ní počítá)

- Cílový model: **událostní jádro** — **spouštěč (event) → podmínka → akce**. Dnešní auto‑úkol
  „schval výkaz" je první vlaštovka; postupně **zobecnit** do konfigurovatelné nadstavby.
- Příklady, které chce Petr umět:
  - vyřízení úkolu → automaticky **Hotovo** (přesun do kanban sloupce hotových),
  - dokončení úkolu pracovníkem → stav **„k ověření"** + **notifikace** manažerovi,
  - změna stavu / blížící se termín → **notifikace / připomenutí**.
- **Architektonický požadavek:** oddělit *„co se stalo"* (events) od *„co se má stát"* (pravidla),
  ať jde nadstavbu přidat **bez přepisování modulů**. Moduly publikují události; pravidla na ně reagují.

## 8. Notifikace

- Systém notifikací typu *„máš 3 úkoly k přijetí, 4 nové komentáře, tenhle klient má narozeniny…"*.
- **Zdroje:** přiřazení/akceptace úkolu, **@zmínky**, blížící se / po termínu, **milník odemkl můj
  úkol**, **čeká na mé schválení/ověření**, události klienta (narozeniny apod.).
- **Kooperace s automatizacemi:** konkrétní automatizace **může (ale nemusí)** vyvolat notifikaci —
  podle svého nastavení. Notifikace je tedy jedna z možných **akcí** pravidla (§7).
- Napojení na už plánovaný **Inbox „Vyžaduje moji pozornost"** (ROADMAP) + **realtime (SSE)**.

## 9. Lokální dashboardy / kontextové prolínání (sjednocující princip)

- Každá entita (zákazník, projekt, osoba) má **feed/agendu**, která sdružuje **vše relevantní**:
  poznámky, komentáře, úkoly (založené / akceptované / vyřešené), přílohy, události.
- Technicky: **jeden obsahový/aktivitní základ** (poznámky · komentáře · přílohy · události se
  společnými vazbami na entity), který se **zobrazuje kontextově** u různých entit. Tím se „prolínání"
  z §1 stane levné — nepíše se zvlášť pro každý modul.

## 10. Co vědomě NEřešit teď

Gantt s kritickou cestou · 4 typy závislostí · portfolia · neomezená custom pole · plné AI ·
obousměrná integrace kalendáře. (Inspirace ano, stavba zatím ne.)

> **Kalendář — vlastní vs. integrace:** doporučení = začít **vlastním** pohledem (úkoly podle termínu,
> levné, bez závislosti); **obousměrnou integraci** (Google Calendar) řešit později jako samostatný
> větší kus (auth + synchronizace + řešení konfliktů).

## 11. Doporučené fázování (návrh; ladí s ROADMAP)

- **A) Úkoly — druhý pohled Kanban + prohloubení objektu:** priorita, stavy/workflow (§4),
  podúkoly/checklist, štítky, začátek/deadline. Sdílená kanban komponenta (využije i Projekty).
- **B) Poznámky** (záložka u klienta) + **jednotný obsahový/komentářový základ** (§9) + **převod na úkol**.
- **C) Projekty/Zakázky:** cíl, milníky, návaznosti „blokuje/blokováno" (§5b), **šablony projektů**.
- **D) Automatizace nadstavba** (zobecnění auto‑úkolů) + **Notifikace** + **lokální dashboardy**.
- **E) Budoucnost:** Kalendář, Časová osa / Gantt, custom pole, AI‑asistence.

> Pořadí A–E je návrh, ne závazek — konkrétní krok vždy upřesní jeho specifikace ke schválení.
