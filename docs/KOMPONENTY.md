# Katalog komponent — Trefoil CRM v2

> **Závazná specifikace znovupoužitelných prvků UI.** Zdroj stylů: `mockupy/styl.css`
> (v Kroku 2 se stane `public/theme.css` aplikace). Živý náhled všech prvků:
> **`mockupy/komponenty.html`**. Tokeny a celkové vzory: `docs/UI-ZASADY.md`.
>
> Pravidlo: **moduly nové prvky nevymýšlejí** — používají tyto. Chybí-li něco,
> nejdřív se doplní sem (+ do katalogu), pak se použije.

---

## 1. Tlačítka `.btn`

**Kdy:** všechny akce. Na stránce max. jedno primární.

```html
<button class="btn btn-primary">Zapsat aktivitu</button>   <!-- hlavní akce stránky/formuláře -->
<button class="btn">Poslat e-mail</button>                 <!-- sekundární (bílé s rámečkem) -->
<button class="btn btn-sm">Přidat úkol</button>            <!-- malé, do hlaviček karet -->
<button class="btn btn-ghost">Přidat kategorii</button>    <!-- textová akce (indigo link) -->
<button class="btn btn-danger">Smazat</button>             <!-- destrukce, outline -->
<button class="btn btn-danger-solid">Prohráno</button>     <!-- destrukce, plné (Lost) -->
<button class="btn btn-success-solid">Vyhráno</button>     <!-- úspěch, plné (Won) -->
<button class="btn btn-sm">Upravit <span class="btn-split">▾</span></button>  <!-- split -->
```

**Pravidla:** výška 36 px (30 px `.btn-sm`), radius 10 px. Ikonová tlačítka vždy s `aria-label`.

## 2. Chipy

**Tři druhy — nezaměňovat:**

```html
<!-- a) Štítek (tag) — tlumený, malý, NIKDY nekřičí -->
<span class="chip">E-shop</span>

<!-- b) Stav — měkké barevné pozadí -->
<span class="chip chip-soft-teal">Aktivní</span>
<span class="chip chip-soft-gray">Lead</span>

<!-- c) Kategorie úkolu — plná barva, bílý text (jediný „hlasitý" chip) -->
<span class="cat cat-teal">Hovor</span>
<span class="cat cat-pink">E-mail</span>
<span class="cat cat-red">Schůzka</span>
<span class="cat cat-orange">Follow-up</span>
<span class="cat cat-indigo">Milník</span>
```

Skupina štítků: `<span class="chips">…</span>`. Barva kategorie přichází z položky Seznamu (`color`).

## 3. Avatary `.av`

```html
<span class="av av-b">BE</span>          <!-- 36 px, iniciály -->
<span class="av av-sm av-g">JB</span>    <!-- 26 px, do řádků -->
<span class="av av-lg av-p">DE</span>    <!-- 72 px, hlavička detailu -->
```

Pastelové varianty `av-g/av-p/av-b/av-y` (deterministicky z názvu, např. hash % 4),
`av-i` (indigo) jen pro přihlášeného uživatele.

## 4. Taby `.tabs`

```html
<nav class="tabs" aria-label="…">
  <a class="tab active" href="…">Historie</a>
  <a class="tab" href="…">Zakázky <span class="cnt">2</span></a>
</nav>
```

Aktivní = indigo + 3px podtržení. Počty jako `.cnt`. Použití: pohledy stránky i sekce detailu.

## 5. Filtr pilulky `.fpill`

```html
<div class="frow">
  <span class="fpill">Štítek: <b>Vše</b> <span class="chev">▾</span></span>
</div>
```

Vzor `Popisek: Hodnota ▾`, kulaté (999px), bílé s rámečkem.

## 6. Karty `.card`

```html
<div class="card">
  <div class="card-head">
    <h3>Úkoly</h3>
    <button class="btn btn-sm">Přidat úkol</button>
  </div>
  …obsah…
</div>
```

Hlavička: název vlevo, **kontextová akce vpravo**. Tabulková karta bez paddingu: `.card.card-table`.

