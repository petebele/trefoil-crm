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
// Najde nejbližší předka, který ořezává obsah (overflow auto/scroll/hidden/clip) —
// např. vodorovně scrollovatelnou tabulku. Uvnitř něj by se rozbalený panel schoval
// pod okraj, proto ho v takovém případě ukotvíme napevno (fixed) k spouštěči.
function clippingAncestor(el) {
  for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    var s = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(s.overflowX + ' ' + s.overflowY + ' ' + s.overflow)) return p;
  }
  return null;
}
function resetPanelPos(panel) {
  panel.style.position = '';
  panel.style.left = panel.style.right = panel.style.top = panel.style.bottom = '';
}
function onPanelOpen(menu) {
  var panel = menu.querySelector(':scope > .menu-list');
  if (!panel) return;
  menu.classList.remove('up');
  resetPanelPos(panel);
  requestAnimationFrame(function () {
    var trigger = menu.querySelector('[data-menu-toggle]') || menu;
    var tr = trigger.getBoundingClientRect(), ph = panel.offsetHeight;
    var up = tr.bottom + 6 + ph > window.innerHeight - 8 && tr.top - 6 - ph > 8;
    if (up) menu.classList.add('up');
    if (clippingAncestor(menu)) {
      panel.style.position = 'fixed';
      var pw = panel.offsetWidth, vw = window.innerWidth;
      // vodorovně: align-right otevírá doleva; u levého okraje by panel vyjel z obrazovky → přepni doprava. Vždy ořízni do okna.
      var left;
      if (menu.classList.contains('align-right')) left = (tr.right - pw < 8) ? tr.left : tr.right - pw;
      else left = tr.left;
      left = Math.max(8, Math.min(left, vw - 8 - pw));
      panel.style.left = left + 'px'; panel.style.right = 'auto';
      if (up) { panel.style.bottom = (window.innerHeight - tr.top + 6) + 'px'; panel.style.top = 'auto'; }
      else { panel.style.top = (tr.bottom + 6) + 'px'; panel.style.bottom = 'auto'; }
    }
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
// Klikací názvy/popisy ([data-activate], role=button): Enter/mezerník otevře (editaci).
document.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-activate]')) {
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

// Velký modál: zavření křížkem [data-modal-close] nebo „Zrušit" = VŽDY. Klik na pozadí / Esc
// zavře jen modál BEZ uživatelských změn (předvyplněné z kontextu se nepočítají) — ať se omylem
// neztratí rozdělaná data. „Změnu" pozná podle vstupu (input/change) uvnitř #modal.
var modalDirty = false;
function closeModal() { var m = document.getElementById('modal'); if (m) m.innerHTML = ''; modalDirty = false; }
document.body.addEventListener('htmx:afterSwap', function (e) {
  var t = e.target; if (t && (t.id === 'modal' || (t.closest && t.closest('#modal')))) modalDirty = false;
});
document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('#modal')) modalDirty = true; });
document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('#modal')) modalDirty = true; });
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-modal-close]')) { closeModal(); return; }                 // ✕ / Zrušit — vždy
  if (e.target.classList.contains('modal-overlay') && !modalDirty) closeModal();        // klik vedle — jen bez změn
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var m = document.getElementById('modal');
  if (m && m.innerHTML) { if (!modalDirty) closeModal(); return; }                       // Esc — jen bez změn
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

