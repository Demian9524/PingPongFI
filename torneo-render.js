// ── Render + interacción ────────────────────────────────────────────────
const DATA = window.TOURNAMENT.CATS_DATA;
const derive = window.TOURNAMENT.deriveExtras;
let activeCat = 'avanzado';
let activeRound = 0;

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// hue por nombre para avatares
function hue(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(name) {
  const clean = name.replace(/"/g, '').replace(/[A-Z]\.\s*/, '');
  const parts = clean.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
}

function roundNames(size) {
  return size === 16 ? ['Octavos', 'Cuartos', 'Semifinal', 'Final'] : ['Cuartos', 'Semifinal', 'Final'];
}

// ── ítem flotante de facultad ──────────────────────────────────────────
// Algunos usuarios (minoría determinista por nombre) tienen un ítem que se
// voltea (estilo Minecraft) y revela uno de 3 iconos en la cara trasera.
const FAC_BACKS = ['assets/fac-computer.png', 'assets/fac-rocket.png', 'assets/fac-bridge.png'];
function facHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function facItem(name) {
  const h = facHash(name);
  const spins = (h % 100) < 35; // ~35% de los usuarios giran; el resto queda estático
  if (!spins) {
    return `<span class="fac-wrap"><img class="fac-item" src="assets/escudo-fi.svg" alt="" aria-hidden="true"></span>`;
  }
  const back = FAC_BACKS[h % FAC_BACKS.length];
  return `<span class="fac-wrap"><span class="fac-flip"><img class="fac-face fac-front" src="assets/escudo-fi.svg" alt="" aria-hidden="true"><img class="fac-face fac-back" src="${back}" alt="" aria-hidden="true"></span></span>`;
}

// ── GROUPS SLIDER ───────────────────────────────────────────────────────
function renderGroups(cat) {
  const slider = $('#slider');
  slider.innerHTML = '';
  cat.groups.forEach(g => {
    const card = el('div', 'hud gcard');
    card.appendChild(el('div', 'gh', `<span class="gi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/></svg></span><b>${g.name}</b><span class="pill">4 jug.</span>`));
    card.appendChild(el('div', 'ghead', `<span>#</span><span>Jugador</span><span>PJ</span><span>PG</span><span>Sets</span><span>Pts</span>`));
    g.players.forEach((p, i) => {
      const cls = i < 2 ? 'q' : i === 2 ? 't' : '';
      const row = el('div', 'grow ' + cls);
      row.innerHTML = `<span class="acc"></span>
        <span class="rk">${i + 1}</span>
        <span class="nm">${facItem(p.n)}<span class="nm-t">${p.n}</span></span>
        <span class="st">${p.pj}</span>
        <span class="st">${p.pg}</span>
        <span class="st">${p.sf}-${p.sc}</span>
        <span class="pt">${p.pts}</span>`;
      card.appendChild(row);
    });
    slider.appendChild(card);
  });
  updateArrows();
}

function updateArrows() {
  const s = $('#slider');
  const overflow = s.scrollWidth - s.clientWidth > 8;
  $('#arrowL').disabled = !overflow || s.scrollLeft <= 4;
  $('#arrowR').disabled = !overflow || s.scrollLeft >= s.scrollWidth - s.clientWidth - 4;
}

// ── BRACKET ─────────────────────────────────────────────────────────────
function renderRoundTabs(cat) {
  const tabs = $('#rtabs');
  if (tabs){ tabs.innerHTML = ''; tabs.style.display = 'none'; }
}

function renderBracket(cat) {
  const host = $('#bracket-cols');
  if (!host) return;
  // FUENTE ÚNICA: configuración PUBLICADA en Supabase (get_public_bracket_config).
  // Ya NO hay datos mock ni fallback con nombres ficticios: sin publicación se
  // muestra el aviso dentro del mismo marco dorado. Nada se guarda en localStorage.
  if (window.TORNEO_BKT) window.TORNEO_BKT.mount(host, cat);
  else { host.innerHTML = ''; host.dataset.bkSource = 'renderer-missing'; }
}

// ── Llaves del bracket: SVG que mide posiciones reales y conecta cada nodo ──
function drawConnectors() {
  const mbk = document.querySelector('#bracket .mbk');
  if (!mbk) return;
  let svg = mbk.querySelector('.mbk-lines');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mbk-lines');
    mbk.prepend(svg);
  }
  const R = mbk.getBoundingClientRect();
  if (!R.width) return;
  svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
  svg.innerHTML = '';
  const rc = (e) => { const b = e.getBoundingClientRect(); return { l: b.left - R.left, r: b.right - R.left, cx: (b.left + b.right) / 2 - R.left, cy: (b.top + b.bottom) / 2 - R.top }; };
  const line = (pts) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); p.setAttribute('points', pts.map(a => a.join(',')).join(' ')); svg.appendChild(p); };
  const matches = (c) => [...c.querySelectorAll(':scope > .mbk-match')];
  const finalEl = document.querySelector('#bracket .mbk-final');

  // LEFT: fluye de afuera hacia el centro (col[i] alimenta col[i+1])
  const lc = [...mbk.querySelectorAll('.mbk-col.l')];
  for (let i = 0; i < lc.length - 1; i++) {
    const A = matches(lc[i]), B = matches(lc[i + 1]);
    B.forEach((bm, j) => {
      const f1 = A[2 * j], f2 = A[2 * j + 1]; if (!f1) return;
      const rb = rc(bm);
      if (f2) {
        const r1 = rc(f1), r2 = rc(f2), e = Math.max(r1.r, r2.r), mx = e + (rb.l - e) * 0.78;
        line([[r1.r, r1.cy], [mx, r1.cy], [mx, r2.cy], [r2.r, r2.cy]]);
        line([[mx, (r1.cy + r2.cy) / 2], [rb.l, rb.cy]]);
      } else { const r1 = rc(f1); line([[r1.r, r1.cy], [rb.l, rb.cy]]); }
    });
  }
  if (lc.length && finalEl) {
    const semi = matches(lc[lc.length - 1])[0];
    if (semi) { const rs = rc(semi), rf = rc(finalEl), mx = (rs.r + rf.l) / 2; line([[rs.r, rs.cy], [mx, rs.cy], [mx, rf.cy], [rf.l, rf.cy]]); }
  }

  // RIGHT (espejo): fluye de afuera (índice mayor) hacia el centro (índice menor)
  const rcol = [...mbk.querySelectorAll('.mbk-col.r')];
  for (let i = rcol.length - 1; i > 0; i--) {
    const A = matches(rcol[i]), B = matches(rcol[i - 1]);
    B.forEach((bm, j) => {
      const f1 = A[2 * j], f2 = A[2 * j + 1]; if (!f1) return;
      const rb = rc(bm);
      if (f2) {
        const r1 = rc(f1), r2 = rc(f2), e = Math.min(r1.l, r2.l), mx = e - (e - rb.r) * 0.78;
        line([[r1.l, r1.cy], [mx, r1.cy], [mx, r2.cy], [r2.l, r2.cy]]);
        line([[mx, (r1.cy + r2.cy) / 2], [rb.r, rb.cy]]);
      } else { const r1 = rc(f1); line([[r1.l, r1.cy], [rb.r, rb.cy]]); }
    });
  }
  if (rcol.length && finalEl) {
    const semi = matches(rcol[0])[0];
    if (semi) { const rs = rc(semi), rf = rc(finalEl), mx = (rf.r + rs.l) / 2; line([[rs.l, rs.cy], [mx, rs.cy], [mx, rf.cy], [rf.r, rf.cy]]); }
  }
}

