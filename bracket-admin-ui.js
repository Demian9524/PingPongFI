// ── BracketAdmin · shell del editor (FASE 2) ─────────────────────────────
// Edita SOLO edition_category_bracket_config: borrador → publicación.
// Nunca crea/borra/modifica public.matches, nunca llama record_match_result,
// nunca sortea (el sorteo es físico: aquí se captura).
// El editor de tarjeta y la captura del sorteo viven en bracket-admin-slot.js.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const CFG = window.SB_BRACKETCFG, BKT = window.TORNEO_BKT;
  const CAT_LABEL = { principiante:'PRINCIPIANTE', intermedio:'INTERMEDIO', avanzado:'AVANZADO / OPEN' };
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Estado SOLO en memoria. localStorage nunca es fuente oficial.
  const S = { catKey:null, edcatId:null, data:null, cfg:null, baseline:null,
    view:'draft', dirty:false, rpcMissing:false, busy:false, conflict:false, warns:[], loadSeq:0 };

  // ── auth ──
  async function initAuth(){
    try { const { data } = await window.SB.auth.getSession(); if (data && data.session) return showApp(); } catch(e){}
    $('#baLogin').hidden = false;
  }
  $('#baSignIn').onclick = async () => {
    $('#baLoginMsg').textContent = 'Verificando…';
    const { error } = await window.SB.auth.signInWithPassword({ email: $('#baEmail').value.trim(), password: $('#baPass').value });
    if (error){ $('#baLoginMsg').textContent = 'Acceso denegado: ' + error.message; return; }
    showApp();
  };
  $('#baLogout').onclick = async () => { try { await window.SB.auth.signOut(); } catch(e){} location.reload(); };
  function showApp(){ $('#baLogin').hidden = true; $('#baApp').hidden = false; $('#baLogout').hidden = false; }

  // ── carga por categoría (siempre Number, nunca índices de arreglo) ──
  document.querySelectorAll('#baCats button').forEach(b => b.onclick = () => guardedSelect(b.dataset.cat));
  async function guardedSelect(key){
    if (key === S.catKey) return;
    if (!S.dirty) return selectCat(key);
    const choice = await unsavedDialog('Vas a cambiar a ' + CAT_LABEL[key] + '.');
    if (choice === 'stay') return;
    if (choice === 'save'){ const ok = await saveDraft(); if (!ok) return; }
    selectCat(key);
  }
  async function selectCat(key){
    const token = ++S.loadSeq;
    S.catKey = key; S.view = 'draft'; S.dirty = false; S.conflict = false;
    document.body.setAttribute('data-cat', key);
    document.querySelectorAll('#baCats button').forEach(b => b.classList.toggle('on', b.dataset.cat === key));
    $('#baEditing').hidden = false;
    $('#baEditing').textContent = 'EDITANDO BRACKET DE: ' + CAT_LABEL[key];
    $('#baSystem').hidden = true;
    $('#baBanner').hidden = true;
    BKT.renderSkeleton($('#bracket-cols'));
    const edcatId = await CFG.resolveEdcatId(key);
    if (token !== S.loadSeq) return;                       // categoría cambiada mientras cargaba
    S.edcatId = edcatId == null ? null : Number(edcatId);
    if (S.edcatId == null){
      banner('No se pudo resolver esta categoría en la edición activa (¿sin conexión o sin categorías publicadas?).');
      S.rpcMissing = true;
      S.data = { draft_config: CFG.emptyConfig({ categoryLabel: CAT_LABEL[key] }), draft_revision:0, published_config:null, published_revision:null };
    } else {
      const res = await CFG.adminGet(S.edcatId);
      if (token !== S.loadSeq) return;
      if (res.error){
        S.rpcMissing = res.error === 'RPC_MISSING';
        banner(S.rpcMissing
          ? 'Las RPC del bracket aún no existen en Supabase. Ejecuta sql/PROPUESTA_bracket_config_publicacion.sql y luego sql/PROPUESTA_bracket_lienzo_libre.sql (este último habilita el lienzo libre). Modo demostración local: NO se puede guardar ni publicar.'
          : 'Error al cargar la configuración: ' + res.error);
        S.data = { draft_config: CFG.emptyConfig({ categoryLabel: CAT_LABEL[key] }), draft_revision:0, published_config:null, published_revision:null };
      } else {
        S.rpcMissing = false;
        S.data = res.data;
        if (!S.data.draft_config) S.data.draft_config = CFG.emptyConfig({ categoryLabel: CAT_LABEL[key] });
      }
    }
    S.cfg = CFG.migrate(S.data.draft_config);
    S.cfg.header = S.cfg.header || {};
    S.cfg.header.categoryLabel = S.cfg.header.categoryLabel || CAT_LABEL[key];
    S.baseline = clone(S.cfg);
    renderAll();
  }
  function banner(msg){ const b = $('#baBanner'); b.hidden = false; b.textContent = msg; }

  // ── estado publicado/borrador ──
  function stateLabel(){
    if (S.conflict) return { txt:'CONFLICTO DE REVISIÓN', cls:'bad' };
    if (S.dirty) return { txt:'CAMBIOS LOCALES', cls:'warn' };
    if (!S.data) return { txt:'—', cls:'' };
    const pr = S.data.published_revision, dr = S.data.draft_revision;
    if (pr == null) return { txt:'BORRADOR GUARDADO · SIN PUBLICAR', cls:'warn' };
    if (pr !== dr) return { txt:'BORRADOR MÁS NUEVO QUE LA PUBLICACIÓN', cls:'warn' };
    return { txt:'PUBLICADO · SIN CAMBIOS', cls:'ok' };
  }

  function refreshStatus(){
    const st = stateLabel();
    $('#baStatus').innerHTML = 'Borrador rev <b>' + (S.data ? S.data.draft_revision : 0) + '</b> · Publicado rev <b>' +
      ((S.data && S.data.published_revision) || '—') + '</b> · <span class="tag ' + st.cls + '">' + st.txt + '</span>' +
      (S.data && S.data.published_at ? ' · última publicación ' + new Date(S.data.published_at).toLocaleString('es-MX') : '');

    const sys = CFG.buildPlan(S.cfg.format);
    if (sys){ const el = $('#baSystem'); el.hidden = false;
      el.textContent = (CFG.isFree(S.cfg) ? 'LLAVE A MANO · REFERENCIA: ' : 'SISTEMA: ') + sys.systemLabel + ' · ' + sys.bracketSize + ' EN LLAVE'; }
    S.warns = CFG.warnings(S.cfg);
    const w = $('#baWarn');
    if (!S.warns.length) w.hidden = true;
    else {
      w.hidden = false;
      const errs = S.warns.filter(x => x.level === 'error').length;
      w.innerHTML = '<b>' + (errs ? errs + ' error(es) y ' : '') + (S.warns.length - errs) +
        ' aviso(s) — no bloquean, pero publicar exige confirmación y motivo</b><ul>' +
        S.warns.map(x => '<li><code>' + esc(x.code) + '</code> ' + esc(x.msg) + '</li>').join('') + '</ul>';
    }
    ['baSave','baPublish','baRestore','baReset'].forEach(id => { const b = $('#'+id); if (b) b.disabled = S.rpcMissing || !S.edcatId; });
    $('#baDiscard').disabled = !S.dirty;
    syncEditorBar(st);
    if (window.BKC_ED) window.BKC_ED.renderBar();
  }

  // La barra de guardado vive TAMBIÉN al pie del lienzo: es donde se trabaja.
  // Refleja el estado de la de arriba y delega en sus mismos botones.
  function syncEditorBar(st){
    const box = $('#bkcSaveSt');
    if (!box) return;
    box.innerHTML = '<span class="tag ' + st.cls + '">' + st.txt + '</span> · borrador rev <b>' +
      (S.data ? S.data.draft_revision : 0) + '</b> · publicado rev <b>' + ((S.data && S.data.published_revision) || '—') + '</b>';
    const off = S.rpcMissing || !S.edcatId;
    const set = (id, dis) => { const b = $('#'+id); if (b) b.disabled = dis; };
    set('bkcSaveBtn', off); set('bkcPublish', off); set('bkcValidate', !S.edcatId);
    set('bkcDiscard', !S.dirty); set('bkcImportPrep', !S.edcatId || S.view !== 'draft');
  }
  const MIRROR = { bkcSaveBtn:'baSave', bkcPublish:'baPublish', bkcDiscard:'baDiscard', bkcValidate:'baValidate' };
  Object.keys(MIRROR).forEach(id => {
    const b = $('#'+id);
    if (b) b.onclick = () => { const o = $('#'+MIRROR[id]); if (o && !o.disabled) o.click(); };
  });
  const impBtn = $('#bkcImportPrep');
  if (impBtn) impBtn.onclick = () => window.BA_SLOT && window.BA_SLOT.importFromPrep();

  function renderAll(){
    $('#baTools').hidden = false; $('#baView').hidden = false;
    document.querySelectorAll('#baView button').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
    const host = $('#bracket-cols');
    const showingDraft = S.view === 'draft';
    const editor = window.BKC_ED && window.FI_BKT_CANVAS;
    if (showingDraft && editor){
      // El borrador SIEMPRE se edita en el lienzo libre.
      $('#bracket').hidden = true;
      window.BKC_ED.mount();
    } else {
      $('#bracket').hidden = false;
      if (window.BKC_ED) window.BKC_ED.unmount();
      const cfg = showingDraft ? S.cfg : (S.data && S.data.published_config) || null;
      if (!cfg) BKT.renderNotPublished(host);
      else BKT.render(host, cfg, { editable: showingDraft, source: showingDraft ? 'draft' : 'published',
        catLabel: (cfg.header && cfg.header.categoryLabel) || CAT_LABEL[S.catKey],
        onEditSlot: id => window.BA_SLOT && window.BA_SLOT.openSlot(id) });
      const foot = cfg && cfg.header && cfg.header.footerText;
      if (foot) $('#baGloria').textContent = foot;
    }

    refreshStatus();
    $('#baFormat').hidden = false;
    renderFormat();
  }
  document.querySelectorAll('#baView button').forEach(b => b.onclick = () => { S.view = b.dataset.view; renderAll(); });

  // ── SISTEMA DEL CUADRO (se decide ANTES de sortear) ──
  // El formato manda: número de grupos → reglamento → estructura del cuadro.
  // El dibujo se reconstruye solo; aquí nunca se colocan participantes.
  const MAIN_ROUNDS = [['FINAL','Final (llave de 2)'],['SEMIFINAL','Semifinal (llave de 4)'],
    ['QUARTERFINAL','Cuartos (llave de 8)'],['ROUND_OF_16','Octavos (llave de 16)'],['ROUND_OF_32','Dieciseisavos (llave de 32)']];
  const DRAW_METHODS = [['PHYSICAL_THREE_POTS_AND_POSITION_BOX','Físico · Bombos 1/2/3 + caja de posiciones'],
    ['PHYSICAL_TWO_POTS_AND_POSITION_BOX','Físico · 2 bombos + caja de posiciones (formato anterior)'],
    ['PHYSICAL_SINGLE_POT','Físico · un bombo'],['MANUAL_ORGANIZER','Colocación manual documentada']];
  const SYSTEM_KEYS = ['groupCount','qualifiedCount','bracketSize','mainRound','hasAccessRound',
    'accessMatchCount','directPassCount','bestThirdsCount','systemSource'];

  function parseSizes(v){
    return String(v || '').split(/[^0-9]+/).filter(Boolean).map(Number).filter(x => x >= 2 && x <= 8);
  }
  // Cambiar el sistema crea u oculta tarjetas. Si el CONJUNTO de nodos visibles
  // cambia —p. ej. aparece la ronda de acceso antes de cuartos— hay que rehacer
  // el reparto completo: si no, las tarjetas nuevas caen donde quepa y el cuadro
  // pierde su geometría (misma distancia entre todas las columnas). El reparto
  // se rehace con el del formato, que es el del cuadro publicado.
  const visKey = () => Object.keys(S.cfg.slots || {})
    .filter(id => S.cfg.slots[id] && S.cfg.slots[id].visible !== false).sort().join(',');
  function applyFormat(){
    const before = visKey();
    const ED0 = window.BKC_ED;
    if (ED0 && ED0.push) ED0.push();
    CFG.applySystem(S.cfg, S.cfg.format);
    const CV = window.FI_BKT_CANVAS;
    if (CV && before !== visKey()){
      try {
        CV.layoutFromPlan(S.cfg, CFG.buildPlan(S.cfg.format), { rebuildEdges:true });
        S.cfg.layoutKey = S.cfg.layout = CV.LAYOUT_KEY;
      } catch (e){ /* sin plan utilizable se deja como está */ }
      const ED = window.BKC_ED;
      if (ED && ED.paint){ ED.paint(); if (ED.fitAll) ED.fitAll(); }
    }
    markDirty();
  }
  function applySystem(patch){
    const f = S.cfg.format;
    SYSTEM_KEYS.forEach(k => { if (patch[k] !== undefined) f[k] = patch[k]; });
    applyFormat();
  }
  function recNow(){
    const f = S.cfg.format || {};
    const sizes = Array.isArray(f.effectiveSizes) ? f.effectiveSizes : parseSizes(f.effectiveSizes);
    return CFG.recommendFormat(f.groupCount, sizes.length === Number(f.groupCount) ? sizes : null);
  }

  function renderFormat(){
    const f = S.cfg.format || (S.cfg.format = CFG.defaultFormat());
    const plan = CFG.buildPlan(f);
    const rec = recNow();
    const matches = rec && plan && rec.bracketSize === plan.bracketSize &&
      !!rec.hasAccessRound === !!plan.hasAccess && Number(rec.accessMatchCount) === Number(plan.accessMatches);
    const kpi = (v, l) => `<div class="ba-kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const flow = [].concat(
      plan.hasAccess ? [[(f.accessRoundLabel || 'Acceso'), plan.accessMatches + ' partidos']] : [],
      plan.rounds.map(r => [r.label, r.matches + (r.matches === 1 ? ' partido' : ' partidos')]));

    $('#baFormat').innerHTML = `
      <h3>Sistema del cuadro<small>Se decide ANTES del sorteo: define cuántas rondas se juegan, quién descansa y cómo se dibuja la llave.</small></h3>
      <div class="ba-grid">
        <label class="ba-fld"><span>Cantidad de grupos</span><input type="number" min="2" max="10" id="bfGroups" value="${f.groupCount == null ? '' : f.groupCount}" placeholder="2 a 10"></label>
        <label class="ba-fld"><span>Tamaños efectivos (opcional)</span><input id="bfSizes" value="${esc(Array.isArray(f.effectiveSizes) ? f.effectiveSizes.join('–') : (f.effectiveSizes || ''))}" placeholder="4–4–4–5"></label>
        <label class="ba-fld"><span>Clasificados que entran al cuadro</span><input value="${plan.hasAccess ? (plan.directPasses + plan.accessMatches * 2) + ' (' + plan.directPasses + ' descansan · ' + (plan.accessMatches * 2) + ' juegan acceso)' : plan.bracketSize + ' (todos a ' + plan.mainRoundLabel.toLowerCase() + ')'}" readonly></label>
      </div>
      <div class="ba-sys ${matches ? 'ok' : 'off'}">
        <div class="ba-sys-h"><b>${esc(plan.systemLabel)}</b>${rec && rec.tag ? `<span class="tag">${esc(rec.tag)}</span>` : ''}
          <span class="spacer"></span><span class="ba-sys-st">${matches ? 'El cuadro dibujado coincide con el reglamento' : 'Sistema puesto a mano'}</span></div>
        <p class="ba-sys-p">${esc(rec && rec.plain ? rec.plain : plan.systemLine)}</p>
        <div class="ba-kpis">${kpi(plan.bracketSize, 'Llave principal')}${kpi(plan.directPasses, 'Pases directos (descansan)')}${kpi(plan.accessMatches, 'Partidos de acceso')}${kpi(f.bestThirdsCount || 0, 'Terceros incluidos')}${kpi(plan.totalMatches, 'Partidos del cuadro')}</div>
        <div class="ba-flow">${flow.map(x => `<span><b>${esc(x[0])}</b><i>${esc(x[1])}</i></span>`).join('<em>→</em>')}</div>
      </div>
      ${rec ? `<div class="ba-rec"><b>Reglamento para ${rec.groupCount} grupos:</b> ${esc(rec.note)}
        ${matches ? '' : ' <button class="ba-mini" id="baApplyRec">Aplicar y redibujar el cuadro</button>'}
        ${(rec.engineWarnings || []).length ? '<br><span style="color:var(--amber)">' + esc(rec.engineWarnings[0]) + '</span>' : ''}</div>`
        : `<div class="ba-rec">Escribe la cantidad de grupos: el sistema, la ronda de acceso y el dibujo del cuadro se calculan solos con el reglamento (2 a 10 grupos).</div>`}
      <details class="ba-adv"${f.systemSource === 'MANUAL' ? ' open' : ''}><summary>Ajustes manuales del formato (avanzado)</summary>
      <div class="ba-grid" style="margin-top:10px">
        <label class="ba-fld"><span>Ronda principal</span><select data-fmt="mainRound">${MAIN_ROUNDS.map(r => `<option value="${r[0]}"${f.mainRound===r[0]?' selected':''}>${r[1]}</option>`).join('')}</select></label>
        <label class="ba-fld"><span>Ronda de acceso</span><select data-fmt="hasAccessRound"><option value="false"${!f.hasAccessRound?' selected':''}>No se juega</option><option value="true"${f.hasAccessRound?' selected':''}>Sí se juega</option></select></label>
        <label class="ba-fld"><span>Partidos de acceso</span><input type="number" min="0" max="16" data-fmt="accessMatchCount" value="${f.accessMatchCount == null ? '' : f.accessMatchCount}"></label>
        <label class="ba-fld"><span>Mejores terceros incluidos</span><input type="number" min="0" max="16" data-fmt="bestThirdsCount" value="${f.bestThirdsCount == null ? '' : f.bestThirdsCount}"></label>
        <label class="ba-fld"><span>Texto de la ronda de acceso</span><input data-fmt="accessRoundLabel" value="${esc(f.accessRoundLabel || '')}"></label>
        <label class="ba-fld"><span>Método de sorteo</span><select data-fmt="drawMethod">${DRAW_METHODS.map(r => `<option value="${r[0]}"${f.drawMethod===r[0]?' selected':''}>${r[1]}</option>`).join('')}</select></label>
        <label class="ba-fld"><span>Cruce del mismo grupo</span><select data-fmt="sameGroupRematchBlocked"><option value="true"${f.sameGroupRematchBlocked!==false?' selected':''}>Evitar (advertir)</option><option value="false"${f.sameGroupRematchBlocked===false?' selected':''}>Permitir sin advertencia</option></select></label>
      </div>
      <p class="ba-note">Los pases directos se derivan de la estructura: llave menos ganadores de acceso. No se escriben a mano.</p></details>
      <p class="ba-note">Un pase directo NO es un partido: no suma victoria, sets ni estadísticas — solo indica quién descansa la ronda de acceso. Cambiar el sistema reconstruye las tarjetas y conserva lo ya capturado en las que siguen existiendo.</p>`;

    const groups = $('#bfGroups'), sizes = $('#bfSizes');
    const recalc = () => {
      const g = groups.value === '' ? null : Math.max(0, parseInt(groups.value, 10) || 0);
      S.cfg.format.groupCount = g;
      S.cfg.format.effectiveSizes = parseSizes(sizes.value);
      const r = recNow();
      if (r) applySystem(pickSystem(r));
      else markDirty();
    };
    groups.onchange = recalc;
    sizes.onchange = recalc;
    $('#baFormat').querySelectorAll('[data-fmt]').forEach(el => el.onchange = () => {
      const k = el.dataset.fmt;
      let v = el.value;
      if (el.type === 'number') v = v === '' ? null : Math.max(0, parseInt(v, 10) || 0);
      else if (v === 'true' || v === 'false') v = v === 'true';
      S.cfg.format[k] = v;
      S.cfg.format.systemSource = 'MANUAL';
      if (k === 'mainRound') S.cfg.format.bracketSize = CFG.TOPO.SIZE_OF_CODE[v] || 8;
      applyFormat();
    });
    const btn = $('#baApplyRec');
    if (btn) btn.onclick = () => {
      const r = recNow();
      if (!r) return;
      if (!confirm('Aplicar el sistema del reglamento y REDIBUJAR el cuadro.\n\nSe crean/ocultan tarjetas según el formato. No coloca participantes ni crea partidos; lo ya capturado en las tarjetas que siguen existiendo se conserva.')) return;
      applySystem(pickSystem(r));
    };
  }
  function pickSystem(rec){
    const out = {};
    SYSTEM_KEYS.forEach(k => { if (rec[k] !== undefined) out[k] = rec[k]; });
    out.systemSource = 'ENGINE';
    return out;
  }

  // ── acciones de borrador / publicación ──
  function markDirty(){ S.dirty = true; S.conflict = false; renderAll(); }
  // Igual, pero sin repintar el lienzo (lo usa el editor, que ya se repintó).
  function markDirtyQuiet(){ S.dirty = true; S.conflict = false; refreshStatus(); }

  function errorHint(err){
    const s = String(err || '');
    if (/BAD_LAYOUT|UNKNOWN_SLOT|BAD_NODE_ID|CANVAS_REQUIRED|NODE_WITHOUT_LAYOUT|CANVAS_NOT_OBJECT/.test(s))
      return s + '\n\nSi ya corriste sql/PROPUESTA_bracket_lienzo_libre.sql: el catálogo de slots de 16/32 (sql/PROPUESTA_bracket_slots_16_32.sql) puede estar desactualizado en Supabase — ejecútalo. Si aún no corriste ninguno de los dos, empieza por sql/PROPUESTA_bracket_lienzo_libre.sql.';
    if (/ROUND_NOT_FOUND/.test(s))
      return s + '\n\nRecarga la página (este archivo ya se corrigió: el lienzo libre no sincronizaba cfg.rounds al sembrar nodos de una ronda nueva). Si persiste después de recargar, ábrelo y vuelve a intentar «Guardar borrador».';
    if (/GRAPH_HAS_CYCLE|TOO_MANY_OUTGOING|TOO_MANY_INCOMING|SPOT_ALREADY_FED|SPOT_SEEDED_AND_FED/.test(s))
      return s + '\n\nUsa «Validar llave»: el editor te señala el nodo exacto.';
    if (/PARTICIPANT_NOT_IN_CATEGORY/.test(s))
      return s + '\n\nEse participante no pertenece a la categoría que estás editando: quítalo del nodo o corrige su inscripción.';
    if (/SAME_PARTICIPANT_TWICE/.test(s))
      return s + '\n\nUn enfrentamiento no puede tener a la misma persona en los dos espacios.';
    if (/NOT_FREE_CANVAS/.test(s))
      return s + '\n\nEsta llave todavía no está en formato de lienzo libre: ábrela en el editor y guarda el borrador una vez.';
    return s;
  }

  async function saveDraft(){
    if (S.busy || S.rpcMissing || !S.edcatId) return false;
    const reason = await promptDialog('Guardar borrador', 'Motivo del guardado (obligatorio, queda en auditoría):', 'Captura del sorteo físico');
    if (reason == null) return false;
    if (!reason.trim()){ alert('El motivo es obligatorio.'); return false; }
    S.busy = true;
    let res;
    try {
      res = await CFG.saveDraft(S.edcatId, S.cfg, S.data.draft_revision, reason.trim());
    } catch(e){
      S.busy = false;
      alert('No se pudo guardar (error inesperado): ' + (e && e.message || e));
      return false;
    }
    S.busy = false;
    if (res.error === 'REVISION_CONFLICT') return conflict(), false;
    if (res.error){ alert('No se pudo guardar: ' + errorHint(res.error)); return false; }
    // se repinta desde la respuesta oficial (sin pintado optimista)
    const again = await CFG.adminGet(S.edcatId);
    if (!again.error){ S.data = again.data; S.cfg = CFG.migrate(S.data.draft_config); }
    S.baseline = clone(S.cfg); S.dirty = false;
    renderAll();
    return true;
  }
  $('#baSave').onclick = () => saveDraft();

  // ── Descargar imagen del cuadro ──────────────────────────────────────
  // Disponible en cualquier momento del torneo: exporta lo que se está
  // viendo (borrador en el editor o vista publicada) como PNG para compartir.
  const imgBtn = $('#baImage');
  if (imgBtn) imgBtn.onclick = () => {
    const inEditor = S.view === 'draft' && window.BKC_ED;
    const stage = inEditor
      ? document.querySelector('#baCanvas .bkc-stage')
      : (document.querySelector('#bracket-cols .bkc-stage') || document.querySelector('#bracket-cols .mbk-in'));
    if (!stage){
      alert('Todavía no hay cuadro en pantalla para descargar.');
      return;
    }
    if (!window.BKC_ED || !window.BKC_ED.exportImage){
      alert('No se pudo preparar la imagen: falta el módulo del lienzo.');
      return;
    }
    window.BKC_ED.exportImage(stage);
  };

  const valBtn = $('#baValidate');
  if (valBtn) valBtn.onclick = () => {
    if (window.BKC_ED && S.view === 'draft') return window.BKC_ED.validate(true);
    const list = CFG.warnings(S.cfg);
    alert(list.length ? list.length + ' observación(es):\n\n' + list.map(x => '· ' + x.msg).join('\n')
      : 'La llave no tiene observaciones.');
  };

  $('#baDiscard').onclick = () => {
    if (!confirm('¿Descartar los cambios locales no guardados y volver al borrador guardado?')) return;
    S.cfg = clone(S.baseline); S.dirty = false; renderAll();
  };

  // Resumen legible del plan de materialización (qué partidos se tocan)
  // El validador del servidor puede ver observaciones que el editor local no
  // calcula. En ese caso el diálogo no dibujó la casilla de confirmación y el
  // usuario quedaba atrapado: aquí la inyectamos al vuelo para poder reintentar.
  function forceCheck(id, label, rawErr, note){
    const modal = $('#baModal'); if (!modal) return;
    const existing = modal.querySelector('#' + id);
    if (existing){
      const lbl = existing.closest('label');
      if (lbl){ lbl.style.outline = '2px solid var(--amber, #f0b429)'; lbl.style.outlineOffset = '4px'; lbl.style.borderRadius = '6px'; }
      return;
    }
    const detail = String(rawErr || '').replace(/^[A-Z_]+[:\s-]*/, '').trim();
    const box = document.createElement('div');
    box.className = 'ba-warnbox';
    box.style.borderColor = 'color-mix(in srgb,var(--amber,#f0b429) 55%,transparent)';
    box.innerHTML = '<b>' + esc(note || '') + '</b>' + (detail ? '<ul><li><code>' + esc(detail) + '</code></li></ul>' : '') +
      '<label class="ba-check"><input type="checkbox" id="' + id + '"> ' + label + '</label>';
    const actions = modal.querySelector('.ba-actions');
    if (actions && actions.parentNode) actions.parentNode.insertBefore(box, actions);
    else modal.appendChild(box);
  }

  function planBox(p){
    if (!p) return '';
    if (p.missing) return `<div class="ba-warnbox"><b>La publicación NO creará partidos oficiales.</b><ul><li>Falta ejecutar <code>sql/PROPUESTA_bracket_publicar_partidos.sql</code> en Supabase. Mientras tanto se publica solo el dibujo de la llave: la página pública la muestra, pero los enfrentamientos no existen en <code>matches</code>.</li></ul></div>`;
    const acts = (p.actions || []).filter(a => a.action === 'BLOCKED');
    const orph = (p.orphans || []);
    const del = orph.filter(o => o.action === 'DELETE').length;
    const keep = orph.filter(o => o.action !== 'DELETE');
    return `<div class="ba-plan">
      <b>Partidos oficiales de esta llave</b>
      <div class="ba-kpis">
        <div class="ba-kpi"><b>${p.toCreate || 0}</b><span>Se crean</span></div>
        <div class="ba-kpi"><b>${p.toUpdate || 0}</b><span>Se actualizan</span></div>
        <div class="ba-kpi"><b>${p.byes || 0}</b><span>Descansos (sin partido)</span></div>
        <div class="ba-kpi"><b>${del}</b><span>Se eliminan (nunca jugados)</span></div>
      </div>
      ${acts.length ? '<ul class="ba-planlist">' + acts.map(a =>
        `<li class="bad"><b>${esc(a.label || a.node)}</b> ${esc(a.reason || '')}</li>`).join('') + '</ul>' : ''}
      ${keep.length ? '<ul class="ba-planlist">' + keep.map(o =>
        `<li class="bad"><b>${esc(o.node)}</b> ya no está en el lienzo pero tiene resultado: se conserva el partido y solo se desvincula.</li>`).join('') + '</ul>' : ''}
    </div>`;
  }

  $('#baPublish').onclick = async () => {
    if (S.busy || S.rpcMissing || !S.edcatId) return;
    if (S.dirty) return alert('Hay cambios locales sin guardar. Usa «Guardar borrador» antes de publicar.');
    if (window.BKC_ED && S.view === 'draft') window.BKC_ED.validate(false);
    S.warns = CFG.warnings(S.cfg);
    const pr = CFG.isFree(S.cfg) ? await CFG.publishPlan(S.edcatId) : { missing:true };
    const plan = pr.missing ? { missing:true } : pr.plan;
    const canMatches = !pr.missing && !pr.error;
    const risky = canMatches && Number(plan.blocked || 0) > 0;
    const sum = CFG.summary(S.cfg);
    const all = S.warns || [];
    const errs = all.filter(x => x.level === 'error');
    const warns = all.filter(x => x.level !== 'error');
    const free = CFG.isFree(S.cfg);
    const li = x => '<li>' + esc(x.msg) + '</li>';
    const body = `
      <h3>Publicar bracket<small>La página pública mostrará exactamente este borrador</small></h3>
      <dl class="ba-dl">
        <div><dt>Categoría</dt><dd>${esc(CAT_LABEL[S.catKey])}</dd></div>
        <div><dt>Sistema</dt><dd>${esc(sum.system)}</dd></div>
        <div><dt>Layout</dt><dd>${esc(S.cfg.layoutKey || 'MIRRORED_8_DIRECT')}</dd></div>
        <div><dt>Borrador</dt><dd>revisión ${S.data.draft_revision}</dd></div>
        <div><dt>${free ? 'Nodos en el lienzo' : 'Slots visibles'}</dt><dd>${sum.visibleSlots}</dd></div>
        ${free ? `<div><dt>Conexiones</dt><dd>${sum.edges}</dd></div>
        <div><dt>Espacios sin definir</dt><dd>${sum.freeSpots}</dd></div>` : ''}
        <div><dt>Partidos oficiales vinculados</dt><dd>${sum.linkedMatches}</dd></div>
        <div><dt>${free ? 'Descansos (BYE)' : 'Pases directos (descansan)'}</dt><dd>${sum.directPasses}</dd></div>
        ${free ? '' : `<div><dt>Tarjetas manuales</dt><dd>${sum.manualCards}</dd></div>
        <div><dt>Partidos de acceso</dt><dd>${sum.accessMatches}</dd></div>`}
      </dl>
      ${errs.length ? '<div class="ba-warnbox" style="border-color:color-mix(in srgb,var(--red2) 55%,transparent)"><b>' + errs.length +
        ' error(es) de la llave — revisa antes de publicar:</b><ul>' + errs.map(li).join('') + '</ul></div>' : ''}
      ${warns.length ? '<div class="ba-warnbox"><b>' + warns.length + ' aviso(s):</b><ul>' + warns.map(li).join('') + '</ul></div>' : ''}
      ${planBox(plan)}
      ${all.length ? '<label class="ba-check"><input type="checkbox" id="bpAck"> Confirmo publicar aun con ' +
        (errs.length ? 'errores' : 'avisos') + '</label>' : ''}
      ${canMatches ? '<label class="ba-check"><input type="checkbox" id="bpMatches" checked> Crear y actualizar los partidos oficiales con esta estructura</label>' : ''}
      ${risky ? '<label class="ba-check"><input type="checkbox" id="bpAckRes"> Entiendo que hay enfrentamientos con resultado guardado: <b>el marcador se conserva</b>, pero el vínculo con la llave cambia</label>' : ''}
      <label class="ba-fld"><span>Motivo de la publicación (obligatorio)</span><input id="bpReason" value="Publicación del bracket"></label>
      <div class="ba-actions"><button class="ba-btn" id="bpCancel">Cancelar</button><button class="ba-btn primary" id="bpGo">Publicar</button></div>`;
    openOverlay(body);
    $('#bpCancel').onclick = closeOverlay;
    $('#bpGo').onclick = async () => {
      const reason = ($('#bpReason').value || '').trim();
      if (!reason) return alert('El motivo es obligatorio.');
      const ack = $('#bpAck') ? $('#bpAck').checked : false;
      if (all.length && !ack) return alert('Marca la confirmación para poder publicar con ' + (errs.length ? 'errores' : 'avisos') + '.');
      const withMatches = $('#bpMatches') ? $('#bpMatches').checked : false;
      const ackRes = $('#bpAckRes') ? $('#bpAckRes').checked : false;
      if (risky && withMatches && !ackRes)
        return alert('Hay enfrentamientos con resultado guardado. Marca la confirmación o desmarca «Crear y actualizar los partidos oficiales».');
      S.busy = true;
      const res = withMatches
        ? await CFG.publishWithMatches(S.edcatId, S.data.draft_revision, reason, ack, ackRes)
        : await CFG.publish(S.edcatId, S.data.draft_revision, reason, ack);
      S.busy = false;
      if (res.error === 'REVISION_CONFLICT'){ closeOverlay(); return conflict(); }
      if (String(res.error || '').indexOf('VALIDATION_WARNING') === 0){
        forceCheck('bpAck', 'Confirmo publicar aun con las observaciones del servidor', res.error,
          'El servidor detectó observaciones que el editor no marcó.');
        alert('El servidor detectó observaciones. Marca la confirmación que acaba de aparecer en el diálogo y pulsa «Publicar» otra vez.'); return; }
      if (String(res.error || '').indexOf('RESULTS_AT_RISK') === 0){
        forceCheck('bpAckRes', 'Entiendo que hay enfrentamientos con resultado guardado: <b>el marcador se conserva</b>, pero el vínculo con la llave cambia', res.error,
          'El servidor bloqueó la publicación: hay enfrentamientos con resultado guardado cuyos participantes cambian.');
        alert('Hay partidos con resultado guardado. Marca la confirmación que acaba de aparecer en el diálogo y pulsa «Publicar» otra vez, o desmarca «Crear y actualizar los partidos oficiales».'); return; }
      if (res.error) return alert('No se pudo publicar: ' + errorHint(res.error));
      closeOverlay();
      const again = await CFG.adminGet(S.edcatId);
      if (!again.error){ S.data = again.data; S.cfg = CFG.migrate(S.data.draft_config); S.baseline = clone(S.cfg); }
      CFG.invalidate(S.edcatId);
      renderAll();
      const d = res.data || {};
      alert('Publicado (revisión ' + d.published_revision + '). La página pública ya muestra esta versión.' +
        (withMatches ? '\n\nPartidos oficiales: ' + (d.created || 0) + ' creados · ' + (d.updated || 0) + ' actualizados · ' +
          (d.deleted || 0) + ' eliminados · ' + (d.links || 0) + ' llaves enlazadas. Los descansos no generaron partido.' : ''));
    };
  };

  $('#baRestore').onclick = async () => {
    if (!S.data || !S.data.published_config) return alert('No hay versión publicada de la cual restaurar.');
    if (!confirm('¿Reemplazar el borrador con la versión PUBLICADA? Se pierden los cambios del borrador.')) return;
    const reason = await promptDialog('Restaurar publicado', 'Motivo (obligatorio):', 'Restaurar desde publicado');
    if (!reason || !reason.trim()) return;
    const res = await CFG.restorePublished(S.edcatId, S.data.draft_revision, reason.trim());
    if (res.error === 'REVISION_CONFLICT') return conflict();
    if (res.error) return alert('No se pudo restaurar: ' + res.error);
    S.dirty = false; selectCat(S.catKey);
  };

  $('#baReset').onclick = async () => {
    if (!confirm('RESETEAR el borrador a la plantilla vacía (todos los slots «Por definir»).\n\nNo afecta la versión publicada ni ningún partido. ¿Continuar?')) return;
    const reason = await promptDialog('Resetear borrador', 'Motivo (obligatorio):', 'Reinicio del borrador');
    if (!reason || !reason.trim()) return;
    const res = await CFG.resetDraft(S.edcatId, S.data.draft_revision, reason.trim());
    if (res.error === 'REVISION_CONFLICT') return conflict();
    if (res.error) return alert('No se pudo resetear: ' + res.error);
    S.dirty = false; selectCat(S.catKey);
  };

  function conflict(){
    S.conflict = true; S.dirty = false;
    alert('CONFLICTO DE REVISIÓN: otra pestaña o persona modificó este bracket. Se recargará la versión más reciente del servidor.');
    selectCat(S.catKey);
  }

  // ── overlay / diálogos propios (sin depender de confirm nativo para salir) ──
  function openOverlay(html){ $('#baModal').innerHTML = html; $('#baOverlay').classList.add('open'); }
  function closeOverlay(){ $('#baOverlay').classList.remove('open'); $('#baModal').innerHTML = ''; }
  $('#baOverlay').addEventListener('click', e => { if (e.target === $('#baOverlay')) closeOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

  function promptDialog(title, label, value){
    return new Promise(resolve => {
      openOverlay(`<h3>${esc(title)}</h3>
        <label class="ba-fld"><span>${esc(label)}</span><input id="bdVal" value="${esc(value || '')}"></label>
        <div class="ba-actions"><button class="ba-btn" id="bdNo">Cancelar</button><button class="ba-btn gold" id="bdYes">Continuar</button></div>`);
      $('#bdVal').focus();
      $('#bdNo').onclick = () => { closeOverlay(); resolve(null); };
      $('#bdYes').onclick = () => { const v = $('#bdVal').value; closeOverlay(); resolve(v); };
    });
  }
  function unsavedDialog(context){
    return new Promise(resolve => {
      openOverlay(`<h3>Cambios sin guardar<small>${esc(context || '')}</small></h3>
        <p class="ba-note">El borrador tiene cambios locales que aún no están en Supabase. Elige qué hacer.</p>
        <div class="ba-actions">
          <button class="ba-btn" id="buStay">Permanecer aquí</button>
          <button class="ba-btn" id="buDrop">Descartar cambios</button>
          <button class="ba-btn gold" id="buSave">Guardar borrador</button>
        </div>`);
      $('#buStay').onclick = () => { closeOverlay(); resolve('stay'); };
      $('#buDrop').onclick = () => { closeOverlay(); resolve('drop'); };
      $('#buSave').onclick = () => { closeOverlay(); resolve('save'); };
    });
  }

  window.addEventListener('resize', () => requestAnimationFrame(() => BKT.drawConnectors($('#bracket'))));
  const bkt = document.querySelector('#bracket .bkt');
  if (bkt) bkt.addEventListener('scroll', () => requestAnimationFrame(() => BKT.drawConnectors($('#bracket'))), { passive:true });
  window.addEventListener('beforeunload', e => { if (S.dirty){ e.preventDefault(); e.returnValue = ''; } });

  // contexto compartido con bracket-admin-slot.js
  window.BA = { S, CFG, BKT, CAT_LABEL, esc, clone, renderAll, markDirty, markDirtyQuiet, refreshStatus,
    openOverlay, closeOverlay, promptDialog, banner,
    catLabel: () => CAT_LABEL[S.catKey] || '' };

  initAuth();
})();