// Kanban drag-drop: karty .kcard mezi/uvnitř sloupců (.kcol-body), a sloupce za úchyt .kcol-grip.
// Po dropu se pošle nové uspořádání na server a #board se překreslí (htmx swap).
(function () {
  var cardId = null, colId = null, lastDragEnd = 0;
  function boardQuery() {
    var board = document.getElementById('board');
    try { return new URL(board.getAttribute('hx-get'), location.href).search; } catch (_) { return ''; }
  }
  function afterCard(body, y) {
    var cards = Array.prototype.slice.call(body.querySelectorAll('.kcard:not(.dragging)'));
    var closest = null, off0 = -Infinity;
    cards.forEach(function (c) { var b = c.getBoundingClientRect(); var off = y - b.top - b.height / 2; if (off < 0 && off > off0) { off0 = off; closest = c; } });
    return closest;
  }
  function afterCol(kanban, x) {
    var cols = Array.prototype.slice.call(kanban.querySelectorAll('.kcol:not(.col-dragging):not(.kcol-add)'));
    var closest = null, off0 = -Infinity;
    cols.forEach(function (c) { var b = c.getBoundingClientRect(); var off = x - b.left - b.width / 2; if (off < 0 && off > off0) { off0 = off; closest = c; } });
    return closest;
  }
  document.addEventListener('dragstart', function (e) {
    var nameEl = e.target.closest && e.target.closest('.kcol-name[data-col-id]');
    if (nameEl) { colId = nameEl.getAttribute('data-col-id'); var col = nameEl.closest('.kcol'); if (col) col.classList.add('col-dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', colId); } catch (_) {} return; }
    var card = e.target.closest && e.target.closest('.kcard');
    if (!card) return;
    cardId = card.getAttribute('data-task-id');
    card.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', cardId); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
  });
  document.addEventListener('dragend', function () {
    var d = document.querySelector('.kcard.dragging'); if (d) d.classList.remove('dragging');
    var c = document.querySelector('.kcol.col-dragging'); if (c) c.classList.remove('col-dragging');
    cardId = null; colId = null; lastDragEnd = Date.now();
  });
  // Pojistka: nativní drag&drop sice po tažení klik negeneruje, ale kdyby ho někdy
  // některý prohlížeč „dotáhl" do kliknutí, spolkni klik na kartě/řádku těsně po tažení
  // (jinak by se po přetažení omylem otevřel modál editace).
  document.addEventListener('click', function (e) {
    if (Date.now() - lastDragEnd < 300 && e.target.closest && e.target.closest('.kcard, .task-item')) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  document.addEventListener('dragover', function (e) {
    if (colId) {
      var kanban = e.target.closest && e.target.closest('.kanban'); if (!kanban) return;
      e.preventDefault();
      var dragging = kanban.querySelector('.kcol.col-dragging'); if (!dragging) return;
      var after = afterCol(kanban, e.clientX);
      var addCol = kanban.querySelector('.kcol-add');
      if (after == null) kanban.insertBefore(dragging, addCol || null); else kanban.insertBefore(dragging, after);
      return;
    }
    if (cardId) {
      var body = e.target.closest && e.target.closest('.kcol-body'); if (!body) return;
      e.preventDefault();
      var card = document.querySelector('.kcard.dragging'); if (!card) return;
      var a = afterCard(body, e.clientY);
      if (a == null) body.appendChild(card); else body.insertBefore(card, a);
    }
  });
  document.addEventListener('drop', function (e) {
    if (!window.htmx) { cardId = null; colId = null; return; }
    if (colId) {
      var kanban = e.target.closest && e.target.closest('.kanban'); if (!kanban) { colId = null; return; }
      e.preventDefault();
      var order = Array.prototype.map.call(kanban.querySelectorAll('.kcol-name[data-col-id]'), function (g) { return g.getAttribute('data-col-id'); }).join(',');
      window.htmx.ajax('POST', '/ukoly/kanban/sloupce/poradi' + boardQuery(), { target: '#board', swap: 'outerHTML', values: { order: order } });
      colId = null;
      return;
    }
    if (cardId) {
      var body = e.target.closest && e.target.closest('.kcol-body'); if (!body) { cardId = null; return; }
      e.preventDefault();
      var statusId = body.getAttribute('data-status-id');
      var inbox = body.getAttribute('data-inbox') === '1' ? '1' : '';
      var order = Array.prototype.map.call(body.querySelectorAll('.kcard'), function (c) { return c.getAttribute('data-task-id'); }).join(',');
      window.htmx.ajax('POST', '/ukoly/' + cardId + '/presun' + boardQuery(), { target: '#board', swap: 'outerHTML', values: { status_id: statusId, inbox: inbox, order: order } });
      cardId = null;
    }
  });
})();

// ---------- Editor poznámky (rich text, bez knihoven) ----------
// contenteditable .note-area + lišta .note-toolbar; formátování přes execCommand.
// Enter = <p>, Shift+Enter = <br>. Nadpis/citace = přepínače. B je v nadpisu neaktivní.
// Vše delegovaně (editor se načítá do modálu dynamicky). Viz docs/KOMPONENTY.md §24.
(function () {
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  function curBlock(area) {
    var sel = window.getSelection(); if (!sel || !sel.rangeCount) return '';
    var n = sel.anchorNode;
    while (n && n !== area) { if (n.nodeType === 1 && /^(H1|H2|H3|H4|BLOCKQUOTE|P)$/.test(n.nodeName)) return n.nodeName; n = n.parentNode; }
    return '';
  }
  function toggleBlock(area, tag) { document.execCommand('formatBlock', false, curBlock(area) === tag ? 'P' : tag); }
  function sync(bar, area) {
    var blk = curBlock(area), inHeading = /^H[1-3]$/.test(blk);
    ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach(function (cmd) {
      bar.querySelectorAll('[data-cmd="' + cmd + '"]').forEach(function (b) {
        var on = false; try { on = document.queryCommandState(cmd); } catch (e) {}
        if (cmd === 'bold' && inHeading) on = false; // nadpis je tučný ze stylu
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    bar.querySelectorAll('[data-block]').forEach(function (b) {
      b.setAttribute('aria-pressed', blk === b.getAttribute('data-block') ? 'true' : 'false');
    });
  }
  function areaOf(el) { var ed = el.closest('.note-editor'); return ed ? ed.querySelector('.note-area') : null; }
  // Vymazání formátování: dotčené bloky (i seznamy/nadpisy/citace) → prosté odstavce s holým textem.
  // Spolehlivější než execCommand (to nechávalo zbytky při kombinaci nadpis+seznam apod.).
  function topBlocks(area, range) {
    function top(node) {
      if (node === area) return null;
      while (node && node.parentNode && node.parentNode !== area) node = node.parentNode;
      return (node && node.parentNode === area) ? node : null;
    }
    var s = top(range.startContainer) || area.firstChild;
    var e = top(range.endContainer) || area.lastChild;
    var blocks = [], n = s;
    while (n) { blocks.push(n); if (n === e) break; n = n.nextSibling; }
    return blocks;
  }
  function clearFormat(area) {
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var blocks = topBlocks(area, sel.getRangeAt(0)); if (!blocks.length) return;
    var frag = document.createDocumentFragment(), last = null;
    blocks.forEach(function (b) {
      if (b.nodeType === 1 && (b.tagName === 'UL' || b.tagName === 'OL')) {
        Array.prototype.forEach.call(b.querySelectorAll('li'), function (li) {
          var t = (li.textContent || '').trim(); if (!t) return;
          var p = document.createElement('p'); p.textContent = t; frag.appendChild(p); last = p;
        });
      } else {
        var p = document.createElement('p'), t = (b.textContent || '').trim();
        if (t) p.textContent = t; else p.innerHTML = '<br>';
        frag.appendChild(p); last = p;
      }
    });
    if (!last) return;
    var ref = blocks[blocks.length - 1].nextSibling;
    blocks.forEach(function (b) { if (b.parentNode === area) area.removeChild(b); });
    area.insertBefore(frag, ref);
    var r = document.createRange(); r.selectNodeContents(last); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // neztratit výběr při kliknutí do lišty
  document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.note-toolbar')) e.preventDefault(); });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.note-toolbar button'); if (!btn) return;
    var area = areaOf(btn); if (!area) return;
    var bar = btn.closest('.note-toolbar');
    area.focus();
    if (btn.dataset.block) {
      toggleBlock(area, btn.dataset.block);
    } else if (btn.dataset.cmd === 'createLink') {
      var url = prompt('Adresa odkazu (https://…):', 'https://'); if (url) document.execCommand('createLink', false, url);
    } else if (btn.dataset.cmd === 'clearformat') {
      clearFormat(area);
    } else if (btn.dataset.cmd === 'bold' && /^H[1-3]$/.test(curBlock(area))) {
      /* nadpis je tučný ze stylu — B nic nedělá */
    } else if (btn.dataset.cmd) {
      document.execCommand(btn.dataset.cmd, false, null);
    }
    sync(bar, area);
  });
  document.addEventListener('selectionchange', function () {
    var sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
    var n = sel.anchorNode; var el = n && (n.nodeType === 1 ? n : n.parentElement);
    var area = el && el.closest ? el.closest('.note-area') : null; if (!area) return;
    var ed = area.closest('.note-editor'); var bar = ed && ed.querySelector('.note-toolbar'); if (bar) sync(bar, area);
  });
  // placeholder: třída .is-empty když je plocha prázdná (i s prázdným <p><br></p>)
  document.addEventListener('input', function (e) {
    var area = e.target.closest && e.target.closest('.note-area'); if (!area) return;
    area.classList.toggle('is-empty', area.textContent.replace(/ /g, '').trim() === '');
  });
  // při odeslání formuláře přenes obsah editoru do skrytého pole body_html
  document.addEventListener('submit', function (e) {
    var form = e.target; if (!form || !form.querySelector) return;
    var area = form.querySelector('.note-area'); if (!area) return;
    var hid = form.querySelector('input[name="body_html"]'); if (hid) hid.value = area.innerHTML;
  });
})();
