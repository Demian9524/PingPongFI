// ── Configuración de clasificación por categoría (TableroGrupos) ─────────
// Editor de "zonas de clasificación" + mejores terceros por edition_category_id.
// Guarda vía rpc admin_update_qualification_config (SQL propuesto:
// sql/PROPUESTA_qualification_config.sql). Lee vía get_public_qualification_config.
// SOLO visualización: no crea partidos ni toca grupos/standings/bracket.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const CAT_LABEL = { PRINCIPIANTE: 'Principiante', INTERMEDIO: 'Intermedio', AVANZADO_OPEN: 'Avanzado / Open' };
  const RULE_LABEL = { POINTS: 'Puntos', SET_DIFFERENCE: 'Diferencia de sets', SETS_WON: 'Sets ganados' };
  const S = { edcats: [], current: null, cfg: null, saved: null, groups: {}, standings: {}, previewGroup: {} };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function isDirty(){ return JSON.stringify(S.cfg) !== JSON.stringify(S.saved); }

  // ── validación (espejo del validador SQL) ────────────────────────────
  function validate(cfg){
    const errs = [];
    const bands = cfg.bands || [];
    if (!bands.length) errs.push('Debe existir al menos una zona.');
    const ids = new Set();
    bands.forEach((b, i) => {
      const tag = 'Zona ' + (i + 1) + (b.label ? ' («' + b.label + '»)' : '');
      if (!b.id || ids.has(b.id)) errs.push(tag + ': id vacío o duplicado.');
      ids.add(b.id);
      if (!String(b.label || '').trim()) errs.push(tag + ': el texto no puede estar vacío.');
      if (!/^#[0-9A-Fa-f]{6}$/.test(b.color || '') && !window.SB_QUALCONFIG.isToken(b.color))
        errs.push(tag + ': color inválido (hex #RRGGBB o token de categoría @bombo1 · @bombo2 · @bombo3 · @fuera).');
      if (!Number.isInteger(b.positionFrom) || b.positionFrom < 1) errs.push(tag + ': «Desde» debe ser entero ≥ 1.');
      if (b.positionTo != null && (!Number.isInteger(b.positionTo) || b.positionTo < b.positionFrom)) errs.push(tag + ': «Hasta» debe ser ≥ «Desde» o "hasta la última".');
    });
    const act = bands.filter(b => b.enabled !== false);
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++){
      const a = act[i], b = act[j];
      if ((a.positionTo == null || b.positionFrom <= a.positionTo) && (b.positionTo == null || a.positionFrom <= b.positionTo))
        errs.push('Zonas activas superpuestas: «' + a.label + '» y «' + b.label + '».');
    }
    const bt = cfg.bestThirds;
    if (bt && bt.enabled){
      if (!Number.isInteger(bt.sourcePosition) || bt.sourcePosition < 1) errs.push('Terceros: la posición debe ser ≥ 1.');
    }
    return errs;
  }

  // ── datos ─────────────────────────────────────────────────────────────
  async function loadCategory(edcatId){
    S.current = Number(edcatId);
    edcatId = S.current;
    updateEditingIndicator();
    let cfg = null;
    try {
      const { data, error } = await window.SB.rpc('get_public_qualification_config', { p_edcat: edcatId });
      if (!error && data && Array.isArray(data.bands)) cfg = data;
    } catch(e){}
    S.cfg = cfg ? window.SB_QUALCONFIG.normalize(cfg) : window.SB_QUALCONFIG.clone(window.SB_QUALCONFIG.DEFAULT);
    S.saved = clone(S.cfg);
    if (!S.groups[edcatId]){
      try {
        const { data } = await window.SB.from('v_public_groups_results')
          .select('group_id, group_label').eq('edition_category_id', edcatId);
        const seen = new Set(); const gs = [];
        (data || []).forEach(r => { if (r.group_id && !seen.has(r.group_id)){ seen.add(r.group_id); gs.push({ id: r.group_id, label: r.group_label }); } });
        gs.sort((a, b) => String(a.label).localeCompare(String(b.label)));
        S.groups[edcatId] = gs;
      } catch(e){ S.groups[edcatId] = []; }
    }
    // tamaño efectivo de cada grupo: lo necesita el sistema 5–4–3 para saber
    // cuántas plazas de tercero abre el formato de esta categoría.
    try { await Promise.all((S.groups[edcatId] || []).map(g => standingsFor(g.id))); } catch(e){}
    renderAll();
  }

  async function standingsFor(groupId){
    if (S.standings[groupId]) return S.standings[groupId];
    try {
      const { data, error } = await window.SB.rpc('get_group_standings', { p_group_id: groupId });
      if (error) throw error;
      S.standings[groupId] = data || [];
    } catch(e){ S.standings[groupId] = []; }
    return S.standings[groupId];
  }

  function catLabel(id){
    const c = S.edcats.find(x => Number(x.id) === Number(id));
    return c ? (CAT_LABEL[c.code] || c.code) : '¿?';
  }
  function updateEditingIndicator(){
    const ind = $('#qcEditing');
    if (ind) ind.innerHTML = 'EDITANDO REGLAS DE: <b>' + esc(catLabel(S.current).toUpperCase()) + '</b>';
    const save = $('#qcSave');
    if (save) save.textContent = 'Guardar y publicar · ' + catLabel(S.current);
  }

  // modal propio de cambios sin guardar (sin confirm() nativo)
  function askDiscard(){
    return new Promise(resolve => {
      const ov = el('div', 'qc-overlay');
      const box = el('div', 'qc-modal hud');
      box.innerHTML = '<h3>Cambios sin guardar</h3>' +
        '<p style="margin:0;font-size:13px;line-height:1.6">Hay cambios sin guardar en <b>' + esc(catLabel(S.current)) + '</b>. ¿Deseas descartarlos y cambiar de categoría?</p>' +
        '<div class="qc-zrow" style="justify-content:flex-end">' +
        '<button type="button" class="btn btn-ghost" id="qcDStay">Permanecer aquí</button>' +
        '<button type="button" class="btn btn-main" id="qcDDrop">Descartar y cambiar</button></div>';
      ov.appendChild(box); document.body.appendChild(ov);
      box.querySelector('#qcDStay').onclick = () => { ov.remove(); resolve(false); };
      box.querySelector('#qcDDrop').onclick = () => { ov.remove(); resolve(true); };
    });
  }

  // cambio de categoría unificado (desde qcTabs o desde el tablero superior)
  async function switchCategory(nextId, opts){
    nextId = Number(nextId);
    if (!nextId || nextId === Number(S.current)) return;
    if (isDirty()){
      const drop = await askDiscard();
      if (!drop){
        // regresar el tablero superior a la categoría en edición
        if (opts && opts.fromBoard && window.GROUP_BOARD && window.GROUP_BOARD.selectEditionCategory)
          window.GROUP_BOARD.selectEditionCategory(S.current, { silentQualificationSync: true });
        return;
      }
    }
    if (!(opts && opts.fromBoard) && window.GROUP_BOARD && window.GROUP_BOARD.selectEditionCategory)
      window.GROUP_BOARD.selectEditionCategory(nextId, { source: 'qualification-editor' });
    await loadCategory(nextId);
  }

  // ── render: tabs ──────────────────────────────────────────────────────
  function renderTabs(){
    const host = $('#qcTabs'); host.innerHTML = '';
    S.edcats.forEach(c => {
      const b = el('button', 'qc-tab' + (Number(c.id) === Number(S.current) ? ' on' : ''), CAT_LABEL[c.code] || c.code);
      b.type = 'button';
      b.onclick = () => { switchCategory(c.id); };
      host.appendChild(b);
    });
  }

  // ── render: zonas ─────────────────────────────────────────────────────
  function bandCard(b, i){
    const n = S.cfg.bands.length;
    const card = el('div', 'qc-zone');
    card.innerHTML =
      '<div class="qc-zrow">' +
        '<input type="color" class="qc-color" value="' + esc(window.SB_QUALCONFIG.swatchHex(b.color)) + '" aria-label="Color de zona">' +
        '<input type="text" class="qc-hex filter" value="' + esc(b.color || '') + '" maxlength="9" style="width:104px" aria-label="Color" title="Hex #RRGGBB o token que sigue el color de la categoría: @bombo1, @bombo2, @bombo3, @fuera">' +
        '<input type="text" class="qc-label filter" value="' + esc(b.label || '') + '" placeholder="Texto de la zona" style="flex:1;min-width:140px" aria-label="Texto">' +
      '</div>' +
      '<div class="qc-zrow">' +
        '<label class="qc-fl">Desde <input type="number" class="qc-from filter" min="1" value="' + esc(b.positionFrom) + '" style="width:70px"></label>' +
        '<label class="qc-fl">Hasta <input type="number" class="qc-to filter" min="1" value="' + (b.positionTo == null ? '' : esc(b.positionTo)) + '" style="width:70px"' + (b.positionTo == null ? ' disabled' : '') + '></label>' +
        '<label class="qc-ck"><input type="checkbox" class="qc-last"' + (b.positionTo == null ? ' checked' : '') + '> Hasta la última posición</label>' +
        '<label class="qc-ck"><input type="checkbox" class="qc-leg"' + (b.showInLegend !== false ? ' checked' : '') + '> Mostrar en leyenda</label>' +
        '<label class="qc-ck"><input type="checkbox" class="qc-en"' + (b.enabled !== false ? ' checked' : '') + '> Activa</label>' +
        '<span style="flex:1"></span>' +
        '<button type="button" class="btn btn-ghost qc-up"' + (i === 0 ? ' disabled' : '') + '>▲ Subir</button>' +
        '<button type="button" class="btn btn-ghost qc-down"' + (i === n - 1 ? ' disabled' : '') + '>▼ Bajar</button>' +
        '<button type="button" class="btn btn-ghost qc-del" style="color:var(--err,#e46)">Eliminar</button>' +
      '</div>';
    const sync = () => { refreshMeta(); };
    const colorIn = card.querySelector('.qc-color'), hexIn = card.querySelector('.qc-hex');
    colorIn.addEventListener('input', () => { b.color = colorIn.value.toUpperCase(); hexIn.value = b.color; sync(); });
    hexIn.addEventListener('change', () => { b.color = hexIn.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(b.color)) colorIn.value = b.color; sync(); });
    card.querySelector('.qc-label').addEventListener('input', e => { b.label = e.target.value; sync(); });
    card.querySelector('.qc-from').addEventListener('change', e => { b.positionFrom = parseInt(e.target.value, 10); sync(); });
    const toIn = card.querySelector('.qc-to');
    toIn.addEventListener('change', () => { b.positionTo = toIn.value === '' ? null : parseInt(toIn.value, 10); sync(); });
    card.querySelector('.qc-last').addEventListener('change', e => {
      if (e.target.checked){ b.positionTo = null; toIn.value = ''; toIn.disabled = true; }
      else { b.positionTo = b.positionFrom; toIn.value = b.positionFrom; toIn.disabled = false; }
      sync();
    });
    card.querySelector('.qc-leg').addEventListener('change', e => { b.showInLegend = e.target.checked; sync(); });
    card.querySelector('.qc-en').addEventListener('change', e => { b.enabled = e.target.checked; sync(); });
    card.querySelector('.qc-up').onclick = () => { S.cfg.bands.splice(i, 1); S.cfg.bands.splice(i - 1, 0, b); renderZones(); refreshMeta(); };
    card.querySelector('.qc-down').onclick = () => { S.cfg.bands.splice(i, 1); S.cfg.bands.splice(i + 1, 0, b); renderZones(); refreshMeta(); };
    card.querySelector('.qc-del').onclick = () => { S.cfg.bands.splice(i, 1); renderZones(); refreshMeta(); };
    return card;
  }

  function renderZones(){
    const host = $('#qcZones'); host.innerHTML = '';
    S.cfg.bands.forEach((b, i) => host.appendChild(bandCard(b, i)));
  }

  // ── render: mejores terceros ──────────────────────────────────────────
  // ── render: terceros (sistema 5–4–3) ──────────────────────────────
  // Las plazas de tercero y el orden de comparación NO son configurables: los
  // determina el reglamento (supabase/format-engine.js) a partir del número de
  // grupos y del tamaño efectivo de cada uno. Aquí solo se edita el texto.
  function effSizes(edcatId){
    return (S.groups[edcatId] || []).map(g => (S.standings[g.id] || []).length || 4);
  }
  function derivedThirds(edcatId){
    const F = window.FI_FORMAT;
    const gs = S.groups[edcatId] || [];
    if (!F || gs.length < 2) return null;
    const sizes = effSizes(edcatId);
    const p = F.planFor(gs.length, sizes);
    if (!p.primary) return null;
    return { groups: gs.length, sizes: sizes, slots: p.primary.thirdsSlots,
      title: p.primary.title, tag: p.primary.tag, levels: F.thirdLevels(sizes),
      plan: F.thirdsPlan(p.primary.thirdsSlots, F.thirdLevels(sizes)) };
  }

  function renderThirdsEditor(){
    const host = $('#qcThirds'); host.innerHTML = '';
    const bt = S.cfg.bestThirds = S.cfg.bestThirds || clone(window.SB_QUALCONFIG.DEFAULT.bestThirds);
    const d = derivedThirds(S.current);
    if (d) bt.qualifyingSlots = d.slots;   // el reglamento manda; se guarda para el backend
    bt.sourcePosition = 3;
    const head = el('label', 'qc-ck qc-switch');
    head.innerHTML = '<input type="checkbox"' + (bt.enabled ? ' checked' : '') + '> <b>Mostrar tabla pública de terceros (sistema 5–4–3)</b>';
    head.querySelector('input').addEventListener('change', e => { bt.enabled = e.target.checked; renderThirdsEditor(); refreshMeta(); });
    host.appendChild(head);
    if (!bt.enabled){
      host.appendChild(el('p', 'metaline', 'La tabla pública se oculta por completo. La zona de la posición 3 conserva el color y texto configurados arriba.'));
      return;
    }
    const info = el('div', 'qc-derived');
    info.innerHTML = d
      ? '<b>Lo decide el reglamento, no esta pantalla.</b> Con <b>' + d.groups + ' grupos</b> de tamaño efectivo ' +
        d.sizes.join('–') + ' el formato es <b>' + esc(d.title) + '</b> y abre <b>' + d.slots + ' plaza' + (d.slots === 1 ? '' : 's') +
        ' de tercero</b>. Se cubren por nivel: A (grupos de 5) ' + d.plan.fromA + '/' + d.levels.A +
        ' · B (grupos de 4) ' + d.plan.fromB + '/' + d.levels.B +
        ' · C (grupos de 3, reserva) ' + d.plan.fromC + '/' + d.levels.C + '.'
      : '<b>Sin grupos publicados suficientes.</b> Las plazas de tercero se calculan cuando la categoría tenga al menos 2 grupos.';
    host.appendChild(info);
    const grid = el('div', 'qc-btgrid');
    const fields = [
      ['Título', 'title', 'text'],
      ['Subtítulo', 'subtitle', 'text'],
      ['Texto clasificado', 'qualifiedLabel', 'text'],
      ['Texto no clasificado', 'eliminatedLabel', 'text']
    ];
    fields.forEach(([lab, key, type]) => {
      const w = el('label', 'qc-fl qc-flcol');
      w.innerHTML = lab + ' <input class="filter" type="' + type + '" value="' + esc(bt[key] == null ? '' : bt[key]) + '">';
      w.querySelector('input').addEventListener('change', e => { bt[key] = e.target.value; refreshMeta(); });
      grid.appendChild(w);
    });
    host.appendChild(grid);
    const rl = el('div', 'qc-rules');
    rl.appendChild(el('span', 'metaline', 'Orden de comparación (fijo por reglamento, solo entre terceros del mismo nivel):'));
    ['Partidos ganados','Diferencia de sets','% de sets ganados'].forEach((r, i) => {
      rl.appendChild(el('span', 'qc-rule', (i + 1) + '. ' + r));
    });
    host.appendChild(rl);
    host.appendChild(el('p', 'metaline', 'No hay criterios de puntos: la base guarda sets, no puntos por set. ' +
      'Un tercero de grupo de 3 nunca desplaza a uno de grupo de 4 o 5, y las tablas no mezclan niveles.'));
  }

  // ── render: errores + vista previa + barra ────────────────────────────
  function refreshMeta(){
    const errs = validate(S.cfg);
    const eh = $('#qcErrors');
    eh.innerHTML = errs.length ? '<b>Corrige antes de guardar:</b><ul>' + errs.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '';
    eh.style.display = errs.length ? '' : 'none';
    $('#qcSave').disabled = errs.length > 0 || !isDirty();
    $('#qcCancel').disabled = !isDirty();
    $('#qcDirty').style.display = isDirty() ? '' : 'none';
    renderPreview();
  }

  async function renderPreview(){
    const host = $('#qcPreview');
    const groups = S.groups[S.current] || [];
    if (!groups.length){ host.innerHTML = '<p class="metaline">Aún no hay grupos publicados en esta categoría para previsualizar.</p>'; return; }
    const gid = S.previewGroup[S.current] || groups[0].id;
    S.previewGroup[S.current] = gid;
    let html = '<div class="qc-zrow"><span class="metaline">Grupo real:</span><select class="filter" id="qcPrevGroup">' +
      groups.map(g => '<option value="' + g.id + '"' + (g.id === gid ? ' selected' : '') + '>Grupo ' + esc(g.label) + '</option>').join('') + '</select></div>';
    const rows = await standingsFor(gid);
    if (!rows.length){
      html += '<p class="metaline">Grupo sin standings publicados.</p>';
    } else {
      html += '<div class="qc-prevtable">' + rows.map((r, i) => {
        const z = window.SB_QUALCONFIG.bandFor(S.cfg, i + 1);
        const bg = z ? window.SB_QUALCONFIG.softBg(window.SB_QUALCONFIG.bgOf(z), z.bgPct) : 'transparent';
        const acc = z ? window.SB_QUALCONFIG.resolve(z.color) : 'transparent';
        return '<div class="qc-prow" style="background:' + bg + '"><span class="qc-pacc" style="background:' + acc + '"></span>' +
          '<span class="qc-ppos">#' + (i + 1) + '</span><span class="qc-pname">' + esc(r.nickname) + '</span>' +
          '<span class="qc-pzone">' + esc(z ? z.label : 'Sin zona (neutral)') + '</span></div>';
      }).join('') + '</div>';
    }
    const legend = window.SB_QUALCONFIG.legendBands(S.cfg);
    html += '<div class="qc-prevleg">' + legend.map(b =>
      '<span class="qc-lg"><span class="qc-sw" style="background:' + esc(window.SB_QUALCONFIG.resolve(b.color)) + '"></span>' + esc(b.label) + '</span>').join('') + '</div>';
    host.innerHTML = html;
    $('#qcPrevGroup').onchange = e => { S.previewGroup[S.current] = parseInt(e.target.value, 10); renderPreview(); };
  }

  function renderAll(){ renderTabs(); renderZones(); renderThirdsEditor(); refreshMeta(); }

  // ── guardado ──────────────────────────────────────────────────────────
  function summaryLines(){
    const lines = ['Categoría: ' + catLabel(S.current)];
    window.SB_QUALCONFIG.activeBands(S.cfg).forEach(b => {
      const rng = b.positionTo == null ? 'Posiciones ' + b.positionFrom + ' en adelante'
        : b.positionFrom === b.positionTo ? 'Posición ' + b.positionFrom
        : 'Posiciones ' + b.positionFrom + '–' + b.positionTo;
      lines.push(rng + ': ' + b.label);
    });
    const bt = S.cfg.bestThirds || {};
    lines.push('Tabla de terceros: ' + (bt.enabled ? 'ACTIVADA' : 'DESACTIVADA'));
    if (bt.enabled) lines.push('Sistema 5–4–3 · plazas según formato: ' + (bt.qualifyingSlots == null ? '—' : bt.qualifyingSlots));
    return lines;
  }

  function openSaveModal(){
    const ov = el('div', 'qc-overlay');
    const box = el('div', 'qc-modal hud');
    box.innerHTML = '<h3>Guardar y publicar</h3>' +
      '<ul class="qc-summary">' + summaryLines().map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
      '<label class="qc-fl qc-flcol" style="width:100%">Motivo (obligatorio) <textarea class="filter" id="qcReason" rows="2" style="width:100%"></textarea></label>' +
      '<p class="metaline" id="qcModalMsg" aria-live="polite"></p>' +
      '<div class="qc-zrow" style="justify-content:flex-end">' +
      '<button type="button" class="btn btn-ghost" id="qcMCancel">Cancelar</button>' +
      '<button type="button" class="btn btn-main" id="qcMSave">Publicar</button></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    box.querySelector('#qcMCancel').onclick = () => ov.remove();
    box.querySelector('#qcMSave').onclick = async () => {
      const reason = box.querySelector('#qcReason').value.trim();
      const msg = box.querySelector('#qcModalMsg');
      if (!reason){ msg.textContent = 'El motivo es obligatorio.'; return; }
      // protección: la categoría debe existir y coincidir con el tablero superior
      const currentCategory = S.edcats.find(c => Number(c.id) === Number(S.current));
      if (!currentCategory){ msg.textContent = 'Categoría inválida: recarga la página.'; return; }
      const boardId = window.GROUP_BOARD && window.GROUP_BOARD.getActiveEditionCategoryId
        ? window.GROUP_BOARD.getActiveEditionCategoryId() : null;
      if (boardId != null && Number(boardId) !== Number(S.current)){
        msg.textContent = 'La categoría del tablero cambió. Revisa qué categoría estás editando antes de publicar.';
        return;
      }
      msg.textContent = 'Guardando…';
      // displayOrder canónico = orden del arreglo
      S.cfg.bands.forEach((b, i) => { b.displayOrder = i + 1; b.displayStyle = b.displayStyle || 'ROW'; });
      S.cfg.version = 1;
      try {
        const { data, error } = await window.SB.rpc('admin_update_qualification_config',
          { p_edcat: Number(S.current), p_config: S.cfg, p_reason: reason });
        if (error) throw error;
        if (!data || data.ok !== true){ msg.textContent = 'Rechazado: ' + ((data && data.message) || 'error desconocido'); return; }
        window.SB_QUALCONFIG.invalidate(S.current);
        ov.remove();
        await loadCategory(S.current);  // re-consulta Supabase y repinta
      } catch(e){
        const t = String((e && e.message) || e);
        msg.textContent = /function|schema cache|42883/i.test(t)
          ? 'Función no disponible: ejecuta sql/PROPUESTA_qualification_config.sql en Supabase.'
          : 'Error: ' + t;
      }
    };
  }

  // ── init ──────────────────────────────────────────────────────────────
  async function boot(){
    try {
      const edition = await window.SB_CATALOG.getActiveEdition();
      const edcats = await window.SB_CATALOG.getEditionCategories(edition.id);
      S.edcats = edcats.filter(c => CAT_LABEL[c.code]);
      if (!S.edcats.length) return;
      $('#qcSection').style.display = '';
      $('#qcAdd').onclick = () => {
        const maxTo = Math.max(0, ...S.cfg.bands.map(b => b.positionTo == null ? b.positionFrom : b.positionTo));
        S.cfg.bands.push({ id: 'zona-' + Date.now().toString(36), enabled: true, label: 'NUEVA ZONA',
          color: '#888888', positionFrom: maxTo + 1, positionTo: maxTo + 1, showInLegend: true, displayStyle: 'ROW' });
        renderZones(); refreshMeta();
      };
      $('#qcCancel').onclick = () => { S.cfg = clone(S.saved); renderAll(); };
      $('#qcDefaults').onclick = () => { S.cfg = window.SB_QUALCONFIG.clone(window.SB_QUALCONFIG.DEFAULT); renderAll(); };
      $('#qcSave').onclick = () => { if (!validate(S.cfg).length) openSaveModal(); };
      // sincronía con el tablero superior: arrancar en SU categoría activa
      const boardId = window.GROUP_BOARD && window.GROUP_BOARD.getActiveEditionCategoryId
        ? Number(window.GROUP_BOARD.getActiveEditionCategoryId()) : null;
      const initialId = S.edcats.some(c => Number(c.id) === boardId) ? boardId : Number(S.edcats[0].id);
      window.addEventListener('groupboard:categorychange', ev => {
        switchCategory(ev.detail && ev.detail.editionCategoryId, { fromBoard: true });
      });
      await loadCategory(initialId);
    } catch(e){ console.warn('[qual-admin] init falló:', e && e.message); }
  }

  // espera a que group-board muestre el tablero (sesión de staff válida)
  function waitBoard(){
    const bv = document.getElementById('boardView');
    if (bv && bv.style.display !== 'none'){ boot(); return; }
    setTimeout(waitBoard, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitBoard);
  else waitBoard();
})();
