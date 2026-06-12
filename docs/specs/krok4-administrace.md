# Specifikace modulu: Krok 4 — Administrace: Tým a katalog Služeb

> Změna pořadí oproti původní roadmapě (na Petrovo přání): dřív než Úkoly/Nástěnka
> stavíme **základ, na který se vážou další moduly** — uživatele s rolemi a celofiremní
> katalog Služeb. Záznamy komunikace a Nástěnka se posouvají dál.

## 1. Účel

Admin v Administraci spravuje **tým** (kdo se může přihlásit a s jakou rolí) a **katalog
Služeb** (co firma klientům poskytuje, s výchozí sazbou). Na obojí se pak váže přiřazování
služeb zákazníkům, rozpočty hodin a výkazy práce (Kroky 5–6).

## 2. Obrazovky

**Administrace** dostane záložky ve stylu detailu zákazníka (stejný vzor jako
Nástěnka/Služby/Historie):

- **Moduly** — dnešní obsah beze změny.
- **Tým** — tabulka uživatelů: avatar s iniciálami, jméno, přihlašovací e-mail, chip role
  (tmavý „Admin" / šedý „Uživatel"), stav (aktivní/deaktivovaný). Akce na řádku skryté,
  zobrazí se najetím (hover-row vzor). Nad tabulkou modré tlačítko **Přidat uživatele**.
- **Služby** — tabulka katalogu: název, popis (šedě, zkrácený), režim (chip Předplatné /
  Paušál / Nepředplacená), výchozí cena, hodiny v ceně, stav. Hover akce na řádku.
  Nad tabulkou modré tlačítko **Přidat službu**.

Přidání i úprava přes **velký modál** (jednotné pravidlo zadávání):

- *Uživatel*: jméno, přihlašovací e-mail, role (Admin/Uživatel), heslo (při založení je
  povinné — nastaví ho admin a předá kolegovi; pozvánky e-mailem přijdou později).
  Při úpravě je heslo volitelné („vyplňte jen pro změnu").
- *Služba*: název, popis, režim (**Předplatné** / **Paušál s hodinami** /
  **Nepředplacená**), výchozí cena (Kč/měs — u předplatného volitelná, u nepředplacené
  není), výchozí hodiny v ceně (jen u paušálu).

## 3. Pole a data

- **Uživatel** = osoba (`persons`) s přihlašovacím e-mailem. Role zatím dvě: **Admin**
  (vidí Administraci, spravuje tým/služby/moduly) a **Uživatel** (vše ostatní). Jemnější
  práva (RBAC z datového modelu) až později — teď je nepotřebujeme.
- **Služba v katalogu**: Název, Popis, **Režim** (Předplatné = fixní položka bez hodin,
  např. SaaS/licence; Paušál s hodinami = cena + počet hodin v ceně; Nepředplacená =
  platí se vykázaná práce × sazba klienta), **výchozí cena** (Kč/měs; u předplatného
  volitelná, u nepředplacené žádná) a **výchozí hodiny v ceně** (jen u paušálu).
  Vše jsou výchozí hodnoty pro celou firmu; **u konkrétního zákazníka půjde při
  aktivaci služby všechno změnit** (Krok 5) — viz fakturační model v `DATOVY-MODEL.md`.
- Katalog je Seznam `service_catalog`; Popis, Režim, Cena a Hodiny se ukládají jako
  doplňkové údaje (JSON meta) — **první reálné využití dohodnuté konvence**
  „detaily jako JSON snippety".
- Každá změna (uživatel přidán, služba upravena…) se zapisuje do `events` → Historie
  + okamžitý realtime push do otevřených oken.

## 4. Pravidla a stavy

- Administraci vidí a spravuje **jen Admin** (platí už dnes).
- **Pojistka posledního admina**: poslední admin nemůže sám sebe degradovat na Uživatele
  ani deaktivovat — aplikace to odmítne s vysvětlením.
- Uživatel se **nemaže, jen deaktivuje** (přestane se moci přihlásit; jeho stopa v Historii
  a budoucích výkazech zůstává). Deaktivovaného jde znovu aktivovat.
- Služba se také **deaktivuje, nemaže** — nenabízí se nově, ale u zákazníků, kde běží,
  zůstává. Aktivace ji vrátí do nabídky.
- Validace: e-mail uživatele unikátní; název služby povinný a unikátní; cena a hodiny
  nezáporná čísla; u předplatného může být cena prázdná (jen evidence), u paušálu jsou
  hodiny povinné.

## 5. Akce (kontextové)

- **Tým** → „Přidat uživatele" (velký modál); na řádku po najetí: **Upravit** (velký modál),
  **Deaktivovat / Aktivovat**.
- **Služby** → „Přidat službu" (velký modál); na řádku: **Upravit**, **Deaktivovat / Aktivovat**.
- Žádné akce schované v menu jinde; vše u věci.

## 6. Prázdné stavy

- **Služby**: „Zatím žádné služby. Přidejte první službu, kterou klientům poskytujete."
  + tlačítko „Přidat službu".
- **Tým** prázdný nebude (admin existuje vždy); deaktivovaní se zobrazují šedě na konci.

## 7. Hotovo, když… (checklist)

- [ ] Administrace má záložky Moduly / Tým / Služby; Moduly fungují jako dřív
- [ ] Jde přidat uživatele, přihlásit se jím, upravit ho, deaktivovat (nepřihlásí se) a aktivovat
- [ ] Poslední admin nejde degradovat/deaktivovat — aplikace vrátí srozumitelnou hlášku
- [ ] Jde přidat/upravit/deaktivovat službu; režim, cena, hodiny a popis se ukládají a zobrazují
- [ ] Změny se propisují realtime do otevřených oken a do Historie (s ID)
- [ ] typecheck zelený, HTTP testy projdou
- [ ] odpovídá UI zásadám (záložky, chipy, hover akce, velké modály, prázdné stavy)
