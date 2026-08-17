// ── Grupos públicos ─────────────────────────────────────────────────────
// Fuentes públicas disponibles según RLS (03_security_rls.sql):
//   * v_public_groups_results — group_id, edition_category_id, group_label,
//     group_type, match_id, player_a, player_b, winner, status (anon OK)
//   * get_public_contact_directory(edition_id) — miembros con group_label
//
// NO existe una vista pública de group_memberships. Los integrantes se
// derivan del directorio (solo confirmados con consentimiento) y de los
// apodos que aparecen en partidos. Ver BACKEND_RPC_PENDING.md.

(function(global){
  'use strict';

  async function fetchGroups(editionCategoryIds){
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const t0 = performance.now();
    let q = global.SB.from('v_public_groups_results')
      .select('group_id, edition_category_id, group_label, group_type, group_order, match_id, round_code, round_name, player_a, player_b, winner, status, score_a, score_b, score_unit, raw_points_a, raw_points_b, voided_for_standings, standings_hold');
    if (Array.isArray(editionCategoryIds) && editionCategoryIds.length)
      q = q.in('edition_category_id', editionCategoryIds);
    const { data, error } = await q;
    if (global.SB_LOG) global.SB_LOG.op('GRP', 'v_public_groups_results', performance.now() - t0, !error);
    if (error) throw error;
    return data || [];
  }

  // Integrantes reales por grupo (registration_id, nickname, faculty_code,
  // career_code) — solo visibles según RLS/consentimiento de la vista.
  async function fetchMembers(editionCategoryIds){
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const t0 = performance.now();
    let q = global.SB.from('v_public_group_members')
      .select('group_id, edition_category_id, registration_id, nickname, faculty_code, career_code');
    if (Array.isArray(editionCategoryIds) && editionCategoryIds.length)
      q = q.in('edition_category_id', editionCategoryIds);
    const { data, error } = await q;
    if (global.SB_LOG) global.SB_LOG.op('GRP', 'v_public_group_members', performance.now() - t0, !error);
    if (error){
      // Vista opcional en algunos entornos: no romper la página si falta.
      console.warn('[groups] v_public_group_members no disponible:', error.message || error);
      return [];
    }
    return data || [];
  }

  // Agrupa filas (grupo×partido) en estructura por grupo
  function groupRows(rows){
    const map = new Map();
    (rows || []).forEach(r => {
      if (!map.has(r.group_id)){
        map.set(r.group_id, {
          group_id: r.group_id,
          edition_category_id: r.edition_category_id,
          label: r.group_label,
          type: r.group_type,
          matches: [],
          players: new Set()
        });
      }
      const g = map.get(r.group_id);
      if (r.match_id){
        g.matches.push({ a: r.player_a, b: r.player_b, winner: r.winner, status: r.status, score_a: r.score_a, score_b: r.score_b, score_unit: r.score_unit, raw_points_a: r.raw_points_a, raw_points_b: r.raw_points_b });
        if (r.player_a) g.players.add(r.player_a);
        if (r.player_b) g.players.add(r.player_b);
      }
    });
    return [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }

  const api = { fetchGroups, fetchMembers, groupRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_GROUPS = api;
})(typeof window !== 'undefined' ? window : globalThis);
