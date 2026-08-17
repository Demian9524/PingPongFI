// ── Tablero de grupos · interfaz (FASE 2) ───────────────────────────────
// Kanban de "islitas" con drag & drop + alternativa de teclado ("Mover a…").
// Todos los cambios son borrador local (GB_CORE); el backend solo se toca en
// Revisar cambios (preview) y Confirmar y aplicar (apply). Cero SQL directo.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const C = () => window.GB_CORE;
  const UI = () => window.SB_UI;
  let activeEdcat = null;
  let query = '';
  let filterState = 'ALL';        // ALL | UNGROUPED | REVIEW
  let lastPreview = null;
  // registro temporal del orden de extracción del sorteo físico (solo borrador)
  let extractionLog = [];

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(id){
    ['noSession','deniedView','boardView','bootState'].forEach(v => { const n = $('#'+v); if (n) n.style.display = 'none'; });
    if (id) $('#'+id).style.display = 'block';
  }

  // ── arranque / sesión (exclusivo ADMIN/ORGANIZER) ────────────────────
  async function boot(){
    if (!window.SB_READY){
      show('bootState');
      $('#bootState').innerHTML = '<b>Sitio no conectado</b>Falta supabase/config.js.';
      return;
    }
    window.SB_AUTH.onAuthChange(session => { if (!session) show('noSession'); });
    try {
      const session = await window.SB_AUTH.getSession();
      if (!session){ show('noSession'); return; }
      $('#whoami').textContent = (session.user && session.user.email) || '';
      let organizer = false;
      try { organizer = await window.SB_AUTH.isOrganizer(); } catch(e){}
      if (!organizer){ show('deniedView'); return; }
      $('#bootState').innerHTML = '<span class="spin">◌</span> Cargando tablero…';
      await C().load();
      activeEdcat = C().state.edcats.length ? C().state.edcats[0].id : null;
      show('boardView');
      renderAll();
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('GB-000', e);
      show('bootState');
      $('#bootState').innerHTML = '<b>Error al cargar</b>' + (e.message || 'Revisa la conexión.');
    }
  }

  // ── helpers de datos ─────────────────────────────────────────────────
  function st(){ return C().state; }
  function edcatName(id){
    const c = st().edcats.find(x => x.id === id);
    return c ? (c.name || c.code) : ('#' + id);
  }
  function islandsFor(edcatId){
    const real = (st().groupsByEdcat[edcatId] || [])
      .filter(g => !st().deleted.includes(g.id))
      .map(g => ({ key: String(g.id), label: st().renamed[g.id] || g.label, real: true }));
    const temp = st().newGroups
      .filter(g => g.edition_category_id === edcatId)
      .map(g => ({ key: g.temp_id, label: g.label + ' (nuevo)', real: false }));
    return real.concat(temp);
  }
  function membersOf(edcatId, groupKey){
    return Object.keys(st().cur).filter(rid => {
      const c = st().cur[rid];
      return c.edcat === edcatId && String(c.group) === String(groupKey);
    }).map(rid => st().rowById[rid]).filter(Boolean);
  }
  function ungrouped(edcatId){
    return Object.keys(st().cur).filter(rid => {
      const c = st().cur[rid];
      return c.edcat === edcatId && c.group == null && C().eligible(st().rowById[rid] || {});
    }).map(rid => st().rowById[rid]).filter(Boolean);
  }
  function ineligibles(edcatId){
    return Object.keys(st().cur).filter(rid => {
      const c = st().cur[rid];
      return c.edcat === edcatId && c.group == null && !C().eligible(st().rowById[rid] || {});
    }).map(rid => st().rowById[rid]).filter(Boolean);
  }
  function matchesFilter(r){
    if (query){
      const q = query.toLowerCase();
      const hay = [r.nickname_snapshot, r.public_code, r.phone_normalized, r.faculty_code, r.career_code]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    if (filterState === 'REVIEW' && r.requires_review !== true) return false;
    return true;
  }
  function isMoved(rid){
    const c = st().cur[rid], o = st().orig[rid];
    return o && (String(c.group) !== String(o.group) || c.edcat !== o.edcat);
  }


  // ── render principal ─────────────────────────────────────────────────
  function renderAll(){
    renderTabs();
    renderBoard();
    renderBar();
    renderPhase();
    renderExtract();
  }
  // ── estado de la captura del sorteo físico ────────────────────────
  function renderPhase(){
    const n = $('#gbPhase');
    if (!n || !activeEdcat) return;
    const grouped = islandsFor(activeEdcat).some(g => membersOf(activeEdcat, g.key).length);
    let txt, color = 'var(--muted)';
    if (C().hasChanges()){ txt = 'CAPTURA EN PROGRESO — cambios sin guardar'; color = 'var(--gold)'; }
    else if (grouped){ txt = 'GRUPOS GUARDADOS Y PUBLICADOS — lo aplicado ya es visible en la página pública'; }
    else { txt = 'SORTEO FÍSICO SIN CAPTURAR — realiza el sorteo con pelotas y replícalo aquí'; color = 'var(--gold)'; }
    n.textContent = txt;
    n.style.color = color;
  }
  // ── registrar extracción (mismo movimiento que el drag & drop) ────────
  function renderExtract(){
    const who = $('#gbExtractWho'), grp = $('#gbExtractGroup');
    if (!who || !activeEdcat) return;
    const keepWho = who.value, keepGrp = grp.value;
    who.textContent = ''; grp.textContent = '';
    const ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Elige participante…';
    who.appendChild(ph);
    ungrouped(activeEdcat).forEach(r => {
      const o = document.createElement('option');
      o.value = r.registration_id;
      o.textContent = (r.nickname_snapshot || '—') + (r.public_code ? ' · ' + r.public_code : '');
      who.appendChild(o);
    });
    const gph = document.createElement('option'); gph.value = ''; gph.textContent = 'Elige grupo…';
    grp.appendChild(gph);
    islandsFor(activeEdcat).forEach(g => {
      const o = document.createElement('option');
      o.value = g.key; o.textContent = 'Grupo ' + g.label;
      grp.appendChild(o);
    });
    if ([...who.options].some(o => o.value === keepWho)) who.value = keepWho;
    if ([...grp.options].some(o => o.value === keepGrp)) grp.value = keepGrp;
    $('#gbExtractUndo').disabled = !extractionLog.length;
    const logN = $('#gbExtractLog');
    logN.textContent = extractionLog.length
      ? 'Extracciones capturadas: ' + extractionLog.map((x, i) => (i + 1) + '. ' + x.name + ' → Grupo ' + x.groupLabel).join(' · ')
      : 'Sin extracciones capturadas en esta sesión.';
  }
  // ── papeletas del sorteo físico (fase de grupos) ──────────────────
  function openBallotsDialog(){
    if (!activeEdcat) return;
    const c = st().edcats.find(x => x.id === activeEdcat);
    const catName = c ? (c.name || c.code) : '';
    const prefix = String((c && (c.code || c.name)) || 'CAT').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CAT';
    const body = el('div');
    body.appendChild(el('p', 'gb-modal-sub', 'Genera papeletas de participantes y de grupos para el sorteo físico. Una copia de grupo por cada plaza disponible; no asigna a nadie automáticamente.'));
    const parts = ungrouped(activeEdcat).concat(
      islandsFor(activeEdcat).flatMap(g => membersOf(activeEdcat, g.key)));
    body.appendChild(el('p', 'gb-modal-sub', 'Participantes elegibles: ' + parts.length + '.'));
    body.appendChild(el('p', 'gb-modal-sub', 'Capacidad de cada grupo (copias de su papeleta):'));
    const rows = el('div', 'gb-move-list');
    const caps = [];
    islandsFor(activeEdcat).forEach(g => {
      const w = el('label', 'gb-field'); w.style.margin = '0';
      w.appendChild(el('span', null, 'Grupo ' + g.label));
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '1'; inp.max = '12'; inp.className = 'filter';
      inp.value = String(Math.max(membersOf(activeEdcat, g.key).length, 4));
      w.appendChild(inp);
      caps.push({ label: g.label.replace(' (nuevo)',''), inp });
      rows.appendChild(w);
    });
    if (!caps.length) body.appendChild(el('p', 'gb-modal-sub', 'No hay grupos creados; solo se generarán papeletas de participantes.'));
    body.appendChild(rows);
    const act = el('div', 'mact');
    const cancel = el('button', 'btn btn-ghost', 'Cancelar'); cancel.type = 'button';
    cancel.addEventListener('click', closeModal);
    const ok = el('button', 'btn btn-main', 'Generar papeletas'); ok.type = 'button';
    ok.addEventListener('click', () => {
      const pad2 = n => String(n).padStart(2, '0');
      const docs = [];
      if (parts.length){
        docs.push({ type: 'ballots', title: 'Papeletas de participantes — ' + catName,
          items: parts.map((r, i) => ({ main: r.nickname_snapshot || '—', sub: r.public_code || '', code: prefix + ' · N' + pad2(i + 1) })) });
      }
      const gItems = [];
      caps.forEach(g => {
        const n = Math.max(1, Math.min(12, parseInt(g.inp.value, 10) || 1));
        gItems.push({ main: 'GRUPO ' + g.label, copies: n, code: prefix + ' · G' + g.label });
      });
      if (gItems.length) docs.push({ type: 'ballots', title: 'Papeletas de grupos — ' + catName, items: gItems });
      const master = [];
      parts.forEach((r, i) => master.push({ text: r.nickname_snapshot || '—', detail: 'Participante', code: prefix + ' · N' + pad2(i + 1), count: 1 }));
      caps.forEach(g => master.push({ text: 'GRUPO ' + g.label, detail: 'Papeleta de grupo', code: prefix + ' · G' + g.label, count: Math.max(1, Math.min(12, parseInt(g.inp.value, 10) || 1)) }));
      docs.push({ type: 'master', title: 'Lista maestra — sorteo de grupos — ' + catName,
        meta: { tipo: 'Sorteo de grupos (físico)', participantes: parts.length, grupos: caps.length }, rows: master });
      try {
        sessionStorage.setItem('papeletas-payload', JSON.stringify({
          edition: (st().edition && (st().edition.name || st().edition.slug)) || '',
          category: catName, prefix, generatedAt: new Date().toISOString(),
          docType: 'GRUPOS', docs
        }));
      } catch(e){}
      closeModal();
      window.open('PapeletasSorteo.html', '_blank');
    });
    act.appendChild(cancel); act.appendChild(ok);
    body.appendChild(act);
    openModal('Papeletas del sorteo físico — ' + catName, body);
  }

  function wireExtract(){
    const toggle = $('#gbExtractToggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const p = $('#gbExtract');
      const on = p.style.display === 'none';
      p.style.display = on ? 'block' : 'none';
      toggle.textContent = on ? 'Ocultar registro de extracción' : 'Registrar extracción';
      if (on) renderExtract();
    });
    const bb = $('#gbBallots');
    if (bb) bb.addEventListener('click', openBallotsDialog);
    $('#gbExtractGo').addEventListener('click', () => {
      const rid = $('#gbExtractWho').value;
      const gval = $('#gbExtractGroup').value;
      if (!rid || !gval){ UI().toast('Elige participante y grupo extraído.', 'warn'); return; }
      const g = islandsFor(activeEdcat).find(x => String(x.key) === String(gval));
      if (!g) return;
      const key = g.real ? Number(g.key) : g.key;
      const r = st().rowById[rid];
      requestMove(rid, key);
      extractionLog.push({ rid, name: (r && r.nickname_snapshot) || rid, groupLabel: g.label });
      renderExtract();
      UI().toast('Extracción registrada: ' + ((r && r.nickname_snapshot) || '') + ' → Grupo ' + g.label + '. Recuerda guardar.', 'ok');
    });
    $('#gbExtractUndo').addEventListener('click', () => {
      if (!extractionLog.length) return;
      const last = extractionLog.pop();
      if (C().undo()) renderAll();
      UI().toast('Extracción deshecha: ' + last.name + '.', 'ok');
    });
  }
  // ── sincronización con otros módulos (qualification-admin) ──────────
  function emitCategoryChange(c){
    window.dispatchEvent(new CustomEvent('groupboard:categorychange', {
      detail: { editionCategoryId: Number(c.id), categoryCode: c.code }
    }));
  }
  window.GROUP_BOARD = Object.assign(window.GROUP_BOARD || {}, {
    getActiveEditionCategoryId(){ return activeEdcat == null ? null : Number(activeEdcat); },
    // cambia el tablero superior por el flujo normal; silent evita re-emitir el evento
    selectEditionCategory(edcatId, opts){
      const c = st().edcats.find(x => Number(x.id) === Number(edcatId));
      if (!c) return false;
      activeEdcat = c.id;
      renderAll();
      if (!(opts && (opts.silentQualificationSync || opts.source === 'qualification-editor')))
        emitCategoryChange(c);
      return true;
    }
  });
  function renderTabs(){
    const wrap = $('#gbTabs');
    wrap.textContent = '';
    st().edcats.forEach(c => {
      const b = el('button', 'gb-tab' + (c.id === activeEdcat ? ' on' : ''), c.name || c.code);
      b.type = 'button';
      const n = Object.keys(st().cur).filter(rid => st().cur[rid].edcat === c.id).length;
      b.appendChild(el('span', 'gb-tab-n', String(n)));
      b.addEventListener('click', () => { activeEdcat = c.id; renderAll(); emitCategoryChange(c); });
      wrap.appendChild(b);
    });
    $('#edName').textContent = (st().edition.name || st().edition.slug);
  }

  function renderBoard(){
    const wrap = $('#gbBoard');
    wrap.textContent = '';
    if (!activeEdcat){ wrap.appendChild(el('div', 'state', 'Sin categorías.')); return; }

    // isla "Sin grupo"
    wrap.appendChild(renderIsland({ key: null, label: 'Sin grupo', real: false, isPool: true },
      ungrouped(activeEdcat)));

    // islas de grupos
    islandsFor(activeEdcat).forEach(g => wrap.appendChild(renderIsland(g, membersOf(activeEdcat, g.key))));

    // + nuevo grupo
    const add = el('button', 'gb-add', '+ Nuevo grupo');
    add.type = 'button';
    add.addEventListener('click', () => {
      const label = prompt('Etiqueta del grupo nuevo (p. ej. C):');
      if (!label || !label.trim()) return;
      C().addGroup(activeEdcat, label.trim());
      renderAll();
    });
    wrap.appendChild(add);

    // no elegibles (plegable, informativa)
    const inel = ineligibles(activeEdcat);
    const det = el('details', 'gb-inel');
    const sum = el('summary', null, 'No elegibles (' + inel.length + ') — sin inscripción o pago confirmado; no se pueden asignar');
    det.appendChild(sum);
    const list = el('div', 'gb-island-body');
    inel.filter(matchesFilter).forEach(r => list.appendChild(renderCard(r, false)));
    if (!inel.length) list.appendChild(el('div', 'gb-empty', 'Ninguno.'));
    det.appendChild(list);
    wrap.appendChild(det);
  }

  function sizeNote(n){
    if (n > 4) return { txt: n + ' integrantes — supera el máximo recomendado', cls: 'warn' };
    if (n > 0 && n < 3) return { txt: n + (n === 1 ? ' integrante' : ' integrantes') + ' — grupo pequeño', cls: 'dim' };
    return { txt: n + ' integrantes', cls: '' };
  }

  function renderIsland(g, members){
    const isle = el('section', 'gb-island hud' + (g.isPool ? ' pool' : ''));
    isle.dataset.groupKey = g.key == null ? '' : g.key;

    const head = el('header', 'gb-island-head');
    head.appendChild(el('b', null, g.isPool ? 'Sin grupo' : 'Grupo ' + g.label));
    const note = g.isPool
      ? { txt: members.length + (members.length === 1 ? ' esperando grupo' : ' esperando grupo'), cls: '' }
      : sizeNote(members.length);
    head.appendChild(el('span', 'gb-count ' + note.cls, note.txt));
    const tools = el('span', 'gb-tools');
    if (!g.isPool){
      const ren = el('button', 'gb-ico', '✎'); ren.type = 'button'; ren.title = 'Renombrar grupo';
      ren.addEventListener('click', () => {
        const nl = prompt('Nueva etiqueta del grupo:', g.label.replace(' (nuevo)',''));
        if (!nl || !nl.trim()) return;
        C().renameGroup(g.real ? Number(g.key) : g.key, nl.trim());
        renderAll();
      });
      tools.appendChild(ren);
      if (g.real){
        const tb = el('button', 'gb-ico', '▦'); tb.type = 'button'; tb.title = 'Ver tabla del grupo';
        tb.addEventListener('click', () => showStandings(Number(g.key), g.label));
        tools.appendChild(tb);
      }
      if (!members.length){
        const del = el('button', 'gb-ico', '🗑'); del.type = 'button'; del.title = 'Eliminar grupo (solo vacío)';
        del.addEventListener('click', () => {
          if (!C().deleteGroup(g.real ? Number(g.key) : g.key)){
            UI().toast('El grupo no está vacío.', 'warn'); return;
          }
          renderAll();
        });
        tools.appendChild(del);
      }
    }
    head.appendChild(tools);
    isle.appendChild(head);

    const body = el('div', 'gb-island-body');
    body.addEventListener('dragover', ev => { ev.preventDefault(); isle.classList.add('over'); });
    body.addEventListener('dragleave', () => isle.classList.remove('over'));
    body.addEventListener('drop', ev => {
      ev.preventDefault(); isle.classList.remove('over');
      const rid = ev.dataTransfer.getData('text/plain');
      if (rid) requestMove(rid, g.key == null ? null : (g.real ? Number(g.key) : g.key));
    });
    members.filter(matchesFilter).forEach(r => body.appendChild(renderCard(r, true)));
    if (!members.length) body.appendChild(el('div', 'gb-empty', g.isPool ? 'Nadie sin grupo.' : 'Sin integrantes.'));
    isle.appendChild(body);
    return isle;
  }

  function renderCard(r, draggable){
    const card = el('article', 'gb-card' + (isMoved(r.registration_id) ? ' moved' : '') + (draggable ? '' : ' dim'));
    card.dataset.rid = r.registration_id;
    if (draggable){
      card.draggable = true;
      card.addEventListener('dragstart', ev => {
        ev.dataTransfer.setData('text/plain', r.registration_id);
        ev.dataTransfer.effectAllowed = 'move';
        card.classList.add('drag');
      });
      card.addEventListener('dragend', () => card.classList.remove('drag'));
    }
    // logo facultad
    const img = document.createElement('img');
    img.className = 'gb-logo';
    img.alt = r.faculty_name || r.faculty_code || 'Facultad';
    const logo = window.SB_LOGOS ? window.SB_LOGOS.resolveForTable(r.faculty_code, r.career_code, r.registration_id)
                                 : null;
    img.src = logo ? logo.src : 'assets/logos/fallback/facultad-default.png';
    img.onerror = () => { img.onerror = null; img.src = 'assets/logos/fallback/facultad-default.png'; };
    card.appendChild(img);

    const info = el('div', 'gb-info');
    const top = el('div', 'gb-line1');
    const nameB = el('b');
    // enlace al perfil separado del drag: click simple sin arrastre, y se
    // detiene la propagación para no abrir el menú de la tarjeta.
    const nameLink = window.SB_LINKS ? window.SB_LINKS.makePlayerLink(r.nickname_snapshot, r.registration_id, { stopPropagation: true }) : null;
    if (nameLink && nameLink.tagName === 'A'){
      nameLink.target = '_blank';
      nameLink.rel = 'noopener';
      nameLink.title = 'Ver perfil público (se abre en pestaña nueva)';
      nameLink.addEventListener('mousedown', ev => ev.stopPropagation());
      nameB.appendChild(nameLink);
    } else {
      nameB.textContent = r.nickname_snapshot || '—';
    }
    top.appendChild(nameB);
    if (r.has_played_matches) { const dot = el('span', 'gb-played', '●'); dot.title = 'Ya tiene partidos jugados'; top.appendChild(dot); }
    info.appendChild(top);
    info.appendChild(el('span', 'gb-line2',
      [(r.public_code || 'sin folio'),
       (r.faculty_code === 'INGENIERIA' ? (r.career_name || r.career_code || 'FI') : (r.faculty_name || r.faculty_code || '—'))].join(' · ')));
    const badges = el('div', 'gb-badges');
    badges.appendChild(UI().badge(r.registration_status));
    badges.appendChild(UI().badge(r.payment_status || 'PENDING'));
    if (r.requires_review === true) badges.appendChild(el('span', 'badge warn', 'Revisión'));
    info.appendChild(badges);
    card.appendChild(info);

    if (draggable){
      const menu = el('button', 'gb-ico gb-menu', '⋯');
      menu.type = 'button';
      menu.setAttribute('aria-label', 'Acciones de ' + (r.nickname_snapshot || 'participante'));
      menu.addEventListener('click', () => openCardMenu(r));
      card.appendChild(menu);
    }
    return card;
  }

  // ── menú de tarjeta: Mover a… / Cambiar de categoría (teclado OK) ───
  function openCardMenu(r){
    const rid = r.registration_id;
    const body = el('div');
    body.appendChild(el('p', 'gb-modal-sub', 'Mover a…'));
    const list = el('div', 'gb-move-list');
    const cur = st().cur[rid];
    const options = [{ key: null, label: 'Sin grupo' }].concat(
      islandsFor(cur.edcat).map(g => ({ key: g.real ? Number(g.key) : g.key, label: 'Grupo ' + g.label })));
    options.forEach(opt => {
      if (String(opt.key) === String(cur.group)) return;
      const b = el('button', 'btn btn-ghost', opt.label);
      b.type = 'button';
      b.addEventListener('click', () => { closeModal(); requestMove(rid, opt.key); });
      list.appendChild(b);
    });
    if (!list.children.length){
      list.appendChild(el('p', 'gb-modal-sub', 'No hay otros destinos; crea un grupo con «+ Nuevo grupo».'));
    }
    body.appendChild(list);
    const catBtn = el('button', 'btn btn-ghost', 'Cambiar de categoría…');
    catBtn.type = 'button';
    catBtn.style.marginTop = '12px';
    catBtn.addEventListener('click', () => { closeModal(); openTransferDialog(r); });
    body.appendChild(catBtn);
    openModal((r.nickname_snapshot || 'Participante'), body);
  }

  // política de partidos jugados al salir del origen
  function needsPolicy(r){
    const o = st().orig[r.registration_id];
    return r.has_played_matches === true && o && o.group != null;
  }
  function policyDialog(r, done){
    const body = el('div');
    body.appendChild(el('p', 'gb-modal-sub',
      (r.nickname_snapshot || 'Participante') + ' ya tiene partidos jugados en su grupo de origen. ¿Qué pasa con esos resultados?'));
    const kind = el('div', 'gb-move-list');
    let moveKind = null;
    [['LEVEL','Se mueve por nivel'],['LOGISTIC','Se mueve por horario/logística'],['OTHER','Otro motivo']].forEach(([k, lbl]) => {
      const b = el('button', 'btn btn-ghost', lbl); b.type = 'button';
      b.addEventListener('click', () => {
        moveKind = k;
        kind.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        sel.value = k === 'LEVEL' ? 'VOID_FOR_OLD_STANDINGS' : k === 'LOGISTIC' ? 'KEEP_IN_OLD' : '';
      });
      kind.appendChild(b);
    });
    body.appendChild(kind);
    body.appendChild(el('p', 'gb-modal-sub', 'Política para sus partidos jugados:'));
    const sel = document.createElement('select');
    sel.className = 'filter';
    [['','Elige una política…'],
     ['KEEP_IN_OLD','Conservar: siguen contando en el grupo anterior'],
     ['VOID_FOR_OLD_STANDINGS','Anular para clasificación (historial intacto)'],
     ['MANUAL_REVIEW','Dejar pendiente para revisión manual']].forEach(([v, t]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
    });
    body.appendChild(sel);
    const act = el('div', 'mact');
    const ok = el('button', 'btn btn-main', 'Continuar'); ok.type = 'button';
    ok.addEventListener('click', () => {
      if (!moveKind || !sel.value){ UI().toast('Elige tipo de movimiento y política.', 'warn'); return; }
      closeModal();
      done({ move_kind: moveKind, policy: sel.value });
    });
    const cancel = el('button', 'btn btn-ghost', 'Cancelar'); cancel.type = 'button';
    cancel.addEventListener('click', closeModal);
    act.appendChild(cancel); act.appendChild(ok);
    body.appendChild(act);
    openModal('Partidos jugados', body);
  }

  function requestMove(rid, groupKey){
    const r = st().rowById[rid];
    if (!r) return;
    const cur = st().cur[rid];
    if (String(cur.group) === String(groupKey)) return;
    const doMove = meta => { C().moveTo(rid, groupKey, cur.edcat, meta || {}); renderAll(); };
    // política solo si sale de su grupo original con jugados y aún no la eligió
    if (needsPolicy(r) && groupKey !== null && !(st().meta[rid] && st().meta[rid].policy)){
      policyDialog(r, doMove);
    } else if (needsPolicy(r) && groupKey !== null){
      doMove();
    } else {
      doMove();
    }
  }

  // ── cambio de categoría (motivo individual + política) ──────────────
  function openTransferDialog(r){
    const rid = r.registration_id;
    const cur = st().cur[rid];
    const body = el('div');
    body.appendChild(el('p', 'gb-modal-sub', 'Categoría actual: ' + edcatName(cur.edcat) +
      '. La categoría provisional y los datos del jugador no se modifican.'));
    const selCat = document.createElement('select'); selCat.className = 'filter';
    st().edcats.filter(c => c.id !== cur.edcat).forEach(c => {
      const o = document.createElement('option'); o.value = c.id; o.textContent = c.name || c.code; selCat.appendChild(o);
    });
    body.appendChild(labeled('Categoría destino', selCat));
    const selGrp = document.createElement('select'); selGrp.className = 'filter';
    function fillGroups(){
      selGrp.textContent = '';
      const none = document.createElement('option'); none.value = ''; none.textContent = 'Sin grupo (acomodar después)';
      selGrp.appendChild(none);
      islandsFor(Number(selCat.value)).forEach(g => {
        const o = document.createElement('option');
        o.value = g.key; o.textContent = 'Grupo ' + g.label;
        selGrp.appendChild(o);
      });
    }
    selCat.addEventListener('change', fillGroups);
    fillGroups();
    body.appendChild(labeled('Grupo destino (opcional)', selGrp));
    const reason = document.createElement('input');
    reason.className = 'filter'; reason.type = 'text'; reason.placeholder = 'Motivo del cambio (obligatorio)';
    body.appendChild(labeled('Motivo', reason));
    let polSel = null;
    if (r.has_played_matches){
      polSel = document.createElement('select'); polSel.className = 'filter';
      [['','Elige política para sus partidos jugados…'],
       ['KEEP_IN_OLD','Conservar en la clasificación anterior'],
       ['VOID_FOR_OLD_STANDINGS','Anular para clasificación (historial intacto)'],
       ['MANUAL_REVIEW','Pendiente de revisión manual']].forEach(([v, t]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = t; polSel.appendChild(o);
      });
      body.appendChild(labeled('Partidos jugados', polSel));
    }
    const act = el('div', 'mact');
    const ok = el('button', 'btn btn-main', 'Agregar al borrador'); ok.type = 'button';
    ok.addEventListener('click', () => {
      if (!selCat.value){ UI().toast('Elige categoría destino.', 'warn'); return; }
      if (!reason.value.trim()){ reason.style.borderColor = 'var(--red2)'; reason.focus(); return; }
      if (polSel && !polSel.value){ UI().toast('Elige la política de partidos jugados.', 'warn'); return; }
      const toEdcat = Number(selCat.value);
      const toGroup = selGrp.value === '' ? null
        : (/^\d+$/.test(selGrp.value) ? Number(selGrp.value) : selGrp.value);
      const meta = { transfer_reason: reason.value.trim() };
      if (polSel && polSel.value) meta.policy = polSel.value;
      C().moveTo(rid, toGroup, toEdcat, meta);
      closeModal();
      renderAll();
      UI().toast('Cambio de categoría agregado al borrador. Revísalo antes de guardar.', 'ok');
    });
    const cancel = el('button', 'btn btn-ghost', 'Cancelar'); cancel.type = 'button';
    cancel.addEventListener('click', closeModal);
    act.appendChild(cancel); act.appendChild(ok);
    body.appendChild(act);
    openModal('Cambiar de categoría — ' + (r.nickname_snapshot || ''), body);
  }
  function labeled(lbl, ctrl){
    const w = el('label', 'gb-field');
    w.appendChild(el('span', null, lbl));
    w.appendChild(ctrl);
    return w;
  }

  // ── standings autoritativos (get_group_standings; solo render) ──────
  async function showStandings(groupId, label){
    try {
      const rows = await C().standings(groupId);
      const body = el('div');
      if (!rows || !rows.length){ body.appendChild(el('p', 'gb-modal-sub', 'Sin datos todavía.')); }
      else {
        if (rows[0].is_asymmetric){
          body.appendChild(el('p', 'gb-warn-line', 'Tabla con asimetría administrativa: clasifica por porcentaje de victorias.'));
        }
        const t = document.createElement('table'); t.className = 'gb-table';
        t.innerHTML = '<thead><tr><th>#</th><th style="text-align:left">Jugador</th><th>PJ</th><th>G</th><th>P</th><th>Sets</th><th>%V</th></tr></thead>';
        const tb = document.createElement('tbody');
        rows.forEach((s, i) => {
          const tr = document.createElement('tr');
          [i + 1, s.nickname, s.matches_played, s.wins, s.losses,
           s.sets_won + '-' + s.sets_lost, Math.round((s.win_pct || 0) * 100) + '%'].forEach((v, j) => {
            const td = document.createElement('td');
            td.textContent = v;
            if (j === 1) td.style.textAlign = 'left';
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        body.appendChild(t);
      }
      openModal('Tabla — Grupo ' + label, body);
    } catch(e){
      UI().toast((e.message || 'No se pudo obtener la tabla.'), 'warn');
    }
  }

  // ── barra inferior de borrador ───────────────────────────────────────
  function renderBar(){
    const bar = $('#gbBar');
    const n = C().changeCount();
    bar.style.display = n ? 'flex' : 'none';
    $('#gbBarMsg').textContent = n === 1 ? '● 1 cambio sin guardar' : '● ' + n + ' cambios sin guardar';
    $('#btnUndo').disabled = !st().undoStack.length;
  }

  // ── modal genérico ───────────────────────────────────────────────────
  let modalBg = null;
  function openModal(title, bodyNode, wide){
    closeModal();
    modalBg = el('div', 'modal-bg open');
    const m = el('div', 'hud modal gb-modal' + (wide ? ' wide' : ''));
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    const h = el('h2', null, title);
    m.appendChild(h);
    m.appendChild(bodyNode);
    modalBg.appendChild(m);
    modalBg.addEventListener('click', ev => { if (ev.target === modalBg) closeModal(); });
    document.addEventListener('keydown', escClose);
    document.body.appendChild(modalBg);
  }
  function escClose(ev){ if (ev.key === 'Escape') closeModal(); }
  function closeModal(){
    if (modalBg){ modalBg.remove(); modalBg = null; }
    document.removeEventListener('keydown', escClose);
  }

  // ── preview + modal de impacto + apply ───────────────────────────────
  async function reviewChanges(){
    if (!C().hasChanges()){ UI().toast('No hay cambios en el borrador.', 'warn'); return; }
    $('#btnReview').disabled = true;
    try {
      lastPreview = await C().preview();
      openImpactModal(lastPreview);
      const nErr = (lastPreview.blocking_errors || []).length;
      const nPend = (lastPreview.rematch_pairs_pending_decision || []).length;
      if (nErr) UI().toast('No se puede aplicar: ' + nErr + ' error' + (nErr === 1 ? '' : 'es') + ' bloqueante' + (nErr === 1 ? '' : 's') + '. Revisa el aviso rojo.', 'warn');
      else if (nPend) UI().toast('Faltan ' + nPend + ' decisión(es) de re-encuentro antes de aplicar.', 'warn');
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('GB-PRV', e);
      UI().toast('Error al previsualizar: ' + (e.message || ''), 'warn');
    } finally {
      $('#btnReview').disabled = false;
    }
  }

  function listSection(body, title, items, fmt){
    if (!items || !items.length) return;
    body.appendChild(el('h3', 'gb-sec', title + ' (' + items.length + ')'));
    const ul = el('ul', 'gb-ul');
    items.forEach(x => ul.appendChild(el('li', null, fmt(x))));
    body.appendChild(ul);
  }

  function openImpactModal(pv){
    const body = el('div');
    const errs = (pv.blocking_errors || []).slice();
    const pend = pv.rematch_pairs_pending_decision || [];
    // AVISO DE BLOQUEO — primero de todo, sin scroll: dice qué impide aplicar
    // y qué hacer. Los detalles siguen listados más abajo en su sección.
    if (errs.length || pend.length){
      const bk = el('div', 'gb-block');
      const h = el('div', 'gb-block-h');
      h.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 9v5"/><path d="M12 17.5h.01"/><path d="M10.3 3.9 2.4 18a1.9 1.9 0 0 0 1.7 2.9h15.8a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z"/></svg>';
      h.appendChild(el('span', null, 'No se puede aplicar todavía'));
      bk.appendChild(h);
      const ul = el('ul');
      errs.forEach(x => ul.appendChild(el('li', null, x)));
      pend.forEach(p => ul.appendChild(el('li', null, 'Re-encuentro sin decidir: ' + p.players + '.')));
      bk.appendChild(ul);
      bk.appendChild(el('p', null, errs.length
        ? 'Saca del grupo a quien no sea elegible, o corrige su inscripción y pago en Admin.html (pago CONFIRMED o WAIVED) y vuelve a previsualizar.'
        : 'Elige una opción para cada re-encuentro y actualiza la previsualización.'));
      body.appendChild(bk);
    }
    // resumen de captura por grupo (categoría activa, estado proyectado local)
    body.appendChild(el('h3', 'gb-sec', 'Resumen · ' + edcatName(activeEdcat)));
    const sumUl = el('ul', 'gb-ul');
    islandsFor(activeEdcat).forEach(g => {
      const n = membersOf(activeEdcat, g.key).length;
      sumUl.appendChild(el('li', null, 'Grupo ' + g.label + ': ' + n + ' integrante' + (n === 1 ? '' : 's') + (n > 4 ? ' — supera el máximo recomendado (solo advertencia)' : '')));
    });
    sumUl.appendChild(el('li', null, 'Sin grupo: ' + ungrouped(activeEdcat).length));
    body.appendChild(sumUl);
    const nick = rid => (st().rowById[rid] ? st().rowById[rid].nickname_snapshot : rid);
    const groupLabel = key => {
      if (key == null || key === '') return 'Sin grupo';
      const all = islandsFor(activeEdcat);
      const found = Object.keys(st().groupsByEdcat).flatMap(k => st().groupsByEdcat[k]).find(g => String(g.id) === String(key));
      const t = st().newGroups.find(g => g.temp_id === String(key));
      return found ? 'Grupo ' + (st().renamed[found.id] || found.label) : t ? 'Grupo ' + t.label + ' (nuevo)' : String(all && key);
    };

    listSection(body, 'Movimientos', pv.moves, m =>
      (m.nickname || nick(m.registration_id)) + ': ' + groupLabel(m.from_group_id) + ' → ' + groupLabel(m.to_group));
    listSection(body, 'Cambios de categoría', pv.category_transfers, t =>
      (t.nickname || nick(t.registration_id)) + ': ' + edcatName(t.from_edcat) + ' → ' + edcatName(t.to_edcat) +
      (t.policy ? ' · política: ' + t.policy : ''));
    listSection(body, 'Partidos jugados que se conservan', pv.played_matches_preserved, x =>
      'Partido ' + String(x.match_id).slice(0, 8) + '… · política: ' + (x.policy || 'KEEP_IN_OLD'));
    listSection(body, 'Partidos pendientes que se cancelarán', pv.pending_matches_to_cancel, x =>
      'Partido ' + String(x.match_id).slice(0, 8) + '… (grupo ' + x.group_id + ')');
    listSection(body, 'Partidos nuevos que se crearán', pv.matches_to_create, x =>
      x.players + ' · mejor de ' + (x.best_of || 3) + (x.rematch ? ' · revancha' : ''));
    listSection(body, 'Tamaños proyectados', pv.projected_group_sizes, x =>
      groupLabel(x.group) + ': ' + x.size + ' integrantes');
    listSection(body, 'Advertencias', pv.warnings, x => x);
    listSection(body, 'Errores bloqueantes', pv.blocking_errors, x => x);

    // re-encuentros pendientes de decisión
    const decisionSelects = [];
    if (pend.length){
      body.appendChild(el('h3', 'gb-sec', 'Re-encuentros: decide qué pasa con cada par (' + pend.length + ')'));
      pend.forEach(p => {
        const row = el('div', 'gb-rematch');
        row.appendChild(el('span', null, p.players + ' — ya se enfrentaron; marcador registrado.'));
        const sel = document.createElement('select'); sel.className = 'filter';
        [['','Elige…'],
         ['COUNT_PREVIOUS_IN_NEW','Contar el resultado anterior en el grupo nuevo'],
         ['DONT_COUNT_NO_REMATCH','No contarlo y no repetir el partido'],
         ['SCHEDULE_REMATCH','Programar un nuevo enfrentamiento'],
         ['MANUAL_REVIEW','Dejar pendiente para decisión manual']].forEach(([v, t]) => {
          const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
        });
        decisionSelects.push({ p, sel });
        row.appendChild(sel);
        body.appendChild(row);
      });
      const upd = el('button', 'btn btn-ghost', 'Actualizar previsualización con estas decisiones');
      upd.type = 'button';
      upd.addEventListener('click', async () => {
        const byRid = {};
        for (const d of decisionSelects){
          if (!d.sel.value){ UI().toast('Falta decidir un re-encuentro.', 'warn'); return; }
          (byRid[d.p.registration_id] = byRid[d.p.registration_id] || []).push({
            match_id: d.p.match_id,
            opponent_registration_id: d.p.opponent_registration_id,
            decision: d.sel.value
          });
        }
        Object.keys(byRid).forEach(rid => {
          const prev = (st().meta[rid] && st().meta[rid].rematch_decisions) || [];
          const merged = prev.filter(x => !byRid[rid].some(y => y.match_id === x.match_id));
          C().setRematchDecisions(rid, merged.concat(byRid[rid]));
        });
        closeModal();
        await reviewChanges();
      });
      body.appendChild(upd);
    }

    // motivo global + acciones
    body.appendChild(el('h3', 'gb-sec', 'Motivo global (obligatorio)'));
    const reason = document.createElement('input');
    reason.className = 'filter'; reason.type = 'text'; reason.style.width = '100%';
    reason.placeholder = 'Motivo del lote de cambios';
    body.appendChild(reason);

    const act = el('div', 'mact');
    const back = el('button', 'btn btn-ghost', 'Volver a editar'); back.type = 'button';
    back.addEventListener('click', closeModal);
    const cancel = el('button', 'btn btn-ghost', 'Cancelar'); cancel.type = 'button';
    cancel.addEventListener('click', closeModal);
    const ok = el('button', 'btn btn-main', 'Confirmar y aplicar'); ok.type = 'button';
    const blocked = errs.length || pend.length;
    ok.disabled = !!blocked;
    if (blocked){
      ok.title = 'Resuelve los errores bloqueantes o decisiones pendientes.';
      body.appendChild(el('p', 'gb-block-why', errs.length
        ? (errs.length === 1 ? 'Hay 1 error bloqueante sin resolver (arriba).' : 'Hay ' + errs.length + ' errores bloqueantes sin resolver (arriba).')
        : 'Hay ' + pend.length + ' re-encuentro(s) sin decidir.'));
    }
    ok.addEventListener('click', async () => {
      if (!reason.value.trim()){ reason.style.borderColor = 'var(--red2)'; reason.focus(); return; }
      ok.disabled = true; ok.textContent = 'Aplicando…';
      try {
        const result = await C().apply(reason.value.trim());
        closeModal();
        UI().toast('Cambios aplicados. Partidos creados: ' + (result.matches_created || 0) +
          ' · cancelados: ' + (result.matches_cancelled || 0), 'ok');
        await C().load();
        renderAll();
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('GB-APL', e);
        ok.disabled = false; ok.textContent = 'Confirmar y aplicar';
        const msg = e.message || '';
        if (/previsualiza/i.test(msg)){
          C().discardPendingApply();
          UI().toast('Los datos cambiaron. Vuelve a previsualizar.', 'warn');
          closeModal();
          await C().load();
          renderAll();
        } else {
          UI().toast('Error al aplicar: ' + msg + ' — puedes reintentar (mismo lote).', 'warn');
        }
      }
    });
    act.appendChild(cancel); act.appendChild(back); act.appendChild(ok);
    body.appendChild(act);
    openModal('Revisar y guardar cambios', body, true);
  }

  // ── eventos globales ─────────────────────────────────────────────────
  function wire(){
    $('#gbSearch').addEventListener('input', ev => { query = ev.target.value.trim(); renderBoard(); });
    $('#gbFilter').addEventListener('change', ev => { filterState = ev.target.value; renderBoard(); });
    $('#btnUndo').addEventListener('click', () => { if (C().undo()) renderAll(); });
    $('#btnRestore').addEventListener('click', async () => {
      const okGo = await UI().confirmModal('Restaurar distribución original',
        'Se descartan todos los cambios del borrador. Nada se ha guardado en el servidor.', 'Restaurar');
      if (!okGo) return;
      C().resetDraft(); C().discardPendingApply(); renderAll();
    });
    $('#btnReview').addEventListener('click', reviewChanges);
    $('#btnReloadBoard').addEventListener('click', async () => {
      if (C().hasChanges()){
        const okGo = await UI().confirmModal('Recargar', 'Hay cambios sin guardar; recargar puede descartarlos si el estado del servidor cambió.', 'Recargar');
        if (!okGo) return;
      }
      $('#bootState').style.display = 'block';
      await C().load(); renderAll();
      $('#bootState').style.display = 'none';
      UI().toast('Tablero actualizado.', 'ok');
    });
    window.addEventListener('beforeunload', ev => {
      if (C().hasChanges()){ ev.preventDefault(); ev.returnValue = ''; }
    });
    const lg = $('#btnLogout');
    if (lg) lg.addEventListener('click', () => window.SB_AUTH.signOut());
    const dl = $('#btnDeniedLogout');
    if (dl) dl.addEventListener('click', () => window.SB_AUTH.signOut());
  }

  document.addEventListener('DOMContentLoaded', () => { wire(); wireExtract(); boot(); });
})();