// ── THIRDS ──────────────────────────────────────────────────────────────
function renderThirds(cat) {
  const host = $('#thirds');
  host.innerHTML = '';
  cat.thirds.forEach((t) => {
    const row = el('div', 'ti' + (t.in ? ' in' : ''));
    row.innerHTML = `<span class="p">${t.pos}</span>
      <span class="tn"><b>${t.n}</b><small>Grupo ${t.grp} · DIF ${t.dif > 0 ? '+' : ''}${t.dif}</small></span>
      <span class="bd ${t.in ? '' : 'out'}">${t.in ? 'PASA' : 'FUERA'}</span>`;
    host.appendChild(row);
  });
}

// ── SIDEBAR ─────────────────────────────────────────────────────────────
function renderSidebar(cat) {
  const { top, next } = derive(cat);
  const up = $('#upcoming');
  if (up) {
  up.innerHTML = '';
  next.forEach(m => {
    const row = el('div', 'mrow');
    const ha = hue(m.a), hb = hue(m.b);
    row.innerHTML = `
      <div class="mteam">
        <span class="emb" style="background:linear-gradient(150deg,hsl(${ha} 62% 48%),hsl(${(ha+40)%360} 62% 32%))">${initials(m.a)}</span>
        <span class="mn">${m.a}</span>
      </div>
      <div class="mmid"><small>${m.table}</small><b>VS</b><span class="mt">${m.t}</span></div>
      <div class="mteam r">
        <span class="emb" style="background:linear-gradient(150deg,hsl(${hb} 62% 48%),hsl(${(hb+40)%360} 62% 32%))">${initials(m.b)}</span>
        <span class="mn">${m.b}</span>
      </div>`;
    up.appendChild(row);
  });
  }

  const tp = $('#topPlayers');
  if (tp) {
  tp.innerHTML = '';
  top.forEach((p, i) => {
    const wr = Math.round((p.pg / p.pj) * 100);
    const row = el('div', 'trow' + (i === 0 ? ' top1' : ''));
    const h = hue(p.n);
    row.innerHTML = `<span class="rk">${i + 1}</span>
      <span class="ava" style="background:linear-gradient(150deg,hsl(${h} 65% 52%),hsl(${(h + 40) % 360} 65% 38%))">${initials(p.n)}</span>
      <span class="nm"><b>${p.n}</b><small>Grupo ${p.grp} · ${wr}% victorias</small></span>
      <span class="pts">${p.pts}<small> pts</small></span>`;
    tp.appendChild(row);
  });
  }
}

