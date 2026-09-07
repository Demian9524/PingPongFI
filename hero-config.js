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
    { label:'Tacos de canasta',        bg:'assets/hero-tacos.png?v=3', person:'assets/person-tacos.png?v=5' },
    // Slide 8 — entrada de la FI con vigilante de Seguridad UNAM.
    { label:'Entrada FI · día',        bg:'assets/hero-entrada.png?v=4',   person:'assets/person-seguridad.png' },
    // Slide 9 — vagón de la FI con directivo (portafolios).
    { label:'Vagón FI',                bg:'assets/hero-vagon-wide3.png',     person:'assets/person-directivo.png?v=2' }
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
    { src:'assets/hero-tacos.png?v=3', label:'Tacos de canasta' },
    { src:'assets/hero-day.png',       label:'Exterior · día' },
    { src:'assets/hero-entrada.png?v=4',   label:'Entrada FI · día' },
    { src:'assets/hero-vagon-wide3.png', label:'Vagón FI · alejado' },
    { src:'assets/hero-vagon.png',     label:'Vagón FI' }
  ];
  const PEOPLE = [
    { src:'assets/person-1-cut.png',      label:'Playera negra' },
    { src:'assets/person-2-cut.png',      label:'Playera Brasil' },
    { src:'assets/person-3-cut.png',      label:'Director en escritorio' },
    { src:'assets/person-4-cut.png?v=2',  label:'Traje + gorra' },
    { src:'assets/person-5-cut.png',      label:'Traje azul · teléfono' },
    { src:'assets/person-6-cut.png?v=2',  label:'Estudiante FI' },
    { src:'assets/person-rata.png',       label:'Rata gordita' },
    { src:'assets/person-tacos.png?v=5',  label:'Taquero' },
    { src:'assets/person-seguridad.png',  label:'Seguridad UNAM' },
    { src:'assets/person-directivo.png?v=2',  label:'Directivo · portafolios' },
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
      const show = SHOW.indexOf(o.show) >= 0 ? o.show : (b.show || 'both');
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
      if (s.show && s.show !== (BASE[i].show || 'both')) d.show = s.show;
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
      const act = els[idx];
      if (act) act.querySelectorAll('.hero-character,.hero-bg-img').forEach(function(n){
        n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
      });
      dotEls.forEach((d, i) => d.classList.toggle('on', i === pos));
      if (numEl) numEl.textContent = (pos + 1) + '/' + order.length;
    }
    paint();

    global.HERO_SLIDES = slides;
    global.HERO_ORDER = order;

    if (timer) { clearInterval(timer); timer = null; }

    // Panel de pruebas: solo con ?heroTest=1 en la URL (oculto al público).
    if (/[?&]heroTest=1/.test(location.search)) buildTester(stage, slides, els, function(i){
      pos = Math.max(0, order.indexOf(i));
      els.forEach((el, k) => el.classList.toggle('is-active', k === i));
      dotEls.forEach((d, k) => d.classList.toggle('on', k === pos));
      if (numEl) numEl.textContent = (pos + 1) + '/' + order.length;
    }, function(on){
      if (timer) { clearInterval(timer); timer = null; }
      if (on && order.length > 1) timer = setInterval(next, 10000);
    });

    if (order.length < 2) return;

    function next(){
      pos++;
      if (pos >= order.length){ order = shuffle(enabled, order[order.length - 1]); pos = 0; global.HERO_ORDER = order; }
      try { localStorage.setItem('torneo_hero_last_slide', String(order[pos])); } catch(e){}
      paint();
    }
    if (timer) clearInterval(timer);
    timer = setInterval(next, 10000);
    const btn = document.getElementById('heroNext');
    if (btn && !btn.dataset.heroBound){
      btn.dataset.heroBound = '1';
      btn.addEventListener('click', () => {
        if (timer) clearInterval(timer);
        next();
        timer = setInterval(next, 10000);
      });
    }
  }
  /* ── Panel de pruebas de heros ─────────────────────────────────────
     Botón flotante en el hero: lista los 10 slides con su nombre para
     verlos uno por uno (pausa la rotación automática). */
  function buildTester(stage, slides, els, goTo, setAuto){
    const hero = stage.parentElement;
    if (!hero) return;
    if (!document.getElementById('heroTestCSS')){
      const st = document.createElement('style');
      st.id = 'heroTestCSS';
      st.textContent = [
        '#heroTest{position:absolute;z-index:12;right:12px;top:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;flex-direction:column;align-items:flex-end;gap:6px}',
        '#heroTest button{font:inherit;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#ffe9a8;background:rgba(12,10,8,.72);border:1px solid rgba(255,215,120,.45);border-radius:999px;padding:6px 11px;cursor:pointer;backdrop-filter:blur(6px)}',
        '#heroTest button:hover{border-color:rgba(255,225,140,.95);color:#fff6d8}',
        '#heroTestList{display:none;flex-direction:column;gap:3px;max-height:min(70vh,420px);overflow:auto;padding:7px;background:rgba(10,9,8,.86);border:1px solid rgba(255,215,120,.3);border-radius:12px;backdrop-filter:blur(8px);min-width:210px}',
        '#heroTest.open #heroTestList{display:flex}',
        '#heroTestList .row{display:flex;align-items:center;gap:8px;font-size:11px;color:#e9e3d6;background:none;border:1px solid transparent;border-radius:8px;padding:6px 8px;cursor:pointer;text-align:left;text-transform:none;letter-spacing:0}',
        '#heroTestList .row:hover{background:rgba(255,215,120,.12)}',
        '#heroTestList .row.on{border-color:rgba(255,215,120,.6);color:#ffe9a8}',
        '#heroTestList .row i{font-style:normal;opacity:.55;min-width:16px;font-variant-numeric:tabular-nums}',
        '#heroTestList .row em{font-style:normal;opacity:.5;font-size:9.5px;margin-left:auto;text-transform:uppercase}',
        '#heroTestNav{display:flex;gap:5px}',
        '@media print{#heroTest{display:none}}'
      ].join('');
      document.head.appendChild(st);
    }
    let box = document.getElementById('heroTest');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = 'heroTest';
    const nav = document.createElement('div');
    nav.id = 'heroTestNav';
    const bAuto = document.createElement('button');
    const bPrev = document.createElement('button'); bPrev.textContent = '‹';
    const bNext = document.createElement('button'); bNext.textContent = '›';
    const bOpen = document.createElement('button'); bOpen.textContent = 'Probar heros';
    nav.append(bPrev, bNext, bAuto, bOpen);
    const list = document.createElement('div');
    list.id = 'heroTestList';
    box.append(nav, list);
    hero.appendChild(box);

    let auto = true, cur = els.findIndex(el => el.classList.contains('is-active'));
    if (cur < 0) cur = 0;
    const rows = slides.map((s, i) => {
      const r = document.createElement('button');
      r.className = 'row';
      r.type = 'button';
      r.innerHTML = '<i>' + (i + 1) + '</i><span>' + (s.label || ('Slide ' + i)) + '</span>' +
        '<em>' + (s.show === 'both' ? '' : s.show) + '</em>';
      r.addEventListener('click', () => select(i));
      list.appendChild(r);
      return r;
    });
    function mark(){
      rows.forEach((r, i) => r.classList.toggle('on', i === cur));
      bAuto.textContent = auto ? '⏸ auto' : '▶ auto';
    }
    function select(i){
      cur = (i + slides.length) % slides.length;
      auto = false; setAuto(false);
      goTo(cur);
      mark();
    }
    bPrev.addEventListener('click', () => select(cur - 1));
    bNext.addEventListener('click', () => select(cur + 1));
    bAuto.addEventListener('click', () => { auto = !auto; setAuto(auto); mark(); });
    bOpen.addEventListener('click', () => box.classList.toggle('open'));
    mark();
    setAuto(true);
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
