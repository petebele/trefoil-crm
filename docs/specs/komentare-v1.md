# Specifikace (NÁVRH): Komentáře u prvků — v1

🧭 **Znalostní báze:** [mapa](../../README.md) · [roadmap](../ROADMAP.md) · [sumář](../SUMMARY.md) · [komponenty](../KOMPONENTY.md) · [datový model](../DATOVY-MODEL.md) · [poznámky](poznamky.md) · [Inbox](nastenka-inbox-v1.md) · [ostatní specs](./)

> ⏳ **Forward‑looking — NESTAVĚT bez schválení.** Zachycený záměr (Petr, schvalování výkazů), aby se
> neztratil. Doplnit a schválit, teprve pak stavět.

## 1. Proč
Záznamy mají mít **kontext a vazby** (princip „nic se nemaže"). K mnoha prvkům dnes umíme připnout
**poznámku** (samostatný formátovaný obsah). Chybí ale **krátká konverzace u konkrétního prvku/události** —
*komentáře*. Typický případ: manažer **zamítne výkaz** s důvodem; pracovník chce **rovnou u toho zareagovat**
(„proč? tohle jsme se přece domlouvali jinak") bez e‑mailů a bez ztráty stopy.

## 2. Poznámka vs. komentář (rozlišení)
- **Poznámka** = samostatný objekt s formátovaným tělem; spíš „dokument" (zápis ze schůzky, brief). Viz [poznámky](poznamky.md).
- **Komentář** = **krátká reakce navázaná na konkrétní entitu/událost**, ve **vlákně** (thread), s autorem a časem;
  cílem je **dialog**, ne dokument. Prostý text (+ později @zmínky).

## 3. Kam se připínají (entity)
Obecný mechanismus „komentář k čemukoli" — stejný vzor jako `note_links`:
výkaz, úkol, poznámka, (později) projekt/příležitost, a také **k události** (např. „zamítnutí výkazu").
První využití: **vlákno u výkazu** — u zamítnutého/vráceného výkazu se pracovník ptá zpět.

## 4. Náčrt dat (k doladění)
- `comments`: `id, tenant_id, entity_kind, entity_id, parent_id (vlákno), body, author_id, created_at, edited_at, deleted_at`.
- Měkké mazání (princip): autor smí svůj komentář „stáhnout" (skrýt), admin maže natvrdo. Historie zůstává.
- Realtime: nový komentář = `logEvent` + živá zóna; (později) notifikace pro dotčené (autor záznamu, @zmínění).

## 5. UI (náčrt)
- Pod prvkem **vlákno**: avatar · jméno · čas · text; pole „Napsat komentář…"; reakce/odpověď.
- U **rozhodnutí o výkazu** (zamítnutí/vrácení): pod důvodem tlačítko **„Zeptat se / komentovat"**.
- Nový vzor do [KOMPONENTY.md](../KOMPONENTY.md) (komentářové vlákno) — navrhnout před stavbou.

## 6. Závislosti
- **Notifikace** (modul D) — aby dotčený o komentáři věděl.
- **@zmínky** — adresné upozornění (roadmapa).

## 7. Otevřené otázky
1. Komentáře jen text, nebo i lehké formátování? (návrh: text + odkazy, bez bohatého editoru)
2. Vlákna plochá, nebo zanořená? (návrh: 1 úroveň odpovědí)
3. Sdílí komentář a poznámka společnou „aktivitu" ve feedu? (návrh: ano, oboje jde do dění)
