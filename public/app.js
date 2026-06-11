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

// Formuláře: tlačítko [data-add-row="idTemplate"] přidá další řádek (např. kontakt).
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-add-row]');
  if (!btn) return;
  var tpl = document.getElementById(btn.getAttribute('data-add-row'));
  if (tpl && tpl.content) tpl.parentNode.insertBefore(tpl.content.cloneNode(true), tpl);
});
