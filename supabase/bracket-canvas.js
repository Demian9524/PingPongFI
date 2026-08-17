// ── Lienzo libre del bracket · MODELO PURO (sin DOM, sin red) ────────────
// Convierte el contrato v1 de bracket-config.js en un GRAFO DIRIGIDO editable
// a mano: cada slot es un nodo con posición propia y las conexiones son las
// aristas «ganador de X → espacio A/B de Y».
//
// Reglas duras (§4 del encargo):
//   · 0 a 2 entradas por nodo, cada una ocupa un espacio distinto (A o B);
//   · un espacio NO puede tener participante sembrado y conexión entrante;
//   · máximo 1 salida por nodo (su ganador);
//   · sin auto-conexiones, sin ciclos, sin duplicar la misma arista;
//   · la final puede tener 0 salidas, los nodos iniciales 0 entradas.
//
// El formato (bracket-topology.js) sigue existiendo, pero aquí es SUGERENCIA:
// genera una distribución inicial que después se edita libremente.
(function(global){
  'use strict';

  const LAYOUT_KEY = 'FREE_CANVAS';
  const NODE_W = 292;
  // Bloque central (placa de campeón + cerdito + subcampeón) y GRAN FINAL:
  // posición canónica, idéntica en TODAS las categorías. Bloqueada por defecto
  // para que el cuadro no quede asimétrico.
  // y=382 deja sitio arriba para la franja de rótulos con la llave por defecto
  // (16 = 4 tarjetas por columna, franja de 720 px centrada con este bloque).
  const CENTER_FIXED = { x:1900, y:382 };
  const CENTER_W = 344;
  // Alto real del bloque central del lienzo (.bkc-center: rótulo + placa + hueco
  // de la gran final + subcampeón + cerdito).
  const CENTER_H = 325;
  // Puerquito dorado del cuadro: adorno colocable desde el editor. `w` es su
  // ancho en el lienzo (es cuadrado) y x/y se derivan del bloque central
  // mientras el organizador no lo mueva a mano.
  const PIGGY_W = 150;
  // Hueco libre entre la franja de rótulos de ronda (acaba en y≈245) y el
  // bloque central (y=382): la posición automática centra el adorno ahí.
  const PIGGY_SLOT_H = 137;
  // Reparto de columnas COPIADO del bracket publicado (torneo-bracket-render):
  // hueco 26/32/40 px según cuántas columnas haya, 60 px entre tarjetas de la
  // misma columna, 6 px de respiro y una franja de 397 px de alto.
  const colGap = n => n > 7 ? 26 : n > 5 ? 32 : 40;
  const COL_VGAP = 60, COL_PAD = 6, BAND_HEIGHT = 397;
  const FINAL_OFFSET = { dx:26, dy:148 };
  const clone = o => JSON.parse(JSON.stringify(o));
  const CFG  = () => global.SB_BRACKETCFG;
  const TOPO = () => global.FI_BKT_TOPO;
  // ── cuadro por defecto ─────────────────────────────────────────────────
  // El mismo en TODAS las categorías y con cualquier número de inscritos:
  // llave de 16 (OCTAVOS → CUARTOS → SEMIFINAL → GRAN FINAL), sin ronda de
  // acceso. Quién descansa y quién juega se pone a mano sobre este cuadro.
  const DEFAULT_FORMAT = { bracketSize:16, mainRound:'ROUND_OF_16',
    hasAccessRound:false, accessMatchCount:0, directPassCount:0 };
  const defaultPlan = () => { const T = TOPO(); return T ? T.buildPlan(DEFAULT_FORMAT) : null; };

  function isFree(cfg){ return !!(cfg && (cfg.layoutKey === LAYOUT_KEY || cfg.layout === LAYOUT_KEY)); }

  function defaults(){
    return { width:3260, height:1500, grid:{ on:true, size:20 }, snap:true, guides:true,
             center:{ x:CENTER_FIXED.x, y:CENTER_FIXED.y, visible:true, locked:true }, order:[] };
  }

  // ¿el bloque central y la final están fijos? (por defecto sí)
  function centerLocked(cfg){
    return !cfg || !cfg.canvas || !cfg.canvas.center || cfg.canvas.center.locked !== false;
  }
  // Devuelve el bloque central y la GRAN FINAL a su posición canónica.
  function pinCenter(cfg){
    if (!cfg || !cfg.canvas) return cfg;
    const c = cfg.canvas.center || (cfg.canvas.center = {});
    c.x = CENTER_FIXED.x; c.y = CENTER_FIXED.y;
    const f = cfg.slots && cfg.slots.final;
    if (f){
      f.layout = f.layout || { dir:'LR' };
      f.layout.x = CENTER_FIXED.x + FINAL_OFFSET.dx;
      f.layout.y = CENTER_FIXED.y + FINAL_OFFSET.dy;
      f.layout.pinned = true;
    }
    return cfg;
  }
  // ¿este nodo no se puede mover ahora mismo?
  function isPinned(cfg, id){
    const s = cfg && cfg.slots && cfg.slots[id];
    return !!(s && s.layout && s.layout.pinned && centerLocked(cfg));
  }

  // ── restos de estructuras anteriores («bloques fantasma») ─────────────
  // Al cambiar el formato, applyPlan marca outOfPlan los slots que dejan de
  // existir. Si se conservan, el editor los pinta traslúcidos encima del cuadro
  // vigente y además ensucian la validación. Se borran salvo que guarden algo
  // irrecuperable (partido oficial o resultado capturado a mano).
  function hasCapture(s){
    return !!(s && (s.officialMatchId || s.manualWinnerSlot || s.manualScoreA != null || s.manualScoreB != null));
  }
  function isSeeded(s){
    const a = (s && s.participantA) || {}, b = (s && s.participantB) || {};
    return !!((a.mode && a.mode !== 'EMPTY') || (b.mode && b.mode !== 'EMPTY'));
  }
  function dropSlot(cfg, id){
    delete cfg.slots[id];
    if (cfg.canvas && Array.isArray(cfg.canvas.order)) cfg.canvas.order = cfg.canvas.order.filter(x => x !== id);
    cfg.connections = (cfg.connections || []).filter(c => c.fromSlot !== id && c.toSlot !== id);
    ['champion','runnerUp'].forEach(k => { if (cfg[k] && cfg[k].sourceSlot === id) cfg[k].sourceSlot = null; });
  }
  // planIds != null → barrido explícito (reconstruir desde el formato): también
  // se llevan los ocultos que quedaron fuera del plan, y los sembrados vuelven
  // a la bandeja. Sin plan (cada ensure) solo se van los vacíos marcados.
  function sweepGhosts(cfg, planIds){
    const removed = [], kept = [];
    if (!cfg || !cfg.slots) return { removed, kept };
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s) return;
      const known = !!(TOPO() && TOPO().meta && TOPO().meta(id));
      const stale = s.outOfPlan === true || (planIds && known && !planIds.has(id) && s.visible === false);
      if (!stale) return;
      if (hasCapture(s) || (!planIds && isSeeded(s))){ kept.push(id); return; }
      dropSlot(cfg, id); removed.push(id);
    });
    return { removed, kept };
  }

  // ── geometría del nodo (única fuente) ──────────────────────────────────
  // ── geometría OFICIAL de la tarjeta ────────────────────────────────────
  // La etiqueta del nodo ya NO ocupa sitio: es chrome del editor y flota sobre
  // la tarjeta. Así el lienzo dibuja exactamente la misma tarjeta que el
  // bracket en columnas: fila 56 + banda VS 20 + fila 56 = 132 px. Un descanso
  // cambia la segunda fila por el rótulo de pase directo (72 px) y la gran
  // final usa las filas grandes del bloque central (64 + 20 + 64 = 148 px).
  // inA / inB = centro exacto de cada fila (los mismos números que los puertos).
  const GEO = {
    match: { h:132, inA:28, inB:104 },
    bye:   { h:72,  inA:28, inB:28  },
    final: { h:148, inA:32, inB:116 }
  };
  const NODE_H = GEO.match.h, BYE_H = GEO.bye.h, FINAL_H = GEO.final.h;
  function kindOf(cfg, id){
    if (id === 'final') return 'final';
    return isBye(cfg && cfg.slots && cfg.slots[id]) ? 'bye' : 'match';
  }
  const geoOf = (cfg, id) => GEO[kindOf(cfg, id)];
  const heightOf = (cfg, id) => geoOf(cfg, id).h;
  const outDy = (cfg, id) => geoOf(cfg, id).h / 2;
  const inDy = (cfg, id, side) => geoOf(cfg, id)[side === 'B' ? 'inB' : 'inA'];

  // ── migración 196 → 292 px ─────────────────────────────────────────────
  // Los cuadros guardados antes de la piel oficial se dibujaron con tarjetas de
  // 196×98 px: con la geometría vigente las columnas se solapaban y había que
  // pulsar «Simetrizar» a mano en cada categoría. Esto lo reescala al abrir,
  // CONSERVANDO el hueco que dejó el organizador entre columnas y entre
  // partidos: cada lado se ancla por su columna interior al bloque central y
  // cada columna mantiene su centro vertical. Después se simetriza para que las
  // líneas vuelvan a salir rectas. Idempotente: en cuanto no hay solapes con
  // 292 px, no se vuelve a tocar nada.
  const OLDG = { w:196, h:98, bye:72 };
  let migrating = false;
  function columnsOf(cfg){
    const byX = {};
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || !s.layout) return;
      if (s.layout.pinned && centerLocked(cfg)) return;
      const kx = Math.round(s.layout.x / 8) * 8;
      (byX[kx] || (byX[kx] = [])).push(id);
    });
    return byX;
  }
  // ── colocación sin encimar ─────────────────────────────────────────────
  // Un nodo que llega SIN posición (lo crea el plan, una importación o el
  // botón «+ enfrentamiento») no puede caer sobre otro: se busca el primer
  // hueco libre bajando por la columna y saltando a la siguiente cuando se
  // llena. Antes se repartían en una rejilla de 240x130 px — más estrecha que
  // la propia tarjeta (292x132), así que TODOS se encimaban.
  const PACK_GAPX = colGap(7), PACK_GAPY = COL_VGAP, PACK_TOP = 210;
  function occupied(cfg, skipId){
    const out = [];
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (id === skipId || !s || !s.layout) return;
      if (s.layout.pinned) return;                 // la gran final vive dentro del bloque central
      if (!Number.isFinite(s.layout.x) || !Number.isFinite(s.layout.y)) return;
      out.push({ x:s.layout.x, y:s.layout.y, w:NODE_W, h:heightOf(cfg, id) });
    });
    const c = cfg.canvas && cfg.canvas.center;
    if (c && c.visible !== false)
      out.push({ x:Number(c.x) || 0, y:Number(c.y) || 0, w:CENTER_W, h:CENTER_H });
    return out;
  }
  function overlaps(r, list){
    return list.some(o => r.x < o.x + o.w + 24 && o.x < r.x + r.w + 24 &&
                          r.y < o.y + o.h + 16 && o.y < r.y + r.h + 16);
  }
  // Retícula REAL del dibujo: una entrada por columna (x) con las tarjetas que
  // viven en ella. El paso de columna se MIDE del propio cuadro (hueco más
  // pequeño entre columnas contiguas del mismo lado; el salto del bloque central
  // no cuenta), así que un nodo nuevo entra con la misma distancia que el resto.
  function lattice(cfg, skipId){
    const cols = {};
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (id === skipId || !s || !s.layout || s.visible === false || s.layout.pinned) return;
      if (!Number.isFinite(s.layout.x) || !Number.isFinite(s.layout.y)) return;
      const x = Math.round(s.layout.x);
      (cols[x] = cols[x] || []).push({ y:Math.round(s.layout.y), h:heightOf(cfg, id) });
    });
    const xs = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const c = cfg.canvas && cfg.canvas.center;
    const axis = (c && Number.isFinite(Number(c.x)) ? Number(c.x) : CENTER_FIXED.x) + CENTER_W / 2;
    const side = x => x + NODE_W / 2 < axis;
    let step = 0;
    for (let i = 1; i < xs.length; i++){
      const d = xs[i] - xs[i - 1];
      if (d < NODE_W + 8 || side(xs[i - 1]) !== side(xs[i])) continue;
      step = step ? Math.min(step, d) : d;
    }
    if (!step) step = NODE_W + colGap(xs.length + 2);
    return { cols, xs, step, axis, side,
      midY: (c && Number.isFinite(Number(c.y)) ? Number(c.y) : CENTER_FIXED.y) + CENTER_H / 2 };
  }
  // Hueco libre para una tarjeta de alto h. Sin punto pedido, el nodo entra en la
  // retícula del cuadro: columna nueva por fuera del lado con menos columnas y
  // centrada con el bloque central; si esa columna ya tiene tarjetas, se apila
  // con los mismos 60 px de separación.
  function freeSpot(cfg, h, prefer){
    prefer = prefer || {};
    const list = occupied(cfg, prefer.skipId);
    if (!Number.isFinite(prefer.x) && !Number.isFinite(prefer.y)){
      const L = lattice(cfg, prefer.skipId);
      const gap = L.step - NODE_W;
      const mid = Math.round(L.midY - h / 2);
      const left = L.xs.filter(L.side), right = L.xs.filter(x => !L.side(x));
      const growL = Math.round(left.length ? Math.min.apply(null, left) - L.step
        : L.axis - CENTER_W / 2 - gap - NODE_W);
      const growR = Math.round(right.length ? Math.max.apply(null, right) + L.step
        : L.axis + CENTER_W / 2 + gap);
      const cand = [];
      const sorted = L.xs.slice().sort((a, b) => a - b);
      const oL = left.length ? Math.min.apply(null, left) : null;
      const iL = left.length > 1 ? sorted.filter(L.side)[1] : null;
      const oR = right.length ? Math.max.apply(null, right) : null;
      const iR = right.length > 1 ? sorted.filter(x => !L.side(x)).slice(-2)[0] : null;
      // La fase que se está armando se rellena en su columna (con los mismos
      // 60 px) mientras tenga menos tarjetas que la columna de al lado; cuando se
      // iguala, la siguiente abre columna nueva por fuera.
      const room = (o, i) => o != null && i != null && (L.cols[o] || []).length < (L.cols[i] || []).length;
      const add = (o, i, grow) => { if (room(o, i)) cand.push(o); cand.push(grow); };
      // el lado que crece es el que tiene menos tarjetas (empate: menos columnas)
      const cards = arr => arr.reduce((n, x) => n + (L.cols[x] || []).length, 0);
      const nl = cards(left), nr = cards(right);
      if (nl < nr || (nl === nr && left.length <= right.length)){ add(oL, iL, growL); add(oR, iR, growR); }
      else { add(oR, iR, growR); add(oL, iL, growL); }
      L.xs.slice()
        .sort((a, b) => Math.abs(b + NODE_W / 2 - L.axis) - Math.abs(a + NODE_W / 2 - L.axis))
        .forEach(x => cand.push(x));
      cand.push(growL - L.step, growR + L.step);
      for (let i = 0; i < cand.length; i++){
        const x = cand[i];
        const col = (L.cols[x] || []).slice().sort((a, b) => a.y - b.y);
        const ys = [mid];
        if (col.length){
          ys.push(Math.round(Math.max.apply(null, col.map(k => k.y + k.h)) + COL_VGAP));
          ys.push(Math.round(Math.min.apply(null, col.map(k => k.y)) - COL_VGAP - h));
          for (let k = 1; k < col.length; k++) ys.push(Math.round(col[k - 1].y + col[k - 1].h + COL_VGAP));
        }
        for (let j = 0; j < ys.length; j++)
          if (!overlaps({ x, y:ys[j], w:NODE_W, h }, list)) return { x, y:ys[j] };
      }
    }
    const x0 = Number.isFinite(prefer.x) ? Math.round(prefer.x) : CENTER_FIXED.x - (NODE_W + PACK_GAPX) * 3;
    const y0 = Number.isFinite(prefer.y) ? Math.round(prefer.y) : PACK_TOP;
    for (let cx = 0; cx < 30; cx++){
      const x = x0 + cx * (NODE_W + PACK_GAPX);
      for (let y = y0; y < y0 + 2600; y += h + PACK_GAPY)
        if (!overlaps({ x, y, w:NODE_W, h }, list)) return { x, y };
    }
    return { x:x0, y:y0 };
  }

  // Reparte las tarjetas de UNA columna con la geometría del cuadro publicado
  // (`space-around` sobre la franja de 397 px centrada con el bloque central):
  // los mismos números que `layoutFromPlan`, para que una fase armada a mano
  // quede a la misma altura y con la misma separación que las demás.
  function distributeColumn(cfg, x){
    ensure(cfg);
    const at = Math.round(x);
    const ids = Object.keys(cfg.slots).filter(id => {
      const s = cfg.slots[id];
      return s && s.layout && s.visible !== false && !s.layout.pinned && Math.round(s.layout.x) === at;
    }).sort((a, b) => cfg.slots[a].layout.y - cfg.slots[b].layout.y);
    const k = ids.length;
    if (!k) return cfg;
    const c = cfg.canvas.center;
    const cy = c && Number.isFinite(Number(c.y)) ? Number(c.y) : CENTER_FIXED.y;
    const hs = ids.map(id => heightOf(cfg, id));
    const sum = hs.reduce((a, b) => a + b, 0);
    // La franja la marca el DIBUJO (la columna con más tarjetas), no esta columna:
    // así 2 tarjetas caen a la altura de cuartos y 4 a la de octavos.
    const rows = drawColumns(cfg).reduce((m, col) => Math.max(m, (col.ids || []).length), k);
    const totalH = Math.max(BAND_HEIGHT, rows * NODE_H + (rows - 1) * COL_VGAP + COL_PAD * 2);
    const TOP = Math.round(cy - (totalH - CENTER_H) / 2);
    const free = totalH - COL_PAD * 2 - sum - (k - 1) * COL_VGAP;
    let acc = 0;
    ids.forEach((id, i) => {
      cfg.slots[id].layout.y = Math.round(TOP + COL_PAD + acc + i * COL_VGAP + (2 * i + 1) * free / (2 * k));
      acc += hs[i];
    });
    return cfg;
  }

  function needsRescale(cfg){
    if (!cfg || !cfg.slots || !cfg.canvas) return false;
    if (Number(cfg.canvas.nodeW) === NODE_W) return false;
    const xs = Object.keys(columnsOf(cfg)).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++){
      const tight = xs[i] - (xs[i - 1] + NODE_W) < 60;      // ahogado con la tarjeta nueva
      const wasOk = xs[i] - (xs[i - 1] + OLDG.w) >= 60;     // holgado con la vieja
      if (tight && wasOk) return true;
    }
    return false;
  }
  function rescaleGeometry(cfg){
    const byX = columnsOf(cfg);
    const xs = Object.keys(byX).map(Number);
    if (!xs.length) return cfg;
    const axis = (cfg.canvas.center && cfg.canvas.center.x != null ? cfg.canvas.center.x : 0) + CENTER_W / 2;
    const L = xs.filter(x => x + OLDG.w / 2 <  axis).sort((a, b) => b - a);   // de dentro hacia fuera
    const R = xs.filter(x => x + OLDG.w / 2 >= axis).sort((a, b) => a - b);
    let prev = null;
    L.forEach((x, i) => {
      const nx = i === 0 ? x + OLDG.w - NODE_W
                         : prev - Math.max(0, L[i - 1] - (x + OLDG.w)) - NODE_W;
      byX[x].forEach(id => cfg.slots[id].layout.x = Math.round(nx));
      prev = nx;
    });
    prev = null;
    R.forEach((x, i) => {
      const nx = i === 0 ? x : prev + NODE_W + Math.max(0, x - (R[i - 1] + OLDG.w));
      byX[x].forEach(id => cfg.slots[id].layout.x = Math.round(nx));
      prev = nx;
    });
    xs.forEach(x => byX[x].forEach(id => {
      const s = cfg.slots[id], old = isBye(s) ? OLDG.bye : OLDG.h;
      s.layout.y = Math.round(s.layout.y + (old - heightOf(cfg, id)) / 2);
    }));
    let x2 = 0, y2 = 0;
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || !s.layout) return;
      x2 = Math.max(x2, s.layout.x + NODE_W);
      y2 = Math.max(y2, s.layout.y + heightOf(cfg, id));
    });
    cfg.canvas.width = Math.max(cfg.canvas.width || 0, Math.round(x2) + 60, CENTER_FIXED.x + CENTER_W + 60);
    cfg.canvas.height = Math.max(cfg.canvas.height || 0, Math.round(y2) + 160);
    return cfg;
  }

  // Completa lo que falte sin tocar lo capturado. Idempotente.
  function ensure(cfg){
    if (!cfg) return cfg;
    const d = defaults();
    cfg.canvas = Object.assign(d, cfg.canvas || {});
    cfg.canvas.grid = Object.assign({ on:true, size:20 }, cfg.canvas.grid || {});
    if (cfg.canvas.guides !== false) cfg.canvas.guides = true;
    cfg.canvas.center = Object.assign({ x:d.center.x, y:d.center.y, visible:true, locked:true }, cfg.canvas.center || {});
    if (cfg.canvas.center.locked === undefined) cfg.canvas.center.locked = true;
    cfg.canvas.piggy = Object.assign({ visible:true, w:PIGGY_W, x:null, y:null }, cfg.canvas.piggy || {});
    cfg.canvas.width = Math.max(900, Number(cfg.canvas.width) || d.width);
    cfg.canvas.height = Math.max(600, Number(cfg.canvas.height) || 1500);
    cfg.slots = cfg.slots || {};
    if (!Array.isArray(cfg.canvas.order)) cfg.canvas.order = [];
    sweepGhosts(cfg, null);
    const fresh = [];
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || typeof s !== 'object'){ delete cfg.slots[id]; return; }
      const had = s.layout && Number.isFinite(Number(s.layout.x)) && Number.isFinite(Number(s.layout.y));
      s.layout = Object.assign({ dir:'LR' }, s.layout || {});
      if (!had && id === 'final'){
        s.layout.x = CENTER_FIXED.x + FINAL_OFFSET.dx; s.layout.y = CENTER_FIXED.y + FINAL_OFFSET.dy;
      } else if (!had){
        fresh.push(id);
        const spot = freeSpot(cfg, GEO[kindOf(cfg, id)].h, { skipId:id });
        s.layout.x = spot.x; s.layout.y = spot.y;
      }
      s.layout.x = Math.round(Number(s.layout.x) || 0);
      s.layout.y = Math.round(Number(s.layout.y) || 0);
      s.layout.dir = s.layout.dir === 'RL' ? 'RL' : 'LR';
      if (s.layout.inA !== 'L' && s.layout.inA !== 'R') s.layout.inA = s.layout.dir === 'RL' ? 'R' : 'L';
      // la final del cuadro espejo recibe por los dos lados (convergencia)
      if (s.layout.inB !== 'L' && s.layout.inB !== 'R')
        s.layout.inB = id === 'final' ? (s.layout.dir === 'RL' ? 'L' : 'R') : (s.layout.dir === 'RL' ? 'R' : 'L');
      if (s.layout.join !== false) s.layout.join = true;
      if (!s.label) s.label = labelOf(id, s);
      if (cfg.canvas.order.indexOf(id) < 0) cfg.canvas.order.push(id);
    });
    cfg.canvas.order = cfg.canvas.order.filter((id, i, a) => cfg.slots[id] && a.indexOf(id) === i);
    // El servidor exige que cada roundId usado por un slot exista en
    // cfg.rounds (ROUND_NOT_FOUND). El lienzo libre no pasa por
    // TOPO.applyPlan(), así que un borrador guardado antes de este fix (o uno
    // creado sembrando nodos de una ronda nueva) puede tener slots cuyo
    // roundId nunca se agregó a cfg.rounds: se completa aquí, sin tocar
    // posiciones ni lo ya guardado.
    if (!Array.isArray(cfg.rounds)) cfg.rounds = [];
    const roundIds = new Set(cfg.rounds.map(r => r && r.id));
    const T = TOPO();
    Object.keys(cfg.slots).forEach(id => {
      const rid = cfg.slots[id] && cfg.slots[id].roundId;
      if (!rid || roundIds.has(rid)) return;
      roundIds.add(rid);
      cfg.rounds.push({ id: rid, type: (T && T.ROUND_TYPE && T.ROUND_TYPE[rid]) || 'MATCH',
        label: (T && T.ROUND_LABEL && T.ROUND_LABEL[rid]) || String(rid).toUpperCase(),
        visible: true, displayOrder: cfg.rounds.length + 1 });
    });
    // Estructura recién creada (ningún nodo traía posición): se dibuja con el
    // reparto del formato en vez de apilarla en una columna.
    if (!migrating && fresh.length > 1 && fresh.length >= Object.keys(cfg.slots).length - 1)
      redrawDefault(cfg);
    cfg.connections = (cfg.connections || []).filter(c =>
      c && cfg.slots[c.fromSlot] && cfg.slots[c.toSlot] && c.fromSlot !== c.toSlot);
    cfg.connections.forEach((c, i) => {
      if (!c.id) c.id = 'e' + (i + 1) + '-' + c.fromSlot;
      c.fromOutcome = c.fromOutcome === 'LOSER' ? 'LOSER' : 'WINNER';
      c.toParticipant = c.toParticipant === 'B' ? 'B' : 'A';
    });
    if (cfg.slots.final && cfg.slots.final.layout.pinned === undefined) cfg.slots.final.layout.pinned = true;
    if (centerLocked(cfg)) pinCenter(cfg);
    if (!migrating && needsRescale(cfg)){
      migrating = true;
      cfg.canvas.nodeW = NODE_W;          // primero el sello: evita reentrar
      try { rescaleGeometry(cfg); symmetrize(cfg); } finally { migrating = false; }
    } else if (cfg.canvas.nodeW !== NODE_W) cfg.canvas.nodeW = NODE_W;
    migrateGeo(cfg);
    ensureBands(cfg);
    return cfg;
  }

  // ── migración 2 · la etiqueta sale del flujo y el cuadro baja ──────────
  // Hasta la revisión 1 la etiqueta del nodo medía 22 px DENTRO de la tarjeta y
  // el bloque central vivía en y=80, sin sitio para los rótulos de ronda. Ahora
  // la tarjeta empieza en el borde del nodo y todo el cuadro baja 140 px para
  // dejar la franja de rótulos arriba. Se corrige UNA vez y queda sellado.
  const GEO_REV = 7, LABEL_H_OLD = 22, HEADER_SHIFT = 140;
  // ¿hay tarjetas encimadas? (nodos visibles, sin contar la final anclada) o
  // alguna tarjeta encima del bloque central: en el cuadro bueno nunca pasa,
  // así que es la señal de que el borrador viene con la geometría estrecha.
  function hasOverlap(cfg){
    const ids = Object.keys(cfg.slots).filter(id =>
      cfg.slots[id] && cfg.slots[id].layout && cfg.slots[id].visible !== false && !cfg.slots[id].layout.pinned);
    const c = cfg.canvas && cfg.canvas.center;
    const box = c && c.visible !== false
      ? { x:Number(c.x) || 0, y:Number(c.y) || 0, w:CENTER_W, h:CENTER_H } : null;
    for (let i = 0; i < ids.length; i++){
      const a = cfg.slots[ids[i]].layout, ah = heightOf(cfg, ids[i]);
      if (box && a.x < box.x + box.w && box.x < a.x + NODE_W && a.y < box.y + box.h && box.y < a.y + ah) return true;
      for (let j = i + 1; j < ids.length; j++){
        const b = cfg.slots[ids[j]].layout, bh = heightOf(cfg, ids[j]);
        if (a.x < b.x + NODE_W && b.x < a.x + NODE_W && a.y < b.y + bh && b.y < a.y + ah) return true;
      }
    }
    return false;
  }
  // Un borrador solo se intenta reparar UNA vez por sesión: si tras redibujarlo
  // sigue encimado (sin formato utilizable, p. ej.) no se reintenta en cada
  // `ensure`, que se llama en cada render.
  const repaired = typeof WeakSet === 'function' ? new WeakSet() : null;
  // Redibuja el cuadro con la llave por defecto. Los nodos hechos a mano que el
  // plan no conoce NO se borran (pueden llevar gente sembrada): entran en la
  // retícula, en una columna por fuera, repartidos como una columna del cuadro.
  function redrawDefault(cfg, opts){
    const plan = defaultPlan();
    if (!plan) return false;
    const was = migrating;
    migrating = true;
    try {
      // el cuadro por defecto se ve COMPLETO: las tarjetas que un formato menor
      // había ocultado vuelven a la vista.
      (plan.slots || []).forEach(s => { if (cfg.slots[s.id]) cfg.slots[s.id].visible = true; });
      layoutFromPlan(cfg, plan, { rebuildEdges: !!(opts && opts.rebuildEdges), sweep:false });
      const known = {};
      (plan.slots || []).forEach(s => { known[s.id] = 1; });
      // sin reconstruir aristas, se AÑADEN las que falten (octavos → cuartos):
      // lo ya cableado a mano no se toca.
      if (!(opts && opts.rebuildEdges)){
        cfg.connections = cfg.connections || [];
        (plan.connections || []).forEach(e => {
          const taken = cfg.connections.some(o => o.toSlot === e.toSlot && o.toParticipant === e.toParticipant);
          if (!taken) cfg.connections.push(Object.assign({}, e, { enabled:true }));
        });
      }
      const extra = Object.keys(cfg.slots).filter(id => !known[id] && cfg.slots[id] &&
        cfg.slots[id].layout && cfg.slots[id].visible !== false && !cfg.slots[id].layout.pinned);
      const touched = {};
      extra.forEach(id => {
        const spot = freeSpot(cfg, heightOf(cfg, id), { skipId:id });
        cfg.slots[id].layout.x = spot.x; cfg.slots[id].layout.y = spot.y;
        touched[spot.x] = 1;
      });
      Object.keys(touched).forEach(x => distributeColumn(cfg, Number(x)));
      if (extra.length) seedBands(cfg, plan);
    } catch (e){ migrating = was; return false; }
    migrating = was;
    return true;
  }
  function migrateGeo(cfg){
    const rev = Number(cfg.canvas.geo) || 0;
    // El sello puede estar al día y la geometría no: los borradores guardados
    // por una versión intermedia quedaron sellados con las columnas encimadas.
    const broken = rev >= GEO_REV && !(repaired && repaired.has(cfg)) && hasOverlap(cfg);
    if (broken && repaired) repaired.add(cfg);
    if (rev >= GEO_REV && !broken) return cfg;
    if (rev < 2){
      const dy = LABEL_H_OLD + HEADER_SHIFT;
      Object.keys(cfg.slots).forEach(id => {
        const L = cfg.slots[id] && cfg.slots[id].layout;
        if (L) L.y = Math.round(L.y + dy);
      });
      if (cfg.canvas.center && !centerLocked(cfg)) cfg.canvas.center.y = Math.round(cfg.canvas.center.y + dy);
      (cfg.canvas.bands || []).forEach(b => { b.y = Math.round(b.y + dy); });
      cfg.canvas.height = Math.round((cfg.canvas.height || 0) + dy);
    }
    // rev 3: los rótulos se reparten por las columnas REALES del dibujo, así que
    // los repartidos con el orden del formato (que se encimaban) se rehacen.
    if (rev < 3) cfg.canvas.bands = null;
    // rev 4: las tarjetas nuevas caían en una rejilla más estrecha que ellas y
    //        quedaban amontonadas.
    // rev 5: el lienzo usaba columnas separadas 120 px y filas de 206 px, muy
    //        lejos del cuadro publicado. Ahora la geometría por defecto es la
    //        de PruebaBracketPiel (hueco 32 px, 60 px entre tarjetas, franja de
    //        397 px), así que el borrador se redibuja una vez con esas medidas.
    // rev 6: el reparto por defecto es el de PruebaEditorLlaves (la geometría
    //        de la piel publicada). Los borradores anteriores —incluidos los
    //        sellados a medio camino— se redibujan una vez con esas medidas.
    // rev 7: el cuadro por defecto es SIEMPRE la llave de 16 (octavos → final),
    //        con el bloque central en su nueva altura canónica.
    if ((rev < 7 || broken) && !migrating) redrawDefault(cfg);
    cfg.canvas.geo = GEO_REV;
    if (centerLocked(cfg)) pinCenter(cfg);
    return cfg;
  }

  // ── rótulos del cuadro (encabezados de ronda + banda del sistema) ──────
  // Son elementos de primera clase del lienzo: se mueven, se renombran y se
  // borran como los nodos. Cada rótulo de ronda va ANCLADO a los
  // enfrentamientos de su columna (`anchor`): si esos nodos se mueven, se
  // simetrizan o se redistribuyen, el rótulo va con ellos. `dx`/`dy` guardan el
  // desplazamiento que le diste a mano, así que el ajuste fino se respeta.
  const BAND_W = NODE_W, BAND_H = 40, BAND_GAP = 44, SYS_GAP = 52;
  const bandById = (cfg, id) => (cfg.canvas.bands || []).find(b => b.id === id) || null;
  function nextBandId(cfg){ let n = 1; while (bandById(cfg, 'b' + n)) n++; return 'b' + n; }
  const normBand = b => ({
    id: String(b.id), kind: b.kind === 'sys' ? 'sys' : 'round',
    text: b.text == null ? '' : String(b.text), sub: b.sub == null ? '' : String(b.sub),
    x: Math.round(Number(b.x) || 0), y: Math.round(Number(b.y) || 0),
    w: Math.round(Number(b.w) || 0),
    anchor: b.anchor === 'center' || b.anchor === 'all' ? b.anchor
      : Array.isArray(b.anchor) ? b.anchor.filter(x => typeof x === 'string') : null,
    dx: Math.round(Number(b.dx) || 0), dy: Math.round(Number(b.dy) || 0),
    tone: ['accent','flank','gold'].indexOf(b.tone) >= 0 ? b.tone : 'accent' });
  function ensureBands(cfg){
    if (Array.isArray(cfg.canvas.bands)){
      cfg.canvas.bands = cfg.canvas.bands.filter(b => b && b.id).map(normBand);
      adoptBands(cfg);
      return cfg;
    }
    cfg.canvas.bands = [];
    try {
      const plan = TOPO() && TOPO().buildPlan(cfg.format);
      if (plan) seedBands(cfg, plan);
    } catch(e){}
    return cfg;
  }

  // Columnas reales del dibujo: los nodos visibles agrupados por su x.
  function drawColumns(cfg){
    const byX = {};
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || !s.layout || s.visible === false) return;
      const kx = Math.round(s.layout.x / 24) * 24;
      (byX[kx] || (byX[kx] = [])).push(id);
    });
    return Object.keys(byX).map(Number).sort((a, b) => a - b).map(kx => ({ kx, ids: byX[kx] }));
  }
  // Rótulos viejos (guardados sin ancla): se adoptan a la columna que tienen
  // debajo, conservando el desplazamiento con el que quedaron.
  function adoptBands(cfg){
    const list = cfg.canvas.bands || [];
    if (!list.some(b => !b.anchor)) return cfg;
    const cols = drawColumns(cfg);
    if (!cols.length) return cfg;
    list.forEach(b => {
      if (b.anchor) return;
      if (b.kind === 'sys'){ b.anchor = 'all'; b.dx = 0; b.dy = 0; return; }
      const bw = b.w || BAND_W;
      let best = null;
      cols.forEach(col => {
        if (col.ids.indexOf('final') >= 0) return;
        const x = Math.min.apply(null, col.ids.map(id => cfg.slots[id].layout.x));
        const d = Math.abs((x + NODE_W / 2) - (b.x + bw / 2));
        if (!best || d < best.d) best = { d, x, ids: col.ids };
      });
      const c = cfg.canvas.center;
      if (c && c.visible !== false){
        const cx = (Number(c.x) || 0) + CENTER_W / 2;
        const d = Math.abs(cx - (b.x + bw / 2));
        if (!best || d < best.d){ b.anchor = 'center'; b.dx = 0; b.dy = 0; return; }
      }
      if (!best || best.d > NODE_W) return;              // suelto de verdad: se queda libre
      b.anchor = best.ids.slice();
      b.dx = 0; b.dy = 0;
    });
    return reflowBands(cfg);
  }

  // Posición que le toca a un rótulo por su ancla (sin el ajuste manual).
  // La X la manda la columna; la Y es común a todos, como en el bracket
  // publicado, donde los encabezados van en una sola fila.
  function bandBase(cfg, b, ctx){
    if (!b || !b.anchor) return null;
    ctx = ctx || bandCtx(cfg);
    if (ctx.top === Infinity) return null;
    if (b.kind === 'sys' || b.anchor === 'all')
      return { x: ctx.left, y: Math.round(ctx.top - BAND_GAP - BAND_H - SYS_GAP) };
    const y = Math.round(ctx.top - BAND_GAP - BAND_H);
    if (b.anchor === 'center'){
      const c = cfg.canvas.center;
      if (!c || c.visible === false) return null;
      return { x: Math.round((Number(c.x) || 0) + (CENTER_W - (b.w || BAND_W)) / 2), y };
    }
    const ids = b.anchor.filter(id => cfg.slots[id] && cfg.slots[id].layout && cfg.slots[id].visible !== false);
    if (!ids.length) return null;
    return { x: Math.round(Math.min.apply(null, ids.map(id => cfg.slots[id].layout.x))), y };
  }
  function bandCtx(cfg){
    let top = Infinity, left = Infinity;
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || !s.layout || s.visible === false) return;
      top = Math.min(top, s.layout.y); left = Math.min(left, s.layout.x);
    });
    const c = cfg.canvas.center;
    if (c && c.visible !== false){
      top = Math.min(top, Number(c.y) || 0); left = Math.min(left, Number(c.x) || 0);
    }
    return { top, left };
  }
  // Recoloca TODOS los rótulos anclados sobre su columna. Idempotente: se puede
  // llamar en cada repintado sin que nada se mueva de más.
  function reflowBands(cfg){
    const list = cfg.canvas.bands || [];
    if (!list.length) return cfg;
    const ctx = bandCtx(cfg);
    const moved = [];
    list.forEach(b => {
      const base = bandBase(cfg, b, ctx);
      if (!base) return;
      b.x = base.x + (Number(b.dx) || 0);
      b.y = base.y + (Number(b.dy) || 0);
      moved.push(b);
    });
    // columnas muy juntas: los encabezados que se tocarían suben en escalera,
    // pero solo los que no tocaste a mano.
    const row = moved.filter(b => b.kind !== 'sys' && !b.dy).sort((a, b) => a.x - b.x);
    row.forEach((b, i) => {
      const prev = row[i - 1];
      if (prev && b.x < prev.x + (prev.w || BAND_W) - 8) b.y = prev.y - BAND_H - 8;
    });
    const sys = moved.find(b => b.kind === 'sys' && !b.dy);
    if (sys && row.length)
      sys.y = Math.round(Math.min.apply(null, row.map(b => b.y)) - SYS_GAP);
    return cfg;
  }
  // Un rótulo por COLUMNA REAL del dibujo (los nodos se agrupan por su x), no
  // por el orden del formato. Cada uno queda ANCLADO a los enfrentamientos de
  // esa columna, así que después sigue a sus nodos donde vayan.
  function seedBands(cfg, plan){
    const T = TOPO();
    const cols = drawColumns(cfg);
    if (!cols.length){ cfg.canvas.bands = []; return cfg; }
    const accessLabel = (cfg.format && cfg.format.accessRoundLabel) ||
      (T && T.ROUND_LABEL && T.ROUND_LABEL.access) || 'RONDA DE ACCESO';
    const labelOfRound = id => {
      const r = T && T.roundOf ? T.roundOf(id) : null;
      if (r === 'access') return accessLabel;
      return (T && T.ROUND_LABEL && T.ROUND_LABEL[r]) || 'RONDA';
    };
    const out = [];
    cols.forEach((col, i) => {
      const group = col.ids;
      const counts = {};
      group.forEach(id => { const l = labelOfRound(id); counts[l] = (counts[l] || 0) + 1; });
      const text = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
      const isCenter = group.indexOf('final') >= 0;
      out.push({ id:'band-c' + i, kind:'round', text, sub:'', x:0, y:0, w: BAND_W,
        anchor: isCenter ? 'center' : group.slice(), dx:0, dy:0,
        tone: isCenter ? 'gold' : (i === 0 || i === cols.length - 1 ? 'flank' : 'accent') });
    });
    if (plan)
      out.unshift({ id:'band-sys', kind:'sys', text: plan.systemLabel || 'LLAVE ELIMINATORIA',
        sub: plan.systemLine || '', x:0, y:0, w:0, anchor:'all', dx:0, dy:0, tone:'accent' });
    cfg.canvas.bands = out;
    reflowBands(cfg);
    cfg.canvas.bands.sort((a, b) => (a.kind === 'sys' ? -1 : b.kind === 'sys' ? 1 : a.x - b.x));
    return cfg;
  }
  function bands(cfg){ ensure(cfg); return cfg.canvas.bands; }
  function addBand(cfg, o){
    ensure(cfg);
    o = o || {};
    const b = normBand({ id: nextBandId(cfg), kind: o.kind === 'sys' ? 'sys' : 'round',
      text: o.text || 'RÓTULO', sub: o.sub || '',
      x: Math.round(o.x || 0), y: Math.round(o.y || 0),
      w: o.w != null ? Math.round(o.w) : BAND_W,
      anchor: o.anchor || null, dx: o.dx, dy: o.dy, tone: o.tone });
    cfg.canvas.bands.push(b);
    // un rótulo nuevo se engancha solo a la columna que le queda debajo
    if (!b.anchor) adoptBands(cfg);
    return b.id;
  }
  function removeBand(cfg, id){
    cfg.canvas.bands = (cfg.canvas.bands || []).filter(b => b.id !== id);
  }
  // Mover un rótulo NO lo desancla: guarda el desplazamiento respecto de su
  // columna, así el ajuste fino sobrevive a simetrizar y a mover los nodos.
  function moveBand(cfg, id, x, y){
    const b = bandById(cfg, id);
    if (!b) return;
    b.x = Math.round(x); b.y = Math.round(y);
    const base = bandBase(cfg, b);
    if (base){ b.dx = b.x - base.x; b.dy = b.y - base.y; }
  }
  function setBand(cfg, id, patch){
    const b = bandById(cfg, id);
    if (b) Object.assign(b, patch || {});
    return b;
  }

  function labelOf(id, slot){
    if (slot && slot.label) return slot.label;
    const L = CFG() && CFG().SLOT_LABEL;
    return (L && L[id]) || String(id || '').toUpperCase();
  }
  const nodeLabel = (cfg, id) => labelOf(id, cfg && cfg.slots && cfg.slots[id]);

  // Orden de pintado (z): el arreglo `order` manda; el último se dibuja arriba.
  function nodes(cfg){
    ensure(cfg);
    return cfg.canvas.order.map(id => ({ id, slot: cfg.slots[id] })).filter(n => n.slot);
  }
  function isBye(slot){ return (slot && slot.slotType) === 'DIRECT_PASS'; }

  // ── altas / bajas ──────────────────────────────────────────────────────
  function nextId(cfg){
    let n = 1;
    while (cfg.slots['n' + n]) n++;
    return 'n' + n;
  }
  function addNode(cfg, opts){
    ensure(cfg);
    opts = opts || {};
    const id = nextId(cfg);
    const rounds = (cfg.rounds || []).filter(r => r && r.id);
    const roundId = opts.roundId || (rounds[0] && rounds[0].id) || 'quarterfinal';
    const s = CFG().emptySlot(id);
    s.id = id;
    s.roundId = roundId;
    s.positionNumber = Object.keys(cfg.slots).length + 1;
    s.slotType = opts.kind === 'DIRECT_PASS' ? 'DIRECT_PASS' : 'MATCH';
    s.visible = true;
    s.label = opts.label || (s.slotType === 'DIRECT_PASS' ? 'DESCANSO ' + id.slice(1) : 'ENFRENTAMIENTO ' + id.slice(1));
    const spot = freeSpot(cfg, GEO[s.slotType === 'DIRECT_PASS' ? 'bye' : 'match'].h,
      { x: opts.x, y: opts.y });
    // sin dirección pedida la marca el lado en el que cayó la tarjeta
    const axis = (cfg.canvas.center && Number.isFinite(Number(cfg.canvas.center.x))
      ? Number(cfg.canvas.center.x) : CENTER_FIXED.x) + CENTER_W / 2;
    const dir = opts.dir === 'RL' ? 'RL'
      : opts.dir === 'LR' ? 'LR'
      : spot.x + NODE_W / 2 >= axis ? 'RL' : 'LR';
    s.layout = { x: spot.x, y: spot.y, dir };
    cfg.slots[id] = s;
    cfg.canvas.order.push(id);
    return id;
  }
  // Vincular a un partido oficial ya NO bloquea el borrado (el aviso vive en
  // la confirmación general de eliminar); solo se protege un resultado
  // CAPTURADO A MANO, que sí se perdería sin aviso previo.
  function canRemove(cfg, id){
    const s = cfg.slots[id];
    if (!s) return 'Ese nodo ya no existe.';
    if (s.manualWinnerSlot || s.manualScoreA != null || s.manualScoreB != null)
      return 'Este enfrentamiento tiene un resultado capturado: bórralo antes de eliminar el nodo.';
    return null;
  }
  function removeNode(cfg, id){
    ensure(cfg);
    delete cfg.slots[id];
    cfg.canvas.order = cfg.canvas.order.filter(x => x !== id);
    cfg.connections = (cfg.connections || []).filter(c => c.fromSlot !== id && c.toSlot !== id);
    ['champion','runnerUp'].forEach(k => { if (cfg[k] && cfg[k].sourceSlot === id) cfg[k].sourceSlot = null; });
  }
  function moveNode(cfg, id, x, y){
    const s = cfg.slots[id];
    if (!s) return;
    s.layout = s.layout || { dir:'LR' };
    s.layout.x = Math.round(x);
    s.layout.y = Math.round(y);
  }
  function bringToFront(cfg, ids){
    const set = new Set([].concat(ids));
    cfg.canvas.order = cfg.canvas.order.filter(x => !set.has(x)).concat(cfg.canvas.order.filter(x => set.has(x)));
  }
  function sendToBack(cfg, ids){
    const set = new Set([].concat(ids));
    cfg.canvas.order = cfg.canvas.order.filter(x => set.has(x)).concat(cfg.canvas.order.filter(x => !set.has(x)));
  }

  // ── grafo ──────────────────────────────────────────────────────────────
  const live = cfg => (cfg.connections || []).filter(c => c.enabled !== false);
  const outOf = (cfg, id) => live(cfg).filter(c => c.fromSlot === id);
  const inOf  = (cfg, id) => live(cfg).filter(c => c.toSlot === id);
  function inAt(cfg, id, side){ return live(cfg).find(c => c.toSlot === id && c.toParticipant === side) || null; }

  function reaches(cfg, from, target){
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length){
      const cur = stack.pop();
      if (cur === target) return true;
      outOf(cfg, cur).forEach(c => { if (!seen.has(c.toSlot)){ seen.add(c.toSlot); stack.push(c.toSlot); } });
    }
    return false;
  }

  // Motivo en español de por qué NO se puede conectar (null = sí se puede).
  function whyNotConnect(cfg, fromId, toId, side){
    ensure(cfg);
    const A = () => '«' + nodeLabel(cfg, fromId) + '»';
    const B = () => '«' + nodeLabel(cfg, toId) + '»';
    if (!cfg.slots[fromId]) return 'El enfrentamiento de origen ya no existe.';
    if (!cfg.slots[toId]) return 'El enfrentamiento de destino ya no existe.';
    if (fromId === toId) return 'Un enfrentamiento no puede conectarse consigo mismo.';
    if (side !== 'A' && side !== 'B') return 'La conexión tiene que llegar a un espacio concreto (superior o inferior).';
    if (isBye(cfg.slots[toId]) && side === 'B') return 'Un descanso (BYE) tiene un solo espacio: usa el superior.';
    if (outOf(cfg, fromId).length >= 1)
      return 'De ' + A() + ' ya sale una conexión. Cada enfrentamiento entrega un solo ganador: elimina la conexión anterior primero.';
    if (inAt(cfg, toId, side))
      return 'El espacio ' + side + ' de ' + B() + ' ya recibe al ganador de otro enfrentamiento.';
    if (inOf(cfg, toId).length >= 2) return B() + ' ya tiene sus dos entradas ocupadas.';
    const p = cfg.slots[toId]['participant' + side];
    if (p && p.mode && p.mode !== 'EMPTY')
      return 'El espacio ' + side + ' de ' + B() + ' tiene un participante sembrado directamente. Retíralo antes de conectar un ganador.';
    if (reaches(cfg, toId, fromId))
      return 'Esa conexión crearía un ciclo: ' + B() + ' ya alimenta —directa o indirectamente— a ' + A() + '.';
    return null;
  }
  function connect(cfg, fromId, toId, side, outcome){
    const err = whyNotConnect(cfg, fromId, toId, side);
    if (err) return { error: err };
    const c = { id:'e-' + fromId + '-' + toId + '-' + side, fromSlot:fromId,
      fromOutcome: outcome === 'LOSER' ? 'LOSER' : 'WINNER', toSlot:toId, toParticipant:side, enabled:true };
    cfg.connections = (cfg.connections || []).concat([c]);
    return { edge: c };
  }
  function disconnect(cfg, edgeId){
    cfg.connections = (cfg.connections || []).filter(c => c.id !== edgeId);
  }
  // null = adelante · 'CONFIRM:…' = pide confirmación explícita al organizador
  function canDisconnect(cfg, edgeId){
    const e = (cfg.connections || []).find(c => c.id === edgeId);
    if (!e) return 'Esa conexión ya no existe.';
    const t = cfg.slots[e.toSlot];
    const hasResult = t && (t.officialMatchId || t.manualWinnerSlot || t.manualScoreA != null || t.manualScoreB != null);
    if (hasResult)
      return 'CONFIRM:«' + nodeLabel(cfg, e.toSlot) + '» ya tiene un resultado guardado. Si quitas esta conexión, su espacio ' +
        e.toParticipant + ' se queda vacío y ese resultado puede dejar de corresponder con la llave. ¿Continuar?';
    return null;
  }
  function edgeAt(cfg, toId, side){ return inAt(cfg, toId, side); }

  // ── participantes sembrados ───────────────────────────────────────────
  function whyNotPlace(cfg, id, side){
    const s = cfg.slots[id];
    if (!s) return 'Ese enfrentamiento ya no existe.';
    if (isBye(s) && side === 'B') return 'Un descanso (BYE) tiene un solo espacio.';
    // Sembrar a mano en un espacio que además recibe de otro enfrentamiento SÍ se
    // permite: el nombre puesto a mano es el que se ve.
    // Un enfrentamiento vinculado a un partido oficial SÍ se puede volver a sembrar
    // (el borrador es libre); solo se protege lo que ya tiene resultado capturado.
    if (s.officialMatchId && (s.manualWinnerSlot || s.manualScoreA != null || s.manualScoreB != null))
      return 'Este enfrentamiento ya tiene un resultado capturado: bórralo antes de cambiar a quién juega.';
    return null;
  }
  function place(cfg, id, side, participant){
    const err = whyNotPlace(cfg, id, side);
    if (err) return { error: err };
    cfg.slots[id]['participant' + side] = participant;
    cfg.slots[id].visible = true;
    return { ok:true };
  }
  function unplace(cfg, id, side){
    const s = cfg.slots[id];
    if (!s) return;
    s['participant' + side] = CFG().emptyParticipant();
  }
  // registrationId → { slotId, side } de todo lo ya colocado
  function placedMap(cfg){
    const out = new Map();
    Object.keys(cfg.slots || {}).forEach(id => {
      const s = cfg.slots[id];
      if (!s || s.visible === false) return;
      ['A','B'].forEach(side => {
        const p = s['participant' + side];
        if (p && p.mode === 'REGISTRATION' && p.registrationId)
          out.set(String(p.registrationId), { slotId:id, side, label: nodeLabel(cfg, id) });
      });
    });
    return out;
  }

  // ── resolución de vista (flujo de ganadores + marcadores pendientes) ───
  // No muta nada: devuelve lo que debe VERSE en cada espacio.
  // Se recorre en orden TOPOLÓGICO y cada nodo lee a los ocupantes YA resueltos
  // de su alimentador: así el ganador de cuartos llega a la semifinal, el de la
  // semifinal a la gran final y el de la final al campeón (antes la cadena se
  // cortaba en el primer salto porque se leía el slot en crudo).
  function resolve(cfg){
    const V = CFG();
    const out = {}, views = {};
    Object.keys(cfg.slots || {}).forEach(id => {
      const v = V.slotView(cfg.slots[id]);
      views[id] = v;
      out[id] = { a: v.a, b: v.b, view: v, pendA:null, pendB:null };
    });
    const byTarget = {};
    live(cfg).forEach(c => { (byTarget[c.toSlot] || (byTarget[c.toSlot] = [])).push(c); });
    const real = p => !!(p && p.mode && p.mode !== 'EMPTY' && !p.pendingFrom);
    const at = (id, side) => (side === 'B' ? out[id].b : out[id].a);
    topoOrder(cfg).forEach(id => {
      (byTarget[id] || []).forEach(c => {
        const src = cfg.slots[c.fromSlot], dst = out[c.toSlot];
        if (!src || !dst) return;
        const sv = views[c.fromSlot];
        const key = c.toParticipant === 'B' ? 'b' : 'a';
        const pend = c.toParticipant === 'B' ? 'pendB' : 'pendA';
        if (isBye(src)){
          const a = at(c.fromSlot, 'A'), b = at(c.fromSlot, 'B');
          const who = real(a) ? a : (real(b) ? b : null);
          if (who){ dst[key] = who; return; }
        } else if (sv.winner){
          const w = at(c.fromSlot, sv.winner);
          const l = at(c.fromSlot, sv.winner === 'A' ? 'B' : 'A');
          const who = c.fromOutcome === 'LOSER' ? l : w;
          if (real(who)){ dst[key] = who; return; }
        }
        dst[pend] = (c.fromOutcome === 'LOSER' ? 'PERDEDOR DE ' : 'GANADOR DE ') + String(nodeLabel(cfg, c.fromSlot)).toUpperCase();
        // Un nombre sembrado A MANO manda sobre el «por definir» de la conexión:
        // se ve siempre, aunque el enfrentamiento reciba de otro.
        if (real(dst[key])) return;
        dst[key] = Object.assign(CFG().emptyParticipant(),
          { mode:'PLACEHOLDER', displayName:'Por definir', sourceLabel: dst[pend], pendingFrom: c.fromSlot });
      });
    });
    return out;
  }

  // ── validación de la llave completa ───────────────────────────────────
  function validate(cfg){
    ensure(cfg);
    const out = [];
    const ids = Object.keys(cfg.slots);
    const push = (level, code, msg, node) => out.push({ level, code, msg, node: node || null });
    if (!ids.length) push('error','EMPTY_CANVAS','El lienzo no tiene ningún enfrentamiento.');

    // duplicados
    const seen = new Map();
    ids.forEach(id => {
      const s = cfg.slots[id];
      ['A','B'].forEach(side => {
        const p = s['participant' + side];
        if (!p || p.mode !== 'REGISTRATION' || !p.registrationId) return;
        const k = String(p.registrationId);
        if (seen.has(k))
          push('error','DUPLICATE_PARTICIPANT',
            '«' + (p.displayName || k) + '» está sembrado dos veces: en ' + seen.get(k) + ' y en «' + nodeLabel(cfg, id) + '».', id);
        else seen.set(k, '«' + nodeLabel(cfg, id) + '»');
      });
    });

    ids.forEach(id => {
      const s = cfg.slots[id];
      const ins = inOf(cfg, id), outs = outOf(cfg, id);
      const pa = s.participantA || {}, pb = s.participantB || {};
      const hasA = pa.mode && pa.mode !== 'EMPTY', hasB = pb.mode && pb.mode !== 'EMPTY';
      if (outs.length > 1) push('error','TOO_MANY_OUT','«' + nodeLabel(cfg, id) + '» tiene ' + outs.length + ' salidas: solo puede entregar un ganador.', id);
      if (ins.length > 2) push('error','TOO_MANY_IN','«' + nodeLabel(cfg, id) + '» tiene más de dos entradas.', id);
      ['A','B'].forEach(side => {
        const p = s['participant' + side] || {};
        if (inAt(cfg, id, side) && p.mode && p.mode !== 'EMPTY')
          push('error','SLOT_CONFLICT','El espacio ' + side + ' de «' + nodeLabel(cfg, id) + '» tiene participante sembrado y conexión entrante a la vez.', id);
      });
      if (isBye(s)){
        if (hasA && hasB) push('error','BYE_TWO','El descanso «' + nodeLabel(cfg, id) + '» tiene dos participantes: un BYE avanza a uno solo.', id);
        if (!hasA && !hasB && !ins.length) push('warn','BYE_EMPTY','El descanso «' + nodeLabel(cfg, id) + '» está vacío.', id);
        if (!outs.length) push('warn','BYE_NO_OUT','El descanso «' + nodeLabel(cfg, id) + '» no avanza a ningún enfrentamiento.', id);
      } else {
        ['A','B'].forEach(side => {
          const p = s['participant' + side] || {};
          const filled = (p.mode && p.mode !== 'EMPTY') || inAt(cfg, id, side);
          if (!filled) push('warn','EMPTY_SPOT','El espacio ' + side + ' de «' + nodeLabel(cfg, id) + '» sigue sin definir.', id);
        });
      }
      if (!ins.length && !outs.length && !hasA && !hasB)
        push('error','ORPHAN_NODE','«' + nodeLabel(cfg, id) + '» está aislado: sin participantes y sin conexiones.', id);
    });

    // ciclos (Kahn)
    const indeg = {}; ids.forEach(i => indeg[i] = 0);
    live(cfg).forEach(c => { indeg[c.toSlot] = (indeg[c.toSlot] || 0) + 1; });
    const q = ids.filter(i => !indeg[i]);
    let visited = 0;
    while (q.length){
      const cur = q.shift(); visited++;
      outOf(cfg, cur).forEach(c => { if (--indeg[c.toSlot] === 0) q.push(c.toSlot); });
    }
    if (visited < ids.length) push('error','CYCLE','Hay un ciclo en las conexiones: algún ganador vuelve a un enfrentamiento anterior.');

    // salidas finales
    const ghosts = ids.filter(i => cfg.slots[i] && cfg.slots[i].outOfPlan);
    if (ghosts.length)
      push('warn','OUT_OF_PLAN_SLOTS','Quedan ' + ghosts.length + ' tarjeta(s) fuera de la estructura vigente con resultado capturado (' +
        ghosts.slice(0, 3).map(i => '«' + nodeLabel(cfg, i) + '»').join(', ') + (ghosts.length > 3 ? '…' : '') +
        '). Desvincula o borra su resultado para que desaparezcan del lienzo.');

    const finals = ids.filter(i => !outOf(cfg, i).length);
    if (finals.length > 1)
      push('warn','MULTIPLE_FINALS','Hay ' + finals.length + ' enfrentamientos sin salida (' +
        finals.slice(0, 4).map(i => '«' + nodeLabel(cfg, i) + '»').join(', ') +
        (finals.length > 4 ? '…' : '') + '). Normalmente solo la final no tiene salida.');
    return out;
  }

  function stats(cfg){
    ensure(cfg);
    const ids = Object.keys(cfg.slots);
    let spots = 0, filled = 0, byes = 0;
    ids.forEach(id => {
      const s = cfg.slots[id];
      if (isBye(s)){ byes++; spots++; if ((s.participantA || {}).mode && s.participantA.mode !== 'EMPTY') filled++; return; }
      ['A','B'].forEach(side => {
        spots++;
        const p = s['participant' + side] || {};
        if ((p.mode && p.mode !== 'EMPTY') || inAt(cfg, id, side)) filled++;
      });
    });
    return { nodes: ids.length, edges: live(cfg).length, byes, spots, filled, free: spots - filled };
  }

  // ── generar distribución inicial desde el formato (sugerencia) ─────────
  // Conserva ids y contenido: solo asigna posiciones/etiquetas y reconstruye
  // las conexiones del plan.
  // Geometría interna de una tarjeta (coincide con css/bracket-canvas.css):
  // salida al centro y entradas a la altura de cada chip.
  // Nodo: etiqueta 22 + fila 56 + banda VS 20 + fila 56 = 154 px de alto.
  // OUT_DY es el centro de la tarjeta (donde sale la linea) y IN_DY el centro
  // exacto de cada fila — los mismos numeros que los puertos del CSS.
  // Reparto sugerido por el reglamento (punto de partida, no obligatorio).
  // Cada nodo se alinea con el ESPACIO al que alimenta usando el centro
  // exacto de cada fila — los mismos números que los puertos del CSS.
  function layoutFromPlan(cfg, plan, opts){
    ensure(cfg);
    opts = opts || {};
    if (opts.sweep !== false) sweepGhosts(cfg, new Set((plan.slots || []).map(s => s.id)));
    const cols = plan.columns;
    // Geometría EXACTA del bracket publicado (PruebaBracketPiel / .mbk):
    //   columnas de 292 px con hueco 26/32/40 según cuántas haya,
    //   bloque central de 344 px con el mismo hueco a los dos lados,
    //   dentro de cada columna las tarjetas se reparten como `space-around`
    //   con separación mínima de 60 px y 6 px de respiro arriba y abajo,
    //   sobre una franja de 397 px (la altura del cuadro publicado).
    const COLW = NODE_W, GAPX = colGap(cols.length), VGAP = COL_VGAP, PAD = COL_PAD;
    const heights = id => heightOf(cfg, id);
    const isAccess = c => c.roundId === 'access';
    // El alto lo marcan las rondas principales (mismo número por lado): así el
    // dibujo es simétrico aunque un lado tenga más partidos de acceso.
    const mainRows = cols.reduce((m, c) => Math.max(m, c.side === 'c' ? 1 : c.ids.length), 1);
    const totalH = Math.max(BAND_HEIGHT, mainRows * NODE_H + (mainRows - 1) * VGAP + PAD * 2);
    // La franja se centra con el bloque central, igual que en el cuadro
    // publicado (donde .mbk-center va centrado en la altura de las columnas).
    const TOP = Math.round(CENTER_FIXED.y - (totalH - CENTER_H) / 2);
    // Todo se distribuye SIMÉTRICAMENTE alrededor del bloque central fijo, para
    // que el cuadro se vea igual en todas las categorías.
    const ci = Math.max(0, cols.findIndex(c => c.side === 'c'));
    const xs = cols.map((c, i) => i < ci ? CENTER_FIXED.x - (ci - i) * (COLW + GAPX)
      : i === ci ? CENTER_FIXED.x
      : CENTER_FIXED.x + CENTER_W + GAPX + (i - ci - 1) * (COLW + GAPX));
    const width = Math.max(CENTER_FIXED.x + CENTER_W + 60,
      Math.max.apply(null, xs.concat([0])) + COLW + 60);
    cfg.canvas.center = Object.assign(cfg.canvas.center || {},
      { x: CENTER_FIXED.x, y: CENTER_FIXED.y, visible:true });
    const put = (id, x, y, side) => {
      if (!cfg.slots[id]) cfg.slots[id] = Object.assign(CFG().emptySlot(id), { id });
      const s = cfg.slots[id];
      s.visible = s.visible !== false;
      s.label = s.label || labelOf(id, s);
      s.layout = { x: Math.round(x), y: Math.round(y), dir: side === 'r' ? 'RL' : 'LR',
        inA: side === 'r' ? 'R' : 'L', inB: side === 'r' ? 'R' : 'L', join:true };
      if (cfg.canvas.order.indexOf(id) < 0) cfg.canvas.order.push(id);
    };
    // 1) TODAS las columnas (acceso incluido) se reparten como `space-around`
    //    con hueco de 60 px, EXACTAMENTE igual que la columna del bracket
    //    publicado: por eso la ronda de acceso queda a la misma altura que
    //    cuartos, como en la vista buena.
    cols.forEach((c, cix) => {
      if (c.side === 'c') return;
      const k = c.ids.length || 1;
      const hs = c.ids.map(heights);
      const sum = hs.reduce((a, b) => a + b, 0);
      const free = totalH - PAD * 2 - sum - (k - 1) * VGAP;
      let acc = 0;
      c.ids.forEach((id, i) => {
        const y = TOP + PAD + acc + i * VGAP + (2 * i + 1) * free / (2 * k);
        acc += hs[i];
        put(id, xs[cix], y, c.side);
      });
    });
    // 2) la gran final, en el hueco bajo la placa
    if (cfg.slots.final){
      cfg.slots.final.layout = { x: CENTER_FIXED.x + FINAL_OFFSET.dx, y: CENTER_FIXED.y + FINAL_OFFSET.dy,
        dir:'LR', inA:'L', inB:'R', join:false, pinned:true };
      cfg.slots.final.label = cfg.slots.final.label || 'GRAN FINAL';
    }
    // 3) la ronda de acceso NO se recoloca: en el cuadro publicado va a la
    //    misma altura que la ronda principal y las llaves salen igual.
    if (opts.rebuildEdges !== false)
      cfg.connections = (plan.connections || []).map(c => Object.assign({}, c, { enabled:true }));
    // El servidor exige que cada roundId usado por un slot (r16, access…)
    // exista en cfg.rounds — a diferencia del cuadro clásico, este lienzo no
    // pasaba por TOPO.applyPlan(), así que nunca se sincronizaba y el guardado
    // fallaba con ROUND_NOT_FOUND en llaves de 16/32.
    cfg.rounds = (plan.configRounds || []).map(r => Object.assign({}, r));
    cfg.canvas.width = Math.max(1200, Math.round(width));
    cfg.canvas.height = Math.max(760, Math.round(TOP + totalH + 320));
    cfg.canvas.geo = GEO_REV;
    cfg.layoutKey = cfg.layout = LAYOUT_KEY;
    if (centerLocked(cfg)) pinCenter(cfg);
    if (opts.bands !== false) seedBands(cfg, plan);
    return cfg;
  }

  // ── simetría ───────────────────────────────────────────────────────────
  // Espeja las columnas respecto del bloque central y alinea cada nodo con el
  // espacio al que alimenta: los dos lados trazan líneas equivalentes aunque
  // tengan distinta cantidad de partidos previos.
  function nodeH(cfg, id){ return heightOf(cfg, id); }
  // Orden topológico: los que alimentan van antes que su destino.
  function topoOrder(cfg){
    const ids = nodes(cfg).map(n => n.id);
    const indeg = {}; ids.forEach(i => indeg[i] = inOf(cfg, i).length);
    const q = ids.filter(i => !indeg[i]);
    const out = [];
    while (q.length){
      const cur = q.shift();
      out.push(cur);
      outOf(cfg, cur).forEach(e => { if (--indeg[e.toSlot] === 0) q.push(e.toSlot); });
    }
    ids.forEach(i => { if (out.indexOf(i) < 0) out.push(i); });
    return out;
  }
  function symmetrize(cfg){
    ensure(cfg);
    const locked = centerLocked(cfg);
    const movable = id => cfg.slots[id] && !(cfg.slots[id].layout.pinned && locked);
    const axis = (cfg.canvas.center && cfg.canvas.center.x != null ? cfg.canvas.center.x : 0) + CENTER_W / 2;

    // 1) columnas espejo: se emparejan por distancia al eje, no por posición.
    //    El redondeo a 8 px sirve SOLO para agrupar; la distancia se mide con la
    //    x real, si no una columna ya espejada se movía unos píxeles y rompía el
    //    hueco exacto del bracket publicado.
    const byX = {}, realX = {};
    nodes(cfg).forEach(n => {
      if (!movable(n.id)) return;
      const kx = Math.round(n.slot.layout.x / 8) * 8;
      (byX[kx] || (byX[kx] = [])).push(n.id);
      realX[kx] = realX[kx] == null ? n.slot.layout.x : Math.min(realX[kx], n.slot.layout.x);
    });
    const keys = Object.keys(byX).map(Number);
    const Lc = keys.filter(x => realX[x] + NODE_W / 2 < axis).map(x => ({ x, d: axis - (realX[x] + NODE_W) })).sort((a, b) => a.d - b.d);
    const Rc = keys.filter(x => realX[x] + NODE_W / 2 >= axis).map(x => ({ x, d: realX[x] - axis })).sort((a, b) => a.d - b.d);
    const used = new Set();
    const pairs = [];
    Lc.forEach(l => {
      let best = null;
      Rc.forEach((r, i) => {
        if (used.has(i)) return;
        const diff = Math.abs(r.d - l.d);
        if (diff <= 140 && (!best || diff < best.diff)) best = { i, r, diff };
      });
      if (!best) return;
      used.add(best.i);
      if (best.diff > 0.5){                                  // ya espejadas: no se tocan
        const d = Math.round((l.d + best.r.d) / 2);
        byX[l.x].forEach(id => cfg.slots[id].layout.x = Math.round(axis - d - NODE_W));
        byX[best.r.x].forEach(id => cfg.slots[id].layout.x = Math.round(axis + d));
      }
      pairs.push({ l: byX[l.x], r: byX[best.r.x] });
    });
    // 1b) misma altura a los dos lados cuando la columna tiene igual cantidad
    pairs.forEach(p => {
      if (p.l.length !== p.r.length) return;                 // acceso asimétrico: se resuelve abajo
      const sy = ids => ids.slice().sort((a, b) => cfg.slots[a].layout.y - cfg.slots[b].layout.y);
      const l = sy(p.l), r = sy(p.r);
      l.forEach((id, i) => {
        const y = Math.round((cfg.slots[id].layout.y + cfg.slots[r[i]].layout.y) / 2);
        cfg.slots[id].layout.y = y;
        cfg.slots[r[i]].layout.y = y;
      });
    });

    // 2) alturas de FUERA hacia DENTRO: se respeta la separación que ya diste a
    //    los enfrentamientos iniciales y cada destino se centra con lo que le
    //    llega, de modo que las líneas queden rectas o en llave clásica.
    //    Una sola pasada no basta en cadenas largas (acceso → cuartos → semis →
    //    final), así que se repite hasta que nada se mueve: pulsar «Simetrizar»
    //    dos veces deja el cuadro EXACTAMENTE igual.
    const resolveY = () => {
      const yOf = {};
      nodes(cfg).forEach(n => { yOf[n.id] = n.slot.layout.y; });
      const outY = id => yOf[id] + outDy(cfg, id);
      topoOrder(cfg).forEach(id => {
        const ins = inOf(cfg, id);
        if (!ins.length) return;
        const L = cfg.slots[id].layout;
        const sideOf = e => ((e.toParticipant === 'B' ? L.inB : L.inA) === 'R' ? 'R' : 'L');
        let want;
        if (ins.length === 1){
          // único alimentador: se alinea ÉL con el espacio, y la línea sale recta
          const e = ins[0];
          if (movable(e.fromSlot))
            yOf[e.fromSlot] = yOf[id] + inDy(cfg, id, e.toParticipant) - outDy(cfg, e.fromSlot);
          return;
        }
        if (sideOf(ins[0]) === sideOf(ins[1]) && L.join !== false)
          want = (outY(ins[0].fromSlot) + outY(ins[1].fromSlot)) / 2 - nodeH(cfg, id) / 2;
        else
          want = ins.reduce((s, e) => s + outY(e.fromSlot) - inDy(cfg, id, e.toParticipant), 0) / ins.length;
        if (movable(id)) yOf[id] = want;
      });
      // El cuadro se centra con el BLOQUE central, igual que el reparto por
      // defecto (y que el bracket publicado, donde el centro de la semifinal
      // coincide con el centro del bloque). Antes se anclaba a la tarjeta de la
      // gran final, que cuelga 60 px más abajo dentro del bloque, y simetrizar
      // hundía todo el cuadro esa misma distancia.
      let delta = 0;
      const c = cfg.canvas.center;
      if (c && c.visible !== false){
        let t = Infinity, b = -Infinity;
        nodes(cfg).forEach(n => {
          if (!movable(n.id)) return;
          t = Math.min(t, yOf[n.id]); b = Math.max(b, yOf[n.id] + nodeH(cfg, n.id));
        });
        if (t < Infinity) delta = ((Number(c.y) || 0) + CENTER_H / 2) - (t + b) / 2;
      }
      let moved = 0;
      nodes(cfg).forEach(n => {
        if (!movable(n.id)) return;
        const ny = Math.round(yOf[n.id] + delta);
        moved = Math.max(moved, Math.abs(ny - n.slot.layout.y));
        n.slot.layout.y = ny;
      });
      return moved;
    };
    for (let pass = 0; pass < 6 && resolveY() > 0.5; pass++);
    reflowBands(cfg);          // los rótulos viajan con su columna
    return cfg;
  }

  // ── Puerquito dorado (adorno del cuadro) ─────────────────────────────
  function piggyBox(cfg){
    const p = (cfg && cfg.canvas && cfg.canvas.piggy) || {};
    const w = Math.max(40, Math.min(520, Number(p.w) || PIGGY_W));
    const c = (cfg && cfg.canvas && cfg.canvas.center) || CENTER_FIXED;
    const cx = Number(c.x); const cy = Number(c.y);
    const dx = Number.isFinite(cx) ? cx : CENTER_FIXED.x;
    const dy = Number.isFinite(cy) ? cy : CENTER_FIXED.y;
    const px = Number(p.x), py = Number(p.y);
    // (0,0) es un valor heredado de guardados antiguos: dejaba el adorno en la
    // esquina del lienzo. Se trata como «sin colocar» para que vuelva a su hueco.
    const placed = Number.isFinite(px) && Number.isFinite(py) && !(px === 0 && py === 0);
    const x = placed ? px : Math.round(dx + (CENTER_W - w) / 2);
    const y = placed ? py : Math.round(dy - PIGGY_SLOT_H / 2 - w / 2);
    return { visible: p.visible !== false, x, y, w, h: w };
  }
  // Escribe la caja actual (materializa los valores por defecto) y aplica cambios.
  function setPiggy(cfg, patch){
    if (!cfg || !cfg.canvas) return cfg;
    const box = piggyBox(cfg);
    const p = cfg.canvas.piggy || (cfg.canvas.piggy = {});
    p.visible = box.visible; p.x = box.x; p.y = box.y; p.w = box.w;
    Object.keys(patch || {}).forEach(k => { p[k] = patch[k]; });
    if (patch && patch.w != null) p.w = Math.max(40, Math.min(520, Math.round(Number(patch.w) || PIGGY_W)));
    if (patch && patch.reset){
      delete p.reset; p.x = null; p.y = null;
      const b = piggyBox(cfg); p.x = b.x; p.y = b.y;
    }
    return cfg;
  }

  function bounds(cfg){
    const ns = nodes(cfg);
    if (!ns.length) return { x:0, y:0, w: cfg.canvas.width, h: cfg.canvas.height };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ns.forEach(n => {
      const L = n.slot.layout, h = heightOf(cfg, n.id);
      x1 = Math.min(x1, L.x); y1 = Math.min(y1, L.y);
      x2 = Math.max(x2, L.x + NODE_W); y2 = Math.max(y2, L.y + h);
    });
    if (cfg.canvas.center && cfg.canvas.center.visible !== false){
      x1 = Math.min(x1, cfg.canvas.center.x); y1 = Math.min(y1, cfg.canvas.center.y);
      x2 = Math.max(x2, cfg.canvas.center.x + CENTER_W); y2 = Math.max(y2, cfg.canvas.center.y + CENTER_H);
    }
    (cfg.canvas.bands || []).forEach(b => {
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + (b.w || BAND_W)); y2 = Math.max(y2, b.y + BAND_H);
    });
    // El puerquito NO cuenta para los límites del cuadro: es un adorno que se
    // coloca en un hueco existente y no debe agrandar el lienzo ni un píxel.
    return { x:x1, y:y1, w:x2 - x1, h:y2 - y1 };
  }

  const api = { LAYOUT_KEY, NODE_W, NODE_H, BYE_H, FINAL_H, GEO, kindOf, nodeH, heightOf, outDy, inDy,
    CENTER_FIXED, CENTER_W, FINAL_OFFSET, BAND_W, BAND_H, BAND_GAP, PIGGY_W,
    piggyBox, setPiggy,
    needsRescale, rescaleGeometry, freeSpot, distributeColumn, redrawDefault, DEFAULT_FORMAT,
    isFree, ensure, defaults, nodes, nodeLabel, isBye,
    centerLocked, pinCenter, isPinned,
    bands, bandById, addBand, removeBand, moveBand, setBand, seedBands, reflowBands, bandBase, drawColumns,
    addNode, removeNode, canRemove, moveNode, bringToFront, sendToBack, nextId,
    connect, disconnect, canDisconnect, whyNotConnect, edgeAt, inOf, outOf, inAt, live, reaches,
    place, unplace, whyNotPlace, placedMap, resolve, validate, stats, layoutFromPlan, symmetrize, bounds, clone,
    sweepGhosts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FI_BKT_CANVAS = api;
})(typeof window !== 'undefined' ? window : globalThis);
