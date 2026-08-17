// ── BracketAdmin · editor de tarjeta (modal) + import de Preparación ─────
// Depende del contexto compartido window.BA (bracket-admin-ui.js).
// Nada de esto crea, borra ni modifica public.matches: solo escribe en el
// borrador local, que se guarda con «Guardar borrador».
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const BA = () => window.BA;
  const CFG = window.SB_BRACKETCFG;
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const TOPO = window.FI_BKT_TOPO;
  const ROUND_LABEL = (TOPO && TOPO.ROUND_LABEL) || { access:'RONDA DE ACCESO', quarterfinal:'CUARTOS', semifinal:'SEMIFINAL', final:'GRAN FINAL' };

  function cfg(){ return BA().S.cfg; }
  function plan(){ return TOPO.buildPlan(cfg().format); }
  function slotOf(id){ const c = cfg(); return c.slots[id] || (c.slots[id] = CFG.emptySlot(id)); }

  // Importación del borrador temporal de PreparacionEliminatoria (hand-off
  // local, NO fuente oficial: el bracket oficial vive en Supabase).
  function importFromPrep(){
    const S = BA().S;
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem('kp-extraction-draft:' + S.edcatId) || 'null'); } catch(e){}
    const list = (draft && draft.list) || [];
    if (!list.length) return alert('No hay emparejamientos extraídos guardados para esta categoría.\n\nCaptúralos en PreparacionEliminatoria.html → «Registrar emparejamiento extraído».');
    const valid = list.filter(x => x.valid !== false);
    const p = plan();
    const targets = p.slots.filter(s => s.roundId === p.mainRoundId).map(s => s.id);
    if (!targets.length) return alert('El sistema vigente no tiene ronda principal donde importar.');
    if (!confirm('Importar ' + valid.length + ' emparejamiento(s) válido(s) como dato visual en ' + p.mainRoundLabel.toLowerCase() + ' del borrador.\n\nSe sobrescriben los slots destino. Nada se guarda hasta «Guardar borrador».')) return;
    if (window.BKC_ED) window.BKC_ED.push();   // un solo paso de deshacer en el editor
    let placed = 0;
    const free = targets.slice();
    valid.forEach(x => {
      let slotId = null;
      const m = String(x.matchNo || '').match(/(\d+)/);
      if (m){ const i = parseInt(m[1], 10) - 1; if (i >= 0 && i < targets.length) slotId = targets[i]; }
      if (!slotId) slotId = free[0];
      if (!slotId) return;
      free.splice(free.indexOf(slotId), 1);
      const s = slotOf(slotId);
      s.slotType = 'MATCH'; s.visible = true;
      s.participantA = CFG.placeholder((x.a && x.a.name) || 'Por definir', (x.a && x.a.origin) || null);
      s.participantB = CFG.placeholder((x.b && x.b.name) || 'Por definir', (x.b && x.b.origin) || null);
      placed++;
    });
    if (window.BKC_ED) window.BKC_ED.commit(); else BA().markDirty();
    alert('Importados ' + placed + ' emparejamiento(s) como dato visual. Vincula participantes reales si lo necesitas y guarda el borrador.');
  }

  // ══════════════════════════════════════════════════════════════════════
  // EDITAR ENFRENTAMIENTO
  // ══════════════════════════════════════════════════════════════════════
  let editing = null;   // { slotId, work }

  function openSlot(slotId){
    const S = BA().S;
    if (S.view !== 'draft') return;
    if (slotId === 'champion' || slotId === 'runnerUp') return openWinner(slotId);
    editing = { slotId, work: clone(slotOf(slotId)) };
    drawSlotModal();
  }

  function partForm(side){
    const p = editing.work['participant' + side] || CFG.emptyParticipant();
    const logo = p.mode === 'REGISTRATION' && p.facultyLogo && window.SB_LOGOS
      ? window.SB_LOGOS.resolveForTable(p.facultyLogo, p.careerLogo, p.displayName || '').src : null;
    return `<div class="ba-part" data-side="${side}">
      <h4>${logo ? `<img src="${esc(logo)}" alt="">` : ''}Participante ${side}</h4>
      <div class="ba-fld"><label>Modo</label>
        <select data-f="mode">${['EMPTY','PLACEHOLDER','REGISTRATION','DERIVED'].map(m =>
          `<option value="${m}"${p.mode === m ? ' selected' : ''}>${{EMPTY:'Vacío',PLACEHOLDER:'Texto libre (Por definir, Ganador Grupo A…)',REGISTRATION:'Participante real',DERIVED:'Derivado de otro slot'}[m]}</option>`).join('')}</select></div>
      <div class="ba-fld"><label>Buscar inscripción real</label><input data-f="search" placeholder="Apodo…" autocomplete="off"><div class="ba-results" data-f="results"></div></div>
      <div class="ba-fld"><label>Nombre visible</label><input data-f="displayName" value="${esc(p.displayName || '')}"></div>
      <div class="ba-fld"><label>Texto de origen (ej. 1.º Grupo A / PASE DIRECTO)</label><input data-f="sourceLabel" value="${esc(p.sourceLabel || '')}"></div>
      <div class="ba-fld"><label>Grupo original (etiqueta)</label><input data-f="groupLabel" value="${esc(p.groupLabel || '')}" placeholder="A"></div>
      <div class="ba-row"><button class="ba-mini" data-act="clear${side}">Limpiar participante ${side}</button></div>
    </div>`;
  }

  function drawSlotModal(){
    const w = editing.work, id = editing.slotId;
    const v = CFG.slotView(w);
    const off = v.official;
    BA().openOverlay(`
      <h3>Editar enfrentamiento<small>${esc(w.label || CFG.SLOT_LABEL[id] || id)} · ${esc(ROUND_LABEL[w.roundId] || w.roundId || '')} · posición ${esc(w.positionNumber || '?')} · ${esc(BA().catLabel())}</small></h3>
      <div class="ba-row">
        <span class="ba-badge ${w.officialMatchId ? 'of' : 'man'}">${w.officialMatchId ? 'OFICIAL VINCULADO' : 'VISUAL MANUAL'}</span>
        <span class="ba-badge man">${w.visible === false ? 'OCULTA' : 'VISIBLE'}</span>
        <label class="ba-fld" style="width:190px"><span>Tipo de slot</span>
          <select id="bsType">${['MATCH','DIRECT_PASS','INFO'].map(t => `<option value="${t}"${(w.slotType||'MATCH')===t?' selected':''}>${{MATCH:'Enfrentamiento',DIRECT_PASS:'Descanso / BYE (pase directo)',INFO:'Informativo'}[t]}</option>`).join('')}</select></label>
        <label class="ba-fld" style="flex:1"><span>Texto de la tarjeta (ruta / pase directo)</span><input id="bsSource" value="${esc(w.sourceLabel || '')}"></label>
      </div>
      ${off ? `<div class="ba-note">Resultado OFICIAL: ${esc(off.nickA || '?')} ${off.setsA}–${off.setsB} ${esc(off.nickB || '?')} · ${esc(off.status)} — manda sobre el marcador manual.</div>` : ''}
      ${v.officialUnavailable ? `<div class="ba-note" style="color:var(--amber)">RESULTADO TEMPORALMENTE NO DISPONIBLE: el partido vinculado no se pudo leer. Se conserva el snapshot publicado.</div>` : ''}
      <div class="ba-cols">${partForm('A')}${partForm('B')}</div>
      <div class="ba-sec"><h4>Partido oficial (solo lectura · vincular no modifica nada)</h4>
        <div class="ba-row">
          <div class="ba-fld" style="flex:1"><label>officialMatchId (UUID de public.matches)</label><input id="bsOfficial" value="${esc(w.officialMatchId || '')}" placeholder="Sin vincular"></div>
          <button class="ba-mini" id="bsFind">Buscar partido publicado</button>
          <button class="ba-mini" id="bsUnlink">Desvincular</button>
        </div>
        <div class="ba-results" id="bsFindOut"></div>
        <div class="ba-note">Desvincular solo quita el vínculo del borrador: el partido y sus estadísticas permanecen intactos.</div>
      </div>
      <div class="ba-sec"><h4>Resultado visual (se ignora si hay partido oficial)</h4>
        <div class="ba-row">
          <div class="ba-fld"><label>Estado</label><select id="bsStatus">${CFG.STATUSES.map(s => `<option value="${s}"${(w.manualStatus||'PROVISIONAL')===s?' selected':''}>${s}</option>`).join('')}</select></div>
          <div class="ba-fld" style="width:90px"><label>Marcador A</label><input id="bsScoreA" type="number" min="0" value="${w.manualScoreA == null ? '' : w.manualScoreA}"></div>
          <div class="ba-fld" style="width:90px"><label>Marcador B</label><input id="bsScoreB" type="number" min="0" value="${w.manualScoreB == null ? '' : w.manualScoreB}"></div>
          <div class="ba-fld"><label>Ganador</label><select id="bsWinner"><option value=""${!w.manualWinnerSlot?' selected':''}>—</option><option value="A"${w.manualWinnerSlot==='A'?' selected':''}>A</option><option value="B"${w.manualWinnerSlot==='B'?' selected':''}>B</option></select></div>
          <button class="ba-mini" id="bsClear">Limpiar marcador</button>
        </div>
      </div>
      <div class="ba-sec"><h4>Acciones del slot</h4>
        <div class="ba-row">
          <button class="ba-mini" id="bsSwap">Intercambiar A ↔ B</button>
          <button class="ba-mini" id="bsFeed">Usar ganador/perdedor de slots conectados</button>
          <button class="ba-mini" id="bsHide">${w.visible === false ? 'Mostrar tarjeta' : 'Ocultar tarjeta'}</button>
          <button class="ba-mini" id="bsReset">Restablecer «Por definir»</button>
          <button class="ba-mini" id="bsWipe">Eliminar contenido visual</button>
        </div>
        <div class="ba-fld"><label>Notas administrativas (no se publican)</label><input id="bsNotes" value="${esc(w.notes || '')}"></div>
      </div>
      <div class="ba-actions">
        <button class="ba-btn" id="bsCancel">Cancelar</button>
        <button class="ba-btn gold" id="bsApply">Aplicar al borrador local</button>
      </div>`);
    wireSlotModal();
  }

  function readPart(side){
    const box = $('#baModal').querySelector(`.ba-part[data-side="${side}"]`);
    const p = editing.work['participant' + side] || (editing.work['participant' + side] = CFG.emptyParticipant());
    p.mode = box.querySelector('[data-f="mode"]').value;
    p.displayName = box.querySelector('[data-f="displayName"]').value.trim() || 'Por definir';
    p.sourceLabel = box.querySelector('[data-f="sourceLabel"]').value.trim() || null;
    p.groupLabel = box.querySelector('[data-f="groupLabel"]').value.trim() || null;
    if (p.mode !== 'REGISTRATION'){ p.registrationId = null; p.playerId = null; p.publicCode = null; p.facultyLogo = null; p.careerLogo = null; p.groupId = null; }
    return p;
  }
  function wireSearch(side){
    const box = $('#baModal').querySelector(`.ba-part[data-side="${side}"]`);
    const inp = box.querySelector('[data-f="search"]'), out = box.querySelector('[data-f="results"]');
    let t = null;
    inp.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
      const rows = await CFG.searchParticipants(BA().S.edcatId, inp.value.trim());
      out.innerHTML = rows.length ? rows.map((r, i) =>
        `<button data-i="${i}"><b>${esc(r.nickname)}</b><small>${esc(r.group_label ? 'Grupo ' + r.group_label + ' · ' : '')}${esc(r.faculty_code || '')}</small></button>`).join('')
        : '<span class="ba-note">Sin resultados en grupos publicados de esta categoría.</span>';
      out.querySelectorAll('button').forEach(b => b.onclick = () => {
        const r = rows[+b.dataset.i];
        editing.work['participant' + side] = CFG.participantFromRow(r, r.group_label ? 'Grupo ' + r.group_label : null);
        drawSlotModal();
      });
    }, 300); };
  }
  function wireSlotModal(){
    wireSearch('A'); wireSearch('B');
    ['A','B'].forEach(side => {
      const b = $('#baModal').querySelector(`[data-act="clear${side}"]`);
      if (b) b.onclick = () => { editing.work['participant' + side] = CFG.emptyParticipant(); drawSlotModal(); };
    });
    $('#bsUnlink').onclick = () => { $('#bsOfficial').value = ''; };
    $('#bsFind').onclick = async () => {
      const out = $('#bsFindOut');
      out.innerHTML = '<span class="ba-note">Buscando partidos publicados de la categoría…</span>';
      let rows = [];
      try {
        const { data } = await window.SB.from('v_public_groups_results')
          .select('match_id, group_label, player_a, player_b, status')
          .eq('edition_category_id', BA().S.edcatId).limit(40);
        rows = (data || []).filter(r => r.match_id);
      } catch(e){}
      if (!rows.length){ out.innerHTML = '<span class="ba-note">No se encontraron partidos publicados. Pega el UUID manualmente si lo tienes.</span>'; return; }
      out.innerHTML = rows.map((r, i) => `<button data-i="${i}"><b>${esc(r.player_a || '?')} vs ${esc(r.player_b || '?')}</b><small>Grupo ${esc(r.group_label || '')} · ${esc(r.status || '')}</small></button>`).join('');
      out.querySelectorAll('button').forEach(b => b.onclick = () => { $('#bsOfficial').value = rows[+b.dataset.i].match_id; out.innerHTML = '<span class="ba-note">Vínculo listo: se aplica al guardar en el borrador.</span>'; });
    };
    $('#bsClear').onclick = () => { $('#bsScoreA').value = ''; $('#bsScoreB').value = ''; $('#bsWinner').value = ''; $('#bsStatus').value = 'PROVISIONAL'; };
    $('#bsSwap').onclick = () => { readPart('A'); readPart('B');
      const a = editing.work.participantA; editing.work.participantA = editing.work.participantB; editing.work.participantB = a; drawSlotModal(); };
    $('#bsHide').onclick = () => { editing.work.visible = editing.work.visible === false; drawSlotModal(); };
    $('#bsReset').onclick = () => { if (!confirm('¿Restablecer este slot a «Por definir»?')) return;
      const keep = { id: editing.work.id, roundId: editing.work.roundId, positionNumber: editing.work.positionNumber,
        layout: editing.work.layout, label: editing.work.label };
      editing.work = Object.assign(CFG.emptySlot(editing.slotId), keep); drawSlotModal(); };
    $('#bsWipe').onclick = () => {
      if (!confirm('Eliminar el CONTENIDO VISUAL de esta tarjeta (participantes, marcador y vínculo).\n\nNo se borra ningún partido oficial ni estadística. ¿Continuar?')) return;
      const keep = { id: editing.work.id, roundId: editing.work.roundId, positionNumber: editing.work.positionNumber,
        visible: editing.work.visible, layout: editing.work.layout, label: editing.work.label };
      editing.work = Object.assign(CFG.emptySlot(editing.slotId), keep); drawSlotModal();
    };
    $('#bsFeed').onclick = () => {
      const c = cfg();
      const conns = (c.connections || []).filter(x => x.enabled !== false && x.toSlot === editing.slotId);
      if (!conns.length) return alert('Este slot no tiene conexiones entrantes activas.');
      let applied = 0;
      conns.forEach(x => {
        const v = CFG.slotView(c.slots[x.fromSlot]);
        if (!v.winner) return;
        const src = x.fromOutcome === 'LOSER' ? (v.winner === 'A' ? v.b : v.a) : (v.winner === 'A' ? v.a : v.b);
        if (!src || src.mode === 'EMPTY') return;
        editing.work['participant' + x.toParticipant] = clone(src);
        applied++;
      });
      if (!applied) alert('Los slots de origen todavía no tienen ganador definido.');
      drawSlotModal();
    };
    $('#bsCancel').onclick = () => { editing = null; BA().closeOverlay(); };
    $('#bsApply').onclick = () => {
      readPart('A'); readPart('B');
      const w = editing.work, c = cfg();
      const mid = $('#bsOfficial').value.trim();
      if (mid && !UUID_RE.test(mid)) return alert('officialMatchId no es un UUID válido.');
      if (mid !== (w.officialMatchId || '')) delete w.official;
      if (mid && Object.keys(c.slots).some(k => k !== editing.slotId && c.slots[k].visible !== false && c.slots[k].officialMatchId === mid))
        return alert('Ese partido oficial ya está vinculado a otra tarjeta visible.');
      w.officialMatchId = mid || null;
      w.slotType = $('#bsType').value;
      w.sourceLabel = $('#bsSource').value.trim();
      w.notes = $('#bsNotes').value.trim();
      w.manualStatus = $('#bsStatus').value;
      w.manualScoreA = $('#bsScoreA').value === '' ? null : Math.max(0, parseInt($('#bsScoreA').value, 10) || 0);
      w.manualScoreB = $('#bsScoreB').value === '' ? null : Math.max(0, parseInt($('#bsScoreB').value, 10) || 0);
      w.manualWinnerSlot = $('#bsWinner').value || null;
      c.slots[editing.slotId] = w;
      editing = null;
      BA().closeOverlay();
      BA().markDirty();
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // CAMPEÓN / SUBCAMPEÓN
  // ══════════════════════════════════════════════════════════════════════
  function openWinner(key){
    const c = cfg();
    const who = clone(c[key] || { mode:'DERIVED', sourceSlot:'final', sourceOutcome: key === 'champion' ? 'WINNER' : 'LOSER', displayName:'Por definir' });
    const fv = CFG.slotView(c.slots.final);
    const derived = CFG.derivedWinner(c, key);
    BA().openOverlay(`
      <h3>Editar ${esc(CFG.SLOT_LABEL[key])}<small>${esc(BA().catLabel())}</small></h3>
      <p class="ba-note">Por defecto se DERIVA de la final (campeón = ganador, subcampeón = perdedor). Si la final está vinculada a un partido oficial jugado, el resultado real manda y la vista pública lo deriva automáticamente.</p>
      <div class="ba-row">
        <label class="ba-fld" style="width:210px"><span>Modo</span><select id="bwMode">
          <option value="DERIVED"${who.mode==='DERIVED'?' selected':''}>Derivado de la final</option>
          <option value="PLACEHOLDER"${who.mode==='PLACEHOLDER'?' selected':''}>Texto manual</option>
          <option value="REGISTRATION"${who.mode==='REGISTRATION'?' selected':''}>Participante real (override)</option>
        </select></label>
        <label class="ba-fld" style="flex:1"><span>Nombre visible</span><input id="bwName" value="${esc(who.displayName || '')}"></label>
      </div>
      <div class="ba-note">Actualmente se mostraría: <b>${esc((derived && derived.displayName) || 'Por definir')}</b>${fv.winner ? '' : ' (la final aún no tiene ganador)'}</div>
      <div class="ba-row">
        <button class="ba-mini" id="bwWinner">Tomar ganador de la final</button>
        <button class="ba-mini" id="bwLoser">Tomar perdedor de la final</button>
        <button class="ba-mini" id="bwReset">Volver a derivado</button>
      </div>
      <div class="ba-actions"><button class="ba-btn" id="bwCancel">Cancelar</button><button class="ba-btn gold" id="bwApply">Aplicar al borrador local</button></div>`);
    const take = (outcome) => {
      if (!fv.winner) return alert('La final aún no tiene ganador en el borrador.');
      const p = outcome === 'WINNER' ? (fv.winner === 'A' ? fv.a : fv.b) : (fv.winner === 'A' ? fv.b : fv.a);
      $('#bwName').value = p.displayName || '';
      $('#bwMode').value = p.mode === 'REGISTRATION' ? 'REGISTRATION' : 'PLACEHOLDER';
      who.registrationId = p.registrationId || null;
      who.sourceOutcome = outcome;
      if (!confirm('Override manual del ' + (key === 'champion' ? 'campeón' : 'subcampeón') + '.\n\nAdvertencia: dejará de derivarse automáticamente del resultado oficial. ¿Continuar?')) {
        $('#bwMode').value = 'DERIVED';
      }
    };
    $('#bwWinner').onclick = () => take('WINNER');
    $('#bwLoser').onclick = () => take('LOSER');
    $('#bwReset').onclick = () => { $('#bwMode').value = 'DERIVED'; $('#bwName').value = 'Por definir'; who.registrationId = null; };
    $('#bwCancel').onclick = BA().closeOverlay;
    $('#bwApply').onclick = () => {
      who.mode = $('#bwMode').value;
      who.displayName = $('#bwName').value.trim() || 'Por definir';
      who.sourceSlot = who.sourceSlot || 'final';
      who.sourceOutcome = who.sourceOutcome || (key === 'champion' ? 'WINNER' : 'LOSER');
      if (who.mode !== 'REGISTRATION') who.registrationId = null;
      cfg()[key] = who;
      BA().closeOverlay();
      BA().markDirty();
    };
  }

  window.BA_SLOT = { importFromPrep, openSlot, openWinner };
})();
