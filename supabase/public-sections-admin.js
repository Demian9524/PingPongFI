// ── Visibilidad de secciones de la página pública (ControlTorneo.html) ───
// Interruptores locales: se guardan en localStorage con la MISMA mecánica que
// la configuración del premio (torneo_prize_cfg_v1). No tocan Supabase, no
// borran datos y no afectan inscripciones, grupos ni partidos: solo deciden
// cómo se dibujan cuatro bloques de Pagina Torneo.html.
// Tres estados por sección:
//   · on    → visible con su contenido real
//   · empty → visible pero VACÍA: muestra el aviso «aún no se publica»
//   · off   → oculta por completo
// Alcance: global. Se guardan en Supabase (tabla site_settings, RPC
// admin_save_site_setting — sql/PROPUESTA_site_settings_publico.sql) y se
// cachean en localStorage solo para pintar sin parpadeo mientras carga la
// red. Cualquier visitante, en cualquier navegador o dispositivo, ve el
// mismo valor una vez que el organizador guarda.
(function(global){
  'use strict';
  const KEY = 'torneo_sections_cfg_v1';
  const SECTIONS = [
    { id:'categoria', label:'Barra de categorías',
      hint:'Selector de nivel (Principiantes / Intermedios / Avanzados) en la página principal.' },
    { id:'participantes', label:'Lista de participantes',
      hint:'Listado previo al sorteo con todos los inscritos confirmados de la categoría.' },
    { id:'grupos',  label:'Fase de grupos',
      hint:'Carrusel de tablas de grupo con posiciones, puntos y zonas de clasificación.' },
    { id:'bombos',  label:'Bombos al momento',
      hint:'Tabla única con todos los participantes de la categoría, repartidos por bombo y corte de puntos.' },
    { id:'bracket', label:'Bracket Final',
      hint:'Llave de la fase eliminatoria en la página pública.' },
    { id:'terceros', label:'Terceros y sistema 5–4–3',
      hint:'Explicación de cómo se reparten las plazas de tercer lugar entre grupos.' },
    { id:'entrada', label:'Entrada y aportes voluntarios',
      hint:'Bloque con la aportación de recuperación y las formas de aportar (presencial y en línea). Al ocultarlo, el botón del hero que baja a él también desaparece.' },
    { id:'donaciones', label:'Donaciones voluntarias',
      hint:'Bloque del cerdito con el acumulado de aportaciones por categoría. Al ocultarlo, el botón del hero que baja a él también desaparece.' },
    { id:'restauracion', label:'Restauremos las Mesas',
      hint:'Bloque de la campaña de restauración: meta, avance, donadores y plan de materiales. Al ocultarla, el pop-up flotante también desaparece.' },
    { id:'whatsapp', label:'Pop-up de comunidad WhatsApp',
      hint:'Burbuja flotante en la esquina que invita a unirse al grupo de WhatsApp del torneo.' },
    { id:'rtpopup', label:'Pop-up Arreglemos las Mesas',
      hint:'Burbuja flotante que invita a apoyar la restauración de las mesas de ping pong.' }
  ];
  const STATES = [
    { id:'on',    label:'Visible', title:'Se muestra con su contenido real.' },
    { id:'empty', label:'Vacía',   title:'Se muestra el bloque, pero con el aviso «aún no se publica».' },
    { id:'off',   label:'Oculta',  title:'El bloque no aparece en la página.' }
  ];
  const DEFAULTS = { categoria:'on', participantes:'on', grupos:'on', bombos:'on', bracket:'on', terceros:'on', entrada:'on', donaciones:'on', restauracion:'on', whatsapp:'on', rtpopup:'on' };

  // Compatibilidad con la versión anterior, que guardaba booleanos.
  function norm(v){
    if (v === true) return 'on';
    if (v === false) return 'off';
    return (v === 'on' || v === 'off' || v === 'empty') ? v : null;
  }
  function read(){
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){}
    const out = Object.assign({}, DEFAULTS);
    SECTIONS.forEach(sec => { const v = s ? norm(s[sec.id]) : null; if (v) out[sec.id] = v; });
    return out;
  }
  function write(cfg){
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch(e){}
    if (global.applySectionVisibility) global.applySectionVisibility();
    if (global.SB && global.SB.rpc){
      global.SB.rpc('admin_save_site_setting', { p_key: KEY, p_value: cfg }).then(({ error }) => {
        if (error && global.SB_UI) global.SB_UI.toast('No se guardó en el servidor: ' + error.message, 'error');
      });
    }
  }

  // Trae el valor real del servidor (para todos los visitantes, no solo
  // este navegador) y refresca cache local + la página pública si cambió.
  async function syncFromServer(){
    if (!global.SB) return;
    try {
      const { data, error } = await global.SB.from('site_settings').select('value').eq('key', KEY).maybeSingle();
      if (error || !data) return;
      const merged = Object.assign({}, DEFAULTS, data.value || {});
      try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch(e){}
      if (global.applySectionVisibility) global.applySectionVisibility();
    } catch(e){}
  }
  function stateLabel(id){
    const s = STATES.filter(x => x.id === id)[0];
    return s ? s.label : 'Visible';
  }

  function mount(){
    const host = document.getElementById('secVisBody');
    if (!host) return;
    const sect = document.getElementById('secVisSect');
    if (sect) sect.style.display = '';
    const cfg = read();
    host.textContent = '';
    SECTIONS.forEach(sec => {
      const row = document.createElement('div');
      row.className = 'svrow';
      row.innerHTML = '<div class="svtx"><b>' + sec.label + '</b><small>' + sec.hint + '</small></div>' +
        '<div class="svseg" role="group" aria-label="Estado de ' + sec.label + '">' +
        STATES.map(st => '<button type="button" data-st="' + st.id + '" title="' + st.title + '"' +
          (cfg[sec.id] === st.id ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') +
          '>' + st.label + '</button>').join('') +
        '</div>' +
        '<span class="svstate" id="sv-st-' + sec.id + '">' + stateLabel(cfg[sec.id]) + '</span>';
      host.appendChild(row);
      row.querySelectorAll('.svseg button').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-st');
          const next = read();
          next[sec.id] = val;
          write(next);
          row.querySelectorAll('.svseg button').forEach(b => {
            const on = b === btn;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', String(on));
          });
          const st = document.getElementById('sv-st-' + sec.id);
          if (st) st.textContent = stateLabel(val);
          if (global.SB_UI) global.SB_UI.toast(sec.label + ' → ' +
            (val === 'on' ? 'visible en la página pública.'
              : val === 'empty' ? 'visible pero vacía (aviso «aún no se publica»).'
              : 'oculta en la página pública.'), 'ok');
        });
      });
    });
  }

  global.SB_PUBLIC_SECTIONS = { mount, read, syncFromServer, KEY, SECTIONS, STATES, DEFAULTS };
  syncFromServer().then(() => { if (document.getElementById('secVisBody')) mount(); });
})(typeof window !== 'undefined' ? window : globalThis);
