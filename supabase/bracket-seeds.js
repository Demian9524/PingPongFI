// ── Clasificados reales de la categoría (fuente de la bandeja) ──────────
// Une lo que YA existe: grupos publicados (v_public_groups_results),
// posiciones oficiales (get_group_standings) y el motor del reglamento
// (format-engine) para saber a qué bombo pertenece cada quién.
//
// No inventa nombres ni ordena bombos por rendimiento: dentro del Bombo 1 y
// del Bombo 2 no hay ranking interno; los únicos comparables son los terceros
// entre sí, y solo dentro del mismo tamaño efectivo (5–4–3).
(function(global){
  'use strict';
  const F = () => global.FI_FORMAT;
  const cache = {};

  async function groupsOf(edcatId){
    try {
      const { data, error } = await global.SB.from('v_public_groups_results')
        .select('group_id, group_label').eq('edition_category_id', Number(edcatId));
      if (error) throw error;
      const seen = new Set(), out = [];
      (data || []).forEach(r => {
        if (!r.group_id || seen.has(r.group_id)) return;
        seen.add(r.group_id);
        out.push({ id: r.group_id, label: r.group_label || ('#' + r.group_id) });
      });
      return out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    } catch(e){ return []; }
  }
  async function standings(groupId){
    try {
      const { data, error } = await global.SB.rpc('get_group_standings', { p_group_id: groupId });
      if (error) throw error;
      return data || [];
    } catch(e){ return []; }
  }
  function metrics(s){
    const sw = Number(s.sets_won || 0), sl = Number(s.sets_lost || 0);
    return { pj:Number(s.matches_played || 0), wins:Number(s.wins || 0),
      setDiff: sw - sl, setPct: Number(s.set_pct || (sw + sl ? sw / (sw + sl) : 0)) };
  }

  // Devuelve { rows, plan, variant, groups, source } — rows es la bandeja.
  async function load(edcatId, opts){
    opts = opts || {};
    const id = Number(edcatId);
    if (!Number.isFinite(id)) return { rows:[], plan:null, variant:null, groups:[], source:'NONE' };
    if (!opts.force && cache[id]) return cache[id];
    const groups = await groupsOf(id);
    const per = [];
    for (const g of groups){
      const rows = await standings(g.id);
      if (rows.length) per.push({ group:g, rows, effective: rows.length });
    }
    let out;
    if (!per.length) out = await fallback(id, groups);
    else { out = build(per, opts); await enrich(id, out.rows); }
    out.groups = groups;
    cache[id] = out;
    return out;
  }

  // get_group_standings no trae facultad/carrera: se completan con el padrón
  // público del grupo para poder mostrar el escudo correcto en la bandeja.
  async function enrich(edcatId, rows){
    if (!rows || !rows.length) return;
    try {
      const { data } = await global.SB.from('v_public_group_members')
        .select('registration_id, faculty_code, career_code').eq('edition_category_id', Number(edcatId)).limit(300);
      const by = {};
      (data || []).forEach(r => { by[String(r.registration_id)] = r; });
      rows.forEach(r => {
        const m = by[String(r.rid)];
        if (!m) return;
        r.faculty = r.faculty || m.faculty_code || null;
        r.career = r.career || m.career_code || null;
      });
    } catch(e){}
  }

  function build(per, opts){
    const E = F();
    const effSizes = per.map(x => x.effective);
    const plan = E ? E.planFor(per.length, effSizes) : null;
    const variant = plan ? plan.primary : null;
    const pick = pos => per.filter(x => x.rows.length > pos).map(x => ({
      rid: String(x.rows[pos].registration_id || (x.group.id + ':' + pos)),
      name: x.rows[pos].nickname || '—',
      groupId: x.group.id, groupLabel: x.group.label, pos: pos + 1,
      effective: x.effective, faculty: x.rows[pos].faculty_code || null,
      career: x.rows[pos].career_code || null, m: metrics(x.rows[pos])
    })).sort((a, b) => String(a.groupLabel).localeCompare(String(b.groupLabel)));

    const firsts = pick(0), seconds = pick(1), thirdsAll = pick(2);
    let thirds = [];
    if (E && variant && variant.thirdsSlots){
      const sel = E.selectThirds(thirdsAll.map(q => ({
        id:q.rid, name:q.name, groupLabel:q.groupLabel, effectiveSize:q.effective,
        wins:q.m.wins, setDiff:q.m.setDiff, setPct:q.m.setPct, played:q.m.pj, ref:q
      })), variant.thirdsSlots);
      thirds = (sel.qualified || []).map(x => x.ref);
    }
    const access = !!(variant && variant.kind === 'ACCESS');
    const row = (q, pot) => ({
      rid: q.rid, name: q.name, pot, groupId: q.groupId, groupLabel: q.groupLabel,
      pos: q.pos, faculty: q.faculty, career: q.career, effective: q.effective,
      direct: access && pot === '1',
      origin: q.pos + '.º Grupo ' + q.groupLabel,
      potLabel: 'Bombo ' + pot
    });
    const rows = [].concat(firsts.map(q => row(q, '1')), seconds.map(q => row(q, '2')), thirds.map(q => row(q, '3')));
    return { rows, plan, variant, source:'STANDINGS' };
  }

  // Sin standings (categoría sin partidos): al menos los inscritos del grupo.
  async function fallback(id, groups){
    let rows = [];
    try {
      const { data } = await global.SB.from('v_public_group_members')
        .select('registration_id, nickname, faculty_code, career_code, group_id')
        .eq('edition_category_id', id).limit(200);
      const labels = {};
      groups.forEach(g => { labels[g.id] = g.label; });
      const seen = new Set();
      rows = (data || []).filter(r => { if (seen.has(r.registration_id)) return false; seen.add(r.registration_id); return true; })
        .map(r => ({ rid:String(r.registration_id), name:r.nickname || '—', pot:'?',
          groupId:r.group_id, groupLabel: labels[r.group_id] || '—', pos:null,
          faculty:r.faculty_code || null, career:r.career_code || null, direct:false,
          origin: labels[r.group_id] ? 'Grupo ' + labels[r.group_id] : 'Sin grupo',
          potLabel:'Sin posición' }))
        .sort((a, b) => String(a.groupLabel).localeCompare(String(b.groupLabel)) || String(a.name).localeCompare(String(b.name)));
    } catch(e){}
    return { rows, plan:null, variant:null, source: rows.length ? 'MEMBERS' : 'EMPTY' };
  }

  function invalidate(edcatId){
    if (edcatId == null) Object.keys(cache).forEach(k => delete cache[k]);
    else delete cache[Number(edcatId)];
  }
  // Participante del contrato v1 a partir de una fila de la bandeja.
  function toParticipant(row, sourceLabel){
    return { mode:'REGISTRATION', registrationId: row.rid, playerId:null, publicCode:null,
      displayName: row.name, sourceLabel: sourceLabel || row.origin || null,
      groupId: row.groupId || null, groupLabel: row.groupLabel || null,
      facultyLogo: row.faculty || null, careerLogo: row.career || null };
  }

  global.SB_BKT_SEEDS = { load, invalidate, toParticipant };
})(typeof window !== 'undefined' ? window : globalThis);
