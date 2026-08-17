// ── BOMBOS AL MOMENTO (clasificación al momento) ─────────────────────────
// Una sola tabla con TODOS los participantes de la categoría activa, ordenados
// por bombo: Bombo 1 (todos los primeros), Bombo 2 (todos los segundos),
// Bombo 3 (terceros seleccionados por el sistema 5–4–3) y quienes quedan fuera.
// NO consulta nada por su cuenta: reutiliza los standings ya cargados por
// torneo-groups-live.js (rpc get_group_standings, única fuente autoritativa de
// posiciones), el motor del reglamento (FI_FORMAT) y las zonas de SB_QUALCONFIG.
//
// Reglas duras del reglamento vigente:
//   · Dentro del Bombo 1 y del Bombo 2 NO hay orden interno: los primeros no se
//     comparan entre sí y los segundos tampoco. El listado va por grupo.
//   · Si el formato tiene pases directos los reciben TODOS los primeros.
//   · Los únicos comparables entre grupos son los terceros, y solo contra
//     terceros del mismo tamaño efectivo.
(function(){
  'use strict';
  const U = () => window.TORNEO_LIVE_UTILS || {};
  const esc = s => U().esc ? U().esc(s) : String(s == null ? '' : s);
  const facItem = m => U().facItem ? U().facItem(m) : '';
  const POT_COLORS = ['var(--gold,#edbb52)', 'var(--blue)', 'var(--green,#37bb66)', 'var(--red2)'];
  // Un color por bombo, TODOS de la familia del color de la categoría activa
  // (var(--red2): rojo en avanzados, azul en intermedios, verde en
  // principiantes). Cambia el tono, no el matiz: claro-cálido → puro →
  // profundo, para que se diferencien entre sí y del fondo de la tabla.
  // «No entran» conserva el tono apagado y translúcido de «eliminado».
  const POT_TONE = {
    pot1: 'color-mix(in oklab,var(--red2) 40%,#fff0d8)',
    pot2: 'var(--red2)',
    pot3: 'color-mix(in oklab,var(--red2) 80%,#3d0f1e)'
  };
  // Colores sincronizados con la config de zonas del admin (MISMA fuente que
  // pinta la Fase de Grupos): cada bombo toma el color de su zona —por defecto
  // los tonos de arriba— y así la leyenda de grupos y estos bombos coinciden
  // exactamente. Si la categoría trae una config antigua (o no trae ninguna),
  // los bombos conservan SU paleta: aquí manda el bombo, no la zona.
  function qcolors(qcfg){
    const bands = (qcfg && qcfg.bands) || [];
    const Q = window.SB_QUALCONFIG;
    const by = id => {
      const b = bands.find(x => x.id === id);
      if (!b || !b.color) return null;
      return Q && Q.resolve ? Q.resolve(b.color) : b.color;
    };
    return {
      pot1: by('pot1') || POT_TONE.pot1,
      pot2: by('pot2') || POT_TONE.pot2,
      pot3: by('pot3') || POT_TONE.pot3,
      out: by('out') || 'var(--dim)'
    };
  }

  const COUNTS = { PLAYED:1, WALKOVER:1 };

  function wonBy(mt, nick){
    const isA = mt.a === nick;
    if (mt.sa != null && mt.sb != null) return isA ? mt.sa > mt.sb : mt.sb > mt.sa;
    const w = mt.winner;
    if (w === 'A' || w === 'B') return w === (isA ? 'A' : 'B');
    return String(w == null ? '' : w) === String(nick);
  }

  function baseStats(g, nick, maxPos){
    let pj = 0, pg = 0, sw = 0, sl = 0;
    (g.matches || []).forEach(mt => {
      if (!COUNTS[mt.status]) return;                       // anulados/pendientes fuera
      const isA = mt.a === nick, isB = mt.b === nick;
      if (!isA && !isB) return;
      let ms = isA ? mt.sa : mt.sb, os = isA ? mt.sb : mt.sa;
      if (ms == null || os == null){ const w = wonBy(mt, nick); ms = w ? 2 : 0; os = w ? 0 : 2; }
      pj++; sw += ms; sl += os;
      if (ms > os) pg++;
    });
    return { pj: pj, pg: pg, sw: sw, sl: sl };
  }

  // Orden dentro del Bombo 3: única comparación permitida entre grupos, y solo
  // entre terceros del mismo tamaño efectivo (lo garantiza FI_FORMAT).
  function cmpThirds(a, b){
    if (b.pg !== a.pg) return b.pg - a.pg;                   // victorias
    if (b.dif !== a.dif) return b.dif - a.dif;               // diferencia de sets
    if (b.spct !== a.spct) return b.spct - a.spct;           // % de sets ganados
    return String(a.nickname).localeCompare(String(b.nickname));
  }

  // ── Bloques del tablero: SOLO lo que el competidor necesita saber del
  //    sorteo — quién entra al Bombo 1, al Bombo 2, al Bombo 3 y quién queda
  //    fuera. El formato lo manda el bracket publicado (SB_BRACKETCFG.getPublic
  //    → format) y, si no hay bracket publicado, el motor del reglamento por
  //    número de grupos y tamaño efectivo.
  const ROUND_ES = { SEMIFINAL:'semifinal', QUARTERFINAL:'cuartos de final',
    ROUND_OF_16:'octavos de final', ROUND16:'octavos de final', FINAL:'la final' };

  function fmtOf(cat){
    const n = (cat.groups || []).length;
    if (cat.bfmt && cat.bfmt.directPassCount != null) return cat.bfmt;
    const rec = (window.SB_BRACKETCFG && window.SB_BRACKETCFG.recommendFormat)
      ? window.SB_BRACKETCFG.recommendFormat(n) : null;
    return rec || { mainRound:'QUARTERFINAL', hasAccessRound:true,
      directPassCount:n, accessMatchCount:n, bestThirdsCount:n };
  }

  // Vista de formato preparada por el staff (FaseEliminatoria → Preparación).
  // Vive en localStorage de ESE navegador: si no existe, todo sigue igual.
  function prepView(cat){
    try {
      const raw = localStorage.getItem('kp-format-view:' + (cat && cat.edcatId));
      const o = raw ? JSON.parse(raw) : null;
      return (o && (o.variant === 'ALT' || (o.eff && Object.keys(o.eff).length))) ? o : null;
    } catch(e){ return null; }
  }

  function blocksOf(cat){
    const groups = (cat.groups || []).filter(g => g.players && g.players.length);
    if (!groups.length) return [];
    const E = window.FI_FORMAT;
    const ov = prepView(cat);
    const sizes = groups.map(g => (ov && ov.eff && ov.eff[g.label]) || g.players.length);
    const plan = (E && groups.length >= 2) ? E.planFor(groups.length, sizes) : null;
    const V = plan && ((ov && ov.variant === 'ALT' && plan.alternative) ? plan.alternative : plan.primary);
    const F = fmtOf(cat);
    const slots = V ? V.thirdsSlots : Math.max(0, Number(F.bestThirdsCount) || 0);
    const access = V ? V.kind === 'ACCESS' : !!F.hasAccessRound;
    const mainRound = V ? V.bracketLabel.toLowerCase() : (ROUND_ES[F.mainRound] || 'la ronda principal');

    // Bombo 1 y Bombo 2: por grupo, SIN orden por rendimiento.
    const pick = pos => groups
      .filter(g => g.players.length > pos)
      .map(g => {
        const p = g.players[pos];
        const base = baseStats(g, p.nickname);
        const usePj = base.pj || p.pj, usePg = base.pj ? base.pg : p.pg;
        const useSw = base.pj ? base.sw : p.sw, useSl = base.pj ? base.sl : p.sl;
        return {
          nickname: p.nickname, registration_id: p.registration_id, member: p.member,
          grp: g.label, pos: pos + 1, size: g.players.length,
          pj: p.pj, pg: p.pg, sw: p.sw, sl: p.sl, dif: p.sw - p.sl,
          wpct: usePj ? usePg / usePj : 0,
          spct: (useSw + useSl) ? useSw / (useSw + useSl) : 0
        };
      })
      .sort((a, b) => String(a.grp).localeCompare(String(b.grp)));

    const firsts = pick(0), seconds = pick(1), thirds = pick(2);
    let inThirds = [], outThirds = thirds.slice();
    if (E && slots){
      const sel = E.selectThirds(thirds.map(p => ({
        id: p.registration_id || p.grp, name: p.nickname, groupLabel: p.grp,
        effectiveSize: p.size, wins: p.pg, setDiff: p.dif, setPct: p.spct, ref: p
      })), slots);
      inThirds = sel.qualified.map(x => Object.assign(x.ref, { level:x.level, onCut:x.onCut }));
      outThirds = sel.eliminated.map(x => Object.assign(x.ref, { level:x.level, onCut:x.onCut }));
    } else if (slots){
      inThirds = thirds.slice().sort(cmpThirds).slice(0, slots);
      outThirds = thirds.filter(p => inThirds.indexOf(p) < 0);
    }
    const rest = [];
    groups.forEach(g => g.players.forEach((p, i) => {
      if (i >= 3) rest.push({ nickname:p.nickname, registration_id:p.registration_id, member:p.member,
        grp:g.label, pos:i + 1, size:g.players.length, pj:p.pj, pg:p.pg, sw:p.sw, sl:p.sl,
        dif:p.sw - p.sl, wpct: p.pj ? p.pg / p.pj : 0,
        spct: (p.sw + p.sl) ? p.sw / (p.sw + p.sl) : 0 });
    }));

    const qc = qcolors(cat.qcfg);
    const blocks = [];
    blocks.push({ key:'pot1', label:'BOMBO 1 · PRIMEROS', chip: access ? 'PASE DIRECTO' : 'AL SORTEO',
      color: qc.pot1,
      note: access
        ? 'Todos los primeros con el mismo privilegio: esperan en ' + mainRound
        : 'Todos los primeros entran al sorteo de la llave · sin orden interno',
      rows: firsts });
    if (seconds.length) blocks.push({ key:'pot2', label:'BOMBO 2 · SEGUNDOS', chip:'AL SORTEO', color:qc.pot2,
      note: access ? 'Disputan la ronda de acceso · sin orden interno' : 'Entran a la llave · sin orden interno',
      rows: seconds });
    if (inThirds.length) blocks.push({ key:'pot3', label:'BOMBO 3 · TERCEROS', chip:'AL SORTEO', color:qc.pot3,
      note: 'Terceros seleccionados por tamaño efectivo de grupo (sistema 5–4–3)', rows: inThirds });
    const out = outThirds.concat(rest);
    if (out.length) blocks.push({ key:'out', label:'NO ENTRAN AL SORTEO', chip:'FUERA', color:qc.out,
      out:true, note: slots
        ? 'Si la tabla termina así, quedan fuera: hay ' + slots + ' plaza' + (slots === 1 ? '' : 's') + ' de tercero'
        : 'Este formato no admite terceros: solo primeros y segundos',
      rows: out });
    return blocks;
  }


  // Datos de la fila seleccionada → estadísticas de la EDICIÓN EN CURSO.
  let STATS = [];

  const pctTxt = v => Math.round(v * 100) + '%';
  const difTxt = v => (v > 0 ? '+' : (v < 0 ? '−' : '')) + Math.abs(v);
  const tierOf = p => !p.pj ? 't-none' : (p.wpct >= 0.7 ? 't-hi' : (p.wpct >= 0.4 ? 't-mid' : 't-lo'));

  function rowHtml(p, num, kind, idx, color){
    const nameHtml = (window.SB_LINKS && p.registration_id)
      ? '<a class="nm-t" href="' + esc(window.SB_LINKS.buildPlayerProfileUrl(p.registration_id)) + '">' + esc(p.nickname) + '</a>'
      : '<span class="nm-t">' + esc(p.nickname) + '</span>';
    const posCell = '<span class="bb-pos">#' + num + '</span>';
    return '<div class="bb-row ' + (num % 2 ? 'is-odd' : 'is-even') + (kind === 'out' ? ' is-out' : '') +
      ' ' + tierOf(p) + '" style="--bb:' + (color || 'var(--ap-gold)') + '" data-i="' + idx + '">' +
      posCell +
      '<span class="bb-name">' + nameHtml + '</span>' +
      '<span class="bb-pct">' + pctTxt(p.wpct) + '</span>' +
    '</div>';
  }

  // ── panel derecho: ring + filas de la edición activa (no histórico) ──
  function edTag(){
    const t = document.getElementById('bbRTag');
    if (!t) return;
    const C = window.SB_CATALOG;
    const ed = (C && C._cachedEdition) ? C._cachedEdition() : null;
    const raw = ed ? String(ed.name || ed.slug || '') : '';
    const m = raw.match(/(\d{4})\s*[-–/_]\s*([12])/);
    const lbl = m ? (m[1] + '-' + m[2]) : raw.trim();
    t.textContent = lbl ? ('Estadísticas ' + lbl) : 'Estadísticas de la edición';
  }

  function statRow(label, val, cls){
    return '<div class="bb-statrow"><span>' + label + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</b></div>';
  }

  function showStats(d){
    const who = document.getElementById('bbWho');
    const cat = document.getElementById('bbCat');
    const box = document.getElementById('bbStats');
    if (!box) return;
    if (!d){
      if (who) who.textContent = '—';
      if (cat) cat.hidden = true;
      box.innerHTML = '<div class="bb-rempty">Sin datos todavía.</div>';
      return;
    }
    if (who) who.textContent = d.nickname || '—';
    if (cat){
      cat.className = 'bb-cat';
      cat.style.background = d.color || 'var(--dim)';
      cat.style.color = d.textColor || '#fff';
      cat.textContent = d.band + (d.chip ? ' · ' + d.chip : '');
      cat.hidden = false;
    }
    const pct = d.pj ? Math.round(d.pg / d.pj * 100) : 0;
    const lost = Math.max(0, d.pj - d.pg);
    const dif = d.sw - d.sl;
    box.innerHTML =
      '<div class="bb-ringrow">' +
        '<div class="bb-ring-side loss"><div class="bb-ring-icon"><img src="assets/cross-white.png" alt=""></div>' +
          '<b>' + lost + '</b><span>PERDIDOS</span></div>' +
        '<div class="bb-ring-wrap" style="--bb-pct:' + (pct * 3.6) + 'deg">' +
          '<div class="bb-ring-shadow" aria-hidden="true"></div>' +
          '<div class="bb-ring-hole" aria-hidden="true"></div>' +
          '<div class="bb-ring-donut" aria-hidden="true"></div>' +
          '<div class="bb-ring-center"><b>' + pct + '<i>%</i></b><span>VICTORIAS</span></div>' +
        '</div>' +
        '<div class="bb-ring-side win"><div class="bb-ring-icon"><img src="assets/trophy-white.svg" alt=""></div>' +
          '<b>' + d.pg + '</b><span>GANADOS</span></div>' +
      '</div>' +
      '<div class="bb-statrows">' +
        statRow('Partidos jugados', d.pj) +
        statRow('Sets ganados', d.sw) +
        statRow('Sets perdidos', d.sl) +
        statRow('Diferencia de sets', (dif > 0 ? '+' : '') + dif, dif > 0 ? 'pos' : (dif < 0 ? 'neg' : '')) +
        statRow('Grupo', d.grp + ' · ' + d.pos + '.º de ' + d.size) +
      '</div>';
  }

  function select(row){
    const list = document.getElementById('bbList');
    if (!list || !row) return;
    list.querySelectorAll('.bb-row.is-sel').forEach(x => x.classList.remove('is-sel'));
    row.classList.add('is-sel');
    showStats(STATS[+row.dataset.i]);
  }

  // ── botón de la sección + contenido del modal ─────────────────────────
  function render(cat){
    const lead = document.getElementById('bbBody');
    const list = document.getElementById('bbList');
    const kicker = document.getElementById('bbKicker');
    const tag = document.getElementById('bbTag');
    if (!lead || !list) return;

    if (!cat || !cat.groups || !cat.groups.length){
      const msg = cat ? 'Aún no hay grupos publicados en esta categoría' : 'Elige una categoría para ver los bombos';
      lead.innerHTML = '<div class="empty-pick"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg><span>' + msg + '</span></div>' + btnHtml(true);
      list.innerHTML = '<div class="bb-empty">Aún no hay grupos publicados en esta categoría.</div>';
      if (kicker) kicker.textContent = '—';
      if (tag) tag.textContent = '—';
      STATS = [];
      edTag();
      showStats(null);
      wire();
      return;
    }

    const anyPlayed = cat.groups.some(g => g.players.some(p => p.pj > 0));
    const blocks = blocksOf(cat);
    const total = blocks.reduce((n, b) => n + b.rows.length, 0);
    const state = anyPlayed ? (cat.scheduled > 0 ? 'PROVISIONAL' : 'CERRADO') : 'SIN PARTIDOS';
    if (tag) tag.textContent = state;
    const on = document.querySelector('#catSeg button.on');
    const catName = (cat.name || (on && on.textContent.trim()) || 'Categoría').toUpperCase();
    const ov = prepView(cat);
    if (kicker) kicker.textContent = catName + ' · ' + total + ' participantes · ' + state +
      (ov ? ' · FORMATO AJUSTADO POR STAFF (SOLO EN ESTE NAVEGADOR)' : '');

    lead.innerHTML = '<div class="bb-sum">' + blocks.map(b =>
        '<span class="bb-lg" style="--bb:' + b.color + '"><span class="sw"></span>' + esc(b.label.split(' · ')[0]) +
        ' <b>' + b.rows.length + '</b></span>').join('') +
      '<span class="bb-lg" style="margin-left:auto;--bb:var(--line2)"><span class="sw"></span>Total <b>' + total + '</b></span></div>' +
      '<p class="bb-note">' + (anyPlayed
        ? ('Orden en vivo de la tabla de cada grupo. Dentro del Bombo 1 y del Bombo 2 no hay orden interno: los primeros no se comparan entre sí y los segundos tampoco. ' +
           (cat.scheduled > 0
            ? 'Provisional: aún hay ' + cat.scheduled + ' partido(s) por jugar.'
            : 'Todos los partidos de grupos están jugados.'))
        : 'Aún no hay partidos jugados: el orden es el inicial de cada grupo y puede cambiar por completo.') +
      '</p>' + btnHtml(false);

    let html = '', num = 0;
    STATS = [];
    blocks.forEach(b => {
      html += '<div class="bb-band" style="--bb:' + b.color + '"><b>' + esc(b.label) + '</b>' +
        '<button type="button" class="bb-bandinfo" aria-expanded="false" aria-label="Qu\u00e9 significa este corte">' +
        '<svg aria-hidden="true" focusable="false"><use href="#ico-i"></use></svg></button>' +
        '<small class="bb-note">' + esc(b.note) + '</small></div>';
      b.rows.forEach(p => {
        const kind = b.out ? 'out' : '';
        const chip = b.chip;
        num++;
        STATS.push({ nickname: p.nickname, grp: p.grp, pj: p.pj, pg: p.pg, sw: p.sw, sl: p.sl,
          pos: p.pos, size: p.size, level: p.level || null,
          band: b.label.split(' · ')[0], chip: chip, color: b.color, textColor: b.textColor });
        html += rowHtml(p, num, kind, STATS.length - 1, b.color);
      });
    });
    list.innerHTML = html;
    edTag();
    list.querySelectorAll('.bb-row').forEach(row => {
      row.addEventListener('click', ev => {
        if (ev.target.closest && ev.target.closest('a')) return; // el nombre abre el perfil
        select(row);
      });
    });
    const first = list.querySelector('.bb-row');
    if (first) select(first); else showStats(null);
    list.querySelectorAll('.acad-slot').forEach(slot => {
      if (!window.SB_LINKS) return;
      const link = window.SB_LINKS.makeAcademicLogoLink(slot.dataset.fac, slot.dataset.car || null, null, null);
      if (link){ link.addEventListener('click', ev => ev.stopPropagation()); slot.replaceWith(link); }
    });
    wire();
  }

  function btnHtml(disabled){
    return '<button type="button" class="bb-btn" id="bbOpen"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="fva-chip" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="fva-label">Ver bombos</span>' +
      '<span class="fva-arrow" aria-hidden="true">›</span></button>';
  }

  // ── apertura / cierre del modal ───────────────────────────────────────
  let bound = false;
  function open(){
    const m = document.getElementById('bbModal');
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    const c = document.getElementById('bbClose');
    if (c) c.focus();
  }
  function close(){
    const m = document.getElementById('bbModal');
    if (!m) return;
    m.hidden = true;
    document.body.style.overflow = '';
  }
  function wire(){
    const btn = document.getElementById('bbOpen');
    if (btn) btn.onclick = open;
    if (bound) return;
    bound = true;
    const m = document.getElementById('bbModal');
    const c = document.getElementById('bbClose');
    if (c) c.addEventListener('click', close);
    if (m) m.addEventListener('click', e => { if (e.target === m) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && m && !m.hidden) close();
    });
  }

  window.TORNEO_BOMBOS = { render, open, close };
})();
