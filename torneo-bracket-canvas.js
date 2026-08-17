// ── Renderer del BRACKET EN LIENZO LIBRE (compartido) ───────────────────
// Mismo lenguaje visual que el bracket de columnas (.mbk-match/.mbk-chip/
// placa/cerdito): lo único que cambia es que cada nodo se posiciona en
// coordenadas propias y las conexiones se dibujan ortogonales.
//   · público  → solo lectura, sin puertos, sin cuadrícula, escalado a la pantalla.
//   · editor   → puertos visibles, cuadrícula opcional, selección resaltada.
(function(global){
  'use strict';
  const CFG = () => global.SB_BRACKETCFG;
  const CV  = () => global.FI_BKT_CANVAS;
  const BKT = () => global.TORNEO_BKT;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function nameOf(who, fallback){
    if (!who) return fallback;
    if (who.displayName && who.displayName !== 'Por definir') return who.displayName;
    return fallback;
  }

  function centerHTML(cfg, opts){
    const h = cfg.header || {};
    const ed = opts.editable ? 'bk-editable' : '';
    const champ = CFG().derivedWinner(cfg, 'champion');
    const sub = CFG().derivedWinner(cfg, 'runnerUp');
    const c = cfg.canvas.center || { x:0, y:0 };
    return `<div class="bkc-center" style="left:${Math.round(c.x)}px;top:${Math.round(c.y)}px">
      <div class="lbl">${esc(h.championLabel || 'Campeón')}<small>${esc(opts.catLabel || h.categoryLabel || '')}</small></div>
      <div class="plaque mbk-champ-plaque ${ed}" data-slot="champion"><img class="plaque-img" src="assets/plaque-frame-sm.png" alt=""><div class="plate-text"><span class="ed">${esc(h.editionLabel || 'Edición 2027-1')}</span><span class="nm">${esc(nameOf(champ, '?'))}</span></div></div>
      <div class="bkc-finalgap"></div>
      <div class="mbk-sub ${ed}" data-slot="runnerUp"><span class="sh">🛡️</span><b>${esc(h.runnerUpLabel || 'Subcampeón')}</b><i>${esc(nameOf(sub, 'por definir'))}</i></div>
      <div class="mbk-trophy"><img src="assets/piggy-gold.png?v=15" alt="Trofeo puerquito dorado"></div>
    </div>`;
  }

  function nodeHTML(cfg, id, slot, res, opts, z){
    const bye = CV().isBye(slot);
    const v = res.view;
    const L = slot.layout || { x:0, y:0, dir:'LR' };
    const opp = L.dir === 'RL' ? 'R' : 'L';
    const inA = L.inA === 'L' || L.inA === 'R' ? L.inA : opp;
    const inB = L.inB === 'L' || L.inB === 'R' ? L.inB : opp;
    const label = CV().nodeLabel(cfg, id);
    const join = L.join !== false;
    const outSide = L.dir === 'RL' ? 'L' : 'R';
    const kind = CV().kindOf(cfg, id);
    const isFinal = kind === 'final';
    // La tarjeta la dibuja el renderer OFICIAL: misma piel que las columnas.
    const view = { slotType: bye ? 'DIRECT_PASS' : 'MATCH', a: res.a, b: res.b,
      scoreA: v.scoreA, scoreB: v.scoreB, winner: v.winner, visible: true,
      sourceLabel: slot.sourceLabel || v.sourceLabel || null,
      officialUnavailable: v.officialUnavailable };
    const card = BKT().cardHTML(id, view, {
      editable: opts.editable, side: L.dir === 'RL' ? 'r' : 'l', chipSides: true,
      slotAttr: 'data-card', entry: (opts.entries || {})[id],
      head: isFinal ? `<div class="fl">${esc((cfg.header && cfg.header.finalLabel) || 'La Final')}</div>` : '' });
    // Anclajes FIJOS: tres por lado (superior, centro, inferior). No se puede
    // conectar en ningún otro punto. El centro del lado de salida es la salida
    // del ganador; el del otro lado es la entrada común de las líneas fusionadas.
    const port = (spot, side) => {
      if (spot === 'B' && bye) return '';
      const isOut = spot === 'C' && side === outSide;
      const linked = spot !== 'C' && !!CV().inAt(cfg, id, spot);
      const t = isOut ? 'Salida: el ganador de este enfrentamiento'
        : spot === 'C' ? 'Entrada común: las líneas se unen aquí y ocupan el primer espacio libre'
        : (linked ? 'Recibe al ganador de otro enfrentamiento · arrastra para moverla'
                  : 'Entrada al espacio ' + (spot === 'A' ? 'superior' : 'inferior'));
      return `<span class="bkc-port ${isOut ? 'out' : 'in'}${spot === 'C' ? ' center' : ''}${linked ? ' linked' : ''}" data-port="${isOut ? 'OUT' : spot}" data-spot="${spot}" data-side="${side}" title="${t}"></span>`;
    };
    const ports = opts.showPorts
      ? ['L','R'].map(side => port('A', side) + port('B', side) + port('C', side)).join('')
      : '';
    // La etiqueta es chrome del EDITOR: flota sobre la tarjeta y no ocupa sitio,
    // así que el nodo mide lo mismo que la tarjeta del bracket en columnas.
    const tag = opts.editable
      ? `<div class="bkc-nlabel"><b>${esc(label)}</b>${v.status && v.status !== 'PROVISIONAL' ? `<span>${esc(v.status)}</span>` : ''}</div>`
      : '';
    return `<div class="bkc-node kind-${kind}${bye ? ' is-bye' : ''}${isFinal ? ' is-final' : ''}${slot.visible === false ? ' is-hidden' : ''}" data-slot="${esc(id)}" data-dir="${L.dir === 'RL' ? 'RL' : 'LR'}" data-in-a="${inA}" data-in-b="${inB}" data-join="${join ? '1' : '0'}" style="left:${Math.round(L.x)}px;top:${Math.round(L.y)}px;z-index:${z}">${tag}${card}${ports}</div>`;
  }

  // Rótulos del cuadro: encabezados de ronda y banda del sistema. Misma piel
  // que las bandas del bracket en columnas (.mbk-rlabels / .mbk-sys).
  function bandHTML(b){
    const tone = b.tone === 'gold' ? ' gold' : b.tone === 'flank' ? ' flank' : '';
    const pos = `left:${Math.round(b.x)}px;top:${Math.round(b.y)}px` + (b.w ? `;width:${Math.round(b.w)}px` : '');
    if (b.kind === 'sys')
      return `<div class="bkc-band sys" data-band="${esc(b.id)}" style="${pos}"><b>${esc(b.text)}</b>${
        b.sub ? `<span>${esc(b.sub)}</span>` : ''}</div>`;
    return `<div class="bkc-band${tone}" data-band="${esc(b.id)}" style="${pos}"><i>${esc(b.text)}</i></div>`;
  }

  // Banda superior: mismo bloque informativo que el bracket de columnas.
  function sysBand(cfg){
    const st = CV().stats(cfg);
    let label = 'LLAVE ELIMINATORIA';
    try {
      const p = global.FI_BKT_TOPO && global.FI_BKT_TOPO.buildPlan(cfg.format);
      if (p && p.systemLabel) label = p.systemLabel;
    } catch(e){}
    const bits = [(st.nodes - st.byes) + ' enfrentamiento' + (st.nodes - st.byes === 1 ? '' : 's')];
    if (st.byes) bits.push(st.byes + ' descanso' + (st.byes === 1 ? '' : 's') + ' (BYE)');
    return `<div class="mbk-sys"><b>${esc(label)}</b><span>${esc(bits.join(' · '))}</span></div>`;
  }

  // ── render principal ──────────────────────────────────────────────────
  function planOf(cfg){
    try {
      return (global.FI_BKT_TOPO && global.FI_BKT_TOPO.buildPlan(cfg.format)) || null;
    } catch(e){ return null; }
  }
  // Puerquito dorado: adorno del cuadro. Posición y tamaño salen de la
  // configuración (cfg.canvas.piggy), así que cada bracket lo acomoda a su
  // gusto desde el editor; en el editor se arrastra como cualquier pieza.
  // Si el modelo cargado es una versión vieja (sin piggyBox), se calcula aquí:
  // el adorno nunca debe tumbar el render del cuadro.
  function piggyBoxSafe(cfg){
    const M = CV();
    if (M && typeof M.piggyBox === 'function'){
      try { return M.piggyBox(cfg); } catch(e){}
    }
    const p = (cfg && cfg.canvas && cfg.canvas.piggy) || {};
    const w = Math.max(40, Math.min(520, Number(p.w) || 150));
    const c = (cfg && cfg.canvas && cfg.canvas.center) || {};
    const cx = Number.isFinite(Number(c.x)) ? Number(c.x) : 1900;
    const cy = Number.isFinite(Number(c.y)) ? Number(c.y) : 382;
    const px = Number(p.x), py = Number(p.y);
    const placed = Number.isFinite(px) && Number.isFinite(py) && !(px === 0 && py === 0);
    return { visible: p.visible !== false,
      x: placed ? px : Math.round(cx + (344 - w) / 2),
      y: placed ? py : Math.round(cy - 68.5 - w / 2),
      w, h: w };
  }

  function piggyHTML(cfg, opts){
    const p = piggyBoxSafe(cfg);
    if (!p.visible) return '';
    return `<div class="bkc-piggy${opts && opts.editable ? ' editable' : ''}" data-piggy="1"` +
      ` style="left:${Math.round(p.x)}px;top:${Math.round(p.y)}px;width:${Math.round(p.w)}px;height:${Math.round(p.h)}px"` +
      ` aria-hidden="true"><img src="assets/piggy-final.gif?v=1" alt="" draggable="false"></div>`;
  }

  function render(host, cfg, opts){
    opts = opts || {};
    CV().ensure(cfg);
    const res = CV().resolve(cfg);
    const plan = planOf(cfg);
    opts = Object.assign({}, opts, { entries: (plan && plan.entries) || {} });
    const order = cfg.canvas.order.filter(id => cfg.slots[id]);
    const shownIds = order.filter(id => opts.editable || cfg.slots[id].visible !== false);
    const grid = opts.editable && cfg.canvas.grid && cfg.canvas.grid.on;
    const nodesHTML = shownIds.map((id, i) => nodeHTML(cfg, id, cfg.slots[id], res[id], opts, 10 + i)).join('');
    const bandsHTML = (cfg.canvas.bands || []).map(bandHTML).join('');
    const stageHTML = `<div class="bkc-stage${grid ? ' grid' : ''}" style="width:${cfg.canvas.width}px;height:${cfg.canvas.height}px;--bkc-grid:${(cfg.canvas.grid && cfg.canvas.grid.size) || 20}px">
      <svg class="bkc-lines" aria-hidden="true"></svg>
      ${bandsHTML}
      ${piggyHTML(cfg, opts)}
      ${cfg.canvas.center && cfg.canvas.center.visible !== false ? centerHTML(cfg, opts) : ''}
      ${nodesHTML}</div>`;
    host.innerHTML = opts.publicShell ? '<div class="bkc-box"><div class="bkc-atmo" aria-hidden="true"></div><div class="bkc-scroll"><div class="bkc-viewport">' + stageHTML + '</div></div></div>' : stageHTML;
    const stage = host.querySelector('.bkc-stage');
    stage.__cfg = cfg;
    if (opts.editable && typeof opts.onEditSlot === 'function'){
      host.querySelectorAll('[data-slot="champion"],[data-slot="runnerUp"]').forEach(el =>
        el.addEventListener('click', e => { e.preventDefault(); opts.onEditSlot(el.getAttribute('data-slot')); }));
    }
    drawLines(stage, opts);
    return stage;
  }

  // ── geometría ─────────────────────────────────────────────────────────
  function metrics(stage){
    const R = stage.getBoundingClientRect();
    const k = stage.offsetWidth ? R.width / stage.offsetWidth : 1;
    const to = r => ({ l:(r.left - R.left) / k, r:(r.right - R.left) / k,
                       t:(r.top - R.top) / k, b:(r.bottom - R.top) / k,
                       cx:((r.left + r.right) / 2 - R.left) / k, cy:((r.top + r.bottom) / 2 - R.top) / k });
    const M = {};
    // La gran final vive DENTRO del bloque central, que se pinta por encima de
    // las líneas: si una línea apuntara al borde de la tarjeta se perdería bajo
    // el panel. Como en el bracket publicado, las líneas mueren en el borde del
    // BLOQUE, no en el de la tarjeta.
    const cenEl = stage.querySelector('.bkc-center');
    const cen = cenEl ? to(cenEl.getBoundingClientRect()) : null;
    stage.querySelectorAll('.bkc-node').forEach(el => {
      const id = el.getAttribute('data-slot');
      let box = to(el.getBoundingClientRect());
      const cardEl = el.querySelector('.mbk-match');
      const card = cardEl ? to(cardEl.getBoundingClientRect()) : box;
      if (cen && el.classList.contains('is-final'))
        box = Object.assign({}, box, { l: Math.min(box.l, cen.l), r: Math.max(box.r, cen.r) });
      const spots = {};
      el.querySelectorAll('[data-side]').forEach(c => { spots[c.getAttribute('data-side')] = to(c.getBoundingClientRect()); });
      M[id] = { el, box, card, spots, dir: el.getAttribute('data-dir') === 'RL' ? 'RL' : 'LR',
        join: el.getAttribute('data-join') !== '0',
        inA: el.getAttribute('data-in-a') === 'R' ? 'R' : 'L',
        inB: el.getAttribute('data-in-b') === 'R' ? 'R' : 'L' };
    });
    return M;
  }
  const STUB = 18;
  // El brazo se ajusta al hueco REAL entre las dos tarjetas. Con el reparto del
  // bracket publicado las columnas quedan a 40 px, así que un brazo fijo de
  // 18+18 px no dejaba sitio al tronco: la línea se creía «sin salida» y daba
  // un rodeo por encima del cuadro.
  function arm(ax, bx){ return Math.max(5, Math.min(STUB, Math.abs(bx - ax) / 2 - 1)); }
  function outPoint(m){
    const y = (m.card || m.box).cy;
    return m.dir === 'RL' ? { x:m.box.l, y, s:-1 } : { x:m.box.r, y, s:1 };
  }
  function inPoint(m, side){
    const sp = m.spots[side] || m.spots.A || m.box;
    const on = (side === 'B' ? m.inB : m.inA) === 'R' ? 'R' : 'L';
    return on === 'R' ? { x:m.box.r, y:sp.cy, s:1 } : { x:m.box.l, y:sp.cy, s:-1 };
  }
  // Punto ÚNICO de unión: centro vertical del lado por el que entran las líneas.
  // Es el que usa el dibujo «fusionado», igual que una llave clásica.
  function joinPoint(m, on){
    const c = m.card || m.box;
    return on === 'R' ? { x:m.box.r, y:c.cy, s:1 } : { x:m.box.l, y:c.cy, s:-1 };
  }

  // Trayectoria ortogonal: Z simple si hay espacio; rodeo por arriba/abajo si
  // el destino queda «detrás» del origen (para no atravesar los nodos).
  // trunk: x compartida por las entradas que convergen al mismo lado.
  function route(a, b, ma, mb, lane, trunk){
    const k = arm(a.x, b.x);
    const p0 = { x:a.x, y:a.y };
    const p1 = { x:a.x + a.s * k, y:a.y };
    const p3 = { x:b.x, y:b.y };
    const p2 = { x:b.x + b.s * k, y:b.y };
    // ¿El destino está del lado por el que sale el ganador? Se mide entre los
    // BORDES de las tarjetas, no después de los brazos: si no, dos columnas
    // juntas parecían imposibles de unir.
    const forward = a.s > 0 ? b.x > a.x + 6 : b.x < a.x - 6;
    const pts = [p0, p1];
    if (forward){
      let mx = trunk != null ? trunk : (p1.x + p2.x) / 2 + lane;
      const lo = Math.min(a.x, b.x) + 2, hi = Math.max(a.x, b.x) - 2;
      mx = Math.min(Math.max(mx, lo), hi);
      // Codo limpio de llave clásica: sale, sube o baja por el tronco y entra.
      // Sin los brazos intermedios, que con columnas juntas se solían quedar por
      // detrás del tronco y dibujaban un diente.
      return dedupe([p0, { x:mx, y:p0.y }, { x:mx, y:p3.y }, p3]);
    }
    {
      const top = Math.min(ma.box.t, mb.box.t) - 26 - Math.abs(lane);
      const bot = Math.max(ma.box.b, mb.box.b) + 26 + Math.abs(lane);
      const yy = (Math.abs(top - (p1.y + p2.y) / 2) <= Math.abs(bot - (p1.y + p2.y) / 2)) ? top : bot;
      return dedupe([p0, p1, { x:p1.x, y:yy }, { x:p2.x, y:yy }, p2, p3]);
    }
  }
  function dedupe(pts){
    const out = [];
    pts.forEach(p => {
      const q = out[out.length - 1];
      if (!q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5) out.push(p);
    });
    return out;
  }

  function drawLines(stage, opts){
    if (!stage) return;
    opts = opts || {};
    const cfg = stage.__cfg;
    if (!cfg) return;
    const svg = stage.querySelector('.bkc-lines');
    if (!svg) return;
    const W = stage.offsetWidth, H = stage.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    const M = metrics(stage);
    const selN = opts.selectedNodes || new Set();
    const selE = opts.selectedEdges || new Set();
    const conns = CV().live(cfg).filter(c => M[c.fromSlot] && M[c.toSlot]);
    // Las entradas que llegan al MISMO lado de un nodo se agrupan: si el nodo
    // tiene la fusión activada, se dibujan como una llave clásica —dos brazos,
    // un tronco vertical y UNA sola línea hasta el punto central del nodo.
    const groups = {};
    conns.forEach(c => {
      const mb = M[c.toSlot];
      const on = (c.toParticipant === 'B' ? mb.inB : mb.inA) === 'R' ? 'R' : 'L';
      const k = c.toSlot + '|' + on;
      (groups[k] || (groups[k] = { on, to: c.toSlot, list: [] })).list.push(c);
    });
    const frag = [];
    const poly = pts => {
      const out = [];
      pts.forEach(p => {
        const q = out[out.length - 1];
        if (!q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5) out.push(p);
      });
      return out.map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(' ');
    };
    const edgeG = (id, sel, pts, extra) =>
      `<g class="bkc-edge${sel ? ' on' : ''}${extra || ''}" data-edge="${esc(id)}">` +
      (opts.editable ? `<polyline class="hit" points="${pts}"></polyline>` : '') +
      `<polyline class="ln" points="${pts}"></polyline></g>`;

    Object.keys(groups).forEach(k => {
      const g = groups[k];
      const mb = M[g.to];
      const jp = joinPoint(mb, g.on);
      // Una sola línea entrando por un lado se pega SIEMPRE al punto central de
      // la tarjeta. El anclaje de arriba o abajo sigue decidiendo a qué espacio
      // llega el ganador (A o B); lo que cambia es el dibujo, que así queda
      // recto en vez de dar la vuelta hasta la altura del chip.
      const single = g.list.length === 1;
      const target = c => single ? jp : inPoint(mb, c.toParticipant);
      const fwd = c => {
        const a = outPoint(M[c.fromSlot]), b = target(c);
        return a.s > 0 ? b.x > a.x + 6 : b.x < a.x - 6;
      };
      const allFwd = g.list.every(fwd);
      const merged = mb.join && g.list.length >= 2 && allFwd;
      const trunkAvg = () => {
        let sum = 0;
        g.list.forEach(c => {
          const a = outPoint(M[c.fromSlot]), b = inPoint(mb, c.toParticipant);
          sum += (a.x + b.x) / 2;
        });
        return sum / g.list.length;
      };
      if (merged){
        const arms = g.list.map(c => ({ c, a: outPoint(M[c.fromSlot]) }));
        // El tronco va en medio del pasillo entre las dos columnas, con el brazo
        // ajustado al hueco: es el dibujo de una llave clásica.
        const k = arm(arms[0].a.x, jp.x);
        const jx = jp.x + jp.s * k;
        const ends = arms.map(x => x.a.x).concat([jp.x]);
        const lo = Math.min.apply(null, ends) + 2, hi = Math.max.apply(null, ends) - 2;
        let tx = arms.reduce((s, x) => s + (x.a.x + jp.x) / 2, 0) / arms.length;
        tx = Math.min(Math.max(tx, lo), hi);
        const ys = arms.map(x => x.a.y);
        const y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
        const midY = (y1 + y2) / 2;
        const anySel = g.list.some(c => selE.has(c.id) || selN.has(c.fromSlot)) || selN.has(g.to);
        arms.forEach(({ c, a }) => {
          const sel = selE.has(c.id) || selN.has(c.fromSlot) || selN.has(g.to);
          frag.push(edgeG(c.id, sel, poly([{ x:a.x, y:a.y }, { x:tx, y:a.y }])));
        });
        frag.push(edgeG(g.list[0].id, anySel,
          poly([{ x:tx, y:y1 }, { x:tx, y:y2 }]), ' stem'));
        // Del centro del tronco al punto de unión. Si el tronco ya está a la
        // altura del nodo (llave simétrica) es una recta; solo se quiebra cuando
        // el cuadro está descuadrado.
        frag.push(edgeG(g.list[0].id, anySel,
          poly(Math.abs(midY - jp.y) < 2
            ? [{ x:tx, y:jp.y }, { x:jp.x, y:jp.y }]
            : [{ x:tx, y:midY }, { x:jx, y:midY }, { x:jx, y:jp.y }, { x:jp.x, y:jp.y }]), ' stem'));
        return;
      }
      const trunk = g.list.length >= 2 && allFwd ? trunkAvg() : undefined;
      g.list.forEach((c, i) => {
        const ma = M[c.fromSlot];
        // El desvío por carril solo tiene sentido cuando hay varias líneas que
        // podrían pisarse; con una sola desplazaba el tronco sin motivo.
        const lane = g.list.length > 1 ? i * 12 - 6 : 0;
        const pts = poly(route(outPoint(ma), target(c), ma, mb, lane, trunk));
        const sel = selE.has(c.id) || selN.has(c.fromSlot) || selN.has(c.toSlot);
        frag.push(edgeG(c.id, sel, pts));
      });
    });
    svg.innerHTML = frag.join('');
  }

  // ── vista pública: recorta al contenido y escala para que quepa ──────
  function fitPublic(host){
    const box = host.querySelector('.bkc-box') || host;
    const scroller = host.querySelector('.bkc-scroll') || box;
    const viewport = host.querySelector('.bkc-viewport');
    const stage = host.querySelector('.bkc-stage');
    if (!stage || !stage.__cfg) return;
    const b = CV().bounds(stage.__cfg);
    const pad = 26;
    const w = Math.max(200, b.w + pad * 2), h = Math.max(160, b.h + pad * 2);
    const avail = (scroller.clientWidth || box.clientWidth || host.clientWidth) - 4;
    if (!avail) return;
    const fit = avail / w;
    // Escala objetivo en escritorio: el cuadro se dibuja un 12 % más grande que
    // el lienzo de edición. El ÚNICO elemento que no crece es el escudo de
    // facultad, que debe medir siempre 56 px en pantalla: su tamaño CSS se
    // compensa a la baja (56 / escala) con las variables de más abajo, así que
    // al escalar vuelve a caer en 56 px justos.
    // Lo que no cabe se resuelve con scroll DENTRO de la caja: la página nunca
    // se desborda. En móvil manda el ajuste al ancho disponible.
    const TARGET = 1.3;
    // MÓVIL: el cuadro NO se encoge para caber. Se agranda todo en bloque hasta
    // que el escudo de facultad mide 42.11 px en pantalla (mismo tamaño que en
    // la tabla de grupos) y lo que sobra se resuelve con scroll horizontal
    // dentro de la caja. 53 px es el tamaño de diseño del escudo (--fac-item).
    const MOB = 42.11 / 53;
    const floor = avail < 760 ? MOB : avail < 1040 ? 0.34 : TARGET;
    const cap = avail < 1040 ? 1 : TARGET;
    const scale = Math.min(cap, Math.max(fit, floor));
    // Escudo a contracorriente: 56 px en pantalla pase lo que pase. Nunca se
    // agranda por encima de su tamaño de diseño (en móvil, donde la escala baja
    // de 1, el escudo se reduce con el resto en vez de reventar la tarjeta).
    const facItem = Math.min(53, 56 / scale);
    stage.style.setProperty('--fac-item', facItem.toFixed(2) + 'px');
    stage.style.setProperty('--fac-wrap', (facItem * 43 / 53).toFixed(2) + 'px');
    stage.style.setProperty('--fac-off', (-facItem / 2).toFixed(2) + 'px');
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'scale(' + scale + ') translate(' + Math.round(pad - b.x) + 'px,' + Math.round(pad - b.y) + 'px)';
    stage.style.width = Math.ceil(w) + 'px';
    stage.style.height = Math.ceil(h) + 'px';
    // `stage` conserva su tamaño SIN escalar (lo necesita el transform-origin),
    // pero eso confunde al navegador: mide el scroll por el tamaño de `stage`
    // sin transformar, no por su tamaño visual ya reducido, y el área
    // desplazable termina siendo miles de píxeles más ancha que el contenido
    // que en verdad se ve — hueco muerto a la derecha. `.bkc-viewport` es el
    // que realmente scrollea (dentro de `.bkc-box`) y mide EXACTAMENTE el
    // tamaño visual ya escalado, así que el navegador nunca ve esos píxeles de
    // sobra; y al ser mas angosto que la caja cuando el cuadro sí cabe,
    // `margin:auto` (CSS) lo centra solo, sin necesidad de desplazar el
    // contenido a mano.
    if (viewport){
      viewport.style.width = Math.ceil(w * scale) + 'px';
      viewport.style.height = Math.ceil(h * scale) + 'px';
    }
    box.style.height = Math.ceil(h * scale) + 'px';
    // El scroll vive en `.bkc-scroll` (capa absoluta sobre la caja), NO en
    // `.bkc-box`: la caja pinta el fondo y la atmósfera, y si ella misma
    // scrollease esas capas se irían con el contenido dejando un rectángulo de
    // color con borde duro a medio cuadro. Así el fondo queda quieto.
    scroller.style.overflowX = scale > fit + 0.001 ? 'auto' : 'hidden';
  }

  // Posición inicial: centra la Gran Final (.bkc-center) en el ancho visible
  // de la caja, en vez de arrancar mostrando el borde izquierdo del lienzo.
  function scrollToFinalPublic(host){
    const box = host.querySelector('.bkc-scroll') || host.querySelector('.bkc-box');
    const center = host.querySelector('.bkc-center');
    if (!box || !center || box.scrollWidth <= box.clientWidth) return;
    const boxRect = box.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    const contentLeft = centerRect.left - boxRect.left + box.scrollLeft;
    const target = contentLeft - (box.clientWidth - centerRect.width) / 2;
    box.scrollLeft = Math.max(0, Math.min(target, box.scrollWidth - box.clientWidth));
  }

  // ── Barra de scroll a medida ────────────────────────────────────────────
  // El navegador no deja fijar grosor/esquinas de su barra nativa (Firefox
  // ignora ::-webkit-scrollbar por completo), así que se dibuja una propia
  // (.tor-hscroll) sincronizada con el scroll real de `box`.
  function syncHScroll(box, bar, thumb){
    const over = box.scrollWidth > box.clientWidth + 4;
    bar.classList.toggle('show', over);
    if (!over) return;
    const trackW = bar.clientWidth;
    const thumbW = Math.max(36, trackW * (box.clientWidth / box.scrollWidth));
    const maxThumbX = Math.max(0, trackW - thumbW);
    const maxScroll = box.scrollWidth - box.clientWidth;
    const ratio = maxScroll > 0 ? box.scrollLeft / maxScroll : 0;
    thumb.style.width = thumbW + 'px';
    thumb.style.left = (maxThumbX * ratio) + 'px';
  }
  function wireHScroll(box, bar, thumb){
    box.addEventListener('scroll', () => syncHScroll(box, bar, thumb));
    const moveTo = clientX => {
      const rect = bar.getBoundingClientRect();
      const thumbW = thumb.offsetWidth;
      const maxThumbX = Math.max(0, rect.width - thumbW);
      const maxScroll = box.scrollWidth - box.clientWidth;
      const thumbX = Math.min(maxThumbX, Math.max(0, clientX - rect.left - thumbW / 2));
      box.scrollLeft = maxThumbX > 0 ? maxScroll * (thumbX / maxThumbX) : 0;
    };
    thumb.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      const startX = e.clientX, startLeft = box.scrollLeft;
      const onMove = ev => {
        const maxScroll = box.scrollWidth - box.clientWidth;
        const trackW = bar.clientWidth, thumbW = thumb.offsetWidth;
        const maxThumbX = Math.max(1, trackW - thumbW);
        box.scrollLeft = Math.min(maxScroll, Math.max(0, startLeft + (ev.clientX - startX) * (maxScroll / maxThumbX)));
      };
      const onUp = () => { thumb.removeEventListener('pointermove', onMove); thumb.removeEventListener('pointerup', onUp); };
      thumb.addEventListener('pointermove', onMove);
      thumb.addEventListener('pointerup', onUp);
    });
    bar.addEventListener('pointerdown', e => { if (e.target === thumb) return; moveTo(e.clientX); });
  }
  function ensureHScroll(host, box, scroller){
    let bar = host.querySelector(':scope > .tor-hscroll');
    if (!bar){
      bar = document.createElement('div');
      bar.className = 'tor-hscroll';
      bar.innerHTML = '<div class="tor-hscroll-thumb"></div>';
      box.insertAdjacentElement('afterend', bar);
    }
    const thumb = bar.querySelector('.tor-hscroll-thumb');
    wireHScroll(scroller || box, bar, thumb);
    return { bar, thumb };
  }

  function renderPublic(host, cfg, opts){
    opts = Object.assign({ editable:false, showPorts:false, publicShell:true }, opts || {});
    host.classList.add('bkc-host');
    render(host, cfg, opts);
    const stage = host.querySelector('.bkc-stage');
    const box = host.querySelector('.bkc-box');
    const atmo = host.querySelector('.bkc-atmo');
    if (atmo && global.TORNEO_DUST) global.TORNEO_DUST.attach(atmo);
    const scroller = host.querySelector('.bkc-scroll') || box;
    const hbar = box ? ensureHScroll(host, box, scroller) : null;
    const relay = () => {
      fitPublic(host); drawLines(stage, opts); scrollToFinalPublic(host);
      if (hbar) syncHScroll(scroller, hbar.bar, hbar.thumb);
    };
    requestAnimationFrame(relay);
    setTimeout(relay, 120); setTimeout(relay, 420);
    if (!host.__bkcResize){
      host.__bkcResize = () => relay();
      global.addEventListener('resize', host.__bkcResize);
    }
    return stage;
  }

  global.TORNEO_BKC = { render, renderPublic, drawLines, fitPublic, metrics, outPoint, inPoint, route, sysBand };
})(typeof window !== 'undefined' ? window : globalThis);
