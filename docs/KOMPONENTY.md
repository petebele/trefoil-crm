# Katalog komponent — Trefoil CRM v2

🧭 **Znalostní báze:** [mapa](../README.md) · [UI zásady](UI-ZASADY.md) · [slovník](SLOVNIK.md) · [datový model](DATOVY-MODEL.md) · [architektura](ARCHITECTURE.md) · [sumář](SUMMARY.md) · [roadmap](ROADMAP.md) · [pravidla](../CLAUDE.md) · [mockupy](../mockupy/)

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

## 9. Levý sloupec detailu — identita + sekce `.group`

Levý panel detailu firmy/osoby skládá **identifikační blok** (`.idblock`) nahoře a pod ním
**sekce** (`.group`) s velkým UPPERCASE nadpisem (`.group-h`). Akce sekce jdou do nadpisu
vpravo přes `.ha` (header-actions, `margin-left:auto`). Mockup-etalon: `mockupy/example-zakaznik.html`.

```html
<!-- IDENTITA: avatar + „Upravit ▾" + název + štítky + stav -->
<div class="idblock">
  <span class="av av-lg av-p">SE</span>
  <!-- Picker (split button) → velký modál §21 -->
  <button class="btn btn-sm" data-menu-toggle="firmActions">Upravit <span class="btn-split">▾</span></button>
  <div class="editable">
    <span class="idname field-strong">Severka s.r.o.</span>    <!-- Název firmy (clients.name) -->
    <span class="pen-ind" data-menu-toggle="f-name" …></span>  <!-- §18 -->
  </div>
  <span class="id-badges"><span class="chip">E-shop</span></span>  <!-- štítky (mini-panel §18) -->
  <!-- StatusChip přes EditField (mini-panel) -->
</div>

<!-- SEKCE: nadpis + akce vpravo (.ha) -->
<div class="group">
  <div class="group-h">Kontakty <span class="ha">＋ ✎</span></div>
  <div class="contact-row">                         <!-- ikona typu + hodnota + štítek označení -->
    <span class="cico"><!-- IconPhone/Mail/Globe --></span>
    <span class="val">+420 601 111 222</span>
    <span class="tagaft">Práce</span>               <!-- „označení", NE typ -->
  </div>
</div>

<!-- LIDÉ (jen u firmy, nad Kontakty): řádky osob -->
<div class="prow">
  <span class="av av-sm av-g">JB</span>
  <span><span class="nm">Jan Borovec</span><span class="sub">Jednatel · +420 …</span></span>
</div>

<!-- Firemní údaje: blok (jen velký modál §21) + IČO/DIČ na .minirow -->
<div class="minirow">IČO 123 · DIČ CZ123</div>
```

**Zásady:** identita vlevo zarovnaná (Capsule styl). U kontaktu se liší **typ** (telefon/
e-mail/web → ikona `.cico`) od **označení** (domů/pracovní → pilulka `.tagaft`) — typ se
NEpíše textem. **Web patří do Kontaktů, ne do adresy.** Hodnota normálně (`font-weight:400`),
popisky malé šedé. „Firemní údaje" a „Poznámka" jsou **normal**, ne tučně.

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

## 11b. Kanban (Úkoly v2)

Druhý pohled na úkoly (vedle Agendy). **Sloupce = stavy** (`task_statuses`, konfigurovatelné
per uživatel), **karty se přetahují** (HTML5 drag‑drop v `app.js` → POST `…/presun` → překreslí `#board`).

```html
<section id="board" class="kanban" hx-get="/ukoly/board?mesic=2026-06"
         hx-trigger="live-update from:body" hx-target="this" hx-swap="outerHTML">
  <div class="kcol">
    <div class="kcol-head">
      <span class="kcol-dot" style="background:var(--teal)"></span>
      <span class="kcol-name">Vyřizuji</span> <span class="kcol-count">3</span>
      <button class="icon-btn" hx-get="…modal/novy?status=ID&mesic=…">＋</button>
    </div>
    <div class="kcol-body" data-status-id="ID">
      <div class="kcard" draggable="true" data-task-id="…">
        <div class="kcard-top"><input type="checkbox"> <span class="kcard-title">Úkol</span> …⋯</div>
        <div class="kcard-meta"><!-- chip kategorie · zákazník · termín --></div>
      </div>
    </div>
    <!-- u sloupce s is_done: --> <a class="kcol-archive" href="…&archiv=1">Archivované úkoly (2)</a>
  </div>
</section>
```

