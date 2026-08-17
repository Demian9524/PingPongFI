// ── Bracket (fase eliminatoria) ─────────────────────────────────────────
// fi-2027-1 (torneo activo): sin bracket público todavía → estructura vacía.
// fi-2026-2-historico: se reconstruye con datos reales de
// v_public_groups_results cuando esas filas traen round_type/source_cell.
// Nunca se inventan jugadores, marcadores ni se usa ranking/seed/bombos.

(function(global){
  'use strict';

  const ROUNDS = [
    { key: 'R16', name: 'Octavos de final', matches: 8 },
    { key: 'QF',  name: 'Cuartos de final', matches: 4 },
    { key: 'SF',  name: 'Semifinal',        matches: 2 },
    { key: 'F',   name: 'Final',            matches: 1 },
    { key: '3P',  name: 'Tercer lugar',     matches: 1, aside: true }
  ];
  // round_type del backend → clave de ronda visual
  const ROUND_TYPE_MAP = {
    ROUND_OF_16: 'R16', OCTAVOS: 'R16', R16: 'R16',
    QUARTERFINAL: 'QF', CUARTOS: 'QF', QF: 'QF',
    SEMIFINAL: 'SF', SF: 'SF',
    FINAL: 'F', F: 'F',
    THIRD_PLACE: '3P', TERCER_LUGAR: '3P', '3P': '3P',
    REPECHAGE: 'REP', REPECHAJE: 'REP'
  };

  // Sin fuente pública segura para el bracket del torneo ACTIVO todavía.
  async function fetchBracket(){
    return null;
  }

  // Reconstruye el bracket histórico a partir de filas reales con
  // round_type/source_cell (si el backend las expone en la vista pública).
  async function fetchHistoricalBracket(editionSlug){
    if (!global.SB || !global.SB_CATALOG) return null;
    const edition = await global.SB_CATALOG.getEditionBySlug(editionSlug);
    if (!edition) return null;
    const edcats = await global.SB_CATALOG.getEditionCategories(edition.id);
    if (!edcats.length) return null;
    const { data, error } = await global.SB.from('v_public_groups_results')
      .select('match_id, edition_category_id, group_label, player_a, player_b, winner, status, score_a, score_b, score_unit, raw_points_a, raw_points_b, round_type, source_cell')
      .in('edition_category_id', edcats.map(c => c.id));
    if (error){ console.warn('[bracket] histórico no disponible:', error.message || error); return null; }
    const rows = (data || []).filter(r => r.round_type);
    if (!rows.length) return null;

    const byRound = {};
    rows.forEach(r => {
      const key = ROUND_TYPE_MAP[String(r.round_type).toUpperCase()] || null;
      if (!key) return;
      (byRound[key] = byRound[key] || []).push(r);
    });
    const rounds = ROUNDS.map(r => {
      const rows2 = (byRound[r.key] || []).sort((a, b) => String(a.source_cell || '').localeCompare(String(b.source_cell || '')));
      const slots = rows2.length
        ? rows2.map(m => ({ a: m.player_a, b: m.player_b, winner: m.winner, status: m.status || 'SCHEDULED',
            score_a: m.score_a, score_b: m.score_b, score_unit: m.score_unit, raw_points_a: m.raw_points_a, raw_points_b: m.raw_points_b }))
        : Array.from({ length: r.matches }, () => ({ a: null, b: null, winner: null, status: 'SCHEDULED' }));
      return { ...r, slots };
    });
    // repechaje: ronda extra si el backend la usa (no está en ROUNDS fijas)
    if (byRound.REP && byRound.REP.length){
      rounds.push({
        key: 'REP', name: 'Repechaje', matches: byRound.REP.length,
        slots: byRound.REP.map(m => ({ a: m.player_a, b: m.player_b, winner: m.winner, status: m.status || 'SCHEDULED',
          score_a: m.score_a, score_b: m.score_b, score_unit: m.score_unit, raw_points_a: m.raw_points_a, raw_points_b: m.raw_points_b }))
      });
    }
    return rounds;
  }

  function emptyRounds(){
    return ROUNDS.map(r => ({
      ...r,
      slots: Array.from({ length: r.matches }, () => ({
        a: null, b: null, winner: null, status: 'SCHEDULED'
      }))
    }));
  }

  // Etiqueta visible de una posición: BYE se muestra tal cual; vacío → “Por definir”.
  function display(p){
    if (p === 'BYE') return 'BYE';
    return p || 'Por definir';
  }

  const api = { ROUNDS, fetchBracket, fetchHistoricalBracket, emptyRounds, display };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_BRACKET = api;
})(typeof window !== 'undefined' ? window : globalThis);
