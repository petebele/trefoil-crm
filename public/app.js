// Conviu CRM — drobné chování UI (bez závislostí).

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
// Rozbalovací menu: klik na [data-menu-toggle] přepne .open, klik mimo zavře.
document.addEventListener('click', function (e) {
  var toggle = e.target.closest('[data-menu-toggle]');
  document.querySelectorAll('.menu.open').forEach(function (menu) {
    if (!toggle || menu.id !== toggle.getAttribute('data-menu-toggle')) menu.classList.remove('open');
  });
  if (toggle) {
    var menu = document.getElementById(toggle.getAttribute('data-menu-toggle'));
    if (menu) menu.classList.toggle('open');
  }
});

// Po úspěšné akci spuštěné zevnitř panelu panel zavři.
document.body.addEventListener('htmx:afterRequest', function (e) {
  var src = e.detail && e.detail.elt;
  if (src && src.closest) {
    var menu = src.closest('.menu.open');
    if (menu) menu.classList.remove('open');
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
  if (e.key === 'Escape') {
    var m = document.getElementById('modal');
    if (m) m.innerHTML = '';
  }
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
