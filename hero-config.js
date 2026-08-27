// ── Hero loading-screen: configuración compartida ────────────────────
// Fuente única de verdad de los slides del hero (fondo + persona) para la
// página pública (Pagina Torneo.html) y el Centro de control
// (ControlTorneo.html → supabase/hero-admin.js).
//
// Config guardada: localStorage 'torneo_hero_cfg_v1' (cache para pintar sin
// parpadeo) + Supabase site_settings vía RPC admin_save_site_setting, igual
// que la visibilidad de secciones. Forma:
//   { "0": { bg:'assets/…png', person:'assets/…png', show:'both' }, … }
// show: 'both' | 'bg' (solo fondo) | 'person' (solo persona) | 'none'
// (el slide no entra a la rotación).
//
// El índice de cada slide manda las animaciones y encuadres del CSS
// (.hero-slide[data-slide="N"]), así que nunca se reordena: cambiar las
// imágenes de un slide conserva su animación.
(function(global){
  'use strict';
  const KEY = 'torneo_hero_cfg_v1';

  const BASE = [
    { label:'Parque exterior · día',   bg:'assets/hero-park.png?v=2',  person:'assets/person-1-cut.png' },
    { label:'Cancha FI · tarde',       bg:'assets/hero-court.png',     person:'assets/person-2-cut.png' },
    { label:'Oficina FI · diplomas',   bg:'assets/hero-office2.png',   person:'assets/person-3-cut.png' },
    { label:'Mesa exterior · noche',   bg:'assets/hero-night.png',     person:'assets/person-4-cut.png?v=2' },
    { label:'Campus UNAM',             bg:'assets/hero-unam.png',      person:'assets/person-5-cut.png' },
    { label:'Facultad de Ingeniería',  bg:'assets/hero-fi.png',        person:'assets/person-6-cut.png?v=2' },
    { label:'Papelería FI',            bg:'assets/hero-papeleria.png', person:'assets/person-rata.png' },
    { label:'Tacos de canasta',        bg:'assets/hero-tacos.png?v=2', person:'assets/person-tacos.png?v=4' }
  ];

  // Biblioteca de imágenes disponibles en /assets (además de cualquier URL
  // que el organizador escriba a mano).
  const BGS = [
    { src:'assets/hero-park.png?v=2',  label:'Parque · día' },
    { src:'assets/hero-court.png',     label:'Cancha FI' },
    { src:'assets/hero-office.png',    label:'Oficina madera' },
    { src:'assets/hero-office2.png',   label:'Oficina FI · diplomas' },
    { src:'assets/hero-night.png',     label:'Mesa · noche' },
    { src:'assets/hero-unam.png',      label:'Campus UNAM' },
    { src:'assets/hero-fi.png',        label:'Facultad de Ingeniería' },
    { src:'assets/hero-papeleria.png', label:'Papelería FI' },
    { src:'assets/hero-tacos.png?v=2', label:'Tacos de canasta' },
    { src:'assets/hero-day.png',       label:'Exterior · día' }
  ];
  const PEOPLE = [
    { src:'assets/person-1-cut.png',      label:'Playera negra' },
    { src:'assets/person-2-cut.png',      label:'Playera Brasil' },
    { src:'assets/person-3-cut.png',      label:'Director en escritorio' },
    { src:'assets/person-4-cut.png?v=2',  label:'Traje + gorra' },
    { src:'assets/person-5-cut.png',      label:'Traje azul · teléfono' },
    { src:'assets/person-6-cut.png?v=2',  label:'Estudiante FI' },
    { src:'assets/person-rata.png',       label:'Rata gordita' },
    { src:'assets/person-tacos.png?v=4',  label:'Taquero' },
    { src:'assets/person-gta.png',        label:'Estilo GTA' }
  ];

  const SHOW = ['both', 'bg', 'person', 'none'];

  function readRaw(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch(e){ return {}; }
  }
  // Devuelve el arreglo efectivo de slides (defaults + overrides guardados).
  function read(){
    const raw = readRaw();
    return BASE.map((b, i) => {
      const o = raw[i] || raw[String(i)] || {};
      const show = SHOW.indexOf(o.show) >= 0 ? o.show : 'both';
      return {
        label:  b.label,
        bg:     (typeof o.bg === 'string' && o.bg.trim()) ? o.bg.trim() : b.bg,
        person: (typeof o.person === 'string' && o.person.trim()) ? o.person.trim() : b.person,
        show:   show
      };
    });
  }
  // Guarda solo lo que difiere de los valores base.
  function write(slides){
    const out = {};
    slides.forEach((s, i) => {
      const d = {};
      if (s.bg && s.bg !== BASE[i].bg) d.bg = s.bg;
      if (s.person && s.person !== BASE[i].person) d.person = s.person;
      if (s.show && s.show !== 'both') d.show = s.show;
      if (Object.keys(d).length) out[i] = d;
    });
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch(e){}
    if (global.SB && global.SB.rpc){
      global.SB.rpc('admin_save_site_setting', { p_key: KEY, p_value: out }).then(function(r){
        if (r && r.error && global.SB_UI) global.SB_UI.toast('No se guardó en el servidor: ' + r.error.message, 'error');
      });
    }
    return out;
  }
  async function syncFromServer(){
    if (!global.SB || !global.SB.from) return false;
    try {
      const { data, error } = await global.SB.from('site_settings').select('value').eq('key', KEY).maybeSingle();
      if (error || !data) return false;
      const next = JSON.stringify(data.value || {});
      const prev = localStorage.getItem(KEY);
      try { localStorage.setItem(KEY, next); } catch(e){}
      return next !== prev;
    } catch(e){ return false; }
  }

  /* ── Render + rotador (página pública) ──────────────────────────────
     Se construye aquí, con orden barajado, para que nunca se alcance a ver
     un slide fijo al recargar. build() es idempotente: se puede volver a
     llamar cuando llega la config del servidor. */
  let timer = null;
  function build(){
    const stage = document.getElementById('heroSlides');
    if (!stage) return;
    const slides = read();
    const enabled = slides.map((s, i) => s.show === 'none' ? -1 : i).filter(i => i >= 0);

    let prev = -1;
    try { prev = parseInt(localStorage.getItem('torneo_hero_last_slide'), 10); } catch(e){}
    let order = shuffle(enabled, isNaN(prev) ? -1 : prev);
    let pos = 0;

    stage.textContent = '';
    slides.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'hero-slide' + (i === order[0] ? ' is-active' : '');
      el.dataset.slide = i;
      let html = '';
      if (s.show === 'both' || s.show === 'bg'){
        html += '<div class="hero-bg-img" style="background-image:url(\'' + s.bg + '\')"></div>';
      }
      if (s.show === 'both' || s.show === 'person'){
        html += '<img class="hero-character" src="' + s.person + '" alt="" />';
      }
      el.innerHTML = html;
      stage.appendChild(el);
    });
    try { if (order.length) localStorage.setItem('torneo_hero_last_slide', String(order[0])); } catch(e){}

    const els = [...stage.children];
    const dotsHost = document.getElementById('heroDots');
    let dotEls = [];
    if (dotsHost){
      dotsHost.textContent = '';
      order.forEach((_, i) => {
        const d = document.createElement('span');
        if (i === 0) d.className = 'on';
        dotsHost.appendChild(d);
      });
      dotEls = [...dotsHost.children];
    }
    const numEl = document.getElementById('heroNextNum');
    function paint(){
      const idx = order[pos];
      els.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      dotEls.forEach((d, i) => d.classList.toggle('on', i === pos));
      if (numEl) numEl.textContent = (pos + 1) + '/' + order.length;
    }
    paint();

    global.HERO_SLIDES = slides;
    global.HERO_ORDER = order;

    if (timer) { clearInterval(timer); timer = null; }
    if (order.length < 2) return;

    function next(){
      pos++;
      if (pos >= order.length){ order = shuffle(enabled, order[order.length - 1]); pos = 0; global.HERO_ORDER = order; }
      try { localStorage.setItem('torneo_hero_last_slide', String(order[pos])); } catch(e){}
      paint();
    }
    timer = setInterval(next, 8000);
    const btn = document.getElementById('heroNext');
    if (btn && !btn.dataset.heroBound){
      btn.dataset.heroBound = '1';
      btn.addEventListener('click', () => {
        if (timer) clearInterval(timer);
        next();
        timer = setInterval(next, 8000);
      });
    }
  }
  // Baraja los índices habilitados; evita que el primero repita al último visto.
  function shuffle(list, avoidFirst){
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.length > 1 && a[0] === avoidFirst){ [a[0], a[1]] = [a[1], a[0]]; }
    return a;
  }

  global.HERO_CFG = { KEY, BASE, BGS, PEOPLE, SHOW, read, write, syncFromServer, build };
})(typeof window !== 'undefined' ? window : globalThis);
