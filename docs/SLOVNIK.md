# Slovník pojmů — Trefoil CRM v2

🧭 **Znalostní báze:** [mapa](../README.md) · [datový model](DATOVY-MODEL.md) · [UI zásady](UI-ZASADY.md) · [komponenty](KOMPONENTY.md) · [architektura](../ARCHITECTURE.md) · [sumář](../SUMMARY.md) · [roadmap](../ROADMAP.md) · [pravidla](../CLAUDE.md)

> Jednotná terminologie (převzato z v1, doplněno pro v2). Aplikace mluví **jednoznačně**:
> nepoužíváme „zákazník" jako název typu záznamu, ale konkrétně **Firma** nebo **Osoba**.

## Základní pojmy

| Pojem | Význam | Pozn. |
|---|---|---|
| **Firma** | Zákazník typu společnost (název, IČO, web, stav…). | Může mít přiřazené **Osoby** (kontakty). |
| **Osoba** | Člověk. Buď samostatný zákazník (fyzická osoba), **nebo** kontakt přiřazený k Firmě. | **K Osobě se nepřiřazují další Osoby.** Osoba se přiřazuje **jen k Firmám.** |
| **Kontakt** | Osoba ve vztahu k Firmě (= role Osoby u Firmy, ne samostatný typ). | „Jednatel v Borovec-elektro.cz" |
| **Zákazník** | Zastřešující neformální pojem pro Firmy i Osoby. | Sekce **Zákazníci** obsahuje obojí + filtr. |
| **Kolega** | Člen týmu Trefoil (Osoba s přihlášením a rolí). | Spravuje se v **Administraci**, ne v Zákaznících. |
| **Kontaktní údaj** | Telefon / e-mail / … u Osoby nebo Firmy. | Vícenásobné; mohou být vázané na konkrétní Firmu (osobní vs. firemní mobil). |
| **Služba** | Co u nás Firma/Osoba má aktivního (z Katalogu služeb): stav, odpovědný a **orientační měsíční spend**. Součet spendů = celkový orientační spend zákazníka. | SEO, PPC, sociální sítě, feedy… |
| **Rozpočet hodin** | Domluvený měsíční počet hodin u zákazníka. Schválené výkazy se z něj odečítají (vidíš „nastaveno / zbývá"); bez rozpočtu se hodiny kumulují k fakturaci. | Zadávají jen manažeři. |
| **Výkaz práce** (záznam práce) | Úkon odvedený pro zákazníka (volitelně ke službě): popis, detailnější poznámka, strávený čas, pracovník, datum, dohledatelné ID. Zadává kdokoli, **schvaluje odpovědná osoba zákazníka** (založení výkazu jí automaticky vytvoří úkol). | Rychlé zadání z lišty, Nástěnky i detailu zákazníka. |
| **Manažer** | Kdo smí nastavovat rozpočty/spendy a schvaluje výkazy svých zákazníků. | Do zavedení rolí (RBAC) = admin; odpovědná osoba = manažer daného zákazníka. |
| **Zakázka** | Delivery projekt navázaný na zákazníka (cíl, stav, milníky, odpovědný). | Kanban stavů. |
| **Milník** | Dílčí cíl zakázky s termínem a odškrtnutím. | |
| **Příležitost** | Potenciální obchod (deal) ve fázích pipeline, s hodnotou. | Sekce **Obchod**. |
| **Aktivita** | Záznam komunikace v timeline: 📝 poznámka, ✉️ e-mail, 📞 hovor, 👥 schůzka. | Vždy u zákazníka; autor + čas. |
| **Úkol** | Co je potřeba udělat; má **kategorii** (barevný chip), termín, přiřazeného kolegu. | Kategorie: Hovor, E-mail, Schůzka, Follow-up… (konfigurovatelný Seznam). |
| **Štítek** | Segmentační nálepka na Firmě/Osobě (malý šedý chip). | Konfigurovatelný Seznam. |
| **Seznam** | Konfigurovatelný číselník (Katalog služeb, Štítky, Stavy, Kategorie úkolů, Fáze obchodu…). | Spravuje se v Administraci. |
| **Role** | Pojmenovaná sada práv (Admin, Moderátor, Člen, Zákazník). | Osoba může mít víc rolí. |
| **Nástěnka** | Úvodní stránka po přihlášení: pozdrav, naposledy zobrazené, aktivita, úkoly (Po termínu / Dnes), kalendář. | Nahrazuje v1 stránku „Dnes". Není modul — je vždy. |
| **Organizace** | Společnost, která CRM používá (prostor, ve kterém pracuje tým — pro nás Trefoil). Zakládá ji první uživatel (stává se adminem), kolegové se do ní zvou. | **Nezaměňovat s Firmou** (= zákazník). |
| **Modul** | Zapínatelná část aplikace (Zákazníci, Úkoly, Zakázky, Obchod…). Admin v Administraci určuje, které moduly jsou zapnuté — platí pro celou Organizaci. | Nástěnka a Administrace nejsou moduly. |

## Pravidla modelu

1. **V Zákaznících se přidává buď Osoba, nebo Firma.** Přehled zobrazuje oba typy s filtrem (Vše / Firmy / Osoby).
2. **Osoba se přiřazuje jen k Firmám** (ne Osoba k Osobě).
3. **Kolegové** se Zákazníků netýkají — jsou v Administraci.
4. Jedna Osoba může být **zároveň kontakt u klienta i Kolega** (více rolí).
5. Tlačítko **„Přidat +"** v horní liště: Nová osoba/kontakt · Nová firma · Nový úkol (+ později zakázka, příležitost).

## Mapování UI ↔ kód

| UI (lidsky) | Kód |
|---|---|
| Nástěnka | dashboard |
| Zákazníci (Firma/Osoba) | clients (kind company/person) / persons |
| Lidé / Kontakty | persons + person_clients |
| Služby | services (+ list service_catalog) |
| Zakázky / Milníky | engagements / milestones |
| Obchod / Příležitosti | deals |
| Komunikace / Aktivita | activities |
| Úkoly / Kategorie | tasks (+ list task_categories) |
| Štítky | entity_list_items (list client_tags) |
| Seznamy | lists / list_items |
| Role / Práva | roles / permissions |