// ── META ────────────────────────────────────────────────────────────────
function renderMeta(cat) {
  const m1 = $('#mGroups'), m2 = $('#mPlayers'), m3 = $('#mBracket'), m4 = $('#catTagBkt'), m5 = $('#heroPlayers');
  if (m1) m1.textContent = cat.nGroups;
  if (m2) m2.textContent = cat.nPlayers;
  if (m3) m3.textContent = cat.bracketSize === 16 ? 'Octavos' : 'Cuartos';
  if (m4) m4.textContent = cat.label.toUpperCase();
  if (m5) m5.textContent = (DATA.principiante.nPlayers + DATA.intermedio.nPlayers + DATA.avanzado.nPlayers) + ' JUGADORES';
}

// ── SWITCH ──────────────────────────────────────────────────────────────
function setCategory(key) {
  activeCat = key;
  activeRound = 0;
  document.body.setAttribute('data-cat', key);
  const cat = DATA[key];
  document.querySelectorAll('#catSeg button').forEach(b => b.classList.toggle('on', b.dataset.cat === key));
  const logo = null; // logo fijo: gif cerdito, no cambia por categoría
  if (logo) logo.src = LOGO[key] || LOGO.neutral;
  const hc = document.getElementById('heroCat'); if (hc) { hc.textContent = 'Categoría ' + (CAT_LABEL[key] || ''); hc.hidden = false; }
  renderMeta(cat);
  renderGroups(cat);
  renderRoundTabs(cat);
  renderBracket(cat);
  renderThirds(cat);
  renderSidebar(cat);
  $('#slider').scrollLeft = 0;
  updateArrows();
}

// Estado inicial: tema neutro (blanco/gris), sin datos hasta elegir categoría
const LOGO = { neutral: 'assets/pingpong-white.png', principiante: 'assets/pingpong-green.png', intermedio: 'assets/pingpong-blue.png', avanzado: 'assets/pingpong-red.png' };
const CAT_LABEL = { principiante: 'Principiantes', intermedio: 'Intermedios', avanzado: 'Avanzados' };

function emptyState(host, msg){
  if (!host) return;
  host.innerHTML = '';
  const e = el('div', 'empty-pick', `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>
    <span>${msg}</span>`);
  host.appendChild(e);
}

function initNeutral() {
  activeCat = null; activeRound = 0;
  document.body.setAttribute('data-cat', 'neutral');
  document.querySelectorAll('#catSeg button').forEach(b => b.classList.remove('on'));
  // logo fijo: gif cerdito, no se resetea por categoría
  const hc = document.getElementById('heroCat'); if (hc) hc.hidden = true;
  // Meta limpia
  const m1=$('#mGroups'), m2=$('#mPlayers'), m3=$('#mBracket'), m4=$('#catTagBkt');
  if (m1) m1.textContent='—'; if (m2) m2.textContent='—'; if (m3) m3.textContent='—'; if (m4) m4.textContent='—';
  const hp = $('#heroPlayers'); if (hp) hp.textContent = (DATA.principiante.nPlayers + DATA.intermedio.nPlayers + DATA.avanzado.nPlayers) + ' JUGADORES';
  // Vacíos con prompt
  emptyState($('#slider'),       'Elige una categoría para ver los grupos');
  emptyState($('#bracket-cols'), 'Elige una categoría para ver el bracket');
  emptyState($('#rtabs'),        '—');
  emptyState($('#thirds'),       'Elige una categoría para ver los terceros');
  emptyState($('#upcoming'),     'Elige una categoría');
  emptyState($('#topPlayers'),   'Elige una categoría');
  emptyState($('#bbBody'),       'Elige una categoría para ver los bombos');
  $('#arrowL').disabled = true; $('#arrowR').disabled = true;
}

// ── EVENTS ──────────────────────────────────────────────────────────────
document.querySelectorAll('#catSeg button').forEach(b => {
  b.onclick = () => setCategory(b.dataset.cat);
});
document.querySelectorAll('[data-cat-link]').forEach(a => {
  a.addEventListener('click', () => setCategory(a.dataset.catLink));
});
$('#arrowL').onclick = () => { $('#slider').scrollBy({ left: -464, behavior: 'smooth' }); };
$('#arrowR').onclick = () => { $('#slider').scrollBy({ left: 464, behavior: 'smooth' }); };
$('#slider').addEventListener('scroll', updateArrows, { passive: true });
window.addEventListener('resize', updateArrows);
window.addEventListener('resize', () => requestAnimationFrame(drawConnectors));
window.addEventListener('load', () => requestAnimationFrame(drawConnectors));
document.querySelector('#bracket .bkt')?.addEventListener('scroll', () => requestAnimationFrame(drawConnectors), { passive: true });

// nav active link on scroll
const navLinks = document.querySelectorAll('.nav-links a');
const sections = ['inicio', 'grupos', 'bracket', 'jugadores'];
window.addEventListener('scroll', () => {
  let cur = 'inicio';
  for (const id of sections) {
    const s = document.getElementById(id);
    if (s && s.getBoundingClientRect().top < 120) cur = id;
  }
  navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
}, { passive: true });

// init
initNeutral();
