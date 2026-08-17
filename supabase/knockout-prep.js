// ── Preparación del sorteo eliminatorio (sorteo FÍSICO) · v3 ─────────────
// Bombo 1 (todos los primeros) · Bombo 2 (todos los segundos) · Bombo 3
// (terceros seleccionados con el sistema 5–4–3), pases directos iguales para
// todos los primeros, registro de emparejamientos extraídos e imprimibles.
// NO sortea, NO selecciona rivales, NO crea public.matches.
//
// Reglamento (supabase/format-engine.js es la única fuente de verdad):
//   · Dentro del Bombo 1 y del Bombo 2 NO existe ranking interno: no se
//     comparan primeros entre sí ni segundos entre sí, jamás.
//   · Los únicos comparables entre grupos distintos son los terceros, y solo
//     contra terceros del mismo tamaño efectivo (Nivel A=5, B=4, C=3).
//   · Si hay pases directos los reciben TODOS los primeros; nunca algunos.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const C = () => window.GB_CORE;
  const F = () => window.FI_FORMAT;
  const UI = () => window.SB_UI;
  let activeEdcat = null;
  const standingsCache = {};
  const potOverride = {};      // rid → '1'|'2'|'3' (ajuste manual del organizador)
  let effOverride = {};        // gid → { size, reason } (tamaño efectivo declarado)
  let variantChoice = 'REC';   // 'REC' | 'ALT'
  let extractions = [];        // registro de emparejamientos extraídos (borrador)
  let lastCalc = null;         // resultado del último cálculo (para docs/acta)

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(id){
    ['noSession','deniedView','prepView','bootState'].forEach(v => { const n = $('#'+v); if (n) n.style.display = 'none'; });
    if (id) $('#'+id).style.display = 'block';
  }
  function st(){ return C().state; }
  function catOf(id){ return st().edcats.find(c => c.id === id); }
  function catName(){ const c = catOf(activeEdcat); return c ? (c.name || c.code) : ''; }
  function catPrefix(){
    const c = catOf(activeEdcat);
    return String((c && (c.code || c.name)) || 'CAT').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CAT';
  }

  async function boot(){
    if (!window.SB_READY){ show('bootState'); $('#bootState').innerHTML = '<b>Sitio no conectado</b>Falta supabase/config.js.'; return; }
    if (!F()){ show('bootState'); $('#bootState').innerHTML = '<b>Falta el motor del reglamento</b>No se cargó supabase/format-engine.js.'; return; }
    window.SB_AUTH.onAuthChange(session => { if (!session) show('noSession'); });
    try {
      const session = await window.SB_AUTH.getSession();
      if (!session){ show('noSession'); return; }
      $('#whoami').textContent = (session.user && session.user.email) || '';
      let organizer = false;
      try { organizer = await window.SB_AUTH.isOrganizer(); } catch(e){}
      if (!organizer){ show('deniedView'); return; }
      $('#bootState').innerHTML = '<span class="spin">◌</span> Cargando datos…';
      await C().load();
      activeEdcat = st().edcats.length ? st().edcats[0].id : null;
      loadLocal();
      show('prepView');
      renderTabs();
      await renderAll();
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('KP-000', e);
      show('bootState');
      $('#bootState').innerHTML = '<b>Error al cargar</b>' + (e.message || 'Revisa la conexión.');
    }
  }

  function groupsOf(edcatId){ return (st().groupsByEdcat[edcatId] || []); }
  function membersCount(edcatId, groupId){
    return Object.keys(st().cur).filter(rid => {
      const c = st().cur[rid];
      return c.edcat === edcatId && String(c.group) === String(groupId);
    }).length;
  }

  function renderTabs(){
    const wrap = $('#kpTabs');
    wrap.textContent = '';
    st().edcats.forEach(c => {
      const b = el('button', 'kp-tab' + (c.id === activeEdcat ? ' on' : ''), c.name || c.code);
      b.type = 'button';
      b.addEventListener('click', async () => {
        activeEdcat = c.id;
        Object.keys(potOverride).forEach(k => delete potOverride[k]);
        variantChoice = 'REC';
        loadLocal();
        renderTabs(); await renderAll();
      });
      wrap.appendChild(b);
    });
  }

  async function standingsFor(groupId){
    if (standingsCache[groupId]) return standingsCache[groupId];
    try {
      const rows = await C().standings(groupId) || [];
      standingsCache[groupId] = rows;
      return rows;
    } catch(e){ window.SB_LOG && window.SB_LOG.error('KP-STD', e); return []; }
  }

  // ── métricas: SOLO se usan para comparar terceros del mismo nivel ─────
  // No existen puntos reales por set en la base (get_group_standings no los
  // devuelve), así que los criterios de puntos del reglamento no se muestran.
  function metrics(s){
    const pj = Number(s.matches_played || 0);
    const sw = Number(s.sets_won || 0), sl = Number(s.sets_lost || 0);
    return { pj, wins:Number(s.wins || 0), setsWon:sw, setsLost:sl,
             setDiff: sw - sl, setPct: Number(s.set_pct || (sw + sl ? sw / (sw + sl) : 0)) };
  }
  const ridOf = (row, group, pos) => row.registration_id || (group.id + ':' + pos);
  function roundName(size){ return { 32:'DIECISEISAVOS', 16:'OCTAVOS', 8:'CUARTOS', 4:'SEMIFINAL', 2:'FINAL' }[size] || 'RONDA'; }
  function roundCode(size){ return { 32:'R32', 16:'OF', 8:'QF', 4:'SF', 2:'F' }[size] || 'R'; }

  // ── cálculo principal ────────────────────────────────────────────────
  async function compute(){
    const groups = groupsOf(activeEdcat).filter(g => membersCount(activeEdcat, g.id) > 0);
    if (!groups.length) return null;
    const perGroup = [];
    for (const g of groups){
      const rows = await standingsFor(g.id);
      const ov = effOverride[g.id];
      const declared = rows.length;
      const effective = ov && ov.size ? Number(ov.size) : declared;
      perGroup.push({ group:g, rows, declared, effective, reason: (ov && ov.reason) || 'AUTO' });
    }
    const G = perGroup.length;
    const effSizes = perGroup.map(x => x.effective);
    const plan = F().planFor(G, effSizes);
    const variant = (variantChoice === 'ALT' && plan.alternative) ? plan.alternative : plan.primary;

    // Bombo 1 y Bombo 2: orden alfabético por grupo. NUNCA por rendimiento.
    const pick = pos => perGroup
      .filter(x => x.rows.length > pos)
      .map(x => ({ rid: ridOf(x.rows[pos], x.group, pos), s:x.rows[pos], group:x.group,
                   pos: pos + 1, effective:x.effective, m: metrics(x.rows[pos]) }))
      .sort((a, b) => String(a.group.label).localeCompare(String(b.group.label)));
    const firsts = pick(0), seconds = pick(1), thirdsAll = pick(2);

    // Bombo 3: sistema 5–4–3 sobre los terceros
    const sel = variant ? F().selectThirds(thirdsAll.map(q => ({
      id:q.rid, name:q.s.nickname || '—', groupLabel:q.group.label, effectiveSize:q.effective,
      wins:q.m.wins, setDiff:q.m.setDiff, setPct:q.m.setPct, played:q.m.pj, ref:q
    })), variant.thirdsSlots) : { levels:[], qualified:[], eliminated:[], tied:[], missing:0, needsTiebreak:false };
    const thirds = sel.qualified.map(x => x.ref);

    const pots = { '1': firsts.slice(), '2': seconds.slice(), '3': thirds.slice() };
    Object.keys(potOverride).forEach(rid => {
      const target = String(potOverride[rid]);
      if (!pots[target]) return;
      let item = null;
      Object.keys(pots).forEach(p => {
        const i = pots[p].findIndex(q => String(q.rid) === String(rid));
        if (i >= 0) item = pots[p].splice(i, 1)[0];
      });
      if (item) pots[target].push(item);
    });

    const access = variant && variant.kind === 'ACCESS';
    const direct = access ? pots['1'].slice() : [];
    const drawn = access ? pots['2'].length + pots['3'].length
                         : pots['1'].length + pots['2'].length + pots['3'].length;
    const warn = [];
    perGroup.forEach(x => {
      if (x.rows.length < 2) warn.push('El grupo ' + x.group.label + ' no tiene segundo lugar calculable (' + x.rows.length + ' integrante' + (x.rows.length === 1 ? '' : 's') + ').');
      if (x.effective !== x.declared) warn.push('Grupo ' + x.group.label + ': tamaño efectivo declarado ' + x.effective +
        ' en lugar de ' + x.declared + ' (' + reasonLabel(x.reason) + ').');
    });
    if (variant && access && drawn !== variant.accessPlayers)
      warn.push('La ronda de acceso debería tener ' + variant.accessPlayers + ' jugadores y hay ' + drawn + '. Revisa bombos y terceros.');
    if (variant && !access && drawn !== variant.bracket)
      warn.push('La llave directa necesita ' + variant.bracket + ' jugadores y hay ' + drawn + '. Revisa bombos y terceros.');
    if (sel.needsTiebreak) warn.push('Hay un empate exactamente en la última plaza de terceros: resuélvelo antes del sorteo (partido de desempate o repechaje corto).');
    if (variant && access && pots['1'].length > variant.bracket / 2)
      warn.push('Hay ' + pots['1'].length + ' primeros para ' + (variant.bracket / 2) + ' partidos de la llave principal: algún partido enfrentará a dos primeros. ' +
        'Es estructural y admisible: todos los primeros conservan exactamente el mismo privilegio.');

    return { perGroup, groups, G, effSizes, plan, variant, access,
             firsts, seconds, thirdsAll, sel, pots, direct,
             N: variant ? variant.bracket : 0, M: drawn,
             accessMatches: variant ? variant.accessMatches : 0, warn };
  }

  const reasonLabel = r => ({
    AUTO:'automático, según integrantes vigentes',
    KEEP:'baja después de completar su calendario: sus resultados permanecen',
    DROP:'baja sin partidos o resultados anulados',
    MANUAL:'ajuste manual del organizador'
  })[r] || 'ajuste manual';

  // ── render ───────────────────────────────────────────────────────────
  async function renderAll(){
    const body = $('#kpBody');
    body.textContent = '';
    $('#kpKpis').textContent = '';
    if (!activeEdcat){ body.appendChild(el('div', 'state', 'Sin categorías.')); return; }
    body.appendChild(el('div', 'state', 'Calculando posiciones…'));
    const R = await compute();
    body.textContent = '';
    lastCalc = R;
    renderPlan(R);
    if (!R){
      body.appendChild(el('div', 'state', 'Esta categoría todavía no tiene grupos con integrantes. Captura primero el sorteo de grupos en el Tablero.'));
      renderExtractions();
      return;
    }

    const V = R.variant;
    const kw = $('#kpKpis');
    [[R.G,'Grupos'],[R.firsts.length,'Primeros (Bombo 1)'],[R.seconds.length,'Segundos (Bombo 2)'],
     [R.pots['3'].length,'Terceros (Bombo 3)'],[V ? V.directPasses : 0,'Pases directos'],
     [R.accessMatches,'Partidos de acceso'],[R.N,'Llave principal'],[R.M,'Jugadores a sortear']].forEach(([v, lbl]) => {
      const k = el('div', 'kp-kpi');
      k.appendChild(el('b', null, String(v)));
      k.appendChild(el('small', null, lbl));
      kw.appendChild(k);
    });
    const wn = $('#kpWarn');
    wn.textContent = R.warn.join(' ');
    wn.style.display = R.warn.length ? 'block' : 'none';

    // pases directos (todos los primeros o ninguno)
    if (R.direct.length){
      body.appendChild(el('h2', 'kp-sec', 'Pases directos · ' + R.direct.length + ' (todos los primeros lugares)'));
      const ul = el('ul', 'kp-list');
      R.direct.forEach(q => ul.appendChild(el('li', null,
        (q.s.nickname || '—') + ' — 1.º Grupo ' + q.group.label + ' · espera en la llave principal (' + roundName(R.N).toLowerCase() + ')')));
      body.appendChild(ul);
      body.appendChild(el('p', 'kp-note', 'Todos los primeros reciben exactamente el mismo privilegio. Un pase directo no cuenta como partido, victoria ni default.'));
    }

    // bombos
    body.appendChild(el('h2', 'kp-sec', 'Bombo 1 · primeros lugares (' + R.pots['1'].length + ')'));
    body.appendChild(el('p', 'kp-note', 'Sin orden interno y sin estadísticas comparativas: los primeros no se comparan entre sí. ' +
      'La lista va en orden alfabético de grupo solo para poder revisarla.'));
    body.appendChild(potTable(R, '1', false));

    body.appendChild(el('h2', 'kp-sec', 'Bombo 2 · segundos lugares (' + R.pots['2'].length + ')'));
    body.appendChild(el('p', 'kp-note', 'Sin orden interno y sin estadísticas comparativas: los segundos no se comparan entre sí.'));
    body.appendChild(potTable(R, '2', false));

    body.appendChild(el('h2', 'kp-sec', 'Bombo 3 · terceros seleccionados (' + R.pots['3'].length +
      ' de ' + (R.variant ? R.variant.thirdsSlots : 0) + ' plazas)'));
    if (!R.variant || !R.variant.thirdsSlots){
      body.appendChild(el('p', 'kp-note', 'Este formato no admite terceros: los terceros de grupos efectivos de 3 también son últimos de su grupo y quedan eliminados.'));
    } else {
      body.appendChild(el('p', 'kp-note', 'Única comparación permitida entre grupos distintos. Se compara solo dentro del mismo tamaño efectivo: ' +
        'Nivel A (grupos de 5) → Nivel B (grupos de 4) → Nivel C (grupos de 3, solo si es indispensable). ' +
        'Criterios: victorias → diferencia de sets → % de sets ganados. No hay criterios de puntos porque la base no guarda puntos por set.'));
    }
    body.appendChild(potTable(R, '3', true));
    R.sel.levels.forEach(l => {
      if (!l.list.length) return;
      body.appendChild(el('h3', 'kp-sub', 'Nivel ' + l.level + ' · terceros de grupos efectivos de ' + l.size +
        ' — clasifican ' + l.admitted + ' de ' + l.list.length));
      body.appendChild(levelTable(l));
    });
    if (R.sel.eliminated.length){
      body.appendChild(el('p', 'kp-note', 'Terceros eliminados: ' + R.sel.eliminated.map(x =>
        (x.name || '—') + ' (Grupo ' + x.groupLabel + ', nivel ' + x.level + ')').join(' · ') + '.'));
    }

    // procedimiento físico
    const proc = el('div', 'kp-rules');
    proc.innerHTML = '<b>Procedimiento del sorteo físico</b>' + (R.access
      ? '<ul><li><b>1.</b> Los ' + R.pots['1'].length + ' primeros esperan en la llave principal: se extrae cada primero del <b>Bombo 1</b> y una pelota de la <b>caja de posiciones</b> (' +
        roundName(R.N) + ' 1–' + Math.max(1, R.N / 2) + ').</li>' +
        '<li><b>2.</b> Ronda de acceso: se extrae un tercero del <b>Bombo 3</b> y se le enfrenta a un segundo del <b>Bombo 2</b> <b>de otro grupo</b>.</li>' +
        '<li><b>3.</b> Los segundos restantes se enfrentan entre sí.</li>' +
        '<li><b>4.</b> Cada pareja de acceso saca su posición de la <b>caja de acceso</b> (ACCESO 1–' + Math.max(1, R.accessMatches) + ').</li>' +
        '<li><b>5.</b> Evitar revancha inmediata contra alguien del mismo grupo; si sale, reextracción y se registra el motivo.</li>' +
        '<li><b>6.</b> Publicada la llave, <b>no se vuelve a sortear</b>.</li></ul>'
      : '<ul><li><b>1.</b> Se reparten los primeros del <b>Bombo 1</b> en sectores distintos de la llave (caja de posiciones ' +
        roundName(R.N) + ' 1–' + Math.max(1, R.N / 2) + ').</li>' +
        '<li><b>2.</b> Los terceros del <b>Bombo 3</b> se sortean preferentemente contra primeros <b>de otro grupo</b>.</li>' +
        '<li><b>3.</b> Los primeros restantes se sortean contra segundos del <b>Bombo 2</b>.</li>' +
        '<li><b>4.</b> Los espacios que queden se completan con segundos contra segundos.</li>' +
        '<li><b>5.</b> Evitar rivales del mismo grupo en la primera ronda; si sale, reextracción documentada.</li>' +
        '<li><b>6.</b> Se sortea también la posición de cada partido en el bracket. Publicada la llave, <b>no se vuelve a sortear</b>.</li></ul>');
    body.appendChild(proc);

    renderExtractions();
  }

  // resumen del formato + tamaños efectivos + variante
  function renderPlan(R){
    const host = $('#kpPlan');
    if (!host) return;
    host.textContent = '';
    if (!R || !R.variant){
      host.appendChild(el('p', 'kp-note', 'Sin grupos con integrantes: el formato se calcula cuando exista al menos 2 grupos.'));
      const sel = $('#kpVariant'); if (sel) sel.parentElement.style.display = 'none';
      return;
    }
    const V = R.variant, P = R.plan;
    const E = F();
    const isRec = V === P.primary;
    const head = el('div', 'kp-plan');
    head.innerHTML = '<span class="kp-plan-k">' + (isRec ? 'Formato recomendado' : 'Formato elegido') + '</span>' +
      '<b>' + V.title + '</b>' +
      '<span class="kp-plan-tag">' + (V.tag || P.tag) + '</span>' +
      '<span class="kp-note" style="flex:1 1 100%">' +
        (E.plainVariant ? E.plainVariant(V) : '') + '</span>' +
      '<span class="kp-note" style="flex:1 1 100%;opacity:.75">' +
        (E.summarizeVariant ? E.summarizeVariant(P, V) : P.summary) + '</span>';
    host.appendChild(head);

    const adv = document.createElement('details');
    adv.className = 'kp-adv';
    const overrides = R.perGroup.filter(x => x.reason && x.reason !== 'AUTO').length;
    const cap = document.createElement('summary');
    cap.innerHTML = 'Ajustes avanzados · tamaño efectivo por grupo' +
      (overrides ? ' <b>' + overrides + ' ajustado' + (overrides === 1 ? '' : 's') + '</b>' : ' <i>automático</i>');
    adv.appendChild(cap);
    if (overrides) adv.open = true;

    const eff = el('div', 'kp-eff');
    R.perGroup.forEach(x => {
      const row = el('div', 'kp-effrow');
      row.appendChild(el('span', 'g', 'Grupo ' + x.group.label));
      const sel = document.createElement('select');
      sel.className = 'filter';
      [['AUTO', 'Automático: ' + x.declared + ' vigentes'],
       ['KEEP', 'Baja con calendario completo: mantener ' + Math.max(x.declared, x.declared + 1)],
       ['DROP', 'Baja sin partidos / anulados: ' + Math.max(0, x.declared - 1)]]
        .forEach(([v, lbl]) => {
          const o = document.createElement('option');
          o.value = v; o.textContent = lbl;
          if (x.reason === v) o.selected = true;
          sel.appendChild(o);
        });
      sel.addEventListener('change', async () => {
        const v = sel.value;
        if (v === 'AUTO') delete effOverride[x.group.id];
        else effOverride[x.group.id] = { reason:v, size: v === 'KEEP' ? x.declared + 1 : Math.max(0, x.declared - 1) };
        saveLocal();
        await renderAll();
        UI() && UI().toast('Tamaño efectivo del grupo ' + x.group.label + ': ' + reasonLabel(v) + '. Solo afecta a esta página.', 'ok');
      });
      row.appendChild(sel);
      row.appendChild(el('span', 'e', 'efectivo ' + x.effective));
      eff.appendChild(row);
    });
    adv.appendChild(eff);
    // aviso: el ajuste local cambió el formato respecto al real (el público)
    const realSizes = (R.perGroup || []).map(x => x.declared);
    const realPlan = E.planFor ? E.planFor(R.perGroup.length, realSizes) : null;
    const RV = realPlan && realPlan.primary;
    const differs = RV && (RV.id !== V.id || RV.bracket !== V.bracket || RV.thirdsSlots !== V.thirdsSlots);
    if (differs){
      const warn = el('div', 'kp-mismatch');
      warn.innerHTML = '<b>Este formato no es el que sale de los datos reales.</b>' +
        '<span>Con los tamaños reales (' + realSizes.join('–') + ') el reglamento da <i>' + RV.title + '</i>' +
        (RV.thirdsSlots ? ' con ' + RV.thirdsSlots + ' tercero' + (RV.thirdsSlots === 1 ? '' : 's') : ' sin terceros') +
        '. Tú estás preparando <i>' + V.title + '</i>.</span>';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn btn-ghost';
      btn.textContent = 'Volver al automático';
      btn.addEventListener('click', async () => { clearView(); await renderAll(); UI() && UI().toast('Formato de vuelta al recomendado por los datos reales.', 'ok'); });
      warn.appendChild(btn);
      host.appendChild(warn);
    }
    const sync = el('div', 'kp-sync' + (differs ? ' is-off' : ''));
    sync.innerHTML = differs
      ? '<b>Bombos al momento</b> muestra este mismo formato en <b>este navegador</b>. Para todo el mundo, publícalo en «Editar el bracket».'
      : '<b>Bombos al momento</b> coincide con este formato.';
    host.appendChild(sync);
    publishView(R);

    adv.appendChild(el('p', 'kp-note', 'Solo tócalo si alguien se dio de baja o se le anularon resultados: el tamaño efectivo decide la prioridad de los terceros (5–4–3). ' +
      'El automático viene de get_group_standings y los ajustes se guardan solo en este navegador.'));
    host.appendChild(adv);

    const sel = $('#kpVariant');
    if (sel){
      sel.parentElement.style.display = R.plan.alternative ? '' : 'none';
      sel.textContent = '';
      [['REC', R.plan.primary.title + ' · ' + (R.plan.primary.tag || '')],
       ['ALT', R.plan.alternative ? R.plan.alternative.title + ' · ' + R.plan.alternative.tag : '']]
        .forEach(([v, lbl]) => {
          if (!lbl.trim()) return;
          const o = document.createElement('option');
          o.value = v; o.textContent = lbl;
          if (variantChoice === v) o.selected = true;
          sel.appendChild(o);
        });
    }
  }

  // Bombo 1 y 2: SIN estadísticas. Bombo 3: con las métricas del nivel.
  function potTable(R, pot, withStats){
    const t = document.createElement('table'); t.className = 'kp';
    t.innerHTML = withStats
      ? '<thead><tr><th>#</th><th class="l">Nombre</th><th>Grupo</th><th>Tam. efectivo</th><th>Nivel</th><th>PJ</th><th>PG</th><th>Dif. sets</th><th>% sets</th><th>Bombo</th></tr></thead>'
      : '<thead><tr><th>#</th><th class="l">Nombre</th><th>Grupo</th><th>Posición</th><th>Bombo</th></tr></thead>';
    const tb = document.createElement('tbody');
    if (!R.pots[pot].length){
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = withStats ? 10 : 5;
      td.textContent = 'Vacío.'; td.style.color = 'var(--muted)';
      tr.appendChild(td); tb.appendChild(tr);
    }
    R.pots[pot].forEach((q, i) => {
      const tr = document.createElement('tr');
      const cells = withStats
        ? [i + 1, q.s.nickname || '—', q.group.label, q.effective, F().levelOfSize(q.effective),
           q.m.pj, q.m.wins, (q.m.setDiff > 0 ? '+' : '') + q.m.setDiff, Math.round(q.m.setPct * 100) + '%']
        : [i + 1, q.s.nickname || '—', q.group.label, q.pos + '.º'];
      cells.forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (j === 1) td.className = 'l';
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      const sel = document.createElement('select'); sel.className = 'filter'; sel.style.minHeight = '34px';
      ['1','2','3'].forEach(p => {
        const o = document.createElement('option'); o.value = p; o.textContent = p;
        if (p === pot) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', async () => {
        const esperado = String(q.pos);
        if (sel.value !== esperado &&
            !confirm('El ' + q.pos + '.º de grupo corresponde al Bombo ' + esperado +
                     '. Mover a Bombo ' + sel.value + ' rompe el reglamento (el bombo lo define la posición de grupo). ¿Continuar como excepción documentada?')){
          sel.value = pot; return;
        }
        potOverride[q.rid] = sel.value;
        await renderAll();
        UI().toast('Ajuste manual: ' + (q.s.nickname || '') + ' → Bombo ' + sel.value + '.', 'warn');
      });
      td.appendChild(sel);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }

  // tabla por nivel de terceros (nunca mezcla niveles)
  function levelTable(l){
    const t = document.createElement('table'); t.className = 'kp';
    t.innerHTML = '<thead><tr><th>#</th><th class="l">Nombre</th><th>Grupo</th><th>PG</th><th>Dif. sets</th><th>% sets</th><th>Estado</th></tr></thead>';
    const tb = document.createElement('tbody');
    l.list.forEach((x, i) => {
      const tr = document.createElement('tr');
      const estado = x.status === 'IN' ? 'CLASIFICA' : (l.level === 'C' ? 'ELIMINADO (reserva)' : 'ELIMINADO');
      [i + 1, x.name, x.groupLabel, x.wins, (x.setDiff > 0 ? '+' : '') + x.setDiff,
       Math.round((x.setPct || 0) * 100) + '%', estado + (x.onCut ? ' · EMPATE EN EL CORTE' : '')]
        .forEach((v, j) => {
          const td = document.createElement('td');
          td.textContent = v;
          if (j === 1) td.className = 'l';
          if (j === 6){
            td.style.color = x.status === 'IN' ? 'var(--green)' : 'var(--muted)';
            if (x.onCut) td.style.color = 'var(--gold)';
          }
          tr.appendChild(td);
        });
      if (i + 1 === l.admitted && l.admitted < l.list.length) tr.style.borderBottom = '2px solid var(--gold)';
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }

  // ── borradores locales ───────────────────────────────────────────────
  // Vista de formato compartida con la página pública (Bombos al momento).
  // Es un AJUSTE DE ESTE NAVEGADOR: no toca Supabase ni el bracket publicado.
  function viewKey(id){ return 'kp-format-view:' + (id == null ? activeEdcat : id); }
  function publishView(R){
    try {
      const eff = {};
      (R.perGroup || []).forEach(x => { if (x.reason && x.reason !== 'AUTO') eff[x.group.label] = x.effective; });
      const dirty = variantChoice === 'ALT' || Object.keys(eff).length > 0;
      if (!dirty) localStorage.removeItem(viewKey());
      else localStorage.setItem(viewKey(), JSON.stringify({
        variant: variantChoice, eff: eff, savedAt: new Date().toISOString()
      }));
    } catch(e){}
  }
  function clearView(){
    effOverride = {}; variantChoice = 'REC';
    saveLocal();
    try { localStorage.removeItem(viewKey()); } catch(e){}
  }
  function draftKey(){ return 'kp-extraction-draft:' + activeEdcat; }
  function effKey(){ return 'kp-effective-size:' + activeEdcat; }
  function loadLocal(){
    extractions = []; effOverride = {};
    try {
      const raw = localStorage.getItem(draftKey());
      if (raw) extractions = (JSON.parse(raw).list || []);
    } catch(e){}
    try {
      const raw = localStorage.getItem(effKey());
      if (raw) effOverride = JSON.parse(raw) || {};
    } catch(e){}
  }
  function saveLocal(){
    try { localStorage.setItem(effKey(), JSON.stringify(effOverride)); } catch(e){}
  }
  function saveExtractions(){
    // borrador temporal (NO fuente oficial: el bracket se guarda/publica en BracketAdmin)
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        savedAt: new Date().toISOString(),
        edcatId: activeEdcat,
        category: catName(),
        list: extractions
      }));
    } catch(e){}
  }
  function activeOptions(){
    if (!lastCalc) return [];
    const out = [];
    ['1','2','3'].forEach(p => (lastCalc.pots[p] || []).forEach(q =>
      out.push({ rid:q.rid, name:q.s.nickname || '—', pot:p, group:q.group.label, pos:q.pos })));
    return out;
  }
  function renderExtractSelects(){
    const opts = activeOptions();
    ['#kpExA','#kpExB'].forEach(sel => {
      const n = $(sel);
      const keep = n.value;
      n.textContent = '';
      const ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Elige participante…';
      n.appendChild(ph);
      opts.forEach(o => {
        const op = document.createElement('option');
        op.value = o.rid;
        op.textContent = o.name + ' · Bombo ' + o.pot + ' · ' + o.pos + '.º Grupo ' + o.group;
        n.appendChild(op);
      });
      if ([...n.options].some(x => x.value === keep)) n.value = keep;
    });
  }
  function renderExtractions(){
    if (!$('#kpExList')) return;          // sección retirada de esta página
    renderExtractSelects();
    const wrap = $('#kpExList');
    wrap.textContent = '';
    $('#kpExUndo').disabled = !extractions.length;
    $('#kpExSend').disabled = !extractions.length;
    if (!extractions.length){
      wrap.appendChild(el('p', 'kp-note', 'Sin emparejamientos capturados. Se guardan como borrador local para importarlos en BracketAdmin; el bracket oficial se guarda y publica allá.'));
      return;
    }
    const t = document.createElement('table'); t.className = 'kp';
    t.innerHTML = '<thead><tr><th>#</th><th class="l">Participante A</th><th class="l">Participante B</th><th>Partido</th><th>Estado</th><th class="l">Motivo/obs.</th><th></th></tr></thead>';
    const tb = document.createElement('tbody');
    extractions.forEach((x, i) => {
      const tr = document.createElement('tr');
      const cells = [
        String(i + 1),
        x.a.name + ' (' + x.a.origin + ')',
        x.b.name + ' (' + x.b.origin + ')',
        x.matchNo || '—',
        (x.valid === false ? 'REEXTRACCIÓN' : 'VÁLIDO') + (x.conflict ? ' · ⚠ mismo grupo' : ''),
        [x.reason, x.notes].filter(Boolean).join(' · ') || '—'
      ];
      cells.forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (j === 1 || j === 2 || j === 5) td.className = 'l';
        if (j === 4 && (x.conflict || x.valid === false)) td.style.color = 'var(--gold)';
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      td.style.whiteSpace = 'nowrap';
      const mk = (txt, title, fn) => {
        const b = el('button', 'gb-ico', txt); b.type = 'button'; b.title = title;
        b.style.cssText = 'border:1px solid var(--line2);border-radius:6px;min-width:30px;min-height:30px;color:var(--muted);margin-left:4px';
        b.addEventListener('click', fn);
        return b;
      };
      td.appendChild(mk('↑', 'Subir', () => { if (i > 0){ extractions.splice(i - 1, 0, extractions.splice(i, 1)[0]); saveExtractions(); renderExtractions(); } }));
      td.appendChild(mk('↓', 'Bajar', () => { if (i < extractions.length - 1){ extractions.splice(i + 1, 0, extractions.splice(i, 1)[0]); saveExtractions(); renderExtractions(); } }));
      td.appendChild(mk('✎', 'Editar (recarga en el formulario)', () => {
        $('#kpExA').value = x.a.rid || ''; $('#kpExB').value = x.b.rid || '';
        $('#kpExMatch').value = x.matchNo || '';
        $('#kpExValid').value = x.valid === false ? 'RE' : 'OK';
        $('#kpExReason').value = x.reason || ''; $('#kpExNotes').value = x.notes || '';
        extractions.splice(i, 1); saveExtractions(); renderExtractions();
      }));
      td.appendChild(mk('🗑', 'Eliminar', () => { extractions.splice(i, 1); saveExtractions(); renderExtractions(); }));
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
  }
  function wireExtractions(){
    if (!$('#kpExAdd')) return;           // sin formulario de captura, nada que enlazar
    $('#kpExAdd').addEventListener('click', () => {
      const opts = activeOptions();
      const a = opts.find(o => String(o.rid) === $('#kpExA').value);
      const b = opts.find(o => String(o.rid) === $('#kpExB').value);
      if (!a || !b){ UI().toast('Elige ambos participantes.', 'warn'); return; }
      if (a.rid === b.rid){ UI().toast('Un participante no puede enfrentarse a sí mismo.', 'warn'); return; }
      const conflict = a.group === b.group;
      extractions.push({
        a: { rid:a.rid, name:a.name, origin: a.pos + '.º Grupo ' + a.group + ' · Bombo ' + a.pot },
        b: { rid:b.rid, name:b.name, origin: b.pos + '.º Grupo ' + b.group + ' · Bombo ' + b.pot },
        matchNo: $('#kpExMatch').value.trim(),
        valid: $('#kpExValid').value !== 'RE',
        reason: $('#kpExValid').value === 'RE' ? $('#kpExReason').value.trim() : '',
        notes: $('#kpExNotes').value.trim(),
        conflict
      });
      saveExtractions();
      $('#kpExMatch').value = ''; $('#kpExReason').value = ''; $('#kpExNotes').value = ''; $('#kpExValid').value = 'OK';
      renderExtractions();
      UI().toast(conflict ? 'Capturado con conflicto: ambos son del mismo grupo.' : 'Emparejamiento capturado en el borrador.', conflict ? 'warn' : 'ok');
    });
    $('#kpExUndo').addEventListener('click', () => {
      extractions.pop(); saveExtractions(); renderExtractions();
      UI().toast('Última extracción deshecha.', 'ok');
    });
    $('#kpExSend').addEventListener('click', () => {
      saveExtractions();
      UI().toast('Borrador guardado. En BracketAdmin usa «Importar emparejamientos extraídos» para colocarlos como dato visual.', 'ok');
    });
  }

  // ── documentos para el sorteo físico ─────────────────────────────────
  function openPapeletas(payload){
    try { sessionStorage.setItem('papeletas-payload', JSON.stringify(payload)); } catch(e){}
    window.open('PapeletasSorteo.html', '_blank');
  }
  function pad2(n){ return String(n).padStart(2, '0'); }
  function basePayload(){
    return {
      edition: (st().edition && (st().edition.name || st().edition.slug)) || '',
      category: catName(),
      prefix: catPrefix(),
      generatedAt: new Date().toISOString()
    };
  }
  const POT_NAME = { '1':'Bombo 1 · primeros lugares', '2':'Bombo 2 · segundos lugares', '3':'Bombo 3 · terceros seleccionados' };
  // Papelitos físicos: MISMO formato que el sorteo de grupos (80 × 30 mm).
  function printSheet(doc){
    const meta = { edition: (st().edition && (st().edition.slug || st().edition.name)) || '',
                   category: catName() };
    if (!window.SB_KO_PRINT || !window.SB_KO_PRINT.openSheet){
      UI() && UI().toast('No se pudo cargar el generador de hojas.', 'err');
      return;
    }
    window.SB_KO_PRINT.openSheet(doc, meta)
      .catch(err => UI() && UI().toast((err && err.message) || 'No se pudo generar la hoja.', 'err'));
  }
  function printTickets(docs, docLabel){
    const meta = { edition: (st().edition && (st().edition.slug || st().edition.name)) || '',
                   category: catName(), docLabel: docLabel };
    if (!window.SB_KO_PRINT){
      UI() && UI().toast('No se pudo cargar el generador de papeletas.', 'err');
      return;
    }
    window.SB_KO_PRINT.open(docs, meta)
      .then(() => UI() && UI().toast('Papeletas generadas. Imprime al 100 %, sin ajustar a página.', 'ok'))
      .catch(err => UI() && UI().toast((err && err.message) || 'No se pudieron generar las papeletas.', 'err'));
  }
  function wireDocs(){
    $('#kpDocPots').addEventListener('click', () => {
      if (!lastCalc || !lastCalc.variant){ UI().toast('Primero calcula los bombos.', 'warn'); return; }
      const pfx = catPrefix();
      const docs = ['1','2','3'].filter(p => lastCalc.pots[p].length).map(p => ({
        type:'name',
        kindLabel: 'Bombo ' + p,
        eyebrow: POT_NAME[p].split(' · ')[1] || 'Sorteo eliminatorio',
        title: POT_NAME[p] + ' — ' + catName(),
        items: lastCalc.pots[p].map((q, i) => ({
          main: q.s.nickname || '—',
          sub: q.pos + '.º Grupo ' + q.group.label,
          code: pfx + ' · B' + p + '-' + pad2(i + 1)
        }))
      }));
      if (lastCalc.direct.length){
        docs.push({ type:'name', kindLabel:'Pase directo', eyebrow:'Pase directo',
          title:'Pases directos — ' + catName(),
          items: lastCalc.direct.map((q, i) => ({ main:q.s.nickname || '—', sub:'1.º Grupo ' + q.group.label,
            code: pfx + ' · PD-' + pad2(i + 1) })) });
      }
      printTickets(docs, 'Papeletas de bombos');
    });
    $('#kpDocMatches').addEventListener('click', () => {
      if (!lastCalc || !lastCalc.variant){ UI().toast('Primero calcula los bombos.', 'warn'); return; }
      const rn = roundName(lastCalc.N), rc = roundCode(lastCalc.N), pfx = catPrefix();
      const posiciones = Math.max(1, Math.floor(lastCalc.N / 2));
      const docs = [{ type:'box', kindLabel:'Posición', eyebrow:'Caja de posiciones',
        title:'Caja de posiciones — ' + rn + ' — ' + catName(),
        items: Array.from({ length: posiciones }, (_, i) => ({ big: i + 1, main: rn,
          sub: 'Partido ' + (i + 1) + ' de ' + posiciones, code: pfx + ' · ' + rc + '-M' + pad2(i + 1) })) }];
      if (lastCalc.access && lastCalc.accessMatches){
        docs.push({ type:'box', kindLabel:'Acceso', eyebrow:'Caja de acceso',
          title:'Caja de acceso — ronda de acceso a ' + rn + ' — ' + catName(),
          items: Array.from({ length: lastCalc.accessMatches }, (_, i) => ({ big: i + 1, main:'Acceso',
            sub:'Ganador entra a ' + rn, code: pfx + ' · AC-M' + pad2(i + 1) })) });
      }
      printTickets(docs, 'Cajas de posiciones y acceso');
    });
    $('#kpDocMaster').addEventListener('click', () => {
      if (!lastCalc || !lastCalc.variant){ UI().toast('Primero calcula los bombos.', 'warn'); return; }
      const pfx = catPrefix();
      const rows = [];
      ['1','2','3'].forEach(p => lastCalc.pots[p].forEach((q, i) =>
        rows.push({ text:q.s.nickname || '—', detail:'Bombo ' + p + ' · ' + q.pos + '.º Grupo ' + q.group.label,
          code: pfx + ' · B' + p + '-' + pad2(i + 1), count:1 })));
      lastCalc.direct.forEach((q, i) => rows.push({ text:q.s.nickname || '—', detail:'Pase directo (1.º Grupo ' + q.group.label + ')',
        code: pfx + ' · PD-' + pad2(i + 1), count:1 }));
      const posiciones = Math.max(1, Math.floor(lastCalc.N / 2));
      for (let i = 0; i < posiciones; i++)
        rows.push({ text: roundName(lastCalc.N) + ' ' + (i + 1), detail:'Caja de posiciones',
          code: pfx + ' · ' + roundCode(lastCalc.N) + '-M' + pad2(i + 1), count:1 });
      for (let i = 0; i < (lastCalc.access ? lastCalc.accessMatches : 0); i++)
        rows.push({ text:'ACCESO ' + (i + 1), detail:'Caja de acceso', code: pfx + ' · AC-M' + pad2(i + 1), count:1 });
      printSheet({
        title: 'Lista maestra del sorteo eliminatorio',
        docLabel: 'Lista maestra',
        columns: [
          { key:'n', label:'#', cls:'c' },
          { key:'text', label:'Papeleta', cls:'ko-strong' },
          { key:'detail', label:'Detalle' },
          { key:'code', label:'Código' },
          { key:'ok', label:'Preparada', cls:'c' }
        ],
        rows: rows.map((r, i) => ({ n: i + 1, text: r.text, detail: r.detail, code: r.code, ok: '☐' })),
        total: String(rows.length),
        sign: false,
        footNotes: ['Formato: ' + lastCalc.variant.title,
          ['1','2','3'].map(p => 'Bombo ' + p + ': ' + lastCalc.pots[p].length).join(' · '),
          'Pases directos: ' + lastCalc.direct.length]
      });
    });
    $('#kpDocActa').addEventListener('click', () => {
      const rows = extractions.map((x, i) => ({
        n: i + 1, a: x.a.name, aOrigin: x.a.origin, b: x.b.name, bOrigin: x.b.origin,
        match: x.matchNo || '', valid: x.valid === false ? 'Reextracción' : 'Sí',
        reason: x.reason || '', notes: (x.notes || '') + (x.conflict ? ' · Conflicto: mismo grupo' : '')
      }));
      const emptyRows = Math.max(0, (lastCalc ? Math.floor(lastCalc.M / 2) : 8) - rows.length);
      printSheet({
        title: 'Acta del sorteo eliminatorio',
        docLabel: 'Acta',
        columns: [
          { key:'n', label:'Ext.', cls:'c' },
          { key:'a', label:'Participante A', cls:'ko-strong' },
          { key:'aOrigin', label:'Origen A' },
          { key:'b', label:'Participante B', cls:'ko-strong' },
          { key:'bOrigin', label:'Origen B' },
          { key:'match', label:'Partido', cls:'c' },
          { key:'valid', label:'Válido', cls:'c' },
          { key:'reason', label:'Motivo de reextracción' }
        ],
        rows, emptyRows,
        footNotes: ['Se registra exactamente lo que salió de las pelotas',
          'Reextracción: anotar el motivo (p. ej. mismo grupo)',
          'Publicada la llave, no se vuelve a sortear']
      });
    });
  }

  function wire(){
    const v = $('#kpVariant');
    if (v) v.addEventListener('change', async () => { variantChoice = v.value; await renderAll(); });
    $('#btnPrint').addEventListener('click', () => window.print());
    $('#btnReload').addEventListener('click', async () => {
      Object.keys(standingsCache).forEach(k => delete standingsCache[k]);
      $('#bootState').style.display = 'block';
      await C().load();
      $('#bootState').style.display = 'none';
      renderTabs(); await renderAll();
      UI() && UI().toast('Datos actualizados.', 'ok');
    });
    wireExtractions();
    wireDocs();
    const lg = $('#btnLogout'); if (lg) lg.addEventListener('click', () => window.SB_AUTH.signOut());
    const dl = $('#btnDeniedLogout'); if (dl) dl.addEventListener('click', () => window.SB_AUTH.signOut());
  }

  document.addEventListener('DOMContentLoaded', () => { wire(); boot(); });
})();
