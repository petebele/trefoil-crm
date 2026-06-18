# Specifikace: Detail / dashboard služby v1

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [datový model](../DATOVY-MODEL.md) · [komponenty](../KOMPONENTY.md) · [UI zásady](../UI-ZASADY.md) · [slovník](../SLOVNIK.md) · [vize feedu](../VIZE-feed-a-prilezitosti.md) · [ostatní specs](./)

> Krátký dokument ke **schválení PŘED stavbou**. Naplňuje rozhodnutí z [VIZE — Feed](../VIZE-feed-a-prilezitosti.md):
> **služba u klienta = základní stavební kámen („mini-projekt")** — má dostat vlastní stránku, kde je
> vidět „vše, co se u služby dělo, kdo do ní zasáhl, jaká tam padla poznámka".

## 1. Účel
Samostatná stránka jedné **služby u klienta** (např. „PPC u firmy Acme"): na jednom místě její nastavení,
**vykázaná práce**, **poznámky** a (později) **rozpočet/čerpání**. Slouží specialistovi i manažerovi
k přehledu „co se na téhle službě děje".

## 2. Obrazovka
Nová stránka **`/sluzby/:id`** (samostatná, ne záložka). Přístup přes modul `zakaznici`. Na záložce
**Služby** u firmy se řádek služby stane **klikací → detail služby**. Zpět → `/firmy/:clientId?tab=sluzby`.

Slovní wireframe:
```
‹ Zpět na firmu Acme s.r.o.
┌─ PPC kampaně · Acme s.r.o. ───────────────────────── [⋯ Upravit] ┐
│  [Paušál hodin] [Aktivní]   Sazba 1 200 Kč/h · Odpovědná: Jana N. │
│  Detail: „Google Ads + sklik"   Popis: …                          │
├───────────────────────────────────────────────────────────────────┤
│  Vykázaná práce (tento měsíc · 4 h 30 m)        [Vykázat práci]    │
│   3. 6.  Jana N.  Optimalizace kampaní      1 h 30 m  · z paušálu  │
│   2. 6.  Petr B.  Týdenní report            1 h      · z paušálu   │
│   …                                                                │
├───────────────────────────────────────────────────────────────────┤
│  Poznámky                                       [Nová poznámka]    │
│   📝 Jana N. · 1. 6. — Klient chce důraz na výkon, ne brand.       │
└───────────────────────────────────────────────────────────────────┘
```

- **Hlavička:** název služby + firma (odkaz), chip **režim** (paušál/předplatné/jednorázově) + chip
  **stav** (aktivní/pozastavená/ukončená), **sazba**/měsíční částka, **odpovědná osoba**, detail/popis.
  V ⋯ menu **Upravit službu** / **Pozastavit/Ukončit** (přesune sem stávající akce ze záložky Služby).
- **Vykázaná práce:** výkazy této služby (datum · pracovník · popis · čas · režim účtování), součet času;
  akce **Vykázat práci** (předvyplní službu). Měsíc volitelně přepínatelný (default aktuální).
- **Poznámky:** poznámky **navázané na službu** + **Nová poznámka** (založí se s vazbou na službu).
  Stejná komponenta jako u firmy/osoby.

## 3. Pole a data
- Služba = `services` (už existuje): `getClientService()` vrací vše + `label` (katalog) + `owner_name`.
- **Výkazy:** nová funkce `listForService(tenantId, serviceId, month?)` nad `work_records`
  (`service_id = :id`). Výkaz už **má `service_id`** — žádná změna schématu.
- **Poznámky na službě:** `note_links` už umí libovolný `entity_kind` → použijeme **`entity_kind = 'service'`**.
  Rozšíří se: typ subjektu v editoru poznámky (`'client' | 'person' | 'service'`) a `NotesTab` se použije
  i pro službu. Bez změny tabulek (jen nová hodnota v `entity_kind`).

## 4. Pravidla a stavy
- Stav služby (aktivní/pozastavená/ukončená) a úpravy = stávající logika (`setClientServiceStatus`,
  `updateClientService`) — jen přesunuté/dostupné z detailu.
- **Realtime:** stránka (nebo její střední část) je živá zóna (`live-update from:body`).
- Práva: kdo vidí firmu, vidí i její službu (RBAC detailně později).

## 5. Akce (kontextové)
- V hlavičce **⋯**: Upravit službu · Pozastavit / Obnovit · Ukončit.
- **Vykázat práci** (u sekce Výkazy) — modál výkazu předvyplněný službou + klientem.
- **Nová poznámka** (u sekce Poznámky) — modál poznámky s vazbou na službu.

## 6. Prázdné stavy
- Bez výkazů: „**U této služby zatím není vykázaná žádná práce.**" + **Vykázat práci**.
- Bez poznámek: „**Zatím žádná poznámka k této službě.**" + **Napsat poznámku**.

## 7. Hotovo, když… (checklist)
- [ ] `/sluzby/:id` zobrazí hlavičku služby (název, firma, režim, stav, sazba, odpovědná, detail/popis).
- [ ] Řádek služby v záložce **Služby** vede na detail; zpět na firmu funguje.
- [ ] **Výkazy** služby (chronologicky + součet); **Vykázat práci** předvyplní službu.
- [ ] **Poznámky** služby + **Nová poznámka** s vazbou `entity_kind='service'`.
- [ ] ⋯ akce (upravit/pozastavit/ukončit) fungují z detailu; realtime překreslení.
- [ ] `pnpm typecheck` zelený; server odpovídá; UI dle zásad (chipy, prázdné stavy, mobil, aria).

## 8. Stav rozšíření
- **Sloučený feed „Dění u služby" (HOTOVO 2026-06-18):** Výkazy + Poznámky jsou na detailu v **jednom
  chronologickém proudu** (po měsících, přepínač), místo dvou oddělených boxů. Postaveno ze
  `work_records` (service_id) + `notes` (service) — bez `events`. **Systémové události** (změny stavu
  apod.) ve feedu zatím nejsou — vyžadovalo by vázat `events` na službu (další krok).
- **Rozpočet služby + burn-up (HOTOVO 2026-06-18):** služba (retainer) má **alokaci hodin z klientského
  paušálu** (`budget_hours`), **checkbox „povolit přečerpání"** (`allow_overage`) a **práh upozornění**
  (`alert_pct`, default 80). Detail ukazuje **burn-up** (vyčerpáno z X h, %, lišta `.progress`, chip
  „blíží se limitu"/„přečerpáno") + řádek **„z paušálu klienta alokováno celkem A z B h"**. Čerpání =
  vykázané hodiny „z paušálu" v měsíci. **Soft** (neblokuje zápis, jen upozorňuje — viz
  [VIZE §7.5 + Přečerpání](../VIZE-feed-a-prilezitosti.md)); cross-service „borrow" a schvalování = v2.

## 9. Otevřené otázky
1. Zahrnout **Poznámky na službě** do v1 (doporučuju ano — je to jádro „jaká tam padla poznámka"),
   nebo až v1.1? Vyžaduje drobné rozšíření editoru o subjekt `service`.
2. **Měsíc u výkazů** na detailu: jen aktuální měsíc, nebo přepínač měsíců (jako v záložce Služby)?
   (Doporučuju přepínač pro konzistenci.)
