# Specifikace: Notifikace — v1

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [sumář](../SUMMARY.md) · [architektura](../ARCHITECTURE.md) · [komponenty](../KOMPONENTY.md) · [datový model](../DATOVY-MODEL.md) · [UI zásady](../UI-ZASADY.md) · [komentáře](komentare-v1.md) · [ostatní specs](./)

> ✅ **POSTAVENO (2026-06-19, dávka M).** Schváleno Petrem. Implementace: tabulka `notifications`,
> doména `src/domain/notifications.ts`, UI `src/web/notifikace.tsx` (zvonek v `layout.tsx`),
> katalog KOMPONENTY §30. Fáze 2 (nastavení „co notifikovat", komentáře/@zmínky, digest) zůstává otevřená.

## 1. Účel
Aby člověk **nepřišel o nic, co se ho týká**, aniž by musel obcházet všechny obrazovky. Manažer schválí/vrátí výkaz → pracovník to **hned vidí u zvonku**; přijde nový výkaz ke schválení → schvalovatel je upozorněn; někdo mi přidělí úkol → vím o tom. Žádné e‑maily, vše uvnitř CRM, v reálném čase.

**Není to „modul" v technickém smyslu** (nezapíná se per Organizace jako Zákazníci/Výkazy). Je to **trvalá součást aplikace pro každého přihlášeného** — stejně jako Nástěnka a Administrace. Proto **nepřibývá do registru modulů** ani do lišty jako ikona stránky; žije jako **zvonek vpravo nahoře**.

## 2. Obrazovky

**A) Zvonek v horním panelu** (mezi tlačítkem „Přidat" a uživatelským menu):
- Ikona zvonku `IconBell` jako `.icon-btn`.
- **Odznak počtu** nepřečtených (malá bublina s číslem, akcentová barva; přes ~9 → „9+"). Když je 0 → bez odznaku. Odznak je **živá zóna** (`hx-trigger="live-update from:body"`) — naskočí sám, jakmile přijde nová notifikace, bez obnovy stránky.

**B) Rozbalovací panel** (po kliknutí na zvonek — vzor `.menu align-right`, jako „Přidat"):
- Hlavička: **„Oznámení"** + vpravo akce **„Označit vše jako přečtené"** (jen když je co).
- **Seznam** (nejnovější nahoře, ~10): u každého řádku
  - ikonka/avatar podle typu, **text** („Ivana vrátila výkaz k přepracování"), **kontext** (název úkonu / klienta), **relativní čas** („před 2 h“),
  - **nepřečtené** = jemně zvýrazněné + tečka vlevo; přečtené = ztlumené.
  - Klik na řádek → **přejde k věci** (výkaz/úkol) a označí ji jako přečtenou.
- **Seskupování stejného typu** (přání Petra): nepřečtená oznámení **téhož typu bez vlastního detailu** se sloučí do **jednoho řádku s počtem** vedoucího na společnou stránku — např. „**6 výkazů čeká na schválení**" → schvalovací seznam. Naopak **detailní** oznámení (vrácení/zamítnutí s instrukcemi, přidělený úkol) **zůstávají jednotlivě** a jen se vizuálně odliší — je potřeba si je přečíst po jednom. Které typy se slučují, určuje příznak `aggregatable` u typu.
- Patička: **„Zobrazit vše"** → samostatná stránka `/notifikace` (plný seznam s historií; ve v1 stačí jednoduchý výpis, případně doplnit ve v1.1).
- **Prázdný stav:** „Zatím nemáš žádná oznámení." (bez akce — je to pasivní schránka).

Mockup: doplnit do [mockupy/komponenty.html](../../mockupy/komponenty.html) (nový vzor „Notifikace — zvonek + panel") před/při stavbě.

## 3. Pole a data
Nová tabulka **`notifications`** (1 řádek = 1 oznámení pro 1 příjemce):

| Pole | Význam |
|---|---|
| `id`, `tenant_id` | identita, Organizace |
| `recipient_id` | **komu** je oznámení určeno (persons.id) |
| `actor_id` | kdo akci vyvolal (persons.id, nullable) |
| `type` | druh: `work_record_approved` / `_returned` / `_rejected` / `work_record_pending` / `task_assigned` … (rozšiřitelné) |
| `title` | lidský titulek („Výkaz vrácen k přepracování") |
| `body` | krátký detail (název úkonu, výňatek instrukcí) — nullable |
| `entity_kind`, `entity_id` | k čemu se váže (`work_record`, `task`, `client`…) |
| `link` | kam vede kliknutí (např. `/vykazy?...`) |
| `read_at` | čas přečtení; `null` = nepřečteno |
| `created_at` | vznik |

Vztah k tabulce **`events`** (Historie): `events` je *neadresný* log „co se stalo" (feed). `notifications` je *adresná schránka* „co se týká tebe" se stavem přečteno. Liší se účelem — proto vlastní tabulka, ne rozšíření events.

**Číselníky:** žádné nové Seznamy ve v1 (typy jsou pevné v kódu). Nastavení „co notifikovat" (číselník/volby) až ve fázi 2.

## 4. Pravidla a stavy
- **Stav:** nepřečteno (`read_at = null`) → přečteno (`read_at` = čas). **Nic se nemaže** — přečtení je měkký stav, oznámení zůstává v historii. Tvrdé mazání jen admin (úklid).
- **Nikdy neupozorňuj sám sebe** — když `actor_id === recipient_id`, oznámení nevznikne (např. admin schválí vlastní výkaz; přiřadím úkol sám sobě).
- **Realtime:** vznik oznámení → `broadcast` → odznak u příjemce se sám aktualizuje (každé okno si počet načítá pro svého přihlášeného).
- **Seskupování (`aggregatable`):** typy bez vlastního detailu (`work_record_pending` = čeká ke schválení, `work_record_approved` = schváleno) se v panelu slučují do jednoho řádku s počtem a vedou na společnou stránku; klik označí celou skupinu přečtenou. Detailní typy (`work_record_returned`, `work_record_rejected`, `task_assigned`) se **neslučují**.
- **Kdo dostává co (producenti ve v1)** — napojeno na už hotové akce:
  | Událost | Příjemce |
  |---|---|
  | Výkaz **schválen** | autor výkazu |
  | Výkaz **vrácen k přepracování** | autor výkazu (+ instrukce v `body`) |
  | Výkaz **zamítnut** | autor výkazu (+ důvod v `body`) |
  | **Nový výkaz čeká** na schválení | schvalovatel (vlastník klienta; fallback admini) |
  | **Úkol přiřazen** někomu jiným | nabytý řešitel |

  (Místa u výkazů už mají značky `TODO(notifikace D)` — sem se napojí.)
- **Práva:** každý vidí jen **svoje** oznámení (`recipient_id = já`). Označit přečtené smí jen příjemce.

## 5. Akce (kontextové)
- **Klik na oznámení** → otevře dotčenou věc + označí přečtené (route `…/otevrit` → mark read → redirect na `link`).
- **„Označit vše jako přečtené"** (hlavička panelu) → `read_at` u všech mých nepřečtených.
- (fáze 2) **Nastavení notifikací** — co všechno chci dostávat (per uživatel).

## 6. Prázdné stavy
- Panel bez oznámení: **„Zatím nemáš žádná oznámení."**
- Stránka `/notifikace` bez záznamů: **„Zatím tu nic není. Až se objeví něco, co se tě týká, najdeš to tady."**

## 7. Mimo rozsah v1 (fáze 2+)
- **Nastavení „co notifikovat"** (přepínače per uživatel) — připraveno datově (typy), UI později.
- Notifikace pro **komentáře / @zmínky** (viz [komentáře](komentare-v1.md)) — přibudou jako další `type`.
- E‑mailový / souhrnný (digest) kanál. Ve v1 jen in‑app.
- **Pokročilé** skupinování napříč typy a chytré shrnutí („Ivana ti vrátila 3 výkazy"). Ve v1 jen prosté slučování stejného `aggregatable` typu.

## 8. Hotovo, když… (checklist)
- [ ] Migrace `notifications` + zápis do [DATOVY-MODEL.md](../DATOVY-MODEL.md).
- [ ] Doménová vrstva: `notify()`, `listForRecipient()`, `unreadCount()`, `markRead()`, `markAllRead()`.
- [ ] Zvonek + živý odznak v `layout.tsx`; panel s výpisem; prázdný stav; `IconBell` do `icons.tsx`.
- [ ] Napojení 5 producentů (4× výkazy na značky `TODO(notifikace D)` + přiřazení úkolu).
- [ ] Klik označí přečtené a přejde k věci; „Označit vše jako přečtené".
- [ ] Realtime: nové oznámení rozsvítí odznak bez obnovy stránky.
- [ ] i18n: české i anglické texty (`src/i18n/en.ts`).
- [ ] Nový vzor do [KOMPONENTY.md](../KOMPONENTY.md) + [mockupy/komponenty.html](../../mockupy/komponenty.html).
- [ ] `pnpm typecheck` zelený; ověřeno v prohlížeči (víc oken → realtime).
