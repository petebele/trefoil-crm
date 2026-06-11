// Conviu CRM — drobné chování UI (bez závislostí).
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

// Formuláře: tlačítko [data-add-row="idTemplate"] přidá další řádek (např. kontakt).
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-add-row]');
  if (!btn) return;
  var tpl = document.getElementById(btn.getAttribute('data-add-row'));
  if (tpl && tpl.content) tpl.parentNode.insertBefore(tpl.content.cloneNode(true), tpl);
});