## 7. Stat dlaždice `.stats`

```html
<div class="stats">
  <div class="stat"><b>2</b><span>aktivní služby</span></div>
</div>
```

Velké tučné číslo + malý šedý popisek. Na detailu fixně `style="grid-template-columns:repeat(4,1fr)"`.

## 8. Tabulka `.tbl`

```html
<div class="card card-table">
  <table class="tbl">
    <thead><tr><th class="check"></th><th>Souhrn</th>…</tr></thead>
    <tbody>
      <tr>
        <td class="check"><input type="checkbox" aria-label="Vybrat …"></td>
        <td><span class="cell-name"><span class="av av-b">BE</span>
          <span><span class="nm">Borovec-elektro.cz</span>
          <span class="sub">Firma · borovec-elektro.cz</span></span></span></td>
        <td><a href="…">hello@…</a><span class="meta-lbl">Práce</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

Řádek: checkbox · avatar · **tučné jméno** + šedý podtitulek (role jako odkaz). Nad tabulkou
`.list-meta` („Zobrazeno 1–50 z 240" + hromadné akce). Responzivně obalit `overflow-x:auto`.

## 9. Fakta a levý sloupec detailu

```html
<div class="fact"><span class="val">+420 601 111 222</span><span class="lbl">Telefon · Práce</span></div>

<div class="side-section">
  <h4>Lidé <a href="…">+ Přidat</a></h4>
  <div class="person-row">
    <span class="av av-sm av-g">JB</span>
    <span><span class="nm">Jan Borovec</span><span class="sub">Jednatel · +420 …</span></span>
  </div>
</div>
```

**Hodnota normálně, popisek malý šedý POD ní** — sekundární údaje nikdy velké.

## 10. Timeline

```html
<div class="actions-row">
  <span class="fpill">Vše <span class="chev">▾</span></span>
  <input class="input grow" type="search" placeholder="Hledat v historii…" aria-label="…">
  <button class="btn">Poslat e-mail</button>
  <button class="btn btn-primary">Zapsat aktivitu</button>
</div>

<div class="tl-item">
  <div class="tl-ico">📝</div>
  <div>
    <div class="tl-head"><b>Poznámka od Petra Bělocha</b> <span class="when">· 9. 6. 2026</span></div>
    <div class="tl-body">Text…</div>
    <span class="file-chip">📄 nazev.pdf <span>1,2 MB</span></span>
  </div>
</div>
```

Ikony typů: 📝 poznámka · ✉️ e-mail · 📞 hovor · 👥 schůzka.

## 11. Úkol v seznamu

```html
<div class="task-group overdue">● Po termínu</div>   <!-- skupina: .overdue jen u „Po termínu" -->
<div class="task-item">
  <input type="checkbox" aria-label="Označit jako hotové">
  <div class="task-txt">
    <span class="cat cat-teal">Hovor</span> Zavolat ohledně rozpočtu PPC
    <span class="when">pá 12. 6. · pro <a href="…">Borovec-elektro.cz</a></span>
  </div>
</div>
```

## 12. „Naposledy zobrazené" chip

```html
<a class="recent-chip" href="…">
  <span class="av av-b">BE</span>
  <span class="nm">Borovec-elektro.cz<span class="sub">Firma</span></span>
</a>
```

## 13. Prázdný stav `.empty`

```html
<div class="empty">
  <span class="big">✓</span>
  Zatím žádná zakázka.
  <div class="hint" style="margin-top:.6rem"><button class="btn btn-sm btn-primary">Vytvořit zakázku</button></div>
</div>
```

**Vždy:** krátká věta + kontextová akce. Nikdy „Přidej tlačítkem X" (viz UI zásady §6).

## 14. Progress bar

```html
<div class="progress" role="progressbar" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100">
  <i style="width:40%"></i>
