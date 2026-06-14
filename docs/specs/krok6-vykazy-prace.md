# Specifikace modulu: Krok 6 — Výkazy práce

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [ostatní specs](./)

> Uzavírá peněžní smyčku Kroku 5: vykázaný čas se podle režimu služby buď odečítá
> z paušálu hodin, účtuje zvlášť, nebo neúčtuje — a doplní chybějící část měsíčního
> vyúčtování („dle výkazů"). Model viz `DATOVY-MODEL.md` (work_records).

## 1. Účel

Kdokoli z týmu rychle vykáže odpracovaný čas na zákazníka a jeho službu. Záznam má
dohledatelné ID, prochází **schválením** odpovědnou osobou a promítá se do hodin
(z paušálu zbývá X h) i peněz (vícepráce × sazba). Pracovník vidí svůj měsíční výkaz.

## 2. Obrazovky

1. **Velký modál „Vykázat práci"** — jediné místo zadání, dostupné:
   - z horní lišty: položka v menu **„Přidat +" → Výkaz práce** (vždy po ruce),
   - z detailu zákazníka (záložka Služby): akce **„Vykázat práci"** v nadpisu —
     zákazník předvyplněný.

   Pole: zákazník (našeptávač) → **služba** (jen jeho běžící služby; závislé pole),
   popis úkonu, poznámka (volitelná), **čas** (hodiny:minuty), datum (default dnes),
   **účtování** — předvyplní se podle režimu služby (paušál → z paušálu hodin,
   samostatná fakturace → účtovat zvlášť, předplatné → neúčtovat), jde ručně přepnout.

2. **Detail zákazníka → záložka Služby** — nový blok **„Výkazy"** pod službami:
   přepínač měsíce, souhrn nahoře (vykázáno celkem; **z paušálu čerpáno/zbývá**;
   přečerpání zvýrazněné), seznam výkazů: datum · pracovník · služba · popis · čas ·
   chip účtování · stav (Čeká na schválení / Schváleno). Hover akce: Upravit ·
   Smazat (jen autor, dokud není schváleno) · **Schválit** (odpovědná osoba/admin).
   Blok **„Měsíčně celkem"** se rozšíří: vícepráce = schválené hodiny „zvlášť"
   + přečerpání paušálu, × sazba → celková částka měsíce už není jen pevná.

3. **Modul Výkazy (ikona v liště, zapínatelný)** — stránka `/vykazy`:
   - záložka **Můj výkaz**: moje záznamy po měsících + součty hodin (podklad odměn),
   - záložka **Schvalování** (odpovědná osoba/admin): čekající výkazy „mých" zákazníků,
     hromadně Schválit,
   - záložka **Přehled** (admin): všichni pracovníci × měsíc, součty.

## 3. Pole a data

- Tabulka **`work_records`**: `client_id`, `service_id`, `worker_id`, `description`,
  `note`, `minutes`, `performed_at`, **`billing`** (retainer_hours / billed / free),
  `status` (pending/approved), `approved_by_id`, `approved_at`, `created_at`.
- Každý záznam má ID (#8 znaků v Historii), zapisuje se do `events` zákazníka
  → realtime všude.
- Hodiny „z paušálu" čerpají měsíční paušál zákazníka dle `performed_at`;
  rollover (zaškrtávátko z Kroku 5) převádí nevyčerpané hodiny do dalšího měsíce.

## 4. Pravidla a stavy

- Výkaz může zadat **kdokoli z týmu** (i na cizího zákazníka).
- **Upravit/smazat** smí autor, jen dokud záznam **není schválený**; potom jen admin.
- **Schvaluje** odpovědná osoba zákazníka nebo admin; schválením se záznam zamkne
  a začne se počítat do čerpání/fakturace. (Auto-úkol „schvalte výkazy" přijde
  s modulem Úkoly.)
- Přečerpání paušálu se nezakazuje — viditelně se označí a počítá jako vícepráce.
- Validace: zákazník, služba, popis a čas povinné; čas > 0.

## 5. Akce (kontextové)

- Lišta: „Přidat +" → Výkaz práce. Detail zákazníka: „Vykázat práci" v nadpisu bloku.
- Řádek výkazu: Upravit · Smazat · Schválit (dle práv, hover, textové).

## 6. Prázdné stavy

- Blok Výkazy: „Tento měsíc zatím nikdo nevykázal žádnou práci." + akce Vykázat práci.
- Můj výkaz: „Zatím jsi nevykázal žádnou práci."
- Schvalování: „Nic nečeká na schválení. 🎉"

## 7. Hotovo, když… (checklist)

- [ ] Výkaz jde zadat z lišty i z detailu zákazníka; služba se nabízí jen běžící
- [ ] Účtování se předvyplní dle režimu služby a jde přepnout
- [ ] Blok Výkazy ukazuje měsíc, čerpání paušálu (zbývá/přečerpáno) a seznam
- [ ] Měsíčně celkem zahrnuje schválené vícepráce × sazba
- [ ] Schválení zamkne záznam; autor needituje schválené; práva dle rolí
- [ ] /vykazy: Můj výkaz, Schvalování, Přehled (admin) — modul zapínatelný
- [ ] Vše v Historii s ID + realtime; typecheck + E2E (TestE2E data, úklid)
