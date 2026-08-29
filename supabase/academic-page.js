// ── supabase/academic-page.js — lógica compartida Facultad.html/Carrera.html ──
// Fuentes públicas reales: SB_PARTICIPANTS.fetchEnrichedDirectory() (ver
// supabase/participants.js) + get_group_standings(group_id) por cada grupo
// realmente representado en la facultad/carrera (nunca todos los grupos del
// sitio). Sin ranking/bombos/siembra: los "destacados" son agregados reales
// de partidos jugados (matches_played/wins/set_diff/win_pct).
(function(global){
  'use strict';
  const $ = s => document.querySelector(s);

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function qs(name){ return new URLSearchParams(location.search).get(name); }

  // ── Iconos planos de los leaderboards del hero (rachas / sets) ────────
  // SVG externos teñidos con mask + currentColor, para que tomen el acento
  // de cada módulo (verde / dorado).
  const ICO_STREAK = 'ico-racha';
  const ICO_ATTACK = 'ico-ataque';
  const ICO_SHIELD = 'ico-escudo';
  const ICO_MEDAL = 'ico-medalla';
  function icoEl(id){
    const s = el('span', 'fac-lb-ico ' + id);
    s.innerHTML = '<svg aria-hidden="true" focusable="false"><use href="#' + id + '"></use></svg>';
    return s;
  }

  // Fila compacta de leaderboard (posición · nombre · valor grande + unidad).
  function lbRow(o){
    const row = el('div', 'fac-lb-row' + (o.first ? ' is-first' : ''));
    if (o.bar != null){
      const bar = el('i', 'fac-lb-bar');
      bar.style.width = o.bar + '%';
      row.appendChild(bar);
    }
    row.appendChild(el('span', 'fac-lb-pos', String(o.pos)));
    const nm = el('span', 'fac-lb-name');
    nm.appendChild(global.SB_LINKS.makePlayerLink(o.reg.nickname, o.reg.registration_id));
    row.appendChild(nm);
    const val = el('span', 'fac-lb-val');
    val.appendChild(el('b', null, o.value));
    val.appendChild(el('small', null, o.unit));
    row.appendChild(val);
    row.addEventListener('click', ev => {
      if (ev.target.closest('a')) return; // el nombre ya es un enlace
      const a = nm.querySelector('a');
      if (a) a.click();
    });
    return row;
  }
  function normKey(s){
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }

  function showState(ids, title, sub){
    const st = $(ids.state);
    $(ids.body).hidden = true;
    st.style.display = 'block';
    st.textContent = '';
    st.appendChild(el('b', null, title));
    if (sub) st.appendChild(document.createTextNode(' ' + sub));
  }

  // ── Ficha "locker" ────────────────────────────────────────────────────
  // El CSS y el markup viven en supabase/player-card.js (fuente única, para
  // que otras páginas rendericen EXACTAMENTE la misma ficha). Facultad.html
  // carga ese script antes de este.
  const fnRarity = r => global.SB_PLAYER_CARD.fnRarity(r);
  const playerCard = r => global.SB_PLAYER_CARD.playerCard(r);

  // Códigos de la BD → nombre presentable, para cuando no hay ninguna fila de
  // la que sacar el nombre real: CONTADURIA_ADMINISTRACION → «Contaduría y
  // Administración». Acentos de las facultades conocidas incluidos.
  const CODE_NAMES = {
    INGENIERIA:'Facultad de Ingeniería', ARQUITECTURA:'Facultad de Arquitectura',
    CIENCIAS:'Facultad de Ciencias', CIENCIAS_POLITICAS_SOCIALES:'Facultad de Ciencias Políticas y Sociales',
    CONTADURIA_ADMINISTRACION:'Facultad de Contaduría y Administración', DERECHO:'Facultad de Derecho',
    ECONOMIA:'Facultad de Economía', FILOSOFIA_LETRAS:'Facultad de Filosofía y Letras',
    MEDICINA:'Facultad de Medicina', MEDICINA_VETERINARIA_ZOOTECNIA:'Facultad de Medicina Veterinaria y Zootecnia',
    ODONTOLOGIA:'Facultad de Odontología', PSICOLOGIA:'Facultad de Psicología',
    QUIMICA:'Facultad de Química', EXTERNO:'Externos'
  };
  function prettifyCode(code){
    const key = String(code || '').toUpperCase();
    if (CODE_NAMES[key]) return CODE_NAMES[key];
    // genérico: guiones bajos → « y », y Capitalización por palabra
    return key.toLowerCase().split('_').filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' y ');
  }

  async function initAcademicPage(kind, ids){
    // kind: 'faculty' | 'career' | 'category'
    const code = qs('code') || qs('cat') || (kind === 'category' ? 'avanzado' : null);
    if (!code){
      showState(ids, kind === 'faculty' ? 'Facultad no especificada' : (kind === 'category' ? 'Categoría no especificada' : 'Carrera no especificada'), 'Falta el parámetro "code" en la URL.');
      return;
    }
    if (!global.SB_READY){
      showState(ids, 'Sitio no conectado', 'Falta configurar la conexión al servidor.');
      return;
    }
    try {
      // Fuente ÚNICA para el directorio histórico: una fila por jugador
      // canónico (deduplicado en el servidor), sin importar si está o no
      // inscrito en la edición vigente. Ver sql/MIGRACION_DIRECTORIO_FACULTAD_HISTORICO.sql.
      // 'category' no tiene RPC propia: se arma con los rosters de facultad
      // ya existentes (get_public_academic_roster) y se filtra por categoría.
      let scoped, fullRoster = null;
      if (kind === 'category'){
        const facs = await global.SB_CATALOG.getFaculties();
        const lists = await Promise.all((facs || []).map(f =>
          global.SB_PARTICIPANTS.fetchAcademicRoster('faculty', f.code).catch(() => [])));
        // los códigos reales son PRINCIPIANTE / INTERMEDIO / AVANZADO_OPEN:
        // se comparan normalizados y por prefijo para no depender del sufijo.
        const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z]/g, '');
        const want = norm(code);
        fullRoster = [].concat.apply([], lists);
        scoped = fullRoster.filter(r => {
          const c = norm(r.category_code);
          return !!c && !!want && (c === want || c.indexOf(want) === 0 || want.indexOf(c) === 0);
        });
      } else {
        scoped = await global.SB_PARTICIPANTS.fetchAcademicRoster(kind, code);
      }

      const CAT_NAMES = { principiante:'Principiantes', intermedio:'Intermedios', avanzado:'Avanzados' };
      const catKey = String(code).toLowerCase().replace(/[^a-z]/g, '')
        .replace(/^princip.*/, 'principiante').replace(/^interm.*/, 'intermedio').replace(/^avanz.*/, 'avanzado');
      let displayName = kind === 'category'
        // El nombre canónico va en PLURAL: el de la BD puede venir en singular
        // («Intermedio»), y el hero de la categoría siempre dice «Intermedios».
        ? (CAT_NAMES[catKey] || (scoped[0] && scoped[0].category_name) || code)
        : ((scoped[0] && (kind === 'faculty' ? (scoped[0].faculty_name || code) : (scoped[0].career_name || code))) || code);
      // Sin participantes no hay nombre en el plantel y se acababa mostrando el
      // código crudo («CONTADURIA_ADMINISTRACION»). El catálogo sí tiene el
      // nombre de pila; si tampoco está, al menos se limpia el código.
      if (displayName === code && kind !== 'category'){
        try {
          const rows = kind === 'faculty' && global.SB_CATALOG && global.SB_CATALOG.getFaculties
            ? await global.SB_CATALOG.getFaculties() : null;
          const hit = (rows || []).find(f => String(f.code).toUpperCase() === String(code).toUpperCase());
          if (hit && hit.name) displayName = hit.name;
        } catch(e){}
      }
      if (displayName === code) displayName = prettifyCode(code);
      document.title = displayName + ' · Torneo de Ping Pong FI';
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', 'Participantes, grupos y estadísticas oficiales de ' + displayName + ' en el Torneo de Ping Pong FI.');
      $(ids.name).textContent = displayName;
      $(ids.editionName).textContent = 'Directorio histórico · Todas las ediciones';

      // ── Plantel HISTÓRICO de la categoría ────────────────────────────
      // El roster canónico trae una sola fila por jugador con su categoría
      // MÁS RECIENTE, así que quien jugó Avanzados y hoy está en Intermedios
      // no saldría aquí. Se recuperan esos jugadores a partir de los partidos:
      // una sola consulta a v_public_groups_results filtrada por los
      // edition_category_id de esta categoría en TODAS las ediciones.
      if (kind === 'category' && fullRoster && global.SB_GROUPS && global.SB_CATALOG){
        try {
          const norm2 = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z]/g, '');
          const want2 = norm2(code);
          const eds = await global.SB_CATALOG.getAllEditions();
          const edcatLists = await Promise.all((eds || []).map(e =>
            global.SB_CATALOG.getEditionCategories(e.id).catch(() => [])));
          const wantIds = [];
          [].concat.apply([], edcatLists).forEach(ec => {
            const c = norm2(ec.code || (ec.categories && ec.categories.code));
            const n = norm2(ec.name || ec.display_name || (ec.categories && ec.categories.display_name));
            const hit = v => !!v && !!want2 && (v === want2 || v.indexOf(want2) === 0 || want2.indexOf(v) === 0);
            if (hit(c) || hit(n)) wantIds.push(ec.id);
          });
          if (wantIds.length){
            const gRows = await global.SB_GROUPS.fetchGroups(wantIds);
            const nicks = new Set();
            (gRows || []).forEach(r => { if (r.player_a) nicks.add(r.player_a); if (r.player_b) nicks.add(r.player_b); });
            const have = new Set(scoped.map(r => r.nickname));
            const catCode = (scoped[0] && scoped[0].category_code) || null;
            fullRoster.forEach(r => {
              if (!r.nickname || have.has(r.nickname) || !nicks.has(r.nickname)) return;
              have.add(r.nickname);
              // se listan bajo ESTA categoría (aquí compitieron); su grupo
              // vigente pertenece a otra categoría, así que no se arrastra.
              const extra = Object.assign({}, r, {
                category_code: catCode || r.category_code,
                category_name: displayName,
                group_id: null, group_label: null, _historicMember: true
              });
              scoped.push(extra);
            });
          }
        } catch(e){ console.warn('[categoria] plantel histórico no disponible:', e && e.message); }
      }

      if (!scoped.length){
        $(ids.state).style.display = 'none';
        $(ids.body).hidden = false;
        $(ids.count).textContent = '0';
        $(ids.metaCats).textContent = '—';
        $(ids.metaGroups).textContent = '—';
        $(ids.list).textContent = '';
        $(ids.list).appendChild(el('div', 'empty-note',
          kind === 'faculty' ? 'Aún no hay participantes registrados de esta facultad.'
            : kind === 'category' ? 'Aún no hay participantes registrados en esta categoría.'
            : 'Aún no hay participantes registrados de esta carrera.'));
        if (kind === 'faculty' && ids.logoSlot) renderLogoHeader(ids, code, code, null, displayName, null);
        return;
      }

      const logoRow = scoped.find(r => r.faculty_code) || null;      // En la página de facultad se agrupan TODAS las carreras: nunca se
      // debe mostrar el escudo de una carrera puntual (solo en Carrera.html).
      if (ids.logoSlot && kind !== 'category') renderLogoHeader(ids, code, logoRow ? logoRow.faculty_code : (kind === 'faculty' ? code : null),
        kind === 'career' ? code : null, displayName, logoRow);

      // ── Títulos de la facultad (campeonatos) ─────────────────────────
      // Fuente: get_public_player_trophies por jugador del roster
      // (supabase/academic-titles.js). No bloquea el resto del render.
      if (ids.titles && global.SB_ACADEMIC_TITLES){
        global.SB_ACADEMIC_TITLES.render(fullRoster || scoped, ids.titles, kind === 'category' ? catKey : null);
      }

      // marca de agua grande del hero: escudo de la facultad
      if (ids.facMark && global.SB_LOGOS){
        const fmEl = $(ids.facMark);
        const fc = kind === 'category' ? null : ((logoRow && logoRow.faculty_code) || (kind === 'faculty' ? code : null));
        if (fmEl && fc){
          const markSrc = global.SB_LOGOS.facultyLogo(fc);
          fmEl.style.setProperty('--fac-mark', 'url("' + new URL(markSrc, document.baseURI).href + '")');
        }
      }

      // scoped YA es una fila por jugador (el RPC deduplica en el servidor):
      // el contador del hero y "Mostrando X de N" usan la misma fuente.
      $(ids.count).textContent = String(scoped.length);
      const cats = [...new Set(scoped.map(r => String(r.category_name || r.category_code || '').replace(/\s*\/\s*open\s*$/i, '').replace(/_OPEN$/i, '')).filter(Boolean))];
      $(ids.metaCats).textContent = cats.length ? cats.join(', ') : '—';
      const grpLabels = [...new Set(scoped.map(r => r.group_label).filter(Boolean))].sort();
      $(ids.metaGroups).textContent = grpLabels.length ? grpLabels.map(g => 'Grupo ' + g).join(', ') : 'Sin grupos asignados';
      const displayRows = scoped;

      // filtros
      const state = { q:'', cat:'', fac:'', career:'', grp:'', withMatches:false, withWa:false };
      const playedSet = new Set(); // registration_ids con partidos jugados (se llena tras standings)
      function applyFilters(){
        const q = normKey(state.q);
        return displayRows.filter(r => {
          if (q && !(normKey(r.nickname).includes(q) || normKey(r.career_name).includes(q) || normKey(r.career_code).includes(q))) return false;
          if (state.cat && r.category_code !== state.cat) return false;
          if (state.fac && r.faculty_code !== state.fac) return false;
          if (state.career && r.career_code !== state.career) return false;
          if (state.grp && r.group_label !== state.grp) return false;
          if (state.withWa && !r._waUrl) return false;
          if (state.withMatches && !playedSet.has(r.registration_id)) return false;
          return true;
        });
      }

      function populateSelect(elm, values, allLabel){
        elm.length = 0;
        const o0 = document.createElement('option'); o0.value=''; o0.textContent = allLabel; elm.appendChild(o0);
        values.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; elm.appendChild(o); });
      }
      if (ids.filterCat) populateSelect($(ids.filterCat),
        [...new Map(scoped.filter(r=>r.category_code).map(r=>[r.category_code, r.category_name||r.category_code])).entries()], 'Todas las categorías');
      if (ids.filterFaculty) populateSelect($(ids.filterFaculty),
        [...new Map(scoped.filter(r=>r.faculty_code).map(r=>[r.faculty_code, r.faculty_name||r.faculty_code])).entries()], 'Todas las facultades');
      if (ids.filterGroup) populateSelect($(ids.filterGroup), grpLabels.map(g => [g, 'Grupo ' + g]), 'Todos los grupos');
      if (kind !== 'career' && ids.filterCareer) populateSelect($(ids.filterCareer),
        [...new Map(scoped.filter(r=>r.career_code).map(r=>[r.career_code, r.career_name||r.career_code])).entries()], 'Todas las carreras');

      const RARITY_ORDER = { avanzado: 0, intermedio: 1, principiante: 2, neutral: 3 };
      function renderList(){
        const filtered = applyFilters();
        filtered.sort((a, b) => (RARITY_ORDER[fnRarity(a)] ?? 9) - (RARITY_ORDER[fnRarity(b)] ?? 9));
        $(ids.shown).textContent = 'Mostrando ' + filtered.length + ' de ' + displayRows.length;
        const wrap = $(ids.list);
        wrap.textContent = '';
        if (!filtered.length){
          wrap.appendChild(el('div', 'empty-note', 'Ningún participante coincide con los filtros.'));
          return;
        }
        filtered.forEach(r => wrap.appendChild(playerCard(r)));
      }

      if (ids.search) $(ids.search).addEventListener('input', e => { state.q = e.target.value; renderList(); });
      if (ids.filterCat) $(ids.filterCat).addEventListener('change', e => { state.cat = e.target.value; renderList(); });
      if (ids.filterFaculty) $(ids.filterFaculty).addEventListener('change', e => { state.fac = e.target.value; renderList(); });
      if (ids.filterGroup) $(ids.filterGroup).addEventListener('change', e => { state.grp = e.target.value; renderList(); });
      if (ids.filterCareer) $(ids.filterCareer).addEventListener('change', e => { state.career = e.target.value; renderList(); });
      if (ids.filterWa) $(ids.filterWa).addEventListener('change', e => { state.withWa = e.target.checked; renderList(); });
      if (ids.clear) $(ids.clear).addEventListener('click', () => {
        state.q = state.cat = state.fac = state.career = state.grp = ''; state.withWa = false; state.withMatches = false;
        if (ids.search) $(ids.search).value = '';
        if (ids.filterCat) $(ids.filterCat).value = '';
        if (ids.filterFaculty) $(ids.filterFaculty).value = '';
        if (ids.filterGroup) $(ids.filterGroup).value = '';
        if (ids.filterCareer) $(ids.filterCareer).value = '';
        if (ids.filterWa) $(ids.filterWa).checked = false;
        if (ids.filterMatches) $(ids.filterMatches).checked = false;
        renderList();
      });

      renderList();

      // Standings por grupo (get_group_standings) solo para saber quién tiene
      // partidos jugados: alimenta el filtro «Solo con partidos» de la lista.
      const groupIds = [...new Set(scoped.map(r => r.group_id).filter(Boolean))];
      const regIds = new Set(scoped.map(r => r.registration_id));
      let allStandingRows = [];
      await Promise.all(groupIds.map(async gid => {
        try {
          const { data, error } = await global.SB.rpc('get_group_standings', { p_group_id: gid });
          if (error) throw error;
          (data || []).forEach(s => { if (regIds.has(s.registration_id)) allStandingRows.push(s); });
        } catch(e){ /* grupo no visible aún; se omite */ }
      }));

      // filtro "con partidos" ahora que hay standings reales
      allStandingRows.forEach(s => { if (s.matches_played > 0) playedSet.add(s.registration_id); });
      if (ids.filterMatches){
        $(ids.filterMatches).addEventListener('change', e => { state.withMatches = e.target.checked; renderList(); });
      }

      // Edición vigente: el selector [General] [2027-1] filtra TODAS las
      // estadísticas de la página (podio, rachas, récords de sets y ranking).
      let activeEd = null;
      try { activeEd = global.SB_CATALOG ? await global.SB_CATALOG.getActiveEdition() : null; }
      catch(e){ activeEd = null; }
      const activeEdLabel = (() => {
        if (!activeEd) return null;
        const m = String(activeEd.slug || '').match(/(\d{4}-\d+)/);
        return m ? m[1] : (activeEd.name || activeEd.slug || null);
      })();
      // Podio histórico — puntaje ponderado por categoría (histórico, todas
      // las ediciones). Fuente por jugador: get_public_player_matches
      // (registration_id, 200, null) — ya resuelve el player_id real, trae
      // is_official (excluye pendientes/programados/anulados/cancelados) y
      // category_code/category_name POR PARTIDO (la categoría real en la que
      // se jugó, no la categoría actual del jugador). Un match_id aparece una
      // sola vez por fila (los sets se agregan por subconsulta, no por JOIN),
      // así que no hay riesgo de contar un partido dos veces.
      if (ids.podiums || ids.heroPodium){
        const wrap = ids.podiums ? $(ids.podiums) : null;
        const wrapSection = ids.podiumsWrap ? $(ids.podiumsWrap) : null;
        if (wrap) wrap.textContent = '';

        // partidos históricos por inscripción (en paralelo)
        const matchesByReg = new Map();
        await Promise.all(scoped.map(async r => {
          try {
            const ms = await global.SB_PARTICIPANTS.fetchPlayerMatches(r.registration_id, 200, null);
            if (ms) matchesByReg.set(r.registration_id, ms);
          } catch(e){ /* jugador sin partidos */ }
        }));

        // scoped ya es un jugador por fila (deduplicado en el servidor por
        // player_id canónico), así que ninguna inscripción se repite aquí.
        const dedupedRegIds = new Set(scoped.map(r => r.registration_id));

        // Vista seleccionada: null = histórico (todas las ediciones);
        // un id = solo los partidos de esa edición. Por defecto abre en
        // General.
        let selEditionId = null;
        // En el perfil de CATEGORÍA solo cuentan los partidos jugados EN esa
        // categoría: get_public_player_matches trae category_code POR PARTIDO,
        // así que un jugador que además compitió en otra categoría no arrastra
        // aquí sus victorias, rachas ni sets de aquella.
        const matchCatKey = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, '')
          .replace(/^princip.*/, 'principiante').replace(/^interm.*/, 'intermedio').replace(/^avanz.*/, 'avanzado');
        const msFor = regId => {
          let all = matchesByReg.get(regId) || [];
          if (kind === 'category') all = all.filter(m => matchCatKey(m.category_code || m.category_name) === catKey);
          if (selEditionId == null) return all;
          return all.filter(m => String(m.edition_id) === String(selEditionId));
        };
        function paintScopeChip(){
          if (!ids.editionName) return;
          $(ids.editionName).textContent = selEditionId == null
            ? 'Directorio histórico · Todas las ediciones'
            : ('Torneo actual · ' + (activeEdLabel || ''));
        }
        function buildEdSelector(){
          const sel = ids.edSelector ? $(ids.edSelector) : null;
          if (!sel) return;
          if (!activeEd){ sel.hidden = true; return; }
          sel.hidden = false;
          sel.textContent = '';
          [[activeEdLabel || 'Actual', activeEd.id], ['General', null]].forEach(([label, edId]) => {
            const on = String(selEditionId) === String(edId);
            const b = el('button', 'pjx-edtab' + (on ? ' on' : ''));
            b.type = 'button';
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            b.appendChild(el('span', null, label));
            b.onclick = () => {
              if (String(selEditionId) === String(edId)) return;
              selEditionId = edId;
              buildEdSelector();
              renderStats();
            };
            sel.appendChild(b);
          });
        }

        // valor de cada victoria según la categoría histórica del partido
        function normCat(s){
          return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        }
        function winWeight(m){
          const key = normCat(m.category_name || m.category_code || '');
          if (/AVANZAD/.test(key)) return 1.30;
          if (/INTERMEDI/.test(key)) return 1.15;
          return 1.00; // Principiantes / Novatos / sin categoría
        }
        function statsFromMatches(ms){
          const official = (ms || []).filter(m => m.is_official);
          let wins = 0, losses = 0, weighted = 0, winsAdv = 0, winsInt = 0, setsWon = 0, setsLost = 0;
          official.forEach(m => {
            if (m.result === 'WON'){
              wins++;
              const w = winWeight(m);
              weighted += w;
              if (w === 1.30) winsAdv++; else if (w === 1.15) winsInt++;
            } else if (m.result === 'LOST'){
              losses++;
            }
            if (typeof m.my_sets === 'number') setsWon += m.my_sets;
            if (typeof m.opp_sets === 'number') setsLost += m.opp_sets;
          });
          const mp = wins + losses;
          return { mp, wins, losses, weighted, winsAdv, winsInt, setsWon, setsLost, setDiff: setsWon - setsLost, win_pct: mp ? wins / mp : 0 };
        }

        // helper: arma un podio 3D con imagen metálica (fac-podium | podium).
        // fillEmpty=true reserva siempre 3 lugares y llena los que falten con
        // un espacio "Aún no hay un jugador elegible" (nunca con jugadores
        // que no alcancen el mínimo de partidos).
        const POD_IMG = { 1: 'assets/podium-1.png?v=2', 2: 'assets/podium-2.png?v=2', 3: 'assets/podium-3.png?v=2' };
        function buildPodium(container, entries, cls, fillEmpty){
          const pod = el('div', cls + ' pod3d');
          const slots = fillEmpty ? 3 : entries.length;
          for (let i = 0; i < slots; i++){
            const p = entries[i];
            const place = i + 1;
            const step = el('div', 'pod3d-step place-' + place + (p ? '' : ' pod3d-step-empty'));
            const box = el('div', 'pod3d-box');
            const im = document.createElement('img');
            im.className = 'pod3d-img'; im.src = POD_IMG[place]; im.alt = '';
            if (p){
              const nm = el('div', cls + '-name');
              const b = document.createElement('b');
              b.appendChild(global.SB_LINKS.makePlayerLink(p.r.nickname, p.r.registration_id));
              nm.appendChild(b);
              step.appendChild(nm);
              box.appendChild(im);
              box.appendChild(el('span', 'pod3d-rank', String(place)));
              step.appendChild(box);
              step.appendChild(el('div', cls + '-pct', p.puntaje.toFixed(1) + ' PTS'));
              step.appendChild(el('div', cls + '-sub', Math.round(p.win_pct * 100) + '% victorias'));
            } else {
              box.appendChild(im);
              box.appendChild(el('span', 'pod3d-rank', String(place)));
              step.appendChild(box);
              step.appendChild(el('div', cls + '-empty-note', 'Aún no hay un jugador elegible'));
            }
            pod.appendChild(step);
          }
          container.appendChild(pod);
        }

        // Ranking histórico general: puntaje = ((victorias_ponderadas+5)/(partidos+10))*100.
        // Historial inicial neutral de 5V/5D para no premiar muestras chicas.
        // Mínimo 2 partidos históricos finalizados para ser elegible.
        const MIN_MATCHES_FOR_PODIUM = 2;
        function rankOf(players){
          return players
            .filter(r => dedupedRegIds.has(r.registration_id))
            .map(r => {
              const s = statsFromMatches(msFor(r.registration_id));
              const puntaje = ((s.weighted + 5) / (s.mp + 10)) * 100;
              return { r, mp: s.mp, wins: s.wins, losses: s.losses, win_pct: s.win_pct,
                setsWon: s.setsWon, setsLost: s.setsLost, setDiff: s.setDiff, winsAdv: s.winsAdv, winsInt: s.winsInt, puntaje };
            })
            .sort((a, b) =>
              (b.puntaje - a.puntaje) ||
              (b.win_pct - a.win_pct) ||
              (b.winsAdv - a.winsAdv) ||
              (b.winsInt - a.winsInt) ||
              (b.wins - a.wins) ||
              (b.mp - a.mp) ||
              (b.setDiff - a.setDiff) ||
              String(a.r.nickname || '').localeCompare(String(b.r.nickname || ''))
            );
        }

        // Podio general histórico de la facultad/carrera (en el panel
        // derecho del hero): ranking único, sin separar por categoría —
        // toda la facultad compite en el mismo ranking.
        function renderStats(){
        paintScopeChip();
        if (ids.heroPodium){
          const hp = $(ids.heroPodium);
          hp.textContent = '';
          const podHead = el('div', 'fac-lb-head tone-gold');
          podHead.appendChild(icoEl(ICO_MEDAL));
          podHead.appendChild(el('span', 'fac-lb-sub', selEditionId == null
            ? 'Mejor puntaje histórico'
            : ('Mejor puntaje · ' + (activeEdLabel || 'torneo actual'))));
          hp.appendChild(podHead);
          const overallFull = rankOf(scoped);
          const eligible = overallFull.filter(p => p.mp >= MIN_MATCHES_FOR_PODIUM);
          const overall = eligible.slice(0, 3);
          if (overall.length) buildPodium(hp, overall, 'fac-podium', true);
          else hp.appendChild(el('div', 'fac-podium-empty', selEditionId == null
            ? 'Aún no hay suficientes partidos para generar el podio histórico.'
            : 'Aún no hay partidos jugados en esta edición.'));
          // Solo top 3 en el hero: los lugares 4 y 5 viven en "Ver todos los
          // participantes" (mantiene la altura del hero igual en toda facultad).

          // Botón "Ver todos los participantes" — lista completa de la
          // facultad (no solo el top 5), mismo ranking ponderado.
          const viewAllBtn = document.getElementById('facViewAllBtn');
          const viewAllModal = document.getElementById('facAllPodiumModal');
          const viewAllList = document.getElementById('facAllPodiumList');
          if (viewAllBtn && viewAllModal && viewAllList){
            viewAllList.textContent = '';
            // panel derecho: MISMO bloque que el perfil de competidor
            // (renderHeroStats de perfil-jugador.js) — ring + filas.
            const apWho = document.getElementById('facApWho');
            const apBody = document.getElementById('facApBody');
            const apKicker = document.getElementById('facApKicker');
            if (apKicker){
              const facNameEl = ids.name ? $(ids.name) : null;
              const facNm = facNameEl ? String(facNameEl.textContent || '').trim() : '';
              apKicker.textContent = (selEditionId == null ? 'Ranking histórico' : ('Ranking ' + (activeEdLabel || 'del torneo actual'))) +
                (facNm && facNm !== '—' ? ' · ' + facNm : '');
            }
            // Tier de desempeño por % de victorias: verde ≥70, amarillo 40-69, rojo <40.
            const apCat = document.getElementById('facApCat');
            function apTier(pct){ return pct >= 70 ? 't-hi' : (pct >= 40 ? 't-mid' : 't-lo'); }
            function showStats(p, pos){
              if (!apBody) return;
              const pct = Math.round(p.win_pct * 100);
              if (apWho) apWho.textContent = p.r.nickname || '—';
              if (apCat){
                const raw = String(p.r.category_name || p.r.category_code || '')
                  .replace(/\s*\/\s*open\s*$/i, '').replace(/_OPEN$/i, '').trim();
                const k = raw.toUpperCase();
                apCat.className = 'fac-ap-cat' + (/AVANZAD/.test(k) ? ' cat-avanzado'
                  : /INTERMEDI/.test(k) ? ' cat-intermedio'
                  : /PRINCIPIANT/.test(k) ? ' cat-principiante' : '');
                apCat.textContent = /AVANZAD/.test(k) ? 'AVANZADOS'
                  : /INTERMEDI/.test(k) ? 'INTERMEDIOS'
                  : /PRINCIPIANT/.test(k) ? 'PRINCIPIANTES' : raw;
                apCat.hidden = !raw;
              }
              apBody.textContent = '';

              const row = el('div', 'pjx-ringrow ' + apTier(pct));
              const left = el('div', 'pjx-ring-side loss');
              const lossIcon = el('div', 'pjx-ring-icon');
              lossIcon.innerHTML = '<img src="assets/cross-white.png" alt="" style="display:block">';
              left.appendChild(lossIcon);
              left.appendChild(el('b', null, String(p.losses)));
              left.appendChild(el('span', null, 'PERDIDOS'));
              row.appendChild(left);

              const wrap = el('div', 'pjx-ring-wrap');
              wrap.style.setProperty('--pjx-pct-deg', (pct * 3.6) + 'deg');
              wrap.innerHTML =
                '<div class="pjx-ring-shadow" aria-hidden="true"></div>' +
                '<div class="pjx-ring-hole" aria-hidden="true"></div>' +
                '<div class="pjx-ring-donut" aria-hidden="true"></div>';
              const center = el('div', 'pjx-ring-center');
              const b = el('b', null, String(pct));
              b.appendChild(el('i', 'pjx-pct-sign', '%'));
              center.appendChild(b);
              center.appendChild(el('span', null, 'VICTORIAS'));
              wrap.appendChild(center);
              row.appendChild(wrap);

              const right = el('div', 'pjx-ring-side win');
              const winIcon = el('div', 'pjx-ring-icon');
              winIcon.innerHTML = '<img src="assets/trophy-white.svg" alt="" style="display:block">';
              right.appendChild(winIcon);
              right.appendChild(el('b', null, String(p.wins)));
              right.appendChild(el('span', null, 'GANADOS'));
              row.appendChild(right);
              apBody.appendChild(row);

              const rows = el('div', 'pjx-statrows');
              [['Partidos jugados', String(p.mp), ''],
               ['Sets ganados', String(p.setsWon), ''],
               ['Sets perdidos', String(p.setsLost), ''],
               ['Diferencia de sets', (p.setDiff > 0 ? '+' : '') + p.setDiff, p.setDiff > 0 ? 'pos' : (p.setDiff < 0 ? 'neg' : '')]
              ].forEach(([label, val, cls]) => {
                const r2 = el('div', 'pjx-statrow');
                r2.appendChild(el('span', null, label));
                r2.appendChild(el('b', cls || null, val));
                rows.appendChild(r2);
              });
              apBody.appendChild(rows);
            }
            // Rankeados primero (con posición); quienes no llegan al mínimo van
            // en un bloque aparte al final, sin número de posición ni puntaje.
            const ranked = overallFull.filter(p => p.mp >= MIN_MATCHES_FOR_PODIUM);
            const unranked = overallFull.filter(p => p.mp < MIN_MATCHES_FOR_PODIUM);
            function addRow(p, pos){
              const pct = Math.round(p.win_pct * 100);
              const row = el('div', 'fac-allpodium-row ' + (p.mp ? apTier(pct) : 't-none') + (pos ? '' : ' is-unranked'));
              row.appendChild(el('span', 'fac-allpodium-pos', pos ? '#' + pos : '—'));
              const nm = el('span', 'fac-allpodium-name');
              nm.appendChild(global.SB_LINKS.makePlayerLink(p.r.nickname, p.r.registration_id));
              row.appendChild(nm);
              row.appendChild(el('span', 'fac-allpodium-pts', pos ? p.puntaje.toFixed(1) : '—'));
              row.appendChild(el('span', 'fac-allpodium-pct', p.mp ? pct + '%' : '—'));
              row.addEventListener('click', ev => {
                if (ev.target.closest('a')) return; // el nombre sigue abriendo el perfil
                viewAllList.querySelectorAll('.fac-allpodium-row.is-sel').forEach(x => x.classList.remove('is-sel'));
                row.classList.add('is-sel');
                showStats(p, pos);
              });
              viewAllList.appendChild(row);
            }
            ranked.forEach((p, i) => addRow(p, i + 1));
            if (unranked.length){
              const sep = el('div', 'fac-ap-sep');
              sep.appendChild(el('b', null, 'Aún sin ranking'));
              sep.appendChild(el('span', null, 'Menos de ' + MIN_MATCHES_FOR_PODIUM + ' partidos jugados'));
              viewAllList.appendChild(sep);
              unranked.forEach(p => addRow(p, 0));
            }
            if (!overallFull.length){
              viewAllList.appendChild(el('div', 'empty-note', 'Aún no hay participantes con partidos registrados.'));
              if (apBody) apBody.appendChild(el('div', 'fac-ap-empty', 'Sin datos todavía.'));
            } else {
              const firstRow = viewAllList.querySelector('.fac-allpodium-row');
              if (firstRow) firstRow.classList.add('is-sel');
              showStats(ranked[0] || unranked[0], ranked.length ? 1 : 0);
            }
            viewAllBtn.onclick = function(){ viewAllModal.hidden = false; };
          }
        }

        // Mejores rachas de victorias (histórico) — pestaña alterna del podio.
        if (ids.heroRachas){
          const hr = $(ids.heroRachas);
          hr.textContent = '';
          const rachas = scoped
            .filter(r => dedupedRegIds.has(r.registration_id))
            .map(r => {
              const ms = msFor(r.registration_id);
              const played = ms
                .filter(m => m.is_official)
                .sort((a, b) => new Date(a.played_at || a.created_at || 0) - new Date(b.played_at || b.created_at || 0));
              let best = 0, cur = 0;
              played.forEach(m => {
                if (m.result === 'WON'){ cur++; if (cur > best) best = cur; }
                else cur = 0;
              });
              return { r, streak: best };
            })
            .filter(x => x.streak >= 2)
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 5);
          const lb = el('div', 'fac-lb tone-orange');
          const lbHead = el('div', 'fac-lb-head');
          lbHead.appendChild(icoEl(ICO_STREAK));
          lbHead.appendChild(el('span', 'fac-lb-sub', 'Victorias consecutivas'));
          lb.appendChild(lbHead);
          if (rachas.length){
            const maxStreak = rachas[0].streak || 1;
            const rows = el('div', 'fac-lb-rows');
            rachas.forEach((p, i) => {
              rows.appendChild(lbRow({
                pos: i + 1, reg: p.r, first: i === 0,
                value: String(p.streak),
                unit: p.streak === 1 ? 'victoria' : 'victorias',
                bar: Math.max(14, Math.round((p.streak / maxStreak) * 100))
              }));
            });
            lb.appendChild(rows);
          } else {
            lb.appendChild(el('div', 'fac-podium-empty', selEditionId == null
              ? 'Aún no hay rachas registradas.'
              : 'Aún no hay rachas en esta edición.'));
          }
          hr.appendChild(lb);
        }

        // Widget "Récords de sets" — arriba más sets ganados, abajo mejor
        // defensa (menor porcentaje de sets perdidos sobre los disputados).
        if (ids.heroSets){
          const hs = $(ids.heroSets);
          hs.textContent = '';
          const overallFull2 = rankOf(scoped);
          const eligible2 = overallFull2.filter(p => p.mp >= MIN_MATCHES_FOR_PODIUM);
          const mostWon = [...eligible2]
            .sort((a, b) => (b.setsWon - a.setsWon) || (b.win_pct - a.win_pct)).slice(0, 3)
            .map(p => ({ p, v: String(p.setsWon), unit: p.setsWon === 1 ? 'set' : 'sets' }));
          // "Mejor defensa": menor % de sets perdidos. Mínimo 6 sets disputados
          // (los agregados ya provienen solo de partidos oficiales finalizados).
          const defense = overallFull2
            .map(p => ({ p, won: p.setsWon, lost: p.setsLost, total: p.setsWon + p.setsLost }))
            .filter(x => x.total >= 6)
            .sort((a, b) =>
              (a.lost / a.total) - (b.lost / b.total) ||
              (b.total - a.total) ||
              (b.won - a.won) ||
              String(a.p.r.nickname || '').localeCompare(String(b.p.r.nickname || ''), 'es'))
            .slice(0, 3)
            .map(x => ({ p: x.p, v: Math.round((x.lost / x.total) * 100) + '%', unit: x.lost + '/' + x.total + ' sets' }));
          const mods = el('div', 'fac-lb-mods');
          function buildSetsModule(title, note, icon, tone, entries, emptyText){
            const mod = el('div', 'fac-lb-mod tone-' + tone);
            const head = el('div', 'fac-lb-modhead');
            head.appendChild(icoEl(icon));
            const txt = el('div', 'fac-lb-modtxt');
            txt.appendChild(el('span', 'fac-lb-modtitle', title));
            if (note) txt.appendChild(el('span', 'fac-lb-modnote', note));
            head.appendChild(txt);
            mod.appendChild(head);
            if (!entries.length){
              mod.appendChild(el('div', 'fac-podium-empty', emptyText));
            } else {
              const rows = el('div', 'fac-lb-rows');
              entries.forEach((e, i) => rows.appendChild(lbRow({
                pos: i + 1, reg: e.p.r, first: i === 0, value: String(e.v), unit: e.unit
              })));
              mod.appendChild(rows);
            }
            mods.appendChild(mod);
          }
          buildSetsModule('Más sets ganados', null, ICO_ATTACK, 'violet', mostWon,
            'Aún no hay suficientes partidos.');
          buildSetsModule('Mejor defensa', null, ICO_SHIELD, 'teal', defense,
            'Aún no hay suficientes sets disputados para calcular este récord.');
          hs.appendChild(mods);
        }

        if (wrap){
          wrap.textContent = '';
          const careers = [...new Map(scoped.filter(r=>r.career_code).map(r => [r.career_code, r.career_name || r.career_code])).entries()];
          let anyCareer = false;
          careers.forEach(([cc, cname]) => {
            const players = scoped.filter(r => r.career_code === cc);
            if (!players.length) return;
            anyCareer = true;
            const top3 = rankOf(players).filter(p => p.mp >= MIN_MATCHES_FOR_PODIUM).slice(0, 3);
            const block = el('div', 'podium-block');
            if (kind === 'faculty') block.appendChild(el('h3', 'podium-title', cname));
            buildPodium(block, top3, 'podium', false);
            wrap.appendChild(block);
          });
          if (wrapSection) wrapSection.hidden = !anyCareer;
        }
        }

        buildEdSelector();
        renderStats();
      }

      $(ids.state).style.display = 'none';
      $(ids.body).hidden = false;
    } catch(err){
      global.SB_LOG && global.SB_LOG.error(kind === 'faculty' ? 'FAC-001' : 'CAR-001', err);
      if (err && err.code === 'ACADEMIC_ROSTER_RPC_NOT_INSTALLED'){
        showState(
          ids,
          'Directorio histórico pendiente de habilitar',
          'La actualización de la base de datos todavía no está instalada. El sitio no interpretará este error como una facultad vacía.'
        );
      } else {
        showState(ids, 'No se pudo cargar la página', 'Revisa tu conexión e intenta de nuevo.');
      }
    }
  }

  function renderLogoHeader(ids, urlCode, facultyCode, careerCode, displayName, sourceRow){
    const slot = $(ids.logoSlot);
    if (!slot) return;
    slot.textContent = '';
    const fc = facultyCode || (sourceRow ? sourceRow.faculty_code : null);
    if (!fc) return;
    const link = global.SB_LINKS.makeAcademicLogoHeader(fc, careerCode, sourceRow ? sourceRow.faculty_name : displayName, sourceRow ? sourceRow.career_name : displayName);
    if (link) slot.appendChild(link);
  }

  global.SB_ACADEMIC_PAGE = { initAcademicPage };
})(typeof window !== 'undefined' ? window : globalThis);
