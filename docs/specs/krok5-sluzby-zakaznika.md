# Specifikace modulu: Krok 5 — Služby u zákazníka

> Nejdůležitější obrazovka účtování: tady se rozhoduje, jak se klientovi počítají
> peníze. Od správného nastavení se odvíjí výkazy práce (Krok 6) i měsíční report.
> Vychází z fakturačního modelu v `DATOVY-MODEL.md` (hybrid, vzor Accelo/Productive).

## 1. Účel

U každého zákazníka evidovat **přidělené služby** (co pro něj děláme, jak se účtují,
kdo je za ně odpovědný), volitelný **paušál hodin** a vidět **orientační měsíční
spend** zákazníka. Vykázaná práce (Krok 6) se pak sama správně zaúčtuje.

## 2. Obrazovky

**Detail zákazníka → záložka Služby** (dnes „Připravujeme") — tři bloky pod sebou:

1. **Paušál hodin** (volitelný, jeden na zákazníka — kryje všechny jeho služby
   v režimu „paušál hodin"):
   - nevyplněný → jen podtržený odkaz „Nastavit paušál hodin" pod nadpisem
     (vzor skrytých akcí);
   - vyplněný → **hodiny/měsíc**, **cena paušálu (Kč/měs)**, zaškrtávátko
     **převádět nevyčerpané hodiny**; zobrazeno textově s ikonkou tužky
     (malý panel pro úpravu, kotvený k ikoně levým horním rohem).
2. **Služby** — řádky: název služby, chip režimu účtování, sazba (Kč/h) /
   u předplatného částka (Kč/měs), odpovědná osoba za službu, stav
   (aktivní/pozastavená/ukončená). Hover akce: Upravit · Pozastavit/Obnovit ·
   Ukončit. Nad seznamem podtržený odkaz **„Přidělit službu"**.
3. **Měsíčně celkem** — orientační spend: Σ částek předplatných + cena paušálu
   (vykázaná práce „samostatně" se dopočítá až z výkazů — Krok 6). Jedno číslo
   s rozpisem položek.

**Přidělení/úprava služby** — **jeden společný formulář** (malý panel kotvený k odkazu;
úprava jen předvyplní dřívější hodnoty) s poli:

- služba (výběr z aktivních položek katalogu; výběr **propíše výchozí režim a sazbu**
  do polí níže a u režimu ukáže „(výchozí)" — uživatel nesmí být nucen znát katalog),
- upřesnění služby (odliší **opakovaná přidělení téže služby** — povoleno),
- režim účtování (předvybraný výchozí z katalogu),
- sazba Kč/h (jen u paušálu/samostatné fakturace — **závislá pole se zobrazují podle
  zvoleného režimu**),
- částka předplatného Kč/měs (jen u Předplatného, volitelná),
- popis služby (co v rámci služby pro klienta děláme),
- odpovědná osoba za službu (předvyplněná odpovědnou osobou zákazníka, jde změnit
  — **liší se od obecné odpovědné osoby zákazníka**).

## 3. Pole a data

- Nová tabulka **`services`**: `tenant_id`, `client_id`, `catalog_item_id` (položka
  Seznamu service_catalog), `mode` (subscription/retainer/payg — override katalogu),
  `rate` (Kč/h, override), `monthly_amount` (Kč/měs — jen předplatné, nullable),
  `owner_id` (odpovědná osoba za službu u tohoto klienta), `status`
  (active/paused/ended), `created_at`.
- **Paušál hodin na klientovi**: `clients.hours_budget_monthly` (h/měs, nullable),
  `clients.retainer_price` (Kč/měs, nullable), `clients.hours_rollover` (0/1).
- Vše se loguje do `events` (Historie zákazníka) + realtime push.

## 4. Pravidla a stavy

- Stejná služba může být u každého klienta nastavená jinak (režim, sazba, osoba).
- Tatáž služba může u klienta běžet **vícekrát zároveň** — rozlišuje ji „upřesnění
  služby" (např. Správa PPC · Sklik a Správa PPC · Google).
- Ukončená/pozastavená služba se nemaže — historie a výkazy na ni zůstávají vázané.
- Paušál hodin: nevyčerpané hodiny defaultně propadají; zaškrtávátko = převod
  do dalšího měsíce (bez stropů, zatím).
- Deaktivovaná služba v katalogu se nenabízí k novému přidělení; běžící přidělení
  zůstávají.
- Ceny, sazby a paušál smí měnit jen **admin** (než přijde RBAC role manažer).
  Ostatní vidí vše.

## 5. Akce (kontextové)

- Záložka Služby: „Přidělit službu" (panel), „Nastavit paušál hodin" (panel);
  na řádku služby hover: Upravit · Pozastavit/Obnovit · Ukončit.
- Žádné akce jinde (v liště, v menu) — vše u věci.

## 6. Prázdné stavy

- Služby: „Zatím žádné služby. Přidělte první službu z katalogu." + odkaz
  „Přidělit službu". (Když je katalog prázdný: „Nejdřív přidejte služby do katalogu
  v Administraci." + odkaz pro adminy.)
- Paušál hodin: odkaz „Nastavit paušál hodin" (viz výše).
- Měsíčně celkem se zobrazuje, jen když je co sčítat.

## 7. Hotovo, když… (checklist)

- [ ] Záložka Služby v detailu firmy i osoby zobrazuje paušál, služby a součet
- [ ] Jde přidělit službu z katalogu, předvyplní se výchozí režim a sazba, vše jde přepsat
- [ ] U předplatného jde zadat částka a propisuje se do „Měsíčně celkem"
- [ ] Odpovědná osoba za službu je nezávislá na odpovědné osobě zákazníka
- [ ] Paušál hodin jde nastavit, upravit i zrušit; rollover zaškrtávátko se ukládá
- [ ] Pozastavení/obnovení/ukončení služby funguje; duplicitní aktivní služba nejde
- [ ] Změny jen pro adminy; ostatním se akce nenabízejí
- [ ] Vše v Historii (s ID) + realtime do otevřených oken
- [ ] typecheck zelený, E2E testy projdou (vlastní TestE2E data, po sobě uklidit)
- [ ] odpovídá UI zásadám (skryté akce, malé panely, chipy, prázdné stavy)
