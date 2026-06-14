// Trefoil CRM — drobné chování UI (bez závislostí).

// Skiny (motivy): atribut data-skin na <html> řídí barvy. Konfiguraci (seznam
// skinů + výchozí světlý/tmavý) zveřejní skript v <head> do window.__skins (viz
// src/web/skins.ts) a nastaví motiv ještě před vykreslením. Tady řešíme jen
// přepínání a synchronizaci.
(function () {
  var cfg = window.__skins || { ids: [], def: 'classic-light', dark: 'classic-dark' };
  function stored() {
    try { return localStorage.getItem('skin'); } catch (e) { return null; }
  }
  function current() {
    var s = stored();
    if (!s || cfg.ids.indexOf(s) < 0) {
      s = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? cfg.dark : cfg.def;
    }
    return s;
  }
  function apply() {
    var s = current();
    document.documentElement.setAttribute('data-skin', s);
    document.querySelectorAll('[data-skin-set]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-skin-set') === s ? 'true' : 'false');
    });
  }
  // klik na volbu skinu: ulož a okamžitě přepni (menu i submenu zůstávají otevřené)
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-skin-set]');
    if (!b) return;
    try { localStorage.setItem('skin', b.getAttribute('data-skin-set')); } catch (e2) {}
    apply();
  });
  // změna systémového motivu se projeví jen pokud uživatel sám nic nevybral
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onSys = function () { if (!stored()) apply(); };
    mq.addEventListener ? mq.addEventListener('change', onSys) : mq.addListener(onSys);
  }
  // přepnutí v jednom okně se promítne do ostatních otevřených oken/záložek
  window.addEventListener('storage', function (e) { if (e.key === 'skin') apply(); });
  apply();
})();

// Submenu (vyskakovací) v rozbalovacím menu: klik na [data-submenu-toggle] přepne
// .open na nadřazeném .submenu; klik mimo .submenu ho zavře (klik na položku uvnitř
// ho nechá otevřené, ať jde vyzkoušet víc voleb). Na myši stačí najetí (CSS :hover).
document.addEventListener('click', function (e) {
  var subToggle = e.target.closest('[data-submenu-toggle]');
  if (subToggle) {
    var sm = subToggle.closest('.submenu');
    if (sm) sm.classList.toggle('open');
    return;
  }
  if (!e.target.closest('.submenu')) {
    document.querySelectorAll('.submenu.open').forEach(function (s) { s.classList.remove('open'); });
  }
});

// Realtime: poslouchej události ze serveru (SSE) a dej vědět živým zónám
// (elementy s hx-trigger="live-update from:body" se samy překreslí).
if (document.querySelector('.topbar')) {
  try {
    var liveSource = new EventSource('/live');
    liveSource.onmessage = function () {
      document.body.dispatchEvent(new Event('live-update'));
    };
  } catch (e) {
    /* starý prohlížeč bez SSE — aplikace funguje dál bez živých aktualizací */
  }
}
// Rozbalovací menu/panel: klik na [data-menu-toggle] přepne .open, klik mimo zavře.
// Klik DOVNITŘ otevřeného panelu (pole, našeptávač…) ho nechává otevřený.
document.addEventListener('click', function (e) {
  var toggle = e.target.closest('[data-menu-toggle]');
  var insideMenu = e.target.closest('.menu');
  document.querySelectorAll('.menu.open').forEach(function (menu) {
    if (toggle ? menu.id !== toggle.getAttribute('data-menu-toggle') : menu !== insideMenu) {
      menu.classList.remove('open'); menu.classList.remove('up');
    }
  });
  if (toggle) {
    var menu = document.getElementById(toggle.getAttribute('data-menu-toggle'));
    if (menu) { if (menu.classList.toggle('open')) onPanelOpen(menu); else menu.classList.remove('up'); }
  }
});

// Po otevření panelu (editace pole): kurzor do prvního pole (+ označit text), flip nad
// pole, když by panel spadl pod spodní okraj okna, a dorovnání výšky rostoucích textarea.
function onPanelOpen(menu) {
  var panel = menu.querySelector(':scope > .menu-list');
  if (!panel) return;
  menu.classList.remove('up');
  requestAnimationFrame(function () {
    var trigger = menu.querySelector('[data-menu-toggle]') || menu;
    var tr = trigger.getBoundingClientRect(), ph = panel.offsetHeight;
    if (tr.bottom + 6 + ph > window.innerHeight - 8 && tr.top - 6 - ph > 8) menu.classList.add('up');
    panel.querySelectorAll('textarea[data-autogrow]').forEach(autogrow);
    var f = panel.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea');
    if (f) { f.focus(); if (f.select) f.select(); }
  });
}
function autogrow(t) {
  t.style.height = 'auto';
  var cs = getComputedStyle(t), line = parseFloat(cs.lineHeight) || 20;
  var extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  var min = Math.round(line * 3 + extra), max = Math.round(line * 10 + extra);
  t.style.height = Math.min(max, Math.max(min, t.scrollHeight)) + 'px';
  t.style.overflowY = t.scrollHeight > max + 1 ? 'auto' : 'hidden';
}
document.addEventListener('input', function (e) {
  if (e.target.matches && e.target.matches('textarea[data-autogrow]')) autogrow(e.target);
});
// Klávesnice: Enter/Space na ne-tlačítkové editovatelné hodnotě [data-menu-toggle] ji otevře.
document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches &&
      e.target.matches('[data-menu-toggle]') && e.target.tagName !== 'BUTTON') {
    e.preventDefault(); e.target.click();
  }
});

