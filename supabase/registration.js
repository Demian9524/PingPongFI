// ── Servicio de preinscripción → RPC preinscribir(payload jsonb) ────────
// Idempotencia:
//   localStorage 'fi_pp_submission_v2' = {
//     submissionId, fingerprint, createdAt, lastAttemptAt,
//     status: 'pending'|'done', folio?
//   }
//   * mismo formulario (tel/apodo/categoría) → mismo submission_id,
//     incluso tras recarga o error de red;
//   * cambio sustancial → nuevo submission_id;
//   * éxito → status 'done' + folio (para la pantalla de recuperación);
//   * NUNCA se genera un UUID nuevo tras un timeout ambiguo.
//
// Nunca insertar directo en players/registrations/payments/etc.

(function(){
  'use strict';
  const SUB_KEY = 'fi_pp_submission_v2';
  const V = () => window.SB_VALIDATE;

  function readRec(){
    try { return JSON.parse(localStorage.getItem(SUB_KEY)) || null; } catch(_){ return null; }
  }
  function writeRec(rec){
    try { localStorage.setItem(SUB_KEY, JSON.stringify(rec)); } catch(_){}
  }
  function uuid(){
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0; return (c === 'x' ? r : (r&0x3|0x8)).toString(16);
    });
  }

  // huella estable: teléfono + apodo normalizados + categoría de edición
  function fpOf(state, editionCategoryId){
    return V().fingerprint({
      phone: state.phone, nickname: state.displayName, editionCategoryId
    });
  }

  function getSubmissionId(state, editionCategoryId){
    const fp = fpOf(state, editionCategoryId);
    const rec = readRec();
    if (rec && rec.submissionId && rec.fingerprint === fp){
      // Mientras el usuario no pulse «Entendido», incluso un envío ya marcado
      // como done reutiliza el mismo UUID. Así una recarga o un segundo clic no
      // puede crear otra inscripción con los mismos datos.
      rec.lastAttemptAt = new Date().toISOString();
      writeRec(rec);
      return rec.submissionId;
    }
    const now = new Date().toISOString();
    const fresh = { submissionId: uuid(), fingerprint: fp, createdAt: now, lastAttemptAt: now, status: 'pending' };
    writeRec(fresh);
    return fresh.submissionId;
  }
  function markDone(folio){
    const rec = readRec();
    if (rec){ rec.status = 'done'; rec.folio = folio || null; rec.lastAttemptAt = new Date().toISOString(); writeRec(rec); }
  }
  function getRecord(){ return readRec(); }
  function clearSubmissionId(){
    try { localStorage.removeItem(SUB_KEY); } catch(_){}
  }

  // categorías del formulario → códigos del catálogo
  // Solo tres categorías vigentes. BEGINNER/NOVATO son únicamente ALIAS DE
  // LECTURA histórica hacia PRINCIPIANTE: jamás se emiten hacia el backend.
  const CAT_MAP = { BEGINNER:'PRINCIPIANTE', NOVATO:'PRINCIPIANTE', PRINCIPIANTE:'PRINCIPIANTE',
                    INTERMEDIO:'INTERMEDIO', AVANZADO:'AVANZADO_OPEN', AVANZADO_OPEN:'AVANZADO_OPEN' };

  // ctx = { edition, edcats, facultyId, careerId, provCategoryId }
  function buildPayload(state, sc, ctx){
    const provCode = CAT_MAP[String(sc.category || '').toUpperCase()];
    if (!provCode){
      const e = new Error('CATEGORY_NOT_FOUND:' + (sc.category || '(vacía)'));
      e.friendly = 'No se pudo determinar tu categoría. Avisa a la organización.';
      throw e;
    }
    // NUNCA elegir «la primera categoría»: si el catálogo de la edición no tiene
    // exactamente la categoría calculada, se aborta el envío.
    const edcat = (ctx.edcats || []).find(c => c.code === provCode);
    if (!edcat){
      const e = new Error('CATEGORY_NOT_FOUND:' + provCode);
      e.friendly = 'La categoría ' + provCode + ' no está abierta en esta edición. Avisa a la organización.';
      throw e;
    }
    const edcatId = edcat.id;

    const payload = {
      submission_id: getSubmissionId(state, edcatId),
      edition_id: ctx.edition.id,
      edition_category_id: edcatId,
      category_prov_id: ctx.provCategoryId || edcat.category_id,
      nickname: V().sanitizeText(state.displayName, 40),
      phone: state.phone,
      email: state.email || null,
      faculty_id: ctx.facultyId,
      career_id: ctx.careerId,
      academic_stage: null, // sin campo real de semestre/etapa en el formulario; facultad ya va en faculty_id/faculty_snapshot
      // Experiencia jugando. NUNCA usar time_playing: en el backend antiguo
      // ese campo se leía como fallback de disponibilidad/horarios.
      playing_experience_band: (window.REGISTRO_SCORING
        ? window.REGISTRO_SCORING.normalizeExperience(state.playingExperience || state.experience)
        : (state.playingExperience || null)) || null,
      play_frequency: state.frequency || null,
      rally_length_band: state.rallyLength || null,
      private_training: state.privateTraining || null,
      techniques: (window.REGISTRO_SCORING
        ? window.REGISTRO_SCORING.normalizeTechniques(state.techniques)
        : (state.techniques || [])),
      self_level: sc.category || null,
      tournament_experience: state.previousTournament ? (state.previousTournament.result || null) : null,
      participated_previously: !!state.participatedPreviously,
      prev_result: state.previousTournament ? (state.previousTournament.result || null) : null,
      prev_category: state.previousTournament ? (state.previousTournament.category || null) : null,
      prev_nickname: state.previousTournament ? (V().sanitizeText(state.previousTournament.nickname || '', 60) || null) : null,
      representative: state.representative === true,
      club_or_representative: state.representative === true ? 'YES' : 'NO',
      play_style_notes: V().sanitizeText((sc.reasons || []).join(' · '), 400) || null,
      requires_review_hint: sc.requiresManualReview === true,
      review_flags: (sc.flags || [])
        .map(f => typeof f === 'string' ? f : f && f.code)
        .filter(Boolean),
      consent_rules: true,           // obligatorios en el paso 3 (checkboxes required)
      consent_data: true,
      consent_public_contact: true
    };
    // El sorteo es presencial: NO se envía usual_shifts, general_availability,
    // willing_to_stay_late, availability_note, time_playing ni nada horario.
    // Los campos nuevos (playing_experience_band, rally_length_band,
    // private_training, techniques…) requieren la migración
    // sql/MIGRACION_ELIMINAR_HORARIOS.sql — ver BACKEND_RPC_PENDING.md.

    return payload;
  }

  async function submit(payload){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const t0 = performance.now();
    const { data, error } = await window.SB.rpc('preinscribir', { payload });
    if (window.SB_LOG) window.SB_LOG.op('REG', 'preinscribir', performance.now() - t0, !error);
    if (error) throw error;
    return data;
  }

  function translateError(err){
    const m = String((err && err.message) || err || '').toLowerCase();
    if (m.includes('category_not_found'))
      return 'La categoría calculada no está disponible en esta edición. Avisa a la organización.';
    if (!m || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'))
      return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo; tus datos siguen guardados.';
    if (m.includes('supabase_not_configured'))
      return 'El sitio no está conectado al servidor todavía. Avisa a la organización.';
    if (m.includes('edition_not_found') || (m.includes('edición') && m.includes('no existe')))
      return 'La edición del torneo no está configurada. Avisa a la organización.';
    if (m.includes('teléfono') || m.includes('telefono') || m.includes('phone'))
      return 'El teléfono no parece válido. Usa 10 dígitos de México.';
    if (m.includes('consent') || m.includes('aceptar el reglamento') || m.includes('consentim'))
      return 'Debes aceptar el reglamento y el aviso de datos para continuar.';
    if (m.includes('cerrad') || m.includes('no está abierta') || m.includes('registration_clos'))
      return 'Las inscripciones están cerradas en este momento.';
    if (m.includes('cupo') || m.includes('capacity') || m.includes('lleno'))
      return 'La categoría alcanzó su cupo. La organización revisará la lista de espera.';
    if (m.includes('ya existe') || m.includes('ya está inscrito') || m.includes('duplicad') || m.includes('duplicate'))
      return 'Ya existe una inscripción con estos datos en esta edición.';
    if (m.includes('nickname'))
      return 'Falta tu apodo o nombre para el torneo.';
    if (m.includes('categor'))
      return 'Hubo un problema con la categoría seleccionada. Avisa a la organización.';
    return 'No se pudo enviar la preinscripción. Intenta de nuevo en unos minutos; tus datos siguen guardados.';
  }

  window.SB_REGISTRO = {
    getSubmissionId, clearSubmissionId, markDone, getRecord,
    buildPayload, submit, translateError
  };
})();
