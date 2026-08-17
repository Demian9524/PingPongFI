// ── Administración de resultados de fase de grupos (ResultadosAdmin.html) ──
// Solo organizadores autenticados. Fuente de lectura: v_public_groups_results
// (incluye CANCELLED y voided_for_standings). Escrituras SOLO vía RPC seguras
// de supabase/admin-actions.js — nunca update directo ni localStorage como
// fuente de verdad. Tras cada mutación se recarga TODO desde Supabase.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const UI = window.SB_UI;
  const ACT = window.SB_ADMIN_ACTIONS;
  let edition = null, edcats = [], matches = [], loadedAt = null, bracketWarn = '';
  const filters = { cat: '', status: '', q: '', phase: '' };
  // Marcadores válidos de grupos (mejor de 3): ganador 2 sets, perdedor 0 o 1.
  const VALID_SCORES = [[2,0],[2,1]];

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(id){
    ['noSession','deniedView','panelView','bootState'].forEach(v => { $('#'+v).style.display = 'none'; });
    if (id) $('#'+id).style.display = 'block';
  }
  function statusOf(m){ return String(m.status || '').toUpperCase().trim(); }
  function stBadge(m){
    const st = statusOf(m);
    const map = {
      SCHEDULED: ['st-sch', 'Programado'],
      PLAYED: ['st-ok', 'Jugado'],
      CANCELLED: ['st-cxl', 'Anulado'],
      WALKOVER: ['st-wo', 'Walkover'],
      DISPUTED: ['st-warn', 'En disputa'],
      UNCONFIRMED: ['st-warn', 'Sin confirmar']
    };
    const [cls, label] = map[st] || ['st-warn', st || '—'];
    return el('span', 'stb ' + cls, label);
  }
  function phaseLoc(m){ return m.phase === 'BRACKET' ? (m.group_label || 'Bracket') : 'Grupo ' + (m.group_label || '—'); }
  function scoreText(m){
    if (statusOf(m) === 'CANCELLED') return '—';
    if (m.score_a == null || m.score_b == null) return '—';
    return m.score_a + '–' + m.score_b;
  }

  // ── arranque / sesión ──────────────────────────────────────────────
  async function boot(){
    if (!window.SB_READY){
      show('bootState');
      $('#bootState').innerHTML = '<b>Sitio no conectado</b> Falta supabase/config.js.';
      return;
    }
    window.SB_AUTH.onAuthChange(session => { if (!session) show('noSession'); });
    try {
      const session = await window.SB_AUTH.getSession();
      if (!session){ show('noSession'); return; }
      $('#whoami').textContent = (session.user && session.user.email) || '';
      $('#btnLogout').style.display = 'inline-flex';
      $('#bootState').innerHTML = '<span class="spin" aria-hidden="true">◌</span> Verificando permisos…';
      let organizer = false;
      try { organizer = await window.SB_AUTH.isOrganizer(); }
      catch(e){ window.SB_LOG && window.SB_LOG.error('RAD-001', e); }
      if (!organizer){ show('deniedView'); return; }
      show('panelView');
      await load();
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('RAD-000', e);
      show('noSession');
    }
  }

  // ── datos (siempre desde Supabase, nunca caché local) ─────────────
  async function fetchMatches(edcatIds){
    const t0 = performance.now();
    const { data, error } = await window.SB.from('v_public_groups_results')
      .select('edition_category_id, category_code, category_name, group_id, group_label, group_type, group_order, match_id, player_a, player_b, winner, status, score_a, score_b, score_unit, raw_points_a, raw_points_b, voided_for_standings, standings_hold')
      .in('edition_category_id', edcatIds)
      .not('match_id', 'is', null);
    if (window.SB_LOG) window.SB_LOG.op('RAD', 'v_public_groups_results', performance.now() - t0, !error);
    if (error) throw error;
    return (data || []).map(m => Object.assign({ phase:'GROUP' }, m));
  }
  // Partidos del bracket (fase eliminatoria). Fuente PRIMARIA: tablas reales
  // (matches → rounds, con round_type <> 'GROUP'), para no depender de que
  // sql/PROPUESTA_admin_bracket_results.sql esté aplicado y para incluir
  // también los partidos con un lado todavía por definir. Si la consulta
  // embebida falla se intenta la vista v_admin_bracket_matches.
  function catInfo(id){
    const c = edcats.find(x => String(x.id) === String(id));
    return { code: (c && c.code) || '', name: (c && (c.name || c.code)) || ('Categoría ' + id) };
  }
  async function fetchBracketFromTables(edcatIds){
    const t0 = performance.now();
    const sel = 'id,status,bracket_position,registration_a_id,registration_b_id,' +
      'rounds!inner(code,round_type,display_name,edition_category_id),' +
      'a:registrations!registration_a_id(nickname_snapshot),' +
      'b:registrations!registration_b_id(nickname_snapshot),' +
      'w:registrations!winner_registration_id(nickname_snapshot),' +
      'match_games(game_number,score_a,score_b,score_unit,raw_points_a,raw_points_b)';
    const { data, error } = await window.SB.from('matches').select(sel)
      .in('rounds.edition_category_id', edcatIds)
      .neq('rounds.round_type', 'GROUP');
    if (window.SB_LOG) window.SB_LOG.op('RAD', 'matches+rounds (bracket)', performance.now() - t0, !error);
    if (error) throw error;
    return (data || []).map(row => {
      const r = row.rounds || {};
      const games = row.match_games || [];
      const g = games.find(x => Number(x.game_number) === 1) || games[0] || {};
      const ci = catInfo(r.edition_category_id);
      return {
        phase: 'BRACKET',
        edition_category_id: r.edition_category_id,
        category_code: ci.code,
        category_name: ci.name,
        round_code: r.code,
        round_type: r.round_type,
        round_name: r.display_name || r.code || 'Bracket',
        group_label: r.display_name || r.code || 'Bracket',
        bracket_position: row.bracket_position,
        match_id: row.id,
        player_a: (row.a && row.a.nickname_snapshot) || null,
        player_b: (row.b && row.b.nickname_snapshot) || null,
        winner: (row.w && row.w.nickname_snapshot) || null,
        status: row.status,
        score_a: g.score_a == null ? null : g.score_a,
        score_b: g.score_b == null ? null : g.score_b,
        score_unit: g.score_unit == null ? null : g.score_unit,
        raw_points_a: g.raw_points_a == null ? null : g.raw_points_a,
        raw_points_b: g.raw_points_b == null ? null : g.raw_points_b
      };
    });
  }
  async function fetchBracketFromView(edcatIds){
    const t0 = performance.now();
    const { data, error } = await window.SB.from('v_admin_bracket_matches')
      .select('edition_category_id, category_code, category_name, round_code, round_type, round_name, match_id, player_a, player_b, winner, status, score_a, score_b, score_unit, raw_points_a, raw_points_b')
      .in('edition_category_id', edcatIds);
    if (window.SB_LOG) window.SB_LOG.op('RAD', 'v_admin_bracket_matches', performance.now() - t0, !error);
    if (error) throw error;
    return (data || []).map(m => Object.assign({ phase:'BRACKET', group_label: m.round_name }, m));
  }
  async function fetchBracketMatches(edcatIds){
    bracketWarn = '';
    try { return await fetchBracketFromTables(edcatIds); }
    catch(e1){
      window.SB_LOG && window.SB_LOG.error('RAD-BRK1', e1);
      try { return await fetchBracketFromView(edcatIds); }
      catch(e2){
        window.SB_LOG && window.SB_LOG.error('RAD-BRK2', e2);
        bracketWarn = 'No se pudieron leer los partidos del bracket: ' + errMsg(e2) +
          ' — la fase de grupos sí se muestra. (RAD-BRK)';
        return [];
      }
    }
  }
  async function load(){
    $('#matchList').setAttribute('aria-busy', 'true');
    try {
      if (!edition){
        edition = await window.SB_CATALOG.getActiveEdition();
        $('#edName').textContent = (edition.name || edition.slug) + ' · ' + edition.slug;
        edcats = await window.SB_CATALOG.getEditionCategories(edition.id);
        fillCatSelects();
      }
      const edcatIds = edcats.map(c => c.id);
      const [groupMatches, bracketMatches] = await Promise.all([fetchMatches(edcatIds), fetchBracketMatches(edcatIds)]);
      matches = groupMatches.concat(bracketMatches);
      matches.sort((a, b) =>
        String(a.category_name).localeCompare(String(b.category_name)) ||
        (a.phase === b.phase ? 0 : (a.phase === 'GROUP' ? -1 : 1)) ||
        String(a.group_label).localeCompare(String(b.group_label), 'es', { numeric: true }) ||
        ((a.bracket_position || 0) - (b.bracket_position || 0)) ||
        String(a.player_a).localeCompare(String(b.player_a)));
      loadedAt = new Date();
      $('#lastUpdate').textContent = 'Actualizado ' + loadedAt.toLocaleTimeString('es-MX');
      renderMatches();
      renderSimSummary();
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('RAD-002', err);
      const w = $('#matchList'); w.textContent = '';
      const st = el('div', 'state');
      st.appendChild(el('b', null, 'Error al cargar'));
      st.appendChild(document.createTextNode(' No se pudieron obtener los partidos. (código RAD-002)'));
      w.appendChild(st);
    }
    $('#matchList').setAttribute('aria-busy', 'false');
  }
  function fillCatSelects(){
    [ $('#fltCat'), $('#simCat') ].forEach(sel => {
      sel.length = 1;
      edcats.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = (c.name || c.code) + ' (edcat ' + c.id + ')';
        sel.appendChild(o);
      });
    });
  }

  // ── render de partidos ─────────────────────────────────────────────
  function visibleMatches(){
    const q = filters.q.toLowerCase();
    return matches.filter(m => {
      if (filters.cat && String(m.edition_category_id) !== String(filters.cat)) return false;
      if (filters.phase && m.phase !== filters.phase) return false;
      if (filters.status && statusOf(m) !== filters.status) return false;
      if (q && !((m.player_a || '') + ' ' + (m.player_b || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function renderMatches(){
    const wrap = $('#matchList');
    wrap.textContent = '';
    const list = visibleMatches();
    if (bracketWarn) wrap.appendChild(el('div', 'rm-danger2', '⚠ ' + bracketWarn));
    const nBr = matches.filter(m => m.phase === 'BRACKET').length;
    $('#matchCount').textContent = list.length + ' de ' + matches.length + ' partidos' +
      (nBr ? ' (' + nBr + ' de bracket)' : '');
    if (!list.length){
      wrap.appendChild(el('div', 'state', matches.length ? 'Ningún partido coincide con los filtros.' : 'No hay partidos publicados todavía.'));
      return;
    }
    // agrupar por categoría → grupo / ronda de bracket
    const byCat = new Map();
    list.forEach(m => {
      const ck = m.category_name || m.category_code;
      if (!byCat.has(ck)) byCat.set(ck, new Map());
      const g = byCat.get(ck);
      const gk = (m.phase === 'BRACKET' ? 'BR\u0000' : 'GR\u0000') + (m.group_label || '—');
      if (!g.has(gk)) g.set(gk, []);
      g.get(gk).push(m);
    });
    byCat.forEach((groupsMap, catName) => {
      wrap.appendChild(el('h3', 'cat-head', catName));
      groupsMap.forEach((ms, gKey) => {
        const isBr = ms[0].phase === 'BRACKET';
        const gLabel = gKey.slice(3);
        const sec = el('div', 'grp-block');
        const gh = el('div', 'grp-head');
        gh.appendChild(el('b', null, isBr ? 'Bracket · ' + gLabel : 'Grupo ' + gLabel));
        if (!isBr){
          const btnStand = el('button', 'btn btn-ghost btn-sm', 'Posiciones');
          btnStand.type = 'button';
          btnStand.addEventListener('click', () => openStandings(ms[0].group_id, catName + ' · Grupo ' + gLabel));
          gh.appendChild(btnStand);
        }
        sec.appendChild(gh);
        ms.forEach(m => sec.appendChild(matchCard(m)));
        wrap.appendChild(sec);
      });
    });
  }
  function matchCard(m){
    const st = statusOf(m);
    const card = el('div', 'mcard st-' + st.toLowerCase());
    const top = el('div', 'mrow');
    const names = el('div', 'mnames');
    const na = el('span', 'mname' + (m.winner && m.winner === m.player_a ? ' win' : ''), m.player_a || '—');
    const nb = el('span', 'mname' + (m.winner && m.winner === m.player_b ? ' win' : ''), m.player_b || '—');
    names.appendChild(na);
    names.appendChild(el('span', 'vs', 'vs'));
    names.appendChild(nb);
    top.appendChild(names);
    const score = el('span', 'mscore', scoreText(m));
    top.appendChild(score);
    card.appendChild(top);
    const meta = el('div', 'mmeta');
    meta.appendChild(stBadge(m));
    if (m.voided_for_standings === true && st !== 'CANCELLED') meta.appendChild(el('span', 'stb st-cxl', 'No cuenta para posiciones'));
    if (m.standings_hold === true) meta.appendChild(el('span', 'stb st-warn', 'Hold de posiciones'));
    meta.appendChild(el('span', 'mline', (m.category_code || '') + ' · ' + phaseLoc(m) +
      (m.winner && st !== 'CANCELLED' ? ' · Ganador: ' + m.winner : '')));
    const idm = el('span', 'mid', String(m.match_id).slice(0, 8) + '…');
    idm.title = m.match_id;
    meta.appendChild(idm);
    card.appendChild(meta);
    const act = el('div', 'mact2');
    actionsFor(m).forEach(b => act.appendChild(b));
    if (act.childNodes.length) card.appendChild(act);
    return card;
  }
  function abtn(label, cls, fn){
    const b = el('button', 'btn ' + (cls || 'btn-ghost') + ' btn-sm', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function pend(label){
    const b = el('button', 'btn btn-ghost btn-sm', label);
    b.type = 'button'; b.disabled = true;
    b.title = 'Pendiente de RPC de default';
    return b;
  }
  function pendLbl(label){
    const b = el('button', 'btn btn-ghost btn-sm', label);
    b.type = 'button'; b.disabled = true;
    b.title = 'El partido aún no tiene los dos jugadores definidos';
    return b;
  }
  function actionsFor(m){
    const st = statusOf(m);
    // Partidos del bracket: solo capturar/editar marcador (record_match_result
    // es genérico). Anular/borrar/eliminar usan RPC pensadas para grupos
    // (admin_clear_group_match_result y similares) que no están verificadas
    // para partidos de eliminatoria — se dejan fuera hasta confirmarlas.
    if (m.phase === 'BRACKET'){
      if (!m.player_a || !m.player_b) return [pendLbl('Rival por definir')];
      if (st === 'SCHEDULED') return [abtn('Capturar marcador', 'btn-main', () => captureModal(m, false))];
      if (st === 'PLAYED') return [abtn('Editar marcador', 'btn-main', () => captureModal(m, true))];
      return [];
    }
    if (st === 'SCHEDULED') return [
      abtn('Capturar marcador', 'btn-main', () => captureModal(m, false)),
      pend('Default ' + (m.player_a || 'A')),
      pend('Default ' + (m.player_b || 'B')),
      abtn('Anular', 'btn-danger', () => cancelModal(m)),
      abtn('Eliminar partido', 'btn-del', () => deleteModal(m))
    ];
    if (st === 'PLAYED') return [
      abtn('Editar marcador', 'btn-main', () => captureModal(m, true)),
      abtn('Borrar marcador', '', () => clearModal(m)),
      abtn('Anular', 'btn-danger', () => cancelModal(m)),
      abtn('Eliminar partido', 'btn-del', () => deleteModal(m))
    ];
    if (st === 'CANCELLED') return [
      abtn('Restaurar partido', 'btn-main', () => restoreModal(m)),
      abtn('Eliminar partido', 'btn-del', () => deleteModal(m))
    ];
    if (st === 'WALKOVER') return [
      pend('Corregir ganador'),
      abtn('Borrar resultado', '', () => clearModal(m)),
      abtn('Anular', 'btn-danger', () => cancelModal(m)),
      abtn('Eliminar partido', 'btn-del', () => deleteModal(m))
    ];
    return [];
  }

  // ── modal genérico ─────────────────────────────────────────────────
  function makeModal(title){
    const bg = el('div', 'modal-bg open');
    const box = el('div', 'hud modal rmodal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.appendChild(el('h2', null, title));
    const body = el('div', 'rm-body');
    const act = el('div', 'mact');
    box.appendChild(body); box.appendChild(act);
    bg.appendChild(box);
    document.body.appendChild(bg);
    let busy = false;
    function close(){ if (busy) return; document.removeEventListener('keydown', onKey); bg.remove(); }
    function onKey(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    function setBusy(v, okBtn){
      busy = v;
      act.querySelectorAll('button').forEach(b => { b.disabled = v; });
      if (okBtn) okBtn.textContent = v ? 'Guardando…' : okBtn.dataset.lbl;
    }
    return { bg, body, act, close, setBusy };
  }
  function reasonField(body, label){
    const lab = el('label', 'rm-label', label || 'Motivo (obligatorio)');
    const ta = document.createElement('textarea');
    ta.className = 'filter rm-reason'; ta.rows = 2; ta.required = true;
    lab.appendChild(ta);
    body.appendChild(lab);
    return ta;
  }
  function ghostBtn(label){ const b = el('button', 'btn btn-ghost', label); b.type = 'button'; return b; }
  function mainBtn(label, danger){
    const b = el('button', 'btn ' + (danger ? 'btn-danger' : 'btn-main'), label);
    b.type = 'button'; b.dataset.lbl = label; return b;
  }
  async function afterMutation(msg){
    await load();
    UI.toast(msg, 'ok');
  }
  function errMsg(e){
    return (e && (e.userMessage || e.message)) || 'Error desconocido';
  }

  // ── capturar / editar marcador ─────────────────────────────────────
  function captureModal(m, editMode){
    const M = makeModal(editMode ? 'Editar marcador' : 'Capturar marcador');
    M.body.appendChild(el('p', 'rm-players', (m.player_a || 'A') + '  vs  ' + (m.player_b || 'B')));
    M.body.appendChild(el('p', 'metaline', (m.category_name || '') + ' · ' + phaseLoc(m) + ' · Mejor de 3 sets'));
    if (editMode){
      M.body.appendChild(el('p', 'metaline', 'Marcador actual: ' + scoreText(m) + ' · Ganador: ' + (m.winner || '—')));
      M.body.appendChild(el('p', 'rm-warn', '⚠ Cambiar este resultado recalculará las posiciones del grupo.'));
    }
    // ganador
    const state = { winner: null, score: null };
    function radioGroup(title, options, onPick){
      const wrap = el('div', 'rm-group');
      wrap.appendChild(el('span', 'rm-label', title));
      const row = el('div', 'rm-opts');
      const btns = options.map(([val, label]) => {
        const b = el('button', 'rm-opt', label); b.type = 'button';
        b.addEventListener('click', () => {
          btns.forEach(x => x.classList.remove('sel'));
          b.classList.add('sel');
          onPick(val);
        });
        row.appendChild(b);
        return b;
      });
      wrap.appendChild(row);
      M.body.appendChild(wrap);
    }
    radioGroup('Ganador', [['A', m.player_a || 'Jugador A'], ['B', m.player_b || 'Jugador B']], v => { state.winner = v; refresh(); });
    radioGroup('Marcador (sets del ganador)', VALID_SCORES.map(s => [s.join('-'), s[0] + ' – ' + s[1]]), v => { state.score = v; refresh(); });
    const summary = el('p', 'rm-summary', '');
    M.body.appendChild(summary);
    let reasonTa = null;
    if (editMode) reasonTa = reasonField(M.body, 'Motivo del cambio (obligatorio)');
    const cancel = ghostBtn('Cancelar');
    const save = mainBtn('Guardar resultado');
    save.disabled = true;
    M.act.appendChild(cancel); M.act.appendChild(save);
    cancel.addEventListener('click', M.close);
    function perspective(){
      // convierte ganador+marcador a score_a/score_b (perspectiva del partido)
      const [w, l] = state.score.split('-').map(Number);
      return state.winner === 'A' ? { a: w, b: l } : { a: l, b: w };
    }
    function refresh(){
      if (state.winner && state.score){
        const p = perspective();
        const wn = state.winner === 'A' ? m.player_a : m.player_b;
        summary.textContent = (m.player_a || 'A') + ' ' + p.a + '–' + p.b + ' ' + (m.player_b || 'B') + '  ·  Ganador: ' + wn;
        save.disabled = false;
      } else {
        summary.textContent = '';
        save.disabled = true;
      }
    }
    save.addEventListener('click', async () => {
      if (!state.winner || !state.score) return;
      const reason = reasonTa ? reasonTa.value.trim() : '';
      if (editMode && !reason){ UI.toast('El motivo es obligatorio.', 'warn'); reasonTa.focus(); return; }
      const p = perspective();
      M.setBusy(true, save);
      try {
        if (editMode && m.phase === 'BRACKET'){
          // record_match_result hace UPSERT (on conflict match_id,game_number):
          // en el bracket se puede recapturar directo, sin reabrir antes.
          await ACT.recordMatchResult({ p_match: m.match_id, p_score_a: p.a, p_score_b: p.b, p_score_unit: 'SETS', p_raw_points_a: null, p_raw_points_b: null, p_result_source: 'ORGANIZER_ENTRY' });
        } else if (editMode){
          // flujo seguro (grupos): reabrir primero, luego recapturar
          const r1 = await ACT.clearGroupMatchResult(m.match_id, reason);
          if (!r1 || r1.ok !== true) throw new Error('No se pudo reabrir el partido: ' + JSON.stringify(r1));
          try {
            await ACT.recordMatchResult({ p_match: m.match_id, p_score_a: p.a, p_score_b: p.b, p_score_unit: 'SETS', p_raw_points_a: null, p_raw_points_b: null, p_result_source: 'ORGANIZER_ENTRY' });
          } catch(e2){
            M.setBusy(false, save); M.close();
            await load();
            UI.toast('El marcador anterior se borró pero la recaptura falló: ' + errMsg(e2) + '. El partido quedó Programado — captura el resultado de nuevo.', 'err');
            return;
          }
        } else {
          await ACT.recordMatchResult({ p_match: m.match_id, p_score_a: p.a, p_score_b: p.b, p_score_unit: 'SETS', p_raw_points_a: null, p_raw_points_b: null, p_result_source: 'ORGANIZER_ENTRY' });
        }
        M.setBusy(false, save); M.close();
        await afterMutation('Resultado guardado: ' + summary.textContent);
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-REC', e);
        M.setBusy(false, save);
        UI.toast('No se pudo guardar: ' + errMsg(e), 'err');
      }
    });
  }

  // ── borrar marcador (reabrir) ──────────────────────────────────────
  function clearModal(m){
    const M = makeModal('Reabrir partido');
    M.body.appendChild(el('p', 'rm-players', (m.player_a || 'A') + '  vs  ' + (m.player_b || 'B')));
    M.body.appendChild(el('p', 'metaline', 'Marcador actual: ' + scoreText(m) + ' · Ganador: ' + (m.winner || '—')));
    M.body.appendChild(el('p', 'rm-warn', '⚠ Se eliminará el marcador y el partido volverá a estar pendiente.'));
    const ta = reasonField(M.body);
    const cancel = ghostBtn('Cancelar');
    const ok = mainBtn('Borrar marcador', true);
    M.act.appendChild(cancel); M.act.appendChild(ok);
    cancel.addEventListener('click', M.close);
    ok.addEventListener('click', async () => {
      const reason = ta.value.trim();
      if (!reason){ UI.toast('El motivo es obligatorio.', 'warn'); ta.focus(); return; }
      M.setBusy(true, ok);
      try {
        const r = await ACT.clearGroupMatchResult(m.match_id, reason);
        if (!r || r.ok !== true) throw new Error(JSON.stringify(r));
        M.setBusy(false, ok); M.close();
        await afterMutation('Marcador eliminado. El partido volvió a Programado.');
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-CLR', e);
        M.setBusy(false, ok);
        UI.toast('No se pudo borrar el marcador: ' + errMsg(e), 'err');
      }
    });
  }

  // ── anular partido ─────────────────────────────────────────────────
  function cancelModal(m){
    const M = makeModal('Anular partido');
    M.body.appendChild(el('p', 'rm-players', (m.player_a || 'A') + '  vs  ' + (m.player_b || 'B')));
    M.body.appendChild(el('p', 'metaline', (m.category_name || '') + ' · ' + phaseLoc(m)));
    M.body.appendChild(el('p', 'rm-warn', '⚠ Este partido no contará para estadísticas ni clasificación.'));
    const ta = reasonField(M.body);
    const cancel = ghostBtn('Cancelar');
    const ok = mainBtn('Anular partido', true);
    M.act.appendChild(cancel); M.act.appendChild(ok);
    cancel.addEventListener('click', M.close);
    ok.addEventListener('click', async () => {
      const reason = ta.value.trim();
      if (!reason){ UI.toast('El motivo es obligatorio.', 'warn'); ta.focus(); return; }
      M.setBusy(true, ok);
      try {
        const r = await ACT.cancelGroupMatch(m.match_id, reason);
        if (!r || r.ok !== true) throw new Error(JSON.stringify(r));
        M.setBusy(false, ok); M.close();
        await afterMutation('Partido anulado. No contará para posiciones.');
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-CXL', e);
        M.setBusy(false, ok);
        UI.toast('No se pudo anular: ' + errMsg(e), 'err');
      }
    });
  }

  // ── restaurar partido anulado ──────────────────────────────────────
  function restoreModal(m){
    const M = makeModal('Restaurar partido');
    M.body.appendChild(el('p', 'rm-players', (m.player_a || 'A') + '  vs  ' + (m.player_b || 'B')));
    M.body.appendChild(el('p', 'metaline', 'El partido volverá a estar pendiente y podrá capturarse un resultado.'));
    const ta = reasonField(M.body);
    const cancel = ghostBtn('Cancelar');
    const ok = mainBtn('Restaurar partido');
    M.act.appendChild(cancel); M.act.appendChild(ok);
    cancel.addEventListener('click', M.close);
    ok.addEventListener('click', async () => {
      const reason = ta.value.trim();
      if (!reason){ UI.toast('El motivo es obligatorio.', 'warn'); ta.focus(); return; }
      M.setBusy(true, ok);
      try {
        const r = await ACT.restoreGroupMatch(m.match_id, reason);
        if (!r || r.ok !== true) throw new Error(JSON.stringify(r));
        M.setBusy(false, ok); M.close();
        await afterMutation('Partido restaurado. Vuelve a estar Programado.');
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-RST', e);
        M.setBusy(false, ok);
        UI.toast('No se pudo restaurar: ' + errMsg(e), 'err');
      }
    });
  }

  // ── eliminar partido permanentemente ───────────────────────────────
  // Distinto de "Borrar marcador" (reabre) y de "Anular" (queda CANCELLED):
  // borra la fila de matches vía admin_delete_group_match (auditada).
  function deleteModal(m){
    const st = statusOf(m);
    const expected = 'ELIMINAR-PARTIDO-' + m.match_id;
    const M = makeModal('Eliminar partido permanentemente');
    M.body.appendChild(el('p', 'rm-players', (m.player_a || 'A') + '  vs  ' + (m.player_b || 'B')));
    M.body.appendChild(el('p', 'metaline', (m.category_name || '') + ' · ' + phaseLoc(m) +
      ' · Estado: ' + st + ' · Marcador: ' + scoreText(m) + ' · Ganador: ' + (m.winner || '—')));
    M.body.appendChild(el('p', 'rm-danger2', '⚠ Este encuentro desaparecerá completamente de grupos, resultados, perfiles e historial. Esta acción no equivale a anular el partido.'));
    if (st === 'PLAYED') M.body.appendChild(el('p', 'rm-warn', '⚠ El partido YA TIENE un resultado oficial. Eliminarlo recalculará las posiciones y borrará su marcador para siempre.'));
    const ta = reasonField(M.body);
    const lab = el('label', 'rm-label', 'Escribe: ' + expected);
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'filter'; inp.autocomplete = 'off';
    inp.placeholder = 'ELIMINAR-PARTIDO-…';
    lab.appendChild(inp);
    M.body.appendChild(lab);
    const cancel = ghostBtn('Cancelar');
    const ok = mainBtn('Eliminar definitivamente', true);
    ok.disabled = true;
    inp.addEventListener('input', () => { ok.disabled = inp.value.trim() !== expected; });
    M.act.appendChild(cancel); M.act.appendChild(ok);
    cancel.addEventListener('click', M.close);
    ok.addEventListener('click', async () => {
      const reason = ta.value.trim();
      if (!reason){ UI.toast('El motivo es obligatorio.', 'warn'); ta.focus(); return; }
      if (inp.value.trim() !== expected){ UI.toast('La confirmación no coincide.', 'warn'); inp.focus(); return; }
      M.setBusy(true, ok);
      try {
        const r = await ACT.deleteGroupMatch({ matchId: m.match_id, confirmation: inp.value.trim(), reason });
        if (!r || r.ok !== true){
          const code = r && r.code;
          const msg = (r && r.message) || 'Respuesta inesperada del backend.';
          M.setBusy(false, ok);
          if (code === 'MATCH_NOT_FOUND'){ M.close(); await load(); UI.toast('El partido ya no existía. Vista actualizada.', 'warn'); return; }
          UI.toast('No se pudo eliminar: ' + msg, 'err');
          return;
        }
        M.setBusy(false, ok); M.close();
        await afterMutation('Partido eliminado permanentemente: ' + (m.player_a || 'A') + ' vs ' + (m.player_b || 'B'));
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-DEL', e);
        M.setBusy(false, ok);
        UI.toast('No se pudo eliminar: ' + errMsg(e), 'err');
      }
    });
  }

  // ── posiciones por grupo (siempre frescas vía RPC) ─────────────────
  async function openStandings(groupId, title){
    try {
      const { data, error } = await window.SB.rpc('get_group_standings', { p_group_id: groupId });
      if (error) throw error;
      const body = el('div');
      const tbl = document.createElement('table');
      tbl.className = 'stand-tbl';
      const thr = document.createElement('tr');
      ['#','Jugador','PJ','G','P','Sets','%'].forEach(h => thr.appendChild(el('th', null, h)));
      tbl.appendChild(thr);
      (data || []).forEach((s, i) => {
        const tr = document.createElement('tr');
        [i + 1, s.nickname, s.matches_played, s.wins, s.losses,
         (s.sets_won ?? 0) + '-' + (s.sets_lost ?? 0),
         Math.round((s.win_pct || 0) * 100) + '%'].forEach(v => tr.appendChild(el('td', null, String(v))));
        tbl.appendChild(tr);
      });
      if (!data || !data.length) body.appendChild(el('p', 'metaline', 'Sin partidos que cuenten todavía.'));
      else body.appendChild(tbl);
      UI.openDrawer2('Posiciones · ' + title, body, []);
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('RAD-STD', e);
      UI.toast('No se pudieron cargar las posiciones: ' + errMsg(e), 'err');
    }
  }

  // ── herramientas de simulación (reset de fase de grupos) ───────────
  function simRows(){
    const id = $('#simCat').value;
    return id ? matches.filter(m => String(m.edition_category_id) === String(id)) : null;
  }
  function renderSimSummary(){
    const wrap = $('#simSummary');
    wrap.textContent = '';
    const rows = simRows();
    $('#simConfirmHint').textContent = '';
    if (!rows){ wrap.appendChild(el('span', 'metaline', 'Elige una categoría para ver el resumen.')); setSimEnabled(false); return; }
    const c = { total: rows.length, PLAYED: 0, SCHEDULED: 0, CANCELLED: 0, WALKOVER: 0, scored: 0 };
    rows.forEach(m => {
      const st = statusOf(m);
      if (c[st] != null) c[st]++;
      if (m.score_a != null) c.scored++;
    });
    const cat = edcats.find(x => String(x.id) === String($('#simCat').value));
    [['Partidos', c.total], ['Jugados', c.PLAYED], ['Programados', c.SCHEDULED],
     ['Anulados', c.CANCELLED], ['Walkover', c.WALKOVER], ['Filas de marcador', c.scored]]
      .forEach(([l, v]) => {
        const k = el('span', 'sim-kpi');
        k.appendChild(el('b', null, String(v)));
        k.appendChild(document.createTextNode(' ' + l));
        wrap.appendChild(k);
      });
    $('#simConfirmHint').textContent = 'Confirmación exacta requerida: RESET-GRUPOS-' + (cat ? cat.id : '?');
    setSimEnabled(true);
  }
  function setSimEnabled(v){
    ['#btnSimClear', '#btnSimDelete'].forEach(s => { $(s).disabled = !v; });
  }
  function expectedConfirmation(){
    return 'RESET-GRUPOS-' + $('#simCat').value;
  }
  async function runReset(deleteMatches){
    const catId = parseInt($('#simCat').value, 10);
    if (!catId) return;
    const cat = edcats.find(x => x.id === catId);
    const typed = $('#simConfirm').value.trim();
    const reason = $('#simReason').value.trim();
    if (typed !== expectedConfirmation()){
      UI.toast('La confirmación no coincide. Escribe exactamente: ' + expectedConfirmation(), 'warn');
      $('#simConfirm').focus();
      return;
    }
    if (!reason){ UI.toast('El motivo es obligatorio.', 'warn'); $('#simReason').focus(); return; }
    if (deleteMatches){
      // guarda extra: no eliminar calendario si ya hay bracket publicado
      try {
        const { data, error } = await window.SB.from('v_public_bracket').select('status').limit(1);
        if (!error && data && data.length){
          UI.toast('Hay un bracket publicado. Verifica que no esté enlazado a estos grupos antes de eliminar los partidos.', 'err');
          return;
        }
      } catch(e){ /* vista opcional: continuar */ }
    }
    const M = makeModal(deleteMatches ? 'Eliminar partidos de grupos' : 'Borrar resultados de grupos');
    M.body.appendChild(el('p', 'rm-players', (cat ? (cat.name || cat.code) : '') + ' (edcat ' + catId + ')'));
    M.body.appendChild(el('p', 'rm-warn', deleteMatches
      ? '⚠⚠ Se ELIMINARÁ COMPLETAMENTE el calendario de partidos de grupos de esta categoría. Los grupos y sus integrantes se conservan. Después habrá que recrear los partidos.'
      : '⚠ Se eliminarán TODOS los resultados de grupos de esta categoría. El calendario y los grupos se conservan; todos los partidos volverán a Programado.'));
    const cancel = ghostBtn('Cancelar');
    const ok = mainBtn(deleteMatches ? 'Eliminar partidos' : 'Borrar resultados', true);
    M.act.appendChild(cancel); M.act.appendChild(ok);
    cancel.addEventListener('click', M.close);
    ok.addEventListener('click', async () => {
      M.setBusy(true, ok);
      try {
        const r = await ACT.resetGroupStage(catId, typed, reason, deleteMatches);
        if (r && r.ok === false) throw new Error(JSON.stringify(r));
        M.setBusy(false, ok); M.close();
        $('#simConfirm').value = ''; $('#simReason').value = '';
        await afterMutation(deleteMatches ? 'Partidos de grupos eliminados.' : 'Resultados de grupos eliminados. Todos los partidos quedaron Programados.');
      } catch(e){
        window.SB_LOG && window.SB_LOG.error('RAD-RSTG', e);
        M.setBusy(false, ok);
        UI.toast('No se pudo ejecutar el reinicio: ' + errMsg(e), 'err');
      }
    });
  }

  // ── eventos ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('#fltCat').addEventListener('change', e => { filters.cat = e.target.value; renderMatches(); });
    $('#fltStatus').addEventListener('change', e => { filters.status = e.target.value; renderMatches(); });    $('#fltQ').addEventListener('input', e => { filters.q = e.target.value.trim(); renderMatches(); });
    $('#fltPhase').addEventListener('change', e => { filters.phase = e.target.value; renderMatches(); });
    $('#btnReload').addEventListener('click', load);
    $('#simCat').addEventListener('change', renderSimSummary);
    $('#btnSimClear').addEventListener('click', () => runReset(false));
    $('#btnSimDelete').addEventListener('click', () => runReset(true));
    $('#btnLogout').addEventListener('click', async () => {
      try { await window.SB_AUTH.signOut(); } catch(e){}
      show('noSession');
    });
    $('#btnDeniedLogout').addEventListener('click', async () => {
      try { await window.SB_AUTH.signOut(); } catch(e){}
      show('noSession');
    });
    boot();
  });
})();