</div>
```

Teal, 6 px. Vedle textově: „Milník: Nabídka (40 %)".

## 15. Quick-view panel `.quickview`

Plovoucí karta vpravo (avatar `av-lg` + Upravit ▾ + jméno + chipy + fakta + „Zobrazit celý profil ›").
Otevírá se kliknutím na řádek seznamu; celá stránka detailu až druhým krokem.

## 16. Formuláře

```html
<div class="field">
  <label>Popis <span class="req">*</span> <a class="side-link" href="…">Přidat detail</a></label>
  <input class="input" type="text">
  <span class="help">Nápověda malým šedým písmem.</span>
</div>
<div class="field"><label>Kategorie</label>
  <select class="input"><option>Žádná</option></select>
</div>
<div class="field"><label>Poznámka</label><textarea class="input"></textarea></div>
<div class="form-actions">
  <button class="btn btn-primary">Uložit</button>
  <button class="btn btn-ghost">Zrušit</button>
</div>
```

Label malý šedý NAD polem, povinné `<span class="req">*</span>`. Modální obal: `.modal-card`.
Chyba formuláře: `<div class="form-error">Neplatný e-mail nebo heslo.</div>` (nad poli, lidský text).

## 16b. Rozbalovací menu `.menu`

```html
<div class="menu" id="userMenu">
  <button class="btn btn-sm" data-menu-toggle="userMenu" aria-haspopup="true">Petr Běloch ▾</button>
  <div class="menu-list" role="menu">
    <button class="menu-item" role="menuitem">Odhlásit</button>
  </div>
</div>
```

Otevírání řeší `public/app.js` (klik na `[data-menu-toggle]` přepne `.open`, klik mimo zavře).

## 18. Úprava jednoho pole = malý panel (inline editace ZRUŠENA)

**Kdy:** úprava jednoho údaje v panelech detailu (název, poznámka, kontakt…).
**Inline editace na místě se nepoužívá** — není stylová a vše ostatní řeší malé/velké
modály, tak i jedno pole. Vzor: textová akce „Upravit" (hover, v řádku nadpisu nebo
řádku údaje) otevře **malý panel** (§19) s polem a tlačítkem Uložit; odpověď serveru
vymění celý blok (htmx `hx-target` na obal).

```html
<span class="row-actions">
  <div class="menu" id="nameEdit" style="display:inline-block">
    <button class="subtle-action" data-menu-toggle="nameEdit">Upravit</button>
    <div class="menu-list panel">
      <form hx-post="/firmy/ID/pole/name" hx-target="#f-name" hx-swap="outerHTML">
        <input class="input" name="value" value="…">
        <button class="btn btn-sm btn-primary">Uložit</button>
      </form>
    </div>
  </div>
</span>
```

**Akce = text, ne ikonka.** Akční odkazy („Upravit", „Smazat", „Změnit", „Odebrat")
jsou textové `.subtle-action`; ikonky zůstávají jen v řádku rychlého přidání
(telefon/e-mail/web/štítek/osoba) a pro zavření modálu (✕).

Hover ukáže ✎; prázdná hodnota se zobrazuje jako „— doplnit —" (šedě, kurzívou).
Pro výběrové hodnoty (stav, osoba) NEpoužívej select v editaci — použij dropdown panel (§19).

## 19. Dropdown panel `.menu-list.panel` (Capsule styl)

**Kdy:** kontextový výběr hodnoty (stav, odpovědná osoba, štítky…). Formulářové prvky se
**neukazují natrvalo** — viditelný je jen výsledek (text/chip/odkaz), panel se otevře kliknutím.

```html
<div class="menu" id="statusPicker">
  <button class="subtle-action" data-menu-toggle="statusPicker">změnit</button>
  <div class="menu-list panel" role="menu">
    <input class="input" data-filter-list placeholder="Hledat…">      <!-- volitelné -->
    <div class="opt-group">Stavy</div>
    <button class="opt">Lead</button>
    <button class="opt">Aktivní <span class="tick">✓</span></button>  <!-- vybraná hodnota -->
    <div class="panel-actions"><button class="btn btn-ghost">Zrušit</button><button class="btn btn-sm btn-primary">Použít</button></div> <!-- jen u vícenásobného výběru -->
  </div>
