// ── Adaptador de acciones administrativas (backend v3) ──────────────────
// Todas las acciones de escritura usan RPC administrativas reales del
// backend v3 (validan is_organizer() en el servidor). Nunca se escribe
// directo a una tabla desde el frontend.

(function(){
  'use strict';

  async function call(rpcName, params, logTag){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const t0 = performance.now();
    const { data, error } = await window.SB.rpc(rpcName, params);
    if (window.SB_LOG) window.SB_LOG.op(logTag || 'ADM-ACT', rpcName, performance.now() - t0, !error);
    if (error){
      if (error.code === 'PGRST202' || /function .* does not exist/i.test(error.message || '')){
        const e = new Error('RPC_MISSING:' + rpcName);
        e.rpc = rpcName; e.userMessage = 'Esta función todavía no está disponible en el backend.';
        throw e;
      }
      throw error;
    }
    return data;
  }

  // Errores estables que el frontend puede ramificar sin leer texto libre.
  const BRACKET_ERRORS = ['UNAUTHORIZED','EDCAT_NOT_FOUND','INVALID_CONFIG','REVISION_CONFLICT',
    'REASON_REQUIRED','NO_DRAFT','NO_PUBLISHED','OFFICIAL_MATCH_NOT_FOUND','VALIDATION_WARNING'];

  window.SB_ADMIN_ACTIONS = {
    available: true,
    BRACKET_ERRORS,

    // ── Bracket configurable (NUNCA toca public.matches) ────────────────
    // Fuente SQL: sql/PROPUESTA_bracket_config_publicacion.sql
    bracketRpc: (name, params) => call(name, params, 'BKT-CFG'),
    getAdminBracketConfig: (edcatId) =>
      call('admin_get_bracket_config', { p_edcat: Number(edcatId) }, 'BKT-GET'),
    saveBracketDraft: (edcatId, config, expectedRevision, reason) =>
      call('admin_save_bracket_draft', { p_edcat: Number(edcatId), p_config: config, p_expected_revision: expectedRevision, p_reason: reason }, 'BKT-SAVE'),
    publishBracket: (edcatId, expectedRevision, reason, ackWarnings) =>
      call('admin_publish_bracket', { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason, p_ack_warnings: !!ackWarnings }, 'BKT-PUB'),
    restoreBracketPublished: (edcatId, expectedRevision, reason) =>
      call('admin_restore_bracket_from_published', { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason }, 'BKT-RESTORE'),
    resetBracketDraft: (edcatId, expectedRevision, reason) =>
      call('admin_reset_bracket_draft', { p_edcat: Number(edcatId), p_expected_revision: expectedRevision, p_reason: reason }, 'BKT-RESET'),
    getPublicBracketConfig: (edcatId) =>
      call('get_public_bracket_config', { p_edcat: Number(edcatId) }, 'BKT-PUBGET'),

    // inscripciones / pagos
    confirmRegistration: (registrationId, reason) =>
      call('confirm_registration', { p_registration: registrationId, p_reason: reason || null }),
    confirmPayment: (registrationId, amountCents, method, reference, waived) =>
      call('confirm_payment', { p_registration: registrationId, p_amount_cents: amountCents ?? null, p_method: method || null, p_reference: reference || null, p_waived: !!waived }),
    cancelRegistration: (registrationId, reason) =>
      call('cancel_registration', { p_registration: registrationId, p_reason: reason || null }),
    deleteRegistration: (registrationId, reason) =>
      call('admin_delete_registration', { p_registration: registrationId, p_reason: reason || null }),

    // Visibilidad del teléfono/WhatsApp en el perfil y directorio públicos.
    // Es por inscripción/edición, requiere motivo y queda en audit_log.
    setPublicContact: (registrationId, enabled, reason) =>
      call('admin_set_public_contact', {
        p_registration_id: registrationId,
        p_enabled: !!enabled,
        p_reason: reason
      }, 'CONTACT-PUBLIC'),

    // Sorteo aleatorio de grupos y disponibilidad: ELIMINADOS. El sorteo es
    // 100% presencial y se captura en TableroGrupos. Las RPC
    // preview_random_group_draw, create_random_group_draw,
    // draw_compatibility_report y admin_update_general_availability se retiran
    // en sql/MIGRACION_ELIMINAR_HORARIOS.sql; no invocarlas.

    // grupos tardíos y partidos
    createLateGroup: (edcatId, registrationIds, qualRule) =>
      call('create_late_group', { p_edcat: edcatId, p_regs: registrationIds, p_qual_rule: qualRule || null }),
    createGroupStageMatches: (edcatId) =>
      call('create_group_stage_matches', { p_edcat: edcatId }),

    // fase eliminatoria — siempre SETS; best_of 3 salvo semifinal/final (5)
    createEliminationRound: (edcatId, roundType, orderIndex) =>
      call('create_elimination_round', { p_edcat: edcatId, p_round_type: roundType, p_order_index: orderIndex }),

    // resultados — captura oficial (firma real instalada:
    // record_match_result(p_match uuid, p_score_a int, p_score_b int,
    //   p_score_unit text='SETS', p_raw_points_a int=null,
    //   p_raw_points_b int=null, p_result_source text='ORGANIZER_ENTRY'))
    recordMatchResult: (params) => call('record_match_result', params, 'MATCH-REC'),

    // resultados — administración de fase de grupos (RPC ya instaladas)
    clearGroupMatchResult: (matchId, reason) =>
      call('admin_clear_group_match_result', { p_match: matchId, p_reason: reason }, 'MATCH-CLEAR'),
    cancelGroupMatch: (matchId, reason) =>
      call('admin_cancel_group_match', { p_match: matchId, p_reason: reason }, 'MATCH-CANCEL'),
    restoreGroupMatch: (matchId, reason) =>
      call('admin_restore_group_match', { p_match: matchId, p_reason: reason }, 'MATCH-RESTORE'),
    resetGroupStage: (edcatId, confirmation, reason, deleteMatches) =>
      call('admin_reset_group_stage', { p_edcat: edcatId, p_confirmation: confirmation, p_reason: reason, p_delete_matches: !!deleteMatches }, 'GRP-RESET'),
    // eliminación total de un partido de grupos (requiere
    // sql/RPC_admin_delete_group_match.sql aplicado manualmente)
    deleteGroupMatch: ({ matchId, confirmation, reason }) =>
      call('admin_delete_group_match', { p_match: matchId, p_confirmation: confirmation, p_reason: reason }, 'MATCH-DEL'),

    // edición manual de perfil. La RPC instalada actualiza el snapshot de la
    // inscripción y players.current_nickname/current_faculty_id/current_career_id.
    // El teléfono global y las fusiones de identidad siguen siendo manuales.
    updateRegistrationProfile: (registrationId, nickname, phone, facultyId, careerId, organizerNotes) =>
      call('admin_update_registration_profile', {
        p_registration_id: registrationId, p_nickname: nickname, p_phone: phone,
        p_faculty_id: facultyId, p_career_id: careerId,
        p_organizer_notes: organizerNotes || null
      }),

    // fusión manual — nunca automática por teléfono; archivar el player de
    // origen es opcional y también manual (default false)
    searchPlayers: (query) => call('admin_search_players', { p_query: query }),

    // revisión de categoría — compartido entre ControlTorneo y Admin
    // (requiere sql/hotfix_category_review.sql aplicado manualmente)
    confirmRegistrationCategory: (registrationId, notes) =>
      call('admin_confirm_registration_category', { p_registration_id: registrationId, p_notes: notes || null }, 'CAT-CONFIRM'),
    changeRegistrationCategory: (registrationId, targetEdcatId, reason) =>
      call('admin_change_registration_category', { p_registration_id: registrationId, p_target_edition_category_id: targetEdcatId, p_reason: reason }, 'CAT-CHANGE'),
    linkRegistrationToPlayer: (registrationId, targetPlayerId, reason, archiveSourcePlayer) =>
      call('admin_link_registration_to_player', {
        p_registration_id: registrationId, p_target_player_id: targetPlayerId, p_reason: reason,
        p_archive_source_player: !!archiveSourcePlayer
      })
  };
})();
