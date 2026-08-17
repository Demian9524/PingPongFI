// ── Lógica del panel de organizadores (Admin.html) ─────────────────────
// Seguridad: sesión Supabase Auth → is_organizer() → admin_registrations().
// Sin tokens ni roles en localStorage; supabase-js administra la sesión.
// Acciones de escritura deshabilitadas: requieren RPC seguras (ver
// BACKEND_RPC_PENDING.md).

(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const V = window.SB_VALIDATE;

  let rows = [];               // datos autorizados actualmente cargados
  let edcatIndex = {};
  let edcats = [];              // categorías de la edición activa (para selector de cambio de categoría)
  let sort = { key: 'created_at', dir: -1 };
  let filters = { q: '', status: '', entry: '', cat: '' };
  let failCount = 0, lockUntil = 0;
  let authSubscribed = false;  // protege contra múltiples listeners
  let loadedAt = null;
  let payConflicts = [];       // filas cuyo pago vigente ≠ lo que reporta la vista

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(id){
    ['loginView','deniedView','panelView','bootState'].forEach(v => { $('#'+v).style.display = 'none'; });
    if (id) $('#'+id).style.display = 'block';
  }
  function setState(html){
    const st = $('#panelState');
    if (html == null){ st.style.display = 'none'; return; }
    st.style.display = 'block';
    st.innerHTML = html;
  }

  // ── arranque / sesión ──────────────────────────────────────────────
  async function boot(){
    if (!window.SB_READY){
      show('bootState');
      $('#bootState').innerHTML = '<b>Sitio no conectado</b>Falta supabase/config.js con el Project URL y la Publishable key.';
      return;
    }
    if (!authSubscribed){
      authSubscribed = true;
      window.SB_AUTH.onAuthChange(session => {
        if (!session){                       // sesión expirada o cerrada
          rows = [];
          const body = $('#regBody'); if (body) body.textContent = '';
          $('#whoami').textContent = '';
          $('#btnLogout').style.display = 'none';
          show('loginView');
        }
      });
    }
    try {
      const session = await window.SB_AUTH.getSession();
      if (!session){ show('loginView'); restoreEmail(); return; }
      await afterLogin(session);
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('ADM-000', e);
      show('loginView'); restoreEmail();
    }
  }

  async function afterLogin(session){
    $('#whoami').textContent = (session.user && session.user.email) || '';
    $('#btnLogout').style.display = 'inline-flex';
    show('bootState');
    $('#bootState').innerHTML = '<span class="spin" aria-hidden="true">◌</span> Verificando permisos…';
    let organizer = false;
    try { organizer = await window.SB_AUTH.isOrganizer(); }
    catch(e){ window.SB_LOG && window.SB_LOG.error('ADM-001', e); }
    if (!organizer){ show('deniedView'); $('#btnLogout').style.display = 'inline-flex'; return; }
    const lc = $('#lnkControl'); if (lc) lc.style.display = 'inline-flex';
    show('panelView');
    await loadData(currentEditionId);
  }

  // ── selector de edición (incluye ediciones pasadas / históricas) ────
  let allEditions = [];
  let currentEditionId = null;

  async function populateEditionSelect(activeEdition){
    const sel = $('#admEdition');
    if (!sel || sel.dataset.loaded) return;
    sel.dataset.loaded = '1';
    try {
      allEditions = await window.SB_CATALOG.getAllEditions();
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('ADM-EDS', e);
      allEditions = [activeEdition];
    }
    sel.textContent = '';
    allEditions.forEach(ed => {
      const o = document.createElement('option');
      o.value = String(ed.id);
      o.textContent = (ed.name || ed.slug) + (ed.status === 'ARCHIVED' || ed.status === 'CLOSED' ? ' (histórica)' : '');
      sel.appendChild(o);
    });
    sel.value = String(activeEdition.id);
    sel.addEventListener('change', () => loadData(Number(sel.value)));
  }

  // ── datos ──────────────────────────────────────────────────────────
  async function loadData(editionId){
    setState('<span class="spin" aria-hidden="true">◌</span> Cargando inscripciones…');
    $('#regBody').textContent = '';
    const t0 = performance.now();
    try {
      const activeEdition = await window.SB_CATALOG.getActiveEdition();
      await populateEditionSelect(activeEdition);
      const edition = (editionId && editionId !== activeEdition.id)
        ? (allEditions.find(e => e.id === editionId) || activeEdition)
        : activeEdition;
      currentEditionId = edition.id;
      $('#edName').textContent = edition.name || edition.slug;
      $('#edMeta').textContent = 'slug ' + edition.slug + ' · estado ' + edition.status;
      const note = $('#admEditionNote');
      if (note) note.hidden = edition.id === activeEdition.id;
      try {
        edcats = await window.SB_CATALOG.getEditionCategories(edition.id);
        edcatIndex = {}; edcats.forEach(c => { edcatIndex[c.id] = c.name || c.code; });
      } catch(_){}
      rows = await window.SB_ADMIN.fetchAdminRegistrations(edition.id);
      rows.forEach(r => { r._cat = edcatIndex[r.edition_category_id] || ''; });
      // Pago vigente: la vista reporta «hubo algún pago confirmado», no el estado
      // actual. Se corrige contra la tabla payments antes de pintar nada.
      payConflicts = window.SB_PAYMENTS ? await window.SB_PAYMENTS.reconcile(rows) : [];
      window.SB_LOG && window.SB_LOG.op('ADM', 'admin_registrations', performance.now() - t0, true);
      loadedAt = new Date();
      $('#lastUpdate').textContent = 'Actualizado ' + loadedAt.toLocaleTimeString('es-MX');
      buildFilters();
      renderPayWarning();
      renderStats();
      renderRows();
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('ADM-002', err);
      const m = String((err && err.message) || '').toLowerCase();
      setState(m.includes('no autorizado')
        ? '<b>Sin permisos</b>El servidor rechazó la consulta: se requiere ser organizador.'
        : '<b>Error al cargar</b>No se pudieron obtener las inscripciones. (código ADM-002)');
    }
  }

  function count(arr, key){
    const m = {};
    arr.forEach(r => { const k = r[key] || '—'; m[k] = (m[k] || 0) + 1; });
    return m;
  }
  function renderStats(){
    const wrap = $('#statsRow');
    wrap.textContent = '';
    function statCard(label, total, breakdown){
      const c = el('div', 'hud stat');
      c.appendChild(el('b', null, String(total)));
      c.appendChild(el('small', null, label));
      if (breakdown){
        const brk = el('div', 'brk');
        Object.entries(breakdown).sort((a,b) => b[1]-a[1]).slice(0,4).forEach(([k,v]) => {
          const s = el('span');
          const bb = el('b', null, String(v)); s.appendChild(bb);
          const lbl = (window.SB_UI && k !== '—') ? window.SB_UI.tr(k) : String(k).replace(/_/g,' ');
          s.appendChild(document.createTextNode(' ' + lbl));
          brk.appendChild(s);
        });
        c.appendChild(brk);
      }
      wrap.appendChild(c);
    }
    statCard('Total inscritos', rows.length);
    statCard('Por inscripción', rows.length, count(rows, 'registration_status'));
    statCard('Por entrada', rows.length, count(rows, 'entry_status'));
    statCard('Por categoría', rows.length, count(rows, '_cat'));
  }

  function buildFilters(){
    function fill(sel, key, translate){
      const s = $(sel);
      const vals = [...new Set(rows.map(r => r[key]).filter(Boolean))].sort();
      s.length = 1;
      vals.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = (translate && window.SB_UI) ? window.SB_UI.tr(v) : String(v).replace(/_/g,' ');
        s.appendChild(o);
      });
    }
    fill('#admStatus', 'registration_status', true);
    fill('#admEntry', 'entry_status', true);
    fill('#admCat', '_cat');
  }

  function filteredRows(){
    const q = V.normText(filters.q);
    let out = rows.filter(r =>
      (!q || V.normText(r.nickname_snapshot).includes(q)
          || String(r.phone_normalized || '').includes(filters.q.replace(/\D/g,'') || '§')
          || V.normText(r.public_code).includes(q)) &&
      (!filters.status || r.registration_status === filters.status) &&
      (!filters.entry || r.entry_status === filters.entry) &&
      (!filters.cat || r._cat === filters.cat)
    );
    const k = sort.key, d = sort.dir;
    out.sort((a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? '')) * d);
    return out;
  }

  function pill(txt, cls){
    if (!txt) return el('span', null, '—');
    if (window.SB_UI) return window.SB_UI.badge(txt);
    return el('span', 'pill ' + (cls || ''), String(txt).replace(/_/g,' '));
  }

  function fmtDate(v){
    if (!v) return null;
    try {
      return new Date(v).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(_){ return String(v); }
  }

  // WhatsApp: solo si el backend entregó una URL https://wa.me/ válida.
  function safeWhatsAppUrl(url){
    return (typeof url === 'string' && /^https:\/\/wa\.me\//.test(url)) ? url : null;
  }

  // (shiftChips eliminado junto con el sistema de horarios: el sorteo es presencial)

  // ¿Ya se atendió la revisión? SOLO cuenta si un organizador la resolvió:
  // reviewed_at / reviewed_by. CONFIRMED o CANCELLED NO significan revisión
  // atendida — una inscripción puede confirmarse (pago) o cancelarse sin que
  // nadie haya mirado la bandera de revisión.
  function reviewResolved(r){
    return Boolean(r && (r.reviewed_at || r.reviewed_by));
  }
  function reviewState(r){
    if (reviewResolved(r)) return { label:'Revisión atendida', cls:'ok' };
    if (r && r.requires_review) return { label:'Requiere revisión', cls:'danger' };
    return { label:'No requerida', cls:'neutral' };
  }
  function reviewPill(r){
    const st = reviewState(r);
    return window.SB_UI ? window.SB_UI.el('span', 'badge ' + st.cls, st.label) : st.label;
  }

  // ── Etiquetas del cuestionario nuevo (sin horarios) ─────────────────
  const EXPERIENCE_LABELS = { EXP_NONE:'Nunca ha jugado', EXP_LT6M:'Menos de 6 meses', EXP_6M_1Y:'Entre 6 meses y 1 año', EXP_GT1Y:'Más de 1 año' };
  const RALLY_LABELS = { R0_3:'0 a 3 golpes', R4_7:'4 a 7 golpes', R8_15:'8 a 15 golpes', R16P:'16 golpes o más', UNSURE:'No está seguro' };
  const TRAINING_LABELS = { NONE:'Sin entrenamiento particular', LT1M:'Menos de 1 mes', GE1M:'1 mes o más' };
  const TECHNIQUE_LABELS = { RALLY:'Peloteo básico', SERVE:'Saque con efecto', CHOP:'Corte / chop', ATTACK:'Ataque ocasional', TOPSPIN:'Topspin' };
  const SELF_LEVEL_LABELS = { PRINCIPIANTE:'Principiante', INTERMEDIO:'Intermedio', AVANZADO:'Avanzado / Open', AVANZADO_OPEN:'Avanzado / Open' };
  const FREQUENCY_LABELS = { NUNCA:'Nunca o casi nunca', MONTHLY:'Algunas veces al mes', WEEKLY:'1 o 2 veces por semana', FREQUENT:'3 o más veces por semana' };
  const REPRESENTATIVE_LABELS = { YES:'Sí', SI:'Sí', TRUE:'Sí', NO:'No', FALSE:'No' };
  const PREV_RESULT_LABELS = { CHAMPION:'Campeón/a', FINALIST:'Finalista', SEMIFINAL:'Semifinalista', QF:'Cuartos de final', GROUP_STAGE:'Fase de grupos', NONE:'Sin resultado', UNKNOWN:'No recuerda' };
  // PRINCIPIANTE es la única categoría inicial vigente. NOVATO/BEGINNER solo
  // se leen como alias histórico para mostrar registros de ediciones viejas.
  const PREV_CAT_LABELS = { NOVATO:'Principiante (histórico «Novato»)', BEGINNER:'Principiante (histórico «Beginner»)',
    PRINCIPIANTE:'Principiante', INTERMEDIO:'Intermedio', AVANZADO:'Avanzado / Open', AVANZADO_OPEN:'Avanzado / Open',
    UNKNOWN:'No recuerda', OTHER:'Otra' };
  const REVIEW_FLAG_LABELS = {
    REPRESENTATIVE:'Representativo: juega en Avanzados con pala de madera.',
    PRIVATE_TRAINING:'Declaró entrenamiento particular de 1 mes o más.',
    PREV_ADVANCED_CHAMPION:'Campeón de Avanzados en la edición anterior.',
    PREV_DEEP_RUN:'Llegó lejos en una categoría igual o superior el torneo pasado.',
    PREV_HISTORY_VS_PRINCIPIANTE:'Historial destacado con categoría sugerida Principiante.',
    PREV_EDITION:'Jugó una edición anterior: verificar historial vinculado.',
    UNSURE_RALLY:'Respondió «No estoy seguro» en la pregunta de peloteo.',
    CONTRADICTION_NO_PLAY:'Dice no jugar pero declara técnicas o peloteo alto.',
    CONTRADICTION_RALLY_TECH:'Peloteo de 0 a 3 golpes pero declara topspin o ataque.',
    CONTRADICTION_TRAINING:'Declara entrenamiento formal pero el resto no lo respalda.',
    BORDERLINE_UP:'Cerca del límite con la categoría de arriba.'
  };
  function techniquesText(v){
    const arr = Array.isArray(v) ? v : (typeof v === 'string' && v ? String(v).replace(/^\{|\}$/g,'').split(',') : []);
    const clean = arr.map(t => String(t).trim().replace(/^"|"$/g,'')).filter(t => t && t !== 'NONE');
    if (!clean.length) return arr.length ? 'Ninguno' : null;
    return clean.map(t => TECHNIQUE_LABELS[t] || t).join(', ');
  }

  // Heurística: el backend todavía no expone un flag dedicado de fusión
  // manual, así que se detecta por la marca que deja admin_link_registration_
  // to_player() en organizer_notes ("Fusión manual"). Ver hotfix SQL.
  function isManuallyLinked(r){
    return typeof r.organizer_notes === 'string' && /fusión manual/i.test(r.organizer_notes);
  }

  // Sin fila de payments todavía → "Sin registrar" (no es lo mismo que
  // "Pendiente": pendiente implica que ya se generó un cobro).
  function paymentPill(r){
    if (!r.payment_status) return window.SB_UI ? window.SB_UI.el('span', 'badge neutral', 'Sin registrar') : '—';
    if (!r._payConflict) return pill(r.payment_status);
    // Historial ambiguo: hay un pago aceptado y también un rechazo. Cada parte
    // del sistema lo resuelve distinto, así que se marca en vez de inventar.
    const wrap = window.SB_UI ? window.SB_UI.el('span', 'paycell') : null;
    if (!wrap) return pill(r.payment_status);
    wrap.appendChild(pill(r.payment_status));
    const flag = window.SB_UI.el('span', 'badge danger payflag', '⚠ historial');
    flag.title = 'Historial de pago ambiguo: ' + window.SB_PAYMENTS.historyText(r) +
      '\n\nLa insignia se calcula como «existe algún pago aceptado», pero el tablero de grupos ' +
      'lo rechaza por no elegible. Hay que dejar un solo registro válido.';
    wrap.appendChild(flag);
    return wrap;
  }

  // ── Anuncio de historiales de pago ambiguos ─────────────────────────
  // Antes esto pasaba en silencio: la insignia decía CONFIRMADO, el tablero
  // bloqueaba la asignación y el botón de confirmar contestaba
  // PAYMENT_STATE_CONFLICT — sin que nada explicara la causa.
  function renderPayWarning(){
    const box = $('#payWarnBox');
    if (!box) return;
    box.textContent = '';
    if (!payConflicts.length) return;
    const n = payConflicts.length;
    const div = el('div', 'paywarn');
    const h = el('div', 'paywarn-h');
    h.appendChild(el('b', null, n === 1
      ? '1 inscripción con historial de pago ambiguo'
      : n + ' inscripciones con historial de pago ambiguo'));
    div.appendChild(h);
    div.appendChild(el('p', null, 'Tienen un pago aceptado Y un rechazo en el mismo historial. ' +
      'Cada parte del sistema lo interpreta distinto: la insignia lo da por confirmado, el tablero de grupos ' +
      'lo rechaza como no elegible y volver a confirmar o exentar contesta PAYMENT_STATE_CONFLICT. ' +
      'Se resuelve dejando un solo registro de pago válido (borrar los rechazos sobrantes en Supabase).'));
    const ul = el('ul', 'paywarn-l');
    payConflicts.slice(0, 12).forEach(r => {
      const li = el('li');
      li.appendChild(el('b', null, r.nickname_snapshot || r.public_code || '—'));
      li.appendChild(el('span', null, ' · ' + window.SB_PAYMENTS.historyText(r)));
      ul.appendChild(li);
    });
    if (n > 12) ul.appendChild(el('li', null, '…y ' + (n - 12) + ' más.'));
    div.appendChild(ul);
    box.appendChild(div);
  }

  // ── detalle del participante (drawer lateral) ───────────────────
  function openDetail(r){
    if (!window.SB_UI) return;
    const UI = window.SB_UI;
    const body = document.createElement('div');

    // — Resumen —
    const sum = el('div', 'dsummary');
    sum.appendChild(el('div', 'dsum-name', r.nickname_snapshot || 'Participante'));
    if (r.category_name || r._cat) sum.appendChild(UI.badge(String(r.category_name || r._cat).replace(/\s*\/\s*open\s*$/i, '')));
    if (r.registration_status) sum.appendChild(UI.badge(r.registration_status));
    if (r.payment_status) sum.appendChild(UI.badge(r.payment_status));
    const reviewSummary = reviewState(r);
    sum.appendChild(el('span', 'badge ' + reviewSummary.cls, reviewSummary.label));
    if (isManuallyLinked(r)) sum.appendChild(el('span', 'badge ok', 'Identidad validada'));
    if (r.public_code) sum.appendChild(el('span', 'pill', 'Folio ' + r.public_code));
    body.appendChild(sum);

    // — 1. Datos personales —
    const s1 = el('div', 'dsec');
    s1.appendChild(el('h3', null, 'Datos personales'));
    const dl1 = document.createElement('dl');
    const row = (label, val, node) => {
      const d = el('div', 'drow');
      d.appendChild(el('dt', null, label));
      const dd = document.createElement('dd');
      if (node) dd.appendChild(node); else dd.textContent = (val == null || val === '') ? '—' : String(val);
      d.appendChild(dd);
      dl1.appendChild(d);
    };
    row('Apodo', r.nickname_snapshot);
    row('Teléfono', r.phone_normalized);
    const wa = safeWhatsAppUrl(r.whatsapp_url);
    if (wa){
      const a = document.createElement('a');
      a.href = wa; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'wa-btn';
      a.textContent = 'Abrir WhatsApp';
      row('WhatsApp', null, a);
    }
    row('Contacto público', r.consent_public_contact_at ? 'Sí' : 'No');
    row('Creado', fmtDate(r.created_at));
    s1.appendChild(dl1);
    body.appendChild(s1);

    // — 1b. Privacidad del contacto —
    body.appendChild(buildPublicContactSection(r));

    // — 2. Facultad y carrera —
    const s2 = el('div', 'dsec');
    s2.appendChild(el('h3', null, 'Facultad y carrera'));
    if (r.faculty_code && window.SB_LOGOS){
      const logos = window.SB_LOGOS.resolveForCard(r.faculty_code, r.career_code, r.faculty_name, r.career_name);
      const row2 = el('div', 'dsec-logos');
      logos.forEach(lg => {
        const img = document.createElement('img');
        img.src = lg.src; img.alt = lg.alt; img.loading = 'lazy';
        img.onerror = () => { img.src = window.SB_LOGOS.FALLBACK_FACULTY; };
        row2.appendChild(img);
      });
      s2.appendChild(row2);
    }
    const dl2 = document.createElement('dl');
    const row2b = (label, val) => {
      const d = el('div', 'drow');
      d.appendChild(el('dt', null, label));
      const dd = document.createElement('dd'); dd.textContent = val || '—';
      d.appendChild(dd); dl2.appendChild(d);
    };
    row2b('Facultad', r.faculty_name);
    row2b('Carrera', r.career_name);
    row2b('Grupo', r.group_label);
    s2.appendChild(dl2);
    body.appendChild(s2);

    // — 3. Nivel declarado —
    const s3 = el('div', 'dsec');
    s3.appendChild(el('h3', null, 'Nivel declarado'));
    const dl3 = document.createElement('dl');
    const row3 = (label, val) => {
      if (val == null || val === '') return;
      const d = el('div', 'drow');
      d.appendChild(el('dt', null, label));
      const dd = document.createElement('dd'); dd.textContent = String(val);
      d.appendChild(dd); dl3.appendChild(d);
    };
    row3('Nivel', SELF_LEVEL_LABELS[String(r.self_level || '').toUpperCase()] || r.self_level);
    row3('Frecuencia', FREQUENCY_LABELS[String(r.play_frequency || '').toUpperCase()] || r.play_frequency);
    // Respuestas del cuestionario nuevo (requieren la migración que las expone
    // en v_admin_registrations; si aún no está, simplemente no se dibujan).
    row3('Entrenamiento particular', TRAINING_LABELS[r.private_training] || r.private_training);
    row3('Experiencia jugando', EXPERIENCE_LABELS[r.playing_experience_band] || r.playing_experience_band);
    row3('Peloteo declarado', RALLY_LABELS[r.rally_length_band] || r.rally_length_band);
    row3('Recursos técnicos', techniquesText(r.techniques));
    const repRaw = String(r.club_or_representative || '').trim();
    row3('Club/representativo', REPRESENTATIVE_LABELS[repRaw.toUpperCase()] || repRaw);
    row3('Categoría del torneo pasado', PREV_CAT_LABELS[String(r.prev_category_code || '').toUpperCase()] || r.prev_category_code);
    row3('Apodo del torneo pasado', r.prev_nickname);
    row3('Resultado previo', PREV_RESULT_LABELS[String(r.prev_result || '').toUpperCase()] || r.prev_result);
    row3('Notas de juego', r.play_style_notes);
    if (dl3.children.length) s3.appendChild(dl3);
    else s3.appendChild(el('p', 'dnote', 'Sin datos de nivel declarados.'));
    body.appendChild(s3);

    // — 4. Revisión —
    const s5 = el('div', 'dsec');
    s5.appendChild(el('h3', null, 'Revisión'));
    if (reviewResolved(r)){
      s5.appendChild(el('p', 'dnote ok',
        'Revisión atendida por la organización' + (r.reviewed_at ? ' el ' + fmtDate(r.reviewed_at) : '') + '.'));
    } else if (r.requires_review){
      s5.appendChild(el('p', 'dnote danger',
        'Este registro requiere revisión antes del sorteo.' + (r.review_reason ? ' ' + r.review_reason : '')));
    } else {
      s5.appendChild(el('p', 'dnote ok', 'No requiere revisión.'));
    }
    // Banderas que calculó el formulario y viajaron en review_flags[].
    const rflags = Array.isArray(r.review_flags) ? r.review_flags
      : (typeof r.review_flags === 'string' && r.review_flags
          ? String(r.review_flags).replace(/^\{|\}$/g,'').split(',').filter(Boolean) : []);
    if (rflags.length){
      s5.appendChild(el('p', 'dnote', 'Banderas del formulario:'));
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:4px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px';
      rflags.forEach(code => {
        const key = String(code).trim().replace(/^"|"$/g,'');
        const li = document.createElement('li');
        li.style.cssText = 'font-size:12.5px;line-height:1.45;color:var(--color-text,#f4f4f6)';
        li.textContent = REVIEW_FLAG_LABELS[key] || key;
        ul.appendChild(li);
      });
      s5.appendChild(ul);
    }
    body.appendChild(s5);

    // — 5b. Revisión de categoría —
    body.appendChild(buildCategoryReviewSection(r));

    // — 5c. Trofeos —
    body.appendChild(buildTrophiesSection(r));

    // — 6. Editar datos (manual del admin) —
    body.appendChild(buildEditSection(r));

    // — 7. Fusión manual —
    body.appendChild(buildMergeSection(r));

    UI.openDrawer2('Ficha de participante', body, buildActions(r));
  }

  // ── 5b. Revisión de categoría (compartida con ControlTorneo) ────────
  function buildCategoryReviewSection(r){
    const sec = el('div', 'dsec');
    sec.appendChild(el('h3', null, 'Revisión de categoría'));
    const dl = document.createElement('dl');
    const row = (label, val) => {
      const d = el('div', 'drow');
      d.appendChild(el('dt', null, label));
      const dd = document.createElement('dd'); dd.textContent = (val == null || val === '') ? '—' : String(val);
      d.appendChild(dd); dl.appendChild(d);
    };
    row('Categoría provisional', r.category_provisional_code || r.category_provisional_name);
    row('Categoría actual', String(r.category_name || r._cat || '').replace(/\s*\/\s*open\s*$/i, '') || null);
    row('Estado de revisión', reviewState(r).label);
    row('Motivo', r.review_reason);
    sec.appendChild(dl);

    const act = el('div');
    act.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    const btnConfirm = el('button', 'dact-btn', 'Confirmar categoría');
    btnConfirm.type = 'button';
    const btnChange = el('button', 'dact-btn', 'Cambiar categoría');
    btnChange.type = 'button';
    const goBoard = el('a', 'dact-btn', 'Ir al tablero de grupos');
    goBoard.href = 'TableroGrupos.html';
    goBoard.style.textDecoration = 'none';
    act.appendChild(btnConfirm); act.appendChild(btnChange); act.appendChild(goBoard);
    sec.appendChild(act);
    const formSlot = el('div');
    sec.appendChild(formSlot);

    btnConfirm.addEventListener('click', () => {
      if (!window.SB_CATEGORY_REVIEW) return;
      btnConfirm.disabled = true; btnConfirm.textContent = 'Confirmando…';
      window.SB_CATEGORY_REVIEW.confirmCategory(r.registration_id, {
        onDone: async () => {
          window.SB_UI.toast('Categoría validada.', 'ok');
          await loadData(currentEditionId);
          const updated = rows.find(x => x.registration_id === r.registration_id);
          openDetail(updated || r);
        },
        onError: (err) => {
          btnConfirm.disabled = false; btnConfirm.textContent = 'Confirmar categoría';
          window.SB_UI.toast((err && err.userMessage) || 'No se pudo confirmar.', 'warn');
        }
      });
    });
    btnChange.addEventListener('click', () => {
      if (!window.SB_CATEGORY_REVIEW) return;
      window.SB_CATEGORY_REVIEW.openChangeCategoryForm(formSlot, r.registration_id, edcats, r.edition_category_id, {
        onDone: async () => {
          window.SB_UI.toast('Categoría cambiada.', 'ok');
          await loadData(currentEditionId);
          const updated = rows.find(x => x.registration_id === r.registration_id);
          openDetail(updated || r);
        },
        onError: (err) => {
          window.SB_UI.toast((err && err.userMessage) || (err && err.message) || 'No se pudo cambiar la categoría.', 'warn');
        }
      });
    });
    return sec;
  }

  // ── 5c. Trofeos (logro visual en el perfil público) ─────────────────
  const TROPHY_TYPE_LABELS = { CHAMPION: 'Campeón', RUNNER_UP: 'Subcampeón', THIRD_PLACE: 'Tercer lugar', SPECIAL: 'Logro especial' };
  function buildTrophiesSection(r){
    const sec = el('div', 'dsec');
    sec.appendChild(el('h3', null, 'Trofeos'));
    const regId = r.registration_id || r.id;
    const list = el('div', 'dnote');
    list.textContent = 'Cargando trofeos…';
    sec.appendChild(list);

    const renderList = (trophies) => {
      list.innerHTML = '';
      if (!trophies.length){
        list.appendChild(el('p', 'dnote', 'Sin trofeos otorgados.'));
        return;
      }
      trophies.forEach(t => {
        const row = el('div', 'drow');
        row.appendChild(el('dt', null, (TROPHY_TYPE_LABELS[t.trophy_type] || t.trophy_type) + ' · ' + (t.category_name || t.category_code || '') + ' · ' + (t.edition_key || t.edition_name || '')));
        const dd = document.createElement('dd');
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'dact-btn'; btn.textContent = 'Quitar';
        btn.addEventListener('click', async () => {
          const reason = window.prompt('Motivo de la revocación (obligatorio):', '');
          if (!reason || !reason.trim()) return;
          btn.disabled = true;
          try {
            await window.SB_TROPHIES.revokeTrophy(t.trophy_id, reason.trim());
            window.SB_UI.toast('Trofeo eliminado.', 'ok');
            load();
          } catch(err){
            window.SB_UI.toast((err && err.message) || 'No se pudo eliminar.', 'err');
            btn.disabled = false;
          }
        });
        dd.appendChild(btn);
        row.appendChild(dd);
        list.appendChild(row);
      });
    };
    const load = async () => {
      try {
        const trophies = await window.SB_TROPHIES.fetchPlayerTrophies(regId);
        renderList(trophies);
      } catch(err){
        list.textContent = 'No se pudieron cargar los trofeos.';
      }
    };
    load();

    const form = el('div');
    form.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    const notesInput = document.createElement('input');
    notesInput.type = 'text'; notesInput.placeholder = 'Notas (opcional)';
    notesInput.style.cssText = 'background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:8px 10px;font-size:13px;flex:1;min-width:140px';
    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'dact-btn primary'; addBtn.textContent = 'Otorgar primer lugar';
    addBtn.addEventListener('click', async () => {
      addBtn.disabled = true;
      try {
        await window.SB_TROPHIES.grantTrophy({ registrationId: regId, trophyType: 'CHAMPION', notes: notesInput.value.trim() || null });
        window.SB_UI.toast('Trofeo otorgado.', 'ok');
        notesInput.value = '';
        load();
      } catch(err){
        window.SB_UI.toast((err && err.message) || 'No se pudo otorgar.', 'err');
      } finally {
        addBtn.disabled = false;
      }
    });
    form.appendChild(notesInput); form.appendChild(addBtn);
    sec.appendChild(form);

    const syncBtn = document.createElement('button');
    syncBtn.type = 'button'; syncBtn.className = 'dact-btn'; syncBtn.textContent = 'Sincronizar campeones (finales)';
    syncBtn.style.marginTop = '8px';
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      try {
        const res = await window.SB_TROPHIES.syncChampions(null);
        window.SB_UI.toast('Sincronizado (' + (res && res.affected_rows != null ? res.affected_rows : 0) + ' filas afectadas).', 'ok');
        load();
      } catch(err){
        window.SB_UI.toast((err && err.message) || 'No se pudo sincronizar.', 'err');
      } finally {
        syncBtn.disabled = false;
      }
    });
    sec.appendChild(syncBtn);
    return sec;
  }


  // ── 1b. Visibilidad pública del teléfono / WhatsApp ───────────────
  function buildPublicContactSection(r){
    const sec = el('div', 'dsec');
    sec.appendChild(el('h3', null, 'Privacidad del contacto'));

    const registrationId = r.registration_id || r.id;
    const enabled = Boolean(r.consent_public_contact_at);
    const hasPhone = Boolean(String(r.phone_normalized || '').trim());

    const state = el(
      'p',
      'dnote ' + (enabled ? 'ok' : ''),
      enabled
        ? 'Contacto público habilitado para esta inscripción.'
        : 'Contacto público deshabilitado para esta inscripción.'
    );
    sec.appendChild(state);

    const explanation = el(
      'p',
      'dnote',
      'Este control solo decide si el teléfono/WhatsApp se muestra públicamente en esta edición. No cambia el número ni afecta otras inscripciones del jugador.'
    );
    sec.appendChild(explanation);

    if (enabled && hasPhone){
      const wa = safeWhatsAppUrl(r.whatsapp_url);
      if (wa){
        const a = document.createElement('a');
        a.href = wa;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'wa-btn';
        a.textContent = 'Comprobar WhatsApp público';
        a.style.display = 'inline-flex';
        a.style.marginBottom = '10px';
        sec.appendChild(a);
      }
    }

    if (!hasPhone){
      sec.appendChild(el(
        'p',
        'dnote danger',
        enabled
          ? 'Advertencia: la inscripción figura como pública, pero no tiene un teléfono utilizable.'
          : 'Primero agrega un teléfono al jugador para poder habilitar su contacto público.'
      ));
    }

    const reason = document.createElement('textarea');
    reason.rows = 2;
    reason.placeholder = enabled
      ? 'Motivo para ocultarlo, por ejemplo: la participante retiró su autorización.'
      : 'Motivo y confirmación, por ejemplo: autorización confirmada por la participante.';
    reason.style.cssText = 'width:100%;background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:10px 12px;font-size:13px;resize:vertical;margin:2px 0 9px';
    sec.appendChild(reason);

    const btn = el(
      'button',
      'dact-btn ' + (enabled ? '' : 'primary'),
      enabled ? 'Deshabilitar contacto público' : 'Habilitar contacto público'
    );
    btn.type = 'button';
    btn.disabled = !enabled && !hasPhone;
    sec.appendChild(btn);

    btn.addEventListener('click', async () => {
      const desired = !enabled;
      const why = reason.value.trim();

      if (!why){
        window.SB_UI.toast('Escribe el motivo del cambio.', 'warn');
        reason.focus();
        return;
      }

      const question = desired
        ? '¿Confirmas que esta persona autorizó mostrar públicamente su teléfono/WhatsApp en esta edición?'
        : '¿Ocultar el teléfono/WhatsApp público de esta inscripción?';

      if (!confirm(question)) return;

      btn.disabled = true;
      btn.textContent = desired ? 'Habilitando…' : 'Deshabilitando…';

      try {
        await window.SB_ADMIN_ACTIONS.setPublicContact(
          registrationId,
          desired,
          why
        );
        window.SB_UI.toast(
          desired ? 'Contacto público habilitado.' : 'Contacto público deshabilitado.',
          'ok'
        );
        await loadData(currentEditionId);
        const updated = rows.find(x =>
          (x.registration_id || x.id) === registrationId
        );
        openDetail(updated || r);
      } catch(err){
        window.SB_LOG && window.SB_LOG.error('ADM-CONTACT-1', err);
        window.SB_UI.toast(
          (err && err.userMessage) ||
          (err && err.message) ||
          'No se pudo cambiar la visibilidad del contacto.',
          'err'
        );
        btn.disabled = !enabled && !hasPhone;
        btn.textContent = enabled
          ? 'Deshabilitar contacto público'
          : 'Habilitar contacto público';
      }
    });

    return sec;
  }

  // ── 6. Editar datos (manual del admin, nunca automático) ────────────
  function buildEditSection(r){
    const sec = el('div', 'dsec');
    sec.appendChild(el('h3', null, 'Editar datos'));
    const viewWrap = el('div');
    const editBtn = el('button', 'dact-btn', 'Editar datos');
    editBtn.type = 'button';
    viewWrap.appendChild(el('p', 'dnote', 'Edición manual del organizador. No se fusiona con otro jugador automáticamente aunque cambies el teléfono.'));
    viewWrap.appendChild(editBtn);
    sec.appendChild(viewWrap);

    editBtn.addEventListener('click', async () => {
      viewWrap.textContent = '';
      const form = document.createElement('div');
      const field = (labelText, input) => {
        const wrap = el('div');
        wrap.style.marginBottom = '10px';
        const lbl = el('label', null, labelText);
        lbl.style.cssText = 'display:block;font-size:11px;color:var(--color-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px';
        wrap.appendChild(lbl); wrap.appendChild(input);
        form.appendChild(wrap);
        return input;
      };
      const mkInput = (val) => { const i = document.createElement('input'); i.type = 'text'; i.value = val || ''; i.style.cssText = 'width:100%;background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:10px 12px;font-size:14px'; return i; };
      const mkSelect = (opts, val) => {
        const s = document.createElement('select');
        s.style.cssText = 'width:100%;background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:10px 12px;font-size:14px';
        opts.forEach(([v, lbl]) => { const o = document.createElement('option'); o.value = v; o.textContent = lbl; if (v === val) o.selected = true; s.appendChild(o); });
        return s;
      };

      const iNick = field('Apodo / nombre visible', mkInput(r.nickname_snapshot));
      const iPhone = field('Teléfono global (opcional; 10 dígitos si se captura)', mkInput(r.phone_normalized));
      const phoneNote = el('small', null, 'Dejarlo vacío elimina el teléfono global del jugador y deshabilita su contacto público en todas las ediciones. Los snapshots históricos se conservan solo como evidencia interna.');
      phoneNote.style.cssText = 'display:block;color:var(--color-muted);font-size:11px;margin:-6px 0 10px';
      form.appendChild(phoneNote);
      const errPhone = el('div', 'ferr-inline', '');
      errPhone.style.cssText = 'color:var(--color-danger);font-size:12px;margin:-6px 0 8px;display:none';
      form.insertBefore(errPhone, iPhone.parentElement.nextSibling);

      let faculties = [], careers = [];
      try { faculties = await window.SB_CATALOG.getFaculties(); } catch(e){ window.SB_LOG && window.SB_LOG.error('ADM-EDIT-1', e); }
      const iFac = field('Facultad', mkSelect(faculties.map(f => [f.code, f.name || f.code]), r.faculty_code));
      const facNote = el('small', null, 'Apodo, facultad y carrera son del jugador: al guardar se actualizan en todas sus ediciones (pasadas y futuras), no solo esta.');
      facNote.style.cssText = 'display:block;color:var(--color-muted);font-size:11px;margin:-6px 0 10px';
      form.appendChild(facNote);
      const careerWrap = document.createElement('div');
      form.appendChild(careerWrap);
      let iCareer = null;
      async function renderCareerField(){
        careerWrap.textContent = '';
        if (iFac.value !== 'INGENIERIA'){ return; }
        const fac = faculties.find(f => f.code === 'INGENIERIA');
        try { careers = fac ? await window.SB_CATALOG.getCareersByFaculty(fac.id) : []; } catch(e){ careers = []; }
        const wrap = el('div'); wrap.style.marginBottom = '10px';
        const lbl = el('label', null, 'Carrera'); lbl.style.cssText = 'display:block;font-size:11px;color:var(--color-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px';
        iCareer = mkSelect([['', 'No aplica'], ...careers.map(c => [c.code, c.name || c.code])], r.career_code);
        wrap.appendChild(lbl); wrap.appendChild(iCareer);
        careerWrap.appendChild(wrap);
      }
      await renderCareerField();
      iFac.addEventListener('change', renderCareerField);

      const iNotes = document.createElement('textarea');
      iNotes.value = (r.organizer_notes || '').replace(/ \| Fusión manual.*$/i, '');
      iNotes.rows = 3;
      iNotes.style.cssText = 'width:100%;background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:10px 12px;font-size:13px;resize:vertical';
      field('Notas del organizador', iNotes);

      const warnBox = el('div', 'dnote danger');
      warnBox.style.display = 'none';
      form.appendChild(warnBox);

      const actRow = el('div');
      actRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';
      const btnSave = el('button', 'dact-btn primary', 'Guardar cambios'); btnSave.type = 'button';
      const btnCancel = el('button', 'dact-btn', 'Cancelar'); btnCancel.type = 'button';
      actRow.appendChild(btnSave); actRow.appendChild(btnCancel);
      form.appendChild(actRow);

      btnCancel.addEventListener('click', () => { openDetail(r); }); // recarga la ficha sin cambios
      btnSave.addEventListener('click', async () => {
        errPhone.style.display = 'none'; warnBox.style.display = 'none';
        const phoneRaw = iPhone.value.trim();
        if (phoneRaw && !window.SB_VALIDATE.isValidPhone(phoneRaw)){
          errPhone.textContent = 'Déjalo vacío para un histórico sin teléfono, o escribe 10 dígitos de México.';
          errPhone.style.display = 'block';
          return;
        }
        const phoneE164 = phoneRaw ? window.SB_VALIDATE.formatPhoneE164(phoneRaw) : null;
        const hadPhone = Boolean(r.phone_normalized);
        const clearingPhone = hadPhone && !phoneE164;
        if (clearingPhone && !iNotes.value.trim()){
          warnBox.style.display = 'block';
          warnBox.textContent = 'Escribe en Notas del organizador el motivo por el que eliminas el teléfono.';
          return;
        }
        if (clearingPhone){
          const ok = window.confirm(
            'Vas a eliminar el teléfono global de este jugador. También se deshabilitará su contacto público en todas las ediciones. ¿Continuar?'
          );
          if (!ok) return;
        }
        btnSave.disabled = true; btnSave.textContent = 'Guardando…';
        try {
          const facultyId = await window.SB_CATALOG.resolveFacultyId(iFac.value);
          const careerId = (iFac.value === 'INGENIERIA' && iCareer && iCareer.value) ? await window.SB_CATALOG.resolveCareerId(facultyId, iCareer.value) : null;
          const res = await window.SB_ADMIN_ACTIONS.updateRegistrationProfile(
            r.registration_id || r.id, iNick.value.trim(), phoneE164, facultyId, careerId,
            iNotes.value.trim()
          );
          const phoneStatus = res && res.phone_global_status;
          if (res && res.phone_conflict){
            warnBox.style.display = 'block';
            warnBox.textContent = 'Este teléfono ya pertenece a otro jugador. El snapshot se guardó, pero el teléfono global no cambió. Verifica la identidad y usa la fusión manual solo si confirmas que es la misma persona.';
            window.SB_UI.toast('Datos guardados, pero hay un teléfono en conflicto.', 'warn');
            await loadData(currentEditionId);
          } else if (phoneStatus === 'EXISTING_DIFFERENT'){
            warnBox.style.display = 'block';
            warnBox.textContent = 'El jugador ya tiene otro teléfono global. El número escrito quedó en esta inscripción, pero no reemplazó la identidad global. Usa la fusión manual o un procedimiento explícito de cambio de identidad.';
            window.SB_UI.toast('Datos guardados; el teléfono global quedó sin cambios.', 'warn');
            await loadData(currentEditionId);
          } else {
            const okMessage = phoneStatus === 'ADOPTED'
              ? 'Datos actualizados y teléfono vinculado al historial del jugador.'
              : phoneStatus === 'CLEARED'
                ? 'Teléfono eliminado y contacto público deshabilitado.'
                : 'Datos actualizados.';
            window.SB_UI.toast(okMessage, 'ok');
            await loadData(currentEditionId);
            const updated = rows.find(x => (x.registration_id || x.id) === (r.registration_id || r.id));
            openDetail(updated || r);
          }
        } catch(err){
          window.SB_LOG && window.SB_LOG.error('ADM-EDIT-2', err);
          window.SB_UI.toast((err && err.userMessage) || (err && err.message) || 'No se pudo guardar.', 'err');
        } finally {
          btnSave.disabled = false; btnSave.textContent = 'Guardar cambios';
        }
      });

      viewWrap.textContent = '';
      viewWrap.appendChild(form);
    });
    return sec;
  }

  // ── 7. Fusión manual / vincular con jugador existente ───────────────
  function buildMergeSection(r){
    const sec = el('div', 'dsec');
    sec.appendChild(el('h3', null, 'Fusión manual / vincular con jugador existente'));
    sec.appendChild(el('p', 'dnote', 'Úsala solo si confirmas que este registro es la misma persona que un jugador histórico. La coincidencia por teléfono NUNCA fusiona sola — la decides tú aquí. Si el registro nuevo era el único del jugador de origen y el histórico no tenía teléfono, la fusión puede trasladar ese teléfono al jugador histórico para reconocerlo en torneos futuros.'));

    const searchRow = el('div');
    searchRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px';
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Buscar por apodo, teléfono o últimos 4 dígitos…';
    input.style.cssText = 'flex:1;background:var(--color-raise);border:1px solid var(--color-border2);border-radius:7px;color:var(--color-text);padding:10px 12px;font-size:13px';
    const btnSearch = el('button', 'dact-btn', 'Buscar'); btnSearch.type = 'button'; btnSearch.style.flex = '0 0 auto';
    searchRow.appendChild(input); searchRow.appendChild(btnSearch);
    sec.appendChild(searchRow);

    const results = document.createElement('div');
    sec.appendChild(results);

    async function doSearch(){
      const q = input.value.trim();
      if (q.length < 2){ results.textContent = ''; return; }
      results.textContent = 'Buscando…';
      try {
        const candidates = await window.SB_ADMIN_ACTIONS.searchPlayers(q);
        renderCandidates(candidates || []);
      } catch(err){
        window.SB_LOG && window.SB_LOG.error('ADM-MERGE-1', err);
        results.textContent = '';
        results.appendChild(el('p', 'dnote danger', 'No se pudo buscar. Intenta de nuevo.'));
      }
    }
    btnSearch.addEventListener('click', doSearch);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    function renderCandidates(list){
      results.textContent = '';
      if (!list.length){ results.appendChild(el('p', 'dnote', 'Sin resultados. Ajusta la búsqueda.')); return; }
      list.forEach(c => {
        const card = el('div');
        card.style.cssText = 'border:1px solid var(--color-border2);border-radius:9px;padding:12px 14px;margin-bottom:10px;background:var(--color-raise)';
        const head = el('div'); head.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:6px';
        head.textContent = c.current_nickname || '(sin apodo)';
        card.appendChild(head);

        const cmp = document.createElement('table');
        cmp.style.cssText = 'width:100%;font-size:12px;border-collapse:collapse;margin-bottom:10px';
        const rowsCmp = [
          ['Apodo', r.nickname_snapshot, c.current_nickname],
          ['Teléfono', r.phone_normalized, c.phone_normalized],
          ['Facultad', r.faculty_name, c.faculty_name],
          ['Carrera', r.career_name, c.career_name],
          ['Registros previos', '—', String(c.registrations_count ?? '—')]
        ];
        rowsCmp.forEach(([lbl, a, b]) => {
          const tr = document.createElement('tr');
          const diff = a && b && String(a) !== String(b);
          const tdLbl = document.createElement('td'); tdLbl.textContent = lbl; tdLbl.style.cssText = 'color:var(--color-dim);padding:4px 6px;white-space:nowrap';
          const tdA = document.createElement('td'); tdA.textContent = a || '—'; tdA.style.cssText = 'padding:4px 6px;' + (diff ? 'color:var(--color-danger)' : '');
          const tdB = document.createElement('td'); tdB.textContent = b || '—'; tdB.style.cssText = 'padding:4px 6px;' + (diff ? 'color:var(--color-danger)' : '');
          tr.appendChild(tdLbl); tr.appendChild(tdA); tr.appendChild(tdB);
          cmp.appendChild(tr);
        });
        const head2 = document.createElement('tr');
        ['', 'Este registro', 'Jugador histórico'].forEach(t => { const th = document.createElement('td'); th.textContent = t; th.style.cssText = 'font-weight:700;padding:4px 6px;font-size:10.5px;text-transform:uppercase;color:var(--color-muted)'; head2.appendChild(th); });
        cmp.insertBefore(head2, cmp.firstChild);
        card.appendChild(cmp);

        const btn = el('button', 'dact-btn danger', 'Fusionar con este jugador');
        btn.type = 'button';
        const archiveWrap = document.createElement('label');
        archiveWrap.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin:8px 0;font-size:12px;color:var(--color-muted);cursor:pointer';
        const archiveCb = document.createElement('input'); archiveCb.type = 'checkbox';
        archiveWrap.appendChild(archiveCb);
        archiveWrap.appendChild(document.createTextNode(
          'Además, archivar el jugador de origen si se queda sin registros (marca merged_into_player_id/deleted_at). Desactivado por defecto: el origen puede ser un jugador histórico real.'
        ));
        card.appendChild(archiveWrap);
        btn.addEventListener('click', async () => {
          const ok = await window.SB_UI.confirmModal(
            '¿Vincular este registro con "' + (c.current_nickname || 'este jugador') + '"?',
            'Esta acción vinculará este registro con el jugador histórico seleccionado. No debe usarse si no estás seguro de que es la misma persona.' +
              (archiveCb.checked ? ' Además, ARCHIVARÁS al jugador de origen si se queda sin registros — esto no se puede deshacer fácilmente.' : ''),
            'Sí, fusionar'
          );
          if (!ok) return;
          if (archiveCb.checked){
            const okArchive = await window.SB_UI.confirmModal(
              'Confirma también archivar al jugador de origen',
              'Vas a marcar al jugador de origen como fusionado (merged_into_player_id) y eliminado (deleted_at) SI se queda sin registros propios. Esto solo debe hacerse si estás seguro de que era un player temporal, no un jugador histórico real.',
              'Sí, archivar también'
            );
            if (!okArchive) return;
          }
          const reason = prompt('Motivo de la fusión manual (obligatorio):');
          if (!reason || !reason.trim()){ window.SB_UI.toast('Necesitas explicar el motivo.', 'warn'); return; }
          try {
            const res = await window.SB_ADMIN_ACTIONS.linkRegistrationToPlayer(r.registration_id || r.id, c.player_id, reason.trim(), archiveCb.checked);
            const mergeMsg = res && res.phone_transfer_status === 'ADOPTED'
              ? 'Registro vinculado y teléfono trasladado al jugador histórico.'
              : (res && res.source_player_archived
                  ? 'Registro vinculado y jugador de origen archivado.'
                  : 'Registro vinculado correctamente.');
            window.SB_UI.toast(mergeMsg, 'ok');
            await loadData(currentEditionId);
            const updated = rows.find(x => (x.registration_id || x.id) === (r.registration_id || r.id));
            openDetail(updated || r);
          } catch(err){
            window.SB_LOG && window.SB_LOG.error('ADM-MERGE-2', err);
            window.SB_UI.toast((err && err.userMessage) || (err && err.message) || 'No se pudo fusionar.', 'err');
          }
        });
        card.appendChild(btn);
        results.appendChild(card);
      });
    }
    return sec;
  }

  // ── acciones administrativas (botones reales, visibles según estado) ─
  function buildActions(r){
    const status = String(r.registration_status || '').toUpperCase();
    const payStatus = String(r.payment_status || '').toUpperCase();
    const nodes = [];

    if (status === 'CONFIRMED'){
      nodes.push(el('span', 'dact-status', '✓ Inscripción confirmada'));
    }
    if (status === 'CANCELLED'){
      nodes.push(el('span', 'dact-status off', '✕ Inscripción cancelada'));
    }
    if (status !== 'CONFIRMED' && status !== 'CANCELLED'){
      nodes.push(actionButton('Confirmar inscripción', 'primary',
        () => runAction(
          () => window.SB_ADMIN_ACTIONS.confirmRegistration(r.registration_id || r.id),
          'registration:' + (r.registration_id || r.id)
        )));
    }
    if (payStatus !== 'CONFIRMED' && payStatus !== 'WAIVED' && status !== 'CANCELLED'){
      nodes.push(actionButton('Confirmar pago', '',
        () => runAction(
          () => window.SB_ADMIN_ACTIONS.confirmPayment(r.registration_id || r.id),
          'payment:' + (r.registration_id || r.id)
        )));
      nodes.push(actionButton('Exentar pago', '',
        () => runAction(
          () => window.SB_ADMIN_ACTIONS.confirmPayment(r.registration_id || r.id, null, null, null, true),
          'payment:' + (r.registration_id || r.id)
        )));
    }
    if (status !== 'CANCELLED'){
      nodes.push(actionButton('Cancelar inscripción', 'danger', () => runAction(
        () => window.SB_ADMIN_ACTIONS.cancelRegistration(r.registration_id || r.id, null),
        'registration:' + (r.registration_id || r.id)
      )));
    }
    if (status === 'CANCELLED'){
      nodes.push(actionButton('Borrar inscripción', 'danger', async () => {
        const ok = await window.SB_UI.confirmModal(
          '¿Borrar esta inscripción?',
          'Esta acción elimina permanentemente la inscripción de "' + (r.nickname_snapshot || 'este participante') + '". No se puede deshacer.',
          'Sí, borrar'
        );
        if (!ok) return;
        return runAction(
          () => window.SB_ADMIN_ACTIONS.deleteRegistration(r.registration_id || r.id, null),
          'registration:' + (r.registration_id || r.id)
        );
      }));
    }
    return nodes;
  }

  const actionLocks = new Set();

  function actionButton(label, kind, onClick){
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = 'dact-btn' + (kind ? ' ' + kind : '');
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      const original = b.textContent;
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      b.textContent = 'Procesando…';
      try {
        await onClick();
      } finally {
        if (b.isConnected){
          b.disabled = false;
          b.removeAttribute('aria-busy');
          b.textContent = original;
        }
      }
    });
    return b;
  }

  async function runAction(fn, lockKey){
    const key = lockKey || null;
    if (key && actionLocks.has(key)){
      window.SB_UI && window.SB_UI.toast &&
        window.SB_UI.toast('Ya hay una acción en curso para este registro.', 'warn');
      return;
    }

    if (key) actionLocks.add(key);
    try {
      await fn();
      window.SB_UI && window.SB_UI.toast && window.SB_UI.toast('Acción realizada.', 'ok');
      await loadData(currentEditionId);
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('ADM-ACT', err);
      const msg = (err && err.userMessage) || (err && err.message) || 'No se pudo completar la acción.';
      window.SB_UI && window.SB_UI.toast ? window.SB_UI.toast(msg, 'err') : alert(msg);
    } finally {
      if (key) actionLocks.delete(key);
    }
  }
  function renderRows(){
    const data = filteredRows();
    const body = $('#regBody');
    body.textContent = '';
    if (!data.length){
      setState(rows.length ? '<b>Sin resultados</b>Ajusta la búsqueda o los filtros.' : '<b>Sin inscripciones</b>Todavía no hay registros en esta edición.');
      return;
    }
    setState(null);
    const frag = document.createDocumentFragment();
    data.forEach(r => {
      const tr = document.createElement('tr');
      function td(th, node){
        const c = document.createElement('td');
        c.setAttribute('data-th', th);
        if (typeof node === 'string') c.textContent = node; else if (node) c.appendChild(node);
        tr.appendChild(c);
        return c;
      }
      const part = el('span');
      part.style.display = 'flex'; part.style.alignItems = 'center'; part.style.gap = '8px';
      if (r.faculty_code && window.SB_LOGOS){
        const img = document.createElement('img');
        img.src = window.SB_LOGOS.facultyLogo(r.faculty_code); img.alt = r.faculty_name || r.faculty_code; img.loading = 'lazy';
        img.style.cssText = 'width:48px;height:48px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,0.04);flex:0 0 auto';
        img.onerror = () => { img.src = window.SB_LOGOS.FALLBACK_FACULTY; };
        part.appendChild(img);
      }
      const nm = el('span', 'part-name');
      nm.appendChild(el('b', null, r.nickname_snapshot || '—'));
      const subBits = [r.career_name || r.faculty_name].filter(Boolean);
      if (subBits.length) nm.appendChild(el('span', 'sub2', subBits.join(' · ')));
      part.appendChild(nm);
      td('Participante', part);
      td('Teléfono', r.phone_normalized || '—');
      td('Categoría', r._cat || '—');
      td('Inscripción', pill(r.registration_status, r.registration_status === 'CONFIRMED' ? 'ok' : 'warn'));
      td('Entrada', pill(r.entry_status, r.entry_status === 'ON_TIME' ? 'ok' : 'late'));
      td('Pago', paymentPill(r));
      td('Revisión', reviewPill(r));
      const folio = td('Folio', r.public_code || '—');
      folio.style.fontFamily = 'var(--mono)'; folio.style.fontSize = '11px';
      const created = td('Creado', r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) : '—');
      created.style.fontFamily = 'var(--mono)'; created.style.fontSize = '11px';
      const act = document.createElement('td');
      act.className = 'rowact'; act.setAttribute('data-th','Acciones');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-view';
      b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
      b.appendChild(document.createTextNode('Ver ficha'));
      b.addEventListener('click', e => { e.stopPropagation(); openDetail(r); });
      act.appendChild(b);
      tr.appendChild(act);
      // abrir detalle (click o Enter) — ignora clics en botones
      tr.style.cursor = 'pointer';
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', 'Ver detalle de ' + (r.nickname_snapshot || 'participante'));
      tr.addEventListener('click', e => { if (!e.target.closest('button, a')) openDetail(r); });
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) openDetail(r); });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  // ── CSV (solo columnas de la respuesta autorizada) ─────────────────
  function exportCSV(){
    const data = filteredRows();
    if (!data.length) return;
    if (!confirm('El CSV contiene información privada de participantes (teléfonos, correos). ¿Descargar?')) return;
    const cols = ['public_code','nickname_snapshot','phone_normalized','_cat','registration_status','entry_status','payment_status','requires_review','created_at'];
    const heads = ['Folio','Apodo','Teléfono','Categoría','Inscripción','Entrada','Pago','Revisión','Creado'];
    const csv = V.toCSV(data, cols, heads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inscripciones-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ── login ──────────────────────────────────────────────────────────
  function restoreEmail(){
    try { const e = localStorage.getItem('fi_admin_email'); if (e) $('#lgEmail').value = e; } catch(_){}
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const now = Date.now();
    const msg = $('#loginMsg');
    if (now < lockUntil){
      msg.textContent = 'Demasiados intentos. Espera ' + Math.ceil((lockUntil - now)/1000) + ' s.';
      msg.className = 'msg err';
      return;
    }
    const email = $('#lgEmail').value.trim(), pass = $('#lgPass').value;
    $('#fEmail').classList.toggle('invalid', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
    if ($('#fEmail').classList.contains('invalid')){ $('#lgEmail').focus(); return; }
    const btn = $('#btnLogin');
    msg.className = 'msg';
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const session = await window.SB_AUTH.signIn(email, pass);
      try { localStorage.setItem('fi_admin_email', email); } catch(_){}   // solo el correo
      failCount = 0;
      await afterLogin(session);
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('AUTH-001', err);
      failCount++;
      if (failCount >= 4){ lockUntil = Date.now() + 30000; failCount = 0; }
      msg.textContent = window.SB_AUTH.translateAuthError(err) + ' (código AUTH-001)';
      msg.className = 'msg err';
    } finally {
      btn.disabled = false; btn.textContent = 'Iniciar sesión';
    }
  });

  // mostrar/ocultar contraseña
  $('#pwdToggle').addEventListener('click', () => {
    const inp = $('#lgPass');
    const showPwd = inp.type === 'password';
    inp.type = showPwd ? 'text' : 'password';
    $('#pwdToggle').textContent = showPwd ? 'Ocultar' : 'Ver';
    $('#pwdToggle').setAttribute('aria-pressed', String(showPwd));
    inp.focus();
  });
  // indicador Caps Lock
  $('#lgPass').addEventListener('keyup', e => {
    const on = e.getModifierState && e.getModifierState('CapsLock');
    $('#capsWarn').classList.toggle('on', !!on);
  });

  // recuperación de contraseña
  $('#btnForgot').addEventListener('click', async () => {
    const email = $('#lgEmail').value.trim();
    const msg = $('#loginMsg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
      msg.textContent = 'Escribe tu correo arriba y vuelve a pulsar "¿Olvidaste tu contraseña?".';
      msg.className = 'msg err';
      $('#lgEmail').focus();
      return;
    }
    try {
      const redirectTo = location.origin + location.pathname.replace(/[^/]*$/, '') + 'RestablecerPassword.html';
      const { error } = await window.SB.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      msg.textContent = 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.';
      msg.className = 'msg ok';
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('AUTH-002', err);
      msg.textContent = 'No se pudo enviar el correo de recuperación. (código AUTH-002)';
      msg.className = 'msg err';
    }
  });

  async function doLogout(scope){
    try {
      if (scope === 'global') await window.SB.auth.signOut({ scope: 'global' });
      else await window.SB_AUTH.signOut();
    } catch(e){ window.SB_LOG && window.SB_LOG.error('AUTH-003', e); }
    rows = [];
    $('#regBody').textContent = '';
    $('#whoami').textContent = '';
    $('#btnLogout').style.display = 'none';
    const lco = $('#lnkControl'); if (lco) lco.style.display = 'none';
    show('loginView');
    restoreEmail();
  }
  $('#btnLogout').addEventListener('click', () => doLogout());
  $('#btnDeniedLogout').addEventListener('click', () => doLogout());
  $('#btnLogoutAll').addEventListener('click', () => {
    if (confirm('¿Cerrar la sesión en TODOS los dispositivos?')) doLogout('global');
  });

  // filtros / orden / acciones
  $('#admSearch').addEventListener('input', e => { filters.q = e.target.value; renderRows(); });
  $('#admStatus').addEventListener('change', e => { filters.status = e.target.value; renderRows(); });
  $('#admEntry').addEventListener('change', e => { filters.entry = e.target.value; renderRows(); });
  $('#admCat').addEventListener('change', e => { filters.cat = e.target.value; renderRows(); });
  $('#btnReload').addEventListener('click', () => loadData(currentEditionId));
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      sort.dir = (sort.key === k) ? -sort.dir : 1;
      sort.key = k;
      document.querySelectorAll('th.sortable').forEach(t => t.setAttribute('aria-sort','none'));
      th.setAttribute('aria-sort', sort.dir === 1 ? 'ascending' : 'descending');
      renderRows();
    });
  });

  boot();
})();
