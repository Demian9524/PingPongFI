// ── Editor visual de llaves · interacciones de puntero ───────────────────
// Arrastre de nodos, selección múltiple, marco de selección, zoom, paneo,
// creación de conexiones desde los puertos y soltar participantes de la
// bandeja en los espacios de un enfrentamiento.
(function(){
  'use strict';
  const CV  = () => window.FI_BKT_CANVAS;
  const BKC = () => window.TORNEO_BKC;
  const G   = () => window.FI_BKT_GUIDES;
  const SEEDS = () => window.SB_BKT_SEEDS;

  let view = null, stageHost = null, ed = null;
  let mode = null;          // 'node' | 'pan' | 'marquee' | 'link' | 'center'
  let start = null, moved = false, pushed = false, spaceDown = false;
  let dragMap = null, marqueeEl = null, linkSvg = null, linkFrom = null, relink = null, anchor = null;
  let raf = 0;

  const stage = () => stageHost && stageHost.querySelector('.bkc-stage');
  const cfg = () => ed && ed.cfg();
  // Guías inteligentes: devuelven el desplazamiento ya ajustado y pintan la
  // capa temporal. Si el módulo no está cargado, el arrastre sigue igual.
  function guide(dx, dy, free){
    const g = G();
    if (!g || !g.active()) return { dx, dy, snapX:false, snapY:false };
    return g.solve(dx, dy, free);
  }

  function toStage(ev){
    const r = view.getBoundingClientRect(), V = ed.view();
    return { x:(ev.clientX - r.left - V.x) / V.k, y:(ev.clientY - r.top - V.y) / V.k };
  }
  function toView(ev){
    const r = view.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function relines(){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      BKC().drawLines(stage(), { editable:true, selectedNodes: ed.S.sel, selectedEdges: ed.S.selEdges });
    });
  }

  // ── init ──────────────────────────────────────────────────────────────
  function init(opts){
    view = opts.view; stageHost = opts.stageHost; ed = opts.ed;
    view.addEventListener('pointerdown', onDown);
    view.addEventListener('wheel', onWheel, { passive:false });
    view.addEventListener('dblclick', onDblClick);
    view.addEventListener('contextmenu', onContext);
    view.addEventListener('dragover', onDragOver);
    view.addEventListener('dragleave', onDragLeave);
    view.addEventListener('drop', onDrop);
    view.addEventListener('dragstart', onChipDragStart);
    document.addEventListener('keydown', e => { if (e.code === 'Space') spaceDown = true; });
    document.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
    const tray = document.getElementById('bkcTray');
    if (tray){
      tray.addEventListener('dragover', e => { if (dragPayload(e).kind === 'move'){ e.preventDefault(); tray.style.outline = '1px dashed var(--gold)'; } });
      tray.addEventListener('dragleave', () => { tray.style.outline = ''; });
      tray.addEventListener('drop', e => {
        tray.style.outline = '';
        const p = dragPayload(e);
        if (p.kind !== 'move') return;
        e.preventDefault();
        ed.push();
        CV().unplace(cfg(), p.slot, p.side);
        ed.commit();
        ed.toast('Participante devuelto a la bandeja.', 'ok');
      });
    }
  }

  // Marca como arrastrables los chips que ya tienen a alguien sembrado y les
  // pone el botón «quitar» (devuelve al participante a la bandeja).
  function decorate(){
    const st = stage();
    if (!st) return;
    st.querySelectorAll('.bkc-node').forEach(n => {
      const id = n.getAttribute('data-slot');
      const s = cfg().slots[id];
      if (!s) return;
      n.querySelectorAll('.mbk-chip[data-side]').forEach(chip => {
        const side = chip.getAttribute('data-side');
        const p = s['participant' + side] || {};
        const own = p.mode === 'REGISTRATION' && !!p.registrationId;
        chip.setAttribute('draggable', own ? 'true' : 'false');
        chip.dataset.owner = id;
        const old = chip.querySelector('.bkc-rm');
        if (old) old.remove();
        if (!own) return;
        const b = document.createElement('button');
        b.className = 'bkc-rm';
        b.type = 'button';
        b.setAttribute('data-rm', id + '|' + side);
        b.title = 'Quitar a ' + (p.displayName || 'este participante') + ' de este enfrentamiento y devolverlo a la bandeja';
        b.textContent = '×';
        chip.appendChild(b);
      });
    });
  }
  // Quita al participante del espacio indicado (no toca partidos oficiales).
  function removeAt(id, side){
    const c = cfg(), s = c.slots[id];
    if (!s) return;
    const p = s['participant' + side] || {};
    ed.push();
    CV().unplace(c, id, side);
    ed.commit();
    ed.toast('«' + (p.displayName || 'Participante') + '» volvió a la bandeja.', 'ok');
  }

  // Cambia el texto de un rótulo del cuadro (encabezado de ronda o banda).
  function renameBand(id){
    const c = cfg(), b = CV().bandById(c, id);
    if (!b) return;
    const t = prompt('Texto del rótulo:', b.text);
    if (t == null) return;
    ed.push();
    CV().setBand(c, id, { text: t.trim() });
    ed.commit();
  }
  // ── pointer ───────────────────────────────────────────────────────────
  function onDown(ev){
    if (ev.button === 2) return;
    // alguien tomado de la bandeja: el clic lo siembra en ese hueco
    if (ev.button === 0 && ed.pickedSeed && ed.pickedSeed()){
      const tgt = targetChip(ev);
      if (tgt){ ev.preventDefault(); ed.placePicked(tgt.id, tgt.side); return; }
    }
    const rm = ev.target.closest && ev.target.closest('.bkc-rm');
    if (rm){
      ev.preventDefault(); ev.stopPropagation();
      const p = String(rm.getAttribute('data-rm') || '').split('|');
      mode = null;
      removeAt(p[0], p[1]);
      return;
    }
    const port = ev.target.closest && ev.target.closest('.bkc-port');
    const node = ev.target.closest && ev.target.closest('.bkc-node');
    const edge = ev.target.closest && ev.target.closest('.bkc-edge');
    const band = ev.target.closest && ev.target.closest('.bkc-band');
    const center = ev.target.closest && ev.target.closest('.bkc-center');
    const piggy = ev.target.closest && ev.target.closest('.bkc-piggy');
    moved = false; pushed = false;
    start = { s: toStage(ev), v: toView(ev), view: Object.assign({}, ed.view()) };

    // Puertos: el punto exacto donde la línea se une al nodo.
    //   · salida o entrada YA conectada → arrastrar la conexión a otro espacio;
    //     si se suelta sobre el PROPIO nodo, cambia el lado por el que se une.
    //   · entrada libre → arrastrar solo mueve el punto de unión (izq./der.).
    if (port && node){
      const nid = node.getAttribute('data-slot');
      const which = port.getAttribute('data-port');
      const ex = (which === 'OUT' || which === 'C') ? null : CV().inAt(cfg(), nid, which);
      anchor = { node: nid, port: which };
      if (which === 'OUT' || ex){
        mode = 'link';
        linkFrom = { id: which === 'OUT' ? nid : ex.fromSlot };
        relink = ex ? { edgeId: ex.id, fromId: ex.fromSlot } : null;
        makeLinkSvg();
      } else {
        mode = 'anchor';
        makeLinkSvg();
      }
      if (G()) G().beginPoint({ stage: stage(), cfg: cfg(), k: ed.view().k });
      view.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (ev.button === 1 || spaceDown || ev.altKey){
      mode = 'pan'; view.classList.add('panning');
      view.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
    }
    if (edge){
      const id = edge.getAttribute('data-edge');
      if (ev.shiftKey){ ed.S.selEdges.has(id) ? ed.S.selEdges.delete(id) : ed.S.selEdges.add(id); }
      else { ed.S.sel.clear(); ed.S.selEdges = new Set([id]); }
      ed.applySelection();
      mode = null; return;
    }
    if (node){
      const id = node.getAttribute('data-slot');
      if (ev.shiftKey){ ed.S.sel.has(id) ? ed.S.sel.delete(id) : ed.S.sel.add(id); ed.applySelection(); }
      else if (!ed.S.sel.has(id)){ ed.S.sel = new Set([id]); ed.S.selEdges.clear(); ed.applySelection(); }
      if (CV().isPinned(cfg(), id)){
        mode = null;
        ed.toast('La GRAN FINAL está fija para que el cuadro quede simétrico en todas las categorías. Usa «Centro fijo» en la barra para desbloquearla.');
        return;
      }
      mode = 'node';
      dragMap = new Map();
      ed.S.sel.forEach(sid => {
        if (CV().isPinned(cfg(), sid)) return;
        const el = stage().querySelector('.bkc-node[data-slot="' + cssq(sid) + '"]');
        const L = cfg().slots[sid] && cfg().slots[sid].layout;
        if (el && L) dragMap.set(sid, { el, x0:L.x, y0:L.y });
      });
      node.classList.add('drag');
      if (G()) G().begin({ stage: stage(), cfg: cfg(), k: ed.view().k, moverIds: [...dragMap.keys()] });
      view.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (band){
      const id = band.getAttribute('data-band');
      if (ev.shiftKey){ ed.S.selBands.has(id) ? ed.S.selBands.delete(id) : ed.S.selBands.add(id); ed.applySelection(); }
      else if (!ed.S.selBands.has(id)){ ed.S.sel.clear(); ed.S.selEdges.clear(); ed.S.selBands = new Set([id]); ed.applySelection(); }
      mode = 'band';
      dragMap = new Map();
      ed.S.selBands.forEach(bid => {
        const el = stage().querySelector('.bkc-band[data-band="' + cssq(bid) + '"]');
        const b = CV().bandById(cfg(), bid);
        if (el && b) dragMap.set(bid, { el, x0:b.x, y0:b.y });
      });
      band.classList.add('drag');
      if (G()) G().begin({ stage: stage(), cfg: cfg(), k: ed.view().k, moverIds: [], moverBands: [...dragMap.keys()] });
      view.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (piggy){
      mode = 'piggy';
      const p = CV().piggyBox(cfg());
      dragMap = new Map([['__p', { el: piggy, x0:p.x, y0:p.y }]]);
      view.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
    }
    if (center){
      if (CV().centerLocked(cfg())){
        mode = null;
        ed.toast('El bloque de campeón, el trofeo y el subcampeón están fijos: misma posición en todas las categorías. Usa «Centro fijo» en la barra para desbloquearlo.');
        return;
      }
      mode = 'center';
      const c = cfg().canvas.center;
      dragMap = new Map([['__c', { el: stage().querySelector('.bkc-center'), x0:c.x, y0:c.y }]]);
      if (G()) G().begin({ stage: stage(), cfg: cfg(), k: ed.view().k, moverIds: [], movingCenter:true });
      view.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
    }
    mode = 'marquee';
    if (!ev.shiftKey){ ed.S.sel.clear(); ed.S.selEdges.clear(); ed.applySelection(); }
    marqueeEl = document.createElement('div');
    marqueeEl.className = 'bkc-marquee';
    view.appendChild(marqueeEl);
    view.setPointerCapture(ev.pointerId);
  }

  function onMove(ev){
    if (!mode || !start) return;
    const V = ed.view();
    if (mode === 'pan'){
      ed.setView({ k:V.k, x: start.view.x + (ev.clientX - (start.v.x + view.getBoundingClientRect().left)),
                   y: start.view.y + (ev.clientY - (start.v.y + view.getBoundingClientRect().top)) });
      return;
    }
    const p = toStage(ev);
    const dx = p.x - start.s.x, dy = p.y - start.s.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
    if (mode === 'node' && dragMap){
      if (!pushed){ ed.push(); pushed = true; }
      // Alt mantenido durante el arrastre = movimiento libre, sin imán
      const g = guide(dx, dy, ev.altKey);
      dragMap.forEach((d, id) => {
        const nx = g.snapX ? Math.round(d.x0 + g.dx) : ed.snap(d.x0 + g.dx);
        const ny = g.snapY ? Math.round(d.y0 + g.dy) : ed.snap(d.y0 + g.dy);
        d.el.style.left = nx + 'px'; d.el.style.top = ny + 'px';
        const L = cfg().slots[id].layout;
        L.x = nx; L.y = ny;
      });
      relines();
      return;
    }
    if (mode === 'band' && dragMap){
      if (!pushed){ ed.push(); pushed = true; }
      // Mismas guías inteligentes que al mover una tarjeta (Alt = libre)
      const g = guide(dx, dy, ev.altKey);
      dragMap.forEach((d, id) => {
        const nx = g.snapX ? Math.round(d.x0 + g.dx) : ed.snap(d.x0 + g.dx);
        const ny = g.snapY ? Math.round(d.y0 + g.dy) : ed.snap(d.y0 + g.dy);
        d.el.style.left = nx + 'px'; d.el.style.top = ny + 'px';
        CV().moveBand(cfg(), id, nx, ny);
      });
      return;
    }
    if (mode === 'piggy' && dragMap){
      if (!pushed){ ed.push(); pushed = true; }
      const d = dragMap.get('__p');
      const s = toStage(ev);
      const nx = ed.snap(d.x0 + (s.x - start.s.x));
      const ny = ed.snap(d.y0 + (s.y - start.s.y));
      d.el.style.left = nx + 'px'; d.el.style.top = ny + 'px';
      CV().setPiggy(cfg(), { x:nx, y:ny });
      return;
    }
    if (mode === 'center' && dragMap){
      if (!pushed){ ed.push(); pushed = true; }
      const d = dragMap.get('__c');
      const g = guide(dx, dy, ev.altKey);
      const nx = g.snapX ? Math.round(d.x0 + g.dx) : ed.snap(d.x0 + g.dx);
      const ny = g.snapY ? Math.round(d.y0 + g.dy) : ed.snap(d.y0 + g.dy);
      d.el.style.left = nx + 'px'; d.el.style.top = ny + 'px';
      cfg().canvas.center.x = nx; cfg().canvas.center.y = ny;
      return;
    }
    if (mode === 'marquee' && marqueeEl){
      const a = start.v, b = toView(ev);
      Object.assign(marqueeEl.style, { left: Math.min(a.x, b.x) + 'px', top: Math.min(a.y, b.y) + 'px',
        width: Math.abs(b.x - a.x) + 'px', height: Math.abs(b.y - a.y) + 'px' });
      return;
    }
    if (mode === 'link' || mode === 'anchor'){
      const from = mode === 'link' ? portPoint(linkFrom.id) : anchorPoint();
      if (!from) return;
      drawLink(from, p);
      if (G()) G().solvePoint(p);
      const over = mode === 'link' ? inPortUnder(ev) : null;
      stage().querySelectorAll('.bkc-port.in').forEach(x => x.classList.remove('hot'));
      hintSide(over ? null : sideUnder(p));
      if (over){
        const err = whyNot(over);
        over.el.classList.add('hot');
        over.el.style.background = err ? 'var(--red2)' : '';
      }
    }
  }

  // ── punto de unión de la línea con el nodo ─────────────────────────
  // Soltar el extremo sobre el PROPIO nodo cambia el lado por el que entra o
  // sale la línea (izquierda / derecha), sin tocar la conexión en sí.
  function boxOf(id){
    const st = stage();
    if (!st) return null;
    const M = BKC().metrics(st);
    return M[id] ? M[id].box : null;
  }
  function anchorPoint(){
    const st = stage();
    if (!st || !anchor) return null;
    const M = BKC().metrics(st);
    if (!M[anchor.node]) return null;
    const p = anchor.port === 'OUT' ? BKC().outPoint(M[anchor.node]) : BKC().inPoint(M[anchor.node], anchor.port);
    return { x:p.x, y:p.y };
  }
  // 'L' / 'R' si el puntero está sobre el nodo del extremo arrastrado; null si no
  function sideUnder(p){
    if (!anchor) return null;
    const b = boxOf(anchor.node);
    if (!b) return null;
    const m = 34;
    if (p.x < b.l - m || p.x > b.r + m || p.y < b.t - m || p.y > b.b + m) return null;
    return p.x > (b.l + b.r) / 2 ? 'R' : 'L';
  }
  function hintSide(side){
    const st = stage();
    if (!st) return;
    st.querySelectorAll('.bkc-node.side-l,.bkc-node.side-r').forEach(n => n.classList.remove('side-l', 'side-r'));
    if (!side || !anchor) return;
    const el = st.querySelector('.bkc-node[data-slot="' + cssq(anchor.node) + '"]');
    if (el) el.classList.add(side === 'R' ? 'side-r' : 'side-l');
  }
  // Devuelve true si se aplicó un cambio de punto de unión
  function applyAnchor(p){
    const side = sideUnder(p);
    if (!side || !anchor) return false;
    const c = cfg(), s = c.slots[anchor.node];
    if (!s) return false;
    if (CV().isPinned(c, anchor.node)) return false;
    const L = s.layout;
    if (anchor.port === 'OUT'){
      const dir = side === 'R' ? 'LR' : 'RL';
      if (L.dir === dir) return false;
      ed.push(); L.dir = dir; ed.commit();
      ed.toast('El ganador sale ahora por la ' + (side === 'R' ? 'derecha' : 'izquierda') + '.', 'ok');
      return true;
    }
    const key = anchor.port === 'B' ? 'inB' : 'inA';
    if (anchor.port === 'C'){
      if (L.inA === side && L.inB === side) return false;
      ed.push(); L.inA = side; L.inB = side; ed.commit();
      ed.toast('Las líneas entran ahora por la ' + (side === 'R' ? 'derecha' : 'izquierda') + '.', 'ok');
      return true;
    }
    if (L[key] === side) return false;
    ed.push(); L[key] = side; ed.commit();
    ed.toast('La línea entra ahora por la ' + (side === 'R' ? 'derecha' : 'izquierda') +
      ' al espacio ' + anchor.port + '.', 'ok');
    return true;
  }

  // Motivo por el que NO se puede soltar aquí. Al mover una conexión existente
  // se evalúa como si ya estuviera quitada (si no, se estorbaría a sí misma).
  function whyNot(over){
    const c = cfg();
    if (!over) return 'CANCEL';
    if (!relink) return CV().whyNotConnect(c, linkFrom.id, over.node, over.side);
    const saved = (c.connections || []).slice();
    CV().disconnect(c, relink.edgeId);
    const err = CV().whyNotConnect(c, relink.fromId, over.node, over.side);
    c.connections = saved;
    return err;
  }

  function onUp(ev){
    const st = stage();
    if (G()) G().end();
    if (mode === 'anchor'){
      killLink(); hintSide(null);
      if (moved && !applyAnchor(toStage(ev)))
        ed.toast('Suelta el punto sobre el lado izquierdo o derecho del nodo para mover ahí la unión.');
      anchor = null;
    } else if (mode === 'link'){
      const over = inPortUnder(ev);
      killLink(); hintSide(null);
      if (st) st.querySelectorAll('.bkc-port.in').forEach(x => { x.classList.remove('hot'); x.style.background = ''; });
      const c = cfg();
      const onSelf = !over && moved && applyAnchor(toStage(ev));
      if (onSelf){ relink = null; linkFrom = null; anchor = null; }
      else if (relink){
        const err = whyNot(over);
        if (err === 'CANCEL'){ ed.toast('La conexión se quedó donde estaba.'); }
        else if (err){ ed.toast(err, 'err'); }
        else {
          ed.push();
          CV().disconnect(c, relink.edgeId);
          const r = CV().connect(c, relink.fromId, over.node, over.side);
          if (r.error) ed.toast(r.error, 'err');
          else { applyDropSide(over); ed.commit(); ed.toast('Conexión movida al espacio ' + over.side + ' de «' + CV().nodeLabel(c, over.node) + '».', 'ok'); }
        }
        relink = null;
      } else if (over){
        const err = CV().whyNotConnect(c, linkFrom.id, over.node, over.side);
        if (err) ed.toast(err, 'err');
        else {
          ed.push();
          const r = CV().connect(c, linkFrom.id, over.node, over.side);
          if (r.error) ed.toast(r.error, 'err');
          else { applyDropSide(over); ed.commit(); ed.toast('Conexión creada: el ganador avanza al espacio ' + over.side + '.', 'ok'); }
        }
      }
      linkFrom = null;
    } else if (mode === 'node' && moved){
      ed.commit();
    } else if (mode === 'band' && moved){
      ed.commit();
    } else if (mode === 'center' && moved){
      ed.commit();
    } else if (mode === 'piggy' && moved){
      ed.commit();
    } else if (mode === 'marquee' && marqueeEl){
      const a = start.s, b = toStage(ev);
      const box = { x1:Math.min(a.x, b.x), y1:Math.min(a.y, b.y), x2:Math.max(a.x, b.x), y2:Math.max(a.y, b.y) };
      if (box.x2 - box.x1 > 4 && box.y2 - box.y1 > 4){
        const sel = new Set(ev.shiftKey ? ed.S.sel : []);
        CV().nodes(cfg()).forEach(n => {
          const L = n.slot.layout, w = CV().NODE_W, h = CV().nodeH(cfg(), n.id);
          if (L.x < box.x2 && L.x + w > box.x1 && L.y < box.y2 && L.y + h > box.y1) sel.add(n.id);
        });
        const selB = new Set(ev.shiftKey ? ed.S.selBands : []);
        (cfg().canvas.bands || []).forEach(b => {
          const w = b.w || CV().BAND_W, h = CV().BAND_H;
          if (b.x < box.x2 && b.x + w > box.x1 && b.y < box.y2 && b.y + h > box.y1) selB.add(b.id);
        });
        ed.select([...sel], [...ed.S.selEdges], [...selB]);
      }
    }
    if (marqueeEl){ marqueeEl.remove(); marqueeEl = null; }
    if (st) st.querySelectorAll('.bkc-node.drag,.bkc-band.drag').forEach(n => n.classList.remove('drag'));
    view.classList.remove('panning');
    if (mode === 'pan') ed.saveView();
    mode = null; dragMap = null; start = null;
  }
  document.addEventListener('pointermove', e => { if (mode) onMove(e); });
  document.addEventListener('pointerup', e => { if (mode) onUp(e); });
  document.addEventListener('pointercancel', () => { if (mode){ killLink(); hintSide(null); if (G()) G().end(); relink = null; anchor = null; if (marqueeEl){ marqueeEl.remove(); marqueeEl = null; } mode = null; } });

  function cssq(s){ return String(s).replace(/"/g, '\\"'); }
  // El puerto central «AUTO» no apunta a un espacio concreto: se resuelve al
  // primer espacio libre del nodo (A y si no, B).
  function resolveSide(fromId, toId, side){
    if (side !== 'AUTO') return side;
    const c = cfg();
    if (!CV().whyNotConnect(c, fromId, toId, 'A')) return 'A';
    if (!CV().whyNotConnect(c, fromId, toId, 'B')) return 'B';
    return CV().inAt(c, toId, 'A') ? 'B' : 'A';
  }
  // Anclaje de entrada bajo el puntero. Gana SIEMPRE el más cercano, no el que
  // devuelva el navegador: con el lienzo alejado los tres puntos de un lado
  // caen a 10 px unos de otros y el central era imposible de atinar, así que
  // soltar «casi encima» no creaba ninguna conexión.
  //
  // La tarjeta de la que se parte NO queda excluida: mover una conexión de su
  // espacio A al punto central es un gesto legítimo. Solo se le pide puntería
  // (radio corto) y se descarta el anclaje que se agarró, para que soltar sobre
  // el cuerpo de la tarjeta siga cambiando el lado de unión (applyAnchor).
  const SNAP = 30, SNAP_SELF = 12;
  function nearestInPort(ev){
    const st = stage();
    if (!st) return null;
    const self = anchor && anchor.node;
    let best = null;
    st.querySelectorAll('.bkc-node').forEach(n => {
      const own = n.getAttribute('data-slot') === self;
      if (own && anchor && anchor.port === 'OUT') return;   // nadie se conecta consigo mismo
      const lim = own ? SNAP_SELF : SNAP;
      const b = n.getBoundingClientRect();
      if (ev.clientX < b.left - lim || ev.clientX > b.right + lim ||
          ev.clientY < b.top - lim || ev.clientY > b.bottom + lim) return;
      n.querySelectorAll('.bkc-port.in').forEach(p => {
        if (own && anchor && p.getAttribute('data-spot') === anchor.port) return;
        const r = p.getBoundingClientRect();
        const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
        if (d <= lim && (!best || d < best.d)) best = { d, port:p, node:n };
      });
    });
    return best;
  }
  function inPortUnder(ev){
    const near = nearestInPort(ev);
    if (!near) return null;
    const port = near.port, node = near.node;
    const to = node.getAttribute('data-slot');
    const spot = port.getAttribute('data-spot');
    const pside = port.getAttribute('data-side') === 'R' ? 'R' : 'L';
    const from = relink ? relink.fromId : (linkFrom && linkFrom.id);
    return { el: port, node: to, spot, pside, side: resolveSide(from, to, spot === 'C' ? 'AUTO' : spot) };
  }
  // Al soltar, la línea queda anclada al punto exacto donde se soltó.
  function applyDropSide(over){
    const L = cfg().slots[over.node] && cfg().slots[over.node].layout;
    if (!L) return;
    if (over.spot === 'C'){ L.inA = over.pside; L.inB = over.pside; L.join = true; }
    else L['in' + (over.side === 'B' ? 'B' : 'A')] = over.pside;
  }
  function portPoint(id){
    const st = stage();
    if (!st) return null;
    const M = BKC().metrics(st);
    if (!M[id]) return null;
    const p = BKC().outPoint(M[id]);
    return { x:p.x, y:p.y };
  }
  function makeLinkSvg(){
    killLink();
    const st = stage();
    if (!st) return;
    linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    linkSvg.setAttribute('class', 'bkc-drag-line');
    linkSvg.setAttribute('width', st.offsetWidth);
    linkSvg.setAttribute('height', st.offsetHeight);
    linkSvg.innerHTML = '<polyline points=""></polyline>';
    st.appendChild(linkSvg);
  }
  function drawLink(a, b){
    if (!linkSvg) return;
    const mx = (a.x + b.x) / 2;
    linkSvg.querySelector('polyline').setAttribute('points',
      [[a.x, a.y], [mx, a.y], [mx, b.y], [b.x, b.y]].map(p => Math.round(p[0]) + ',' + Math.round(p[1])).join(' '));
  }
  function killLink(){ if (linkSvg){ linkSvg.remove(); linkSvg = null; } }

  // ── zoom ──────────────────────────────────────────────────────────────
  function onWheel(ev){
    ev.preventDefault();
    const V = ed.view();
    const r = view.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const k = Math.min(2, Math.max(.25, V.k * (ev.deltaY > 0 ? 0.9 : 1.11)));
    ed.setView({ k, x: mx - (mx - V.x) * (k / V.k), y: my - (my - V.y) * (k / V.k) });
    clearTimeout(onWheel.t);
    onWheel.t = setTimeout(() => ed.saveView(), 260);
  }

  function onDblClick(ev){
    const band = ev.target.closest && ev.target.closest('.bkc-band');
    if (band){ renameBand(band.getAttribute('data-band')); return; }
    const edge = ev.target.closest && ev.target.closest('.bkc-edge');
    if (edge){
      const id = edge.getAttribute('data-edge');
      const w = CV().canDisconnect(cfg(), id);
      if (w && w.indexOf('CONFIRM:') !== 0) return ed.toast(w, 'err');
      if (!confirm(w ? w.slice(8) : '¿Eliminar esta conexión? El espacio de destino vuelve a quedar libre.')) return;
      ed.push(); CV().disconnect(cfg(), id); ed.S.selEdges.delete(id); ed.commit();
      ed.toast('Conexión eliminada.', 'ok');
      return;
    }
    const node = ev.target.closest && ev.target.closest('.bkc-node');
    if (node && window.BA_SLOT) window.BA_SLOT.openSlot(node.getAttribute('data-slot'));
  }
  // ── menú contextual ───────────────────────────────────────────────────
  let menuEl = null;
  function closeMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; } }
  document.addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  function openMenu(x, y, items, title){
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'bkc-menu';
    if (title){ const b = document.createElement('b'); b.textContent = title; menuEl.appendChild(b); }
    items.forEach(it => {
      if (it === '-'){ menuEl.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.danger) b.classList.add('danger');
      if (it.disabled) b.disabled = true;
      else b.onclick = () => { closeMenu(); it.run(); };
      menuEl.appendChild(b);
    });
    (document.fullscreenElement || document.body).appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    menuEl.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  }

  function onContext(ev){
    const node = ev.target.closest && ev.target.closest('.bkc-node');
    const edge = ev.target.closest && ev.target.closest('.bkc-edge');
    if (!view.contains(ev.target)) return;
    ev.preventDefault();
    const c = cfg();
    if (edge){
      const id = edge.getAttribute('data-edge');
      const e = (c.connections || []).find(x => x.id === id);
      if (!e) return;
      ed.select([], [id]);
      const other = e.toParticipant === 'A' ? 'B' : 'A';
      openMenu(ev.clientX, ev.clientY, [
        { label:'Ver el enfrentamiento de origen', run: () => ed.focusNode(e.fromSlot) },
        { label:'Ver el enfrentamiento de destino', run: () => ed.focusNode(e.toSlot) },
        '-',
        { label:'Pasar al espacio ' + other + ' del destino', run: () => {
            const saved = (c.connections || []).slice();
            CV().disconnect(c, id);
            const err = CV().whyNotConnect(c, e.fromSlot, e.toSlot, other);
            c.connections = saved;
            if (err) return ed.toast(err, 'err');
            ed.push(); CV().disconnect(c, id); CV().connect(c, e.fromSlot, e.toSlot, other); ed.commit();
            ed.toast('La conexión ahora llega al espacio ' + other + '.', 'ok');
          } },
        { label:'El perdedor avanza en vez del ganador', run: () => {
            ed.push(); e.fromOutcome = e.fromOutcome === 'LOSER' ? 'WINNER' : 'LOSER'; ed.commit();
          } },
        '-',
        { label:'Eliminar conexión', danger:true, run: () => {
            const w = CV().canDisconnect(c, id);
            if (w && w.indexOf('CONFIRM:') !== 0) return ed.toast(w, 'err');
            if (w && !confirm(w.slice(8))) return;
            ed.push(); CV().disconnect(c, id); ed.S.selEdges.delete(id); ed.commit();
            ed.toast('Conexión eliminada.', 'ok');
          } }
      ], 'Conexión · ' + CV().nodeLabel(c, e.fromSlot) + ' → ' + CV().nodeLabel(c, e.toSlot));
      return;
    }
    const bandEl = ev.target.closest && ev.target.closest('.bkc-band');
    if (bandEl){
      const bid = bandEl.getAttribute('data-band');
      const b = CV().bandById(c, bid);
      if (!b) return;
      if (!ed.S.selBands.has(bid)) ed.select([], [], [bid]);
      const tone = t => ({ label:'Color: ' + ({ accent:'categoría', flank:'categoría claro', gold:'dorado' })[t],
        disabled: b.tone === t, run: () => { ed.push(); CV().setBand(c, bid, { tone:t }); ed.commit(); } });
      openMenu(ev.clientX, ev.clientY, [
        { label:'Cambiar texto…', run: () => renameBand(bid) },
        tone('accent'), tone('flank'), tone('gold'),
        '-',
        { label:'Duplicar rótulo', run: () => {
            ed.push();
            const nid = CV().addBand(c, Object.assign({}, b, { x:b.x + 40, y:b.y + 40 }));
            ed.commit(); ed.select([], [], [nid]);
          } },
        { label:'Eliminar rótulo', danger:true, run: () => {
            ed.push(); CV().removeBand(c, bid); ed.S.selBands.delete(bid); ed.commit();
            ed.toast('Rótulo eliminado.', 'ok');
          } }
      ], 'Rótulo · ' + (b.text || '—'));
      return;
    }
    if (node){
      const id = node.getAttribute('data-slot');
      if (!ed.S.sel.has(id)) ed.select([id], []);
      const s = c.slots[id];
      if (!s) return;
      const bye = CV().isBye(s);
      const many = ed.S.sel.size > 1;
      openMenu(ev.clientX, ev.clientY, [
        { label:'Editar tarjeta…', run: () => window.BA_SLOT && window.BA_SLOT.openSlot(id) },
        { label:'Cambiar etiqueta…', run: () => {
            const v = prompt('Etiqueta del enfrentamiento:', CV().nodeLabel(c, id));
            if (v == null) return;
            ed.push(); s.label = v.trim() || CV().nodeLabel(c, id); ed.commit();
          } },
        { label: bye ? 'Convertir en enfrentamiento' : 'Convertir en descanso (BYE)', run: () => {
            if (!bye){
              const pb = s.participantB || {};
              if (CV().inAt(c, id, 'B') || (pb.mode && pb.mode !== 'EMPTY'))
                return ed.toast('Un descanso solo tiene un espacio: vacía el espacio B antes de convertirlo en BYE.', 'err');
            }
            ed.push(); s.slotType = bye ? 'MATCH' : 'DIRECT_PASS'; ed.commit();
          } },
        { label:'Duplicar', run: () => {
            ed.push();
            const nid = CV().addNode(c, { x:s.layout.x + 28, y:s.layout.y + 28, dir:s.layout.dir,
              kind: bye ? 'DIRECT_PASS' : 'MATCH', roundId: s.roundId, label: CV().nodeLabel(c, id) + ' (copia)' });
            ed.select([nid], []); ed.commit();
            ed.toast('Nodo duplicado (sin participantes ni conexiones).', 'ok');
          } },
        '-',
        { label:'Voltear la salida del ganador', run: () => ed.flipSelection() },
        { label: s.layout.join !== false ? 'Separar las dos entradas' : 'Unir las entradas en un punto',
          run: () => { ed.push(); s.layout.join = s.layout.join === false; ed.commit(); } },
        { label:'Traer al frente', run: () => { ed.push(); CV().bringToFront(c, [...ed.S.sel]); ed.commit(); } },
        { label:'Enviar al fondo', run: () => { ed.push(); CV().sendToBack(c, [...ed.S.sel]); ed.commit(); } },
        '-',
        { label:'Devolver participantes a la bandeja', disabled: many, run: () => {
            ed.push(); CV().unplace(c, id, 'A'); CV().unplace(c, id, 'B'); ed.commit();
            ed.toast('Espacios vaciados.', 'ok');
          } },
        { label:'Quitar todas sus conexiones', disabled: many, run: () => {
            const ids = CV().inOf(c, id).concat(CV().outOf(c, id)).map(x => x.id);
            if (!ids.length) return ed.toast('Este nodo no tiene conexiones.');
            for (const eid of ids){
              const w = CV().canDisconnect(c, eid);
              if (w && w.indexOf('CONFIRM:') === 0){ if (!confirm(w.slice(8))) return; }
              else if (w) return ed.toast(w, 'err');
            }
            ed.push(); ids.forEach(eid => CV().disconnect(c, eid)); ed.commit();
            ed.toast(ids.length + ' conexión(es) eliminadas.', 'ok');
          } },
        '-',
        { label: many ? 'Eliminar los ' + ed.S.sel.size + ' seleccionados' : 'Eliminar enfrentamiento', danger:true,
          run: () => ed.deleteSelection() }
      ], (many ? ed.S.sel.size + ' nodos · ' : '') + CV().nodeLabel(c, id));
      return;
    }
    const p = toStage(ev);
    openMenu(ev.clientX, ev.clientY, [
      { label:'+ Enfrentamiento aquí', run: () => ed.addNodeAt('MATCH', p.x, p.y) },
      { label:'+ Descanso (BYE) aquí', run: () => ed.addNodeAt('DIRECT_PASS', p.x, p.y) },
      { label:'+ Rótulo aquí', run: () => ed.addBandAt(p.x, p.y) },
      '-',
      { label:'Seleccionar todo', run: () => ed.select(Object.keys(cfg().slots), [], (cfg().canvas.bands || []).map(b => b.id)) },
      { label:'Simetrizar el cuadro', run: () => { ed.push(); CV().symmetrize(cfg()); ed.commit(); ed.toast('Cuadro simetrizado.', 'ok'); } },
      { label:'Ajustar todo a la pantalla', run: () => ed.fitAll() }
    ], 'Lienzo');
  }

  // ── arrastrar participantes (HTML5 DnD) ───────────────────────────────
  function dragPayload(ev){
    let t = '';
    try { t = ev.dataTransfer.getData('text/plain') || ''; } catch(e){ t = window.__bkcDrag || ''; }
    if (!t) t = window.__bkcDrag || '';
    if (t.indexOf('seed:') === 0) return { kind:'seed', rid: t.slice(5) };
    if (t.indexOf('move:') === 0){ const p = t.slice(5).split('|'); return { kind:'move', slot:p[0], side:p[1] }; }
    return { kind:null };
  }
  function onChipDragStart(ev){
    const chip = ev.target.closest && ev.target.closest('.mbk-chip[data-side]');
    if (!chip || chip.getAttribute('draggable') !== 'true') return;
    const payload = 'move:' + chip.dataset.owner + '|' + chip.getAttribute('data-side');
    window.__bkcDrag = payload;
    ev.dataTransfer.setData('text/plain', payload);
    ev.dataTransfer.effectAllowed = 'move';
  }
  function targetChip(ev){
    const chip = ev.target.closest && ev.target.closest('.mbk-chip[data-side]');
    if (!chip) return null;
    const node = chip.closest('.bkc-node');
    if (!node) return null;
    return { chip, id: node.getAttribute('data-slot'), side: chip.getAttribute('data-side') };
  }
  function clearDrops(){
    const st = stage();
    if (st) st.querySelectorAll('.drop-ok,.drop-no').forEach(x => x.classList.remove('drop-ok', 'drop-no'));
  }
  function onDragOver(ev){
    const t = targetChip(ev);
    if (!t) return;
    const p = dragPayload(ev);
    if (!p.kind) return;
    ev.preventDefault();
    clearDrops();
    const err = CV().whyNotPlace(cfg(), t.id, t.side);
    t.chip.classList.add(err ? 'drop-no' : 'drop-ok');
    ev.dataTransfer.dropEffect = err ? 'none' : 'move';
  }
  function onDragLeave(ev){ if (targetChip(ev)) clearDrops(); }
  function onDrop(ev){
    const t = targetChip(ev);
    clearDrops();
    if (!t) return;
    const p = dragPayload(ev);
    if (!p.kind) return;
    ev.preventDefault();
    window.__bkcDrag = '';
    const c = cfg();
    const err = CV().whyNotPlace(c, t.id, t.side);
    if (err) return ed.toast(err, 'err');

    if (p.kind === 'move'){
      if (p.slot === t.id && p.side === t.side) return;
      const src = c.slots[p.slot];
      if (!src) return;
      const who = src['participant' + p.side];
      ed.push();
      const dst = c.slots[t.id]['participant' + t.side];
      const dstBusy = dst && dst.mode && dst.mode !== 'EMPTY';
      CV().place(c, t.id, t.side, who);
      if (dstBusy && CV().whyNotPlace(c, p.slot, p.side) == null) CV().place(c, p.slot, p.side, dst);
      else CV().unplace(c, p.slot, p.side);
      ed.commit();
      ed.toast(dstBusy ? 'Participantes intercambiados.' : 'Participante movido.', 'ok');
      return;
    }
    const row = ed.seedById(p.rid);
    if (!row) return ed.toast('Ese participante ya no está en la bandeja.', 'err');
    const already = CV().placedMap(c).get(String(row.rid));
    if (already && !(already.slotId === t.id && already.side === t.side))
      return ed.toast('«' + row.name + '» ya está sembrado en «' + already.label + '». Muévelo desde ahí para evitar duplicados.', 'err');
    ed.push();
    const part = SEEDS().toParticipant(row, row.origin);
    const r = CV().place(c, t.id, t.side, part);
    if (r.error) return ed.toast(r.error, 'err');
    ed.commit();
    ed.toast('«' + row.name + '» sembrado en «' + CV().nodeLabel(c, t.id) + '» (espacio ' + t.side + ').', 'ok');
  }

  window.BKC_IX = { init, decorate };
})();
