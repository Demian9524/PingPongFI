// ── Fase de grupos EN VIVO (Supabase) ───────────────────────────────────
// Reemplaza los mockups de la sección de grupos por datos reales.
// Fuentes públicas (anon):
//   * SB_CATALOG.getActiveEdition / getEditionCategories  (edición y categorías)
//   * v_public_groups_results                              (grupos publicados)
//   * rpc get_group_standings(group_id)                    (miembros + tabla AUTORITATIVA)
//   * v_public_group_members                               (faculty/career para logos; opcional)
// El orden de los jugadores viene del backend — aquí NO se recalculan posiciones.
// Bracket / terceros / sidebar quedan fuera del alcance de esta integración.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const CODE_TO_KEY = { PRINCIPIANTE: 'principiante', INTERMEDIO: 'intermedio', AVANZADO_OPEN: 'avanzado' };
  const FI_CODE = 'INGENIERIA';
  const live = { ready: false, byKey: {}, totalPlayers: 0 };
  let seq = 0; // evita renders fuera de orden al cambiar rápido de tab

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ── ítem flotante (specs existentes). Devuelve un placeholder que luego se
  // reemplaza por el logo clicable compartido (SB_LINKS.makeAcademicLogoLink),
  // cuyo destino depende de la cara visible (facultad ↔ carrera) en FI.
  function facItemLive(m){
    const fall = 'assets/escudo-fi.svg';
    if (m && m.faculty_code && window.SB_LINKS){
      return '<span class="acad-slot" data-fac="' + esc(m.faculty_code) + '" data-car="' + esc(m.career_code || '') + '"></span>';
    }
    if (m && m.faculty_code === FI_CODE && m.career_code && window.SB_LOGOS){
      const back = window.SB_LOGOS.careerLogo(m.career_code);
      return '<span class="fac-wrap"><span class="fac-flip">' +
        '<img class="fac-face fac-front" src="assets/escudo-fi.svg" alt="" aria-hidden="true">' +
        '<img class="fac-face fac-back" src="' + esc(back) + '" alt="" aria-hidden="true" onerror="this.src=\'' + fall + '\';this.onerror=null">' +
        '</span></span>';
    }
    const src = (m && m.faculty_code && window.SB_LOGOS)
      ? window.SB_LOGOS.facultyLogo(m.faculty_code) : fall;
    return '<span class="fac-wrap"><img class="fac-item" src="' + esc(src) +
      '" alt="" aria-hidden="true" onerror="this.src=\'' + fall + '\';this.onerror=null"></span>';
  }

  // Compartidas con torneo-bombos-live.js (misma tipografía y mismos logos).
  window.TORNEO_LIVE_UTILS = { esc: esc, facItem: facItemLive };

  // ── carga ────────────────────────────────────────────────────────────
  async function loadLive(){
    if (!window.SB_READY || !window.SB_CATALOG) return false;
    const edition = await window.SB_CATALOG.getActiveEdition();
    const edcats = await window.SB_CATALOG.getEditionCategories(edition.id);
    // grupos publicados por categoría
    const { data: gRows, error } = await window.SB.from('v_public_groups_results')
      .select('group_id, edition_category_id, group_label, match_id, status, player_a, player_b, winner, score_a, score_b')
      .in('edition_category_id', edcats.map(c => c.id));
    if (error) throw error;
    // partidos pendientes por categoría (para etiquetar PROVISIONAL)
    const schedByEdcat = {};
    (gRows || []).forEach(r => {
      if (r.match_id && r.status === 'SCHEDULED')
        schedByEdcat[r.edition_category_id] = (schedByEdcat[r.edition_category_id] || 0) + 1;
    });
    // enriquecimiento de logos (vista opcional; si falta, logos por defecto)
    let members = [];
    try {
      const { data: mRows } = await window.SB.from('v_public_group_members')
        .select('group_id, registration_id, nickname, faculty_code, career_code')
        .in('edition_category_id', edcats.map(c => c.id));
      members = mRows || [];
    } catch(e){ members = []; }
    // Unión por registration_id (clave estable) — nunca por apodo: dos
    // fuentes pueden traer nicknames ligeramente distintos (nickname_snapshot
    // vs current_nickname tras un renombrado/edición admin) y la unión por
    // texto fallaba silenciosamente (logo no clicable, o el emparejamiento
    // equivocado si dos apodos coincidían).
    const memByReg = {};
    members.forEach(m => { memByReg[m.group_id + '|' + m.registration_id] = m; });

    const groupsByEdcat = {};
    // Partidos por grupo — los necesita torneo-bombos-live.js para armar la
    // BASE DE COMPARACIÓN entre grupos de distinto tamaño (recorte al mínimo
    // común: solo cuentan los partidos contra rivales que todos tuvieron).
    const matchesByGroup = {};
    (gRows || []).forEach(r => {
      if (!r.match_id || !r.group_id) return;
      (matchesByGroup[r.group_id] = matchesByGroup[r.group_id] || []).push({
        a: r.player_a, b: r.player_b, winner: r.winner,
        sa: r.score_a == null ? null : Number(r.score_a),
        sb: r.score_b == null ? null : Number(r.score_b),
        status: r.status || 'SCHEDULED'
      });
    });
    const seen = new Set();
    (gRows || []).forEach(r => {
      if (!r.group_id || seen.has(r.group_id)) return;
      seen.add(r.group_id);
      (groupsByEdcat[r.edition_category_id] = groupsByEdcat[r.edition_category_id] || [])
        .push({ id: r.group_id, label: r.group_label });
    });

    // standings autoritativos por grupo (en paralelo)
    live.byKey = {}; live.totalPlayers = 0;
    for (const c of edcats){
      const key = CODE_TO_KEY[c.code];
      if (!key) continue;
      const groups = (groupsByEdcat[c.id] || [])
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
      const filled = await Promise.all(groups.map(async g => {
        let rows = [];
        try { 
          const { data, error: e2 } = await window.SB.rpc('get_group_standings', { p_group_id: g.id });
          if (e2) throw e2;
          rows = data || [];
        } catch(e){ rows = []; }
        return { id: g.id, label: g.label, matches: matchesByGroup[g.id] || [], players: rows.map(s => ({
          nickname: s.nickname,
          registration_id: s.registration_id,
          pj: s.matches_played, pg: s.wins, pp: s.losses,
          sw: s.sets_won, sl: s.sets_lost,
          member: memByReg[g.id + '|' + s.registration_id] || null
        })) };
      }));
      const nPlayers = filled.reduce((n, g) => n + g.players.length, 0);
      // configuración de zonas de clasificación (con fallback interno)
      let qcfg = null;
      try { qcfg = window.SB_QUALCONFIG ? await window.SB_QUALCONFIG.get(c.id) : null; }
      catch(e){ qcfg = null; }
      // formato del bracket publicado desde el Centro de control (modo admin):
      // manda cuántos descansan y cuántos entran a cada bombo.
      let bfmt = null;
      try {
        const bc = window.SB_BRACKETCFG ? await window.SB_BRACKETCFG.getPublic(c.id) : null;
        bfmt = (bc && bc.format) || null;
      } catch(e){ bfmt = null; }
      live.byKey[key] = { groups: filled, nGroups: filled.length, nPlayers,
        edcatId: c.id, qcfg, bfmt, scheduled: schedByEdcat[c.id] || 0 };
      live.totalPlayers += nPlayers;
    }
    live.ready = true;
    return true;
  }

  // ── render ───────────────────────────────────────────────────────────
  function skeleton(){
    const slider = $('#slider');
    if (!slider) return;
    slider.innerHTML = '';
    for (let i = 0; i < 3; i++){
      const c = document.createElement('div');
      c.className = 'hud gcard';
      c.style.minHeight = '220px';
      c.style.opacity = '0.45';
      c.innerHTML = '<div class="gh"><b style="color:var(--muted)">Cargando…</b></div>';
      slider.appendChild(c);
    }
    if (window.TORNEO_BOMBOS) window.TORNEO_BOMBOS.render(null);
  }
  function emptyGroups(msg){
    const slider = $('#slider');
    if (!slider) return;
    slider.innerHTML = '';
    const e = document.createElement('div');
    e.className = 'empty-pick';
    e.style.flex = '1';
    if (window.TORNEO_BOMBOS) window.TORNEO_BOMBOS.render(null);
    e.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/></svg><span>' + esc(msg) + '</span>';
    slider.appendChild(e);
  }

  // Última categoría pintada: el refresco periódico (cada 20 s) vuelve a
  // construir las tarjetas, y devolver el carrusel al grupo A en ese momento
  // sacaba al visitante del grupo que estaba viendo. Solo se reinicia el
  // scroll cuando la categoría CAMBIA.
  let lastRenderedKey = null;
  function renderLiveGroups(key){
    const cat = live.byKey[key];
    const slider = $('#slider');
    if (!slider) return;
    const sameCat = lastRenderedKey === key;
    // Se guarda el ÍNDICE de la tarjeta activa (no el scrollLeft en píxeles):
    // el ajuste de zoom (Ajuste proporcional) cambia el ancho de las tarjetas
    // en cada refresco, así que un scrollLeft en píxeles queda desalineado y
    // el carrusel "se corre" solo hacia la izquierda con cada refresco (20s).
    const prevCards = Array.from(slider.querySelectorAll('.gcard'));
    let prevIndex = 0;
    if (prevCards.length){
      const mid = slider.scrollLeft + slider.clientWidth / 2;
      prevCards.forEach((c, i) => { if (c.offsetLeft <= mid) prevIndex = i; });
    }
    if (!cat || !cat.groups.length){
      emptyGroups('Aún no hay grupos publicados para esta categoría.');
      setMeta(0, 0);
      if (cat && cat.qcfg){ renderLegendLive(cat); renderThirdsLive(cat); }
      else {
        // categoría sin datos: nunca dejar los mocks de torneo-data a la vista
        const sec = document.getElementById('reglas');
        if (sec) sec.style.display = 'none';
      }
      if (window.TORNEO_BOMBOS) window.TORNEO_BOMBOS.render(null);
      return;
    }
    slider.innerHTML = '';
    cat.groups.forEach(g => {
      const card = document.createElement('div');
      card.className = 'hud gcard';
      const anyPlayed = g.players.some(p => p.pj > 0);
      let html = '<div class="gh"><span class="gi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/></svg></span>' +
        '<b>GRUPO ' + esc(g.label) + '</b><span class="pill">' + g.players.length + ' jug.</span></div>' +
        '<div class="ghead"><span>#</span><span>Jugador</span><span>PJ</span><span>PG</span><span>Sets</span><span>Pts</span></div>';
      if (!g.players.length){
        html += '<div class="empty-pick" style="min-height:80px;border:none;background:transparent"><span>Grupo sin integrantes publicados.</span></div>';
      }
      const qcfg = cat.qcfg;
      g.players.forEach((p, i) => {
        // clasificación visual desde la config de zonas, solo cuando ya hay
        // partidos jugados en el grupo (sin zona coincidente → estilo neutral)
        const zone = (anyPlayed && qcfg && window.SB_QUALCONFIG)
          ? window.SB_QUALCONFIG.bandFor(qcfg, i + 1) : null;
        const rowStyle = zone ? ' style="background:' + window.SB_QUALCONFIG.softBg(window.SB_QUALCONFIG.bgOf(zone), zone.bgPct) + '"' : '';
        const accStyle = zone ? ' style="background:' + window.SB_QUALCONFIG.resolve(zone.color) + '"' : '';
        const rankCell = i === 0
          ? '<span class="rk rk1"><img src="assets/rank-1.png" alt="1" aria-hidden="true"></span>'
          : '<span class="rk">#' + (i + 1) + '</span>';
        const nameHtml = (window.SB_LINKS && p.registration_id)
          ? '<a class="nm-t" href="' + esc(window.SB_LINKS.buildPlayerProfileUrl(p.registration_id)) + '">' + esc(p.nickname) + '</a>'
          : '<span class="nm-t">' + esc(p.nickname) + '</span>';
        html += '<div class="grow"' + rowStyle + '><span class="acc"' + accStyle + '></span>' +
          rankCell +
          '<span class="nm">' + facItemLive(p.member) + nameHtml + '</span>' +
          '<span class="st">' + p.pj + '</span>' +
          '<span class="st">' + p.pg + '</span>' +
          '<span class="st">' + p.sw + '-' + p.sl + '</span>' +
          '<span class="pt">' + (p.pg * 3) + '</span></div>';
      });
      card.innerHTML = html;
      // reemplazar placeholders por el logo clicable compartido (cara visible
      // decide Facultad.html vs Carrera.html; ver supabase/public-links.js)
      card.querySelectorAll('.acad-slot').forEach(slot => {
        const link = window.SB_LINKS.makeAcademicLogoLink(slot.dataset.fac, slot.dataset.car || null, null, null);
        if (link){ link.addEventListener('click', ev => ev.stopPropagation()); slot.replaceWith(link); }
      });
      slider.appendChild(card);
    });
    renderLegendLive(cat);
    renderThirdsLive(cat);
    if (window.TORNEO_BOMBOS) window.TORNEO_BOMBOS.render(cat);
    setMeta(cat.nGroups, cat.nPlayers);
    if (window.__fitGroupSlider) window.__fitGroupSlider(); // aplica el zoom ANTES de fijar el scroll
    if (sameCat){
      const newCards = Array.from(slider.querySelectorAll('.gcard'));
      const target = newCards[Math.min(prevIndex, newCards.length - 1)];
      if (target) slider.scrollLeft = target.offsetLeft;
    } else {
      slider.scrollLeft = 0;
    }
    lastRenderedKey = key;
    if (typeof updateArrows === 'function') updateArrows();
  }

  // ── leyenda dinámica (zonas con showInLegend) ───────────────────────
  function renderLegendLive(cat){
    const host = document.getElementById('gfootZones');
    if (!host || !cat.qcfg || !window.SB_QUALCONFIG) return;
    host.innerHTML = window.SB_QUALCONFIG.legendBands(cat.qcfg).map(b =>
      '<span class="lg"><span class="sw" style="background:' + esc(window.SB_QUALCONFIG.resolve(b.color)) + '"></span>' + esc(b.label) + '</span>'
    ).join('');
  }

  // ── TERCEROS · sistema 5–4–3 con standings REALES de todos los grupos ──
  // Los terceros son los ÚNICOS comparables entre grupos distintos, y solo
  // contra terceros del MISMO tamaño efectivo (Nivel A=5, B=4, C=3 reserva).
  // El número de plazas lo decide el formato (supabase/format-engine.js), no
  // una cifra configurable: depende del número de grupos.
  function renderThirdsLive(cat){
    const sec = document.getElementById('reglas');
    const host = document.getElementById('thirds');
    if (!sec || !host) return;
    const bt = cat.qcfg && cat.qcfg.bestThirds;
    if (bt && bt.enabled === false){ sec.style.display = 'none'; return; }
    const E = window.FI_FORMAT;
    const groups = (cat.groups || []).filter(g => g.players && g.players.length);
    if (!E || groups.length < 2){ sec.style.display = 'none'; return; }
    sec.style.display = '';
    const sizes = groups.map(g => g.players.length);
    const plan = E.planFor(groups.length, sizes);
    const V = plan.primary;
    const slots = V ? V.thirdsSlots : 0;

    const h3 = sec.querySelector('.ph h3');
    if (h3) h3.textContent = 'Terceros · sistema 5–4–3';
    const tag = sec.querySelector('.ph span[style*="margin-left:auto"]');
    if (tag) tag.textContent = cat.scheduled > 0 ? 'CLASIFICACIÓN PROVISIONAL' : 'CORTE DEFINITIVO';
    const note = sec.querySelector('.thirds-note');
    if (note){
      note.innerHTML = 'Todos los <b style="color:var(--text)">primeros y segundos</b> avanzan y nunca se comparan entre sí. ' +
        (slots
          ? 'Con ' + groups.length + ' grupos hay <b style="color:var(--text)">' + slots + ' plaza' + (slots === 1 ? '' : 's') +
            ' de tercero</b>, y se reparten por tamaño efectivo de grupo: primero los terceros de grupos de 5 (Nivel A), después los de 4 (Nivel B) y solo si es indispensable los de 3 (Nivel C). ' +
            'Solo se comparan terceros del mismo nivel: victorias → diferencia de sets → % de sets.'
          : 'Con ' + groups.length + ' grupos este formato <b style="color:var(--text)">no admite terceros</b>: los terceros de grupos de 3 también son últimos de su grupo.') +
        (cat.scheduled > 0 ? ' Provisional: aún hay ' + cat.scheduled + ' partido(s) por jugar en los grupos.' : '');
    }

    const rows = [];
    groups.forEach(g => {
      const p = g.players[2];
      if (!p) return;
      rows.push({ id: p.registration_id || (g.label + ':3'), name: p.nickname, groupLabel: g.label,
        effectiveSize: g.players.length, wins: p.pg, setDiff: p.sw - p.sl,
        setPct: (p.sw + p.sl) ? p.sw / (p.sw + p.sl) : 0, played: p.pj });
    });
    const sel = E.selectThirds(rows, slots);
    host.innerHTML = '';
    if (!rows.length){
      host.innerHTML = '<div class="empty-pick" style="grid-column:1/-1;min-height:80px"><span>Aún no hay terceros lugares en esta categoría.</span></div>';
      return;
    }
    const LVL = { A:'Nivel A · grupos de 5', B:'Nivel B · grupos de 4', C:'Nivel C · grupos de 3 (reserva)' };
    sel.levels.forEach(l => {
      if (!l.list.length) return;
      host.insertAdjacentHTML('beforeend', '<div class="tlvl"><b>' + LVL[l.level] + '</b><span>' +
        (slots ? 'clasifican ' + l.admitted + ' de ' + l.list.length : 'sin plazas') + '</span></div>');
      l.list.forEach((t, i) => {
        const inQ = t.status === 'IN';
        host.insertAdjacentHTML('beforeend',
          '<div class="ti' + (inQ ? ' in' : '') + '"><span class="p">' + (i + 1) + '</span>' +
          '<span class="tn"><b>' + esc(t.name) + '</b><small>GRUPO ' + esc(t.groupLabel) + ' · ' + t.wins + ' PG · DIF ' +
          (t.setDiff > 0 ? '+' : '') + t.setDiff + ' · ' + Math.round(t.setPct * 100) + '% SETS</small></span>' +
          '<span class="bd' + (inQ ? '' : ' out') + '">' + (t.onCut ? 'EMPATE' : (inQ ? 'PASA' : 'FUERA')) + '</span></div>');
      });
    });
    if (sel.needsTiebreak)
      host.insertAdjacentHTML('beforeend', '<div class="tlvl warn" style="grid-column:1/-1"><b>Empate en la última plaza</b>' +
        '<span>se resuelve con partido de desempate o repechaje corto</span></div>');
  }

  function setMeta(nGroups, nPlayers){
    const m1 = $('#mGroups'), m2 = $('#mPlayers'), m5 = $('#heroPlayers');
    if (m1) m1.textContent = nGroups;
    if (m2) m2.textContent = nPlayers;
    if (m5 && live.ready) m5.textContent = live.totalPlayers + ' JUGADORES';
  }

  async function onCategory(key){
    const my = ++seq;
    skeleton();
    if (!live.ready){
      try { await loadLive(); }
      catch(e){
        console.warn('[groups-live] error al cargar:', e && e.message);
        if (my === seq) emptyGroups('No se pudieron cargar los grupos. Intenta de nuevo.');
        return;
      }
    }
    if (my === seq) renderLiveGroups(key);
  }

  // ── integración: envolver el switch de categoría existente ──────────
  function init(){
    if (!window.SB_READY){
      console.warn('[groups-live] Supabase no configurado; la sección de grupos queda vacía.');
      emptyGroups('Grupos no disponibles por el momento.');
      return;
    }
    // re-bind de los botones de categoría: primero el flujo original (tema,
    // bracket, etc.) y después los grupos reales
    document.querySelectorAll('#catSeg button').forEach(b => {
      b.onclick = () => {
        if (typeof setCategory === 'function') setCategory(b.dataset.cat);
        onCategory(b.dataset.cat);
        // lista de participantes previa al sorteo: misma categoría elegida
        if (window.SB_PRE_GROUP) window.SB_PRE_GROUP.setCategory(b.dataset.cat);
      };
    });
    // LISTA DE PARTICIPANTES (previa al sorteo): visibilidad 100% controlada
    // por get_public_pre_group_roster (interruptor administrativo). No depende
    // de grupos, partidos ni fechas. getActiveEdition ya está cacheado.
    if (window.SB_PRE_GROUP && window.SB_CATALOG){
      window.SB_CATALOG.getActiveEdition()
        .then(ed => window.SB_PRE_GROUP.init(ed.id, '#preGroupSection'))
        .catch(e => { window.SB_LOG && window.SB_LOG.error('PRE-GRP-003', e); });
    }
    // hero: total real de jugadores en cuanto esté disponible
    loadLive().then(() => {
      const m5 = $('#heroPlayers');
      if (m5) m5.textContent = live.totalPlayers + ' JUGADORES';
      // si el usuario ya eligió categoría antes de terminar la carga
      const on = document.querySelector('#catSeg button.on');
      if (on) renderLiveGroups(on.dataset.cat);
    }).catch(e => console.warn('[groups-live] precarga falló:', e && e.message));
    // Refresco periódico: si el staff cambia colores/rangos de clasificación
    // (o resultados) en el admin, esta vista pública los recoge solos, sin
    // que el visitante tenga que recargar la página.
    setInterval(() => {
      if (window.SB_QUALCONFIG) window.SB_QUALCONFIG.invalidate();
      loadLive().then(() => {
        const on2 = document.querySelector('#catSeg button.on');
        if (on2) renderLiveGroups(on2.dataset.cat);
      }).catch(() => {});
    }, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
