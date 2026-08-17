// ── ACTA Y CAPTURA DEL SORTEO FÍSICO (ControlTorneo.html) ──────────────
// El sorteo es 100 % físico y presencial. Este módulo SOLO transcribe lo que
// sale de las pelotas: no elige jugadores, no elige grupos, no baraja listas,
// no usa Math.random(), no propone asignaciones y no tiene sorteo automático.
//
// Persistencia: borrador LOCAL en localStorage, una clave por edición y
// categoría. En esta etapa NO hay ninguna escritura en Supabase: no crea
// groups, group_memberships, matches ni resultados, no llama
// create_group_stage_matches y no toca la visibilidad de la lista pública.
//
// Reutiliza por completo el contexto del módulo de imprimibles
// (window.SB_PRE_GROUP_PRINT): edición, categoría, participantes elegibles con
// su nombre canónico, distribución 4–4–4–4–3, logotipos y utilidades de
// documento. No hace una segunda consulta ni duplica el cálculo de grupos.

(function(global){
  'use strict';

  const VERSION = '116';
  const KEY_PREFIX = 'ppfi:physical-group-draw-draft:v1:';
  const CLEAR_PHRASE = 'BORRAR SORTEO';

  const D = {
    ctx: null, draft: null, key: null, mounted: false,
    editing: null, mismatch: null, keepOnly: false,
    filter: '', modal: null, restored: false, notice: null
  };

  const $ = s => document.querySelector(s);
  const API = () => global.SB_PRE_GROUP_PRINT;
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const fmt = d => API().fmtDateTime(d instanceof Date ? d : new Date(d));
  const hhmm = d => {
    try { return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
    catch(e){ return ''; }
  };
  // Hash determinista (FNV-1a) — solo para identificar el snapshot, no es seguridad.
  function hash(str){
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(36).toUpperCase().padStart(7, '0');
  }
  function fingerprintOf(ctx){
    const ids = ctx.participants.map(p => p.key).slice().sort().join(',');
    return hash(ids + '|' + (ctx.dist ? ctx.dist.sizes.join('-') : ''));
  }

  // ── Inventarios (idénticos a los papelitos impresos) ─────────────────
  function participantTickets(ctx){
    const total = ctx.participants.length, pad = String(total).length;
    return ctx.participants.map((p, i) => ({
      ticket: 'P' + String(i + 1).padStart(pad, '0') + '/' + total,
      key: p.key, name: p.name, code: p.code
    }));
  }
  function groupTickets(ctx){
    return API().groupItemsFor(ctx.dist).map(g => ({
      ticket: g.letter + ' ' + g.j + '/' + g.cap, letter: g.letter, cap: g.cap
    }));
  }
  const usedParticipants = () => new Set((D.draft ? D.draft.draws : []).map(d => d.participantTicket));
  const usedGroups = () => new Set((D.draft ? D.draft.draws : []).map(d => d.groupTicket));

  // ── Borrador local ───────────────────────────────────────────────────
  function storageKey(ctx){
    return KEY_PREFIX + (ctx.editionId || 'x') + ':' + (ctx.editionCategoryId || 'x');
  }
  function readDraft(key){
    let raw;
    try { raw = global.localStorage.getItem(key); }
    catch(err){
      global.SB_LOG && global.SB_LOG.error('PGD-STORAGE-READ', err);
      return null;
    }
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || obj.version !== 1 || !Array.isArray(obj.draws)) return null;
      return obj;
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGD-STORAGE-PARSE', err);
      return null;
    }
  }
  function writeDraft(){
    if (!D.draft || !D.key) return;
    D.draft.updatedAt = new Date().toISOString();
    try { global.localStorage.setItem(D.key, JSON.stringify(D.draft)); }
    catch(err){
      global.SB_LOG && global.SB_LOG.error('PGD-STORAGE-WRITE', err);
      setNotice('bad', 'No se pudo guardar el borrador en este navegador: ' + (err.message || err));
    }
  }
  function newDraft(ctx){
    const now = new Date().toISOString();
    return {
      version: 1,
      editionId: ctx.editionId,
      editionCategoryId: ctx.editionCategoryId,
      rosterFingerprint: fingerprintOf(ctx),
      distribution: ctx.dist.sizes.slice(),
      // roster mínimo (folio público y nombre canónico) para poder comparar
      // más tarde qué inscripciones entraron o salieron. Sin datos privados.
      roster: ctx.participants.map(p => ({ registrationId: p.key, nickname: p.name, publicCode: p.code })),
      createdAt: now,
      updatedAt: now,
      draws: []
    };
  }

  // ── Comparación de snapshot ──────────────────────────────────────────
  function diffRoster(ctx){
    if (!D.draft) return null;
    const fp = fingerprintOf(ctx);
    if (fp === D.draft.rosterFingerprint) return null;
    const old = new Map((D.draft.roster || []).map(r => [String(r.registrationId), r.nickname]));
    const now = new Map(ctx.participants.map(p => [String(p.key), p.name]));
    const added = [], removed = [];
    now.forEach((name, id) => { if (!old.has(id)) added.push(name); });
    old.forEach((name, id) => { if (!now.has(id)) removed.push(name); });
    const before = (D.draft.distribution || []).join('–');
    const after = ctx.dist ? ctx.dist.sizes.join('–') : '—';
    return { added, removed, distChanged: before !== after, before, after };
  }

  // ── Validación del sorteo completo ───────────────────────────────────
  function validate(ctx){
    const problems = [];
    const draws = D.draft ? D.draft.draws : [];
    const inv = participantTickets(ctx), gt = groupTickets(ctx);
    const pSeen = new Map(), gSeen = new Map();
    draws.forEach(d => {
      pSeen.set(d.participantTicket, (pSeen.get(d.participantTicket) || 0) + 1);
      gSeen.set(d.groupTicket, (gSeen.get(d.groupTicket) || 0) + 1);
    });
    pSeen.forEach((n, t) => { if (n > 1) problems.push('El papelito de participante ' + t + ' está registrado ' + n + ' veces.'); });
    gSeen.forEach((n, t) => { if (n > 1) problems.push('El papelito de grupo ' + t + ' está registrado ' + n + ' veces.'); });
    inv.forEach(p => { if (!pSeen.has(p.ticket)) problems.push('Falta extraer el papelito ' + p.ticket + ' (' + p.name + ').'); });
    gt.forEach(g => { if (!gSeen.has(g.ticket)) problems.push('Falta extraer el papelito de grupo ' + g.ticket + '.'); });
    if (draws.length !== inv.length){
      problems.push('Se registraron ' + draws.length + ' extracciones y deben ser exactamente ' + inv.length + '.');
    }
    const counts = countByGroup(ctx);
    counts.forEach(c => {
      if (c.got !== c.cap) problems.push('El grupo ' + c.letter + ' tiene ' + c.got + ' de ' + c.cap + ' lugares ocupados.');
    });
    const got = counts.map(c => c.got);
    if (got.length && (Math.max.apply(null, got) - Math.min.apply(null, got)) > 1){
      problems.push('La diferencia entre grupos es mayor a una persona.');
    }
    return problems;
  }
  function countByGroup(ctx){
    const map = new Map();
    groupTickets(ctx).forEach(g => {
      if (!map.has(g.letter)) map.set(g.letter, { letter: g.letter, cap: g.cap, got: 0 });
    });
    (D.draft ? D.draft.draws : []).forEach(d => {
      const c = map.get(d.groupCode);
      if (c) c.got++;
    });
    return Array.from(map.values());
  }
  const isComplete = ctx => !!(D.draft && D.draft.draws.length === ctx.participants.length && validate(ctx).length === 0);
  const isLocked = () => !!D.mismatch;

  function setNotice(kind, text, extra){
    D.notice = text ? { kind: kind, text: text, extra: extra || null } : null;
  }

  // ── Render ───────────────────────────────────────────────────────────
  function render(){
    const sect = $('#pgdSect');
    if (!sect) return;
    const ctx = D.ctx;
    const body = $('#pgdBody');
    body.textContent = '';

    if (!ctx || !ctx.ready){
      body.appendChild(alertBox('info',
        ctx && ctx.assetError ? ctx.assetError
        : 'Selecciona una edición y una categoría con participantes elegibles en el bloque de imprimibles. Este módulo reutiliza esa misma lista.'));
      return;
    }
    if (D.notice) body.appendChild(alertBox(D.notice.kind, D.notice.text, D.notice.extra));

    // Solo el acta imprimible. La captura manual se eliminó: el resultado del
    // sorteo se transcribe en el Tablero de Grupos, que sí publica en Supabase
    // con motivo y bitácora — capturarlo dos veces no aportaba nada.
    body.appendChild(actaRow(ctx));
    body.appendChild(alertBox('info',
      'Imprime el acta en blanco y llénala a mano en la mesa del sorteo. Al terminar, transcribe los grupos en el Tablero de Grupos para publicarlos.'));
  }

  function alertBox(kind, text, list){
    const n = el('div', 'pgd-alert pgd-alert--' + kind);
    n.appendChild(document.createTextNode(text));
    if (list && list.length){
      const ul = el('ul');
      list.forEach(t => ul.appendChild(el('li', null, t)));
      n.appendChild(ul);
    }
    return n;
  }

  function mismatchBox(){
    const m = D.mismatch;
    const lines = [];
    if (m.added.length) lines.push('Se añadieron: ' + m.added.join(', ') + '.');
    if (m.removed.length) lines.push('Se retiraron: ' + m.removed.join(', ') + '.');
    if (m.distChanged) lines.push('La distribución cambió de ' + m.before + ' a ' + m.after + '.');
    if (!lines.length) lines.push('Cambió algún identificador de inscripción del snapshot original.');
    const box = alertBox('bad', 'La lista de inscritos cambió después de iniciar este borrador', lines);
    if (D.keepOnly){
      box.appendChild(alertBox('info', 'Borrador conservado solo para consulta. No se admiten capturas nuevas.'));
      return box;
    }
    const acts = el('div', 'pgd-actions');
    const keep = el('button', 'btn btn-ghost', 'Conservar para consulta');
    keep.type = 'button';
    keep.addEventListener('click', () => {
      D.keepOnly = true;
      setNotice('warn', 'Borrador en modo consulta. Para capturar, descártalo y crea uno nuevo.');
      render();
    });
    const drop = el('button', 'btn btn-main', 'Descartar y crear nuevo borrador');
    drop.type = 'button';
    drop.addEventListener('click', () => {
      D.draft = newDraft(D.ctx);
      D.mismatch = null; D.keepOnly = false; D.editing = null;
      writeDraft();
      setNotice('warn', 'Borrador anterior descartado. Se creó uno nuevo con la lista actual (' +
        D.ctx.participants.length + ' participantes, ' + D.ctx.dist.sizes.join('–') + ').');
      render();
    });
    acts.appendChild(keep); acts.appendChild(drop);
    box.appendChild(acts);
    return box;
  }

  function statusBar(ctx){
    const total = ctx.participants.length;
    const done = D.draft ? D.draft.draws.length : 0;
    const wrap = el('div', 'pgd-status');
    const prog = el('div', 'pgd-prog');
    prog.appendChild(el('b', null, done + '/' + total));
    prog.appendChild(el('span', null, 'extracciones'));
    wrap.appendChild(prog);
    const bar = el('div', 'pgd-bar');
    const fill = el('i');
    fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    bar.appendChild(fill);
    wrap.appendChild(bar);
    const meta = el('div', 'pgd-meta');
    const put = (k, v) => {
      const s = el('span', null, k + ': ');
      s.appendChild(el('b', null, v));
      meta.appendChild(s);
      meta.appendChild(document.createTextNode('  ·  '));
    };
    put('Estado', D.draft && done ? (isComplete(ctx) ? 'completo' : 'en captura') : 'sin extracciones');
    put('Actualizado', D.draft ? fmt(D.draft.updatedAt) : '—');
    put('Snapshot', (D.draft && D.draft.rosterFingerprint) || fingerprintOf(ctx));
    meta.appendChild(el('span', null, 'Borrador local: solo existe en este navegador y dispositivo.'));
    wrap.appendChild(meta);
    return wrap;
  }

  function actaRow(ctx){
    const wrap = el('div', 'pgd-actions');
    const b = el('button', 'btn btn-main', 'Generar acta en blanco');
    b.type = 'button';
    b.addEventListener('click', () => downloadActa(false));
    wrap.appendChild(b);
    return wrap;
  }

  function controlTable(ctx){
    const grid = el('div', 'pgd-table');
    grid.appendChild(participantsCol(ctx));
    grid.appendChild(formCol(ctx));
    grid.appendChild(capsCol(ctx));
    return grid;
  }

  function col(title, count){
    const c = el('div', 'pgd-col');
    const h = el('h4');
    h.appendChild(document.createTextNode(title));
    if (count != null) h.appendChild(el('em', null, count));
    c.appendChild(h);
    const b = el('div', 'pgd-colbody');
    c.appendChild(b);
    return { root: c, body: b };
  }

  function participantsCol(ctx){
    const used = usedParticipants();
    const free = participantTickets(ctx).filter(p => !used.has(p.ticket));
    const c = col('Participantes disponibles', String(free.length));
    if (!free.length){
      c.body.appendChild(el('p', 'pgd-empty', 'Todos los papelitos de participante están capturados.'));
      return c.root;
    }
    const ul = el('ul', 'pgd-inv');
    free.forEach(p => {
      const li = el('li');
      li.appendChild(el('code', null, p.ticket));
      li.appendChild(el('span', null, p.name));
      ul.appendChild(li);
    });
    c.body.appendChild(ul);
    return c.root;
  }

  function capsCol(ctx){
    const counts = countByGroup(ctx);
    const c = col('Capacidad de grupos', counts.reduce((a, x) => a + x.got, 0) + '/' + ctx.participants.length);
    const wrap = el('div', 'pgd-caps');
    counts.forEach(x => {
      const row = el('div', 'pgd-cap' + (x.got >= x.cap ? ' is-full' : ''));
      row.appendChild(el('b', null, x.letter));
      const bar = el('div', 'pgd-bar');
      const fill = el('i');
      fill.style.width = Math.round(x.got / x.cap * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('u', null, x.got + '/' + x.cap));
      wrap.appendChild(row);
    });
    c.body.appendChild(wrap);
    const usedG = usedGroups();
    const freeG = groupTickets(ctx).filter(g => !usedG.has(g.ticket));
    const h = el('div', 'pgd-colsub');
    h.appendChild(document.createTextNode('Papelitos de grupo disponibles'));
    h.appendChild(el('em', null, String(freeG.length)));
    c.body.appendChild(h);
    if (!freeG.length){
      c.body.appendChild(el('p', 'pgd-empty', 'Todos los destinos están capturados.'));
    } else {
      const ul = el('ul', 'pgd-inv pgd-inv--g');
      freeG.forEach(g => {
        const li = el('li');
        li.appendChild(el('code', null, g.ticket));
        ul.appendChild(li);
      });
      c.body.appendChild(ul);
    }
    return c.root;
  }

  function formCol(ctx){
    const c = col('Registrar extracción', D.editing ? 'Corrigiendo #' + D.editing.order : null);
    const blocked = isLocked();
    if (D.editing){
      c.body.appendChild(el('div', 'pgd-editing',
        'Corrigiendo la extracción #' + D.editing.order + '. Sus dos papelitos volvieron al inventario; ' +
        'vuelve a registrarlos para conservar el orden.'));
    }
    const used = usedParticipants();
    const free = participantTickets(ctx).filter(p => !used.has(p.ticket));
    const usedG = usedGroups();
    const freeG = groupTickets(ctx).filter(g => !usedG.has(g.ticket));

    const search = el('label', 'pgd-fld');
    search.appendChild(el('span', null, 'Buscar participante'));
    const si = document.createElement('input');
    si.type = 'search'; si.id = 'pgdSearch'; si.placeholder = 'Folio o nombre…';
    si.value = D.filter; si.disabled = blocked;
    si.addEventListener('input', () => { D.filter = si.value; fillParticipantList(free, ps); });
    search.appendChild(si);
    c.body.appendChild(search);

    const pf = el('label', 'pgd-fld');
    pf.appendChild(el('span', null, 'Papelito de participante'));
    const ps = document.createElement('select');
    ps.id = 'pgdPart'; ps.size = 6; ps.disabled = blocked || !free.length;
    pf.appendChild(ps);
    c.body.appendChild(pf);

    const gf = el('label', 'pgd-fld');
    gf.appendChild(el('span', null, 'Papelito de grupo'));
    const gs = document.createElement('select');
    gs.id = 'pgdGroup'; gs.disabled = blocked || !freeG.length;
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = freeG.length ? 'Elige el papelito extraído…' : 'Sin destinos disponibles';
    gs.appendChild(ph);
    freeG.forEach(g => {
      const o = document.createElement('option');
      o.value = g.ticket; o.textContent = g.ticket;
      gs.appendChild(o);
    });
    gf.appendChild(gs);
    c.body.appendChild(gf);

    const acts = el('div', 'pgd-actions');
    const reg = el('button', 'btn btn-main', 'Registrar extracción');
    reg.type = 'button'; reg.id = 'pgdRegister';
    reg.disabled = blocked || !free.length || !freeG.length;
    reg.addEventListener('click', () => registerDraw(ctx));
    acts.appendChild(reg);
    if (D.editing){
      const cancel = el('button', 'btn btn-ghost', 'Cancelar corrección');
      cancel.type = 'button';
      cancel.addEventListener('click', () => {
        D.draft.draws.push(D.editing);
        D.draft.draws.sort((a, b) => a.order - b.order);
        D.editing = null;
        writeDraft();
        setNotice('info', 'Corrección cancelada. La extracción volvió al historial sin cambios.');
        render();
      });
      acts.appendChild(cancel);
    }
    const undo = el('button', 'btn btn-ghost', 'Deshacer última extracción');
    undo.type = 'button';
    undo.disabled = blocked || !(D.draft && D.draft.draws.length);
    undo.addEventListener('click', () => undoLast(ctx));
    acts.appendChild(undo);
    const clear = el('button', 'btn btn-ghost', 'Limpiar borrador');
    clear.type = 'button';
    clear.disabled = !(D.draft && D.draft.draws.length);
    clear.addEventListener('click', () => askClear(ctx));
    acts.appendChild(clear);
    c.body.appendChild(acts);
    c.body.appendChild(el('p', 'pgd-empty',
      'La página no elige nada: registra exactamente el papelito que salió de cada pelota.'));

    fillParticipantList(free, ps);
    return c.root;
  }

  function fillParticipantList(free, sel){
    sel = sel || $('#pgdPart');
    if (!sel) return;
    const q = D.filter.trim().toLowerCase();
    const list = q ? free.filter(p =>
      p.ticket.toLowerCase().indexOf(q) >= 0 || p.name.toLowerCase().indexOf(q) >= 0 ||
      (p.code || '').toLowerCase().indexOf(q) >= 0) : free;
    sel.textContent = '';
    if (!list.length){
      const o = document.createElement('option');
      o.value = ''; o.textContent = free.length ? 'Sin coincidencias' : 'Sin participantes disponibles';
      o.disabled = true;
      sel.appendChild(o);
      return;
    }
    list.forEach(p => {
      const o = document.createElement('option');
      o.value = p.ticket;
      o.textContent = p.ticket + ' — ' + p.name;
      sel.appendChild(o);
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────
  function registerDraw(ctx){
    if (isLocked()){
      setNotice('bad', 'No se pueden registrar extracciones: la lista de inscritos cambió.');
      return render();
    }
    const pTicket = ($('#pgdPart') || {}).value || '';
    const gTicket = ($('#pgdGroup') || {}).value || '';
    const problems = [];
    if (!pTicket) problems.push('Falta elegir el papelito de participante.');
    if (!gTicket) problems.push('Falta elegir el papelito de grupo.');
    if (problems.length){
      setNotice('bad', 'No se registró la extracción:', problems);
      return render();
    }
    const inv = participantTickets(ctx);
    const p = inv.find(x => x.ticket === pTicket);
    const g = groupTickets(ctx).find(x => x.ticket === gTicket);
    if (!p) problems.push('El papelito ' + pTicket + ' no pertenece al snapshot actual.');
    if (!g) problems.push('El papelito de grupo ' + gTicket + ' no existe en la distribución ' + ctx.dist.sizes.join('–') + '.');
    if (p && usedParticipants().has(pTicket)) problems.push('El participante ' + pTicket + ' ya fue registrado.');
    if (g && usedGroups().has(gTicket)) problems.push('El papelito de grupo ' + gTicket + ' ya fue registrado.');
    if (g){
      const c = countByGroup(ctx).find(x => x.letter === g.letter);
      if (c && c.got >= c.cap) problems.push('El grupo ' + g.letter + ' ya está lleno (' + c.cap + '/' + c.cap + ').');
    }
    if (problems.length){
      setNotice('bad', 'No se registró la extracción:', problems);
      return render();
    }
    const now = new Date().toISOString();
    const row = {
      order: D.editing ? D.editing.order : D.draft.draws.length + 1,
      registrationId: p.key,
      publicCode: p.code,
      participantTicket: p.ticket,
      nickname: p.name,
      groupTicket: g.ticket,
      groupCode: g.letter,
      capturedAt: now,
      corrected: !!D.editing
    };
    D.draft.draws.push(row);
    D.draft.draws.sort((a, b) => a.order - b.order);
    const wasEditing = !!D.editing;
    D.editing = null;
    D.filter = '';
    writeDraft();
    setNotice(wasEditing ? 'warn' : 'ok',
      (wasEditing ? 'Corrección registrada' : 'Extracción registrada') +
      ': ' + row.participantTicket + ' — ' + row.nickname + ' → ' + row.groupTicket + '.');
    render();
  }

  function undoLast(ctx){
    if (!D.draft || !D.draft.draws.length) return;
    const last = D.draft.draws[D.draft.draws.length - 1];
    if (!global.confirm('¿Deshacer la extracción #' + last.order + ' (' + last.participantTicket +
      ' → ' + last.groupTicket + ')? Ambos papelitos vuelven al inventario.')) return;
    D.draft.draws.pop();
    renumber();
    writeDraft();
    setNotice('warn', 'Extracción deshecha. ' + last.participantTicket + ' y ' + last.groupTicket + ' volvieron al inventario.');
    render();
  }

  function cancelDraw(row){
    if (!global.confirm('¿Anular la captura #' + row.order + ' (' + row.participantTicket + ' → ' +
      row.groupTicket + ')?\n\nEsto corrige el borrador local; no anula ningún partido deportivo.')) return;
    D.draft.draws = D.draft.draws.filter(d => d.order !== row.order);
    renumber();
    writeDraft();
    setNotice('warn', 'Captura anulada. ' + row.participantTicket + ' y ' + row.groupTicket + ' volvieron al inventario.');
    render();
  }

  function editDraw(row){
    if (!global.confirm('¿Editar la captura #' + row.order + '? Sus dos papelitos vuelven al inventario y ' +
      'deberás registrarlos de nuevo. La extracción quedará marcada como corregida.')) return;
    D.draft.draws = D.draft.draws.filter(d => d.order !== row.order);
    D.editing = Object.assign({}, row, { corrected: true });
    D.filter = '';
    writeDraft();
    setNotice('warn', 'Editando la extracción #' + row.order + '. Ambos papelitos están disponibles otra vez.');
    render();
    const s = $('#pgdSearch');
    if (s) s.focus();
  }

  function renumber(){
    D.draft.draws.sort((a, b) => a.order - b.order);
    D.draft.draws.forEach((d, i) => { d.order = i + 1; });
  }

  function askClear(ctx){
    const body = $('#pgdBody');
    const box = alertBox('bad', 'Para limpiar el borrador escribe exactamente ' + CLEAR_PHRASE + ':');
    const row = el('div', 'pgd-confirm');
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = CLEAR_PHRASE; inp.setAttribute('aria-label', 'Confirmación');
    const ok = el('button', 'btn btn-main', 'Borrar');
    ok.type = 'button'; ok.disabled = true;
    inp.addEventListener('input', () => { ok.disabled = inp.value.trim().toUpperCase() !== CLEAR_PHRASE; });
    ok.addEventListener('click', () => {
      D.draft = newDraft(ctx);
      D.editing = null; D.mismatch = null; D.keepOnly = false;
      writeDraft();
      setNotice('warn', 'Borrador limpiado. Los 19 papelitos vuelven al inventario.');
      render();
    });
    const no = el('button', 'btn btn-ghost', 'Cancelar');
    no.type = 'button';
    no.addEventListener('click', () => { setNotice(null); render(); });
    row.appendChild(inp); row.appendChild(ok); row.appendChild(no);
    box.appendChild(row);
    body.appendChild(box);
    inp.focus();
  }

  // ── Historial ────────────────────────────────────────────────────────
  function history(ctx){
    const wrap = el('div', 'pgd-hist');
    const h = el('h4', null, 'Historial de extracciones');
    wrap.appendChild(h);
    const rows = el('div', 'pgd-rows');
    const draws = D.draft ? D.draft.draws : [];
    if (!draws.length){
      const p = el('p', 'pgd-empty', 'Todavía no hay extracciones registradas.');
      p.style.padding = '14px 12px';
      rows.appendChild(p);
    }
    draws.forEach(d => {
      const r = el('div', 'pgd-row' + (d.corrected ? ' is-corrected' : ''));
      r.appendChild(el('i', null, String(d.order)));
      r.appendChild(el('code', null, d.participantTicket));
      const nm = el('span', null, d.nickname);
      if (d.corrected){
        const tag = el('em', 'pgd-corr', ' corregida');
        tag.style.cssText = 'font-style:normal;margin-left:8px';
        nm.appendChild(tag);
      }
      r.appendChild(nm);
      r.appendChild(el('b', null, d.groupTicket));
      r.appendChild(el('em', null, d.groupCode));
      r.appendChild(el('u', null, hhmm(d.capturedAt)));
      const btns = el('div', 'pgd-rowbtns');
      const ed = el('button', 'pgd-mini', 'Editar');
      ed.type = 'button'; ed.disabled = isLocked();
      ed.addEventListener('click', () => editDraw(d));
      const an = el('button', 'pgd-mini pgd-mini--x', 'Anular extracción');
      an.type = 'button'; an.disabled = isLocked();
      an.addEventListener('click', () => cancelDraw(d));
      btns.appendChild(ed); btns.appendChild(an);
      r.appendChild(btns);
      rows.appendChild(r);
    });
    wrap.appendChild(rows);
    return wrap;
  }

  function publishZone(){
    const z = el('div', 'pgd-locked');
    z.appendChild(el('b', null, 'Publicación en Supabase — pendiente de la siguiente etapa'));
    z.appendChild(el('span', null, 'Primero se validará el flujo completo con participantes de prueba.'));
    return z;
  }

  // ── Previsualización de grupos (borrador, no publica nada) ───────────
  function openPreview(ctx){
    const bg = D.modal || buildPreviewModal();
    const body = bg.querySelector('#pgdPrevBody');
    body.textContent = '';
    body.appendChild(el('div', 'pgd-draftmark',
      'Borrador no publicado · no se crearon grupos, membresías ni partidos'));
    const counts = countByGroup(ctx);
    const cards = el('div', 'pgd-cards');
    counts.forEach(c => {
      const card = el('div', 'pgd-card');
      const h5 = el('h5');
      h5.appendChild(el('b', null, 'Grupo ' + c.letter));
      h5.appendChild(el('u', null, c.got + '/' + c.cap));
      card.appendChild(h5);
      const ol = el('ol');
      const mine = D.draft.draws.filter(d => d.groupCode === c.letter).sort((a, b) => a.order - b.order);
      mine.forEach(d => {
        const li = el('li');
        li.appendChild(el('code', null, d.groupTicket));
        li.appendChild(el('span', null, d.nickname));
        ol.appendChild(li);
      });
      for (let i = mine.length; i < c.cap; i++) ol.appendChild(el('li', 'pgd-slot', 'Lugar libre'));
      card.appendChild(ol);
      cards.appendChild(card);
    });
    body.appendChild(cards);

    const sum = el('div', 'pgd-summary');
    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Grupo</th><th class="n">Esperados</th><th class="n">Capturados</th><th>Estado</th></tr></thead>';
    const tb = document.createElement('tbody');
    counts.forEach(c => {
      const tr = document.createElement('tr');
      const g = el('td', 'g', c.letter);
      const e = el('td', 'n', String(c.cap));
      const got = el('td', 'n', String(c.got));
      const ok = c.got === c.cap;
      const st = el('td', 'st ' + (ok ? 'ok' : 'no'), ok ? 'Completo' : (c.got > c.cap ? 'Excedido' : 'Faltan ' + (c.cap - c.got)));
      [g, e, got, st].forEach(td => tr.appendChild(td));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    sum.appendChild(tbl);
    body.appendChild(sum);
    bg.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function buildPreviewModal(){
    const bg = el('div', 'pgp-modal-bg');
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.innerHTML =
      '<div class="pgp-modal">' +
        '<header><h2>Previsualización de grupos · borrador</h2>' +
        '<button class="pgp-x" type="button" id="pgdPrevClose" aria-label="Cerrar">×</button></header>' +
        '<div class="pgp-modal-body" style="background:var(--bg);display:block;padding:16px 0 0">' +
        '<div id="pgdPrevBody"></div></div>' +
        '<footer><button class="btn btn-ghost" type="button" id="pgdPrevBack">Volver</button>' +
        '<span class="pgp-note">Vista de borrador. No crea grupos, no crea partidos, no cambia la página pública ' +
        'ni la lista previa.</span></footer>' +
      '</div>';
    document.body.appendChild(bg);
    const close = () => { bg.classList.remove('open'); document.body.style.overflow = ''; };
    bg.querySelector('#pgdPrevClose').addEventListener('click', close);
    bg.querySelector('#pgdPrevBack').addEventListener('click', close);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && bg.classList.contains('open')) close();
    });
    D.modal = bg;
    return bg;
  }

  // ── Acta imprimible ──────────────────────────────────────────────────
  function actaHtml(ctx, filled){
    const api = API();
    const now = new Date();
    const fp = (D.draft && D.draft.rosterFingerprint) || fingerprintOf(ctx);
    const total = ctx.participants.length;
    const draws = filled && D.draft ? D.draft.draws.slice().sort((a, b) => a.order - b.order) : [];
    const cells = [
      ['Edición', ctx.editionLabel],
      ['Categoría', ctx.categoryLabel],
      ['Participantes', String(total)],
      ['Distribución', ctx.dist.sizes.join('–')],
      ['Snapshot', fp]
    ];
    const rows = [];
    for (let i = 0; i < total; i++){
      const d = draws[i];
      rows.push('<tr>' +
        '<td class="c-n">' + (i + 1) + '</td>' +
        '<td class="c-pt' + (d ? '' : ' blank') + '">' + (d ? esc(d.participantTicket) : '· · · · ·') + '</td>' +
        '<td class="c-nm' + (d ? '' : ' blank') + '">' + (d ? esc(d.nickname) : '') + '</td>' +
        '<td class="c-gt' + (d ? '' : ' blank') + '">' + (d ? esc(d.groupTicket) : '· · · ·') + '</td>' +
        '<td class="c-g">' + (d ? esc(d.groupCode) : '') + '</td>' +
        '<td class="c-i">' + (d ? (d.corrected ? hhmm(d.capturedAt) + ' · corregida' : hhmm(d.capturedAt)) : '') + '</td>' +
      '</tr>');
    }
    const counts = countByGroup(ctx);
    const sum = counts.map(c => '<div class="pgp-sum-c"><i>' + esc(c.letter) + ' ' +
      (filled ? c.got + '/' + c.cap : c.cap) + '</i><u>' + (filled ? 'capturados' : 'esperados') + '</u></div>').join('');
    const obs = '<i></i><i></i>';
    const sign = ['Organizador', 'Testigo'].map(r => '<div class="pgp-sign-b"><small>Nombre y firma · ' + r +
      '</small><div class="pgp-sign-line">Nombre completo</div><div class="pgp-sign-line">Firma</div></div>').join('');
    const times = [['Hora de inicio', ''], ['Hora de conclusión', ''],
      ['Última actualización', filled && D.draft ? fmt(D.draft.updatedAt) : '']]
      .map(t => '<div class="pgp-time-b"><small>' + esc(t[0]) + '</small><b>' + esc(t[1]) + '</b></div>').join('');

    const body = '<section class="pgp-sheet"><div class="pgp-acta">' +
      '<div class="pgp-acta-head">' +
        (ctx.test ? '<div class="pgp-test">Documento de prueba — no usar en el sorteo real</div>' : '') +
        '<div class="pgp-acta-top">' + api.logoFi(true) +
          '<div class="pgp-acta-c"><b>Acta oficial del sorteo de grupos</b>' +
          '<span>Torneo de Ping Pong FI · ' + esc(ctx.editionLabel) + ' · ' + esc(ctx.categoryLabel) + '</span></div>' +
          api.logoCup() + '</div>' +
        '<div class="pgp-head-strap"></div>' +
        '<div class="pgp-acta-grid">' + cells.map(c =>
          '<div class="pgp-hcell"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>').join('') + '</div>' +
        '<div class="pgp-acta-foot"><span>Generada: ' + esc(fmt(now)) + '</span>' +
        '<span>' + (filled ? 'Acta completada' : 'Acta en blanco') + '</span>' +
        '<span>Imprimir al 100 %, sin ajustar a página</span></div>' +
      '</div>' +
      '<div class="pgp-draft-band"><em>Borrador no publicado</em>' +
        '<span>Snapshot ' + esc(fp) + ' · ' + esc(ctx.dist.sizes.join('–')) + '</span></div>' +
      '<table class="pgp-tbl"><thead><tr>' +
        '<th class="c-n">N.º</th><th class="c-pt">Papelito participante</th><th class="c-nm">Nombre</th>' +
        '<th class="c-gt">Papelito de grupo</th><th class="c-g">Grupo</th><th class="c-i">Incidencia</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
      '<div class="pgp-acta-sum"><b>Conteo final esperado</b><div class="pgp-sum-row" style="--n:' +
        counts.length + '">' + sum + '</div></div>' +
      '<div class="pgp-obs"><b>Observaciones generales</b><div class="pgp-obs-lines">' + obs + '</div></div>' +
      '<div class="pgp-sign">' + sign + '</div>' +
      '<div class="pgp-times">' + times + '</div>' +
      '<div class="pgp-notice">El acta registra un sorteo físico; la página no realiza asignaciones</div>' +
    '</div></section>';
    return api.docShell(body, { w: 80, h: 30 });
  }

  async function downloadActa(filled){
    const ctx = D.ctx;
    if (!ctx || !ctx.ready) return;
    if (filled && !isComplete(ctx)){
      setNotice('bad', 'El acta completada requiere las ' + ctx.participants.length + ' extracciones válidas.');
      return render();
    }
    setNotice('info', 'Preparando el acta…');
    render();
    try {
      await API().loadAssets();
      const html = actaHtml(ctx, filled);
      const slug = (ctx.editionLabel + '-' + ctx.categoryLabel).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const name = 'acta-sorteo-' + (filled ? 'completada' : 'en-blanco') + '-' + slug + '-' + stamp + '.html';
      await API().downloadHtml(html, name);
      setNotice('ok', 'Acta descargada: ' + name + '. Es un archivo autosuficiente con ambos logotipos; ' +
        'ábrelo e imprime al 100 %.');
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGD-ACTA', err);
      setNotice('bad', (err && err.message) || 'No se pudo generar el acta.');
    }
    render();
  }

  // ── Montaje y sincronización con el módulo de imprimibles ────────────
  function sync(ctx){
    const prevKey = D.key;
    D.ctx = ctx;
    if (!ctx || !ctx.ready){ render(); return; }
    const key = storageKey(ctx);
    if (key !== prevKey){
      // Cambió edición o categoría: advertir si el borrador anterior tenía capturas.
      if (D.draft && D.draft.draws.length && prevKey){
        setNotice('warn', 'Cambiaste de edición o categoría. El borrador anterior quedó guardado en ' +
          'su propia clave local con ' + D.draft.draws.length + ' extracciones; no se perdió nada.');
      }
      D.key = key;
      D.editing = null; D.keepOnly = false; D.filter = '';
      const stored = readDraft(key);
      if (stored){
        D.draft = stored;
        D.restored = true;
        if (!D.notice) setNotice('info', 'Borrador local restaurado · ' + stored.draws.length +
          ' extracciones · guardado el ' + fmt(stored.updatedAt) + '. Solo existe en este navegador y dispositivo.');
      } else {
        D.draft = newDraft(ctx);
        D.restored = false;
      }
    }
    D.mismatch = D.draft && D.draft.draws.length ? diffRoster(ctx) : null;
    if (!D.mismatch && D.draft && !D.draft.draws.length){
      // Borrador vacío: se realinea sin avisar, no hay nada que preservar.
      const fp = fingerprintOf(ctx);
      if (D.draft.rosterFingerprint !== fp){
        D.draft = newDraft(ctx);
        writeDraft();
      }
    }
    render();
  }

  function mount(){
    const sect = $('#pgdSect');
    if (!sect || D.mounted) return;
    if (!API()){
      global.SB_LOG && global.SB_LOG.error('PGD-000', new Error('SB_PRE_GROUP_PRINT no está disponible.'));
      return;
    }
    D.mounted = true;
    sect.style.display = '';
    sync(API().onChange(sync));
  }

  global.SB_PRE_GROUP_DRAW = { mount, _state: D, _validate: validate };
})(typeof window !== 'undefined' ? window : globalThis);
