// ── Renderer COMPARTIDO del bracket final ────────────────────────────────
// Único renderer del bracket: lo usan la página pública (Pagina Torneo.html)
// y el editor (BracketAdmin.html). Mantiene el markup/clases del diseño
// (.mbk-*), el cerdito, la placa y las tipografías.
//   · publicMode  → solo lectura, solo configuración PUBLICADA.
//   · adminMode   → tarjetas editables (clic) sobre el borrador.
//
// La ESTRUCTURA ya no está fija: se deriva de supabase/bracket-topology.js a
// partir del formato acordado (cuartos / octavos / dieciseisavos, con o sin
// ronda de acceso). Las columnas, el ancho del grid y las llaves se calculan.
(function(global){
  'use strict';
  const CFG  = () => global.SB_BRACKETCFG;
  const TOPO = () => global.FI_BKT_TOPO;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ítem de facultad — idéntico al diseño original
  const FAC_BACKS = ['assets/fac-computer.png', 'assets/fac-rocket.png', 'assets/fac-bridge.png'];
  function facHash(s){ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function facItem(name){
    const h = facHash(name || '');
    const spins = (h % 100) < 35;
    if (!spins) return `<span class="fac-wrap"><img class="fac-item" src="assets/escudo-fi.svg" alt="" aria-hidden="true"></span>`;
    const back = FAC_BACKS[h % FAC_BACKS.length];
    return `<span class="fac-wrap"><span class="fac-flip"><img class="fac-face fac-front" src="assets/escudo-fi.svg" alt="" aria-hidden="true"><img class="fac-face fac-back" src="${back}" alt="" aria-hidden="true"></span></span>`;
  }
  // Mismo ítem flotante que la tabla de fase de grupos: fac-wrap (bob) y, en
  // Ingeniería con carrera, fac-flip (giro de 30 s entre escudo FI y carrera).
  function logoFor(p){
    if (p && p.mode === 'REGISTRATION' && p.facultyLogo && global.SB_LOGOS){
      const L = global.SB_LOGOS;
      if (p.facultyLogo === 'INGENIERIA' && p.careerLogo)
        return `<span class="fac-wrap"><span class="fac-flip"><img class="fac-face fac-front" src="assets/escudo-fi.svg" alt="" aria-hidden="true"><img class="fac-face fac-back" src="${esc(L.careerLogo(p.careerLogo))}" alt="" aria-hidden="true"></span></span>`;
      const r = L.resolveForTable(p.facultyLogo, p.careerLogo, p.displayName || '');
      // data-fac-src: el logo de FACULTAD puro, aunque aquí se esté mostrando
      // el de carrera (alterna 50/50). Al exportar la imagen del cuadro se
      // fuerza este src en todos: la descarga nunca lleva logos de carrera.
      return `<span class="fac-wrap"><img class="fac-item" src="${esc(r.src)}" data-fac-src="${esc(L.facultyLogo(p.facultyLogo))}" alt="" aria-hidden="true"></span>`;
    }
    if (p && p.mode === 'REGISTRATION') return facItem(p.displayName || '');
    return `<span class="mbk-logo ph"></span>`;
  }
  function isTbd(p){ return !p || p.mode === 'EMPTY' || p.mode === 'PLACEHOLDER' || p.mode === 'DERIVED'; }

  // Origen por defecto según la estructura: dice de dónde sale esa persona
  // aunque el sorteo aún no se haya capturado.
  const ENTRY_HINT = { ACCESS:'GANADOR DE ACCESO' };

  function chip(p, opts){
    opts = opts || {};
    const tbd = isTbd(p);
    const name = (p && p.displayName) || 'Por definir';
    // "PASE DIRECTO" ya no se muestra arriba de la tarjeta: basta la posición
    // de grupo. Se recorta aquí para no depender de resembrar cuadros viejos
    // que ya guardaron el prefijo en sourceLabel.
    const sd = ((p && p.sourceLabel) || ENTRY_HINT[opts.entry] || (tbd ? '–' : '')).replace(/^PASE DIRECTO\s*(?:·\s*)?/i, '');
    const score = opts.score == null ? '–' : opts.score;
    const cls = ['mbk-chip',
      tbd && opts.win == null ? 'tbd' : (opts.win === true ? 'win' : opts.win === false ? 'lose' : (tbd ? 'tbd' : '')),
      opts.entry === 'DIRECT_PASS' ? 'pd' : ''].filter(Boolean).join(' ');
    // en un lugar de descanso el marcador vacío no dice nada: se sustituye por
    // la marca PD (pase directo), que sí explica la estructura
    const tail = opts.entry === 'DIRECT_PASS' && opts.score == null
      ? `<span class="mbk-pd" title="Pase directo · descansa la ronda de acceso">PD</span>`
      : `<span class="mbk-score">${esc(score)}</span>`;
    const pid = p && p.registrationId;
    const url = (!opts.ed && pid && global.SB_LINKS) ? global.SB_LINKS.buildPlayerProfileUrl(pid) : null;
    const nameHTML = url
      ? `<a class="bn-link" href="${esc(url)}" title="Ver perfil de ${esc(name)}">${esc(name)}</a>`
      : esc(name);
    return `<div class="${cls}"${opts.attrs || ''}>${tbd ? `<span class="mbk-logo ph"></span>` : logoFor(p)}<span class="mbk-id"><i class="sd">${esc(sd)}</i><b class="bn">${nameHTML}</b></span>${tail}</div>`;
  }

  // Tarjeta de enfrentamiento (o de PASE DIRECTO, que no es un partido).
  // ÚNICA fuente de la piel de la tarjeta: la usan el bracket en columnas y el
  // lienzo libre, así que las dos vistas dibujan EXACTAMENTE lo mismo.
  //   v  → vista ya resuelta del espacio (slotType, a, b, scoreA/B, winner…)
  //   o  → editable, entry, side ('l'/'r'), chipSides, slotAttr, head, extraCls
  function cardHTML(slotId, v, o){
    o = o || {};
    const pass = v.slotType === 'DIRECT_PASS';
    const winA = v.winner === 'A' ? true : v.winner === 'B' ? false : null;
    const winB = v.winner === 'B' ? true : v.winner === 'A' ? false : null;
    const allTbd = isTbd(v.a) && isTbd(v.b) && v.winner == null;
    const cls = ['mbk-match', allTbd && !pass ? 'tbd' : '', v.visible === false ? 'mbk-hidden' : '',
      o.editable ? 'bk-editable' : '', pass ? 'mbk-pass' : '', o.extraCls || ''].filter(Boolean).join(' ');
    const note = v.officialUnavailable ? `<i class="mbk-offnote">Resultado temporalmente no disponible</i>` : '';
    const idAttr = ` ${o.slotAttr || 'data-slot'}="${esc(slotId)}"`;
    const sideAttr = o.side ? ` data-side="${o.side}"` : '';
    const chipSide = k => (o.chipSides ? ` data-side="${k}"` : '');
    const head = o.head || '';
    const entry = o.entry || {};
    if (pass){
      const p = (v.a && v.a.mode !== 'EMPTY') ? v.a : v.b;
      const lbl = v.sourceLabel || 'PASE DIRECTO';
      return `<div class="${cls}"${idAttr}${sideAttr} title="${esc(lbl)} · no es un partido">${head}` +
        chip(p, { win:null, score:null, attrs: chipSide('A') }) +
        `<i class="mbk-passlbl">${esc(lbl)}</i></div>`;
    }
    return `<div class="${cls}"${idAttr}${sideAttr}>${head}${
      chip(v.a, { win:winA, score:v.scoreA, entry:entry.A, attrs: chipSide('A'), ed:o.editable })}${
      chip(v.b, { win:winB, score:v.scoreB, entry:entry.B, attrs: chipSide('B'), ed:o.editable })}${note}</div>`;
  }
  function matchHTML(slotId, slot, editable, entry, side){
    return cardHTML(slotId, CFG().slotView(slot), { editable, entry, side });
  }

  function nameOf(who, fallback){
    if (!who) return fallback;
    if (who.displayName && who.displayName !== 'Por definir') return who.displayName;
    return fallback;
  }

  // ── Render principal ──
  function render(host, cfg, opts){
    opts = opts || {};
    cfg = CFG().migrate(cfg);
    // Llave dibujada a mano (lienzo libre): la pinta el renderer de lienzo,
    // con el mismo lenguaje visual y sin columnas fijas.
    if (global.FI_BKT_CANVAS && global.FI_BKT_CANVAS.isFree(cfg) && global.TORNEO_BKC){
      host.classList.add('bkc-host');
      global.TORNEO_BKC.renderPublic(host, cfg, opts);
      host.dataset.bkSource = opts.source || 'published';
      return null;
    }
    host.classList.remove('bkc-host');
    host.style.height = '';
    const plan = TOPO().buildPlan(cfg.format);
    const h = cfg.header || {};
    const s = cfg.slots || {};
    const ed = opts.editable === true;
    const catLabel = opts.catLabel != null ? opts.catLabel : (h.categoryLabel || '');
    const slotOf = id => s[id] || CFG().emptySlot(id);
    const finalView = CFG().slotView(s.final);
    const fWinA = finalView.winner === 'A' ? true : finalView.winner === 'B' ? false : null;
    const fWinB = finalView.winner === 'B' ? true : finalView.winner === 'A' ? false : null;
    const champ = CFG().derivedWinner(cfg, 'champion');
    const sub = CFG().derivedWinner(cfg, 'runnerUp');

    const cols = plan.columns;
    const n = cols.length;
    // Geometría VISUAL de las columnas (solo presentación): las filas de
    // leaderboard son más altas y anchas que las tarjetas anteriores, así que
    // la columna necesita sitio para logo + nombre real + marcador grande.
    const gap = n > 7 ? 26 : n > 5 ? 32 : 40;
    const colMin = n > 9 ? 244 : n > 7 ? 266 : 292;
    const cMin = 344;
    const grid = cols.map(c => c.side === 'c' ? `minmax(${cMin}px,1.32fr)` : `minmax(${colMin}px,1fr)`).join(' ');
    const minW = (n - 1) * (colMin + gap) + cMin + 40;

    const centerHTML = `<div class="mbk-center">
        <div class="lbl">${esc(h.championLabel || 'Campeón')}<small>${esc(catLabel)}</small></div>
        <div class="plaque mbk-champ-plaque ${ed ? 'bk-editable' : ''}" data-slot="champion"><img class="plaque-img" src="assets/plaque-frame-sm.png" alt="" /><div class="plate-text"><span class="ed">${esc(h.editionLabel || 'Edición 2027-1')}</span><span class="nm">${esc(nameOf(champ, '?'))}</span></div></div>
        <div class="mbk-final ${ed ? 'bk-editable' : ''} ${finalView.visible ? '' : 'mbk-hidden'}" data-slot="final"><div class="fl">La Final</div>${chip(finalView.a, { win:fWinA, score:finalView.scoreA })}${chip(finalView.b, { win:fWinB, score:finalView.scoreB })}</div>
        <div class="mbk-sub ${ed ? 'bk-editable' : ''}" data-slot="runnerUp"><span class="sh">🛡️</span><b>${esc(h.runnerUpLabel || 'Subcampeón')}</b><i>${esc(nameOf(sub, 'por definir'))}</i></div>
        <div class="mbk-trophy"><img src="assets/piggy-gold.png?v=15" alt="Trofeo puerquito dorado"></div>
      </div>`;

    const colHTML = c => c.side === 'c' ? centerHTML
      : `<div class="mbk-col ${c.side}" data-round="${c.roundId}">${c.ids.map(id =>
          matchHTML(id, slotOf(id), ed, plan.entries[id], c.side)).join('')}</div>`;

    host.innerHTML = `<div class="mbk-in" style="min-width:${minW}px">
    <div class="mbk-sys"><b>${esc(plan.systemLabel)}</b><span>${esc(plan.systemLine)}</span></div>
    <div class="mbk-rlabels" style="grid-template-columns:${grid};gap:${gap}px">${cols.map(c =>
      `<span class="${c.side === 'c' ? 'c' : ''}">${esc(c.label)}</span>`).join('')}</div>
    <div class="mbk" style="grid-template-columns:${grid};gap:${gap}px">${cols.map(colHTML).join('')}</div></div>`;

    const mbk = host.querySelector('.mbk');
    if (mbk) mbk.__conns = plan.connections;
    const mbkIn = host.querySelector('.mbk-in');
    if (mbkIn && window.TORNEO_DUST) window.TORNEO_DUST.attach(mbkIn);
    if (ed && typeof opts.onEditSlot === 'function'){
      host.querySelectorAll('[data-slot]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); opts.onEditSlot(el.getAttribute('data-slot')); });
      });
    }
    host.dataset.bkSource = opts.source || (ed ? 'draft' : 'published');
    const hbar = ensureHScroll(host);
    const paint = () => { drawConnectors(host); scrollToFinal(host); syncHScroll(host, hbar.bar, hbar.thumb); };
    requestAnimationFrame(() => { paint(); requestAnimationFrame(paint); });
    setTimeout(paint, 60); setTimeout(paint, 320);   // pestañas ocultas no ejecutan rAF
    return plan;
  }

  // ── Estados alternos, dentro del mismo marco dorado ──
  function renderMessage(host, text, cls){
    host.innerHTML = `<div class="mbk-state ${cls || ''}">${esc(text)}</div>`;
  }
  function renderSkeleton(host){ renderMessage(host, 'Cargando bracket…', 'skel'); host.dataset.bkSource = 'loading'; }
  function renderNotPublished(host){
    renderMessage(host, 'El bracket de esta categoría aún no ha sido publicado.', 'empty');
    host.dataset.bkSource = 'not-published';
  }

  // ── Llaves SVG · se dibujan desde las CONEXIONES del plan ──────────────
  // Un destino con dos orígenes del mismo lado dibuja la llave clásica; con
  // uno solo (ronda de acceso impar, pase directo) dibuja un codo simple.
  function drawConnectors(root){
    const mbk = (root || document).querySelector('.mbk');
    if (!mbk) return;
    let svg = mbk.querySelector('.mbk-lines');
    if (!svg){
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'mbk-lines');
      mbk.prepend(svg);
    }
    const R = mbk.getBoundingClientRect();
    if (!R.width) return;
    svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
    svg.innerHTML = '';
    const rc = e => { const b = e.getBoundingClientRect();
      return { l: b.left - R.left, r: b.right - R.left, cy: (b.top + b.bottom) / 2 - R.top }; };
    const line = pts => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      p.setAttribute('points', pts.map(a => a.join(',')).join(' ')); svg.appendChild(p); };
    const vis = el => el && !el.classList.contains('mbk-hidden');
    const find = id => mbk.querySelector(`[data-slot="${id}"]`);

    const conns = (mbk.__conns || []).filter(c => c.enabled !== false);
    const byTarget = {};
    conns.forEach(c => {
      const from = find(c.fromSlot), to = find(c.toSlot);
      if (!vis(from) || !vis(to)) return;
      const side = from.getAttribute('data-side') || 'l';
      const k = c.toSlot + '|' + side;
      (byTarget[k] || (byTarget[k] = { to, side, sources: [] })).sources.push(from);
    });

    Object.keys(byTarget).forEach(k => {
      const g = byTarget[k], rt = rc(g.to), left = g.side === 'l';
      const src = g.sources.map(rc).sort((a, b) => a.cy - b.cy);
      if (src.length >= 2){
        const r1 = src[0], r2 = src[src.length - 1];
        const edge = left ? Math.max(r1.r, r2.r) : Math.min(r1.l, r2.l);
        const mx = left ? edge + (rt.l - edge) * 0.78 : edge - (edge - rt.r) * 0.78;
        const x1 = left ? r1.r : r1.l, x2 = left ? r2.r : r2.l;
        line([[x1, r1.cy], [mx, r1.cy], [mx, r2.cy], [x2, r2.cy]]);
        line([[mx, (r1.cy + r2.cy) / 2], [left ? rt.l : rt.r, rt.cy]]);
      } else if (src.length === 1){
        const r1 = src[0];
        const x1 = left ? r1.r : r1.l, xt = left ? rt.l : rt.r;
        const mx = (x1 + xt) / 2;
        line([[x1, r1.cy], [mx, r1.cy], [mx, rt.cy], [xt, rt.cy]]);
      }
    });
  }

  // Posición inicial: centra la Gran Final (.mbk-center) en el ancho visible
  // del cuadro, en vez de arrancar mostrando el borde izquierdo.
  function scrollToFinal(host){
    if (!host || host.scrollWidth <= host.clientWidth) return;
    const center = host.querySelector('.mbk-center');
    if (!center) return;
    const hostRect = host.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    const contentLeft = centerRect.left - hostRect.left + host.scrollLeft;
    const target = contentLeft - (host.clientWidth - centerRect.width) / 2;
    host.scrollLeft = Math.max(0, Math.min(target, host.scrollWidth - host.clientWidth));
  }

  // ── Barra de scroll a medida (Firefox ignora ::-webkit-scrollbar) ─────────
  function syncHScroll(box, bar, thumb){
    const over = box.scrollWidth > box.clientWidth + 1;
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
  function ensureHScroll(host){
    let bar = host.querySelector(':scope > .tor-hscroll');
    if (!bar){
      bar = document.createElement('div');
      bar.className = 'tor-hscroll';
      bar.innerHTML = '<div class="tor-hscroll-thumb"></div>';
      host.appendChild(bar);
    }
    const thumb = bar.querySelector('.tor-hscroll-thumb');
    wireHScroll(host, bar, thumb);
    return { bar, thumb };
  }

  // ── Integración de la página pública ──
  // Solo published_config. Sin publicación → mensaje dentro del mismo marco.
  // Al cambiar de categoría se ignoran las respuestas viejas (token de secuencia).
  let seq = 0;
  async function mount(host, cat){
    if (!host || !CFG() || !cat || !cat.key) return;
    const token = ++seq;
    renderSkeleton(host);
    try {
      const edcatId = await CFG().resolveEdcatId(cat.key);
      if (token !== seq) return;
      if (edcatId == null) return renderNotPublished(host);
      const st = await CFG().getPublicState(edcatId);
      if (token !== seq) return;
      if (!st.published || !st.config) return renderNotPublished(host);
      render(host, st.config, { catLabel: cat.label || '', source:'published' });
    } catch(e){ if (token === seq) renderNotPublished(host); }
  }

  // estilos aditivos (no alteran el diseño existente)
  if (typeof document !== 'undefined' && !document.getElementById('bkcfg-style')){
    const st = document.createElement('style');
    st.id = 'bkcfg-style';
    st.textContent = '.mbk-match.mbk-hidden,.mbk-final.mbk-hidden{visibility:hidden}' +
      '.bk-adminmode .mbk-hidden{visibility:visible;opacity:.28;outline:1px dashed rgba(255,255,255,.35)}' +
      '.bk-adminmode .bk-editable{cursor:pointer}' +
      '.bk-adminmode .bk-editable:hover{outline:2px solid var(--gold,#edbb52);outline-offset:2px;border-radius:11px}' +
      '.mbk-passlbl{display:block;font-family:var(--mono,monospace);font-size:7.5px;letter-spacing:.9px;text-transform:uppercase;color:var(--gold,#edbb52);text-align:center;padding:2px 0 3px}' +
      '.mbk-offnote{display:block;font-family:var(--mono,monospace);font-size:7px;letter-spacing:.6px;text-transform:uppercase;color:var(--amber,#e3a93f);text-align:center;padding:0 0 3px}' +
      '.mbk-sys{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 2px 12px;padding:7px 12px;border-radius:9px;background:rgba(0,0,0,.28);border:1px solid rgba(224,181,74,.28)}' +
      '.mbk-sys b{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:1.8px;text-transform:uppercase;color:var(--gold,#edbb52)}' +
      '.mbk-sys span{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.5px;color:var(--dim,#8b7f6b)}' +
      '.mbk-pd{flex:0 0 auto;font-family:var(--mono,monospace);font-size:7px;letter-spacing:.8px;padding:2px 4px;border-radius:4px;color:var(--gold,#edbb52);border:1px solid rgba(224,181,74,.45);background:rgba(224,181,74,.12)}' +
      '.mbk-chip.pd .sd{color:var(--gold,#edbb52)}' +
      '.mbk-state{min-height:140px;display:flex;align-items:center;justify-content:center;text-align:center;gap:10px;margin:2px;padding:28px 24px;border-radius:14px;background:rgba(20,18,14,0.45);border:1px dashed rgba(190,170,130,0.18);font-family:var(--mono,monospace);font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted,#b09a7e)}' +
      '.mbk-state.skel{animation:mbkPulse 1.1s ease-in-out infinite alternate}' +
      '@keyframes mbkPulse{from{opacity:.35}to{opacity:.75}}';
    document.head.appendChild(st);
  }

  global.TORNEO_BKT = { render, drawConnectors, mount, tryPublished: mount, renderNotPublished, renderSkeleton, facItem, chip, cardHTML };
})(typeof window !== 'undefined' ? window : globalThis);
