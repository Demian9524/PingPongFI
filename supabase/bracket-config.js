// ── Bracket final configurable · capa de datos (FASE 2) ─────────────────
// Contrato JSON v1 (layoutKey/header/format/rounds/slots/connections/
// champion/runnerUp). Fuente SQL: sql/PROPUESTA_bracket_config_publicacion.sql
//
// Reglas duras de este módulo:
//   · nunca escribe en public.matches (ni una sola RPC de resultados);
//   · el sorteo es FÍSICO: aquí solo se captura lo extraído;
//   · la página pública consume EXCLUSIVAMENTE published_config;
//   · nada se guarda en localStorage como fuente oficial.
(function(global){
  'use strict';

  // La estructura del cuadro la manda supabase/bracket-topology.js: aquí solo
  // se persiste el contrato JSON. Nada de esto está fijo a 7 tarjetas.
  const TOPO = (global && global.FI_BKT_TOPO) ||
    (typeof require === 'function' ? require('./bracket-topology.js') : null);
  const CATALOG = TOPO ? TOPO.catalog() : [];
  const ALL_SLOTS = CATALOG.map(s => s.id);
  const ACCESS_SLOTS = CATALOG.filter(s => s.roundId === 'access').map(s => s.id);
  const CORE_SLOTS = CATALOG.filter(s => s.roundId !== 'access').map(s => s.id);
  const LAYOUT_KEYS = ['MIRRORED_2_DIRECT','MIRRORED_4_DIRECT','MIRRORED_4_WITH_ACCESS','MIRRORED_8_DIRECT','MIRRORED_8_WITH_ACCESS','MIRRORED_16_DIRECT','MIRRORED_16_WITH_ACCESS','MIRRORED_32_DIRECT','MIRRORED_32_WITH_ACCESS','FREE_CANVAS'];
  const CANVAS = () => (global && global.FI_BKT_CANVAS) || null;
  const isFreeCfg = c => !!(c && (c.layoutKey === 'FREE_CANVAS' || c.layout === 'FREE_CANVAS'));
  const STATUSES = ['PROVISIONAL','READY','OFFICIAL','IN_PROGRESS','COMPLETED','CANCELLED','HIDDEN'];
  const MODES = ['REGISTRATION','PLACEHOLDER','DERIVED','EMPTY'];
  const KEY_TO_CODE = { principiante:'PRINCIPIANTE', intermedio:'INTERMEDIO', avanzado:'AVANZADO_OPEN' };

  const SLOT_LABEL = { champion:'CAMPEÓN', runnerUp:'SUBCAMPEÓN' };
  CATALOG.forEach(s => { SLOT_LABEL[s.id] = s.label; });
  const ROUND_OF_SLOT = {}, POSITION_OF_SLOT = {};
  CATALOG.forEach(s => { ROUND_OF_SLOT[s.id] = s.roundId; POSITION_OF_SLOT[s.id] = s.index + 1; });
  // alias de FASE 1 (llave de 8 con 4 accesos) → ids genéricos
  const LEGACY_ALIAS = (TOPO && TOPO.LEGACY_ALIAS) || {};
  // ruta física extraída de la caja de posiciones → slot del bracket
  const POSITION_TO_SLOT = {
    'Cuartos 1':'quarterLeftTop', 'Cuartos 2':'quarterLeftBottom',
    'Cuartos 3':'quarterRightTop', 'Cuartos 4':'quarterRightBottom',
    'Acceso 1':'accessL1', 'Acceso 2':'accessL2', 'Acceso 3':'accessR1', 'Acceso 4':'accessR2',
    'Semifinal 1':'semifinalLeft', 'Semifinal 2':'semifinalRight'
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const planOf = f => TOPO.buildPlan(f || defaultFormat());
  const DEFAULT_ROUNDS = TOPO ? planOf().configRounds : [];
  const DEFAULT_CONNECTIONS = TOPO ? planOf().connections : [];

  function emptyParticipant(){
    return { mode:'EMPTY', registrationId:null, playerId:null, publicCode:null,
      displayName:'Por definir', sourceLabel:null, groupId:null, groupLabel:null,
      facultyLogo:null, careerLogo:null };
  }
  function emptySlot(slotId){
    return { id: slotId || null, roundId: ROUND_OF_SLOT[slotId] || 'quarterfinal',
      positionNumber: POSITION_OF_SLOT[slotId] || 1,
      visible:true, slotType:'MATCH',
      participantA: emptyParticipant(), participantB: emptyParticipant(),
      entryA:null, entryB:null,
      officialMatchId:null, manualStatus:'PROVISIONAL',
      manualScoreA:null, manualScoreB:null, manualWinnerSlot:null,
      sourceLabel:'', notes:'' };
  }
  function defaultFormat(){
    return { groupCount:null, qualifiedCount:null, bracketSize:8,
      mainRound:'QUARTERFINAL', hasAccessRound:false,
      directPassCount:0, accessMatchCount:0, bestThirdsCount:0,
      accessRoundLabel:'RONDA DE ACCESO', effectiveSizes:null, systemSource:'MANUAL',
      drawMethod:'PHYSICAL_THREE_POTS_AND_POSITION_BOX', sameGroupRematchBlocked:true };
  }
  function emptyConfig(labels){
    const cfg = {
      version:1, layoutKey:'MIRRORED_8_DIRECT', layout:'MIRRORED_8_DIRECT',
      header: Object.assign({ title:'BRACKET FINAL', categoryLabel:'', editionLabel:'Edición 2027-1',
        championLabel:'Campeón', runnerUpLabel:'Subcampeón', footerText:'« ¡La gloria te espera! »' }, labels || {}),
      format: defaultFormat(),
      rounds: clone(DEFAULT_ROUNDS),
      slots: {},
      connections: clone(DEFAULT_CONNECTIONS),
      champion:{ mode:'DERIVED', sourceSlot:'final', sourceOutcome:'WINNER', registrationId:null, displayName:'Por definir' },
      runnerUp:{ mode:'DERIVED', sourceSlot:'final', sourceOutcome:'LOSER', registrationId:null, displayName:'Por definir' }
    };
    return TOPO ? TOPO.applyPlan(cfg, planOf(cfg.format), emptySlot) : cfg;
  }

  // Aplica al borrador el SISTEMA acordado: rondas, tarjetas, conexiones y
  // quién descansa. Conserva lo ya capturado en las tarjetas que sobreviven.
  // En una llave dibujada a mano (FREE_CANVAS) el formato es solo referencia:
  // no se redibuja nada salvo que se pida explícitamente (force).
  function applySystem(cfg, format, force){
    if (!cfg || !TOPO) return cfg;
    cfg.format = Object.assign(defaultFormat(), cfg.format || {}, format || {});
    const plan = TOPO.buildPlan(cfg.format);
    cfg.format.bracketSize = plan.bracketSize;
    cfg.format.mainRound = plan.mainRoundCode;
    cfg.format.hasAccessRound = plan.hasAccess;
    cfg.format.accessMatchCount = plan.accessMatches;
    cfg.format.directPassCount = plan.directPasses;
    if (isFreeCfg(cfg) && !force) return cfg;
    TOPO.applyPlan(cfg, plan, emptySlot);
    return cfg;
  }

  // Config de FASE 1 (llave fija de 8) → contrato v2 con estructura variable.
  // No inventa datos: completa la estructura que el FORMATO exige.
  function migrate(cfg){
    if (!cfg || typeof cfg !== 'object') return emptyConfig();
    const out = clone(cfg);
    out.version = 1;
    out.header = Object.assign({ title:'BRACKET FINAL', categoryLabel:'', editionLabel:'Edición 2027-1',
      championLabel:'Campeón', runnerUpLabel:'Subcampeón', footerText:'« ¡La gloria te espera! »' }, out.header || {});
    out.format = Object.assign(defaultFormat(), out.format || {});
    if (!out.format.bracketSize)
      out.format.bracketSize = (TOPO && TOPO.SIZE_OF_CODE[out.format.mainRound]) || 8;
    out.slots = out.slots || {};
    // ids de FASE 1 → ids genéricos (accessLeftTop → accessL1…)
    Object.keys(LEGACY_ALIAS).forEach(old => {
      if (!out.slots[old]) return;
      const to = LEGACY_ALIAS[old];
      if (!out.slots[to]) out.slots[to] = out.slots[old];
      delete out.slots[old];
    });
    Object.keys(out.slots).forEach(id => {
      const cur = out.slots[id];
      if (!cur || typeof cur !== 'object'){ delete out.slots[id]; return; }
      out.slots[id] = Object.assign(emptySlot(id), cur, {
        id, roundId: cur.roundId || ROUND_OF_SLOT[id] || 'quarterfinal',
        positionNumber: cur.positionNumber || POSITION_OF_SLOT[id] || 1,
        slotType: cur.slotType || cur.cardType || 'MATCH',
        participantA: Object.assign(emptyParticipant(), cur.participantA || {}),
        participantB: Object.assign(emptyParticipant(), cur.participantB || {})
      });
      delete out.slots[id].cardType;
    });
    if (TOPO && !isFreeCfg(out)) TOPO.applyPlan(out, TOPO.buildPlan(out.format), emptySlot);
    else if (!TOPO) {
      if (!Array.isArray(out.rounds) || !out.rounds.length) out.rounds = clone(DEFAULT_ROUNDS);
      if (!Array.isArray(out.connections) || !out.connections.length) out.connections = clone(DEFAULT_CONNECTIONS);
    }
    out.layoutKey = out.layout = out.layoutKey || 'MIRRORED_8_DIRECT';
    if (isFreeCfg(out) && CANVAS()) CANVAS().ensure(out);
    ['champion','runnerUp'].forEach(k => {
      out[k] = Object.assign({ mode:'DERIVED', sourceSlot:'final',
        sourceOutcome: k === 'champion' ? 'WINNER' : 'LOSER', registrationId:null, displayName:'Por definir' }, out[k] || {});
    });
    return out;
  }

  // ── Vista resuelta de un slot ──
  // El partido OFICIAL vinculado manda sobre lo manual. Si la consulta oficial
  // falló, se conserva el snapshot y se marca officialUnavailable.
  function slotView(slot){
    if (!slot) slot = emptySlot();
    const raw = slot.official || null;
    const off = raw && !raw.error ? raw : null;
    const scoreA = off ? off.setsA : slot.manualScoreA;
    const scoreB = off ? off.setsB : slot.manualScoreB;
    const winner = off ? (off.winnerSlot || null) : (slot.manualWinnerSlot || null);
    const status = off ? off.status : (slot.manualStatus || 'PROVISIONAL');
    return {
      visible: slot.visible !== false,
      slotType: slot.slotType || 'MATCH',
      a: slot.participantA || emptyParticipant(),
      b: slot.participantB || emptyParticipant(),
      scoreA: scoreA == null ? null : scoreA,
      scoreB: scoreB == null ? null : scoreB,
      winner, status,
      official: off,
      officialUnavailable: !!(raw && raw.error),
      linked: !!slot.officialMatchId,
      sourceLabel: slot.sourceLabel || ''
    };
  }

  // Nombre derivado de campeón/subcampeón a partir de la final (solo render).
  function derivedWinner(cfg, which){
    const who = (cfg && cfg[which]) || null;
    if (who && who.mode === 'REGISTRATION' && who.displayName) return who;
    if (who && who.mode === 'PLACEHOLDER' && who.displayName && who.displayName !== 'Por definir') return who;
    const src = (who && who.sourceSlot) || 'final';
    const outcome = (who && who.sourceOutcome) || (which === 'champion' ? 'WINNER' : 'LOSER');
    // En el lienzo libre los participantes de la final son DERIVADOS (llegan por
    // conexión), así que hay que leer la vista resuelta del lienzo: si no, el
    // campeón y el subcampeón se quedaban siempre en «Por definir».
    let v = slotView(cfg && cfg.slots ? cfg.slots[src] : null);
    if (isFreeCfg(cfg) && CANVAS() && CANVAS().resolve){
      try {
        const r = CANVAS().resolve(cfg)[src];
        if (r) v = Object.assign({}, v, { a: r.a, b: r.b });
      } catch(e){}
    }
    if (!v.winner) return who;
    const win = v.winner === 'A' ? v.a : v.b;
    const lose = v.winner === 'A' ? v.b : v.a;
    const p = outcome === 'LOSER' ? lose : win;
    if (!p || p.mode === 'EMPTY') return who;
    return { mode: p.mode, registrationId: p.registrationId || null, displayName: p.displayName, derived:true };
  }

  // ── Recomendación de formato según el número de grupos ────────────────
  // Derivada del motor del reglamento (supabase/format-engine.js): fórmula
  // general B = potencia de 2 ≥ 2G · D = B − 2G · T = B − 3G. Cubre 2–10 grupos.
  // Si hay pases directos los reciben TODOS los primeros; nunca algunos.
  const ENGINE = (global && global.FI_FORMAT) ||
    (typeof require === 'function' ? require('./format-engine.js') : null);
  function ruleFor(n, sizes){
    if (!ENGINE || !TOPO) return null;
    const r = TOPO.formatFromGroups(n, sizes);
    if (!r) return null;
    const v = r.variant;
    return Object.assign({}, r.format, {
      mainBracketSize: v.bracket,
      bracketLabel: v.bracketLabel,
      title: v.title,
      tag: v.tag || (r.enginePlan && r.enginePlan.tag) || null,
      plain: ENGINE.plainVariant(v),
      engineWarnings: (v.warnings || []).concat((r.enginePlan && r.enginePlan.warnings) || []),
      note: v.kind === 'ACCESS'
        ? n + ' primeros con pase directo · ' + n + ' segundos' +
          (v.thirdsSlots ? ' y ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
          ' en ' + v.accessMatches + ' partidos de acceso · llave principal de ' + v.bracket + '.'
        : n + ' primeros, ' + n + ' segundos' +
          (v.thirdsSlots ? ' y ' + v.thirdsSlots + ' tercero' + (v.thirdsSlots === 1 ? '' : 's') : '') +
          ': llave directa de ' + v.bracket + ' sin pases directos.'
    });
  }
  const FORMAT_RULES = {};
  for (let g = 2; g <= (ENGINE ? ENGINE.MAX_GROUPS : 0); g++){
    const r = ruleFor(g);
    if (r) FORMAT_RULES[g] = r;
  }
  function recommendFormat(groupCount, sizes){
    const n = Number(groupCount);
    const r = (sizes && sizes.length === n) ? ruleFor(n, sizes) : FORMAT_RULES[n];
    if (!r) return null;
    return Object.assign({ groupCount:n, systemSource:'ENGINE',
      drawMethod:'PHYSICAL_THREE_POTS_AND_POSITION_BOX', sameGroupRematchBlocked:true }, r);
  }

  // ── Advertencias locales (mismas familias que bracket_config_warnings) ──
  function warnings(cfg){
    const out = [];
    if (!cfg || !cfg.slots) return out;
    // Llave dibujada a mano: manda la validación del grafo del lienzo.
    if (isFreeCfg(cfg) && CANVAS()){
      CANVAS().validate(cfg).forEach(x =>
        out.push({ code: x.code, detail: x.node || 'canvas', msg: x.msg, level: x.level }));
      return out;
    }
    const plan = TOPO ? TOPO.buildPlan(cfg.format) : null;
    (plan ? plan.warnings : []).forEach(msg =>
      out.push({ code:'FORMAT_STRUCTURE', detail:'format', msg }));
    const live = plan ? plan.slotIds.filter(id => cfg.slots[id] && cfg.slots[id].visible !== false) : Object.keys(cfg.slots);
    const seen = {};
    const empties = [];
    let filled = 0;
    // Tarjetas alimentadas por una conexión habilitada: están vacías por diseño
    // hasta que se juegue la ronda anterior, no son observación.
    const fed = {};
    (cfg.connections || []).forEach(c => {
      if (c && c.toSlot && c.enabled !== false) fed[c.toSlot] = true;
    });
    live.forEach(id => {
      const s = cfg.slots[id];
      if (!s) return;
      const a = s.participantA || {}, b = s.participantB || {};
      if ((a.mode || 'EMPTY') !== 'EMPTY' || (b.mode || 'EMPTY') !== 'EMPTY') filled++;
      if (a.groupId && a.groupId === b.groupId)
        out.push({ code:'SAME_GROUP_PAIRING', detail:id, msg:'«' + (SLOT_LABEL[id] || id) + '»: ambos participantes vienen del grupo ' + (a.groupLabel || a.groupId) + '.' });
      ['participantA','participantB'].forEach(side => {
        const rid = s[side] && s[side].registrationId;
        if (!rid) return;
        const k = (s.roundId || '?') + '|' + rid;
        if (seen[k]) out.push({ code:'PARTICIPANT_TWICE_IN_ROUND', detail: seen[k] + ' / ' + id,
          msg:'«' + (s[side].displayName || rid) + '» aparece dos veces en la misma ronda (' + (SLOT_LABEL[seen[k]] || seen[k]) + ' y ' + (SLOT_LABEL[id] || id) + ').' });
        else seen[k] = id;
      });
      if ((s.slotType || 'MATCH') === 'MATCH' && (a.mode || 'EMPTY') === 'EMPTY' && (b.mode || 'EMPTY') === 'EMPTY' && !fed[id])
        empties.push(id);
      if ((s.manualScoreA != null || s.manualScoreB != null) && !s.manualWinnerSlot && !s.officialMatchId)
        out.push({ code:'SCORE_WITHOUT_WINNER', detail:id, msg:'«' + (SLOT_LABEL[id] || id) + '» tiene marcador manual sin ganador.' });
    });
    // El cuadro recién armado está vacío por definición: una sola advertencia
    // en vez de una por tarjeta.
    if (empties.length && !filled)
      out.push({ code:'BRACKET_NOT_DRAWN', detail:'slots',
        msg:'El cuadro tiene ' + empties.length + ' tarjetas vacías: aún no se captura ningún emparejamiento del sorteo.' });
    else if (empties.length)
      out.push({ code:'EMPTY_VISIBLE_SLOT', detail: empties.join(','),
        msg: empties.length + ' tarjeta(s) visibles siguen vacías: ' +
          empties.slice(0, 5).map(id => '«' + (SLOT_LABEL[id] || id) + '»').join(', ') +
          (empties.length > 5 ? ' y ' + (empties.length - 5) + ' más.' : '.') });
    const mids = {};
    Object.keys(cfg.slots).forEach(id => {
      const s = cfg.slots[id];
      if (!s || s.visible === false || !s.officialMatchId) return;
      if (mids[s.officialMatchId]) out.push({ code:'DUPLICATE_OFFICIAL_MATCH', detail:id,
        msg:'El mismo partido oficial está vinculado en dos tarjetas visibles.' });
      else mids[s.officialMatchId] = id;
    });
    const f = cfg.format || {};
    if (f.hasAccessRound && !Number(f.accessMatchCount))
      out.push({ code:'ACCESS_ROUND_WITHOUT_MATCHES', detail:'format', msg:'El formato declara ronda de acceso pero 0 partidos de acceso.' });
    if (!f.groupCount)
      out.push({ code:'SYSTEM_NOT_DECLARED', detail:'format',
        msg:'Todavía no se declara cuántos grupos hay: el sistema del cuadro está puesto a mano y puede no coincidir con el reglamento.' });
    return out;
  }

  // Resumen para el diálogo de publicación
  function summary(cfg){
    const s = (cfg && cfg.slots) || {};
    if (isFreeCfg(cfg) && CANVAS()){
      const st = CANVAS().stats(cfg);
      return { visibleSlots: st.nodes, linkedMatches: Object.keys(s).filter(k => s[k].officialMatchId).length,
        manualCards: st.nodes, directPasses: st.byes, accessMatches: 0,
        system: 'LLAVE DIBUJADA A MANO (LIENZO LIBRE)', bracketSize: null,
        totalMatches: st.nodes - st.byes, edges: st.edges, freeSpots: st.free };
    }
    const plan = TOPO ? TOPO.buildPlan(cfg && cfg.format) : null;
    let visible = 0, linked = 0, manual = 0, direct = 0, access = 0;
    Object.keys(s).forEach(id => {
      const sl = s[id];
      if (!sl || sl.visible === false) return;
      visible++;
      if (sl.officialMatchId) linked++; else manual++;
      if ((sl.slotType || 'MATCH') === 'DIRECT_PASS') direct++;
      if ((sl.roundId || '') === 'access') access++;
    });
    return { visibleSlots: visible, linkedMatches: linked, manualCards: manual,
      directPasses: plan ? plan.directPasses : direct, accessMatches: plan ? plan.accessMatches : access,
      system: plan ? plan.systemLabel : '—', bracketSize: plan ? plan.bracketSize : null,
      totalMatches: plan ? plan.totalMatches : null };
  }

  // ── Resolución edición/categoría (siempre Number, nunca índices) ──
  const edcatCache = {};
  async function resolveEdcatId(catKey){
    if (edcatCache[catKey] != null) return edcatCache[catKey];
    if (!global.SB_CATALOG) return null;
    try {
      const edition = await global.SB_CATALOG.getActiveEdition();
      const edcats = await global.SB_CATALOG.getEditionCategories(edition.id);
      edcats.forEach(c => {
        const key = Object.keys(KEY_TO_CODE).find(k => KEY_TO_CODE[k] === c.code);
        if (key) edcatCache[key] = Number(c.id);
      });
      return edcatCache[catKey] != null ? edcatCache[catKey] : null;
    } catch(e){ return null; }
  }

  // ── Lectura pública ──────────────────────────────────────────────────────
  // Devuelve { published, publishedRevision, publishedAt, config } SIEMPRE.
  // Acepta la forma nueva (objeto envoltorio) y la de FASE 1 (config directa).
  const pubCache = {};
  const NOT_PUBLISHED = { published:false, publishedRevision:null, publishedAt:null, config:null, rpcMissing:false };
  async function getPublicState(edcatId){
    const id = Number(edcatId);
    if (!Number.isFinite(id)) return NOT_PUBLISHED;
    if (pubCache[id] !== undefined) return pubCache[id];
    let state = NOT_PUBLISHED;
    try {
      if (global.SB){
        const { data, error } = await global.SB.rpc('get_public_bracket_config', { p_edcat: id });
        if (error){
          state = Object.assign({}, NOT_PUBLISHED, { rpcMissing: /does not exist|Could not find the function|schema cache|PGRST202/i.test(error.message || '') });
        } else if (data && typeof data === 'object'){
          if (data.slots) state = { published:true, publishedRevision:null, publishedAt:null, config: migrate(data), rpcMissing:false };
          else if (data.published && data.config) state = { published:true, publishedRevision:data.publishedRevision || null, publishedAt:data.publishedAt || null, config: migrate(data.config), rpcMissing:false };
        }
      }
    } catch(e){ state = NOT_PUBLISHED; }
    pubCache[id] = state;
    return state;
  }
  async function getPublic(edcatId){ const st = await getPublicState(edcatId); return st.published ? st.config : null; }
  function invalidate(edcatId){
    if (edcatId == null) Object.keys(pubCache).forEach(k => delete pubCache[k]);
    else delete pubCache[Number(edcatId)];
  }

  // ── RPC administrativas ──────────────────────────────────────────────────
  // Se delega en SB_ADMIN_ACTIONS cuando está cargado (wrappers oficiales);
  // si no, llamada directa. Errores normalizados a códigos estables.
  function normalizeError(err){
    const msg = (err && (err.message || err.userMessage || String(err))) || 'ERROR';
    if (/RPC_MISSING|does not exist|Could not find the function|schema cache|PGRST202/i.test(msg)) return 'RPC_MISSING';
    if (/REVISION_CONFLICT/.test(msg)) return 'REVISION_CONFLICT';
    if (/UNAUTHORIZED|NOT_AUTHORIZED/.test(msg)) return 'UNAUTHORIZED';
    if (/EDCAT_NOT_FOUND/.test(msg)) return 'EDCAT_NOT_FOUND';
    if (/REASON_REQUIRED/.test(msg)) return 'REASON_REQUIRED';
    if (/NO_PUBLISHED/.test(msg)) return 'NO_PUBLISHED';
    if (/NO_DRAFT/.test(msg)) return 'NO_DRAFT';
    if (/OFFICIAL_MATCH_NOT_FOUND/.test(msg)) return 'OFFICIAL_MATCH_NOT_FOUND';
    if (/VALIDATION_WARNING/.test(msg)) return 'VALIDATION_WARNING:' + msg.replace(/^.*VALIDATION_WARNING:?/, '');
    if (/INVALID_CONFIG/.test(msg)) return 'INVALID_CONFIG' + (msg.split('INVALID_CONFIG')[1] || '');
    return msg;
  }
  async function rpc(name, params){
    try {
      const A = global.SB_ADMIN_ACTIONS;
      if (A && typeof A.bracketRpc === 'function') return { data: await A.bracketRpc(name, params) };
      if (!global.SB) return { error:'SUPABASE_NOT_CONFIGURED' };
      const { data, error } = await global.SB.rpc(name, params);
      if (error) return { error: normalizeError(error) };
      return { data };
    } catch(e){ return { error: normalizeError(e) }; }
  }
  async function adminGet(edcatId){
    const r = await rpc('admin_get_bracket_config', { p_edcat: Number(edcatId) });
    if (r.error) return r;
    if (r.data && r.data.draft_config) r.data.draft_config = migrate(r.data.draft_config);
    if (r.data && r.data.published_config) r.data.published_config = migrate(r.data.published_config);
    return r;
  }
  function stripRuntime(cfg){
    const c = clone(cfg);
    if (c.slots) Object.keys(c.slots).forEach(k => { delete c.slots[k].official; });
    delete c.layout;                        // se recalcula desde layoutKey
    c.layout = c.layoutKey || 'MIRRORED_8_DIRECT';
    return c;
  }
  async function saveDraft(edcatId, config, expectedRevision, reason){
    const r = await rpc('admin_save_bracket_draft',
      { p_edcat: Number(edcatId), p_config: stripRuntime(config), p_expected_revision: expectedRevision, p_reason: reason || null });
    if (!r.error) invalidate(edcatId);
    return r;
  }
  async function publish(edcatId, expectedRevision, reason, ackWarnings){
    const r = await rpc('admin_publish_bracket',
      { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason || null, p_ack_warnings: !!ackWarnings });
    if (!r.error) invalidate(edcatId);
    return r;
  }
  // ── Publicación que además materializa los partidos oficiales ──────────
  // `bracket_publish_plan` es SOLO LECTURA: dice qué se crearía/actualizaría.
  // Si la RPC no existe todavía, se devuelve { missing:true } y la UI publica
  // solo la configuración (comportamiento anterior).
  async function publishPlan(edcatId){
    const r = await rpc('bracket_publish_plan', { p_edcat: Number(edcatId), p_config: null });
    if (r.error) return { missing: /RPC_MISSING|does not exist|schema cache|PGRST202/i.test(String(r.error)), error: r.error };
    return { plan: r.data };
  }
  async function publishWithMatches(edcatId, expectedRevision, reason, ackWarnings, ackResults){
    const r = await rpc('admin_publish_bracket_matches',
      { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason || null,
        p_ack_warnings: !!ackWarnings, p_ack_results: !!ackResults });
    if (!r.error) invalidate(edcatId);
    return r;
  }
  async function restorePublished(edcatId, expectedRevision, reason){
    return rpc('admin_restore_bracket_from_published',
      { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason || null });
  }
  async function resetDraft(edcatId, expectedRevision, reason){
    return rpc('admin_reset_bracket_draft',
      { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason || null });
  }

  // ── Participantes reales de la categoría (vista pública, con grupo) ──
  const groupLabels = {};
  async function loadGroupLabels(edcatId){
    const id = Number(edcatId);
    if (groupLabels[id]) return groupLabels[id];
    const map = {};
    try {
      const { data } = await global.SB.from('v_public_groups_results')
        .select('group_id, group_label').eq('edition_category_id', id);
      (data || []).forEach(r => { map[r.group_id] = r.group_label; });
    } catch(e){}
    groupLabels[id] = map;
    return map;
  }
  async function searchParticipants(edcatId, query){
    try {
      const id = Number(edcatId);
      const labels = await loadGroupLabels(id);
      let q = global.SB.from('v_public_group_members')
        .select('registration_id, nickname, faculty_code, career_code, group_id')
        .eq('edition_category_id', id).limit(20);
      if (query) q = q.ilike('nickname', '%' + query + '%');
      const { data, error } = await q;
      if (error) return [];
      const seen = new Set();
      return (data || []).filter(r => { if (seen.has(r.registration_id)) return false; seen.add(r.registration_id); return true; })
        .map(r => Object.assign({}, r, { group_label: labels[r.group_id] || null }));
    } catch(e){ return []; }
  }
  function participantFromRow(row, sourceLabel){
    return { mode:'REGISTRATION', registrationId: row.registration_id, playerId:null, publicCode:null,
      displayName: row.nickname || 'Participante', sourceLabel: sourceLabel || (row.group_label ? 'Grupo ' + row.group_label : null),
      groupId: row.group_id || null, groupLabel: row.group_label || null,
      facultyLogo: row.faculty_code || null, careerLogo: row.career_code || null };
  }
  function placeholder(text, sourceLabel){
    return Object.assign(emptyParticipant(), { mode:'PLACEHOLDER', displayName: text || 'Por definir', sourceLabel: sourceLabel || null });
  }

  const api = { CORE_SLOTS, ACCESS_SLOTS, ALL_SLOTS, SLOT_IDS: CORE_SLOTS, LAYOUT_KEYS, STATUSES, MODES,
    KEY_TO_CODE, SLOT_LABEL, POSITION_TO_SLOT, ROUND_OF_SLOT, DEFAULT_CONNECTIONS, FORMAT_RULES, TOPO,
    isFree: isFreeCfg,
    emptyConfig, emptySlot, emptyParticipant, defaultFormat, migrate, slotView, derivedWinner, applySystem,
    buildPlan: f => TOPO && TOPO.buildPlan(f),
    recommendFormat, warnings, summary, resolveEdcatId, getPublic, getPublicState, invalidate,
    adminGet, saveDraft, publish, publishPlan, publishWithMatches, restorePublished, resetDraft, stripRuntime,
    searchParticipants, participantFromRow, placeholder, normalizeError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_BRACKETCFG = api;
})(typeof window !== 'undefined' ? window : globalThis);
