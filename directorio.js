// ── Directorio.html — buscador general del torneo ───────────────────────
// Reemplaza el antiguo "directorio de participantes" (solo tarjetas de
// contacto) por un directorio GENERAL: un buscador único sobre jugadores,
// facultades, carreras de Ingeniería, categorías y grupos, más una vista de
// exploración por bloques cuando no hay búsqueda.
//
// Fuentes públicas reales (ninguna vista/RPC administrativa):
//   * get_public_contact_directory(edition_id) — vía supabase/directory.js
//     (nickname, phone_normalized, whatsapp_url, category_code/name,
//     group_label, entry_status, registration_id).
//   * v_public_group_members — vía supabase/groups.js (group_id, faculty_code,
//     career_code, registration_id).
//   * catalog.js — nombres de facultad/carrera y lista de ediciones.
// La unión y el enriquecimiento viven en supabase/participants.js
// (fetchEnrichedDirectory / fetchEnrichedDirectoryForEdition): aquí solo se
// indexa, se filtra y se pinta. Las facultades, carreras, categorías y grupos
// que se listan son los que REALMENTE tienen jugadores en la edición elegida
// (no se inventan catálogos vacíos).
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const PAGE = 24;
  const SCOPES = [
    ['todo', 'Todo'], ['jugadores', 'Jugadores'], ['facultades', 'Facultades'], ['categorias', 'Categorías']
  ];
  const CAT_ORDER = { principiante: 0, intermedio: 1, avanzado: 2 };
  // Los JUGADORES se listan de mayor a menor categoría: avanzados primero.
  const PLAYER_CAT_ORDER = { avanzado: 0, intermedio: 1, principiante: 2 };

  const state = {
    rows: [], edcats: [], index: null, mode: 'general', editionLabel: '', histCounts: null,
    q: '', scope: 'todo', cat: '', fac: '', car: '', grp: '', wa: '',
    expanded: false, loadedAt: null, filterOpen: false
  };

  // ── utilidades ──────────────────────────────────────────────────────
  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function norm(s){
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function catLabel(v){
    return String(v || '').replace(/\s*\/\s*open\s*$/i, '').replace(/_OPEN$/i, '').replace(/_/g, ' ').trim();
  }
  function catKeyOf(name, code){
    const k = norm(String(name || '') + ' ' + String(code || ''));
    if (/avanzad/.test(k)) return 'avanzado';
    if (/intermedi/.test(k)) return 'intermedio';
    if (/principiant|novat/.test(k)) return 'principiante';
    return '';
  }
  function plural(n, one, many){ return n + ' ' + (n === 1 ? one : many); }
  // Las categorías se nombran en plural en el directorio (Principiantes, …)
  const CAT_PLURAL = { principiante: 'Principiantes', intermedio: 'Intermedios', avanzado: 'Avanzados' };
  function catPlural(name, key){ return CAT_PLURAL[key] || name; }
  function initials(name){
    const p = String(name || '').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase() || '··';
  }
  function shortFac(name){ return String(name || '').replace(/^facultad\s+de\s+/i, ''); }

  // ── preparación de filas ────────────────────────────────────────────
  function decorate(rows){
    rows.forEach(r => {
      r._catName = catLabel(r.category_name || r.category_code);
      r._catKey = catKeyOf(r.category_name, r.category_code);
      r._gkey = r.group_label
        ? (r.group_id != null ? 'g' + r.group_id : String(r.category_code || '') + '|' + r.group_label)
        : '';
      r._hay = norm([
        r.nickname, r.faculty_name, r.faculty_code, r.career_name, r.career_code,
        r._catName, r.group_label ? 'grupo ' + r.group_label : '', r.phone_normalized
      ].join(' '));
    });
    return rows;
  }

  // Las CATEGORÍAS no se derivan de las inscripciones: se toman del catálogo de
  // la edición (edition_categories vía catalog.js, ya resuelto en
  // participants.js) para que aparezcan todas aunque una todavía no tenga
  // jugadores confirmados. Facultades, carreras y grupos sí salen de las filas.
  function buildIndex(rows, edcats){
    const cats = new Map(), facs = new Map(), cars = new Map(), grps = new Map();
    (edcats || []).forEach(c => {
      const key = String(c.code || c.name || '');
      if (!key) return;
      cats.set(key, { code: c.code || '', name: catLabel(c.name || c.code),
        key: catKeyOf(c.name, c.code), n: 0, groups: new Set() });
    });
    rows.forEach(r => {
      const ck = String(r.category_code || r._catName || '');
      if (ck){
        if (!cats.has(ck)) cats.set(ck, { code: r.category_code || '', name: r._catName || ck, key: r._catKey, n: 0, groups: new Set() });
        const c = cats.get(ck); c.n++; if (r._gkey) c.groups.add(r._gkey);
      }
      if (r.faculty_code){
        if (!facs.has(r.faculty_code)) facs.set(r.faculty_code, { code: r.faculty_code, name: r.faculty_name || r.faculty_code, n: 0, cars: new Set() });
        const f = facs.get(r.faculty_code); f.n++; if (r.career_code) f.cars.add(r.career_code);
      }
      if (r.career_code){
        if (!cars.has(r.career_code)) cars.set(r.career_code, { code: r.career_code, name: r.career_name || r.career_code, fac: r.faculty_code, n: 0 });
        cars.get(r.career_code).n++;
      }
      if (r._gkey){
        if (!grps.has(r._gkey)) grps.set(r._gkey, { key: r._gkey, label: r.group_label, cat: r._catName, catKey: r._catKey, members: [] });
        grps.get(r._gkey).members.push(r);
      }
    });
    const byN = (a, b) => b.n - a.n || norm(a.name).localeCompare(norm(b.name));
    const byCat = (a, b) => (CAT_ORDER[a.catKey] ?? 9) - (CAT_ORDER[b.catKey] ?? 9);
    return {
      cats: [...cats.values()].sort((a, b) => (CAT_ORDER[a.key] ?? 9) - (CAT_ORDER[b.key] ?? 9) || byN(a, b)),
      facs: [...facs.values()].sort(byN),
      cars: [...cars.values()].sort(byN),
      grps: [...grps.values()].sort((a, b) => byCat(a, b) || String(a.label).localeCompare(String(b.label)))
    };
  }

  // ── filtros ─────────────────────────────────────────────────────────
  function hit(text){
    const q = norm(state.q);
    return !q || norm(text).includes(q);
  }
  function filteredPlayers(){
    const q = norm(state.q);
    return state.rows.filter(r => {
      if (q && !r._hay.includes(q)) return false;
      if (state.cat && String(r.category_code || r._catName) !== state.cat) return false;
      if (state.fac && r.faculty_code !== state.fac) return false;
      if (state.car && r.career_code !== state.car) return false;
      if (state.grp && r._gkey !== state.grp) return false;
      if (state.wa === 'yes' && !r._waUrl) return false;
      if (state.wa === 'no' && r._waUrl) return false;
      return true;
    }).sort((a, b) =>
      (PLAYER_CAT_ORDER[a._catKey] ?? 9) - (PLAYER_CAT_ORDER[b._catKey] ?? 9) ||
      String(a.group_label || 'zz').localeCompare(String(b.group_label || 'zz')) ||
      norm(a.nickname).localeCompare(norm(b.nickname))
    );
  }
  function matchedFacs(){ return state.index.facs.filter(f => hit(f.name + ' ' + f.code)); }
  function matchedCats(){ return state.index.cats.filter(c => hit(catPlural(c.name, c.key) + ' ' + c.name + ' ' + c.code + ' ' + c.key)); }

  function hasFacets(){ return !!(state.cat || state.fac || state.car || state.grp || state.wa); }
  function clearFacets(){ state.cat = state.fac = state.car = state.grp = state.wa = ''; }

  // ── piezas de UI ────────────────────────────────────────────────────
  function secShell(id, title, countText, action){
    const sec = el('section', 'dx-sec');
    sec.id = id;
    const h = el('div', 'dx-sec-h');
    const h2 = el('h2', null, title);
    h.appendChild(h2);
    if (countText) h.appendChild(el('span', 'dx-sec-n', countText));
    h.appendChild(el('span', 'dx-rule'));
    if (action) h.appendChild(action);
    sec.appendChild(h);
    const body = el('div', 'dx-sec-b');
    sec.appendChild(body);
    return { sec, body };
  }

  function bars(level){
    const b = el('span', 'dx-bars');
    b.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= 3; i++){
      const i2 = document.createElement('i');
      if (level && i > level) i2.className = 'off';
      if (!level) i2.className = 'off';
      b.appendChild(i2);
    }
    return b;
  }

  function catTile(c){
    const key = c.key;
    const href = key ? 'Categoria2.html?code=' + key : null;
    const t = el(href ? 'a' : 'div', 'dx-tile');
    if (href) t.href = href;
    if (key) t.dataset.cat = key;
    const top = el('div', 'dx-tile-top');
    top.appendChild(bars(key === 'principiante' ? 1 : key === 'intermedio' ? 2 : key === 'avanzado' ? 3 : 0));
    const tx = el('div', 'dx-tile-tx');
    tx.appendChild(el('b', null, catPlural(c.name, key)));
    // En “General” el conteo es el total histórico; en la edición vigente son
    // los jugadores inscritos en ese torneo.
    if (state.mode === 'current'){
      tx.appendChild(el('small', null, c.n
        ? plural(c.n, 'jugador en el torneo actual', 'jugadores en el torneo actual')
        : 'Sin jugadores en el torneo actual'));
    } else {
      const hist = key ? state.histCounts && state.histCounts[key] : null;
      tx.appendChild(el('small', null, hist == null
        ? 'Contando jugadores históricos…'
        : plural(hist, 'jugador en total', 'jugadores en total')));
    }
    top.appendChild(tx);
    t.appendChild(top);
    t.appendChild(el('span', 'dx-go', href ? 'Ver categoría →' : 'Categoría del torneo'));
    return t;
  }

  // Ficha de FACULTAD: idéntica a la ficha de competidor (misma estructura y
  // medidas de supabase/player-card.js — .fn-card / .fn-portrait / .fn-body),
  // en gama dorada y sin la insignia de categoría de arriba a la derecha.
  function facTile(f){
    window.SB_PLAYER_CARD.ensureFnStyles();
    const t = el('a', 'fn-card fn-fac dx-faccard');
    t.href = 'Facultad.html?code=' + encodeURIComponent(f.code);
    t.setAttribute('aria-label', 'Abrir ' + f.name);
    const port = el('div', 'fn-portrait');
    const wrap = el('span', 'fac-wrap');
    const img = document.createElement('img');
    img.className = 'fac-item';
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.src = window.SB_LOGOS.facultyLogo(f.code);
    img.onerror = () => { img.src = window.SB_LOGOS.FALLBACK_FACULTY; img.onerror = null; };
    wrap.appendChild(img);
    port.appendChild(wrap);
    t.appendChild(port);
    const body = el('div', 'fn-body');
    const name = el('div', 'fn-name');
    name.title = f.name;
    name.appendChild(el('span', null, f.name));
    body.appendChild(name);
    body.appendChild(el('div', 'fn-career', plural(f.n, 'jugador', 'jugadores')));
    t.appendChild(body);
    return t;
  }

  // Las carreras y los grupos ya no son bloques del directorio: siguen siendo
  // FILTROS de la lista de jugadores (facetsRow) y campos de búsqueda.

  // Ficha de jugador: EXACTAMENTE la misma que en Facultad.html / Categoria2.html
  // — fuente única en supabase/player-card.js (misma estructura, mismos tamaños,
  // misma rareza por categoría). Aquí no se redefine nada de su formato; solo se
  // garantiza que SIEMPRE haya escudo: si el jugador no trae facultad, en vez de
  // la inicial en un círculo se usa el escudo genérico de la UNAM.
  function playerRow(r){
    const card = window.SB_PLAYER_CARD.playerCard(r);
    const mono = card.querySelector('.fn-mono');
    if (mono){
      const em = el('span', 'fn-emblem');
      const img = document.createElement('img');
      img.src = window.SB_LOGOS.FALLBACK_FACULTY;
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      em.appendChild(img);
      mono.replaceWith(em);
    }
    return card;
  }

  function selectFacet(id, label, options, value, onChange){
    const field = el('label', 'dx-ffield');
    field.appendChild(el('span', 'dx-flabel', label));
    const s = el('select', 'dx-sel');
    s.id = id;
    s.setAttribute('aria-label', label);
    options.forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (String(v) === String(value)) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', e => { onChange(e.target.value); state.expanded = false; render(); });
    field.appendChild(s);
    return field;
  }

  function facetsRow(){
    const wrap = el('div', 'dx-filters');
    const idx = state.index;
    const activeN = [state.cat, state.fac, state.car, state.grp, state.wa].filter(Boolean).length;

    const bar = el('div', 'dx-filterbar');
    const btn = el('button', 'dx-filter-btn' + (state.filterOpen ? ' is-open' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(!!state.filterOpen));
    btn.appendChild(el('span', 'dx-filter-ic', ''));
    btn.appendChild(el('span', null, 'Filtros'));
    if (activeN) btn.appendChild(el('span', 'dx-filter-badge', String(activeN)));
    btn.addEventListener('click', e => { e.stopPropagation(); state.filterOpen = !state.filterOpen; render(); });
    bar.appendChild(btn);

    if (hasFacets()){
      const chips = el('div', 'dx-fchips');
      const active = [];
      if (state.cat){ const c = state.index.cats.find(x => String(x.code || x.name) === state.cat); active.push([c ? c.name : state.cat, () => { state.cat = ''; }]); }
      if (state.fac){ const f = state.index.facs.find(x => x.code === state.fac); active.push([f ? shortFac(f.name) : state.fac, () => { state.fac = ''; }]); }
      if (state.car){ const c = state.index.cars.find(x => x.code === state.car); active.push([c ? c.name : state.car, () => { state.car = ''; }]); }
      if (state.grp){ const g = state.index.grps.find(x => x.key === state.grp); active.push([g ? 'Grupo ' + g.label : state.grp, () => { state.grp = ''; }]); }
      if (state.wa) active.push([state.wa === 'yes' ? 'Con WhatsApp' : 'Sin contacto', () => { state.wa = ''; }]);
      active.forEach(([label, off]) => {
        const chip = el('span', 'dx-fchip', label);
        const x = el('button', null, '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Quitar filtro ' + label);
        x.addEventListener('click', () => { off(); state.expanded = false; render(); });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
      const all = el('button', 'dx-btn', 'Limpiar filtros');
      all.type = 'button';
      all.addEventListener('click', () => { clearFacets(); state.filterOpen = false; render(); });
      chips.appendChild(all);
      bar.appendChild(chips);
    }
    wrap.appendChild(bar);

    if (state.filterOpen){
      const panel = el('div', 'dx-filter-panel');
      panel.addEventListener('click', e => e.stopPropagation());
      const grid = el('div', 'dx-filter-grid');
      grid.appendChild(selectFacet('dxFCat', 'Categoría',
        [['', 'Todas las categorías']].concat(idx.cats.map(c => [c.code || c.name, c.name])),
        state.cat, v => { state.cat = v; }));
      if (idx.facs.length) grid.appendChild(selectFacet('dxFFac', 'Facultad',
        [['', 'Todas las facultades']].concat(idx.facs.map(f => [f.code, shortFac(f.name)])),
        state.fac, v => { state.fac = v; }));
      if (idx.cars.length) grid.appendChild(selectFacet('dxFCar', 'Carrera',
        [['', 'Todas las carreras']].concat(idx.cars.map(c => [c.code, c.name])),
        state.car, v => { state.car = v; }));
      if (idx.grps.length) grid.appendChild(selectFacet('dxFGrp', 'Grupo',
        [['', 'Todos los grupos']].concat(idx.grps.map(g => [g.key, 'Grupo ' + g.label + (g.cat ? ' · ' + g.cat : '')])),
        state.grp, v => { state.grp = v; }));
      grid.appendChild(selectFacet('dxFWa', 'Contacto',
        [['', 'Con o sin WhatsApp'], ['yes', 'Con WhatsApp'], ['no', 'Sin contacto']],
        state.wa, v => { state.wa = v; }));
      panel.appendChild(grid);
      const footer = el('div', 'dx-filter-footer');
      const closeBtn = el('button', 'dx-filter-close', 'Cerrar');
      closeBtn.type = 'button';
      closeBtn.addEventListener('click', () => { state.filterOpen = false; render(); });
      footer.appendChild(closeBtn);
      panel.appendChild(footer);
      wrap.appendChild(panel);
    }
    return wrap;
  }

  function emptyBlock(title, text, actionLabel, action){
    const box = el('div', 'dx-empty');
    box.appendChild(el('b', null, title));
    box.appendChild(el('p', null, text));
    if (actionLabel){
      const b = el('button', 'dx-btn', actionLabel);
      b.type = 'button';
      b.addEventListener('click', action);
      box.appendChild(b);
    }
    return box;
  }

  function focusSection(id){
    const node = document.getElementById(id);
    if (!node) return;
    const y = window.scrollY + node.getBoundingClientRect().top - 96;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // ── render ──────────────────────────────────────────────────────────
  function renderScopes(counts){
    const wrap = $('#dxScopes');
    wrap.textContent = '';
    SCOPES.forEach(([key, label]) => {
      const b = el('button', 'dx-scope' + (state.scope === key ? ' on' : '') + (counts[key] ? '' : ' is-empty'));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(state.scope === key));
      b.appendChild(el('span', null, label));
      b.appendChild(el('i', null, String(counts[key])));
      b.addEventListener('click', () => {
        state.scope = key; state.expanded = false;
        syncUrl(); render();
        if (key !== 'todo') focusSection('dxResults');
      });
      wrap.appendChild(b);
    });
  }

  function renderTries(){
    const wrap = $('#dxTries');
    const idx = state.index;
    const tries = [];
    if (idx.facs[0]) tries.push(shortFac(idx.facs[0].name));
    idx.cats.slice(0, 2).forEach(c => tries.push(c.name));
    if (idx.cars[0]) tries.push(idx.cars[0].name);
    if (!tries.length){ wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.textContent = '';
    wrap.appendChild(el('b', null, 'Prueba con'));
    tries.slice(0, 4).forEach(t => {
      const b = el('button', 'dx-try', t);
      b.type = 'button';
      b.addEventListener('click', () => {
        state.q = t; $('#dxQ').value = t; $('#dxX').hidden = false;
        state.expanded = false; syncUrl(); render();
      });
      wrap.appendChild(b);
    });
  }

  function render(){
    if (!state.index) return;
    const idx = state.index;    const q = norm(state.q);
    const players = filteredPlayers();
    const facs = matchedFacs(), cats = matchedCats();

    $('#dxNPlayers').textContent = state.rows.length;
    $('#dxNFacs').textContent = idx.facs.length;
    $('#dxNCats').textContent = idx.cats.length;

    const counts = {
      todo: players.length + facs.length + cats.length,
      jugadores: players.length, facultades: facs.length, categorias: cats.length
    };
    renderScopes(counts);

    $('#dxMeta').textContent = [
      state.editionLabel,
      state.loadedAt ? 'Actualizado ' + state.loadedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
      q ? counts.todo + ' resultados para “' + state.q.trim() + '”' : plural(state.rows.length, 'jugador confirmado', 'jugadores confirmados')
    ].filter(Boolean).join(' · ');

    const out = $('#dxResults');
    out.textContent = '';
    const show = k => state.scope === 'todo' || state.scope === k;

    if (!state.rows.length){
      out.appendChild(emptyBlock('Aún no hay jugadores confirmados',
        'El directorio se llena conforme la organización confirma inscripciones de esta edición.'));
      return;
    }
    if (!counts.todo){
      out.appendChild(emptyBlock('Sin resultados',
        'Nada coincide con “' + state.q.trim() + '”. Prueba con un apodo, una facultad, una carrera, un grupo o el nombre de una categoría.',
        'Limpiar búsqueda', () => { setQuery(''); }));
      return;
    }

    if (show('categorias') && cats.length){
      const { sec, body } = secShell('dxSecCats', 'Categorías', plural(cats.length, 'categoría', 'categorías'));
      const g = el('div', 'dx-grid cats');
      cats.forEach(c => g.appendChild(catTile(c)));
      body.appendChild(g);
      out.appendChild(sec);
    }
    if (show('facultades') && facs.length){
      const { sec, body } = secShell('dxSecFacs', 'Facultades',
        facs.length + ' de ' + idx.facs.length + ' con jugadores');
      const g = el('div', 'dx-grid facs');
      facs.forEach(f => g.appendChild(facTile(f)));
      body.appendChild(g);
      out.appendChild(sec);
    }
    if (show('jugadores')){
      const { sec, body } = secShell('dxSecPlayers', 'Jugadores',
        players.length + ' de ' + state.rows.length);
      if (state.mode === 'general')
        body.appendChild(el('p', 'dx-note', 'Vista general: aparecen todos los jugadores registrados en cualquier edición, con su facultad, carrera y categoría más recientes.'));
      body.appendChild(facetsRow());
      if (!players.length){
        body.appendChild(emptyBlock('Ningún jugador coincide',
          'Quita algún filtro o cambia la búsqueda para ver más jugadores.',
          hasFacets() ? 'Limpiar filtros' : null,
          () => { clearFacets(); state.expanded = false; render(); }));
      } else {
        const list = el('div', 'dx-pcards');
        const cap = state.expanded ? players.length : PAGE;
        players.slice(0, cap).forEach(r => list.appendChild(playerRow(r)));
        body.appendChild(list);
        if (players.length > cap){
          const more = el('button', 'dx-more', 'Ver los ' + (players.length - cap) + ' restantes');
          more.type = 'button';
          more.addEventListener('click', () => { state.expanded = true; render(); });
          body.appendChild(more);
        } else if (state.expanded && players.length > PAGE){
          const less = el('button', 'dx-more', 'Ver solo los primeros ' + PAGE);
          less.type = 'button';
          less.addEventListener('click', () => { state.expanded = false; render(); focusSection('dxSecPlayers'); });
          body.appendChild(less);
        }
      }
      out.appendChild(sec);
    }

    // Alcance concreto sin nada que mostrar (p. ej. “Carreras” en una edición
    // sin carreras registradas): mejor decirlo que dejar el hueco en blanco.
    if (state.scope !== 'todo' && !out.children.length){
      const label = (SCOPES.find(s => s[0] === state.scope) || [, state.scope])[1];
      out.appendChild(emptyBlock('Sin ' + String(label).toLowerCase(),
        q ? 'Nada en “' + label.toLowerCase() + '” coincide con “' + state.q.trim() + '”. Cambia la búsqueda o vuelve a “Todo”.'
          : 'Esta edición no tiene ' + String(label).toLowerCase() + ' con jugadores registrados.',
        'Ver todo', () => { state.scope = 'todo'; syncUrl(); render(); }));
    }
  }

  function skeletons(){
    const out = $('#dxResults');
    out.textContent = '';
    for (let i = 0; i < 6; i++) out.appendChild(el('div', 'dx-skel'));
  }
  function showState(title, sub, retry){
    const box = $('#dxState');
    box.style.display = 'block';
    box.textContent = '';
    if (title) box.appendChild(el('b', null, title));
    if (sub) box.appendChild(document.createTextNode(sub));
    if (retry){
      const b = el('button', 'dx-btn', 'Reintentar');
      b.type = 'button'; b.style.marginTop = '16px';
      b.addEventListener('click', () => load(state.mode));
      box.appendChild(document.createElement('br'));
      box.appendChild(b);
    }
  }

  // ── selector General / edición vigente ──────────────────────────────
  // Mismo par de vistas que Facultad.html y Categoria2.html: el padrón
  // histórico completo (“General”) o solo la edición vigente.
  function renderModes(edLabel){
    const nav = $('#dxEdSel');
    nav.hidden = false;
    nav.textContent = '';
    const mk = (mode, label) => {
      const b = el('button', 'dx-edtab' + (state.mode === mode ? ' on' : ''));
      b.type = 'button';
      b.appendChild(el('span', null, label));
      b.addEventListener('click', () => { if (state.mode !== mode) load(mode); });
      return b;
    };
    nav.appendChild(mk('general', 'General'));
    nav.appendChild(mk('current', edLabel || 'Edición vigente'));  }

  // Padrón histórico: misma fuente que usa Facultad.html para su vista
  // “General” — get_public_academic_roster por facultad (ya deduplica por
  // jugador canónico y resuelve facultad/carrera/categoría).
  let generalRowsCache = null;
  async function fetchGeneralRoster(){
    if (generalRowsCache) return generalRowsCache;
    const facs = await window.SB_CATALOG.getFaculties();
    const lists = await Promise.all(facs.map(f =>
      window.SB_PARTICIPANTS.fetchAcademicRoster('faculty', f.code).catch(() => [])));
    const byPlayer = new Map();
    [].concat.apply([], lists).forEach(r => {
      const k = r.player_id || r.registration_id || r.nickname;
      if (!byPlayer.has(k)) byPlayer.set(k, r);
    });
    generalRowsCache = [...byPlayer.values()];
    return generalRowsCache;
  }

  // Conteo HISTÓRICO por categoría (todas las ediciones), independiente de la
  // vista elegida: es el número que muestran las fichas de categoría.
  function countsByCat(rows){
    const out = {};
    rows.forEach(r => {
      const k = catKeyOf(r.category_name, r.category_code);
      if (!k) return;
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }
  async function ensureHistCounts(){
    if (state.histCounts) return;
    try {
      const rows = await fetchGeneralRoster();
      state.histCounts = countsByCat(rows);
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('DIR-004', e);
      state.histCounts = countsByCat(state.rows);
    }
    render();
  }

  // Padrón REAL de la edición vigente: get_public_pre_group_roster (la misma
  // fuente que la “Lista de participantes” de la página de inicio, con TODOS los
  // inscritos confirmados — no solo los que aceptaron compartir contacto, que es
  // lo único que devuelve get_public_contact_directory). El contacto se cruza por
  // apodo para conservar el filtro de WhatsApp.
  async function fetchCurrentRoster(edition, contactRows){
    const rows = await window.SB_PRE_GROUP.fetchRoster(edition.id);
    const facs = await window.SB_CATALOG.getFaculties().catch(() => []);
    const facById = new Map(facs.map(f => [String(f.id), f]));
    const facByCode = new Map(facs.map(f => [String(f.code), f]));
    const byNick = new Map();
    try {
      const { data } = await window.SB.from('v_public_participants')
        .select('registration_id,nickname,faculty_code,career_code').eq('edition_id', edition.id);
      (data || []).forEach(r => { if (r && r.nickname) byNick.set(norm(r.nickname), r); });
    } catch(e){ /* respaldo: los ids que trae la RPC */ }
    const carById = new Map(), carByCode = new Map();
    const facCodes = new Set([...byNick.values()].map(v => v.faculty_code).filter(Boolean));
    await Promise.all(facs.filter(f => facCodes.has(f.code)).map(async f => {
      const list = await window.SB_CATALOG.getCareersByFaculty(f.id).catch(() => []);
      list.forEach(c => { carById.set(String(c.id), c); carByCode.set(String(c.code), c); });
    }));
    const contactByNick = new Map((contactRows || []).map(r => [norm(r.nickname), r]));
    const out = [];
    rows.forEach(row => {
      (Array.isArray(row.participants) ? row.participants : []).filter(Boolean).forEach(p => {
        const link = byNick.get(norm(p.nickname)) || null;
        const facCode = (link && link.faculty_code) || (facById.get(String(p.faculty)) || {}).code || null;
        const carCode = (link && link.career_code) || (carById.get(String(p.career)) || {}).code || null;
        const fac = facCode ? facByCode.get(String(facCode)) : null;
        const car = carCode ? carByCode.get(String(carCode)) : null;
        const ct = contactByNick.get(norm(p.nickname)) || null;
        out.push({
          nickname: p.nickname,
          registration_id: p.public_code || (link && link.registration_id) || null,
          category_code: row.category_code, category_name: row.category_name,
          faculty_code: facCode, faculty_name: fac ? fac.name : null,
          career_code: carCode, career_name: car ? car.name : null,
          group_label: ct ? ct.group_label : null,
          group_id: ct ? ct.group_id : null,
          phone_normalized: ct ? ct.phone_normalized : null,
          entry_status: ct ? ct.entry_status : null,
          _waUrl: ct ? ct._waUrl : null
        });
      });
    });
    return out;
  }

  // ── carga ───────────────────────────────────────────────────────────
  async function load(mode){
    if (!window.SB_READY){
      showState('Sitio no conectado', 'Falta configurar la conexión al servidor (supabase/config.js). Avisa a la organización.');
      return;
    }
    state.mode = mode === 'current' ? 'current' : 'general';
    state.expanded = false;
    clearFacets();
    $('#dxState').style.display = 'block';
    $('#dxState').textContent = '';
    const spin = el('span', 'spin', '◌');
    spin.setAttribute('aria-hidden', 'true');
    $('#dxState').appendChild(spin);
    $('#dxState').appendChild(document.createTextNode(' Cargando directorio…'));
    skeletons();
    const t0 = performance.now();
    try {
      const res = await window.SB_PARTICIPANTS.fetchEnrichedDirectory();
      const ed = res.edition || {};
      state.edcats = (res.edcats || []).slice();
      let rows = res.rows || [];
      if (state.mode === 'general'){
        try { rows = await fetchGeneralRoster(); }
        catch(e){
          window.SB_LOG && window.SB_LOG.error('DIR-003', e);
          state.mode = 'current';
        }
      }
      if (state.mode === 'current'){
        try { rows = await fetchCurrentRoster(ed, res.rows || []); }
        catch(e){ window.SB_LOG && window.SB_LOG.error('DIR-005', e); rows = res.rows || []; }
      }
      window.SB_LOG && window.SB_LOG.op('DIR', 'directorio-' + state.mode, performance.now() - t0, true);
      state.rows = decorate(rows.slice());
      state.index = buildIndex(state.rows, state.edcats);
      state.loadedAt = new Date();
      const edName = ed.name || ed.slug || '';
      const edShort = (String(ed.slug || ed.name || '').match(/(\d{4})\s*-\s*(\d+)/) || [])[0] || edName;
      state.editionLabel = state.mode === 'general' ? 'Todas las ediciones' : edName;
      $('#dxKicker').textContent = 'Torneo de Ping Pong FI';
      $('#dxState').style.display = 'none';
      renderTries();
      render();
      renderModes(edShort || 'Edición vigente');
      if (state.mode === 'general'){ state.histCounts = countsByCat(state.rows); render(); }
      else ensureHistCounts();
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('DIR-001', err);
      $('#dxResults').textContent = '';
      showState('No se pudo cargar el directorio', 'Revisa tu conexión e intenta de nuevo. (código DIR-001)', true);
    }
  }

  // ── búsqueda + URL ──────────────────────────────────────────────────
  let tQ = 0;
  function setQuery(v){
    state.q = v;
    $('#dxQ').value = v;
    $('#dxX').hidden = !v;
    state.expanded = false;
    syncUrl();
    render();
  }
  function syncUrl(){
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    if (state.scope !== 'todo') p.set('ver', state.scope);
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }
  (function readUrl(){
    const p = new URLSearchParams(location.search);
    const q = p.get('q'); const ver = p.get('ver');
    if (q){ state.q = q; $('#dxQ').value = q; $('#dxX').hidden = false; }
    if (ver && SCOPES.some(s => s[0] === ver)) state.scope = ver;
  })();

  $('#dxQ').addEventListener('input', e => {
    const v = e.target.value;
    $('#dxX').hidden = !v;
    clearTimeout(tQ);
    tQ = setTimeout(() => { state.q = v; state.expanded = false; syncUrl(); render(); }, 130);
  });
  $('#dxQ').addEventListener('keydown', e => { if (e.key === 'Escape' && state.q) setQuery(''); });
  $('#dxX').addEventListener('click', () => { setQuery(''); $('#dxQ').focus(); });
  $('#dxReload').addEventListener('click', () => {
    window.SB_PARTICIPANTS.fetchEnrichedDirectory(true).catch(() => {});
    load(state.mode);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.filterOpen){ state.filterOpen = false; render(); return; }
    if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    $('#dxQ').focus();
  });
  document.addEventListener('click', e => {
    if (state.filterOpen && !e.target.closest('.dx-filters')){ state.filterOpen = false; render(); }
  });

  load('general');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
})();
