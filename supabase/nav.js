// ── Navegación global reutilizable (Fase 3) ────────────────────────────
// Uso: <nav class="top" data-site-nav data-active="grupos" aria-label="Principal">
//        <template data-nav-right> …contenido extra del lado derecho… </template>
//      </nav>
// Renderiza: marca + enlaces (desktop) + enlace Admin discreto + menú
// hamburguesa accesible en móvil (focus, Escape, cierre al seleccionar,
// bloqueo de scroll). Requiere css/design-system.css.
// "Pagina Torneo.html" y "Registro.html" conservan su nav propio (hero).

(function(){
  'use strict';
  const nav = document.querySelector('nav[data-site-nav]');
  if (!nav) return;

  const LINKS = [
    ['inicio',     'Pagina Torneo.html', 'Inicio'],
    ['registro',   'Registro.html',      'Registro'],
    ['grupos',     'Grupos.html',        'Grupos'],
    ['categorias', 'Categoria2.html?code=avanzado', 'Categorías'],
    ['directorio', 'Directorio.html',    'Directorio'],
    ['resultados', 'Resultados.html',    'Resultados'],
    ['bracket',    'Bracket.html',       'Bracket']
  ];
  const active = nav.dataset.active || '';
  // El enlace Staff se muestra siempre que la página activa sea admin
  // (para que la página activa quede marcada), aunque data-admin="off".
  const showAdmin = nav.dataset.admin !== 'off' || active === 'admin';

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(key, href, label, cls){
    const a = el('a', cls || null, label);
    a.href = href;
    if (key === active){ a.classList.add('on'); a.setAttribute('aria-current', 'page'); }
    return a;
  }

  // contenido extra del lado derecho (whoami, botones de página, etc.)
  const rightTpl = nav.querySelector('template[data-nav-right]');
  const rightContent = rightTpl ? rightTpl.content.cloneNode(true) : null;

  nav.textContent = '';
  const inWrap = el('div', 'wrap nav-in');
  const brand = el('a', 'brand');
  brand.href = 'Pagina Torneo.html';
  const logo = document.createElement('img');
  logo.className = 'logo-main'; logo.src = 'assets/logo-pingpong.png';
  logo.alt = 'Torneo de Ping Pong FI';
  brand.appendChild(logo);
  inWrap.appendChild(brand);

  const links = el('div', 'nav-links');
  LINKS.forEach(([k, h, l]) => links.appendChild(link(k, h, l)));
  inWrap.appendChild(links);

  const right = el('div', 'nav-right');
  if (rightContent) right.appendChild(rightContent);
  if (showAdmin) right.appendChild(link('admin', 'Admin.html', 'Staff', 'nav-admin'));

  // ── menú móvil ─────────────────────────────────────────────────────
  const burger = el('button', 'nav-burger');
  burger.type = 'button';
  burger.setAttribute('aria-label', 'Abrir menú');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-controls', 'navMobile');
  burger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"></path></svg>';
  right.appendChild(burger);
  inWrap.appendChild(right);
  nav.appendChild(inWrap);

  const mbg = el('div', 'navm-bg');
  const menu = el('div', 'navm');
  menu.id = 'navMobile';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.setAttribute('aria-label', 'Menú');
  const closeBtn = el('button', 'navm-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar menú');
  menu.appendChild(closeBtn);
  LINKS.forEach(([k, h, l]) => menu.appendChild(link(k, h, l)));
  if (showAdmin) menu.appendChild(link('admin', 'Admin.html', 'Panel de organizadores', 'adm'));
  document.body.appendChild(mbg);
  document.body.appendChild(menu);

  let open = false;
  function setOpen(v){
    open = v;
    menu.classList.toggle('open', v);
    mbg.classList.toggle('open', v);
    burger.setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('nav-locked', v);
    if (v) closeBtn.focus(); else burger.focus();
  }
  burger.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  mbg.addEventListener('click', () => setOpen(false));
  menu.addEventListener('click', e => { if (e.target.tagName === 'A') setOpen(false); });
  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape'){ setOpen(false); return; }
    if (e.key === 'Tab'){ // foco atrapado dentro del menú
      const f = menu.querySelectorAll('button, a');
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
})();
