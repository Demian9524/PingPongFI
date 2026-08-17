/* ── NAVBAR FI compartida ──────────────────────────────────────────────────
   Réplica exacta de la barra de "Pagina Torneo.html" (escritorio + móvil).
   Uso:  <nav class="top fi-nav" data-fi-nav data-active="directorio" aria-label="Principal"></nav>
         <link rel="stylesheet" href="css/navbar-fi.css">
         <script src="navbar-fi.js"></script>
   data-active: inicio | directorio | categorias | facultades | (vacío) */
(function(){
  'use strict';
  var nav = document.querySelector('nav[data-fi-nav]');
  if (!nav) return;
  nav.classList.add('top','fi-nav');
  var active = nav.getAttribute('data-active') || '';

  var LINKS = [
    ['inicio',     'Pagina Torneo.html#inicio',      'Inicio'],
    ['directorio', 'Directorio.html',                'Directorio'],
    ['categorias', 'Categoria2.html?code=avanzado', 'Categorías'],
    ['facultades', 'Facultad.html?code=INGENIERIA',  'Facultades']
  ];

  function links(cls){
    return LINKS.map(function(l){
      var on = (l[0] === active) ? ' on' : '';
      var aria = on ? ' aria-current="page"' : '';
      return '<a href="' + l[1] + '" class="' + (cls ? cls : '').trim() + on + '"' + aria + '>' + l[2] + '</a>';
    }).join('');
  }

  /* sprite del icono de cierre (si la página no lo trae) */
  if (!document.getElementById('ico-x')){
    var sp = document.createElement('div');
    sp.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    sp.innerHTML = '<svg width="0" height="0" aria-hidden="true" focusable="false"><defs><symbol id="ico-x" viewBox="0 0 128 128"><path fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" transform="matrix(1 0 -.1228 1 7.86 0)" d="M21 26h24l19 26 19-26h24L78 64l29 38H83L64 76l-19 26H21l29-38-29-38Z"></path></symbol></defs></svg>';
    document.body.insertBefore(sp, document.body.firstChild);
  }

  nav.innerHTML =
    '<div class="nav-in">' +
      '<a class="brand" href="Pagina Torneo.html">' +
        '<img class="logo-main" src="assets/logo-pingpong-v2.png" alt="Ping Pong FI" />' +
        '<img class="logo-gif" src="assets/cerdito-2027-1.gif?v=2027-1" alt="Cerdito Ping Pong FI" />' +
        '<span class="logo-div"></span>' +
        '<img class="logo-fi" src="assets/escudo-fi.svg" alt="Facultad de Ingeniería" />' +
      '</a>' +
      '<div class="nav-links">' + links('') + '</div>' +
      '<div class="nav-right">' +
        '<div class="socials"></div>' +
        '<a class="btn btn-gray" href="Registro.html" style="text-decoration:none"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>Inscribirse</a>' +
        '<button class="hamburger" id="hambBtn" type="button" aria-label="Menú" aria-expanded="false">' +
          '<svg class="hamb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M3 6h18M3 12h18M3 18h18"/></svg>' +
          '<svg class="close-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="mobile-menu" id="mobileMenu" aria-hidden="true">' +
      '<div class="mob-menu-top">' +
        '<div class="mob-menu-logos">' +
          '<img src="assets/cerdito-2027-1.gif?v=2027-1" alt="Cerdito Ping Pong FI" />' +
          '<img src="assets/escudo-fi.svg" alt="Facultad de Ingeniería" />' +
        '</div>' +
        '<button type="button" class="mob-menu-x" id="mobMenuClose" aria-label="Cerrar menú"><svg aria-hidden="true" focusable="false"><use href="#ico-x"></use></svg></button>' +
      '</div>' +
      links('mob-link') +
    '</div>' +
    '<div class="mobile-menu-backdrop" id="mobileMenuBackdrop"></div>';

  document.body.classList.add('fi-nav-body');

  var btn = nav.querySelector('#hambBtn');
  var menu = nav.querySelector('#mobileMenu');
  var backdrop = nav.querySelector('#mobileMenuBackdrop');
  var closeBtn = nav.querySelector('#mobMenuClose');
  if (!btn || !menu) return;
  function setOpen(isOpen){
    menu.classList.toggle('open', isOpen);
    if (backdrop) backdrop.classList.toggle('open', isOpen);
    btn.classList.toggle('open', isOpen);
    btn.style.visibility = isOpen ? 'hidden' : '';
    btn.setAttribute('aria-expanded', String(isOpen));
    menu.setAttribute('aria-hidden', String(!isOpen));
  }
  btn.addEventListener('click', function(){ setOpen(!menu.classList.contains('open')); });
  if (closeBtn) closeBtn.addEventListener('click', function(){ setOpen(false); });
  if (backdrop) backdrop.addEventListener('click', function(){ setOpen(false); });
  menu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ setOpen(false); });
  });
})();
