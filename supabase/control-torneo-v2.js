// ── Centro de control del torneo (ControlTorneo.html) ──────────────────
// Dashboard operativo solo para organizadores autenticados.
// Fuentes reales: admin_registrations(edition_id) (autorizada por
// is_organizer() en backend), catálogos públicos y v_public_groups_results.
// Sin escrituras: las acciones administrativas están deshabilitadas hasta
// que existan RPC seguras (supabase/admin-actions.js, BACKEND_RPC_PENDING.md).

(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const UI = window.SB_UI;
  let rows = [], groups = [], edcats = [], edition = null, loadedAt = null;
  let payConflicts = [];   // pagos cuyo estado vigente ≠ lo que reporta la vista
  let edcatIndex = {};

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
  const is = (r, key, val) => String(r[key] || '').toUpperCase() === val;

  // ── arranque / sesión ──────────────────────────────────────────────
  async function boot(){
    if (!window.SB_READY){
      show('bootState');
      $('#bootState').innerHTML = '<b>Sitio no conectado</b>Falta supabase/config.js con el Project URL y la Publishable key.';
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
      catch(e){ window.SB_LOG && window.SB_LOG.error('CTL-001', e); }
      if (!organizer){ show('deniedView'); return; }
      show('panelView');
      await load();
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('CTL-000', e);
      show('noSession');
    }
  }

  // ── datos ──────────────────────────────────────────────────────────
  async function load(){
    $('#kpiRow').setAttribute('aria-busy', 'true');
    $('#kpiRow').textContent = '';
    for (let i = 0; i < 8; i++){ const s = el('div','skel'); s.style.height = '84px'; $('#kpiRow').appendChild(s); }
    try {
      edition = await window.SB_CATALOG.getActiveEdition();
      $('#edName').textContent = (edition.name || edition.slug) + ' · ' + edition.slug;
      $('#edStatus').textContent = '';
      $('#edStatus').appendChild(UI.badge(edition.status));
      edcats = await window.SB_CATALOG.getEditionCategories(edition.id);
      edcatIndex = {}; edcats.forEach(c => { edcatIndex[c.id] = c.name || c.code; });
      rows = await window.SB_ADMIN.fetchAdminRegistrations(edition.id);
      // Padrón disponible para otros paneles (p. ej. selección de representativo
      // en el panel de aportaciones): se publica y se avisa por evento.
      window.CT_REGISTRATIONS = rows;
      document.dispatchEvent(new CustomEvent('ct-registrations'));
      // Pago vigente (último registro de payments), no «hubo algún confirmado»:
      // es la misma regla que usa el tablero de grupos para la elegibilidad.
      payConflicts = window.SB_PAYMENTS ? await window.SB_PAYMENTS.reconcile(rows) : [];
      // Bolsa pública: se publican los conteos REALES (registros por categoría y
      // pagos confirmados) cada vez que un organizador abre este panel, para que
      // la sección del puerquito nunca quede con cifras viejas.
      syncPrizePoolCounts(rows).catch(e => window.SB_LOG && window.SB_LOG.error('CTL-BOLSA', e));
      try {
        groups = window.SB_GROUPS.groupRows(await window.SB_GROUPS.fetchGroups(edcats.map(c => c.id)));
      } catch(e){ groups = []; window.SB_LOG && window.SB_LOG.error('CTL-003', e); }
      loadedAt = new Date();
      $('#lastUpdate').textContent = 'Actualizado ' + loadedAt.toLocaleTimeString('es-MX');
      renderKPIs();
      renderAlerts();
      renderQueue();
      renderPendingActions();
      fillDrawCategories();
      // LISTA PREVIA AL SORTEO — bloque de visibilidad (RPC administrativas)
      if (window.SB_PRE_GROUP_ADMIN) window.SB_PRE_GROUP_ADMIN.mount(edition.id);
      // IMPRIMIBLES DEL SORTEO — solo lectura (admin_registrations), sin escrituras
      if (window.SB_PRE_GROUP_PRINT) window.SB_PRE_GROUP_PRINT.mount(edition.id);
      // VISIBILIDAD DE SECCIONES PÚBLICAS — interruptores locales
      if (window.SB_PUBLIC_SECTIONS) window.SB_PUBLIC_SECTIONS.mount();
      // FORMATO QUE CORRESPONDE — solo cálculo sobre los datos ya cargados
      if (window.SB_FORMAT_ADVISOR) window.SB_FORMAT_ADVISOR.mount({ edition, edcats, rows, groups });
      // Acta y captura del sorteo físico — borrador local, sin escrituras
      if (window.SB_PRE_GROUP_DRAW) window.SB_PRE_GROUP_DRAW.mount();
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('CTL-002', err);
      $('#kpiRow').textContent = '';
      const st = el('div', 'state');
      st.appendChild(el('b', null, 'Error al cargar'));
      st.appendChild(document.createTextNode('No se pudieron obtener los datos del torneo. (código CTL-002)'));
      $('#kpiRow').appendChild(st);
    }
  }

  // ── Bolsa del torneo: publica conteos reales en site_settings ──────────
  const PRIZE_KEY = 'torneo_prize_cfg_v1';
  const PRIZE_CATS = [
    { k:'avanzado',     t:/AVANZ/ },
    { k:'intermedio',   t:/INTERMEDI/ },
    { k:'principiante', t:/PRINCIP/ }
  ];
  async function syncPrizePoolCounts(list){
    if (!window.SB) return;
    const totals = { avanzado:0, intermedio:0, principiante:0 };
    const paid   = { avanzado:0, intermedio:0, principiante:0 };
    (list || []).forEach(r => {
      const up = String(r.category_code || r.category_name || '').toUpperCase();
      const hit = PRIZE_CATS.find(c => c.t.test(up));
      if (!hit) return;
      totals[hit.k]++;                                  // TODOS los registros
      const st = String(r.payment_status || '').toUpperCase();
      if (st === 'CONFIRMED' || st === 'WAIVED') paid[hit.k]++;   // pagos confirmados
    });
    let cfg = {};
    try {
      const { data } = await window.SB.from('site_settings').select('value').eq('key', PRIZE_KEY).maybeSingle();
      cfg = (data && data.value) || {};
    } catch(e){ cfg = {}; }
    const keys = ['avanzado','intermedio','principiante'];
    const same = keys.every(k => (cfg.totals||{})[k] === totals[k] && (cfg.paid||{})[k] === paid[k]);
    if (same) return;
    cfg.totals = totals; cfg.paid = paid;
    await window.SB.rpc('admin_save_site_setting', { p_key: PRIZE_KEY, p_value: cfg });
  }

  function counts(){
    const c = {
      total: rows.length,
      confirmed: rows.filter(r => is(r, 'registration_status', 'CONFIRMED')).length,
      pre: rows.filter(r => is(r, 'registration_status', 'PRE_REGISTERED')).length,
      onTime: rows.filter(r => is(r, 'entry_status', 'ON_TIME')).length,
      late: rows.filter(r => is(r, 'entry_status', 'LATE_REGISTERED')).length,
      waiting: rows.filter(r => is(r, 'entry_status', 'WAITING_FOR_LATE_GROUP')).length,
      review: rows.filter(r => r.requires_review === true && !is(r, 'registration_status', 'CONFIRMED')).length,
      cats: edcats.length,
      groups: groups.length,
      lateGroups: groups.filter(g => g.type === 'LATE_ENTRY').length
    };
    // "sin pago confirmado": confirmados en inscripción pero payment_status
    // distinto de CONFIRMED (admin_registrations sí expone payment_status).
    c.unpaid = rows.filter(r => is(r, 'registration_status', 'CONFIRMED') && !is(r, 'payment_status', 'CONFIRMED')).length;
    return c;
  }

  function renderKPIs(){
    const c = counts();
    const wrap = $('#kpiRow');
    wrap.textContent = '';
    wrap.setAttribute('aria-busy', 'false');
    [
      ['Total de inscritos', c.total, ''],
      ['Confirmados', c.confirmed, 'k-ok'],
      ['Prerregistrados', c.pre, 'k-warn'],
      ['Registro regular', c.onTime, ''],
      ['Registro tardío', c.late, 'k-warn'],
      ['Esperando grupo tardío', c.waiting, c.waiting ? 'k-warn' : ''],
      ['Sin pago confirmado', c.unpaid, c.unpaid ? 'k-danger' : 'k-ok'],
      ['Requieren revisión', c.review, c.review ? 'k-danger' : 'k-ok'],
      ['Categorías', c.cats, ''],
      ['Grupos publicados', c.groups, '']
    ].forEach(([label, val, cls]) => {
      const k = el('div', 'hud kpi ' + cls);
      k.appendChild(el('b', null, String(val)));
      k.appendChild(el('small', null, label));
      wrap.appendChild(k);
    });
  }

  function renderAlerts(){
    const c = counts();
    const wrap = $('#alertList');
    wrap.textContent = '';
    const alerts = [];
    if (c.unpaid) alerts.push(['danger', c.unpaid, 'Confirmados sin pago confirmado', 'Admin.html']);
    if (payConflicts.length) alerts.push(['danger', payConflicts.length,
      'Historial de pago ambiguo (pago aceptado + rechazo) — bloquea la asignación a grupos', 'Admin.html']);
    if (c.review) alerts.push(['danger', c.review, 'Participantes que requieren revisión del staff', null]);
    if (c.waiting) alerts.push(['warn', c.waiting, 'Esperando grupo tardío — preparar grupo cuando haya cupo', null]);
    if (c.late) alerts.push(['warn', c.late, 'Registros tardíos en esta edición', 'Admin.html']);
    if (groups.length){
      // sin fuente pública de cupos por grupo: solo detectamos grupos sin partidos publicados
      const empty = groups.filter(g => !g.matches.length).length;
      if (empty) alerts.push(['warn', empty, 'Grupos sin partidos publicados todavía', 'Grupos.html']);
    } else {
      alerts.push(['warn', '—', 'Aún no hay grupos publicados (captura del sorteo físico pendiente)', 'TableroGrupos.html']);
    }
    if (!alerts.length) alerts.push(['ok', '✓', 'Sin alertas operativas por ahora', null]);
    alerts.forEach(([cls, n, txt, href]) => {
      const a = el('div', 'alert ' + cls);
      a.appendChild(el('span', 'an', String(n)));
      a.appendChild(el('span', null, txt));
      if (href){
        const l = el('a', 'btn btn-ghost alink', 'Ver');
        l.href = href;
        a.appendChild(l);
      }
      wrap.appendChild(a);
    });
  }

  function renderQueue(){
    const q = rows.filter(r => r.requires_review === true);
    const wrap = $('#queueList');
    const empty = $('#queueEmpty');
    wrap.textContent = '';
    if (!q.length){
      empty.style.display = 'block';
      empty.innerHTML = '<b>Cola vacía</b>Ningún participante requiere revisión en este momento.';
      return;
    }
    empty.style.display = 'none';
    q.forEach(r => {
      const resolved = is(r, 'registration_status', 'CONFIRMED');
      const c = el('div', 'hud qcard');
      const top = el('div', 'qtop');
      top.appendChild(el('b', null, r.nickname_snapshot || '—'));
      top.appendChild(el('span', 'badge ' + (resolved ? 'ok' : 'danger'), resolved ? 'Revisión atendida' : 'Requiere revisión'));
      c.appendChild(top);
      c.appendChild(el('span', 'qmeta',
        [(r.public_code || 'sin folio'), (edcatIndex[r.edition_category_id] || 'categoría por confirmar'), UI.tr(r.entry_status)].join(' · ')));
      const act = el('div');
      act.style.display = 'flex'; act.style.gap = '8px'; act.style.flexWrap = 'wrap';
      const btnConfirm = el('button', 'btn btn-ghost', 'Confirmar categoría');
      btnConfirm.type = 'button';
      const btnChange = el('button', 'btn btn-ghost', 'Cambiar categoría');
      btnChange.type = 'button';
      const link = el('a', 'btn btn-ghost', 'Abrir ficha en Admin');
      link.href = 'Admin.html';
      const board = el('a', 'btn btn-ghost', 'Tablero de grupos');
      board.href = 'TableroGrupos.html';
      act.appendChild(btnConfirm); act.appendChild(btnChange); act.appendChild(link); act.appendChild(board);
      c.appendChild(act);
      const formSlot = el('div');
      c.appendChild(formSlot);
      btnConfirm.addEventListener('click', () => {
        btnConfirm.disabled = true; btnConfirm.textContent = 'Confirmando…';
        window.SB_CATEGORY_REVIEW.confirmCategory(r.registration_id, {
          onDone: async () => { UI.toast('Categoría confirmada.', 'ok'); await load(); },
          onError: (err) => { btnConfirm.disabled = false; btnConfirm.textContent = 'Confirmar categoría'; UI.toast((err && err.userMessage) || 'No se pudo confirmar.', 'warn'); }
        });
      });
      btnChange.addEventListener('click', () => {
        window.SB_CATEGORY_REVIEW.openChangeCategoryForm(formSlot, r.registration_id, edcats, r.edition_category_id, {
          onDone: async () => { UI.toast('Categoría cambiada.', 'ok'); await load(); },
          onError: (err) => { UI.toast((err && err.userMessage) || (err && err.message) || 'No se pudo cambiar la categoría.', 'warn'); }
        });
      });
      wrap.appendChild(c);
    });
  }

  function renderPendingActions(){
    const wrap = $('#pendingActions');
    wrap.textContent = '';
    const links = [
      ['Revisar pagos y confirmaciones', 'Admin.html'],
      ['Ver grupos', 'Grupos.html'],
      ['Ver resultados', 'Resultados.html']
    ];
    links.forEach(([lbl, href]) => {
      const a = el('a', 'btn btn-ghost', lbl);
      a.href = href;
      wrap.appendChild(a);
    });
  }

  // ── Captura del sorteo físico ───────────────────────────────────────
  // El sorteo se realiza físicamente (pelotas con papelitos); aquí solo
  // queda el selector de categoría para crear partidos de grupos y el
  // estado de la captura. Las RPC de sorteo aleatorio quedan obsoletas y
  // ya NO se invocan (ver docs/SORTEO_FISICO_ENTREGA.md).
  function fillDrawCategories(){
    const sel = $('#drwCat');
    sel.length = 1;
    edcats.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name || c.code;
      sel.appendChild(o);
    });
    renderCaptureStatus();
  }
  function renderCaptureStatus(){
    const n = $('#drwStatus');
    if (!n) return;
    const withMembers = groups.filter(g => (g.players || g.members || []).length);
    n.textContent = withMembers.length
      ? 'Grupos publicados: ' + withMembers.length + '. Los ajustes se capturan en el Tablero de grupos.'
      : 'Sorteo físico sin capturar: aún no hay grupos con integrantes. Usa el Tablero de grupos para replicar el resultado.';
  }
  function drawMsg(text, cls){
    const n = $('#drwMsg');
    n.textContent = text || '';
    n.className = 'metaline' + (cls ? ' ' + cls : '');
  }

  $('#btnDrwMatches').addEventListener('click', async () => {
    const edcat = $('#drwCat').value;
    if (!edcat){ drawMsg('Elige una categoría primero.', 'k-warn'); return; }
    drawMsg('Creando partidos de la fase de grupos…');
    try {
      await window.SB_ADMIN_ACTIONS.createGroupStageMatches(edcat);
      drawMsg('Partidos de grupos creados. Revisa Resultados.html.', 'k-ok');
      // La transición de inicio de fase apaga automáticamente la lista previa
      // en Supabase (atómico). Aquí solo se refresca el bloque administrativo.
      if (window.SB_PRE_GROUP_ADMIN) await window.SB_PRE_GROUP_ADMIN.refresh();
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('CTL-DRW-3', err);
      drawMsg((err && err.userMessage) || (err && err.message) || 'No se pudieron crear los partidos.', 'k-danger');
    }
  });

  // ── CSV (mismas columnas autorizadas que Admin) ────────────────────
  async function exportCSV(){
    if (!rows.length){ UI.toast('No hay registros para exportar.', 'warn'); return; }
    const ok = await UI.confirmModal('Exportar CSV',
      'El archivo contiene información privada de participantes (teléfonos, correos). ¿Descargar?', 'Descargar');
    if (!ok) return;
    const V = window.SB_VALIDATE;
    const data = rows.map(r => ({ ...r, _cat: edcatIndex[r.edition_category_id] || '' }));
    const cols = ['public_code','nickname_snapshot','phone_snapshot','email','_cat','registration_status','entry_status','requires_review','created_at'];
    const heads = ['Folio','Apodo','Teléfono','Correo','Categoría','Inscripción','Entrada','Revisión','Creado'];
    const blob = new Blob([V.toCSV(data, cols, heads)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inscripciones-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function doLogout(){
    try { await window.SB_AUTH.signOut(); } catch(e){ window.SB_LOG && window.SB_LOG.error('CTL-004', e); }
    show('noSession');
  }

  $('#btnReload').addEventListener('click', load);
  $('#btnLogout').addEventListener('click', doLogout);
  $('#btnDeniedLogout').addEventListener('click', doLogout);

  boot();
})();