</div>
```

Otevírání řeší `data-menu-toggle` (app.js), `[data-filter-list]` filtruje `.opt` položky psaním.
Jednoduché výběry (stav, osoba) aplikují volbu hned klikem na položku — bez Použít.

**Zarovnání:** panel se otevírá **levým horním rohem k akci** (levý/střední panel stránky);
akce v pravém panelu nebo horní liště používají `.menu.align-right` (pravý horní roh).
Malý modál slouží pro **hlavní údaje**; ikonka „…" v něm otevírá velký modál (§21).

## 21. Velký modál `.modal-overlay` (kompletní editace)

**Kdy:** založení nebo kompletní úprava záznamu — vždy v **režimu soustředění**
(na střed obrazovky, ztmavené pozadí). Závazný seznam použití: přidání/úprava
**osoby**, **firmy**, **uživatele** (Administrace · Tým), **služby v katalogu**
(Administrace · Služby), **přidělení/úprava služby u zákazníka**, **paušál hodin**.
Otevírá se přímou akcí nebo ikonkou „…" z malého panelu. Malé panely (§19) zůstávají
jen pro rychlé kontextové akce (výběry, filtry, rychlé přidání kontaktu/osoby).

```html
<!-- server vrací fragment do <div id="modal"> (htmx hx-get → hx-target="#modal") -->
<div class="modal-overlay">
  <div class="modal-card">
    <div class="modal-head"><h3>Nová osoba · Firma</h3>
      <button class="icon-btn" data-modal-close aria-label="Zavřít">✕</button></div>
    …formulář dle §16…
  </div>
