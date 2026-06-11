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
