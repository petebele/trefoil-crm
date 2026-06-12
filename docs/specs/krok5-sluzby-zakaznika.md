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
     (viditelný — vzor prázdné sekce);
   - vyplněný → **hodiny/měsíc**, **cena paušálu (Kč/měs)**, převádění hodin;
     akce Upravit/Zrušit **skryté do najetí** (hover vzor, jednotně se službami);
     úprava ve **velkém modálu**.
2. **Služby** — řádky běžících (aktivní/pozastavené): název · upřesnění, chip
   režimu, sazba/částka, odpovědná osoba, popis. Hover akce: Upravit (velký
   modál) · Pozastavit/Obnovit · Ukončit. Nad seznamem odkaz **„Přidělit službu"**.
   **Ukončené služby** se přesouvají do rozbalovacího **archivu** („Ukončené
   služby (N)") — hlavní seznam nezarůstá.
3. **Měsíčně celkem (pevné platby)** — rozpis: paušál hodin (cena/měs; bez ceny
   „cena nenastavena"; chybí-li paušál a běží paušálové služby → upozornění),
   předplatná s částkou, samostatně fakturované služby informativně („dle výkazů
   × sazba"). **Součet = jen pevné platby**; práce dle výkazů se doplní v Kroku 6.

**Přidělení/úprava služby** — **jeden společný formulář ve velkém modálu** (režim
soustředění; úprava jen předvyplní dřívější hodnoty) s poli:

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
