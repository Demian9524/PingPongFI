// ── Editor visual de llaves · shell (bandeja, barra, inspector, validación) ─
// Trabaja SIEMPRE sobre el borrador en memoria de bracket-admin-ui.js (BA.S.cfg)
// y marca cambios con BA.markDirty(). Nunca escribe en public.matches.
// Las interacciones de puntero viven en bracket-canvas-interact.js.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const BA = () => window.BA;
  const CV = () => window.FI_BKT_CANVAS;
  const BKC = () => window.TORNEO_BKC;
  const CFG = window.SB_BRACKETCFG;
  const SEEDS = () => window.SB_BKT_SEEDS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const S = {
    seeds: [], seedFilter:'', seedPot:'', loading:false, source:'NONE',
    sel: new Set(), selEdges: new Set(), selBands: new Set(),
    undo:[], redo:[], view:{ k:1, x:24, y:16 }, mounted:false, lastVal:null, viewFor:null,
    full:false, min:false
  };

  const cfg = () => BA() && BA().S && BA().S.cfg;
  const edcat = () => BA() && BA().S && BA().S.edcatId;

  // ── aviso flotante ────────────────────────────────────────────────────
  let toastEl = null, toastT = null;
  function toast(msg, kind){
    if (!toastEl){ toastEl = document.createElement('div'); toastEl.className = 'bkc-toast'; }
    if (toastEl.parentNode !== topLayer()) topLayer().appendChild(toastEl);
    toastEl.className = 'bkc-toast show' + (kind ? ' ' + kind : '');
    toastEl.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.className = 'bkc-toast'; }, kind === 'err' ? 5200 : 3000);
  }

  // ── historial ─────────────────────────────────────────────────────────
  function snapshot(){
    const c = cfg();
    return JSON.stringify({ slots:c.slots, connections:c.connections, canvas:c.canvas,
      champion:c.champion, runnerUp:c.runnerUp, rounds:c.rounds });
  }
  function push(){
    if (!cfg()) return;
    S.undo.push(snapshot());
    if (S.undo.length > 80) S.undo.shift();
    S.redo.length = 0;
  }
  function restore(json){
    const c = cfg(), d = JSON.parse(json);
    c.slots = d.slots; c.connections = d.connections; c.canvas = d.canvas;
    c.champion = d.champion; c.runnerUp = d.runnerUp; c.rounds = d.rounds;
    S.sel.clear(); S.selEdges.clear(); S.selBands.clear();
  }
  function undo(){
    if (!S.undo.length) return toast('No hay nada que deshacer.');
    S.redo.push(snapshot());
    restore(S.undo.pop());
    commit();
  }
  function redo(){
    if (!S.redo.length) return toast('No hay nada que rehacer.');
    S.undo.push(snapshot());
    restore(S.redo.pop());
    commit();
  }
  // Repinta todo. Con noDirty=true no marca cambios locales (montaje inicial).
  function commit(noDirty){
    // los rótulos van anclados a su columna: antes de repintar se recolocan
    if (CV() && CV().reflowBands && cfg()) CV().reflowBands(cfg());
    paint();
    renderTray();
    renderBar();
    renderInspector();
    if (noDirty) return;
    S.lastVal = null;
    if (BA() && BA().markDirtyQuiet) BA().markDirtyQuiet();
  }

  // ── montaje ───────────────────────────────────────────────────────────
  function host(){ return $('#bkcStage'); }
  function mount(){
    const panel = $('#baCanvas');
    if (!panel) return;
    panel.hidden = false;
    if (!S.mounted){
      S.mounted = true;
      try { S.trayOff = localStorage.getItem('bkc.tray') === 'off'; } catch(err){}
      renderBar();
      applyTray();
      window.BKC_IX && window.BKC_IX.init({ view: $('#bkcView'), stageHost: host(), ed: api });
      const z = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
      z('bkcZoomIn', () => zoomTo(S.view.k * 1.2));
      z('bkcZoomOut', () => zoomTo(S.view.k / 1.2));
      z('bkcZoom100', () => zoomTo(1));
      z('bkcFit', fitAll);
      window.addEventListener('resize', () => BKC().drawLines(host().querySelector('.bkc-stage'), paintOpts()));
    }
    if (S.viewFor !== viewKey()){ loadView(); S.viewFor = viewKey(); }
    const converted = !CV().isFree(cfg());
    ensureCanvas();
    loadSeeds();
    commit(!converted);
    if (converted){
      fitAll();
      toast('La llave se abrió en el editor libre partiendo de la estructura del formato. Muévela a tu gusto y guarda el borrador.', 'ok');
    }
  }
  function unmount(){ const p = $('#baCanvas'); if (p) p.hidden = true; }

  // El borrador puede venir del formato automático: se convierte a lienzo
  // usando la estructura sugerida como punto de partida (editable después).
  function ensureCanvas(){
    const c = cfg();
    if (!c) return;
    if (!CV().isFree(c)){
      CV().ensure(c);
      CV().redrawDefault(c, { rebuildEdges:true });
      c.layoutKey = c.layout = CV().LAYOUT_KEY;
    }
    CV().ensure(c);
    // Restos de una estructura anterior (bloques traslúcidos): se barren
    // también en el lienzo libre, donde no se rehace el reparto automático.
    try {
      const p = CFG.buildPlan(c.format);
      if (p && CV().sweepGhosts) CV().sweepGhosts(c, new Set((p.slots || []).map(s => s.id)));
    } catch(e){}
  }

  function viewKey(){ return 'bkc-view:' + (edcat() || 'x'); }
  function loadView(){
    try {
      const v = JSON.parse(localStorage.getItem(viewKey()) || 'null');
      if (v && Number.isFinite(v.k)) S.view = { k: Math.min(2, Math.max(.25, v.k)), x: v.x || 0, y: v.y || 0 };
      else S.view = { k:.72, x:24, y:16 };
    } catch(e){ S.view = { k:.72, x:24, y:16 }; }
  }
  function saveView(){ try { localStorage.setItem(viewKey(), JSON.stringify(S.view)); } catch(e){} }

  function paintOpts(){
    return { editable:true, showPorts:true, catLabel: BA() ? BA().catLabel() : '',
      selectedNodes:S.sel, selectedEdges:S.selEdges,
      onEditSlot: id => window.BA_SLOT && window.BA_SLOT.openSlot(id) };
  }
  function paint(){
    const h = host();
    if (!h || !cfg()) return;
    BKC().render(h, cfg(), paintOpts());
    if (window.BKC_IX) window.BKC_IX.decorate();
    applyView();
    applySelection();
  }
  function applyView(){
    const st = host() && host().querySelector('.bkc-stage');
    if (!st) return;
    st.style.transform = 'translate(' + S.view.x + 'px,' + S.view.y + 'px) scale(' + S.view.k + ')';
    const z = $('#bkcZoomLbl');
    if (z) z.textContent = Math.round(S.view.k * 100) + '%';
  }
  function applySelection(){
    const st = host() && host().querySelector('.bkc-stage');
    if (!st) return;
    st.querySelectorAll('.bkc-node').forEach(n => n.classList.toggle('sel', S.sel.has(n.getAttribute('data-slot'))));
    st.querySelectorAll('.bkc-band').forEach(b => b.classList.toggle('sel', S.selBands.has(b.getAttribute('data-band'))));
    BKC().drawLines(st, paintOpts());
    renderInspector();
    renderBar();
  }

  // ── bandeja de participantes ──────────────────────────────────────────
  async function loadSeeds(force){
    if (!SEEDS() || !edcat()){ S.seeds = []; S.source = 'NONE'; renderTray(); return; }
    S.loading = true; renderTray();
    try {
      const r = await SEEDS().load(edcat(), { force: !!force });
      S.seeds = r.rows || [];
      S.source = r.source || 'NONE';
    } catch(e){ S.seeds = []; S.source = 'NONE'; }
    S.loading = false;
    renderTray();
  }
  function seedRows(){
    const q = S.seedFilter.toLowerCase();
    return S.seeds.filter(r =>
      (!S.seedPot || r.pot === S.seedPot) &&
      (!q || (r.name + ' ' + r.groupLabel + ' ' + r.origin).toLowerCase().indexOf(q) >= 0));
  }
  // La bandeja es un cajón del propio editor: en pantalla completa se puede
  // sembrar sin salir. El botón «Bandeja» la pliega y el estado se recuerda.
  function applyTray(){
    const w = document.querySelector('#baCanvas .bkc-wrap') || document.querySelector('.bkc-wrap');
    if (w) w.classList.toggle('tray-off', !!S.trayOff);
  }
  function renderTray(){
    const box = $('#bkcTray');
    if (!box || !cfg()) return;
    const placed = CV().placedMap(cfg());
    const rows = seedRows();
    const total = S.seeds.length;
    const done = S.seeds.filter(r => placed.has(r.rid)).length;
    const srcNote = { STANDINGS:'Posiciones oficiales de la fase de grupos',
      MEMBERS:'Sin tabla de posiciones todavía: se listan los inscritos de cada grupo',
      EMPTY:'Sin participantes publicados en esta categoría', NONE:'Sin conexión con la categoría' }[S.source] || '';
    box.innerHTML = `<div class="bkc-tray-h">
        <h4>Bandeja de clasificados</h4>
        <span class="k">Categoría <b>${esc(BA() ? BA().catLabel() : '')}</b></span>
        <span class="k">Disponibles <b>${total - done}</b></span>
        <span class="k">Colocados <b>${done}</b></span>
        <span class="k">de <b>${total}</b></span>
        <span class="grow"></span>
        <select id="bkcPot"><option value="">Todos los bombos</option><option value="1"${S.seedPot==='1'?' selected':''}>Bombo 1 · primeros</option><option value="2"${S.seedPot==='2'?' selected':''}>Bombo 2 · segundos</option><option value="3"${S.seedPot==='3'?' selected':''}>Bombo 3 · terceros</option></select>
        <input id="bkcFind" placeholder="Buscar nombre o grupo…" value="${esc(S.seedFilter)}">
        <button class="bkc-tool" id="bkcSeedReload">Actualizar</button>
      </div>
      <div class="bkc-rows" id="bkcRows">${
        S.loading ? '<div class="bkc-empty">Calculando bombos y clasificados…</div>'
        : !rows.length ? '<div class="bkc-empty">' + esc(total ? 'Ningún participante coincide con el filtro.' : srcNote) + '</div>'
        : rows.map(r => rowHTML(r, placed.get(r.rid))).join('')}</div>
      <div class="bkc-insp" style="border-top:1px solid var(--line)"><span class="bkc-count">${esc(srcNote)}${
        S.source === 'STANDINGS' ? ' · arrastra una fila hasta el espacio superior o inferior de un enfrentamiento' : ''}</span></div>`;
    $('#bkcFind').oninput = e => { S.seedFilter = e.target.value; renderRowsOnly(); };
    $('#bkcPot').onchange = e => { S.seedPot = e.target.value; renderTray(); };
    $('#bkcSeedReload').onclick = () => { SEEDS() && SEEDS().invalidate(edcat()); loadSeeds(true); };
    wireRows();
  }
  function renderRowsOnly(){
    const placed = CV().placedMap(cfg());
    const wrap = $('#bkcRows');
    if (!wrap) return;
    const rows = seedRows();
    wrap.innerHTML = rows.length ? rows.map(r => rowHTML(r, placed.get(r.rid))).join('')
      : '<div class="bkc-empty">Ningún participante coincide con el filtro.</div>';
    wireRows();
  }
  const CAT_SHORT = { PRINCIPIANTE:'PRI', INTERMEDIO:'INT', 'AVANZADO / OPEN':'AVA' };
  function rowHTML(r, at){
    const logo = (r.faculty && window.SB_LOGOS) ? window.SB_LOGOS.resolveForTable(r.faculty, r.career, r.name) : null;
    const src = logo ? logo.src : 'assets/escudo-fi.svg';
    const potCls = r.direct ? 'pd' : ('p' + r.pot);
    const potTxt = r.direct ? 'PD' : (r.pot === '?' ? '—' : 'B' + r.pot);
    const cat = BA() ? BA().catLabel() : '';
    const catTxt = CAT_SHORT[cat] || cat.slice(0, 3).toUpperCase();
    return `<div class="bkc-row${at ? ' placed' : ''}${S.pick === r.rid ? ' picked' : ''}" draggable="true" data-rid="${esc(r.rid)}" title="${esc(r.name + ' · ' + r.origin + (cat ? ' · ' + cat : '') + (r.direct ? ' · pase directo' : '') + (at ? ' · colocado en ' + at.label : ''))}">
      <img src="${esc(src)}" alt="" onerror="this.onerror=null;this.src='assets/escudo-fi.svg'">
      <span class="bkc-pot ${potCls}">${potTxt}</span>
      ${catTxt ? `<span class="bkc-cat" title="Categoría ${esc(cat)}">${esc(catTxt)}</span>` : ''}
      <span class="who"><b>${esc(r.name)}</b><small>${esc(r.origin)}${r.direct ? ' · pase directo' : ''}</small></span>
      <span class="st">${at ? esc(at.label) : 'Disponible'}</span></div>`;
  }
  // Tomar con un clic y sembrar con otro: el arrastre HTML5 no funciona con el
  // editor en pantalla completa, así que este camino siempre está disponible.
  function pickedSeed(){ return S.pick || ''; }
  function pickSeed(rid){
    S.pick = S.pick === rid ? '' : String(rid || '');
    renderRowsOnly();
    if (S.pick){
      const row = seedById(S.pick);
      toast((row ? '«' + row.name + '»' : 'Participante') + ' en la mano: haz clic en el espacio libre de un enfrentamiento.', 'ok');
    }
  }
  function placePicked(id, side){
    const c = cfg();
    const row = seedById(S.pick);
    if (!row){ S.pick = ''; renderRowsOnly(); return toast('Ese participante ya no está en la bandeja.', 'err'); }
    const err = CV().whyNotPlace(c, id, side);
    if (err) return toast(err, 'err');
    const already = CV().placedMap(c).get(String(row.rid));
    if (already && !(already.slotId === id && already.side === side))
      return toast('«' + row.name + '» ya está sembrado en «' + already.label + '». Muévelo desde ahí.', 'err');
    push();
    const r = CV().place(c, id, side, SEEDS().toParticipant(row, row.origin));
    if (r && r.error) return toast(r.error, 'err');
    S.pick = '';
    commit();
    toast('«' + row.name + '» sembrado en «' + CV().nodeLabel(c, id) + '» (espacio ' + side + ').', 'ok');
  }
  function wireRows(){
    document.querySelectorAll('#bkcRows .bkc-row').forEach(el => {
      el.addEventListener('click', ev => {
        if (ev.target.closest && ev.target.closest('.bkc-rm')) return;
        pickSeed(el.getAttribute('data-rid'));
      });
      el.addEventListener('dragstart', ev => {
        // getData() viene vacío durante dragover (modo protegido del navegador):
        // se guarda también en una variable para poder validar el destino.
        window.__bkcDrag = 'seed:' + el.dataset.rid;
        ev.dataTransfer.setData('text/plain', 'seed:' + el.dataset.rid);
        ev.dataTransfer.effectAllowed = 'copyMove';
        el.classList.add('drag');
      });
      el.addEventListener('dragend', () => { el.classList.remove('drag'); window.__bkcDrag = ''; });
      el.addEventListener('dblclick', () => {
        const at = CV().placedMap(cfg()).get(el.dataset.rid);
        if (at) focusNode(at.slotId);
        else toast('Arrastra la fila hasta uno de los dos espacios de un enfrentamiento.');
      });
    });
  }
  function seedById(rid){ return S.seeds.find(r => String(r.rid) === String(rid)) || null; }

  // ── barra de herramientas ─────────────────────────────────────────────
  const T = (id, label, title, extra) =>
    `<button class="bkc-tool${extra || ''}" id="${id}" type="button" title="${esc(title)}">${esc(label)}</button>`;
  function renderBar(){
    const bar = $('#bkcBar');
    if (!bar || !cfg()) return;
    const c = cfg();
    const st = CV().stats(c);
    const n = S.sel.size, e = S.selEdges.size, b = S.selBands.size;
    bar.innerHTML =
      T('bkcAdd','+ Enfrentamiento','Crear un nodo de enfrentamiento vacío') +
      T('bkcAddBye','+ Descanso','Crear un nodo BYE: un solo participante que avanza sin jugar') +
      T('bkcAddBand','+ Rótulo','Crear un rótulo del cuadro: encabezado de ronda o banda del sistema') +
      '<span class="sep"></span>' +
      T('bkcDel','Eliminar','Eliminar nodos y conexiones seleccionados (Supr)','' + (n || e ? ' danger' : '')) +
      T('bkcFlip','Voltear','Cambiar el lado por el que sale el ganador') +
      T('bkcFront','Al frente','Traer al frente') +
      T('bkcBack','Al fondo','Enviar al fondo') +
      '<span class="sep"></span>' +
      T('bkcAlL','⇤','Alinear a la izquierda') + T('bkcAlCx','↔','Centrar horizontalmente') + T('bkcAlR','⇥','Alinear a la derecha') +
      T('bkcAlT','⇡','Alinear arriba') + T('bkcAlCy','↕','Centrar verticalmente') + T('bkcAlB','⇣','Alinear abajo') +
      T('bkcDistV','≡','Repartir el espacio vertical por igual') +
      T('bkcDistH','⦀','Repartir el espacio horizontal por igual') +
      '<span class="sep"></span>' +
      T('bkcGrid','Cuadrícula','Mostrar u ocultar la cuadrícula', c.canvas.grid.on ? ' on' : '') +
      T('bkcSnap','Ajuste','Ajustar posiciones a la cuadrícula', c.canvas.snap ? ' on' : '') +
      T('bkcGuides','Guías','Guías inteligentes al mover: alineación con otros nodos, separaciones iguales y simetría, con ajuste magnético. Mantén Alt durante el arrastre para moverlo libre', c.canvas.guides !== false ? ' on' : '') +
      T('bkcLock','Centro fijo','El bloque de campeón, el trofeo, el subcampeón y la gran final quedan en la misma posición en todas las categorías', CV().centerLocked(c) ? ' on' : '') +
      '<span class="sep"></span>' +
      T('bkcPiggy','Puerquito','Mostrar u ocultar el puerquito dorado. Arrástralo en el lienzo para colocarlo donde quieras', CV().piggyBox(c).visible ? ' on' : '') +
      T('bkcPiggyDn','−','Reducir el puerquito') +
      T('bkcPiggyUp','+','Agrandar el puerquito') +
      T('bkcPiggyRe','↺','Devolver el puerquito a su sitio por defecto: centrado sobre el bloque del campeón') +
      '<span class="sep"></span>' +
      T('bkcUndo','Deshacer','Deshacer (Ctrl+Z)') + T('bkcRedo','Rehacer','Rehacer (Ctrl+Shift+Z)') +
      '<span class="sep"></span>' +
      T('bkcAuto','Sugerir del formato','Redistribuir el lienzo con la estructura que da el reglamento') +
      T('bkcSym','Simetrizar','Espejar las columnas y alinear cada nodo con el espacio al que alimenta') +
      '<span class="sep"></span>' +
      T('bkcExport','Descargar imagen','Guardar el cuadro como imagen PNG para compartir (WhatsApp, redes). Sale recortado al cuadro y sin la cuadrícula ni los adornos del editor.') +
      '<span class="sep"></span>' +
      T('bkcTrayBtn','Bandeja','Mostrar u ocultar la bandeja de clasificados dentro del editor (sirve en pantalla completa)', S.trayOff ? '' : ' on') +
      T('bkcMin', S.min ? 'Desplegar' : 'Minimizar', S.min ? 'Volver a mostrar el lienzo' : 'Plegar el lienzo y dejar solo esta barra', S.min ? ' on' : '') +
      T('bkcFull', S.full ? '✕ Salir' : '⛶ Pantalla completa', S.full ? 'Salir de pantalla completa (Esc)' : 'Ocupar toda la pantalla con el editor (Esc para salir)', S.full ? ' on' : '') +
      '<span class="grow"></span>' +
      `<span class="bkc-count">Nodos <b>${st.nodes}</b> · Conexiones <b>${st.edges}</b> · Descansos <b>${st.byes}</b> · Rótulos <b>${(c.canvas.bands || []).length}</b> · Espacios libres <b>${st.free}</b></span>` +
      `<span class="bkc-count${BA() && BA().S.dirty ? ' dirty' : ''}">${BA() && BA().S.dirty ? '● Cambios sin guardar' : '○ Sin cambios pendientes'}</span>`;
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('bkcAdd', () => addNode('MATCH'));
    on('bkcAddBye', () => addNode('DIRECT_PASS'));
    on('bkcAddBand', () => addBand());
    on('bkcTrayBtn', () => {
      S.trayOff = !S.trayOff;
      try { localStorage.setItem('bkc.tray', S.trayOff ? 'off' : 'on'); } catch(err){}
      applyTray(); renderBar(); afterResize();
    });
    on('bkcDel', deleteSelection);
    on('bkcFlip', flipSelection);
    on('bkcFront', () => { if (!S.sel.size) return; push(); CV().bringToFront(cfg(), [...S.sel]); commit(); });
    on('bkcBack', () => { if (!S.sel.size) return; push(); CV().sendToBack(cfg(), [...S.sel]); commit(); });
    on('bkcAlL', () => align('l')); on('bkcAlR', () => align('r')); on('bkcAlCx', () => align('cx'));
    on('bkcAlT', () => align('t')); on('bkcAlB', () => align('b')); on('bkcAlCy', () => align('cy'));
    on('bkcDistV', () => align('dist'));
    on('bkcDistH', () => align('distH'));
    on('bkcGrid', () => { const c2 = cfg(); c2.canvas.grid.on = !c2.canvas.grid.on; commit(); });
    on('bkcSnap', () => { const c2 = cfg(); c2.canvas.snap = !c2.canvas.snap; commit(); });
    on('bkcGuides', () => {
      const c2 = cfg();
      c2.canvas.guides = c2.canvas.guides === false;
      if (window.FI_BKT_GUIDES) window.FI_BKT_GUIDES.clear(host() && host().querySelector('.bkc-stage'));
      commit();
      toast(c2.canvas.guides ? 'Guías inteligentes activadas: alineación, separaciones iguales y simetría al mover.'
        : 'Guías inteligentes desactivadas.', 'ok');
    });
    on('bkcPiggy', () => {
      const c2 = cfg(); push();
      CV().setPiggy(c2, { visible: !CV().piggyBox(c2).visible });
      commit();
    });
    on('bkcPiggyDn', () => { const c2 = cfg(); push(); CV().setPiggy(c2, { w: CV().piggyBox(c2).w - 20 }); commit(); });
    on('bkcPiggyUp', () => { const c2 = cfg(); push(); CV().setPiggy(c2, { w: CV().piggyBox(c2).w + 20 }); commit(); });
    on('bkcPiggyRe', () => { const c2 = cfg(); push(); CV().setPiggy(c2, { reset:true }); commit(); toast('Puerquito centrado sobre el bloque del campeón.', 'ok'); });
    on('bkcLock', () => {
      const c2 = cfg();
      const now = CV().centerLocked(c2);
      push();
      c2.canvas.center.locked = !now;
      if (!now){ CV().pinCenter(c2); toast('Bloque central y gran final fijos en la posición estándar de todas las categorías.', 'ok'); }
      else toast('Bloque central desbloqueado: si lo mueves, el cuadro dejará de verse igual que en las otras categorías.');
      commit();
    });
    on('bkcMin', () => setMin(!S.min));
    on('bkcFull', () => setFull(!S.full));
    on('bkcUndo', undo); on('bkcRedo', redo);
    on('bkcAuto', autoLayout);
    on('bkcExport', () => exportImage());
    on('bkcSym', () => {
      push();
      CV().symmetrize(cfg());
      commit();
      toast('Cuadro simetrizado: columnas espejadas y cada enfrentamiento alineado con el espacio al que alimenta.', 'ok');
    });
    const u = $('#bkcUndo'), r = $('#bkcRedo');
    if (u) u.disabled = !S.undo.length;
    if (r) r.disabled = !S.redo.length;
    ['bkcDel','bkcFlip','bkcFront','bkcBack'].forEach(id => { const b2 = $('#' + id); if (b2) b2.disabled = !n && !e && !b; });
    ['bkcAlL','bkcAlR','bkcAlCx','bkcAlT','bkcAlB','bkcAlCy','bkcDistV','bkcDistH'].forEach(id => { const b = $('#' + id); if (b) b.disabled = n < 2; });
  }

  // ── acciones ──────────────────────────────────────────────────────────
  function centerOfView(){
    const v = $('#bkcView');
    if (!v) return { x:80, y:80 };
    return { x: Math.round((v.clientWidth / 2 - S.view.x) / S.view.k - CV().NODE_W / 2),
             y: Math.round((v.clientHeight / 2 - S.view.y) / S.view.k - CV().NODE_H / 2) };
  }
  // Rótulo del cuadro: un elemento más del lienzo (se mueve, se renombra, se borra)
  function addBand(at){
    const c = cfg();
    push();
    const p = at || centerOfView();
    const id = CV().addBand(c, { x: snap(p.x), y: snap(p.y), text:'NUEVA RONDA' });
    S.sel.clear(); S.selEdges.clear(); S.selBands = new Set([id]);
    commit();
    toast('Rótulo creado: doble clic para cambiar el texto.', 'ok');
    return id;
  }
  // El botón «+ enfrentamiento» NO suelta la tarjeta en el centro de la vista:
  // la mete en la retícula del cuadro (columna nueva por fuera, misma distancia
  // que las demás). Solo cuando se pide un punto —doble clic en el lienzo— se
  // respeta ese punto.
  function addNode(kind, at){
    const c = cfg();
    push();
    const id = CV().addNode(c, at
      ? { x: snap(at.x), y: snap(at.y), kind, dir: at.x > (c.canvas.center.x || 0) ? 'RL' : 'LR' }
      : { kind });
    // la fase armada a mano se reparte como una columna del cuadro publicado
    if (!at) CV().distributeColumn(c, c.slots[id].layout.x);
    S.sel = new Set([id]); S.selEdges.clear();
    commit();
    if (!at && S.mounted) focusNode(id);
    toast(kind === 'DIRECT_PASS' ? 'Descanso creado: coloca a quien avanza sin jugar.' : 'Enfrentamiento creado.', 'ok');
    return id;
  }
  function snap(v){
    const c = cfg();
    if (!c.canvas.snap) return Math.round(v);
    const g = c.canvas.grid.size || 20;
    return Math.round(v / g) * g;
  }
  function deleteSelection(){
    const c = cfg();
    if (!S.sel.size && !S.selEdges.size && !S.selBands.size) return;
    if (!S.sel.size && !S.selEdges.size){
      push();
      S.selBands.forEach(id => CV().removeBand(c, id));
      S.selBands.clear();
      commit();
      toast('Rótulo(s) eliminado(s).', 'ok');
      return;
    }
    const blocked = [...S.sel].map(id => ({ id, why: CV().canRemove(c, id) })).filter(x => x.why);
    if (blocked.length){
      toast(blocked[0].why + ' (' + CV().nodeLabel(c, blocked[0].id) + ')', 'err');
      return;
    }
    const nEdges = S.selEdges.size, nNodes = S.sel.size;
    for (const eid of S.selEdges){
      const w = CV().canDisconnect(c, eid);
      if (!w) continue;
      if (w.indexOf('CONFIRM:') === 0){ if (!confirm(w.slice(8))) return; }
      else { toast(w, 'err'); return; }
    }
    if (nNodes && !confirm('Eliminar ' + nNodes + ' enfrentamiento(s)' + (nEdges ? ' y ' + nEdges + ' conexión(es)' : '') +
      ' del borrador.\n\nNo se borra ningún partido oficial ni estadística. ¿Continuar?')) return;
    push();
    S.selEdges.forEach(id => CV().disconnect(c, id));
    S.sel.forEach(id => CV().removeNode(c, id));
    S.selBands.forEach(id => CV().removeBand(c, id));
    S.sel.clear(); S.selEdges.clear(); S.selBands.clear();
    commit();
    toast('Eliminado del borrador.', 'ok');
  }
  function flipSelection(){
    const c = cfg();
    if (!S.sel.size) return;
    push();
    S.sel.forEach(id => {
      if (CV().isPinned(c, id)) return;
      const L = c.slots[id].layout;
      L.dir = L.dir === 'RL' ? 'LR' : 'RL';
      L.inA = L.inA === 'R' ? 'L' : 'R';
      L.inB = L.inB === 'R' ? 'L' : 'R';
    });
    commit();
  }
  function align(mode){
    const c = cfg();
    const ids = [...S.sel].filter(id => !CV().isPinned(c, id));
    if (ids.length < 2) return toast('Selecciona al menos dos nodos que se puedan mover.');
    push();
    const L = id => c.slots[id].layout;
    const W = CV().NODE_W;
    const xs = ids.map(i => L(i).x), ys = ids.map(i => L(i).y);
    if (mode === 'l'){ const v = Math.min(...xs); ids.forEach(i => L(i).x = v); }
    if (mode === 'r'){ const v = Math.max(...xs); ids.forEach(i => L(i).x = v); }
    if (mode === 'cx'){ const v = Math.round(xs.reduce((a, b) => a + b, 0) / ids.length); ids.forEach(i => L(i).x = v); }
    if (mode === 't'){ const v = Math.min(...ys); ids.forEach(i => L(i).y = v); }
    if (mode === 'b'){ const v = Math.max(...ys); ids.forEach(i => L(i).y = v); }
    if (mode === 'cy'){ const v = Math.round(ys.reduce((a, b) => a + b, 0) / ids.length); ids.forEach(i => L(i).y = v); }
    if (mode === 'dist'){
      const sorted = ids.slice().sort((a, b) => L(a).y - L(b).y);
      const y0 = L(sorted[0]).y, y1 = L(sorted[sorted.length - 1]).y;
      const step = (y1 - y0) / (sorted.length - 1);
      sorted.forEach((i, k) => L(i).y = Math.round(y0 + step * k));
    }
    if (mode === 'distH'){
      const sorted = ids.slice().sort((a, b) => L(a).x - L(b).x);
      const x0 = L(sorted[0]).x, x1 = L(sorted[sorted.length - 1]).x;
      const step = (x1 - x0) / (sorted.length - 1);
      sorted.forEach((i, k) => L(i).x = Math.round(x0 + step * k));
    }
    if (c.canvas.snap) ids.forEach(i => { L(i).x = snap(L(i).x); L(i).y = snap(L(i).y); });
    void W;
    commit();
  }
  function autoLayout(){
    const c = cfg();
    if (!confirm('Redibujar el cuadro por defecto: llave de 16 (OCTAVOS → CUARTOS → SEMIFINAL → GRAN FINAL).\n\nSe recolocan los nodos y se reconstruyen las conexiones automáticas. Los participantes ya sembrados se conservan; los nodos creados a mano se conservan y entran en la retícula, por fuera. ¿Continuar?')) return;
    push();
    CV().ensure(c);
    CV().redrawDefault(c, { rebuildEdges:true });
    c.layoutKey = c.layout = CV().LAYOUT_KEY;
    S.sel.clear(); S.selEdges.clear();
    commit();
    fitAll();
    toast('Cuadro redibujado con la llave por defecto (octavos → gran final). Ya puedes moverlo todo a mano.', 'ok');
  }

  function fitAll(){
    const v = $('#bkcView'), st = host() && host().querySelector('.bkc-stage');
    if (!v || !st) return;
    const b = CV().bounds(cfg());
    const pad = 40;
    const k = Math.min(1.4, Math.max(.22, Math.min((v.clientWidth - pad * 2) / Math.max(80, b.w), (v.clientHeight - pad * 2) / Math.max(80, b.h))));
    S.view.k = k;
    S.view.x = Math.round(pad + (v.clientWidth - pad * 2 - b.w * k) / 2 - b.x * k);
    S.view.y = Math.round(pad + (v.clientHeight - pad * 2 - b.h * k) / 2 - b.y * k);
    applyView(); saveView();
  }
  function zoomTo(k){
    const v = $('#bkcView');
    if (!v) return;
    const cx = v.clientWidth / 2, cy = v.clientHeight / 2;
    const nk = Math.min(2, Math.max(.25, k));
    S.view.x = cx - (cx - S.view.x) * (nk / S.view.k);
    S.view.y = cy - (cy - S.view.y) * (nk / S.view.k);
    S.view.k = nk;
    applyView(); saveView();
  }
  function focusNode(id){
    const c = cfg();
    if (!c.slots[id]) return;
    const v = $('#bkcView');
    const L = c.slots[id].layout;
    S.sel = new Set([id]); S.selEdges.clear();
    S.view.x = Math.round(v.clientWidth / 2 - (L.x + 98) * S.view.k);
    S.view.y = Math.round(v.clientHeight / 2 - (L.y + 52) * S.view.k);
    applyView(); applySelection(); saveView();
  }

  // ── pantalla completa / plegado ─────────────────────────────────
  // El lienzo es alto y la página tiene mucho encima: «pantalla completa» lo
  // saca a una capa fija que ocupa la ventana; «minimizar» lo pliega y deja
  // solo la barra, para llegar rápido al resto de la página.
  function wrap(){ return $('#baCanvas'); }
  // Con pantalla completa nativa solo se pinta el elemento a pantalla completa:
  // avisos, menú contextual y modales tienen que colgar de él o no se ven.
  function topLayer(){ return document.fullscreenElement || document.body; }
  function afterResize(){
    const st = host() && host().querySelector('.bkc-stage');
    requestAnimationFrame(() => { applyView(); if (st) BKC().drawLines(st, paintOpts()); });
  }
  function setFull(on){
    const w = wrap();
    if (!w) return;
    S.full = !!on;
    if (S.full) S.min = false;
    w.classList.toggle('is-full', S.full);
    w.classList.toggle('is-min', S.min);
    document.body.classList.toggle('bkc-full-on', S.full);
    const ov = $('#baOverlay');
    if (ov) (S.full ? w : document.body).appendChild(ov);
    // El aviso de «RPC faltante / categoría sin resolver» (#baBanner) vive
    // fuera de este panel: en pantalla completa el navegador solo pinta el
    // elemento en fullscreen y sus hijos, así que el aviso (y el motivo real
    // de que «Guardar borrador» esté deshabilitado) quedaba invisible.
    const banner = $('#baBanner');
    if (banner){
      if (S.full){
        if (!banner.__homeParent){ banner.__homeParent = banner.parentNode; banner.__homeNext = banner.nextSibling; }
        w.insertBefore(banner, w.firstChild);
      } else if (banner.__homeParent){
        banner.__homeParent.insertBefore(banner, banner.__homeNext);
      }
    }
    // Incrustado en FaseEliminatoria: «fixed» solo llega al borde del iframe,
    // así que se le pide al contenedor que también se ponga a pantalla completa.
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type:'fi:embed-full', on:S.full }, '*'); } catch(e){}
    try {
      if (S.full && !document.fullscreenElement && w.requestFullscreen) w.requestFullscreen().catch(() => {});
      else if (!S.full && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch(e){}
    renderBar();
    afterResize();
    if (S.full) fitAll();
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && S.full) setFull(false);
    else if (document.fullscreenElement && S.full){ afterResize(); fitAll(); }
  });
  window.addEventListener('message', e => {
    const d = e.data;
    if (d && d.type === 'fi:host-full' && !d.on && S.full) setFull(false);
  });
  function setMin(on){
    const w = wrap();
    if (!w) return;
    S.min = !!on;
    if (S.min && S.full) setFull(false);
    w.classList.toggle('is-min', S.min);
    renderBar();
    if (!S.min) afterResize();
  }

  // ── inspector del nodo seleccionado ───────────────────────────────────
  function renderInspector(){
    const box = $('#bkcInsp');
    if (!box || !cfg()) return;
    const c = cfg();
    if (S.selBands.size === 1 && !S.sel.size){
      const id = [...S.selBands][0];
      const b = CV().bandById(c, id);
      if (b){
        box.innerHTML = `<span class="tag">Rótulo</span>
          <input id="bkcBandText" value="${esc(b.text)}" title="Texto del rótulo">
          ${b.kind === 'sys' ? `<input id="bkcBandSub" value="${esc(b.sub || '')}" title="Segunda línea de la banda">` : ''}
          <select id="bkcBandTone" title="Color del rótulo">
            <option value="accent"${b.tone === 'accent' ? ' selected' : ''}>Color de la categoría</option>
            <option value="flank"${b.tone === 'flank' ? ' selected' : ''}>Categoría · flanco claro</option>
            <option value="gold"${b.tone === 'gold' ? ' selected' : ''}>Dorado (gran final)</option></select>
          <button class="bkc-tool" id="bkcBandDup">Duplicar</button>
          <button class="bkc-tool danger" id="bkcBandDel">Eliminar rótulo</button>
          <span class="grow" style="flex:1"></span>
          <span class="bkc-count">x ${Math.round(b.x)} · y ${Math.round(b.y)} · arrastra para moverlo · doble clic = cambiar texto</span>`;
        $('#bkcBandText').onchange = e => { push(); CV().setBand(c, id, { text: e.target.value.trim() }); commit(); };
        const sub = $('#bkcBandSub');
        if (sub) sub.onchange = e => { push(); CV().setBand(c, id, { sub: e.target.value.trim() }); commit(); };
        $('#bkcBandTone').onchange = e => { push(); CV().setBand(c, id, { tone: e.target.value }); commit(); };
        $('#bkcBandDup').onclick = () => {
          push();
          const nid = CV().addBand(c, Object.assign({}, b, { x:b.x + 40, y:b.y + 40 }));
          S.selBands = new Set([nid]);
          commit();
        };
        $('#bkcBandDel').onclick = () => { push(); CV().removeBand(c, id); S.selBands.delete(id); commit(); };
        return;
      }
    }
    if (S.sel.size !== 1){
      box.innerHTML = `<span class="bkc-count">${S.sel.size ? S.sel.size + ' enfrentamientos seleccionados' : 'Ningún enfrentamiento seleccionado'}${
        S.selEdges.size ? ' · ' + S.selEdges.size + ' conexión(es)' : ''}${
        S.selBands.size ? ' · ' + S.selBands.size + ' rótulo(s)' : ''}</span>
        <span class="grow" style="flex:1"></span>
        <span class="bkc-count">Clic = seleccionar · Shift+clic = añadir · Doble clic = editar tarjeta · Arrastra del punto de salida (centro, color de la categoría) a cualquier anclaje de entrada</span>`;
      return;
    }
    const id = [...S.sel][0];
    const s = c.slots[id];
    if (!s) return;
    const rounds = (c.rounds || []).filter(r => r && r.id);
    box.innerHTML = `<span class="tag">${esc(id)}</span>
      <input id="bkcLabel" value="${esc(CV().nodeLabel(c, id))}" title="Etiqueta del enfrentamiento">
      <select id="bkcRound" title="Ronda a la que pertenece">${rounds.map(r =>
        `<option value="${esc(r.id)}"${s.roundId === r.id ? ' selected' : ''}>${esc(r.label || r.id)}</option>`).join('')}</select>
      <select id="bkcKind" title="Tipo de nodo">
        <option value="MATCH"${s.slotType !== 'DIRECT_PASS' ? ' selected' : ''}>Enfrentamiento</option>
        <option value="DIRECT_PASS"${s.slotType === 'DIRECT_PASS' ? ' selected' : ''}>Descanso / BYE</option></select>
      <button class="bkc-tool" id="bkcOpen">Editar tarjeta…</button>
      <button class="bkc-tool" id="bkcInA" title="Lado por el que entra el ganador al espacio A">Entrada A: ${s.layout.inA === 'R' ? 'derecha' : 'izquierda'}</button>
      <button class="bkc-tool" id="bkcInB"${s.slotType === 'DIRECT_PASS' ? ' disabled' : ''} title="Lado por el que entra el ganador al espacio B">Entrada B: ${s.layout.inB === 'R' ? 'derecha' : 'izquierda'}</button>
      <button class="bkc-tool${s.layout.join !== false ? ' on' : ''}" id="bkcJoin" title="Unir las dos líneas de entrada en un solo punto, al centro del nodo (llave clásica)">Entradas ${s.layout.join !== false ? 'unidas' : 'separadas'}</button>
      <button class="bkc-tool" id="bkcClearA">Quitar A</button>
      <button class="bkc-tool" id="bkcClearB"${s.slotType === 'DIRECT_PASS' ? ' disabled' : ''}>Quitar B</button>
      <button class="bkc-tool" id="bkcVis">${s.visible === false ? 'Mostrar' : 'Ocultar'}</button>
      <span class="grow" style="flex:1"></span>
      <span class="bkc-count">x ${Math.round(s.layout.x)} · y ${Math.round(s.layout.y)} · salida ${s.layout.dir === 'RL' ? 'izquierda' : 'derecha'}</span>`;
    $('#bkcLabel').onchange = e => { push(); s.label = e.target.value.trim() || CV().nodeLabel(c, id); commit(); };
    $('#bkcRound').onchange = e => { push(); s.roundId = e.target.value; commit(); };
    $('#bkcKind').onchange = e => {
      const kind = e.target.value;
      if (kind === 'DIRECT_PASS'){
        const eb = CV().inAt(c, id, 'B');
        const pb = s.participantB || {};
        if (eb || (pb.mode && pb.mode !== 'EMPTY')){
          toast('Un descanso solo tiene un espacio: vacía el espacio B antes de convertirlo en BYE.', 'err');
          renderInspector(); return;
        }
      }
      push(); s.slotType = kind; commit();
    };
    $('#bkcOpen').onclick = () => window.BA_SLOT && window.BA_SLOT.openSlot(id);
    $('#bkcInA').onclick = () => { push(); s.layout.inA = s.layout.inA === 'R' ? 'L' : 'R'; commit(); };
    $('#bkcInB').onclick = () => { push(); s.layout.inB = s.layout.inB === 'R' ? 'L' : 'R'; commit(); };
    $('#bkcJoin').onclick = () => { push(); s.layout.join = s.layout.join === false; commit(); };
    $('#bkcClearA').onclick = () => { push(); CV().unplace(c, id, 'A'); commit(); };
    $('#bkcClearB').onclick = () => { push(); CV().unplace(c, id, 'B'); commit(); };
    $('#bkcVis').onclick = () => { push(); s.visible = s.visible === false; commit(); };
  }

  // ── validación ────────────────────────────────────────────────────────
  function validate(showOk){
    const c = cfg();
    if (!c) return [];
    const list = CV().validate(c);
    S.lastVal = list;
    const box = $('#bkcVal');
    const errs = list.filter(x => x.level === 'error');
    const warns = list.filter(x => x.level === 'warn');
    if (box){
      box.hidden = false;
      box.className = 'bkc-val' + (!list.length ? ' ok' : '');
      box.innerHTML = `<header><b>${!list.length ? 'Llave válida' : errs.length + ' error(es) · ' + warns.length + ' aviso(s)'}</b>
        <span>${!list.length ? 'Sin participantes duplicados, sin ciclos, sin espacios inválidos ni nodos aislados' : 'Los errores impiden una llave coherente; los avisos solo advierten'}</span></header>
        ${list.length ? '<ul>' + list.map(x =>
          `<li class="${x.level === 'error' ? 'err' : 'warn'}"><i>${x.level === 'error' ? 'error' : 'aviso'}</i><span>${esc(x.msg)}</span>${
            x.node ? `<button data-go="${esc(x.node)}">ver</button>` : ''}</li>`).join('') + '</ul>' : ''}`;
      box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => focusNode(b.dataset.go));
    }
    if (showOk) toast(!list.length ? 'Llave válida: lista para publicar.' : (errs.length
      ? errs.length + ' error(es) que conviene resolver antes de publicar.'
      : warns.length + ' aviso(s): puedes publicar, pero revisa la lista.'), !list.length ? 'ok' : (errs.length ? 'err' : ''));
    return list;
  }

  // ── Descargar el cuadro como imagen ───────────────────────────────────
  // Sirve en CUALQUIER momento del torneo (borrador o publicado) y para
  // mandarse por WhatsApp: PNG recortado al contenido, sin cuadrícula ni
  // adornos del editor, a escala natural (no la del zoom en pantalla).
  const SHOT_PAD = 44;        // aire alrededor del cuadro, en px de lienzo
  const SHOT_MAX_W = 4200;    // techo del ancho final: PNG manejable al compartir
  // Caja que ocupa de verdad el cuadro dentro del lienzo (nodos, rótulos,
  // bloque central y puerquito), en coordenadas del lienzo.
  function contentBox(stage){
    const els = stage.querySelectorAll('.bkc-node,.bkc-band,.bkc-center,.bkc-piggy');
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    els.forEach(el => {
      const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      if (!w && !h) return;
      if (x < x1) x1 = x; if (y < y1) y1 = y;
      if (x + w > x2) x2 = x + w; if (y + h > y2) y2 = y + h;
    });
    const W = stage.offsetWidth, H = stage.offsetHeight;
    if (!Number.isFinite(x1)) return { x:0, y:0, w:W, h:H };
    x1 = Math.max(0, x1 - SHOT_PAD); y1 = Math.max(0, y1 - SHOT_PAD);
    x2 = Math.min(W, x2 + SHOT_PAD); y2 = Math.min(H, y2 + SHOT_PAD);
    return { x:x1, y:y1, w:Math.max(1, x2 - x1), h:Math.max(1, y2 - y1) };
  }
  function shotName(){
    const cat = (BA() && BA().S.catKey) || 'llave';
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return 'cuadro-' + cat + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.png';
  }
  // Carga bajo demanda: si el <script> del CDN queda fijo en el <head>, una
  // red filtrada lo deja "pendiente" para siempre y como los <script> clásicos
  // se ejecutan en orden, este archivo entero nunca llega a correr — por eso
  // se veía "falta el módulo del lienzo" sin que el editor tuviera ningún bug.
  // Aislarlo aquí evita que un CDN lento/caído tumbe todo el editor.
  let htiPromise = null;
  function ensureHtmlToImage(){
    if (window.htmlToImage) return Promise.resolve(true);
    if (!htiPromise){
      htiPromise = new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve(!!window.htmlToImage);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
    }
    return htiPromise;
  }
  // Reinicia un <img> de GIF a su primer frame recargándolo: un GIF sigue
  // corriendo solo, así que sin esto la descarga podía salir a la mitad de
  // la animación del cerdito en vez de en su pose inicial.
  function resetGifFrame(img){
    return new Promise(resolve => {
      const clean = img.src.split('#')[0].split('?')[0];
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
      img.src = clean + '?shot=' + Date.now();
    });
  }
  // Fuerza el logo de FACULTAD en las tarjetas cuyo <img> alterna 50/50 con
  // el de carrera (data-fac-src, ver torneo-bracket-render.js): la imagen
  // descargada nunca debe llevar logos de carrera, solo de facultad.
  function freezeFacLogos(stage){
    const changed = Array.from(stage.querySelectorAll('.fac-item[data-fac-src]'))
      .filter(img => img.getAttribute('src') !== img.dataset.facSrc);
    const originals = changed.map(img => img.getAttribute('src'));
    const ready = Promise.all(changed.map(img => new Promise(resolve => {
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); };
      img.addEventListener('load', done); img.addEventListener('error', done);
      img.setAttribute('src', img.dataset.facSrc);
    })));
    return { ready, restore: () => changed.forEach((img, i) => img.setAttribute('src', originals[i])) };
  }
  // stageArg: opcional — el lienzo a capturar (permite exportar también la
  // vista publicada del admin, donde el editor no está montado).
  async function exportImage(stageArg){
    const stage = stageArg || (host() && host().querySelector('.bkc-stage'));
    if (!stage){ toast('No hay cuadro que exportar todavía.', 'err'); return; }
    const ready = await ensureHtmlToImage();
    if (!ready){ toast('No se pudo exportar: falta el generador de imagen (revisa tu conexión).', 'err'); return; }
    if (!stageArg){ S.sel.clear(); S.selEdges.clear(); S.selBands.clear(); renderBar(); }
    const box = stage.classList.contains('bkc-stage') ? contentBox(stage)
      : { x:0, y:0, w:stage.offsetWidth, h:stage.offsetHeight };
    const wrap = stage.closest('.bkc-wrap') || stage.parentElement;
    const skin = stage.closest('.bkc-box') || wrap || stage;
    const hadGrid = stage.classList.contains('grid');
    const prevTransform = stage.style.transform;
    if (wrap) wrap.classList.add('bkc-shoot');
    if (hadGrid) stage.classList.remove('grid');
    stage.style.transform = 'none';
    await Promise.all(Array.from(stage.querySelectorAll('.bkc-piggy img')).map(resetGifFrame));
    const facSwap = freezeFacLogos(stage);
    await facSwap.ready;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const bgOf = el => { const c = el && getComputedStyle(el).backgroundColor; return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' ? c : null; };
      const bg = bgOf(skin) || bgOf(wrap) || '#2a1a12';
      const ratio = Math.max(1, Math.min(2, SHOT_MAX_W / box.w));
      const dataUrl = await window.htmlToImage.toPng(stage, {
        backgroundColor: bg, pixelRatio: ratio,
        width: Math.round(box.w), height: Math.round(box.h),
        style: { transform: 'translate(' + (-Math.round(box.x)) + 'px,' + (-Math.round(box.y)) + 'px)', transformOrigin: '0 0' }
      });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = shotName();
      document.body.appendChild(a); a.click(); a.remove();
      toast('Imagen del cuadro descargada.', 'ok');
    } catch(e){
      toast('No se pudo exportar la imagen (' + (e && e.message || e) + ').', 'err');
    } finally {
      facSwap.restore();
      stage.style.transform = prevTransform;
      if (hadGrid) stage.classList.add('grid');
      if (wrap) wrap.classList.remove('bkc-shoot');
    }
  }

  // ── API pública del editor ────────────────────────────────────────────
  const api = {
    S, cfg, push, commit, paint, toast, snap, fitAll, zoomTo, focusNode, validate, exportImage,
    mount, unmount, applyTray, applySelection, pickedSeed, pickSeed, placePicked, applyView, saveView, renderTray, renderBar,
    seedById, loadSeeds, flipSelection,
    addNodeAt: (kind, x, y) => addNode(kind, { x, y }),
    addBandAt: (x, y) => addBand({ x, y }),
    setView(v){ S.view = v; applyView(); },
    view: () => S.view,
    select(ids, edges, bands){
      S.sel = new Set(ids || []); S.selEdges = new Set(edges || []); S.selBands = new Set(bands || []);
      applySelection();
    },
    undo, redo, deleteSelection, setFull, setMin
  };
  window.BKC_ED = api;

  // atajos globales del editor
  document.addEventListener('keydown', e => {
    const p = $('#baCanvas');
    if (!p || p.hidden) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if ($('#baOverlay') && $('#baOverlay').classList.contains('open')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ if (S.sel.size || S.selEdges.size || S.selBands.size){ e.preventDefault(); deleteSelection(); } }
    else if (e.key === 'Escape'){ if (S.full) setFull(false); else api.select([], [], []); }
    else if (mod && e.key.toLowerCase() === 'a'){ e.preventDefault(); api.select(Object.keys(cfg().slots), [], (cfg().canvas.bands || []).map(b => b.id)); }
  });
})();
