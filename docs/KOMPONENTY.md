# Katalog komponent — Conviu CRM v2

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

## 17. Horní lišta `.topbar`

Jediná navigace aplikace: ikonová navigace (`.nico`, aktivní `.active`, vždy `title` + `aria-label`),
vyhledávání `.search` s `<kbd>/</kbd>`, vpravo `Přidat +` a `.user`. Přesný markup: kterýkoli mockup
(`mockupy/nastenka.html`). Ikony: inline SVG (Feather styl, stroke 2, 20×20).

---

## Jak katalog rozšiřovat

1. Nový prvek nejdřív navrhnout v `mockupy/komponenty.html` (vidět = schválit),
2. zapsat sem (kdy použít, kód, pravidla),
3. teprve pak použít v modulu. Tím zůstane UI konzistentní.
