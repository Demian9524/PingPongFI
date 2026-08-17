// ── supabase/participants.js — carga y enriquecimiento compartido ──────
// Une las dos únicas fuentes públicas reales de participantes:
//   * get_public_contact_directory(edition_id) — nickname, phone_normalized,
//     whatsapp_url, category_code/name, group_label, registration_status,
//     entry_status, registration_id, edition_category_id (confirmado en
//     sql/03_security_rls.sql).
//   * v_public_group_members — group_id, edition_category_id, registration_id,
//     nickname, faculty_code, career_code (RLS anon-safe).
// Unión por registration_id (clave real presente en ambas fuentes — no por
// apodo/teléfono). Enriquecido con nombres de facultad/carrera vía catalog.js.
// NO usa v_admin_registrations ni ninguna fuente que requiera is_organizer().
(function(global){
  'use strict';

  let cache = null; // { rows, byId, edition, edcats }
  const historicCache = new Map(); // editionId -> { rows, byId, edition, edcats }

  async function buildEnrichedDirectory(edition){
    const [dirRows, edcats] = await Promise.all([
      global.SB_DIRECTORY.fetchDirectory(edition.id),
      global.SB_CATALOG.getEditionCategories(edition.id)
    ]);

    let members = [];
    try { members = await global.SB_GROUPS.fetchMembers(edcats.map(c => c.id)); }
    catch(e){ members = []; }

    const memberByReg = new Map();
    members.forEach(m => { if (m.registration_id) memberByReg.set(m.registration_id, m); });

    let facByCode = new Map();
    try { (await global.SB_CATALOG.getFaculties()).forEach(f => facByCode.set(f.code, f)); }
    catch(e){ facByCode = new Map(); }

    const careerNameByKey = new Map();
    const facultyCodesWithCareer = [...new Set(members.filter(m => m.career_code && m.faculty_code).map(m => m.faculty_code))];
    await Promise.all(facultyCodesWithCareer.map(async code => {
      const fac = facByCode.get(code);
      if (!fac) return;
      try {
        const careers = await global.SB_CATALOG.getCareersByFaculty(fac.id);
        careers.forEach(c => careerNameByKey.set(code + '|' + c.code, c.name));
      } catch(e){ /* opcional */ }
    }));

    const rows = dirRows.map(r => {
      const m = memberByReg.get(r.registration_id) || null;
      const facCode = m ? m.faculty_code : null;
      const carCode = m ? m.career_code : null;
      return Object.assign({}, r, {
        group_id: m ? m.group_id : null,
        faculty_code: facCode,
        career_code: carCode,
        faculty_name: facCode ? (facByCode.get(facCode) ? facByCode.get(facCode).name : null) : null,
        career_name: carCode ? (careerNameByKey.get(facCode + '|' + carCode) || null) : null,
        _waUrl: global.SB_VALIDATE.safeWhatsappUrl(r.whatsapp_url)
      });
    });

    const byId = new Map(rows.map(r => [r.registration_id, r]));
    return { rows, byId, edition, edcats };
  }

  async function fetchEnrichedDirectory(force){
    if (cache && !force) return cache;
    if (!global.SB_READY) throw new Error('SUPABASE_NOT_CONFIGURED');
    const edition = await global.SB_CATALOG.getActiveEdition();
    cache = await buildEnrichedDirectory(edition);
    return cache;
  }

  // Directorio histórico: mismo esquema, para una edición pasada elegida por
  // el usuario. Sin WhatsApp visible en la UI que la consuma (contacto solo
  // para inscripción vigente); los datos siguen viniendo de las mismas
  // fuentes públicas.
  async function fetchEnrichedDirectoryForEdition(editionId, force){
    if (!global.SB_READY) throw new Error('SUPABASE_NOT_CONFIGURED');
    if (historicCache.has(editionId) && !force) return historicCache.get(editionId);
    const editions = await global.SB_CATALOG.getAllEditions();
    const edition = editions.find(e => e.id === editionId);
    if (!edition) throw new Error('EDITION_NOT_FOUND');
    const result = await buildEnrichedDirectory(edition);
    historicCache.set(editionId, result);
    return result;
  }

  // Estadísticas oficiales de un participante en su grupo actual, vía
  // get_group_standings(group_id) — única fuente deportiva autoritativa.
  // Devuelve null si no tiene grupo o el RPC no está disponible/visible.
  // ── roster académico histórico (todas las ediciones) ────────────────
  // Fuente ÚNICA: RPC get_public_academic_roster(kind, code) — ya deduplica
  // por jugador canónico (sigue merged_into_player_id igual que el perfil
  // público del jugador), resuelve facultad/carrera con la misma precedencia
  // que usa PerfilJugador.html (players.current_* → snapshot de la
  // inscripción CONFIRMED más reciente), y devuelve una fila por jugador
  // real sin importar si está o no inscrito en la edición vigente.
  const rosterCache = new Map(); // 'faculty|CODE' o 'career|CODE' -> rows
  async function fetchAcademicRoster(kind, code){
    const normalizedKind = String(kind || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!['faculty', 'career'].includes(normalizedKind) || !normalizedCode){
      throw new Error('ACADEMIC_ROSTER_INVALID_SCOPE');
    }
    const key = normalizedKind + '|' + normalizedCode;
    if (rosterCache.has(key)) return rosterCache.get(key);
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    try {
      const { data, error } = await global.SB.rpc('get_public_academic_roster', {
        p_kind: normalizedKind,
        p_code: normalizedCode
      });
      if (error) throw error;
      const rows = (data || []).map(r => ({
        registration_id: r.registration_id,
        player_id: r.player_id,
        nickname: r.nickname,
        faculty_code: r.faculty_code,
        faculty_name: r.faculty_name,
        career_code: r.career_code,
        career_name: r.career_name,
        category_code: r.category_code,
        category_name: r.category_name,
        last_edition_id: r.last_edition_id,
        last_edition_slug: r.last_edition_slug,
        last_edition_name: r.last_edition_name,
        is_current_edition: !!r.is_current_edition,
        group_id: r.group_id,
        group_label: r.group_label,
        total_count: Number(r.total_count || 0),
        _waUrl: global.SB_VALIDATE.safeWhatsappUrl(r.whatsapp_url),
        _hasPublicContact: !!r.has_public_contact
      }));
      const uniquePlayers = new Set(rows.map(r => r.player_id).filter(Boolean));
      if (uniquePlayers.size !== rows.length){
        throw new Error('ACADEMIC_ROSTER_DUPLICATE_PLAYER');
      }
      if (rows.length && rows.some(r => r.total_count !== rows.length)){
        throw new Error('ACADEMIC_ROSTER_COUNT_MISMATCH');
      }
      rosterCache.set(key, rows);
      return rows;
    } catch(e){
      global.SB_LOG && global.SB_LOG.error('PTP-HIST', e);
      if (isMissingFunctionError(e)){
        const missing = new Error('ACADEMIC_ROSTER_RPC_NOT_INSTALLED');
        missing.code = 'ACADEMIC_ROSTER_RPC_NOT_INSTALLED';
        missing.cause = e;
        throw missing;
      }
      throw e;
    }
  }

  async function fetchOwnStanding(registrationId, groupId){
    if (!groupId || !global.SB) return null;
    try {
      const { data, error } = await global.SB.rpc('get_group_standings', { p_group_id: groupId });
      if (error) throw error;
      const rows = data || [];
      const idx = rows.findIndex(s => s.registration_id === registrationId);
      if (idx === -1) return null;
      return { row: rows[idx], position: idx + 1, groupSize: rows.length, allRows: rows };
    } catch(e){
      console.warn('[participants] get_group_standings no disponible:', e && e.message);
      return null;
    }
  }

  // ── Player-centric (multi-edición) ──────────────────────────────────
  // Requiere las RPC de sql/PROPUESTA_public_player_profile_v2.sql. Si no
  // existen todavía en el servidor (PostgREST devuelve PGRST202 / 42883,
  // "no existe la función"), se devuelve null para que el frontend pueda
  // caer de vuelta al flujo antiguo por-inscripción en vez de romper.
  function isMissingFunctionError(err){
    if (!err) return false;
    const code = err.code || '';
    const msg = (err.message || '') + ' ' + (err.details || '');
    return code === 'PGRST202' || code === '42883' || /does not exist|no existe la funci/i.test(msg);
  }

  async function fetchPlayerRegistrations(ref){
    if (!global.SB) return null;
    try {
      const { data, error } = await global.SB.rpc('get_public_player_registrations', { p_ref: ref });
      if (error) throw error;
      return data || [];
    } catch(e){
      if (isMissingFunctionError(e)) return null;
      throw e;
    }
  }

  async function fetchPlayerStats(ref, editionId){
    if (!global.SB) return null;
    try {
      const { data, error } = await global.SB.rpc('get_public_player_stats', { p_ref: ref, p_edition_id: editionId ?? null });
      if (error) throw error;
      return (data && data[0]) || null;
    } catch(e){
      if (isMissingFunctionError(e)) return null;
      throw e;
    }
  }

  async function fetchPlayerMatches(ref, limit, editionId){
    if (!global.SB) return null;
    try {
      const { data, error } = await global.SB.rpc('get_public_player_matches', { p_ref: ref, p_limit: limit || 20, p_edition_id: editionId ?? null });
      if (error) throw error;
      return data || [];
    } catch(e){
      if (isMissingFunctionError(e)) return null;
      throw e;
    }
  }

  global.SB_PARTICIPANTS = {
    fetchEnrichedDirectory, fetchEnrichedDirectoryForEdition, fetchOwnStanding,
    fetchPlayerRegistrations, fetchPlayerStats, fetchPlayerMatches, fetchAcademicRoster
  };
})(typeof window !== 'undefined' ? window : globalThis);
