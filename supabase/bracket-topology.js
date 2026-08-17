// ── TOPOLOGÍA DEL CUADRO ELIMINATORIO ───────────────────────────────────
// Lógica PURA (sin DOM, sin red). Traduce el FORMATO acordado (número de
// grupos → motor del reglamento) en la ESTRUCTURA GRÁFICA del bracket:
// rondas, tarjetas, columnas, conexiones y quién descansa (pase directo).
//
// Reglas que respeta:
//   · El cuadro SIEMPRE se deduce del formato; nunca al revés.
//   · Si hay pases directos los reciben TODOS los primeros (nunca algunos).
//   · Un pase directo NO es un partido: es un descanso en la ronda de acceso.
//   · La llave es espejo (izquierda ↔ derecha) con la final al centro.
//
// Tamaños soportados de llave principal: 2, 4, 8, 16 y 32.
(function(global){
  'use strict';

  const SIZES = [2,4,8,16,32];
  const ROUND_ID   = { 2:'final', 4:'semifinal', 8:'quarterfinal', 16:'r16', 32:'r32' };
  const ROUND_LABEL= { access:'RONDA DE ACCESO', r32:'DIECISEISAVOS', r16:'OCTAVOS',
                       quarterfinal:'CUARTOS', semifinal:'SEMIFINAL', final:'GRAN FINAL' };
  const ROUND_TYPE = { access:'ACCESS', r32:'ROUND_OF_32', r16:'ROUND_OF_16',
                       quarterfinal:'QUARTERFINAL', semifinal:'SEMIFINAL', final:'FINAL' };
  const CODE_OF_SIZE = { 2:'FINAL', 4:'SEMIFINAL', 8:'QUARTERFINAL', 16:'ROUND_OF_16', 32:'ROUND_OF_32' };
  const SIZE_OF_CODE = { FINAL:2, SEMIFINAL:4, QUARTERFINAL:8, ROUND_OF_16:16, ROUND_OF_32:32 };
  const SIDE_ES = { l:'IZQUIERDA', r:'DERECHA' };
  const MAX_ACCESS_PER_SIDE = 16;   // llave de 32 = 16 partidos de acceso por lado
  // ids de FASE 1 → ids genéricos (una llave de 8 con 4 accesos)
  const LEGACY_ALIAS = { accessLeftTop:'accessL1', accessLeftBottom:'accessL2',
                         accessRightTop:'accessR1', accessRightBottom:'accessR2' };

  function slotId(roundId, side, i){
    if (roundId === 'final') return 'final';
    if (roundId === 'semifinal') return side === 'l' ? 'semifinalLeft' : 'semifinalRight';
    if (roundId === 'quarterfinal')
      return side === 'l' ? (i === 0 ? 'quarterLeftTop' : 'quarterLeftBottom')
                          : (i === 0 ? 'quarterRightTop' : 'quarterRightBottom');
    if (roundId === 'access') return (side === 'l' ? 'accessL' : 'accessR') + (i + 1);
    return roundId + (side === 'l' ? 'L' : 'R') + (i + 1);
  }
  function labelFor(roundId, side, i){
    if (roundId === 'final') return 'GRAN FINAL';
    if (roundId === 'semifinal') return 'SEMIFINAL ' + SIDE_ES[side];
    return ROUND_LABEL[roundId] + ' ' + SIDE_ES[side] + ' ' + (i + 1);
  }

  // Catálogo de TODOS los ids posibles (para migrar y validar configuraciones).
  let CATALOG = null;
  function catalog(){
    if (CATALOG) return CATALOG;
    const out = [];
    const add = (roundId, side, i) =>
      out.push({ id: slotId(roundId, side, i), roundId, side, index:i, label: labelFor(roundId, side, i) });
    for (let i = 0; i < MAX_ACCESS_PER_SIDE; i++){ add('access','l',i); add('access','r',i); }
    for (let i = 0; i < 8; i++){ add('r32','l',i); add('r32','r',i); }
    for (let i = 0; i < 4; i++){ add('r16','l',i); add('r16','r',i); }
    for (let i = 0; i < 2; i++){ add('quarterfinal','l',i); add('quarterfinal','r',i); }
    add('semifinal','l',0); add('semifinal','r',0);
    add('final','c',0);
    CATALOG = out;
    return out;
  }
  let BY_ID = null;
  function meta(id){
    if (!BY_ID){ BY_ID = {}; catalog().forEach(s => { BY_ID[s.id] = s; }); }
    return BY_ID[LEGACY_ALIAS[id] || id] || null;
  }
  const allSlotIds = () => catalog().map(s => s.id);
  const slotLabel  = id => (meta(id) || {}).label || String(id || '');
  // Un id fuera del catálogo se deduce de su prefijo: si no, una tarjeta de
  // acceso se contaba como de cuartos y aparecía duplicada en el cuadro.
  function roundOf(id){
    const m = meta(id);
    if (m) return m.roundId;
    const p = /^(access|r16|r32)[LR]\d+$/.exec(String(id || ''));
    return p ? p[1] : 'quarterfinal';
  }
  const positionOf = id => ((meta(id) || {}).index || 0) + 1;

  function sizeFromFormat(f){
    f = f || {};
    let b = Number(f.bracketSize);
    if (SIZES.indexOf(b) < 0 && b > 0){                 // llave no potencia de 2 → sube al siguiente tamaño
      for (let i = 0; i < SIZES.length; i++) if (SIZES[i] >= b){ b = SIZES[i]; break; }
    }
    if (SIZES.indexOf(b) < 0) b = SIZE_OF_CODE[f.mainRound] || 0;
    if (SIZES.indexOf(b) < 0) b = 8;
    return b;
  }

  // ── Plan estructural completo ─────────────────────────────────────────
  // format: { bracketSize | mainRound, hasAccessRound, accessMatchCount,
  //           directPassCount, accessRoundLabel }
  function buildPlan(format){
    format = format || {};
    const B = sizeFromFormat(format);
    const warnings = [];

    const rounds = [];
    for (let n = B; n >= 2; n /= 2){
      const id = ROUND_ID[n];
      rounds.push({ id, size:n, type:ROUND_TYPE[id], label:ROUND_LABEL[id],
        matches: n / 2, perSide: n >= 4 ? n / 4 : 0 });
    }
    const mainRound = rounds[0];
    const slots = [], connections = [], entries = {};

    rounds.forEach((r, ri) => {
      if (r.size === 2){ slots.push({ id:'final', roundId:'final', side:'c', index:0, kind:'MATCH' }); return; }
      ['l','r'].forEach(side => {
        for (let i = 0; i < r.perSide; i++){
          const id = slotId(r.id, side, i);
          slots.push({ id, roundId:r.id, side, index:i, kind:'MATCH' });
          const nr = rounds[ri + 1];
          const toSlot = nr.size === 2 ? 'final' : slotId(nr.id, side, Math.floor(i / 2));
          const toParticipant = nr.size === 2 ? (side === 'l' ? 'A' : 'B') : (i % 2 === 0 ? 'A' : 'B');
          connections.push({ id:'c-' + id, fromSlot:id, fromOutcome:'WINNER', toSlot, toParticipant, enabled:true });
        }
      });
    });

    // ── Ronda de acceso: los primeros descansan, el resto juega por entrar ──
    const mainMatches = B / 2;
    const wantAccess = !!format.hasAccessRound && B >= 4;
    let A = Math.max(0, Number(format.accessMatchCount) || 0);
    if (wantAccess && A > 2 * mainMatches){
      warnings.push('La ronda de acceso declara ' + A + ' partidos, más de los que caben en una llave de ' + B +
        ' (máximo ' + (2 * mainMatches) + '). Se recortó para poder dibujar el cuadro.');
      A = 2 * mainMatches;
    }
    const hasAccess = wantAccess && A > 0;
    const byes = hasAccess ? B - A : 0;

    if (hasAccess){
      // Los A ganadores de acceso se reparten entre los B/2 partidos de la
      // ronda principal. Cada lugar que no llena el acceso lo ocupa un PASE
      // DIRECTO: ese primero descansa.
      //
      // El reparto es SIMÉTRICO: primero se divide la ronda entre los dos
      // lados (el impar se queda a la izquierda) y solo después se esparce
      // dentro de cada lado. Antes se repartía sobre la lista alternada
      // l,r,l,r… y el sobrante caía SIEMPRE a la derecha: con 2 accesos la
      // izquierda se quedaba con 0 y la derecha con 2, y con 6 salía 2/4.
      const perSideAccess = { l: Math.ceil(A / 2), r: Math.floor(A / 2) };
      const feeders = [];
      ['l','r'].forEach(side => {
        const m = mainRound.perSide, a = perSideAccess[side];
        for (let i = 0; i < m; i++){
          const take = Math.floor((i + 1) * a / m) - Math.floor(i * a / m);
          const target = slotId(mainRound.id, side, i);
          entries[target] = { A: take >= 2 ? 'ACCESS' : 'DIRECT_PASS', B: take >= 1 ? 'ACCESS' : 'DIRECT_PASS' };
          if (take >= 2) feeders.push({ side, target, participant:'A' });
          if (take >= 1) feeders.push({ side, target, participant:'B' });
        }
      });
      const count = { l:0, r:0 };
      feeders.forEach(f => {
        const i = count[f.side]++;
        const id = slotId('access', f.side, i);
        slots.push({ id, roundId:'access', side:f.side, index:i, kind:'MATCH' });
        connections.push({ id:'c-' + id, fromSlot:id, fromOutcome:'WINNER',
          toSlot:f.target, toParticipant:f.participant, enabled:true });
      });
      const declaredD = Number(format.directPassCount);
      if (Number.isFinite(declaredD) && declaredD !== byes)
        warnings.push('El formato declara ' + declaredD + ' pases directos, pero una llave de ' + B + ' con ' + A +
          ' partidos de acceso deja ' + byes + ' lugares de descanso. Revisa el número de grupos.');
    }

    // ── Columnas de render (izquierda → centro → derecha) ────────────────
    const idsOf = (roundId, side) => slots.filter(s => s.roundId === roundId && s.side === side)
      .sort((a,b) => a.index - b.index).map(s => s.id);
    const accessLabel = (format.accessRoundLabel || ROUND_LABEL.access);
    const columns = [];
    const bracketRounds = rounds.filter(r => r.size >= 4);
    if (hasAccess) columns.push({ key:'access-l', side:'l', roundId:'access', label:accessLabel, ids: idsOf('access','l') });
    bracketRounds.forEach(r => columns.push({ key:r.id + '-l', side:'l', roundId:r.id, label:r.label, ids: idsOf(r.id,'l') }));
    columns.push({ key:'center', side:'c', roundId:'final', label:ROUND_LABEL.final, ids:['final'] });
    bracketRounds.slice().reverse().forEach(r => columns.push({ key:r.id + '-r', side:'r', roundId:r.id, label:r.label, ids: idsOf(r.id,'r') }));
    if (hasAccess) columns.push({ key:'access-r', side:'r', roundId:'access', label:accessLabel, ids: idsOf('access','r') });

    const configRounds = [];
    if (B >= 4) configRounds.push({ id:'access', type:'ACCESS', label:accessLabel, visible:hasAccess, displayOrder:1 });
    rounds.forEach((r, i) =>
      configRounds.push({ id:r.id, type:r.type, label:r.label, visible:true, displayOrder: i + 2 }));

    return {
      bracketSize: B, mainRoundId: mainRound.id, mainRoundLabel: mainRound.label,
      mainRoundCode: CODE_OF_SIZE[B], hasAccess, accessMatches: hasAccess ? A : 0,
      directPasses: byes, mainMatches, totalMatches: (hasAccess ? A : 0) + (B - 1),
      rounds, configRounds, slots, connections, entries, columns, warnings,
      slotIds: slots.map(s => s.id),
      systemLabel: systemLabel(B, hasAccess),
      systemLine: systemLine(B, hasAccess, A, byes)
    };
  }

  function systemLabel(B, hasAccess){
    const r = ROUND_LABEL[ROUND_ID[B]];
    return hasAccess ? r + ' CON RONDA DE ACCESO' : r + (B === 2 ? '' : ' DIRECTOS');
  }
  function systemLine(B, hasAccess, A, byes){
    const r = String(ROUND_LABEL[ROUND_ID[B]]).toLowerCase();
    if (!hasAccess) return 'Llave directa de ' + B + ': todos entran en ' + r + ', nadie descansa.';
    return 'Llave de ' + B + ': ' + byes + ' pase' + (byes === 1 ? '' : 's') + ' directo' + (byes === 1 ? '' : 's') +
      ' (descansan) + ' + A + ' partido' + (A === 1 ? '' : 's') + ' de acceso que completan ' + r + '.';
  }

  // ── Formato a partir del reglamento (número de grupos) ─────────────────
  function formatFromGroups(groupCount, effectiveSizes, opts){
    const F = global.FI_FORMAT || (typeof require === 'function' ? require('./format-engine.js') : null);
    const G = Number(groupCount) || 0;
    if (!F || G < 2) return null;
    const plan = F.planFor(G, effectiveSizes && effectiveSizes.length === G ? effectiveSizes : new Array(G).fill(4), opts || {});
    const v = plan.primary;
    if (!v) return null;
    return {
      enginePlan: plan, variant: v,
      format: {
        groupCount: G,
        bracketSize: v.bracket,
        mainRound: CODE_OF_SIZE[v.bracket] || 'QUARTERFINAL',
        hasAccessRound: v.kind === 'ACCESS',
        directPassCount: v.kind === 'ACCESS' ? v.directPasses : 0,
        accessMatchCount: v.accessMatches,
        bestThirdsCount: v.thirdsSlots,
        qualifiedCount: v.classified
      }
    };
  }

  // ── Aplicar el plan a una configuración (conserva lo ya capturado) ─────
  // mkEmpty(id) → slot vacío (lo aporta bracket-config.js para no duplicar
  // el contrato). Los slots que dejan de existir SOLO se conservan (ocultos) si
  // guardan algo irrecuperable; los vacíos se borran para no dejar «bloques
  // fantasma» traslúcidos encima del cuadro vigente.
  function applyPlan(cfg, plan, mkEmpty){
    if (!cfg || !plan) return cfg;
    const prev = cfg.slots || {};
    const next = {};
    plan.slots.forEach(s => {
      const base = mkEmpty(s.id);
      const old = prev[s.id];
      const slot = old ? Object.assign(base, old) : base;
      slot.id = s.id; slot.roundId = s.roundId; slot.positionNumber = s.index + 1;
      // se respeta un «ocultar tarjeta» manual, pero un slot que estaba fuera
      // de la estructura anterior vuelve visible al reingresar al plan
      slot.visible = !old || old.outOfPlan ? true : old.visible !== false;
      delete slot.outOfPlan;
      const e = plan.entries[s.id];
      slot.entryA = e ? e.A : null;
      slot.entryB = e ? e.B : null;
      next[s.id] = slot;
    });
    Object.keys(prev).forEach(id => {
      if (next[id]) return;
      const kept = prev[id];
      const worth = !!(kept && (kept.officialMatchId || kept.manualWinnerSlot ||
        kept.manualScoreA != null || kept.manualScoreB != null));
      if (!worth) return;                   // resto vacío: se descarta
      kept.visible = false;                 // fuera de la estructura vigente
      kept.outOfPlan = true;
      next[id] = kept;
    });
    cfg.slots = next;
    cfg.rounds = plan.configRounds.map(r => Object.assign({}, r));
    cfg.connections = plan.connections.map(c => Object.assign({}, c));
    cfg.layoutKey = cfg.layout = layoutKey(plan);
    return cfg;
  }
  function layoutKey(plan){
    return 'MIRRORED_' + plan.bracketSize + (plan.hasAccess ? '_WITH_ACCESS' : '_DIRECT');
  }

  const api = { SIZES, ROUND_ID, ROUND_LABEL, ROUND_TYPE, CODE_OF_SIZE, SIZE_OF_CODE, LEGACY_ALIAS,
    slotId, labelFor, catalog, meta, allSlotIds, slotLabel, roundOf, positionOf,
    sizeFromFormat, buildPlan, formatFromGroups, applyPlan, layoutKey, systemLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FI_BKT_TOPO = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
