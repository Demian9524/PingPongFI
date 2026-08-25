// ── Cálculo de categoría provisional ───────────────────────────────────
// Cascada de condiciones (NO es una suma de puntos). Orden de prioridad:
//   1. Representativo            → AVANZADO (regla dura, no negociable)
//   2. Entrenamiento formal ≥1 mes → AVANZADO (regla dura, no negociable)
//   3. Cascada de experiencia / frecuencia / técnicas
//      · Saque con efecto (SERVE) ya NO manda solo a Avanzados: es un PISO
//        de INTERMEDIO (nunca Principiante). Sube a Avanzados solo si se
//        acompaña de otra señal fuerte (3+ técnicas, topspin, peloteo 16+,
//        frecuencia alta, +1 año, entrenamiento o representativo).
//      · Umbral por técnicas puras: 3+ → Avanzado, 2 → Intermedio.
//   4. Overrides por historial del torneo pasado (solo pueden SUBIR)
//   5. Banderas de revisión (nunca bajan la categoría)
//
// El peloteo (rallyLength) NO puntúa: solo genera banderas de revisión y
// texto explicativo. Ver docs/DIAGNOSTICO_CLASIFICACION_ACTUAL.md.
//
// Solo existen tres categorías: PRINCIPIANTE, INTERMEDIO y AVANZADO_OPEN.
// NO hay Novato / BEGINNER: todo nivel inicial es PRINCIPIANTE.
//
// Devuelve { score, category, requiresManualReview, woodPaddle,
//            reasons, flags, techCount }

