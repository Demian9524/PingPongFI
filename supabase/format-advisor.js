// ── ASESOR DE FORMATO · panel FORMATO RECOMENDADO + simulador ───────────
// SOLO lectura y cálculo: no escribe en Supabase, no crea grupos ni partidos,
// no sortea. Toda la lógica del reglamento vive en supabase/format-engine.js.
// Fuentes de datos:
//   · contexto de control-torneo-v2.js → admin_registrations (elegibles,
//     provisionales, grupo actual de cada inscripción) y v_public_groups_results
//     (partidos capturados, para saber en qué estado está la categoría).
//   · get_group_standings(group_id) → tamaño efectivo de los grupos publicados
//     (participantes cuyos resultados siguen contando).
(function(global){
  'use strict';
  const $ = s => document.querySelector(s);
  const E = () => global.FI_FORMAT;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const CAT_COLOR = { principiante:'#37bb66', novato:'#37bb66', beginner:'#37bb66',
                      intermedio:'#3a63f0', avanzado:'#dd3b2c', avanzado_open:'#dd3b2c' };
  const TAG_CLASS = { 'IDEAL':'t-ideal', 'RECOMENDADO':'t-rec', 'VÁLIDO CON ADVERTENCIAS':'t-warn',
                      'EXCEPCIONAL':'t-exc', 'NO RECOMENDADO':'t-no' };
  const S = { ctx:null, pub:{}, busy:false, sim:null, open:{}, fore:null };

  // ── ventana de altas extemporáneas (7 primeros días) ─────────────────
  // Escenario, no predicción: cuánta gente esperas que entre todavía. El
  // asesor contrasta la recomendación de hoy con la proyectada y avisa si el
  // número de grupos cambiaría (= rehacer el sorteo).
  const FORE_KEY = 'fi.fmt.forecast';
  function loadFore(){
    try {
      const v = JSON.parse(localStorage.getItem(FORE_KEY) || 'null');
      if (v && (v.mode === 'abs' || v.mode === 'pct'))
        return { mode:v.mode, pct:Number(v.pct) || 20, abs:Math.max(0, Number(v.abs) || 0) };
    } catch(e){}
    return { mode:'pct', pct:20, abs:4 };
  }
  function saveFore(){ try { localStorage.setItem(FORE_KEY, JSON.stringify(S.fore)); } catch(e){} }
  function foreFor(n){
    const f = S.fore || (S.fore = loadFore());
    n = Math.max(0, Number(n) || 0);
    return f.mode === 'pct' ? Math.ceil(n * f.pct / 100) : Math.max(0, f.abs | 0);
  }

  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : (p || s + 's'));
  const catColor = c => CAT_COLOR[String((c && (c.code || c.name)) || '').toLowerCase()] || 'var(--gold)';
  const catName = c => (c && (c.name || c.code)) || 'Categoría';

  // ── lectura de la lista de inscripciones ──────────────────────────────
  function census(rows, edcats){
    const out = {};
    edcats.forEach(c => { out[c.id] = { confirmed:0, provisional:0, groups:{}, withoutGroup:0 }; });
    (rows || []).forEach(r => {
      const box = out[r.edition_category_id];
      if (!box) return;
      const rs = String(r.registration_status || '').toUpperCase();
      const settled = global.SB_PAYMENTS
        ? global.SB_PAYMENTS.isSettled(r)
        : ['CONFIRMED','WAIVED'].indexOf(String(r.payment_status || '').toUpperCase()) >= 0;
      if (rs === 'CONFIRMED' && settled){
        box.confirmed++;
        if (r.group_id) box.groups[r.group_id] = (box.groups[r.group_id] || 0) + 1;
        else box.withoutGroup++;
      } else if (['PRE_REGISTERED','PAYMENT_PENDING','WAITLISTED'].indexOf(rs) >= 0){
        box.provisional++;
      }
    });
    return out;
  }

  // ── tamaño efectivo de los grupos ya publicados ──────────────────────
  async function publishedSizes(edcats){
    const out = {};
    if (!global.SB) return out;
    let gRows = [];
    try {
      const { data, error } = await global.SB.from('v_public_groups_results')
        .select('group_id, edition_category_id, group_label')
        .in('edition_category_id', edcats.map(c => c.id));
      if (error) throw error;
      gRows = data || [];
    } catch(e){
      global.SB_LOG && global.SB_LOG.error('FMT-001', e);
      return out;
    }
    const seen = new Set(), byCat = {};
    gRows.forEach(r => {
      if (!r.group_id || seen.has(r.group_id)) return;
      seen.add(r.group_id);
      (byCat[r.edition_category_id] = byCat[r.edition_category_id] || [])
        .push({ id:r.group_id, label:r.group_label });
    });
    for (const c of edcats){
      const gs = (byCat[c.id] || []).sort((a, b) => String(a.label).localeCompare(String(b.label)));
      if (!gs.length) continue;
      const detail = await Promise.all(gs.map(async g => {
        try {
          const { data, error } = await global.SB.rpc('get_group_standings', { p_group_id:g.id });
          if (error) throw error;
          const rows = data || [];
          return { label:g.label, effective:rows.length,
            played: rows.reduce((a, r) => a + Number(r.matches_played || 0), 0) };
        } catch(e){ return { label:g.label, effective:null, played:0 }; }
      }));
      out[c.id] = { groups:gs.length, detail:detail,
        unknown: detail.some(d => d.effective == null),
        anyPlayed: detail.some(d => d.played > 0),
        total: detail.reduce((a, d) => a + (d.effective || 0), 0) };
    }
    return out;
  }

  // ── estado administrativo de la categoría ────────────────────────────
  function phaseOf(pub, hasMatches){
    if (!pub) return { code:'PROVISIONAL', label:'Provisional',
      note:'Todavía no hay grupos sorteados: se permiten altas, bajas y cambios de categoría, y esta recomendación se actualiza en tiempo real.' };
    if (!hasMatches && !pub.anyPlayed) return { code:'CONGELADO', label:'Congelado',
      note:'Los grupos ya están definidos y aún no hay resultados oficiales. El formato previsto ya se puede anunciar; la llave todavía no se construye.' };
    if (pub.anyPlayed) return { code:'EN JUEGO', label:'Grupos en juego',
      note:'Hay resultados oficiales capturados. Cualquier modificación de grupos es extraordinaria y debe registrar estado anterior, estado nuevo y motivo.' };
    return { code:'CONGELADO', label:'Congelado', note:'' };
  }

  // ── piezas de render ─────────────────────────────────────────────────
  const chip = (txt, cls) => '<span class="fmt-chip' + (cls ? ' ' + cls : '') + '">' + txt + '</span>';
  const tag = t => '<span class="fmt-tag ' + (TAG_CLASS[t] || 't-rec') + '">' + esc(t) + '</span>';
  const kpi = (v, l, cls) => '<div class="fmt-kpi' + (cls ? ' ' + cls : '') + '"><b>' + v + '</b><small>' + l + '</small></div>';

  function flowSteps(v, p){
    const li = [];
    if (v.kind === 'ACCESS'){
      li.push('Los <b>' + p.groups + ' primeros</b> pasan directamente a ' + esc(v.bracketLabel.toLowerCase()) + '.');
      li.push('Los <b>' + p.groups + ' segundos</b>' + (v.thirdsSlots ? ' y <b>' + plural(v.thirdsSlots, 'tercero') + '</b>' : '') +
        ' disputan la ronda de acceso.');
      li.push('Se jugarán <b>' + plural(v.accessMatches, 'partido') + ' de acceso</b> (' + v.accessPlayers + ' jugadores).');
      li.push('Los <b>' + v.accessMatches + ' ganadores</b> se unen a los ' + p.groups + ' primeros.');
      li.push('La llave principal tendrá <b>' + v.bracket + ' participantes</b>.');
    } else {
      li.push('Los <b>' + p.groups + ' primeros</b> y los <b>' + p.groups + ' segundos</b> entran a la llave.');
      if (v.thirdsSlots) li.push('Se suman <b>' + plural(v.thirdsSlots, 'tercero') + '</b> seleccionado' + (v.thirdsSlots === 1 ? '' : 's') + ' con el sistema 5–4–3.');
      else li.push('<b>Ningún tercero</b> clasifica: los terceros de grupos de 3 también son últimos de su grupo.');
      li.push('Llave directa de <b>' + v.bracket + '</b> (' + esc(v.bracketLabel.toLowerCase()) + '), <b>sin pases directos ni descansos</b>.');
    }
    return '<ul class="fmt-flow">' + li.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  }

  function thirdsBox(v){
    const t = v.thirds, lv = t.levels;
    return '<div class="fmt-lvls">' +
      ['A','B','C'].map(k => {
        const avail = lv[k], used = k === 'A' ? t.fromA : k === 'B' ? t.fromB : t.fromC;
        const nombre = k === 'A' ? 'Nivel A · grupos de 5' : k === 'B' ? 'Nivel B · grupos de 4' : 'Nivel C · grupos de 3 (reserva)';
        const cls = used ? (k === 'C' ? 'is-exc' : 'is-in') : (avail ? 'is-out' : 'is-none');
        return '<div class="fmt-lvl ' + cls + '"><span class="l">' + nombre + '</span>' +
          '<b>' + used + ' / ' + avail + '</b>' +
          '<small>' + (avail === 0 ? 'no hay terceros de este nivel'
            : used === 0 ? 'disponibles, pero no se necesitan'
            : used === avail ? 'clasifican todos' : 'clasifican ' + used + ' de ' + avail) + '</small></div>';
      }).join('') + '</div>';
  }

  function variantBlock(v, p, isAlt){
    return '<div class="fmt-variant' + (isAlt ? ' is-alt' : '') + '">' +
      '<div class="fmt-vhead"><span class="k">' + (isAlt ? 'Alternativa manual' : 'Formato recomendado') + '</span>' +
        '<b>' + esc(v.title) + '</b>' + tag(v.tag || p.tag) + '</div>' +
      flowSteps(v, p) +
      '<div class="fmt-kpis">' +
        kpi(v.firsts, 'Primeros clasificados') +
        kpi(v.seconds, 'Segundos clasificados') +
        kpi(v.thirdsSlots, 'Plazas de terceros') +
        kpi(v.directPasses, 'Pases directos') +
        kpi(v.accessMatches, 'Partidos de acceso') +
        kpi(v.bracket, 'Llave principal') +
        kpi(v.classified, 'Clasificados') +
        kpi(v.knockoutMatches, 'Partidos de eliminatoria (est.)') +
      '</div>' +
      (v.thirdsSlots ? thirdsBox(v) : '') +
      (v.reasons.length ? '<div class="fmt-why"><h6>Por qué este formato</h6><ul>' +
        v.reasons.map(r => '<li>' + r + '</li>').join('') + '</ul></div>' : '') +
      (v.warnings.length ? '<div class="fmt-alerts">' +
        v.warnings.map(w => '<p class="fmt-note warn">⚠ ' + esc(w) + '</p>').join('') + '</div>' : '') +
    '</div>';
  }

  function groupsStrip(pub, declared){
    if (!pub) return '';
    return '<div class="fmt-strip">' + pub.detail.map(d => {
      const dec = declared[d.label] != null ? declared[d.label] : null;
      const eff = d.effective;
      const cls = eff == null ? 'is-unknown' : eff === 3 ? 'is-3' : eff >= 5 ? 'is-5' : 'is-4';
      return '<span class="fmt-gchip ' + cls + '"><b>' + esc(d.label) + '</b>' +
        '<i>' + (eff == null ? '?' : eff) + '</i>' +
        (dec != null && eff != null && dec !== eff ? '<u>inscritos ' + dec + '</u>' : '') + '</span>';
    }).join('') + '</div>';
  }

  // El mejor reparto de n participantes con EXACTAMENTE g grupos (distributions
  // ya viene ordenado por la prioridad del reglamento).
  const bestDistFor = (F, n, g) => F.distributions(n).find(d => d.groups === g) || null;

  // Número de grupos que sigue siendo válido con n y con n+f participantes:
  // el sorteo aguanta toda la ventana sin rehacerse.
  function robustGroups(F, n, m){
    const out = [];
    for (let g = Math.max(1, Math.ceil(m / F.MAX_SIZE)); g <= Math.min(Math.floor(n / F.MIN_SIZE), F.MAX_GROUPS); g++){
      const a = bestDistFor(F, n, g), b = bestDistFor(F, m, g);
      if (a && b) out.push({ groups:g, now:a, proj:b });
    }
    out.sort((x, y) => (x.now.threes + x.proj.threes) - (y.now.threes + y.proj.threes) ||
      Math.abs(x.proj.avg - F.TARGET_SIZE) - Math.abs(y.proj.avg - F.TARGET_SIZE) || x.groups - y.groups);
    return out[0] || null;
  }

  // Bloque de proyección de una categoría.
  function projection(F, n, pub, f){
    if (!f || n < F.MIN_SIZE) return '';
    const m = n + f;
    const now = F.recommendDistribution(n).rec;
    const proj = F.recommendDistribution(m).rec;
    const drawn = !!(pub && !pub.unknown && pub.groups);
    const gNow = drawn ? pub.groups : (now ? now.groups : 0);
    if (!gNow) return '';
    const base = drawn ? pub.total : n;
    const cap = Math.max(0, gNow * F.MAX_SIZE - base);   // altas que caben sin abrir grupos
    const fits = f <= cap;
    const hoy = drawn
      ? plural(pub.groups, 'grupo') + ' · ' + pub.detail.map(d => d.effective == null ? '?' : d.effective).join('–')
      : (now ? plural(now.groups, 'grupo') + ' · ' + F.sizesLabel(now) : '—');
    const futuro = proj ? plural(proj.groups, 'grupo') + ' · ' + F.sizesLabel(proj) : '—';

    let note = '';
    if (drawn && fits){
      note = '<p class="fmt-note ok">✓ Los ' + pub.groups + ' grupos sorteados admiten <b>+' + cap +
        '</b> antes de tocar el máximo de 5 por grupo. Con <b>+' + f + '</b> previstas caben todas: las altas entran a los grupos existentes, ' +
        'se les arma el calendario comprimido y <b>no se rehace el sorteo</b>.</p>';
    } else if (drawn){
      note = '<p class="fmt-note warn">⚠ Los ' + pub.groups + ' grupos sorteados solo admiten <b>+' + cap + '</b>. Con <b>+' + f +
        '</b> previstas ' + plural(f - cap, 'alta') + ' se queda' + (f - cap === 1 ? '' : 'n') + ' fuera: habrá que abrir ' +
        (Math.ceil((f - cap) / F.MIN_SIZE) === 1 ? 'un grupo nuevo' : 'grupos nuevos') +
        ' (mínimo 3 por grupo) o cerrar la lista antes del día 7.</p>';
    } else if (fits && proj && proj.groups === gNow){
      note = '<p class="fmt-note ok">✓ Sortear con <b>' + plural(gNow, 'grupo') + '</b> aguanta toda la ventana: es la recomendación ' +
        'hoy y también con ' + m + '. Caben hasta <b>+' + cap + '</b> altas sin abrir grupos.</p>';
    } else if (fits){
      note = '<p class="fmt-note ok">✓ Sortear con <b>' + plural(gNow, 'grupo') + '</b> aguanta la ventana: las <b>+' + f +
        '</b> altas previstas caben en esos grupos (margen +' + cap + ') sin rehacer el sorteo.' +
        (proj ? ' Con ' + m + ' el reparto ideal sería ' + plural(proj.groups, 'grupo') + ', pero mantener ' + gNow +
          ' sigue siendo válido: quedaría ' + F.sizesLabel(bestDistFor(F, m, gNow) || proj) + '.' : '') + '</p>';
    } else {
      const rb = robustGroups(F, n, m);
      note = '<p class="fmt-note warn">⚠ Con <b>+' + f + '</b> altas el sorteo de hoy se queda corto: ' + plural(gNow, 'grupo') +
        ' sólo admite +' + cap + ' y la recomendación pasaría a ' + (proj ? plural(proj.groups, 'grupo') : '—') + '.</p>';
      if (rb && rb.groups !== gNow){
        note += '<p class="fmt-note">Sortear hoy con <b>' + plural(rb.groups, 'grupo') + '</b> cubre todo el rango ' + n + '–' + m +
          ' sin rehacer nada: hoy quedaría ' + F.sizesLabel(rb.now) + ' y al cerrar la ventana ' + F.sizesLabel(rb.proj) + '.' +
          (now && rb.now.threes > now.threes
            ? ' El costo es arrancar con ' + plural(rb.now.threes - now.threes, 'grupo') + ' de 3 de más, donde el tercero también es último.'
            : '') + '</p>';
      } else if (!rb){
        note += '<p class="fmt-note">Ningún número de grupos cubre ' + n + ' y ' + m + ' a la vez. Las salidas son <b>sortear al cerrar la ventana</b> ' +
          '(día 7) o sortear ahora y abrir grupos nuevos para las altas.</p>';
      }
    }

    return '<div class="fmt-proj ' + (fits ? 'is-ok' : 'is-warn') + '">' +
      '<div class="fmt-proj-h"><span class="k">Proyección · ventana de altas</span><b>+' + plural(f, 'alta') + ' prevista' + (f === 1 ? '' : 's') + '</b>' +
        chip(fits ? 'EL SORTEO AGUANTA' : 'CAMBIARÍA EL SORTEO', fits ? 'ok' : 'warn') + '</div>' +
      '<div class="fmt-sit">' +
        '<div><span>Hoy · ' + plural(base, 'jugador', 'jugadores') + '</span><b>' + esc(hoy) + '</b></div>' +
        '<div><span>Proyectado · ' + m + ' jugadores</span><b>' + esc(futuro) + '</b></div>' +
        '<div><span>Margen sin abrir grupos</span><b>+' + cap + '</b></div>' +
      '</div>' + note + '</div>';
  }

  // ── barra global de la ventana de altas ──────────────────────────────
  function foreBar(){
    const f = S.fore || (S.fore = loadFore());
    const pill = (label, on, attr) => '<button type="button" class="fmt-pill' + (on ? ' on' : '') + '" ' + attr + '>' + label + '</button>';
    return '<div class="fmt-fore">' +
      '<div class="fmt-fore-h"><b>Ventana de altas</b>' + chip('7 DÍAS') +
        '<span class="fmt-note">El reglamento admite altas extemporáneas durante los <b>7 primeros días</b> de la fase de grupos. ' +
        'Elige cuánta gente esperas que entre todavía y cada categoría te dirá si el sorteo aguanta o si cambiaría el número de grupos. ' +
        'Es un escenario: <b>no modifica nada</b>.</span></div>' +
      '<div class="fmt-fore-ctl">' +
        pill('Sin altas', f.mode === 'abs' && !f.abs, 'data-fore-abs="0"') +
        pill('+10 %', f.mode === 'pct' && f.pct === 10, 'data-fore-pct="10"') +
        pill('+20 %', f.mode === 'pct' && f.pct === 20, 'data-fore-pct="20"') +
        pill('+30 %', f.mode === 'pct' && f.pct === 30, 'data-fore-pct="30"') +
        '<label class="fmt-fld">Altas fijas por categoría<input class="filter" type="number" min="0" max="30" id="foreAbs" value="' + f.abs + '" /></label>' +
      '</div></div>';
  }

  // ── tarjeta de categoría ─────────────────────────────────────────────
  function card(cat, box, pub, hasMatches){
    const F = E();
    const n = box.confirmed;
    const dist = F.recommendDistribution(n);
    const phase = phaseOf(pub, hasMatches);
    const color = catColor(cat);

    // tamaños que manda la realidad: los grupos publicados; si no hay, el reparto recomendado
    const effSizes = pub && !pub.unknown ? pub.detail.map(d => d.effective) : (dist.rec ? dist.rec.sizes.slice() : []);
    const plan = effSizes.length ? F.planFor(effSizes.length, effSizes) : null;
    const declaredByLabel = {};
    if (pub) pub.detail.forEach(d => { declaredByLabel[d.label] = null; });

    let head = '<div class="fmt-top"><span class="fmt-sw" style="background:' + color + '"></span>' +
      '<b>' + esc(catName(cat)) + '</b>' +
      (plan ? tag(plan.tag) : tag(F.TAGS.NO)) +
      chip(plural(n, 'confirmado')) +
      (box.provisional ? chip(plural(box.provisional, 'provisional', 'provisionales'), 'warn') : '') +
      chip(phase.label.toUpperCase(), phase.code === 'PROVISIONAL' ? '' : 'warn') + '</div>';

    // resumen de situación
    const actual = pub
      ? plural(pub.groups, 'grupo') + ' · ' + pub.detail.map(d => d.effective == null ? '?' : d.effective).join('–')
      : 'sin grupos sorteados';
    const rec = dist.rec ? plural(dist.rec.groups, 'grupo') + ' · ' + F.sizesLabel(dist.rec) : '—';
    let situacion = '<div class="fmt-sit">' +
      '<div><span>Distribución actual</span><b>' + esc(actual) + '</b></div>' +
      '<div><span>Distribución recomendada</span><b>' + esc(rec) + '</b></div>' +
      (plan ? '<div><span>Grupos de 3 / 4 / 5</span><b>' + plan.groupsOf3 + ' · ' + plan.groupsOf4 + ' · ' + plan.groupsOf5 + '</b></div>' : '') +
      '<div><span>Sin grupo asignado</span><b>' + box.withoutGroup + '</b></div>' +
    '</div>' + projection(F, n, pub, foreFor(n));

    let body = '';
    if (!n && !pub){
      body = '<p class="fmt-lead">Sin participantes elegibles todavía (inscripción CONFIRMED y pago CONFIRMED o WAIVED). ' +
        'El reparto se calcula a partir de 3 participantes.</p>';
    } else if (!plan || plan.case === 'INVALID'){
      body = '<p class="fmt-lead">' + esc(dist.reason) + '</p>' +
        (plan && plan.warnings.length ? plan.warnings.map(w => '<p class="fmt-note bad">⚠ ' + esc(w) + '</p>').join('') : '');
    } else {
      body = groupsStrip(pub, declaredByLabel) +
        (pub ? '<p class="fmt-note">Tamaño efectivo de cada grupo (número junto a la letra): participantes cuyos resultados siguen contando para la clasificación. ' +
          'Se lee de <code>get_group_standings</code>, que ya excluye inscripciones no vigentes.</p>' : '') +
        variantBlock(plan.primary, plan, false) +
        (plan.alternative ? '<details class="fmt-details"' + (S.open['alt' + cat.id] ? ' open' : '') + ' data-fmt-open="alt' + cat.id + '">' +
          '<summary>Ver alternativa manual · ' + esc(plan.alternative.title) + ' ' + tag(plan.alternative.tag) + '</summary>' +
          variantBlock(plan.alternative, plan, true) + '</details>' : '') +
        '<div class="fmt-why alt"><h6>Consejo del asesor</h6><ul>' +
          '<li>' + esc(dist.reason) + '</li>' +
          plan.notes.map(x => '<li>' + esc(x) + '</li>').join('') +
          '<li>' + esc(phase.note) + '</li>' +
        '</ul></div>' +
        (plan.warnings.length ? plan.warnings.map(w => '<p class="fmt-note warn">⚠ ' + esc(w) + '</p>').join('') : '');
      if (pub && !pub.unknown && dist.rec && pub.groups !== dist.rec.groups){
        body += '<p class="fmt-note warn">⚠ Los grupos sorteados (' + pub.groups + ') no son los que pediría el reglamento con ' +
          n + ' elegibles (' + dist.rec.groups + ' · ' + F.sizesLabel(dist.rec) + '). Manda la realidad: el formato de arriba es el de los ' +
          pub.groups + ' grupos existentes. Rehacer el sorteo solo se justifica en estado provisional.</p>';
      }
      if (pub && !pub.unknown && pub.total !== n){
        body += '<p class="fmt-note warn">⚠ Hay ' + pub.total + ' jugadores válidos repartidos en grupos pero ' + n +
          ' elegibles en la lista. Revisa altas, bajas o pagos antes de cerrar el formato.</p>';
      }
    }
    return '<div class="fmt-card" style="--cat:' + color + '">' + head + situacion + body + '</div>';
  }

  // ── simulador (no guarda nada) ───────────────────────────────────────
  function defaultSim(){
    const F = E();
    const edcats = (S.ctx && S.ctx.edcats) || [];
    const counts = census(S.ctx ? S.ctx.rows : [], edcats);
    const first = edcats[0];
    const n = first ? (counts[first.id] || {}).confirmed || 16 : 16;
    const dist = F.recommendDistribution(n || 16);
    return { participants: n || 16, sizes: dist.rec ? dist.rec.sizes.slice() : [4,4,4,4],
             manual:false, include3rdReserve:false };
  }

  function simView(){
    const F = E();
    const sim = S.sim = S.sim || defaultSim();
    const dist = F.recommendDistribution(sim.participants);
    if (!sim.manual) sim.sizes = dist.rec ? dist.rec.sizes.slice() : [];
    const sizes = sim.sizes.slice();
    const plan = sizes.length ? F.planFor(sizes.length, sizes, { include3rdReserve:sim.include3rdReserve }) : null;
    const suma = sizes.reduce((a, b) => a + b, 0);

    const opciones = dist.all.slice(0, 8).map(d =>
      '<button type="button" class="fmt-pill' + (d.sizes.join('-') === sizes.join('-') ? ' on' : '') +
      '" data-sim-dist="' + d.sizes.join('-') + '">' + d.groups + ' × ' + F.sizesLabel(d) +
      (d.threes ? ' <i>' + d.threes + ' de 3</i>' : '') + '</button>').join('');

    const groupRows = sizes.map((s, i) =>
      '<div class="fmt-simg"><span>Grupo ' + String.fromCharCode(65 + i) + '</span>' +
      '<select class="filter" data-sim-size="' + i + '">' +
        [2,3,4,5].map(v => '<option value="' + v + '"' + (v === s ? ' selected' : '') + '>' + v + ' efectivos</option>').join('') +
      '</select>' +
      '<button type="button" class="fmt-mini" data-sim-drop="' + i + '" title="Baja sin partidos: resta 1 al tamaño efectivo">− baja sin partidos</button>' +
      '<button type="button" class="fmt-mini" data-sim-keep="' + i + '" title="Baja después de completar su calendario: el tamaño efectivo no cambia">baja con resultados válidos</button>' +
      '<button type="button" class="fmt-mini danger" data-sim-del="' + i + '" title="Eliminar grupo">✕</button></div>').join('');

    return '<div class="fmt-sim">' +
      '<div class="fmt-simhead"><b>Simulador administrativo</b>' +
        chip('NO GUARDA NADA', 'ok') +
        '<span class="fmt-note">Todo lo de aquí es solo cálculo: <b>no modifica Supabase</b>, no crea grupos, no mueve participantes y no publica ningún formato.</span></div>' +
      '<div class="fmt-simctl">' +
        '<label class="fmt-fld">Participantes<input class="filter" type="number" min="0" max="60" id="simN" value="' + sim.participants + '" /></label>' +
        '<button type="button" class="btn btn-ghost" data-sim-add="1">+ Agregar participante</button>' +
        '<button type="button" class="btn btn-ghost" data-sim-add="-1">− Retirar participante</button>' +
        '<button type="button" class="btn btn-ghost" data-sim-reset="1">Volver al reparto recomendado</button>' +
        '<label class="fmt-check"><input type="checkbox" id="simExc"' + (sim.include3rdReserve ? ' checked' : '') +
          ' /> Forzar inclusión de terceros de reserva (excepcional)</label>' +
      '</div>' +
      '<div class="fmt-simopts"><span class="fmt-note">Repartos válidos con ' + sim.participants + ' participantes:</span>' + (opciones || '<span class="fmt-note bad">ninguno</span>') + '</div>' +
      '<div class="fmt-simgrid">' + groupRows +
        '<button type="button" class="fmt-mini add" data-sim-newgroup="1">+ Crear grupo</button></div>' +
      (suma !== sim.participants
        ? '<p class="fmt-note warn">⚠ Los grupos suman ' + suma + ' y hay ' + sim.participants + ' participantes: ' +
          (suma < sim.participants ? 'faltan ' + (sim.participants - suma) + ' por acomodar (simula un cambio de categoría o una alta tardía).'
                                    : 'sobran ' + (suma - sim.participants) + ' plazas.') + '</p>'
        : '') +
      (plan && plan.primary
        ? variantBlock(plan.primary, plan, false) +
          (plan.alternative ? variantBlock(plan.alternative, plan, true) : '') +
          (plan.warnings.length ? plan.warnings.map(w => '<p class="fmt-note warn">⚠ ' + esc(w) + '</p>').join('') : '') +
          '<div class="fmt-why alt"><h6>Lectura de la simulación</h6><ul>' +
            '<li>' + esc(dist.reason) + '</li>' +
            plan.notes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>'
        : '<p class="fmt-note bad">Con esta configuración no hay formato válido: el reglamento exige al menos 2 grupos de 3 a 5 participantes.</p>') +
    '</div>';
  }

  // ── render + eventos ─────────────────────────────────────────────────
  function render(){
    const host = $('#fmtBody');
    if (!host || !S.ctx) return;
    const edcats = S.ctx.edcats || [];
    if (!edcats.length){ host.innerHTML = '<p class="metaline">Esta edición no tiene categorías activas.</p>'; return; }
    const counts = census(S.ctx.rows, edcats);
    const matchesByCat = {};
    (S.ctx.groups || []).forEach(g => {
      if ((g.matches || []).some(m => m.winner || String(m.status || '').toUpperCase() === 'PLAYED'))
        matchesByCat[g.edition_category_id] = true;
    });
    host.innerHTML =
      '<p class="fmt-legend"><b>Cómo leer esto.</b> Para cada categoría el asesor analiza la situación real —participantes elegibles, ' +
      'grupos existentes y tamaño efectivo de cada grupo— y recomienda el formato que corresponde según el reglamento: cuántos grupos, ' +
      'qué formato eliminatorio, cuántos terceros avanzan y con qué prioridad, cuántos pases directos y cuántos partidos de acceso. ' +
      'Etiquetas: ' + tag('IDEAL') + ' ' + tag('RECOMENDADO') + ' ' + tag('VÁLIDO CON ADVERTENCIAS') + ' ' + tag('EXCEPCIONAL') + ' ' + tag('NO RECOMENDADO') + '</p>' +
      foreBar() +
      '<div class="fmt-cards">' +
      edcats.map(c => card(c, counts[c.id] || { confirmed:0, provisional:0, groups:{}, withoutGroup:0 },
        S.pub[c.id] || null, !!matchesByCat[c.id])).join('') + '</div>' +
      simView();
    wire(host);
  }

  function wire(host){
    host.querySelectorAll('[data-fmt-open]').forEach(d =>
      d.addEventListener('toggle', () => { S.open[d.dataset.fmtOpen] = d.open; }));
    host.querySelectorAll('[data-fore-pct]').forEach(b => b.addEventListener('click', () => {
      S.fore.mode = 'pct'; S.fore.pct = Number(b.dataset.forePct) || 20; saveFore(); render();
    }));
    host.querySelectorAll('[data-fore-abs]').forEach(b => b.addEventListener('click', () => {
      S.fore.mode = 'abs'; S.fore.abs = Number(b.dataset.foreAbs) || 0; saveFore(); render();
    }));
    const fa = host.querySelector('#foreAbs');
    if (fa) fa.addEventListener('change', () => {
      S.fore.mode = 'abs'; S.fore.abs = Math.max(0, Math.min(30, parseInt(fa.value, 10) || 0));
      saveFore(); render();
    });
    const sim = S.sim;
    if (!sim) return;
    const F = E();
    const redraw = () => render();
    const nInput = host.querySelector('#simN');
    if (nInput) nInput.addEventListener('change', () => {
      sim.participants = Math.max(0, Math.min(60, parseInt(nInput.value, 10) || 0));
      sim.manual = false; redraw();
    });
    host.querySelectorAll('[data-sim-add]').forEach(b => b.addEventListener('click', () => {
      const d = parseInt(b.dataset.simAdd, 10);
      sim.participants = Math.max(0, Math.min(60, sim.participants + d));
      sim.manual = false; redraw();
    }));
    host.querySelectorAll('[data-sim-reset]').forEach(b => b.addEventListener('click', () => {
      sim.manual = false; sim.include3rdReserve = false; redraw();
    }));
    host.querySelectorAll('[data-sim-dist]').forEach(b => b.addEventListener('click', () => {
      sim.sizes = b.dataset.simDist.split('-').map(Number); sim.manual = true; redraw();
    }));
    host.querySelectorAll('[data-sim-size]').forEach(sel => sel.addEventListener('change', () => {
      sim.sizes[Number(sel.dataset.simSize)] = parseInt(sel.value, 10);
      sim.manual = true; redraw();
    }));
    host.querySelectorAll('[data-sim-drop]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.simDrop);
      sim.sizes[i] = Math.max(0, sim.sizes[i] - 1);
      sim.participants = Math.max(0, sim.participants - 1);
      sim.manual = true; redraw();
    }));
    host.querySelectorAll('[data-sim-keep]').forEach(b => b.addEventListener('click', () => {
      sim.participants = Math.max(0, sim.participants - 1);
      sim.manual = true; redraw();
    }));
    host.querySelectorAll('[data-sim-del]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.simDel);
      sim.participants = Math.max(0, sim.participants - (sim.sizes[i] || 0));
      sim.sizes.splice(i, 1); sim.manual = true; redraw();
    }));
    host.querySelectorAll('[data-sim-newgroup]').forEach(b => b.addEventListener('click', () => {
      sim.sizes.push(4); sim.participants += 4; sim.manual = true; redraw();
    }));
    const exc = host.querySelector('#simExc');
    if (exc) exc.addEventListener('change', () => { sim.include3rdReserve = exc.checked; redraw(); });
  }

  async function mount(ctx){
    const sect = $('#fmtSect');
    if (!sect || !ctx || !E()) return;
    S.ctx = ctx;
    sect.style.display = '';
    const host = $('#fmtBody');
    if (host && !host.childNodes.length) host.innerHTML = '<p class="metaline">Analizando categorías…</p>';
    render();
    if (ctx.published){ S.pub = ctx.published; render(); return; }   // vista de trabajo sin Supabase
    if (S.busy) return;
    S.busy = true;
    try { S.pub = await publishedSizes(ctx.edcats || []); }
    catch(e){ S.pub = {}; }
    finally { S.busy = false; }
    render();
  }

  global.SB_FORMAT_ADVISOR = { mount, census, publishedSizes, robustGroups, engine: E };
})(typeof window !== 'undefined' ? window : globalThis);
