// ── GUÍAS INTELIGENTES DEL LIENZO ───────────────────────────────────────
// Lógica PURA de geometría + una capa SVG temporal. No toca el modelo: nada
// de lo que dibuja aquí se guarda en el JSON del bracket ni se convierte en
// nodo o conexión. Las guías solo existen mientras dura un arrastre.
//
// Qué detecta, en los dos ejes:
//   · alineación de bordes (izq./der./arriba/abajo) y de centros;
//   · el «centro» vertical es el centro de la TARJETA, que es justo donde se
//     pegan las líneas, no el centro de la caja con su etiqueta;
//   · separaciones iguales entre bordes (distribución uniforme);
//   · reflejo alrededor de un nodo pivote (simetría por centros);
//   · reflejo alrededor del eje del bloque central, aunque no haya nodo ahí.
//
// El ajuste magnético usa una tolerancia constante EN PANTALLA (6 px), que se
// convierte a unidades del lienzo dividiendo por el zoom, así se siente igual
// al 50 %, al 100 % y al 200 %.
(function(global){
  'use strict';

  const TOL_SCREEN = 6;     // tolerancia de ajuste, en píxeles de pantalla
  const MAX_REFS   = 16;    // nodos candidatos para simetría (prioridad §4)
  const MAX_GUIDES = 3;     // guías de alineación dibujadas por eje
  const PAD        = 26;    // cuánto se prolonga la guía más allá de las cajas
  const EPS        = 0.5;

  const AX = { axis:'x', lo:'l', mid:'cx', hi:'r', olo:'t', ohi:'b', omid:'cyCard' };
  const AY = { axis:'y', lo:'t', mid:'cyCard', hi:'b', olo:'l', ohi:'r', omid:'cx' };

  let ST = null;

  const ns = t => document.createElementNS('http://www.w3.org/2000/svg', t);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // ── capa de dibujo ────────────────────────────────────────────────────
  function layer(stage){
    let g = stage.querySelector('.bkc-guides');
    if (!g){
      g = ns('svg');
      g.setAttribute('class', 'bkc-guides');
      g.setAttribute('aria-hidden', 'true');
      stage.appendChild(g);
    }
    const W = stage.offsetWidth, H = stage.offsetHeight;
    g.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    g.setAttribute('width', W); g.setAttribute('height', H);
    g.innerHTML = '';
    return g;
  }
  function clear(stage){
    const s = stage || (ST && ST.stage);
    if (!s) return;
    const g = s.querySelector('.bkc-guides');
    if (g) g.remove();
  }

  // ── rectángulos en coordenadas del LIENZO (sin escala) ────────────────
  // offsetWidth/offsetTop no llevan la escala del zoom: son ya unidades del
  // lienzo, así que no hay que mezclar coordenadas de pantalla con las de aquí.
  function rectOf(el, x, y){
    const w = el.offsetWidth, h = el.offsetHeight;
    const card = el.querySelector('.mbk-match');
    const mid = card ? card.offsetTop + card.offsetHeight / 2 : h / 2;
    return { l:x, t:y, r:x + w, b:y + h, cx:x + w / 2, cy:y + h / 2, cyCard:y + mid, w, h };
  }
  const shift = (r, dx, dy) => ({ l:r.l + dx, r:r.r + dx, cx:r.cx + dx,
    t:r.t + dy, b:r.b + dy, cy:r.cy + dy, cyCard:r.cyCard + dy, w:r.w, h:r.h, id:r.id });
  function union(list){
    const u = { l:Infinity, t:Infinity, r:-Infinity, b:-Infinity };
    list.forEach(r => { u.l = Math.min(u.l, r.l); u.t = Math.min(u.t, r.t);
                        u.r = Math.max(u.r, r.r); u.b = Math.max(u.b, r.b); });
    u.w = u.r - u.l; u.h = u.b - u.t; u.cx = (u.l + u.r) / 2; u.cy = (u.t + u.b) / 2;
    // con un solo nodo el centro útil es el de su tarjeta; con varios, el del grupo
    u.cyCard = list.length === 1 ? list[0].cyCard : u.cy;
    return u;
  }

  // ── prioridad de las referencias (§4) ─────────────────────────────────
  // 0 conectado · 1 hermano que alimenta al mismo sitio · 2 misma ronda · 3 resto
  function priorityMap(cfg, moverIds){
    const live = (cfg.connections || []).filter(c => c && c.enabled !== false);
    const mov = new Set(moverIds);
    const targets = new Set(live.filter(c => mov.has(c.fromSlot)).map(c => c.toSlot));
    const sources = new Set(live.filter(c => mov.has(c.toSlot)).map(c => c.fromSlot));
    const rounds = new Set(moverIds.map(m => cfg.slots[m] && cfg.slots[m].roundId).filter(Boolean));
    return id => {
      if (id === '__c') return 1;                       // el bloque central siempre pesa
      if (live.some(c => (mov.has(c.fromSlot) && c.toSlot === id) ||
                         (mov.has(c.toSlot) && c.fromSlot === id))) return 0;
      if (live.some(c => c.fromSlot === id && targets.has(c.toSlot)) || sources.has(id)) return 1;
      const s = cfg.slots[id];
      if (s && rounds.has(s.roundId)) return 2;
      return 3;
    };
  }

  // ── inicio del arrastre ───────────────────────────────────────────────
  function begin(o){
    o = o || {};
    const stage = o.stage, cfg = o.cfg;
    if (!stage || !cfg){ ST = null; return; }
    const moverIds = (o.moverIds || []).slice();
    const movers = [], statics = [];
    stage.querySelectorAll('.bkc-node').forEach(el => {
      const id = el.getAttribute('data-slot');
      const s = cfg.slots[id];
      if (!s || !s.layout || s.visible === false) return;
      const r = rectOf(el, s.layout.x, s.layout.y);
      r.id = id;
      (moverIds.indexOf(id) >= 0 ? movers : statics).push(r);
    });
    const cel = stage.querySelector('.bkc-center');
    if (cel && cfg.canvas && cfg.canvas.center && cfg.canvas.center.visible !== false){
      const c = cfg.canvas.center;
      const r = rectOf(cel, Number(c.x) || 0, Number(c.y) || 0);
      r.id = '__c'; r.isCenter = true;
      (o.movingCenter ? movers : statics).push(r);
    }
    // Los rótulos del cuadro también entran al juego de guías: se alinean entre
    // sí y con las columnas de tarjetas, con las mismas distancias iguales.
    const moverBands = (o.moverBands || []).slice();
    stage.querySelectorAll('.bkc-band').forEach(el => {
      const id = el.getAttribute('data-band');
      const b = (cfg.canvas.bands || []).find(x => x.id === id);
      if (!b) return;
      const r = rectOf(el, Number(b.x) || 0, Number(b.y) || 0);
      r.id = id; r.isBand = true;
      (moverBands.indexOf(id) >= 0 ? movers : statics).push(r);
    });
    if (!movers.length){ ST = null; return; }
    const pri = priorityMap(cfg, moverIds);
    const base = union(movers);
    statics.forEach(r => {
      r.pri = pri(r.id);
      r.dist = Math.hypot(r.cx - base.cx, r.cy - base.cy);
    });
    statics.sort((a, b) => (a.pri - b.pri) || (a.dist - b.dist));
    ST = { stage, cfg, movers, statics, base,
      refs: statics.slice(0, MAX_REFS),
      k: Number(o.k) || 1,
      on: !(cfg.canvas && cfg.canvas.guides === false),
      axisX: cfg.canvas && cfg.canvas.center
        ? (Number(cfg.canvas.center.x) || 0) + (cel ? cel.offsetWidth / 2 : 125) : null };
    return ST;
  }

  // ── resolución de un eje ──────────────────────────────────────────────
  function pick(A, d, tol){
    const m = shiftBBox(A, d);
    const cands = [];
    const add = (kind, delta, key, refs, value) => {
      if (!isFinite(delta) || Math.abs(delta) > tol) return;
      cands.push({ kind, delta, key, refs, value, pri: Math.min.apply(null, refs.map(r => r.pri == null ? 3 : r.pri)) });
    };
    // 1) alineación: borde con borde y centro con centro
    ST.statics.forEach(s => {
      ['lo','mid','hi'].forEach(k => add('align', s[A[k]] - m[k], k, [s], null));
    });
    // 2) separaciones iguales y reflejos, solo entre las referencias con prioridad
    ST.refs.forEach(P => ST.refs.forEach(Q => {
      if (P === Q) return;
      const gap = Q[A.lo] - P[A.hi];
      if (gap >= 0){
        add('gap', (P[A.lo] - gap) - m.hi, 'hi', [P, Q], gap);        // M · P · Q
        add('gap', (Q[A.hi] + gap) - m.lo, 'lo', [P, Q], gap);        // P · Q · M
        // Centrar entre P y Q solo si el nodo CABE: si no, los dos huecos
        // salen negativos e iguales y el imán arrastraba a una posición con
        // las tarjetas encimadas, rotulada «-6 px = -6 px».
        if (gap >= (m.hi - m.lo))
          add('between', ((P[A.hi] + Q[A.lo]) / 2) - (m.lo + m.hi) / 2, 'mid', [P, Q], null); // P · M · Q
      }
      if (Math.abs(P[A.mid] - Q[A.mid]) >= 1)
        add('mirror', (2 * P[A.mid] - Q[A.mid]) - m.mid, 'mid', [P, Q],
          Math.abs(P[A.mid] - Q[A.mid]));                              // M y Q reflejados en P
    }));
    // 3) reflejo respecto al eje del bloque central (sin nodo en medio)
    if (A.axis === 'x' && ST.axisX != null)
      ST.refs.forEach(Q => {
        if (Math.abs(ST.axisX - Q[A.mid]) >= 1)
          add('axis', (2 * ST.axisX - Q[A.mid]) - m.mid, 'mid', [Q],
            Math.abs(ST.axisX - Q[A.mid]));
      });
    if (!cands.length) return { d, hit:false };
    const rank = { align:0, gap:1, between:1, mirror:1, axis:2 };
    // La simetría respecto a un nodo CONECTADO pesa más: si está casi a tiro,
    // gana aunque haya una alineación suelta un par de píxeles más cerca. Si no,
    // el imán se enganchaba a cualquier borde y nunca se llegaba a la posición
    // simétrica que se estaba buscando.
    const score = x => Math.max(0, Math.abs(x.delta) - (x.kind !== 'align' && x.pri === 0 ? 2 : 0));
    cands.sort((a, b) => (score(a) - score(b)) || (rank[a.kind] - rank[b.kind]) || (a.pri - b.pri));
    const w = cands[0];
    return { d: d + w.delta, hit:true, win:w };
  }
  function shiftBBox(A, d){
    const b = ST.base;
    const dx = A.axis === 'x' ? d : 0, dy = A.axis === 'x' ? 0 : d;
    const s = { l:b.l + dx, r:b.r + dx, cx:b.cx + dx, t:b.t + dy, b:b.b + dy,
      cy:b.cy + dy, cyCard:b.cyCard + dy };
    return { lo:s[A.lo], mid:s[A.mid], hi:s[A.hi], box:s };
  }
  // Todas las referencias que coinciden EXACTAMENTE con la posición final
  function aligned(A, d){
    const m = shiftBBox(A, d);
    const out = [];
    ST.statics.forEach(s => {
      ['lo','mid','hi'].forEach(k => {
        if (Math.abs(s[A[k]] - m[k]) <= EPS) out.push({ key:k, v:s[A[k]], ref:s, pri:s.pri, dist:s.dist });
      });
    });
    out.sort((a, b) => (a.pri - b.pri) || (a.dist - b.dist));
    const seen = new Set();
    return out.filter(g => { const t = g.key + ':' + Math.round(g.v); if (seen.has(t)) return false; seen.add(t); return true; })
      .slice(0, MAX_GUIDES);
  }

  // ── dibujo ────────────────────────────────────────────────────────────
  function line(g, x1, y1, x2, y2, cls){
    const e = ns('line');
    e.setAttribute('x1', Math.round(x1)); e.setAttribute('y1', Math.round(y1));
    e.setAttribute('x2', Math.round(x2)); e.setAttribute('y2', Math.round(y2));
    e.setAttribute('class', cls);
    g.appendChild(e);
    return e;
  }
  function label(g, x, y, text, A){
    const k = ST.k || 1;
    const fs = 11 / k, padX = 5 / k, padY = 3 / k;
    const w = String(text).length * fs * 0.58 + padX * 2, h = fs + padY * 2;
    // Las dos relaciones que puede devolver `measures()` para un mismo eje
    // suelen caer casi en el mismo punto, y las cajas oscuras se encimaban
    // dejando los dos textos ilegibles. Se aparta la nueva a lo largo del eje
    // perpendicular a la medición hasta que no toque a ninguna ya colocada.
    // Se apila SIEMPRE en vertical, un renglón por paso. Apartando a lo ancho,
    // una medición vertical mandaba la etiqueta a 400 u de su propia línea
    // —fuera de la pantalla— porque el paso era el ancho del propio texto.
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const at = (px, py) => ({ l:px - w / 2, r:px + w / 2, t:py - h / 2, b:py + h / 2 });
    const step = h + 5 / k;
    const by = y;
    for (let i = 0; i < 5; i++){
      y = by + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step);
      if (!ST.labels.some(p => hit(at(x, y), p))) break;
    }
    ST.labels.push(at(x, y));
    const r = ns('rect');
    r.setAttribute('x', x - w / 2); r.setAttribute('y', y - h / 2);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', 3 / k); r.setAttribute('class', 'g-bg');
    g.appendChild(r);
    const t = ns('text');
    t.setAttribute('x', x); t.setAttribute('y', y + fs * 0.35);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', fs);
    t.setAttribute('class', 'g-txt');
    t.textContent = text;
    g.appendChild(t);
  }
  // Segmento de medición con marcas en los extremos. `skip` omite la marca de
  // un extremo cuando lo comparte con el segmento contiguo, para no dibujarla
  // dos veces exactamente encima de sí misma.
  function measure(g, A, a1, a2, cross, skip){
    const H = A.axis === 'x';
    const tick = 7 / (ST.k || 1) * 1.4;
    if (H){
      line(g, a1, cross, a2, cross, 'g-meas');
      if (skip !== 1) line(g, a1, cross - tick, a1, cross + tick, 'g-meas');
      if (skip !== 2) line(g, a2, cross - tick, a2, cross + tick, 'g-meas');
    } else {
      line(g, cross, a1, cross, a2, 'g-meas');
      if (skip !== 1) line(g, cross - tick, a1, cross + tick, a1, 'g-meas');
      if (skip !== 2) line(g, cross - tick, a2, cross + tick, a2, 'g-meas');
    }
  }
  // TODAS las relaciones de distancia igual que se cumplen en la posición
  // final, no solo la que ganó el imán: si al mover un nodo quedan iguales dos
  // separaciones distintas, se marcan las dos.
  const MAX_MEAS = 2;
  function measures(A, d){
    const m = shiftBBox(A, d);
    const eq = (a, b) => Math.abs(a - b) <= EPS + 0.5;
    const out = [];
    ST.refs.forEach(P => ST.refs.forEach(Q => {
      if (P === Q) return;
      const gap = Q[A.lo] - P[A.hi];
      if (gap >= 0){
        if (eq(m.hi, P[A.lo] - gap)) out.push({ kind:'gap', key:'hi', refs:[P, Q], value:gap });
        if (eq(m.lo, Q[A.hi] + gap)) out.push({ kind:'gap', key:'lo', refs:[P, Q], value:gap });
        // Se acepta comparando los huecos TAL COMO se rotulan, no el centro
        // contra el punto medio: en el eje Y el «centro» es el de la tarjeta,
        // que va 9 px por debajo del centro de la caja porque la etiqueta del
        // nodo se dibuja encima. Comparando centros salía rotulado
        // «19 px = 37 px» — dos números distintos presentados como iguales.
        // Solo si el nodo cabe en el hueco (ver pick): dos huecos negativos
        // también son «iguales», pero significan tarjetas encimadas.
        if (gap >= (m.hi - m.lo) && eq(m.lo - P[A.hi], Q[A.lo] - m.hi))
          out.push({ kind:'between', refs:[P, Q], value:(m.lo - P[A.hi] + Q[A.lo] - m.hi) / 2 });
      }
      // Un reflejo de distancia cero no es una relación de distancia sino una
      // alineación —que la guía cian ya comunica—: salía como «0 px = 0 px» con
      // dos segmentos de largo cero, y además gastaba uno de los dos huecos.
      if (Math.abs(P[A.mid] - Q[A.mid]) >= 1 && eq(m.mid, 2 * P[A.mid] - Q[A.mid]))
        out.push({ kind:'mirror', refs:[P, Q], value:Math.abs(P[A.mid] - Q[A.mid]) });
    }));
    if (A.axis === 'x' && ST.axisX != null) ST.refs.forEach(Q => {
      if (Math.abs(ST.axisX - Q[A.mid]) >= 1 && eq(m.mid, 2 * ST.axisX - Q[A.mid]))
        out.push({ kind:'axis', refs:[Q], value:Math.abs(ST.axisX - Q[A.mid]) });
    });
    const rank = { gap:0, between:1, mirror:2, axis:3 };
    out.forEach(o => { o.pri = Math.min.apply(null, o.refs.map(r => r.pri == null ? 3 : r.pri)); });
    out.sort((a, b) => (a.pri - b.pri) || (rank[a.kind] - rank[b.kind]));
    // Deduplicar por la GEOMETRÍA que se va a dibujar, no por ids: las rondas
    // se reparten en columnas, así que dos nodos de la misma columna comparten
    // borde izquierdo y derecho y producen un enunciado idéntico en el eje X
    // (lo mismo en Y con los nodos de la misma fila). Deduplicando por id, los
    // dos pares sobrevivían y se dibujaban los mismos segmentos y la misma
    // etiqueta encimados.
    const key = o => {
      const P = o.refs[0], Q = o.refs[1];
      const r = n => Math.round(n);
      if (o.kind === 'gap')     return 'gap:' + o.key + ':' + r(P[A.hi]) + ',' + r(Q[A.lo]) + ',' + r(o.value);
      if (o.kind === 'between') return 'between:' + r(P[A.hi]) + ',' + r(Q[A.lo]);
      if (o.kind === 'axis')    return 'axis:' + r(P[A.mid]) + ',' + r(o.value);
      return 'mirror:' + r(P[A.mid]) + ',' + r(Q[A.mid]);
    };
    const seen = new Set(), res = [];
    for (const o of out){
      const t = key(o);
      if (seen.has(t)) continue;
      seen.add(t);
      res.push(o);
      if (res.length >= MAX_MEAS) break;
    }
    return res;
  }
  function drawAxis(g, A, d){
    const m = shiftBBox(A, d);
    aligned(A, d).forEach(gd => {
      const lo = Math.min(m.box[A.olo], gd.ref[A.olo]) - PAD;
      const hi = Math.max(m.box[A.ohi], gd.ref[A.ohi]) + PAD;
      if (A.axis === 'x') line(g, gd.v, lo, gd.v, hi, 'g-align');
      else line(g, lo, gd.v, hi, gd.v, 'g-align');
    });
    measures(A, d).forEach(w => {
      const P = w.refs[0], Q = w.refs[1];
      if (w.kind === 'between'){
        const cross = (m.box[A.omid] + P[A.omid] + Q[A.omid]) / 3;
        measure(g, A, P[A.hi], m.lo, cross);
        measure(g, A, m.hi, Q[A.lo], cross, 1);
        // Un solo valor para los dos lados, como en `gap` y `mirror`: si se
        // redondea cada hueco por separado, la tolerancia de ±1 px permitía
        // rotular «6 px = 7 px».
        const v = Math.round(w.value);
        label(g, ...at(A, (P[A.hi] + m.lo) / 2, cross), v + ' px = ' + v + ' px', A);
        return;
      }
      if (w.kind === 'gap'){
        const before = w.key === 'hi';
        const s1 = before ? [m.hi, P[A.lo]] : [Q[A.hi], m.lo];
        const cross = (m.box[A.omid] + P[A.omid]) / 2;
        measure(g, A, s1[0], s1[1], cross);
        measure(g, A, P[A.hi], Q[A.lo], (P[A.omid] + Q[A.omid]) / 2);
        const v = Math.round(w.value);
        label(g, ...at(A, (s1[0] + s1[1]) / 2, cross), v + ' px = ' + v + ' px', A);
        return;
      }
      const pivot = w.kind === 'axis' ? ST.axisX : P[A.mid];
      const other = w.kind === 'axis' ? P[A.mid] : Q[A.mid];
      const cross = (m.box[A.omid] + P[A.omid]) / 2;
      measure(g, A, m.mid, pivot, cross);
      measure(g, A, pivot, other, cross, 1);
      const v = Math.round(Math.abs(pivot - m.mid));
      label(g, ...at(A, (m.mid + pivot) / 2, cross), v + ' px = ' + v + ' px', A);
      if (A.axis === 'x' && w.kind === 'axis')
        line(g, pivot, m.box.t - PAD, pivot, m.box.b + PAD, 'g-axis');
    });
  }
  const at = (A, along, cross) => A.axis === 'x' ? [along, cross] : [cross, along];

  // ── API del arrastre ──────────────────────────────────────────────────
  function solve(dx, dy, free){
    if (!ST) return { dx, dy, snapX:false, snapY:false };
    clear(ST.stage);
    if (free || !ST.on) return { dx, dy, snapX:false, snapY:false };
    const tol = TOL_SCREEN / (ST.k || 1);
    const X = pick(AX, dx, tol), Y = pick(AY, dy, tol);
    const g = layer(ST.stage);
    ST.labels = [];
    drawAxis(g, AX, X.d);
    drawAxis(g, AY, Y.d);
    if (!g.childNodes.length) clear(ST.stage);
    return { dx:X.d, dy:Y.d, snapX:X.hit, snapY:Y.hit };
  }
  function end(){ clear(); ST = null; }

  // ── guías para el extremo de una conexión (§5) ────────────────────────
  // Las líneas se recalculan solas y no tienen puntos intermedios, así que lo
  // útil aquí es enseñar con qué está alineado el extremo que se arrastra.
  // Solo dibuja: no ajusta, porque el extremo ya se pega al anclaje.
  function beginPoint(o){
    o = o || {};
    if (!o.stage || !o.cfg){ ST = null; return; }
    const rows = [], cols = [];
    o.stage.querySelectorAll('.bkc-node').forEach(el => {
      const id = el.getAttribute('data-slot');
      const s = o.cfg.slots[id];
      if (!s || !s.layout || s.visible === false) return;
      const r = rectOf(el, s.layout.x, s.layout.y);
      rows.push({ v:r.cyCard, box:r });
      el.querySelectorAll('.bkc-port').forEach(p => rows.push({ v:s.layout.y + p.offsetTop + p.offsetHeight / 2, box:r }));
      cols.push({ v:r.l, box:r }, { v:r.cx, box:r }, { v:r.r, box:r });
    });
    ST = { stage:o.stage, cfg:o.cfg, k:Number(o.k) || 1, point:true, rows, cols,
      on: !(o.cfg.canvas && o.cfg.canvas.guides === false) };
  }
  function solvePoint(p){
    if (!ST || !ST.point) return;
    clear(ST.stage);
    if (!ST.on || !p) return;
    const tol = TOL_SCREEN / (ST.k || 1);
    const g = layer(ST.stage);
    ST.labels = [];
    const near = (list, v) => list.filter(x => Math.abs(x.v - v) <= tol)
      .sort((a, b) => Math.abs(a.v - v) - Math.abs(b.v - v)).slice(0, 1);
    near(ST.rows, p.y).forEach(x =>
      line(g, Math.min(x.box.l, p.x) - PAD, x.v, Math.max(x.box.r, p.x) + PAD, x.v, 'g-align'));
    near(ST.cols, p.x).forEach(x =>
      line(g, x.v, Math.min(x.box.t, p.y) - PAD, x.v, Math.max(x.box.b, p.y) + PAD, 'g-align'));
    if (!g.childNodes.length) clear(ST.stage);
  }

  global.FI_BKT_GUIDES = { begin, solve, end, clear, beginPoint, solvePoint,
    TOL_SCREEN, active: () => !!ST };
})(typeof window !== 'undefined' ? window : globalThis);