(function(){
  const CFG = window.REGISTRO_CONFIG;
  const ORDER = ['PRINCIPIANTE','INTERMEDIO','AVANZADO_OPEN'];
  // Datos históricos: se leen, se muestran como la categoría vigente y nunca
  // se vuelven a generar.
  const LEGACY_CATEGORY = { BEGINNER:'PRINCIPIANTE', NOVATO:'PRINCIPIANTE', NOVATOS:'PRINCIPIANTE',
                            ABSOLUTE_BEGINNER:'PRINCIPIANTE', AVANZADO:'AVANZADO_OPEN', AVANZADOS:'AVANZADO_OPEN' };
  function normalizeCategory(v){
    const k = String(v || '').toUpperCase();
    return LEGACY_CATEGORY[k] || k;
  }

  // Técnicas que cuentan para la cascada (rango 0–4, igual que antes).
  // RALLY es informativa: describe consistencia, no una técnica.
  const COUNTED_TECHNIQUES = ['SERVE','CHOP','ATTACK','TOPSPIN'];
  // Borradores viejos: BACKSPIN y CHOP eran la misma habilidad duplicada.
  const LEGACY_TECHNIQUE = { BACKSPIN:'CHOP', SMASH:'ATTACK' };
  // Borradores viejos: nombres internos de experiencia que mentían.
  const LEGACY_EXPERIENCE = { NUNCA:'EXP_NONE', LT6M:'EXP_LT6M', M6_2Y:'EXP_6M_1Y', GT2Y:'EXP_GT1Y' };

  function normalizeTechniques(list){
    const out = [];
    (Array.isArray(list) ? list : []).forEach(t => {
      if (!t || t === 'NONE') return;
      const v = LEGACY_TECHNIQUE[t] || t;
      if (!out.includes(v)) out.push(v);
    });
    return out;
  }
  function normalizeExperience(v){
    if (!v) return '';
    return LEGACY_EXPERIENCE[v] || v;
  }
  function atLeast(cur, min){
    return ORDER.indexOf(cur) >= ORDER.indexOf(min) ? cur : min;
  }

  function computeProvisional(state){
    const s = state || {};
    const exp   = normalizeExperience(s.playingExperience || s.experience);
    const freq  = s.frequency || '';
    const rally = s.rallyLength || '';
    const techniques = normalizeTechniques(s.techniques);
    const tech = techniques.filter(t => COUNTED_TECHNIQUES.includes(t)).length;

    const reasons = [];
    const flags = [];
    let manualReview = false;
    let woodPaddle = false;
    let category;

    const flag = (code, label) => { manualReview = true; flags.push({ code, label }); };

    // ── REGLAS DURAS (prioridad sobre cualquier otra señal) ──────────────
    if (s.representative === true){
      category = 'AVANZADO_OPEN';
      woodPaddle = true;
      reasons.push('Perteneces o entrenas con el representativo de tenis de mesa.');
      flag('REPRESENTATIVE', 'Representativo: juega en Avanzados con pala de madera para emparejar.');
    }
    else if (s.privateTraining === 'GE1M' || s.privateTraining === 'LT1M'){
      category = 'AVANZADO_OPEN';
      reasons.push('Ha ido a entrenar de forma particular (con profesor o coach), sin importar cuánto tiempo.');
      flag('PRIVATE_TRAINING', 'Declaró entrenamiento particular' + (s.privateTraining === 'GE1M' ? ' de un mes o más.' : ' (menos de un mes).'));
    }
    else if (techniques.includes('TOPSPIN')){
      category = 'AVANZADO_OPEN';
      reasons.push('Declaró que sabe hacer topspin.');
    }
    else if (rally === 'R16P'){
      category = 'AVANZADO_OPEN';
      reasons.push('Sostiene peloteos de 16 golpes o más.');
    }
    else if (freq === 'FREQUENT'){
      category = 'AVANZADO_OPEN';
      reasons.push('Juega 3 o más veces por semana.');
    }
    else if (exp === 'EXP_GT1Y'){
      category = 'AVANZADO_OPEN';
      reasons.push('Tiene más de un año jugando.');
    }
    // ── CASCADA (para el resto, que no disparó ninguna regla dura) ──────
    else if (tech >= 3){
      category = 'AVANZADO_OPEN';
      reasons.push('Tres o más recursos técnicos declarados.');
    }
    else if (((exp === 'EXP_6M_1Y' || exp === 'EXP_GT1Y') && tech >= 1) || tech >= 2 ||
             ((freq === 'WEEKLY' || freq === 'FREQUENT') && tech >= 1) || exp === 'EXP_GT1Y'){
      category = 'INTERMEDIO';
      reasons.push('Experiencia y recursos técnicos compatibles con Intermedio.');
    }
    else {
      category = 'PRINCIPIANTE';
      reasons.push((exp === 'EXP_NONE' && tech === 0)
        ? 'Sin experiencia previa ni técnicas declaradas.'
        : 'Poca experiencia o pocos recursos técnicos declarados.');
    }

    // ── PISO POR SAQUE CON EFECTO (sube a Intermedio, nunca a Principiante) ──
    if (techniques.includes('SERVE') && category === 'PRINCIPIANTE'){
      category = 'INTERMEDIO';
      reasons.push('Declaró que sabe sacar con efecto: mínimo Intermedio.');
      flag('SERVE_FLOOR', 'Saque con efecto con perfil de Principiante: se sube a Intermedio para revisión.');
    }

    // Peloteo: explica, no puntúa.
    if (rally === 'R16P') reasons.push('Puedes mantener peloteos largos (16 golpes o más).');
    else if (rally === 'R8_15') reasons.push('Mantienes peloteos de 8 a 15 golpes.');
    else if (rally === 'R0_3') reasons.push('El peloteo todavía se corta rápido (0 a 3 golpes).');

    // ── OVERRIDES POR HISTORIAL (solo suben) ────────────────────────────
    if (s.participatedPreviously && s.previousTournament){
      const cat = normalizeCategory(s.previousTournament.category);
      const res = (s.previousTournament.result || '').toUpperCase();

      // Piso: si avanzó al menos de fase de grupos (no solo se inscribió),
      // no baja de la categoría que ya jugó. Solo sube, nunca baja la cascada.
      const FLOOR_RESULTS = ['GROUP_PASS','REPECHAGE','R16','QF','SEMIFINAL','FINALIST','CHAMPION'];
      if (ORDER.includes(cat) && FLOOR_RESULTS.includes(res)){
        const before = category;
        category = atLeast(category, cat);
        if (before !== category) reasons.push(`Jugó ${cat.replace('_OPEN','')} el torneo pasado y avanzó de fase de grupos: se mantiene ahí como piso.`);
      }

      if (cat === 'PRINCIPIANTE' && res === 'CHAMPION'){
        const before = category;
        category = atLeast(category, 'INTERMEDIO');
        if (before !== category) reasons.push('Fuiste campeón de Principiantes el torneo pasado: subes a mínimo Intermedio.');
      }
      if (cat === 'INTERMEDIO' && res === 'CHAMPION'){
        const before = category;
        category = atLeast(category, 'AVANZADO_OPEN');
        if (before !== category) reasons.push('Fuiste campeón de Intermedios el torneo pasado: subes a mínimo Avanzado / Open.');
      }
      if (cat === 'AVANZADO_OPEN' && res === 'CHAMPION'){
        flag('PREV_ADVANCED_CHAMPION', 'Campeón de Avanzados en la edición anterior.');
      }
      if ((res === 'FINALIST' || res === 'SEMIFINAL') &&
          ORDER.indexOf(cat) >= 0 && ORDER.indexOf(cat) >= ORDER.indexOf(category)){
        flag('PREV_DEEP_RUN', 'Llegó lejos en una categoría igual o superior el torneo pasado.');
      }
      // Nadie con historial conocido entra sin que la organización lo mire.
      const deep = ['CHAMPION','FINALIST','SEMIFINAL','QF'].includes(res);
      if (category === 'PRINCIPIANTE' && deep){
        flag('PREV_HISTORY_VS_PRINCIPIANTE', 'Historial anterior destacado con categoría sugerida Principiante.');
      }
      flag('PREV_EDITION', 'Jugó una edición anterior: verificar historial vinculado.');
    }

    // ── BANDERAS DE REVISIÓN (nunca bajan la categoría) ──────────────────
    if (rally === 'UNSURE'){
      flag('UNSURE_RALLY', 'Respondió "No estoy seguro" en la pregunta de peloteo.');
    }
    if ((freq === 'NUNCA' || exp === 'EXP_NONE') && (tech >= 2 || rally === 'R16P')){
      flag('CONTRADICTION_NO_PLAY', 'Dice no jugar (o no haber jugado nunca) pero declara técnicas o peloteo alto.');
    }
    if (rally === 'R0_3' && (techniques.includes('TOPSPIN') || techniques.includes('ATTACK'))){
      flag('CONTRADICTION_RALLY_TECH', 'Peloteo de 0 a 3 golpes pero declara topspin o ataque.');
    }
    if (s.privateTraining === 'GE1M' && exp === 'EXP_NONE' && tech === 0){
      flag('CONTRADICTION_TRAINING', 'Declara entrenamiento formal pero el resto de respuestas no lo respalda.');
    }
    if (category === 'PRINCIPIANTE' && (tech === 1 || rally === 'R8_15' || rally === 'R16P')){
      flag('BORDERLINE_UP', 'Cerca del límite entre Principiante e Intermedio.');
    }
    if (category === 'INTERMEDIO' && techniques.includes('SERVE') && tech >= 2){
      flag('SERVE_BORDERLINE', 'Sabe sacar con efecto y declara 2+ técnicas: revisar si corresponde Avanzado / Open.');
    }
    if (category === 'INTERMEDIO' && tech >= 3){
      flag('BORDERLINE_UP', 'Cerca del límite entre Intermedio y Avanzado / Open.');
    }

    return {
      score: 0,
      category,
      requiresManualReview: manualReview,
      woodPaddle,
      reasons,
      flags,
      techCount: tech,
      techniques
    };
  }

  function categoryLabel(id){
    const c = CFG.categories.find(c => c.id === normalizeCategory(id));
    return c ? c.label : id;
  }
  function categoryColor(id){
    const c = CFG.categories.find(c => c.id === normalizeCategory(id));
    return c ? c.color : '#c8c9d0';
  }

  window.REGISTRO_SCORING = {
    computeProvisional, categoryLabel, categoryColor, normalizeCategory,
    normalizeExperience, normalizeTechniques, COUNTED_TECHNIQUES
  };
})();
