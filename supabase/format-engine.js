// ── MOTOR DEL REGLAMENTO · Asesor de Formato ────────────────────────────
// Lógica PURA (sin DOM, sin red, sin Supabase). Es la única fuente de verdad
// del reglamento vigente y la usan:
//   · supabase/format-advisor.js  (panel FORMATO RECOMENDADO + simulador)
//   · supabase/knockout-prep.js   (bombos 1/2/3 y pases directos)
//   · supabase/bracket-config.js  (recomendación de formato del bracket)
//   · reglas-torneo.js            (tabla pública por número de grupos)
//   · supabase/pre-group-print.js (orden de los repartos de los papelitos)
//
// Reglas implementadas (reglamento 2026):
//   1. Siempre grupos → fase posterior a grupos → eliminación directa.
//   2. TODOS los primeros y TODOS los segundos avanzan.
//   3. Nunca se comparan primeros entre sí, ni segundos entre sí: no hay
//      «mejor primero», ni ranking interno de Bombo 1 / Bombo 2.
//   4. Los únicos comparables entre grupos distintos son los TERCEROS, y solo
//      dentro del mismo tamaño efectivo (sistema 5–4–3).
//   5. Si hay pases directos, los reciben TODOS los primeros o ninguno.
//   6. La llave se sortea DESPUÉS de terminar los grupos (segundo sorteo).
(function(global){
  'use strict';

  const MIN_SIZE = 3, TARGET_SIZE = 4, MAX_SIZE = 5, MAX_GROUPS = 10;
  const TAGS = { IDEAL:'IDEAL', REC:'RECOMENDADO', WARN:'VÁLIDO CON ADVERTENCIAS',
                 EXC:'EXCEPCIONAL', NO:'NO RECOMENDADO' };

  // ── 1. Repartos válidos (objetivo 4 · mínimo 3 · máximo 5) ────────────
  // Enumera todas las combinaciones 3a + 4b + 5c = n con a+b+c grupos y las
  // ordena por la prioridad del reglamento: menos grupos de 3 → más grupos de
  // 4 → menor diferencia entre el grupo más grande y el más chico → promedio
  // más cercano a 4 → menos grupos.
  function distributions(n, opts){
    const maxG = (opts && opts.maxGroups) || MAX_GROUPS;
    const out = [];
    n = Number(n) || 0;
    if (n < MIN_SIZE) return out;
    for (let c = 0; c * 5 <= n; c++){
      for (let b = 0; b * 4 <= n - c * 5; b++){
        const rest = n - c * 5 - b * 4;
        if (rest % 3) continue;
        const a = rest / 3, g = a + b + c;
        if (g < 1 || g > maxG) continue;
        const sizes = new Array(c).fill(5).concat(new Array(b).fill(4), new Array(a).fill(3));
        out.push({
          groups: g, sizes: sizes, threes: a, fours: b, fives: c, total: n,
          spread: Math.max.apply(null, sizes) - Math.min.apply(null, sizes),
          avg: n / g
        });
      }
    }
    out.sort((x, y) =>
      x.threes - y.threes ||
      y.fours - x.fours ||
      x.spread - y.spread ||
      Math.abs(x.avg - TARGET_SIZE) - Math.abs(y.avg - TARGET_SIZE) ||
      x.groups - y.groups);
    return out;
  }

  const sizesLabel = d => !d ? '—' : d.sizes.join('–');

  // Reparto recomendado + alternativa secundaria razonable (otro número de
  // grupos, sin empeorar la cantidad de grupos de 3).
  function recommendDistribution(n, opts){
    const all = distributions(n, opts);
    const rec = all[0] || null;
    let alt = null;
    if (rec){
      alt = all.find(d => d.groups !== rec.groups && d.threes <= rec.threes) ||
            all.find(d => d.groups !== rec.groups && d.threes <= rec.threes + 1) || null;
    }
    return { all, rec, alt, reason: distributionReason(n, rec, alt) };
  }

  function distributionReason(n, rec, alt){
    if (!n) return 'Sin participantes elegibles: el reparto se calcula a partir de 3.';
    if (!rec) return 'Con ' + n + ' participantes no existe ningún reparto válido: el reglamento exige grupos de 3 a 5 y hasta ' +
      MAX_GROUPS + ' grupos. Agrega o retira participantes antes del sorteo.';
    const partes = [];
    partes.push('Se recomienda ' + sizesLabel(rec) + ' porque ' +
      (rec.threes === 0
        ? 'no obliga a formar ningún grupo de tres, donde el tercer lugar también es último.'
        : 'es el reparto con menos grupos de tres posible (' + rec.threes + ').'));
    if (rec.fives) partes.push('Usa ' + rec.fives + ' grupo' + (rec.fives === 1 ? '' : 's') +
      ' de cinco para absorber participantes en lugar de abrir grupos de tres.');
    if (alt) partes.push('La alternativa razonable es ' + sizesLabel(alt) + ' (' + alt.groups +
      ' grupos), que cambia el formato eliminatorio: conviene solo si la organización prefiere ' +
      (alt.groups > rec.groups ? 'más grupos y menos partidos por persona' : 'menos grupos y más partidos por persona') + '.');
    return partes.join(' ');
  }

  // ── 2. Tamaño efectivo ────────────────────────────────────────────────
  // Participantes cuyos resultados siguen siendo válidos para la clasificación.
  // players: [{ valid:boolean, playedAll:boolean, resultsAnnulled:boolean }]
  function effectiveSize(players){
    return (players || []).reduce((n, p) => {
      if (p.valid === false && !(p.playedAll && !p.resultsAnnulled)) return n;
      if (p.resultsAnnulled) return n;
      return n + 1;
    }, 0);
  }
  function effectiveNote(declared, effective){
    if (effective === declared) return 'Tamaño efectivo ' + effective + ': todos los inscritos siguen contando para la clasificación.';
    if (effective < declared) return 'Tamaño efectivo ' + effective + ' (inscritos ' + declared +
      '): ' + (declared - effective) + ' participante' + (declared - effective === 1 ? '' : 's') +
      ' dejó de contar (baja sin partidos o resultados anulados).';
    return 'Tamaño efectivo ' + effective + '.';
  }

  // ── 3. Niveles de terceros (5–4–3) ────────────────────────────────────
  function thirdLevels(sizes){
    const s = (sizes || []).map(Number);
    return {
      A: s.filter(x => x >= 5).length,   // tercero de grupo efectivo de 5
      B: s.filter(x => x === 4).length,  // tercero de grupo efectivo de 4
      C: s.filter(x => x === 3).length,  // tercero de grupo efectivo de 3 (también último)
      short: s.filter(x => x < 3).length // grupos sin tercer lugar
    };
  }
  // Cubre K plazas: primero Nivel A, luego B y solo si es estructuralmente
  // indispensable, C (reserva).
  function thirdsPlan(slots, lv){
    slots = Math.max(0, Number(slots) || 0);
    const fromA = Math.min(slots, lv.A);
    let rest = slots - fromA;
    const fromB = Math.min(rest, lv.B);
    rest -= fromB;
    const fromC = Math.min(rest, lv.C);
    rest -= fromC;
    return { slots, fromA, fromB, fromC, missing: rest, usesReserve: fromC > 0,
             levels: lv, available: lv.A + lv.B + lv.C };
  }

  // ── 4. Fórmula general del formato ────────────────────────────────────
  function nextPow2(x){ let p = 1; while (p < x) p *= 2; return p; }
  const ROUND_LABEL = { 2:'Final', 4:'Semifinales', 8:'Cuartos de final',
                        16:'Octavos de final', 32:'Dieciseisavos de final' };
  const roundLabel = n => ROUND_LABEL[n] || ('Cuadro de ' + n);

  // Llave directa: primeros + segundos + D terceros llenan exactamente B.
  function directVariant(G, lv, D, sizes){
    const plan = thirdsPlan(D, lv);
    const B = 2 * G + D;
    const v = {
      id: 'DIRECT', kind: 'DIRECT',
      title: D > 0 ? 'Llave directa' : 'Llave directa con primeros y segundos',
      bracket: B, bracketLabel: roundLabel(B),
      firsts: G, seconds: G, thirdsSlots: D, thirds: plan,
      directPasses: 0, accessMatches: 0, accessPlayers: 0,
      mainEntrants: B, classified: 2 * G + D,
      knockoutMatches: B - 1,
      reasons: [], warnings: []
    };
    v.reasons.push('Los ' + G + ' primeros y los ' + G + ' segundos entran a la llave' +
      (D > 0 ? ' junto con ' + D + ' tercero' + (D === 1 ? '' : 's') : '') +
      ': ' + v.classified + ' clasificados llenan exactamente una llave de ' + B + '.');
    v.reasons.push('Nadie recibe pase directo, así que ningún primero tiene un camino más corto que otro.');
    if (D > 0 && plan.fromA) v.reasons.push('De las ' + D + ' plazas de terceros, ' + plan.fromA +
      ' la ocupan terceros de grupos efectivos de 5 (Nivel A), que tienen prioridad.');
    if (D > 0 && plan.fromB) v.reasons.push(plan.fromB + ' plaza' + (plan.fromB === 1 ? '' : 's') +
      ' de terceros queda' + (plan.fromB === 1 ? '' : 'n') + ' para terceros de grupos efectivos de 4 (Nivel B).');
    if (plan.usesReserve) v.warnings.push('Se necesita ' + plan.fromC + ' tercero de grupo efectivo de 3 (Nivel C, reserva) ' +
      'para completar la llave: normalmente estaría eliminado y solo entra porque la estructura lo exige.');
    if (plan.missing) v.warnings.push('Faltan ' + plan.missing + ' terceros elegibles para completar la llave de ' + B +
      '. Habrá que resolverlo a mano (algún grupo quedó sin tercer lugar).');
    return v;
  }

  // Acceso con primeros protegidos: TODOS los primeros esperan; segundos + T
  // terceros disputan la ronda de acceso.
  function accessVariant(G, lv, T, sizes, exceptional){
    const plan = thirdsPlan(T, lv);
    const accessPlayers = G + T;
    const accessMatches = Math.floor(accessPlayers / 2);
    const main = G + accessMatches;
    const v = {
      id: 'ACCESS', kind: 'ACCESS',
      title: 'Acceso con primeros protegidos',
      bracket: main, bracketLabel: roundLabel(main),
      firsts: G, seconds: G, thirdsSlots: T, thirds: plan,
      directPasses: G, accessMatches: accessMatches, accessPlayers: accessPlayers,
      mainEntrants: main, classified: 2 * G + T,
      knockoutMatches: accessMatches + (main - 1),
      reasons: [], warnings: []
    };
    v.reasons.push('Los ' + G + ' primeros reciben pase directo: exactamente el mismo privilegio para todos, ' +
      'porque el número de pases directos es igual al número de grupos.');
    v.reasons.push('Los ' + G + ' segundos' + (T ? ' y ' + T + ' tercero' + (T === 1 ? '' : 's') : '') +
      ' disputan ' + accessMatches + ' partido' + (accessMatches === 1 ? '' : 's') + ' de acceso.');
    v.reasons.push('Los ' + accessMatches + ' ganadores se unen a los ' + G + ' primeros: la llave principal tendrá ' +
      main + ' participantes (' + roundLabel(main).toLowerCase() + ').');
    if (T && plan.fromA) v.reasons.push('La plaza de tercero la toma primero el Nivel A: tercero de grupo efectivo de 5 (' + plan.fromA + ').');
    if (T && !plan.fromA && plan.fromB) v.reasons.push('No hay terceros de grupos de 5, así que ' + plan.fromB +
      ' plaza' + (plan.fromB === 1 ? '' : 's') + ' de tercero corresponde' + (plan.fromB === 1 ? '' : 'n') + ' al Nivel B (grupos efectivos de 4).');
    if (accessPlayers % 2) v.warnings.push('La ronda de acceso queda impar (' + accessPlayers +
      ' jugadores). Ajusta el número de terceros o el reparto de grupos.');
    if (plan.usesReserve) v.warnings.push('Entran ' + plan.fromC + ' tercero' + (plan.fromC === 1 ? '' : 's') +
      ' de grupo efectivo de 3 (Nivel C, reserva): solo se justifica para cerrar una ronda de acceso simétrica.');
    if (plan.missing) v.warnings.push('Faltan ' + plan.missing + ' terceros elegibles para armar la ronda de acceso.');
    if (exceptional) v.warnings.push('Formato EXCEPCIONAL: incluye terceros de grupos de 3 que por reglamento estarían eliminados. ' +
      'Requiere decisión administrativa documentada.');
    return v;
  }

  // Plan completo para G grupos con sus tamaños efectivos.
  // opts.include3rdReserve = fuerza la variante inclusiva (excepcional).
  function planFor(groupCount, effectiveSizes, opts){
    opts = opts || {};
    const G = Number(groupCount) || 0;
    const sizes = (effectiveSizes || []).map(Number).filter(x => x > 0);
    const usable = sizes.length === G ? sizes : new Array(G).fill(TARGET_SIZE);
    const lv = thirdLevels(usable);
    const B = nextPow2(Math.max(2, 2 * G));
    const D = B - 2 * G;

    const out = {
      groups: G, sizes: usable, sizesAssumed: sizes.length !== G,
      levels: lv, B: B, D: D,
      groupsOf3: usable.filter(x => x === 3).length,
      groupsOf4: usable.filter(x => x === 4).length,
      groupsOf5: usable.filter(x => x >= 5).length,
      case: null, primary: null, alternative: null, tag: TAGS.REC,
      warnings: [], notes: []
    };

    if (G < 2){
      out.case = 'INVALID';
      out.tag = TAGS.NO;
      out.warnings.push('Con ' + G + ' grupo' + (G === 1 ? '' : 's') + ' no existe fase de grupos válida: ' +
        'el reglamento exige al menos 2 grupos para poder armar una fase posterior.');
      return out;
    }
    if (G > MAX_GROUPS){
      out.warnings.push('La tabla oficial cubre hasta ' + MAX_GROUPS + ' grupos. Con ' + G +
        ' el formato se calcula con la fórmula general, pero debe validarse a mano.');
      out.tag = TAGS.WARN;
    }
    if (lv.short) out.warnings.push(lv.short + ' grupo' + (lv.short === 1 ? '' : 's') +
      ' tiene menos de 3 participantes válidos: no aporta tercer lugar y el reglamento no permite ese tamaño.');

    const has3 = out.groupsOf3 > 0;

    if (D > 0 && D <= G){
      // CASO 1 — llave directa
      out.case = 1;
      out.primary = directVariant(G, lv, D, usable);
      out.primary.tag = has3 && out.primary.thirds.usesReserve ? TAGS.EXC
        : (out.primary.warnings.length ? TAGS.WARN : (has3 ? TAGS.REC : TAGS.IDEAL));
      out.notes.push('Fórmula: B = ' + B + ' (primera potencia de 2 ≥ 2×' + G + '), D = ' + D +
        '. Como 0 < D ≤ G, corresponde llave directa con ' + D + ' tercero' + (D === 1 ? '' : 's') + '.');
    } else if (D === 0){
      // CASO 2 — primeros y segundos ya llenan la llave
      out.case = 2;
      const inclusive = accessVariant(G, lv, G, usable, has3);
      const direct = directVariant(G, lv, 0, usable);
      direct.title = 'Llave directa con primeros y segundos';
      if (!has3){
        out.primary = inclusive;
        out.primary.tag = inclusive.warnings.length ? TAGS.WARN : TAGS.IDEAL;
        out.alternative = direct;
        out.alternative.tag = TAGS.WARN;
        out.alternative.title = 'Llave directa sin terceros';
        out.alternative.reasons.push('Solo si la organización decide no dar oportunidad a los terceros. ' +
          'Los ' + G + ' terceros quedarían eliminados aunque todos vengan de grupos de 4 o 5.');
        out.notes.push('Fórmula: D = 0, así que primeros y segundos ya llenan una llave de ' + B +
          '. Todos los grupos son efectivos de 4 o 5 → acceso con primeros protegidos y TODOS los terceros con oportunidad.');
      } else {
        out.primary = direct;
        out.primary.tag = TAGS.REC;
        out.primary.reasons.push('Existe' + (out.groupsOf3 === 1 ? '' : 'n') + ' ' + out.groupsOf3 +
          ' grupo' + (out.groupsOf3 === 1 ? '' : 's') + ' efectivo' + (out.groupsOf3 === 1 ? '' : 's') +
          ' de 3, cuyo tercer lugar también es último: por reglamento se considera eliminado, ' +
          'así que la recomendación es llave directa de ' + B + ' con primeros y segundos.');
        out.alternative = inclusive;
        out.alternative.tag = TAGS.EXC;
        out.alternative.title = 'Acceso inclusivo (excepcional)';
        out.notes.push('Fórmula: D = 0 y hay grupos efectivos de 3 → llave directa recomendada; ' +
          'la inclusión de terceros de reserva es una opción administrativa extraordinaria.');
      }
      if (opts.include3rdReserve && out.alternative && out.alternative.id === 'ACCESS'){
        const swap = out.primary; out.primary = out.alternative; out.alternative = swap;
        out.notes.push('Se forzó manualmente la variante inclusiva: queda marcada como EXCEPCIONAL.');
      }
    } else {
      // CASO 3 — D > G: acceso con primeros protegidos, T = B − 3G
      out.case = 3;
      const T = B - 3 * G;
      out.primary = accessVariant(G, lv, Math.max(0, T), usable, false);
      out.primary.tag = out.primary.warnings.length ? TAGS.WARN : (has3 ? TAGS.REC : TAGS.IDEAL);
      out.notes.push('Fórmula: B = ' + B + ', D = ' + D + ' > G = ' + G + ' → acceso protegido con T = B − 3G = ' + T + ' tercero' + (T === 1 ? '' : 's') + '.');
    }

    out.tag = out.primary ? out.primary.tag : out.tag;
    if (out.warnings.length && out.tag === TAGS.IDEAL) out.tag = TAGS.WARN;
    out.summary = summarize(out);
    return out;
  }

  function summarize(p){ return summarizeVariant(p, p && p.primary); }

  // Resumen de UNA variante concreta (la elegida en el selector), no siempre la
  // primaria: si no, el título decía «llave directa» y el detalle describía el
  // acceso protegido.
  function summarizeVariant(p, v){
    if (!p) return 'Formato no calculable.';
    v = v || p.primary;
    if (!v) return 'Formato no calculable.';
    if (v.kind === 'DIRECT')
      return p.groups + ' grupos · ' + v.classified + ' clasificados (' + v.firsts + ' primeros, ' +
        v.seconds + ' segundos' + (v.thirdsSlots ? ', ' + v.thirdsSlots + ' terceros' : '') +
        ') · llave directa de ' + v.bracket + ' · sin pases directos.';
    return p.groups + ' grupos · ' + v.directPasses + ' pases directos (todos los primeros) · ' +
      v.accessMatches + ' partidos de acceso con ' + v.seconds + ' segundos' +
      (v.thirdsSlots ? ' y ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
      ' · llave principal de ' + v.bracket + '.';
  }

  // Una sola frase en lenguaje llano: qué le pasa a cada quién.
  function plainVariant(v){
    if (!v) return '';
    const rd = String(v.bracketLabel || '').toLowerCase();
    if (v.kind === 'DIRECT')
      return 'Pasan los ' + v.firsts + ' primeros y los ' + v.seconds + ' segundos' +
        (v.thirdsSlots ? ' más ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
        ' directo a ' + rd + '. Nadie recibe pase directo y no se juega ronda de acceso.';
    return 'Los ' + v.firsts + ' primeros esperan en ' + rd + ' con pase directo. Los ' + v.seconds + ' segundos' +
      (v.thirdsSlots ? ' y ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
      ' juegan ' + v.accessMatches + ' partido' + (v.accessMatches === 1 ? '' : 's') + ' de acceso; los ganadores completan la llave.';
  }

  // ── 5. Selección y comparación de terceros ────────────────────────────
  // rows: [{ id, name, groupLabel, effectiveSize, wins, setDiff, setPct, played }]
  // Solo se comparan terceros del MISMO tamaño efectivo. Devuelve por nivel la
  // lista ordenada, la línea de corte y los empates en la frontera.
  const levelOfSize = s => Number(s) >= 5 ? 'A' : Number(s) === 4 ? 'B' : 'C';
  const cmpThird = (a, b) =>
    (Number(b.wins || 0) - Number(a.wins || 0)) ||
    (Number(b.setDiff || 0) - Number(a.setDiff || 0)) ||
    (Number(b.setPct || 0) - Number(a.setPct || 0)) ||
    String(a.name || '').localeCompare(String(b.name || ''));
  const sameThird = (a, b) =>
    Number(a.wins || 0) === Number(b.wins || 0) &&
    Number(a.setDiff || 0) === Number(b.setDiff || 0) &&
    Number(a.setPct || 0) === Number(b.setPct || 0);

  function selectThirds(rows, slots){
    const byLevel = { A:[], B:[], C:[] };
    (rows || []).forEach(r => { byLevel[levelOfSize(r.effectiveSize)].push(Object.assign({}, r)); });
    ['A','B','C'].forEach(k => byLevel[k].sort(cmpThird));
    let rest = Math.max(0, Number(slots) || 0);
    const levels = [];
    const qualified = [], eliminated = [], tied = [];
    ['A','B','C'].forEach(k => {
      const list = byLevel[k];
      const take = Math.min(rest, list.length);
      let boundary = [];
      if (take > 0 && take < list.length && sameThird(list[take - 1], list[take])){
        // el empate cruza la última plaza disponible del nivel
        boundary = list.filter(x => sameThird(x, list[take - 1]));
      }
      list.forEach((x, i) => {
        x.level = k;
        x.status = i < take ? 'IN' : (k === 'C' && take === 0 ? 'RESERVE_OUT' : 'OUT');
        x.onCut = boundary.some(b => b === x);
        (x.status === 'IN' ? qualified : eliminated).push(x);
        if (x.onCut) tied.push(x);
      });
      levels.push({ level: k, size: k === 'A' ? 5 : k === 'B' ? 4 : 3, list, admitted: take,
        needsTiebreak: boundary.length > 0, tiedAt: boundary });
      rest -= take;
    });
    return { levels, qualified, eliminated, tied, missing: rest,
             needsTiebreak: levels.some(l => l.needsTiebreak) };
  }

  // ── 6. Tabla oficial 2–10 grupos (derivada, para publicar y verificar) ──
  function officialTable(maxGroups){
    const out = [];
    for (let g = 2; g <= (maxGroups || MAX_GROUPS); g++){
      const p = planFor(g, new Array(g).fill(TARGET_SIZE));
      out.push({ groups: g, case: p.case, plan: p.primary, alternative: p.alternative, summary: p.summary });
    }
    return out;
  }

  // ── 7. Simulador (sin efectos: no toca Supabase) ──────────────────────
  // input: { participants, groupCount?, sizes?, include3rdReserve? }
  function simulate(input){
    input = input || {};
    const n = Math.max(0, Number(input.participants) || 0);
    const dist = recommendDistribution(n);
    let sizes = Array.isArray(input.sizes) && input.sizes.length ? input.sizes.map(Number) : null;
    if (!sizes && input.groupCount){
      const match = dist.all.find(d => d.groups === Number(input.groupCount));
      sizes = match ? match.sizes.slice() : null;
    }
    if (!sizes) sizes = dist.rec ? dist.rec.sizes.slice() : [];
    const G = sizes.length;
    const plan = planFor(G, sizes, { include3rdReserve: !!input.include3rdReserve });
    const inGroups = sizes.reduce((a, b) => a + b, 0);
    if (inGroups !== n) plan.warnings.push('Los tamaños indicados suman ' + inGroups + ' pero hay ' + n +
      ' participantes: revisa altas, bajas o cambios de categoría.');
    return { participants: n, distribution: dist, sizes: sizes, plan: plan };
  }

  const api = {
    MIN_SIZE, TARGET_SIZE, MAX_SIZE, MAX_GROUPS, TAGS,
    distributions, recommendDistribution, distributionReason, sizesLabel,
    effectiveSize, effectiveNote, thirdLevels, thirdsPlan, levelOfSize,
    nextPow2, roundLabel, planFor, summarize, summarizeVariant, plainVariant, selectThirds, cmpThird, sameThird,
    officialTable, simulate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FI_FORMAT = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
