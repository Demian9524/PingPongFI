// ── Resultados públicos ─────────────────────────────────────────────────
// Fuente pública REAL disponible (RLS anon): v_public_groups_results
// (fase de grupos: group_label, group_type, player_a, player_b, winner,
// status por partido). NO existe fuente pública para rondas eliminatorias;
// ver BACKEND_RPC_PENDING.md (get_public_bracket).
// No se consultan tablas privadas ni se inventan partidos.

(function(global){
  'use strict';

  // Aplana filas de v_public_groups_results a partidos (pura, testeable).
  function flattenRows(rows){
    return (rows || [])
      .filter(r => r.match_id)
      .map(r => ({
        match_id: r.match_id,
        group_id: r.group_id,
        group_label: r.group_label,
        group_type: r.group_type,
        edition_category_id: r.edition_category_id,
        player_a: r.player_a,
        player_b: r.player_b,
        winner: r.winner,
        status: r.status || 'SCHEDULED',
        score_a: r.score_a ?? null,
        score_b: r.score_b ?? null,
        score_unit: r.score_unit || null,
        raw_points_a: r.raw_points_a ?? null,
        raw_points_b: r.raw_points_b ?? null
      }));
  }

  // Reutiliza SB_GROUPS.fetchGroups (misma vista) y aplana a partidos.
  async function fetchMatches(editionCategoryIds){
    const rows = await global.SB_GROUPS.fetchGroups(editionCategoryIds);
    return flattenRows(rows);
  }

  const KNOWN_STATUS = ['SCHEDULED','PLAYED','WALKOVER','CANCELLED','VOID','DISPUTED'];

  // Texto de marcador según las reglas visuales del backend v3.
  function scoreLine(m){
    if (m.status === 'WALKOVER') return { main: 'W.O.', sub: null };
    if (m.status === 'CANCELLED') return { main: 'Cancelado', sub: null };
    if (m.status === 'VOID') return { main: 'Anulado', sub: null };
    if (m.status === 'DISPUTED') return { main: 'En revisión', sub: null };
    if (m.score_a == null || m.score_b == null) return { main: 'VS', sub: null };
    const main = m.score_a + '–' + m.score_b;
    const sub = (m.score_unit === 'SINGLE_GAME_POINTS' && m.raw_points_a != null && m.raw_points_b != null)
      ? ('puntos: ' + m.raw_points_a + '–' + m.raw_points_b) : null;
    return { main, sub };
  }

  const api = { fetchMatches, flattenRows, KNOWN_STATUS, scoreLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_RESULTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
