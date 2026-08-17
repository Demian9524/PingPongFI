// ── Tablero de grupos · núcleo de estado (FASE 2) ───────────────────────
// Estado, borrador local, undo, persistencia y llamadas RPC.
// Backend v6 (fuente de verdad): admin_group_state_hash, admin_preview_group_changes,
// admin_apply_group_changes, get_group_standings. Sin SQL directo.
(function(global){
  'use strict';

  const state = {
    edition: null, edcats: [], rows: [], rowById: {},
    groupsByEdcat: {},           // edcatId → [{id,label}] (reales, del backend)
    baseHash: null,
    // borrador mutable
    cur: {},                     // rid → { group: int|'new-N'|null, edcat: int }
    orig: {},                    // rid → { group: int|null, edcat: int }
    meta: {},                    // rid → { move_kind, policy, transfer_reason, rematch_decisions:[] }
    newGroups: [],               // [{temp_id, edition_category_id, label}]
    renamed: {},                 // gid → new_label
    deleted: [],                 // [gid]
    undoStack: [],
    tempSeq: 1,
    // apply idéntico en reintentos
    pendingApply: null           // { operationId, payloadString }
  };

  const draftKey = () => 'gbdraft:' + (state.edition ? state.edition.slug : 'none');
  const applyKey = () => 'gbapply:' + (state.edition ? state.edition.slug : 'none');

  function rpc(name, params){
    if (!global.SB) return Promise.reject(new Error('SUPABASE_NOT_CONFIGURED'));
    return global.SB.rpc(name, params).then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  }

  // ── carga inicial ────────────────────────────────────────────────────
  async function load(){
    state.edition = await global.SB_CATALOG.getActiveEdition();
    state.edcats = await global.SB_CATALOG.getEditionCategories(state.edition.id);
    state.rows = await global.SB_ADMIN.fetchAdminRegistrations(state.edition.id);
    state.rowById = {};
    state.rows.forEach(r => { state.rowById[r.registration_id] = r; });

    // grupos por categoría (v_public_groups_results incluye grupos sin partidos)
    const { data, error } = await global.SB.from('v_public_groups_results')
      .select('group_id, edition_category_id, group_label, group_type')
      .in('edition_category_id', state.edcats.map(c => c.id));
    if (error) throw error;
    state.groupsByEdcat = {};
    const seen = new Set();
    (data || []).forEach(r => {
      if (!r.group_id || seen.has(r.group_id)) return;
      seen.add(r.group_id);
      (state.groupsByEdcat[r.edition_category_id] = state.groupsByEdcat[r.edition_category_id] || [])
        .push({ id: r.group_id, label: r.group_label, type: r.group_type });
    });
    // grupos con miembros vigentes que la vista no listó (por si acaso)
    state.rows.forEach(r => {
      if (r.group_id && !seen.has(r.group_id)){
        seen.add(r.group_id);
        (state.groupsByEdcat[r.edition_category_id] = state.groupsByEdcat[r.edition_category_id] || [])
          .push({ id: r.group_id, label: r.group_label || ('#' + r.group_id), type: 'STANDARD' });
      }
    });
    Object.values(state.groupsByEdcat).forEach(list =>
      list.sort((a, b) => String(a.label).localeCompare(String(b.label))));

    state.baseHash = await rpc('admin_group_state_hash', { p_edition_id: state.edition.id });

    // snapshot original
    state.orig = {}; state.cur = {}; state.meta = {};
    state.rows.forEach(r => {
      state.orig[r.registration_id] = { group: r.group_id || null, edcat: r.edition_category_id };
      state.cur[r.registration_id] = { group: r.group_id || null, edcat: r.edition_category_id };
    });
    state.newGroups = []; state.renamed = {}; state.deleted = [];
    state.undoStack = []; state.tempSeq = 1;
    restoreDraft();
    try { state.pendingApply = JSON.parse(localStorage.getItem(applyKey()) || 'null'); } catch(e){ state.pendingApply = null; }
  }

  function eligible(r){
    const rs = String(r.registration_status || '').toUpperCase();
    const ps = String(r.payment_status || '').toUpperCase();
    return rs === 'CONFIRMED' && (ps === 'CONFIRMED' || ps === 'WAIVED');
  }

  // ── borrador ─────────────────────────────────────────────────────────
  function mutableDraft(){
    return {
      cur: state.cur, meta: state.meta, newGroups: state.newGroups,
      renamed: state.renamed, deleted: state.deleted, tempSeq: state.tempSeq
    };
  }
  function snapshotDraft(){ return JSON.parse(JSON.stringify(mutableDraft())); }
  function pushUndo(){
    state.undoStack.push(snapshotDraft());
    if (state.undoStack.length > 100) state.undoStack.shift();
  }
  function undo(){
    const prev = state.undoStack.pop();
    if (!prev) return false;
    Object.assign(state, {
      cur: prev.cur, meta: prev.meta, newGroups: prev.newGroups,
      renamed: prev.renamed, deleted: prev.deleted, tempSeq: prev.tempSeq
    });
    persistDraft();
    return true;
  }
  function resetDraft(){
    pushUndo();
    state.cur = JSON.parse(JSON.stringify(state.orig));
    state.meta = {}; state.newGroups = []; state.renamed = {}; state.deleted = [];
    persistDraft();
  }
  function persistDraft(){
    try {
      if (!hasChanges()){ localStorage.removeItem(draftKey()); return; }
      localStorage.setItem(draftKey(), JSON.stringify({ baseHash: state.baseHash, draft: mutableDraft() }));
    } catch(e){ /* almacenamiento lleno: el borrador sigue en memoria */ }
  }
  function restoreDraft(){
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch(e){ saved = null; }
    if (!saved || !saved.draft) return;
    // no restaurar un borrador de otro estado del backend
    if (saved.baseHash !== state.baseHash){ localStorage.removeItem(draftKey()); return; }
    const d = saved.draft;
    // validar que las inscripciones aún existen
    Object.keys(d.cur || {}).forEach(rid => { if (!state.rowById[rid]) delete d.cur[rid]; });
    Object.assign(state, {
      cur: Object.assign(JSON.parse(JSON.stringify(state.orig)), d.cur),
      meta: d.meta || {}, newGroups: d.newGroups || [],
      renamed: d.renamed || {}, deleted: d.deleted || [], tempSeq: d.tempSeq || 1
    });
  }
  function clearDraftStorage(){
    localStorage.removeItem(draftKey());
    localStorage.removeItem(applyKey());
  }

  function hasChanges(){
    if (state.newGroups.length || state.deleted.length || Object.keys(state.renamed).length) return true;
    return Object.keys(state.cur).some(rid => {
      const c = state.cur[rid], o = state.orig[rid];
      return o && (String(c.group) !== String(o.group) || c.edcat !== o.edcat);
    });
  }
  function changeCount(){
    let n = state.newGroups.length + state.deleted.length + Object.keys(state.renamed).length;
    Object.keys(state.cur).forEach(rid => {
      const c = state.cur[rid], o = state.orig[rid];
      if (o && (String(c.group) !== String(o.group) || c.edcat !== o.edcat)) n++;
    });
    return n;
  }

  // ── mutaciones del borrador (todas empujan undo y persisten) ─────────
  function moveTo(rid, groupKey, edcatId, meta){
    pushUndo();
    state.cur[rid] = { group: groupKey, edcat: edcatId };
    if (meta) state.meta[rid] = Object.assign(state.meta[rid] || {}, meta);
    // si volvió exactamente al origen, limpia metadatos de movimiento
    const o = state.orig[rid], c = state.cur[rid];
    if (o && String(c.group) === String(o.group) && c.edcat === o.edcat) delete state.meta[rid];
    persistDraft();
  }
  function setRematchDecisions(rid, decisions){
    state.meta[rid] = Object.assign(state.meta[rid] || {}, { rematch_decisions: decisions });
    persistDraft();
  }
  function addGroup(edcatId, label){
    pushUndo();
    const tempId = 'new-' + (state.tempSeq++);
    state.newGroups.push({ temp_id: tempId, edition_category_id: edcatId, label: label });
    persistDraft();
    return tempId;
  }
  function renameGroup(gid, label){
    pushUndo();
    if (String(gid).startsWith('new-')){
      const g = state.newGroups.find(x => x.temp_id === gid);
      if (g) g.label = label;
    } else {
      state.renamed[gid] = label;
    }
    persistDraft();
  }
  function deleteGroup(gid){
    // solo si el borrador lo deja vacío
    const occupied = Object.keys(state.cur).some(rid => String(state.cur[rid].group) === String(gid));
    if (occupied) return false;
    pushUndo();
    if (String(gid).startsWith('new-')){
      state.newGroups = state.newGroups.filter(x => x.temp_id !== gid);
    } else if (!state.deleted.includes(gid)){
      state.deleted.push(gid);
    }
    persistDraft();
    return true;
  }

  // ── payload exacto para preview/apply ────────────────────────────────
  function buildChanges(operationId){
    const moves = [], transfers = [];
    Object.keys(state.cur).forEach(rid => {
      const c = state.cur[rid], o = state.orig[rid];
      if (!o) return;
      const meta = state.meta[rid] || {};
      const toKey = c.group == null ? null : String(c.group);
      if (c.edcat !== o.edcat){
        const t = {
          registration_id: rid,
          from_edcat: o.edcat,
          to_edcat: c.edcat,
          to_group_id: toKey,
          reason: meta.transfer_reason || ''
        };
        if (meta.policy) t.played_matches_policy = meta.policy;
        if (meta.rematch_decisions && meta.rematch_decisions.length) t.rematch_decisions = meta.rematch_decisions;
        transfers.push(t);
      } else if (String(c.group) !== String(o.group)){
        const mv = {
          registration_id: rid,
          from_group_id: o.group,
          to_group_id: toKey,
          move_kind: meta.move_kind || 'OTHER'
        };
        if (meta.policy) mv.played_matches_policy = meta.policy;
        if (meta.rematch_decisions && meta.rematch_decisions.length) mv.rematch_decisions = meta.rematch_decisions;
        moves.push(mv);
      }
    });
    const changes = {
      base_snapshot_hash: state.baseHash,
      groups_created: state.newGroups,
      groups_renamed: Object.keys(state.renamed).map(gid => ({ group_id: Number(gid), new_label: state.renamed[gid] })),
      groups_deleted: state.deleted,
      moves: moves,
      category_transfers: transfers
    };
    if (operationId) changes.operation_id = operationId;
    return changes;
  }

  // ── RPCs ─────────────────────────────────────────────────────────────
  function preview(){
    return rpc('admin_preview_group_changes', {
      p_edition_id: state.edition.id, p_changes: buildChanges(null)
    });
  }
  async function apply(reason){
    // reintentos: exactamente el mismo operation_id y payload serializado
    let op, payloadString;
    if (state.pendingApply && state.pendingApply.payloadString){
      op = state.pendingApply.operationId;
      payloadString = state.pendingApply.payloadString;
    } else {
      op = (crypto.randomUUID ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random()*16|0).toString(16)));
      payloadString = JSON.stringify(buildChanges(op));
      state.pendingApply = { operationId: op, payloadString };
      try { localStorage.setItem(applyKey(), JSON.stringify(state.pendingApply)); } catch(e){}
    }
    const result = await rpc('admin_apply_group_changes', {
      p_edition_id: state.edition.id,
      p_changes: JSON.parse(payloadString),
      p_reason: reason
    });
    // éxito: limpiar borrador y payload pendiente
    state.pendingApply = null;
    clearDraftStorage();
    return result;
  }
  function discardPendingApply(){
    state.pendingApply = null;
    localStorage.removeItem(applyKey());
  }
  function standings(groupId){
    return rpc('get_group_standings', { p_group_id: groupId });
  }

  global.GB_CORE = {
    state, load, eligible, hasChanges, changeCount,
    moveTo, setRematchDecisions, addGroup, renameGroup, deleteGroup,
    undo, resetDraft, persistDraft, clearDraftStorage,
    buildChanges, preview, apply, discardPendingApply, standings
  };
})(window);