</div>
```

Zavření: ✕ (`data-modal-close`), klik na pozadí, klávesa Esc (app.js). Komponenta `ModalShell`.

## 20. Kontextové akce na řádcích + skrytý vzor přidávání

- **Hodnoty jsou text**; akční ikonky (`.icon-btn` ✎ ✕) jsou v `.row-actions` a ukážou se až
  najetím na `.hover-row` (nebo fokusem). Vždy s `aria-label`.
- **Skrytý vzor přidávání (default):** i akce „+ něco" (štítek, kontakt, osoba…) jsou ve
  vyplněné sekci **skryté a objeví se až najetím** na sekci — viditelné zůstávají hlavní,
  vyplněné údaje. Technicky: sekce = `.hover-row`, přidávací akce v `.row-actions`.
- **Výjimka — prázdná sekce:** když v sekci nic není, přidávací akce je **viditelná rovnou**
  (jinak by ji nikdo nenašel) — „Přiřadit odpovědnou osobu", „+ štítek", ikonky kontaktů.
- **Dotyková zařízení** (bez hoveru): `.row-actions` jsou vždy viditelné (media `hover: none`).
- **Jednota akčních odkazů:** `.subtle-action` je **vždy podtržený** (je jasné, že jde o akci).
- **Akce sekce patří do řádku nadpisu (vpravo)** — `h4`/`.card-head` jsou flex
  se `space-between`, takže akce využije existující výšku nadpisu a nerezervuje
  žádné svislé místo.
- **Sekční akce indikuje vždy viditelné ⋯ v pravém rohu** (komponenta `KebabMenu`) —
  uživatel nesmí hádat, kde se skrývá menu. Jedna akce: ⋯ ji otevře rovnou (panel/
  modál). Více akcí: ⋯ otevře malé menu textových položek. Skryté-do-najetí zůstávají
  jen **řádkové** akce (`.hover-row` + `.row-actions`) a řádek rychlého přidání
  v Kontaktech je viditelný trvale. Prázdná sekce má místo ⋯ viditelnou textovou akci
  („Přiřadit osobu", „Zadat údaje", „Nastavit paušál hodin").
- **Rychlé přidání kontaktů:** řádek ikonek `.quick-add` (telefon/e-mail/web/+), každá otevře
  dropdown panel s minimálním formulářem. Žádné trvale viditelné selecty mimo filtry/řazení.

## 17. Horní lišta `.topbar`

Jediná navigace aplikace: ikonová navigace (`.nico`, aktivní `.active`, vždy `title` + `aria-label`),
vyhledávání `.search` s `<kbd>/</kbd>`, vpravo `Přidat +` a `.user`. Přesný markup: kterýkoli mockup
(`mockupy/nastenka.html`). Ikony: inline SVG (Feather styl, stroke 2, 20×20).

## 23. Skiny (motivy) a přepínač vzhledu

Barvy nejsou v `theme.css` natvrdo — drží je **tokeny** a každý skin je jejich sada
(`public/skins/<id>.css`, blok `:root[data-skin="<id>"]`). Aktivní skin = atribut `data-skin`
na `<html>`. Registr `src/web/skins.ts` (id + štítek) generuje jak `<link>` na styly skinů
(`HeadAssets`, `src/web/head.tsx`), tak položky přepínače. 6 skinů ve 3 rodinách (Trefoil,
Klasický, Vysoký kontrast) × světlý/tmavý — viz UI-ZASADY §2.

**Přepínač** je v rozbalovacím menu `.user` jako **submenu „Vzhledy"**: položka
`<button class="menu-item has-sub" data-submenu-toggle>` s `<span class="sub-arrow">›</span>`;
vedle ní `<div class="menu-list submenu-list">` (vyskakuje do strany — `right:100%`). V něm
pro každý skin `<button class="opt" role="menuitemradio" data-skin-set="<id>">` se
`<span class="tick">✓</span>` (fajfka jen u aktivní přes `aria-checked="true"`). Oddělovač
sekcí `.menu-sep`. Submenu se otevírá najetím myší (`:hover`) i klikem (app.js přepne `.open`).

> Pozn.: pravidla `.menu.open > .menu-list` a `.menu.align-right > .menu-list` cílí **přímého
> potomka**, aby neovlivnila vnořený `.submenu-list`.

Chování (`app.js`): klik uloží volbu do `localStorage['skin']` a hned přepne (menu i submenu
zůstávají otevřené). Bez volby se řídí systémem; přepnutí se promítne i do ostatních oken
(`storage` event). Bliknutí brání skript v `<head>` (`skinBootScript`), který motiv nastaví
před vykreslením a zveřejní konfiguraci do `window.__skins`. **Nová obrazovka nepotřebuje nic
navíc** — stačí, že její `<head>` použije `HeadAssets` (Layout, login i založení už ano).

## 22. Závislá pole a výchozí hodnoty z katalogu (formuláře)

Obecné mechanismy v `app.js` — použitelné v každém formuláři, žádný kód na míru:

- **Závislé pole:** obal s `data-depends-on="jménoPole" data-depends-value="a,b"` je vidět,
  jen když má pole daného jména ve stejném formuláři jednu z hodnot (jinak `.hidden`).
  Server vykreslí výchozí stav (`class="hidden"` podle předvyplněné hodnoty), JS pak
  reaguje na změny. Příklad: „Částka předplatného" jen při režimu Předplatné.
- **Výchozí hodnoty z číselníku:** `<select data-defaults>` nese na `<option>` atributy
  `data-set-<pole>` (např. `data-set-mode`, `data-set-rate`). Výběr položky propíše
  hodnoty do polí formuláře a u odpovídající volby cílového selectu zobrazí
  **„(výchozí)"**. Uživatel tak nikdy nemusí znát nastavení katalogu zpaměti.
- **Jeden formulář pro založení i úpravu:** stejná komponenta (např. `ServiceForm`),
  úprava jen předvyplní dřívější hodnoty; liší se nanejvýš poli, která po založení
  nedávají smysl měnit (např. výběr služby z katalogu).

---

## Jak katalog rozšiřovat

1. Nový prvek nejdřív navrhnout v `mockupy/komponenty.html` (vidět = schválit),
2. zapsat sem (kdy použít, kód, pravidla),
3. teprve pak použít v modulu. Tím zůstane UI konzistentní.
