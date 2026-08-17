// ── supabase/player-card.js — ficha de jugador estilo "locker" ───────────
// FUENTE ÚNICA del formato de ficha usado en Facultad.html. Extraído tal cual
// de supabase/academic-page.js (mismo CSS, misma estructura, misma rareza por
// categoría) para poder reutilizarlo sin duplicar estilos ni markup.
// Cargar DESPUÉS de supabase/public-links.js y ANTES de quien lo consuma.

(function(global){
  'use strict';

  function el(tag, cls, html){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  const FN_CARD_STYLE = [
    // Las fichas viven en páginas que no cargan css/perfil-jugador.css, así
    // que las dos variables tipográficas se definen aquí como respaldo local
    // (mismos valores que :root en css/perfil-jugador.css).
    '.fn-card{--fj-cond:\'HN Display\',\'Saira Condensed\',sans-serif;--fj-lab:\'Burbank Regular Bold\',\'Saira Condensed\',sans-serif}',
    '.fn-card{position:relative;overflow:hidden;isolation:isolate;padding:14px 16px 14px 86px;min-height:96px;',
      'display:flex;flex-direction:column;justify-content:center;',
      'border:1.5px solid var(--fn-bd,rgba(255,255,255,0.18));',
      'background:linear-gradient(158deg,var(--fn-2,#2a1f14) 0%,var(--fn-1,#140d08) 100%);',
      'clip-path:polygon(0 10px,10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);',
      'transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}',
    '.fn-card::before{content:"";position:absolute;left:0;top:0;width:70%;height:100%;',
      'background:radial-gradient(ellipse at left,var(--fn-glow,rgba(245,166,35,0.4)) 0%,transparent 65%);z-index:0;pointer-events:none}',
    '.fn-card::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;',
      'background:linear-gradient(135deg,rgba(255,255,255,0.1) 0,transparent 24%)}',
    '.fn-card:hover{transform:translateY(-3px);box-shadow:0 14px 28px -16px var(--fn-glow,rgba(245,166,35,0.6));filter:saturate(1.14)}',
    '.fn-portrait{position:absolute;left:14px;top:21px;z-index:2;width:56px;height:56px;display:flex;align-items:center;justify-content:center}',
    '.fn-portrait .fn-emblem{display:flex;align-items:center;justify-content:center;width:100%;height:100%}',
    '.fn-portrait img{width:56px;height:56px;object-fit:contain;filter:brightness(1.7) drop-shadow(0 3px 6px rgba(0,0,0,0.6))}',
    '.fn-mono{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
      'font-family:"Heading Now 6",var(--fj-cond);font-weight:900;font-size:26px;color:#fff;',
      'background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.4)}',
    '.fn-tier{position:absolute;z-index:2;top:10px;right:10px;overflow:hidden;font-family:var(--fj-lab);font-weight:800;',
      'font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#fff;padding:3px 10px;',
      'background:var(--fn-ac,#f5a623);text-shadow:0 1px 1px rgba(0,0,0,0.45);',
      'clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}',
    '.fn-tier::after{content:"";position:absolute;top:0;left:-70%;width:70%;height:100%;pointer-events:none;will-change:transform;',
      'background:linear-gradient(100deg,transparent 0%,transparent 30%,rgba(255,255,255,0.9) 50%,transparent 70%,transparent 100%);',
      'animation:fnTierSheen 13s ease-in-out infinite}',
    '@keyframes fnTierSheen{0%{transform:translateX(0)}65%{transform:translateX(270%)}100%{transform:translateX(270%)}}',
    '@media (prefers-reduced-motion: reduce){.fn-tier::after{animation:none;display:none}}',
    '.fn-body{position:relative;z-index:2;width:100%}',
    '.fn-name{font-family:"Burbank Regular Bold","Heading Now 6",var(--fj-cond);font-weight:700;font-size:19px;',
      'line-height:1.05;color:#f6efe2;text-wrap:balance;text-shadow:0 2px 4px rgba(0,0,0,0.55);',
      // El nombre nunca cruza la línea vertical donde arranca la insignia de
      // categoría: --fn-tier-gap lo mide en vivo (syncTierGuides). Se queda en
      // UNA sola línea y lo que no cabe se corta con puntos suspensivos.
      'padding-right:var(--fn-tier-gap,0px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fn-name a{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.fn-name a{color:#f6efe2;text-decoration:none} .fn-name a:hover{color:#fff;text-decoration:underline}',
    '.fn-career{margin-top:5px;font-family:var(--mono);font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.72)}',
    '.fn-lastedition{margin-top:3px;font-family:var(--mono);font-size:8.5px;letter-spacing:0.04em;color:rgba(255,255,255,0.45)}',
    '.fn-avanzado{--fn-1:#1c0d0a;--fn-2:#5c1d14;--fn-glow:rgba(221,59,44,0.5);--fn-ac:#dd3b2c;--fn-bd:rgba(221,59,44,0.55)}',
    '.fn-intermedio{--fn-1:#0a1024;--fn-2:#152b5c;--fn-glow:rgba(58,99,240,0.5);--fn-ac:#3a63f0;--fn-bd:rgba(58,99,240,0.55)}',
    '.fn-principiante{--fn-1:#081a11;--fn-2:#12452b;--fn-glow:rgba(55,187,102,0.5);--fn-ac:#37bb66;--fn-bd:rgba(55,187,102,0.55)}',
    '.fn-neutral{--fn-1:#1c1206;--fn-2:#5c3b11;--fn-glow:rgba(245,166,35,0.5);--fn-ac:#f5a623;--fn-bd:rgba(245,166,35,0.55)}'
  ].join('');

  function ensureFnStyles(){
    if (document.getElementById('fn-card-styles')) return;
    const s = document.createElement('style'); s.id = 'fn-card-styles';
    s.textContent = FN_CARD_STYLE; document.head.appendChild(s);
  }

  function fnRarity(r){
    const cat = String(r.category_name || r.category_code || '').toUpperCase();
    if (cat.indexOf('AVANZ') >= 0) return 'avanzado';
    if (cat.indexOf('INTER') >= 0) return 'intermedio';
    if (cat.indexOf('PRINCIP') >= 0 || cat.indexOf('NOVAT') >= 0 || cat.indexOf('BÁSIC') >= 0 || cat.indexOf('BASIC') >= 0) return 'principiante';
    return 'neutral';
  }

  function playerCard(r){
    ensureFnStyles();
    const c = el('div', 'fn-card fn-' + fnRarity(r));
    const port = el('div', 'fn-portrait');
    const logo = r.faculty_code ? global.SB_LINKS.makeAcademicLogoLink(r.faculty_code, r.career_code, r.faculty_name, r.career_name) : null;
    if (logo){ logo.classList.add('fn-emblem'); port.appendChild(logo); }
    else { port.appendChild(el('div', 'fn-mono', (String(r.nickname || '?').trim().charAt(0) || '?').toUpperCase())); }
    c.appendChild(port);
    const catText = r.category_name ? String(r.category_name).replace(/\s*\/\s*open\s*$/i, '').trim() : (r.category_code || 'Jugador');
    const tier = el('div', 'fn-tier'); tier.textContent = catText;
    c.appendChild(tier);
    observeTier(tier);
    const body = el('div', 'fn-body');
    const name = el('div', 'fn-name');
    name.title = String(r.nickname || '');
    name.appendChild(global.SB_LINKS.makePlayerLink(r.nickname, r.registration_id));
    body.appendChild(name);
    if (r.career_name || r.career_code){
      const car = el('div', 'fn-career'); car.textContent = r.career_name || r.career_code;
      body.appendChild(car);
    }
    if (r.is_current_edition === false && r.last_edition_name){
      const m = String(r.last_edition_slug || r.last_edition_name || '').match(/(\d{4})-(\d+)/);
      const edLabel = m ? (m[1] + '-' + m[2]) : r.last_edition_name;
      const le = el('div', 'fn-lastedition'); le.textContent = 'Última participación: ' + edLabel;
      body.appendChild(le);
    }
    c.appendChild(body);
    queueTierSync();
    return c;
  }

  // ── Línea vertical imaginaria: el nombre se corta justo donde empieza el
  //    rectángulo de categoría. Se mide en vivo porque el ancho de la insignia
  //    depende del texto (AVANZADO / INTERMEDIO / PRINCIPIANTE) y del ancho del
  //    dispositivo. Se re-calcula al renderizar, al cambiar de tamaño y cuando
  //    terminan de cargar las tipografías.
  function syncTierGuides(root){
    const cards = (root || document).querySelectorAll('.fn-card');
    if (!cards.length) return true;
    const jobs = [];
    let pending = false;
    cards.forEach(card => {
      const tier = card.querySelector('.fn-tier');
      const name = card.querySelector('.fn-name');
      if (!tier || !name) return;
      const tr = tier.getBoundingClientRect();
      const nr = name.getBoundingClientRect();
      // La ficha todavía no tiene tamaño (contenedor oculto, fuentes sin
      // cargar…): se reintenta más tarde en vez de fijar un límite en 0.
      if (!tr.width || !nr.width){ pending = true; return; }
      const gap = nr.width < 150 ? 5 : 8;
      jobs.push([name, Math.max(0, Math.round(nr.right - tr.left + gap))]);
    });
    jobs.forEach(([name, px]) => { name.style.setProperty('--fn-tier-gap', px + 'px'); });
    return !pending;
  }

  let syncTimer = 0;
  function queueTierSync(){
    if (typeof setTimeout !== 'function') return;
    clearTimeout(syncTimer);
    // Se agenda una sola vez por tanda de fichas. Reintentos escalonados para
    // las que se construyen dentro de un contenedor todavía oculto
    // (Facultad.html arma la lista y después muestra #facBody).
    syncTimer = setTimeout(() => {
      if (!syncTierGuides()) [120, 400, 1000].forEach(ms => setTimeout(() => syncTierGuides(), ms));
    }, 0);
  }

  // El observer cubre el caso general: la insignia cambia de tamaño al pasar
  // de oculto a visible, al cargar las tipografías o al girar el dispositivo.
  let tierRO = null;
  function observeTier(tier){
    if (typeof ResizeObserver !== 'function') return;
    if (!tierRO) tierRO = new ResizeObserver(() => queueTierSync());
    tierRO.observe(tier);
  }

  if (typeof window !== 'undefined'){
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => syncTierGuides(), 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => syncTierGuides());
  }

  global.SB_PLAYER_CARD = { playerCard, fnRarity, ensureFnStyles, syncTierGuides, FN_CARD_STYLE };
})(typeof window !== 'undefined' ? window : globalThis);