**Zásady:** sloupec = jeden stav (≠ štítky); „vyřízeno" = stav s `is_done` (synchron přes checkbox).
**První sloupec = povinný Inbox** (`is_default`, nesmazatelný, cross‑month — nové/nezařazené úkoly).
**Archiv = příznak** (`archived`) — patička „Archivované úkoly" ve sloupci „Hotovo". **Správa sloupců
přímo na boardu** (přejmenovat inline, drag řazení za úchyt ⠿, ⋯ barva/`is_done`/smazat, „+ Sloupec").
Lišta `.kbar`: měsíc ◀▶, board kolegy (admin), „Uzavřít měsíc". Detaily `docs/specs/ukoly-v2-kanban.md`.

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

## 13b. Inline prázdný stav `.empty-inline` (uvnitř sekce/pole)

Pro prázdné **pole/sekci v levém panelu** (ne celá karta) — věta + **odkaz**, který otevře
příslušný mini-panel (§18). Levé zarovnání, tlumený text, normal font.

```html
<span class="empty-inline">Žádná poznámka.
  <a class="emptylink" data-menu-toggle="note-field" role="button" tabindex="0">Přidat poznámku.</a></span>
```

Ustálené texty (→ vždy přes `tr()` + `en.ts`): „Žádná poznámka. **Přidat poznámku.**" ·
„Žádné štítky. **Přidat štítek.**" · „Žádné kontakty. **Přidat kontakt.**" · „Žádní lidé.
**Přidat osobu.**" · „Žádná odpovědná osoba. **Přiřadit osobu.**" · „Žádná uvedená adresa.
**Vyplnit adresu.**". (`.empty` ze §13 zůstává pro velké prázdné stavy v kartách středu/vpravo.)

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

## 18. Editace pole = mini-panel (spouštěč = tužka ✎; u hodnot v textu sama hodnota)

**Princip:** editaci dílčího pole spouští **tužka ✎** — ne klik na hodnotu. Hodnota je jen
**zobrazená a označitelná** (uživatel ji musí jít označit/zkopírovat, aniž se otevře editor).
Tužka je **akční prvek** (zakulacený čtverec, styl ladí s ikonkami hlavního menu), ne pouhý
indikátor. Klik otevře **mini-panel** (§19) ukotvený k poli s formulářem a Uložit; **kurzor je
hned v poli, text označený**. Enter uloží, Esc zruší (textarea Ctrl+Enter). Odpověď serveru
vymění blok (htmx `hx-target`/`hx-swap="outerHTML"` na obal `#…`). Komponenta: **`EditField`**
(`src/web/components.tsx`); ikona **`PencilIcon`**.

**Afordance (jak poznat, že pole jde upravit):**
- **Pole s vlastním řádkem / blok** (`block`) → spouštěč = **tužka ✎** (`.pen-ind`, nese
  `data-menu-toggle`). Skrytá, **objeví se na hover** `.editable` (na dotyku trvale), na hover
  tužky se **podbarví `--accent-soft`** + **okamžitý tooltip** (`data-tip`, bez prodlevy).
- **Hodnota uvnitř textu** (víc hodnot v jednom řádku, prop `inline`) → spouštěčem je **sama
  hodnota** (`.editable-inline`) s **čárkovaným podtržením** (vždy viditelné), bez tužky.
- **Prázdná hodnota** → **`.empty-inline`** věta + **`.emptylink`** odkaz, který otevře týž
  mini-panel (`data-menu-toggle` na cíl). Vzor: „Žádná poznámka. **Přidat poznámku.**",
  „Žádné štítky. **Přidat štítek.**", „Žádné kontakty. **Přidat kontakt.**" (viz §13b).

**Mini-panel — chování:** kurzor v poli na otevření (focus + select); jednořádkový vstup =
panel **`.wide`** (~300 px), textarea = panel **`.area`** (~380 px) a **roste s obsahem**
(`data-autogrow`); panel **se posouvá se stránkou** a u foldu **vyskočí nad pole** (flip — vše
`app.js`). Výběry (stav, osoba) uloží hned klikem na položku. **Štítky** = mini-panel:
nahoře input „Najít nebo vytvořit", pak přiřazené (✕ odebere) a „Další štítky" (klik přiřadí).

```html
<!-- standardní pole: JEDINÝ spouštěč = tužka; hodnota jen zobrazená (lze označit) -->
<div class="menu" id="f-name">
  <div class="editable">
    <span class="idname field-strong">Severka s.r.o.</span>
    <span class="pen-ind" data-menu-toggle="f-name" role="button" tabindex="0"
          aria-label="Název firmy — upravit" data-tip="Název firmy — upravit"><!-- PencilIcon --></span>
  </div>
  <div class="menu-list panel wide" role="menu"><!-- server-rendered formulář (§19) --></div>
</div>

<!-- prázdná hodnota: odkaz otevře týž panel -->
<span class="empty-inline">Žádná poznámka.
  <a class="emptylink" data-menu-toggle="note-field" role="button" tabindex="0">Přidat poznámku.</a></span>
```

**Malá vs. velká akce — rozhoduje povaha pole, ne jeho název:**

| Mini-panel (malá akce) | Velký modál §21 (velká akce) |
|---|---|
| **jeden** dílčí údaj: sazba, odpovědná osoba, stav, štítky, termín, telefon, poznámka | **více polí / blok**: firemní údaje (název + IČO/DIČ + adresa), kontakty hromadně |
| rychlé přidání jednoho kontaktu (＋ → typ + hodnota) | identita/struktura: název služby (= katalog), režim účtování; **založení** záznamu; akce s přepočty |

(Příklad: poznámka, stav, jeden štítek = mini-panel; **Firemní údaje** a **Upravit vše**
u kontaktů = velký modál. Pravidlo: jeden údaj → mini-panel, více polí/blok → velký modál §21.)

**Úprava celého záznamu** (firma/osoba): v identifikačním bloku (§9b) tlačítko
**„Upravit ▾"** (`Picker`, split button) → otevře velký modál §21 (kompletní formulář).
Řádkové akce (kontakt, přiřazená osoba) mají **⋯ KebabMenu** (úprava + smazání, viz §20).

**Badge:** stav, štítky i další badge = jedna velikost (`.chip`, stejný padding i font).
*(Editovatelná barva textu/pozadí štítků a stavů — plánováno, zatím ne.)*

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
- **Trigger řádkové akce je VŽDY `⋯` (icon-btn)** — nikdy textový `.subtle-action` odkaz
  v `.row-actions`. Použij komponentu `KebabMenu` (id, label, alignRight). Tím uživatel
  vidí, že akce existují, ještě před najetím.
- **Akce sekce patří do řádku nadpisu (vpravo)** — `h4`/`.card-head` jsou flex
  se `space-between`, takže akce využije existující výšku nadpisu a nerezervuje
  žádné svislé místo.
- **Sekční akce indikuje vždy viditelné ⋯ v pravém rohu** (komponenta `KebabMenu`) —
  uživatel nesmí hádat, kde se skrývá menu. Jedna akce: ⋯ ji otevře rovnou (panel/
  modál). Více akcí: ⋯ otevře malé menu textových položek. Skryté-do-najetí zůstávají
  jen **řádkové** akce (`.hover-row` + `.row-actions`) a řádek rychlého přidání
  v Kontaktech je viditelný trvale. Prázdná sekce má místo ⋯ viditelnou textovou akci
  („Přiřadit osobu", „Zadat údaje", „Nastavit paušál hodin").
- **Přidání/úprava kontaktů (aktuální vzor):** v nadpisu sekce Kontakty (`.group-h .ha`)
  jsou **dvě ikonky** — **＋** (`Picker`: dropdown s `<select>` typu + hodnota + štítek →
  přidá jeden kontakt) a **✎** (jen když kontakty existují → velký modál **„Upravit vše"**,
  komponenta `ContactsEditAll`: opakovatelné řádky `.crow` typ/hodnota/štítek, přidat/odebrat,
  hromadné uložení přepíše sadu kontaktů). Žádné trvale viditelné selecty mimo filtry/řazení.

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

## 24. Editor poznámky (rich text, bez knihoven)

Vlastní lehký editor pro poznámky — **žádná externí knihovna**. Mockup: `mockupy/komponenty.html` §15.
Spec: [docs/specs/poznamky.md](specs/poznamky.md).

> **Znovupoužitelná komponenta (rich-input).** Editor **není vázaný na Poznámky** — je to obecné pole
> pro **formátovaný / komplexní vstup**. Používej ho všude, kde nestačí prostý `<input>`/`<textarea>`:
> **ruční záznamy do Feedu** (§25 — hovor/schůzka/poznámka), popisy úkolů, delší komentáře atd. Stejná
> komponenta, různé rendery (plná lišta vs. kompaktní za tužkou ✎, vzor §18). Server vždy očistí vstup
> na allowlist (viz níže) bez ohledu na to, odkud editor voláš.

- **Struktura:** `.note-editor` (rámeček) › `.note-toolbar` (lišta tlačítek) + `.note-area`
  (`contenteditable="true"`, plocha psaní). Vyrenderovaná poznámka jinde = `.note-content`
  (stejná typografie jako `.note-area`).
- **Kompaktní lišta se skupinami.** Méně používané varianty jsou schované pod hlavním
  tlačítkem ve `.note-tb-group` (dropdown `.note-tb-pop` se odkryje **najetím / fokusem**):
  - **B** (tučné) → pop **I** (kurzíva), **U** (podtržení),
  - **H1** (nadpis) → pop **H2**, **H3** (klik na hlavní = H1).
  - Samostatně: **odrážkový** a **číslovaný seznam**, **citace**, **odkaz**, **vymazat
    formátování** (vše **SVG ikony**, Feather styl; citace = SVG quote glyph).
- **Formátování přes `document.execCommand`** (bez závislosti). Inline příkazy a seznamy mají
  `data-cmd` (`bold`/`italic`/`underline`/`insertUnorderedList`/`insertOrderedList`/`createLink`).
  **Vymazat formátování** (`data-cmd="clearformat"`) = `removeFormat` + `unlink` + `formatBlock P`
  (vrátí běžný odstavec). **Blokové styly (nadpis, citace) mají `data-block`** (`H1`/`H2`/`H3`/
  `BLOCKQUOTE`) a jsou **PŘEPÍNAČE**: klik na již aktivní stav vrátí blok na `<p>` → **žádné
  vnořování citace na citaci**. Aktivní stav v `aria-pressed`. Obsluha v `app.js` (delegovaně);
  `mousedown` na liště dělá `preventDefault`, ať se neztratí výběr.
- **Velikosti nadpisů** (váha 650, font Poppins): H1 `1.5rem`, H2 `1.25rem`, H3 `1.05rem`, s
  mírně větším odsazením (sladěno s typografií). Stejné v `.note-area` i `.note-content`.
- **Styly se nemíchají.** Aktivní stav svítí **přesně**: H1 jen v H1 (ne v H2/H3), B jen
  u tučného (ne u kurzívy/podtržení). **Tučné je v nadpisu neaktivní** (nesvítí ani nereaguje)
  — nadpis je tučný ze stylu, ne přes `<strong>`; server proto uvnitř nadpisů `<strong>`/`<b>`
  neukládá. Vyhodnocení i blokace jsou v `app.js` (sdílené s mockupem §15).
- **Placeholder:** prázdná `.note-area` ukáže `data-placeholder` (přes `:empty::before`).
- **Odřádkování:** `defaultParagraphSeparator = 'p'` → **Enter = nový odstavec `<p>`**,
  **Shift+Enter = tvrdé zalomení `<br>`** (standardní zkratka; Ctrl+Enter neděláme — bývá „odeslat").
- **Allowlist obsahu:** ukládá se HTML jen z: `p, br, strong, em, u, h1, h2, h3, ul, ol, li,
  a[href], blockquote`. **Server vstup očistí** (klient není bezpečnostní hranice) — viz spec §3.
- **Vložené vs. samostatné (progresivní odkrývání):** u jiného objektu (úkol/výkaz — později)
  je editor kompaktní / skrytý za tužkou ✎ (vzor §18); plný s lištou jen na samostatné
  poznámce. Stejná komponenta, dva rendery.
- **Aria:** `.note-toolbar` má `role="toolbar"` + `aria-label`; tlačítka `aria-label`/`title`;
  `.note-area` `aria-label`.
- **Rozšíření (později):** obrázky a přílohy (lišta s nimi počítá), `@zmínky`.

---

## 25. Feed „Aktivity" — read-only přehled dění

**Read-only** chronologický přehled na detailu zákazníka (firma/osoba): **lupa nad událostmi**
(tabulka `events`), kam moduly samy zapisují přes `logEvent()`. Žádné vlastní úložiště, žádný zápis
odtud. Komponenta `ActivityFeed` v `components.tsx`. Mockup: `mockupy/komponenty.html` §16. Spec:
[docs/specs/feed-v1.md](specs/feed-v1.md). Vize: [VIZE — Feed](VIZE-feed-a-prilezitosti.md).

- **Struktura:** záložka **„Aktivity"** (přejmenovaná „Historie"; **Poznámky** mají vlastní záložku) ›
  filtr typů (`.tabs`) › chronologické řádky událostí (nejnovější nahoře).
- **Řádek = ikona typu + autor + čas + text události.** Typ nese kruhová ikona **`.feed-ico`**
  (varianty `--note`/`--task`/`--work` = barva akcentu; `--contact`/`--system` = utlumené). SVG Feather.
- **Klasifikace typu** (`activityKind`) podle prefixu textu události: „Přidána/Upravena/Smazána
  poznámka" → note; „Úkol …" → task; „Výkaz …" → work; obsahuje „kontakt" → contact; jinak → system.
- **Filtr po typu** (`.tabs`): Vše · Poznámky · Úkoly · Výkazy · Ostatní — přes `?atyp=note|task|work|other`.
- **Realtime:** záložka je živá zóna (`hx-trigger="live-update from:body"`); nové dění se objeví samo.
- **CSS:** `.feed-ico` (+ varianty) je v `public/theme.css` **i** `mockupy/styl.css`.
- **Prázdné stavy:** „Zatím se tu nic nedělo." / při filtru „V tomto filtru zatím nic není."
- **Budoucí (ne ve v1):** ruční záznam komunikace (hovor/schůzka/e-mail přes editor §24), skupina
  „Nadcházející", follow-up úkol — přijde s modulem **Komunikace**; mockup §16 to ukazuje jako „budoucí".

---

## 26. Poznámky — nadpis + zobrazení Seznam / Mozaika

Poznámka má **volitelný nadpis** (`title`, prostý text) + formátované tělo (editor §24). Na záložce
**Poznámky** dva pohledy, volba **per uživatel** (`person_prefs`, klíč `poznamky.view`): **Seznam**
(řádky pod sebou) a **Mozaika** (karty ve dvou sloupcích, Google Keep styl). Komponenty `NotesTab` /
`NoteCard` v `poznamky.tsx`. Mockup: `mockupy/komponenty.html` §17. Spec poznámek: [docs/specs/poznamky.md](specs/poznamky.md).

- **Nadpis:** vstup `.input` nad editorem v modálu; v kartě `.note-title` (tučně, nad tělem). Prázdný = nezobrazí se.
- **Seznam (`layout="list"`):** původní řádek — avatar autora + meta (autor · čas · chipy) + nadpis + tělo.
- **Mozaika (`layout="grid"`):** karta `.card.note-card` v kontejneru `.notes-grid` (CSS `columns: 2`,
  `break-inside: avoid`; na mobilu 1 sloupec). Karty plynou po sloupcích (masonry-like, jako Keep).
- **Přepínač** `.tabs` (Seznam/Mozaika) v hlavičce karty; odkazy `?tab=poznamky&pview=seznam|mozaika`.
  Volba se uloží do `person_prefs` a drží i po realtime překreslení živé zóny.
- **CSS** `.note-title`, `.notes-grid`, `.notes-grid .note-card` v `public/theme.css` **i** `mockupy/styl.css`.
- Akce (⋯: Upravit / Vytvořit úkol / viditelnost / Smazat) a chipy „Soukromá" / „u osoby X" fungují v obou pohledech.

---

## Jak katalog rozšiřovat

1. Nový prvek nejdřív navrhnout v `mockupy/komponenty.html` (vidět = schválit),
2. zapsat sem (kdy použít, kód, pravidla),
3. teprve pak použít v modulu. Tím zůstane UI konzistentní.