// Po úspěšné akci spuštěné zevnitř panelu panel zavři.
document.body.addEventListener('htmx:afterRequest', function (e) {
  var src = e.detail && e.detail.elt;
  if (src && src.closest) {
    var menu = src.closest('.menu.open');
    if (menu) { menu.classList.remove('open'); menu.classList.remove('up'); }
  }
});

// Dropdown panel: psaní v [data-filter-list] filtruje .opt položky panelu.
document.addEventListener('input', function (e) {
  var inp = e.target.closest('[data-filter-list]');
  if (!inp) return;
  var q = inp.value.toLowerCase();
  var list = inp.closest('.menu-list');
  if (!list) return;
  list.querySelectorAll('.opt').forEach(function (o) {
    o.style.display = o.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
  });
});

// Velký modál: zavření křížkem [data-modal-close], klikem na pozadí nebo klávesou Esc.
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-modal-close]') || e.target.classList.contains('modal-overlay')) {
    var m = document.getElementById('modal');
    if (m) m.innerHTML = '';
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var m = document.getElementById('modal');
  if (m && m.innerHTML) { m.innerHTML = ''; return; }
  document.querySelectorAll('.menu.open').forEach(function (menu) { menu.classList.remove('open'); menu.classList.remove('up'); });
});

// Odkrytí skrytých polí: [data-reveal="idCile"] přepne .hidden (např. „Vyplnit údaje").
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-reveal]');
  if (!t) return;
  var el = document.getElementById(t.getAttribute('data-reveal'));
  if (el) el.classList.toggle('hidden');
});

// Formuláře: tlačítko [data-add-row="idTemplate"] přidá další řádek (např. kontakt).
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-add-row]');
  if (!btn) return;
  var tpl = document.getElementById(btn.getAttribute('data-add-row'));
  if (tpl && tpl.content) tpl.parentNode.insertBefore(tpl.content.cloneNode(true), tpl);
});

// Formuláře: tlačítko [data-remove-row] odebere nejbližší řádek .crow (modál „Upravit kontakty").
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-remove-row]');
  if (!btn) return;
  var row = btn.closest('.crow');
  if (row) row.remove();
});

// Závislá pole: prvek s data-depends-on="jménoPole" data-depends-value="a,b" je vidět,
// jen když má pole daného jména ve stejném formuláři jednu z uvedených hodnot.
function updateDependentFields(scope) {
  (scope || document).querySelectorAll('[data-depends-on]').forEach(function (el) {
    var form = el.closest('form');
    if (!form) return;
    var field = form.querySelector('[name="' + el.getAttribute('data-depends-on') + '"]');
    var values = (el.getAttribute('data-depends-value') || '').split(',');
    el.classList.toggle('hidden', !(field && values.indexOf(field.value) !== -1));
  });
}
document.addEventListener('change', function (e) {
  var form = e.target.closest && e.target.closest('form');
  if (form) updateDependentFields(form);
});
document.addEventListener('DOMContentLoaded', function () {
  updateDependentFields(document);
});
document.body.addEventListener('htmx:afterSwap', function () {
  updateDependentFields(document);
});

// Výchozí hodnoty z katalogu: <select data-defaults> nese na <option> atributy
// data-set-<pole> (např. data-set-mode, data-set-rate). Při výběru se hodnoty
// propíší do polí formuláře a u odpovídající volby selectu se ukáže „(výchozí)".
document.addEventListener('change', function (e) {
  var sel = e.target.closest && e.target.closest('select[data-defaults]');
  if (!sel) return;
  var form = sel.closest('form');
  var opt = sel.selectedOptions && sel.selectedOptions[0];
  if (!form || !opt) return;
  Object.keys(opt.dataset).forEach(function (key) {
    if (key.indexOf('set') !== 0) return;
    var name = key.charAt(3).toLowerCase() + key.slice(4);
    var field = form.querySelector('[name="' + name + '"]');
    if (field) field.value = opt.dataset[key] || '';
    if (field && field.tagName === 'SELECT') {
      Array.from(field.options).forEach(function (o) {
        var base = o.getAttribute('data-base') || o.text;
        o.setAttribute('data-base', base);
        o.text = base + (o.value === opt.dataset[key] ? ' (výchozí)' : '');
      });
    }
  });
  updateDependentFields(form);
});
