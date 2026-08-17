// ── Lista de participantes previa al sorteo — vista pública ─────────────
// Fuente ÚNICA de verdad de visibilidad: RPC get_public_pre_group_roster.
// La RPC ya aplica el interruptor administrativo por categoría: devuelve SOLO
// las categorías visibles. Si devuelve [], la sección se retira del flujo sin
// dejar título, hueco, skeleton ni mensaje.
//
// La lista se muestra por CATEGORÍA SELECCIONADA en la barra superior
// (#catSeg). Sin categoría elegida se muestra el mismo aviso "elige una
// categoría" que el resto de la página. Las fichas son las de
// supabase/player-card.js (idénticas a Facultad.html).
// No se muestran teléfonos ni WhatsApp: este módulo ya no consulta el
// directorio de contacto (ver buildDirectoryIndex).

(function(global){
  'use strict';

  const S = { rows: [], cat: null, root: null, loaded: false };

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  async function fetchRoster(editionId){
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    if (!editionId) throw new Error('EDITION_REQUIRED');
    const t0 = performance.now();
    const { data, error } = await global.SB.rpc('get_public_pre_group_roster', { p_edition_id: editionId });
    if (global.SB_LOG) global.SB_LOG.op('PRE-GRP', 'get_public_pre_group_roster', performance.now() - t0, !error);
    if (error) throw error;
    if (Array.isArray(data)) return data;
    return data ? [data] : [];
  }

  function body(){ return S.root && S.root.querySelector('[data-pre-group-body]'); }
  function sub(){ return S.root && S.root.querySelector('[data-pre-group-sub]'); }

  function clear(){
    const b = body(); if (b) b.textContent = '';
    const s = sub(); if (s) s.textContent = '';
  }
  function conceal(){
    clear();
    if (!S.root) return;
    S.root.hidden = true;
    S.root.setAttribute('aria-hidden', 'true');
  }
  function reveal(){
    if (!S.root) return;
    S.root.hidden = false;
    S.root.removeAttribute('aria-hidden');
  }

  function prompt(msg){
    const b = body();
    b.textContent = '';
    const e = el('div', 'empty-pick');
    e.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>';
    e.appendChild(el('span', null, msg));
    b.appendChild(e);
  }

  function participantsOf(row){
    const list = Array.isArray(row.participants) ? row.participants : [];
    return list.filter(Boolean);
  }

  // ── traducción de facultad/carrera con el catálogo público ──────────────
  // PRECEDENCIA: primero el directorio público de la edición (misma fuente que
  // el perfil del jugador y Facultad.html) y solo como respaldo los ids que
  // trae la RPC del roster — esos ids pueden venir del snapshot original de la
  // inscripción y quedar desfasados del dato canónico del jugador.
  const acad = { faculties: null, facByCode: {}, careers: {}, carByCode: {} };
  async function buildAcademicIndex(rows){
    if (!global.SB_CATALOG) return;
    const facIds = new Set();
    rows.forEach(r => participantsOf(r).forEach(p => {
      if (p.faculty != null && p.faculty !== '') facIds.add(String(p.faculty));
    }));
    try {
      const facs = await global.SB_CATALOG.getFaculties();
      acad.faculties = {};
      facs.forEach(f => { acad.faculties[String(f.id)] = f; acad.facByCode[String(f.code)] = f; });
      // carreras de las facultades citadas por la RPC + las del directorio
      const codes = new Set();
      if (dir.byNick) dir.byNick.forEach(v => { if (v.faculty_code) codes.add(String(v.faculty_code)); });
      const present = facs.filter(f => facIds.has(String(f.id)) || codes.has(String(f.code)));
      await Promise.all(present.map(async f => {
        const list = await global.SB_CATALOG.getCareersByFaculty(f.id);
        list.forEach(c => { acad.careers[String(c.id)] = c; acad.carByCode[String(c.code)] = c; });
      }));
    } catch(e){
      global.SB_LOG && global.SB_LOG.error('PRE-GRP-002', e);
    }
  }
  // Índice académico canónico de la edición: view PÚBLICO v_public_participants
  // (grant select a anon en sql/03_security_rls.sql). Trae registration_id,
  // faculty_code y career_code de TODA inscripción CONFIRMED.
  //
  // Antes se usaba get_public_contact_directory, pero esa RPC exige además
  // consent_public_contact_at: los inscritos sin consentimiento de contacto
  // quedaban fuera y su ficha se quedaba sin enlace al perfil. Este view no
  // depende del consentimiento y tampoco expone teléfono ni WhatsApp.
  const dir = { byNick: null };
  function normNick(s){
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  async function buildDirectoryIndex(editionId){
    if (!global.SB) return;
    try {
      const { data, error } = await global.SB.from('v_public_participants')
        .select('registration_id,nickname,faculty_code,career_code')
        .eq('edition_id', editionId);
      if (error) throw error;
      dir.byNick = new Map();
      (data || []).forEach(r => {
        if (!r || !r.nickname) return;
        dir.byNick.set(normNick(r.nickname), {
          registration_id: r.registration_id,
          faculty_code: r.faculty_code,
          career_code: r.career_code
        });
      });
    } catch(e){
      global.SB_LOG && global.SB_LOG.error('PRE-GRP-004', e);
    }
  }

  function lookup(map, val){
    if (val == null || val === '') return null;
    const hit = map && map[String(val)];
    if (hit) return hit;
    return /^[0-9]+$/.test(String(val)) ? null : { name: String(val), code: null };
  }

  // key de #catSeg → fila de la RPC
  function rowForKey(key){
    if (!key) return null;
    const k = String(key).toUpperCase();
    const want = k.indexOf('AVANZ') >= 0 ? 'AVANZ' : (k.indexOf('INTER') >= 0 ? 'INTER' : (k.indexOf('PRINCIP') >= 0 ? 'PRINCIP' : null));
    if (!want) return null;
    return S.rows.find(r => {
      const code = String(r.category_code || '').toUpperCase() + ' ' + String(r.category_name || '').toUpperCase();
      return code.indexOf(want) >= 0;
    }) || null;
  }

  function renderCategory(row){
    const b = body();
    b.textContent = '';
    const people = participantsOf(row);
    const count = Number(row.participant_count != null ? row.participant_count : people.length) || 0;

    const head = el('div', 'pghead');
    const tt = el('div');
    tt.appendChild(el('h3', null, row.category_name || row.category_code || 'Categoría'));
    tt.appendChild(el('span', 'pgcode', row.category_code || ''));
    head.appendChild(tt);
    const cnt = el('div', 'pgcount');
    cnt.appendChild(el('b', null, String(count)));
    cnt.appendChild(el('small', null, count === 1 ? 'inscrito' : 'inscritos'));
    head.appendChild(cnt);
    b.appendChild(head);

    if (!people.length){
      const e = el('div', 'empty-pick');
      e.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>';
      e.appendChild(el('span', null, 'Aún no hay inscritos en esta categoría'));
      b.appendChild(e);
      return;
    }
    const grid = el('div', 'pgcards');
    people.forEach(p => {
      const link = (dir.byNick && dir.byNick.get(normNick(p.nickname))) || null;
      // canónico (directorio) → respaldo (ids de la RPC)
      const fac = (link && acad.facByCode[String(link.faculty_code)]) || lookup(acad.faculties, p.faculty);
      const car = (link && acad.carByCode[String(link.career_code)]) || lookup(acad.careers, p.career);
      // Identificador de perfil: el folio (public_code) que la propia RPC del
      // roster ya devuelve para cada inscrito — PerfilJugador.html lo acepta en
      // `?id=` igual que registration_id. Es la única clave que existe SIEMPRE;
      // registration_id solo aparece si el apodo cruzó con el índice público.
      grid.appendChild(global.SB_PLAYER_CARD.playerCard({
        nickname: p.nickname,
        registration_id: p.public_code || (link && link.registration_id),
        category_name: row.category_name,
        category_code: row.category_code,
        faculty_code: (fac && fac.code) || (link && link.faculty_code),
        faculty_name: fac && fac.name,
        career_code: (car && car.code) || (link && link.career_code),
        career_name: car && car.name
      }));
    });
    b.appendChild(grid);
  }

  function render(){
    if (!S.root) return;
    if (!S.rows.length){ conceal(); return; }   // todas las categorías apagadas
    clear();
    reveal();
    const s = sub();
    if (!S.cat){
      if (s) s.textContent = 'Inscritos que entran al sorteo físico de grupos. Elige una categoría arriba para ver su lista.';
      prompt('Elige una categoría para ver a los participantes');
      return;
    }
    const row = rowForKey(S.cat);
    if (!row){
      if (s) s.textContent = 'Inscritos que entran al sorteo físico de grupos.';
      prompt('Esta categoría no tiene lista publicada');
      return;
    }
    if (s) s.textContent = 'Inscritos que entran al sorteo físico de grupos. Los grupos se forman presencialmente con pelotas y papelitos; esta lista es solo de consulta.';
    renderCategory(row);
  }

  function renderError(code){
    clear();
    reveal();
    const b = body();
    const st = el('div', 'state');
    st.appendChild(el('b', null, 'No se pudo cargar la lista de participantes'));
    st.appendChild(document.createTextNode('Intenta de nuevo en unos minutos. (código ' + code + ')'));
    b.appendChild(st);
  }

  // Categoría elegida en #catSeg (o null si no hay ninguna)
  function setCategory(key){
    S.cat = key || null;
    if (S.loaded) render();
  }

  async function init(editionId, selector){
    S.root = document.querySelector(selector || '#preGroupSection');
    if (!S.root) return 0;
    const on = document.querySelector('#catSeg button.on');
    S.cat = on ? on.dataset.cat : S.cat;
    try {
      S.rows = await fetchRoster(editionId);
      if (S.rows.length){
        // el directorio primero: buildAcademicIndex lo usa para saber qué
        // carreras cargar del catálogo
        await buildDirectoryIndex(editionId);
        await buildAcademicIndex(S.rows);
      }
      S.loaded = true;
      render();
      return S.rows.length;
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PRE-GRP-001', err);
      renderError('PRE-GRP-001');
      return 0;
    }
  }

  global.SB_PRE_GROUP = { init, setCategory, fetchRoster, conceal };
})(typeof window !== 'undefined' ? window : globalThis);
