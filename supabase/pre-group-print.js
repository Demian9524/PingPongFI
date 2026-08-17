// ── IMPRIMIBLES DEL SORTEO DE GRUPOS (ControlTorneo.html) ───────────────
// SOLO LECTURA. Este módulo nunca escribe en Supabase: no crea grupos,
// membresías, partidos ni resultados, no llama create_group_stage_matches y
// no toca ningún interruptor de visibilidad pública.
//
// Fuente autenticada ÚNICA de participantes:
//   window.SB_ADMIN.fetchAdminRegistrations(editionId)
//   → RPC admin_registrations(p_edition_id), autorizada por is_organizer().
//   El campo nickname_snapshot que devuelve esa RPC ya viene resuelto por el
//   backend como nombre canónico (v_admin_registrations hace
//   coalesce(players.current_nickname, registrations.nickname_snapshot)).
// Elegibilidad: registration_status = CONFIRMED y payment_status ∈
//   {CONFIRMED, WAIVED} — misma regla del backend y del tablero de grupos.
// La lista pública (edition_category_pre_group_visibility) NO participa:
// imprimir funciona con todas las categorías ocultas.
//
// Papeleta: 80 × 30 mm (alto exacto 3 cm), cuatro módulos de 20 mm, tres
// dobleces (20 / 40 / 60 mm verticales y 15 mm horizontal) → 20 × 15 mm doblada.
// Color por categoría (paleta del menú principal): rojo Avanzados, azul
// Intermedios, verde Principiantes.
// Los dos logotipos se incrustan UNA sola vez como Data URI dentro del
// documento generado, así que el HTML descargado los conserva en file://.

(function(global){
  'use strict';

  const VERSION = '121';
  const CSS_HREF = 'css/pre-group-print.css?v=' + VERSION;
  const ASSETS = {
    fi:  { url: 'assets/logo-fi-vector.svg',         label: 'logo institucional (SVG vectorial)' },
    cup: { url: 'assets/logo-torneo-27-1-print.png', label: 'logo oficial 27-1 a color' },
    esc: { url: 'assets/escudo-fi.svg',              label: 'escudo de la Facultad (SVG vectorial)' }
  };

  // Color por categoría — mismos valores del menú principal (Pagina Torneo.html)
  function catClass(label){
    const s = String(label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/avanz|open/.test(s)) return 'cat-av';          // rojo  #dd3b2c
    if (/interm/.test(s))     return 'cat-in';          // azul  #3a63f0
    if (/princip|novat|inici/.test(s)) return 'cat-pr'; // verde #37bb66
    return '';
  }

  // Medida abierta → doblada = (w/4) × (h/2) · alto fijo de 30 mm (3 cm)
  const SIZES = {
    s78: { w: 78, h: 30, label: '78 × 30 mm' },
    s80: { w: 80, h: 30, label: '80 × 30 mm — RECOMENDADO' },
    s82: { w: 82, h: 30, label: '82 × 30 mm' }
  };
  const PAGE = { w: 210, h: 297, margin: 8, gap: 2, head: 42 };
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const S = {
    editionId: null, editions: [], edition: null, edcats: [],
    rows: [], catId: null, sizeKey: 's80', distIdx: 0, dists: [],
    eligibles: [], fingerprint: '', busy: false, mounted: false,
    snapshot: null, kind: null, stale: false, modal: null,
    assets: null, assetError: null, listeners: []
  };

  // Notifica a los módulos que dependen de este contexto (captura del sorteo).
  function notify(){
    const ctx = getContext();
    S.listeners.forEach(fn => {
      try { fn(ctx); }
      catch(err){ global.SB_LOG && global.SB_LOG.error('PGP-NOTIFY', err); }
    });
  }
  function getContext(){
    const cat = S.edcats.find(c => String(c.id) === String(S.catId));
    const catName = (cat && (cat.name || cat.code)) || '—';
    const test = $('#pgpTest');
    return {
      editionId: S.editionId,
      editionCategoryId: S.catId,
      editionLabel: (S.edition && (S.edition.slug || S.edition.name)) || '—',
      categoryLabel: catName,
      categoryShort: catName.replace(/\s*\/\s*open\s*$/i, '').trim() || catName,
      participants: S.eligibles.slice(),
      dist: S.dists[S.distIdx] || null,
      rosterFingerprint: S.fingerprint,
      test: !!(test && test.checked),
      assetError: S.assetError,
      ready: !!(S.eligibles.length && S.dists.length && !S.assetError)
    };
  }

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function msg(text, cls){
    const n = $('#pgpMsg');
    if (!n) return;
    n.textContent = text || '';
    n.className = 'metaline' + (cls ? ' ' + cls : '');
  }
  function fmtDateTime(d){
    try { return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch(e){ return d.toISOString(); }
  }
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  };

  // ── 1. Distribuciones válidas ────────────────────────────────────────
  // objetivo 4 · mínimo 3 · máximo 5 · diferencia máxima entre grupos = 1
  function distributions(n){
    const out = [];
    if (!n || n < 3) return out;
    for (let g = 1; g <= Math.floor(n / 3); g++){
      const k = Math.floor(n / g), r = n % g;
      let sizes;
      if (r === 0){
        if (k < 3 || k > 5) continue;
        sizes = new Array(g).fill(k);
      } else {
        if (k < 3 || k + 1 > 5) continue;
        sizes = new Array(r).fill(k + 1).concat(new Array(g - r).fill(k));
      }
      out.push({ groups: g, sizes: sizes, avg: n / g });
    }
    out.sort((a, b) =>
      Math.abs(a.avg - 4) - Math.abs(b.avg - 4) ||
      (Math.max.apply(null, a.sizes) - Math.min.apply(null, a.sizes)) - (Math.max.apply(null, b.sizes) - Math.min.apply(null, b.sizes)) ||
      b.groups - a.groups);
    return out;
  }
  const distLabel = d => d.groups + ' grupo' + (d.groups === 1 ? '' : 's') + ' · ' + d.sizes.join('–') +
    ' · promedio ' + (Math.round(d.avg * 100) / 100).toString().replace('.', ',');
  const groupLetter = i => LETTERS[i] || ('G' + (i + 1));

  function layoutFor(size){
    const cw = PAGE.w - PAGE.margin * 2, ch = PAGE.h - PAGE.margin * 2;
    const cols = Math.max(1, Math.floor((cw + PAGE.gap) / (size.w + PAGE.gap)));
    const rows = Math.max(1, Math.floor((ch - PAGE.head + PAGE.gap) / (size.h + PAGE.gap)));
    return { cols: cols, rows: rows, perPage: cols * rows };
  }

  // ── 2. Datos (solo lectura, sin datos privados en el imprimible) ─────
  function isEligible(r){
    const rs = String(r.registration_status || '').toUpperCase();
    const ps = String(r.payment_status || '').toUpperCase();
    return rs === 'CONFIRMED' && (ps === 'CONFIRMED' || ps === 'WAIVED');
  }
  // Proyección mínima: nombre canónico + folio público. Nunca teléfono,
  // WhatsApp, correo, pago, notas ni IDs internos.
  function sanitize(rows, edcatId){
    return rows
      .filter(r => String(r.edition_category_id) === String(edcatId) && isEligible(r))
      .map(r => ({
        key: String(r.registration_id || r.public_code || ''),
        name: String(r.nickname_snapshot || '').trim() || 'SIN NOMBRE',
        code: String(r.public_code || '').trim()
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }
  const fingerprintOf = list => list.map(p => p.key + '~' + p.name).join('|');

  async function fetchRows(editionId){
    if (!global.SB_ADMIN) throw new Error('SB_ADMIN no está disponible en esta página.');
    return await global.SB_ADMIN.fetchAdminRegistrations(editionId);
  }

  // ── 3. Logotipos incrustados (una sola vez por documento) ────────────
  // Hoja de estilos del imprimible, precargada como texto. El documento
  // generado la lleva incrustada en vez de enlazada: un <link> dentro de
  // srcdoc puede perder la carrera de carga y dejar la vista previa sin
  // estilos de forma permanente. Así la previa es idéntica al archivo que se
  // descarga y fitTickets nunca mide cajas sin estilar.
  let cssCache = null;
  async function inlineCss(){
    if (cssCache) return cssCache;
    const cssUrl = new URL(CSS_HREF, document.baseURI).href;
    const res = await fetch(cssUrl);
    if (!res.ok) throw new Error('No se pudo leer ' + CSS_HREF + ' (' + res.status + ').');
    const text = await res.text();
    cssCache = text.replace(/url\((['"]?)([^)'"]+)\1\)/g,
      (m, q, u) => /^(data:|https?:)/i.test(u) ? m : 'url("' + new URL(u, cssUrl).href + '")');
    return cssCache;
  }

  function toDataUri(blob){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('No se pudo codificar el recurso.'));
      fr.readAsDataURL(blob);
    });
  }
  async function loadAssets(){
    if (S.assets) return S.assets;
    const out = {};
    for (const k of Object.keys(ASSETS)){
      const spec = ASSETS[k];
      const href = new URL(spec.url + '?v=' + VERSION, document.baseURI).href;
      let res;
      try { res = await fetch(href); }
      catch(e){ throw new Error('No se pudo cargar el ' + spec.label + ' (' + spec.url + ').'); }
      if (!res.ok) throw new Error('No se pudo cargar el ' + spec.label + ' (' + spec.url + ' → HTTP ' + res.status + ').');
      const blob = await res.blob();
      if (!blob.size) throw new Error('El ' + spec.label + ' llegó vacío (' + spec.url + ').');
      out[k] = await toDataUri(blob);
      if ((k === 'fi' || k === 'esc') && !/^data:image\/svg\+xml/.test(out[k])){
        out[k] = 'data:image/svg+xml;base64,' + out[k].split(',')[1];
      }
    }
    S.assets = out;
    await inlineCss();          // deja la hoja lista antes de generar nada
    return out;
  }

  // ── 4. Bloque administrativo ─────────────────────────────────────────
  function setBusy(v){
    S.busy = v;
    const root = $('#pgpPanel');
    if (!root) return;
    root.querySelectorAll('select,button,input').forEach(n => { n.disabled = v; });
    root.setAttribute('aria-busy', String(v));
    if (!v) syncActions();
  }
  function syncActions(){
    const ok = S.eligibles.length >= 3 && S.dists.length > 0 && !S.assetError;
    ['#pgpPrevP', '#pgpPrevG', '#pgpPkg'].forEach(sel => {
      const n = $(sel);
      if (n) n.disabled = !ok;
    });
    const cal = $('#pgpCalib');
    if (cal) cal.disabled = !!S.assetError;
  }
  function fillSelect(sel, items, value){
    sel.textContent = '';
    items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.value; o.textContent = it.label;
      sel.appendChild(o);
    });
    if (value != null) sel.value = String(value);
  }

  function renderKpis(){
    const wrap = $('#pgpKpis');
    if (!wrap) return;
    wrap.textContent = '';
    const d = S.dists[S.distIdx];
    const sz = SIZES[S.sizeKey];
    const lay = layoutFor(sz);
    const cat = S.edcats.find(c => String(c.id) === String(S.catId));
    const pages = d ? Math.ceil(S.eligibles.length / lay.perPage) * 2 : 0;
    [
      ['Participantes elegibles', String(S.eligibles.length)],
      ['Distribución seleccionada', d ? d.sizes.join('–') : '—'],
      ['Papelitos participantes + grupos', d ? (S.eligibles.length + ' + ' + S.eligibles.length) : '—'],
      ['Medida abierta', sz.w + ' × ' + sz.h + ' mm'],
      ['Medida doblada', (sz.w / 4) + ' × ' + (sz.h / 2) + ' mm'],
      ['Hojas A4 del paquete', pages ? (pages + ' (' + lay.perPage + ' por hoja)') : '—'],
      ['Categoría', cat ? (cat.name || cat.code) : '—'],
      ['Fecha y hora de generación', fmtDateTime(new Date())]
    ].forEach(([lbl, val]) => {
      const k = el('div', 'pgp-kpi');
      k.appendChild(el('b', null, val));
      k.appendChild(el('small', null, lbl));
      wrap.appendChild(k);
    });
    const stale = $('#pgpStale');
    if (stale) stale.style.display = S.stale ? 'block' : 'none';
  }

  function recompute(){
    S.eligibles = sanitize(S.rows, S.catId);
    S.fingerprint = fingerprintOf(S.eligibles);
    S.dists = distributions(S.eligibles.length);
    S.distIdx = 0;
    const sel = $('#pgpDist');
    if (sel){
      if (S.dists.length){
        fillSelect(sel, S.dists.map((d, i) => ({ value: i, label: distLabel(d) })), 0);
      } else {
        fillSelect(sel, [{ value: '', label: 'Sin distribución válida' }], '');
      }
    }
    renderKpis();
    syncActions();
    notify();
    if (S.assetError){
      msg(S.assetError, 'k-danger');
    } else if (!S.eligibles.length){
      msg('Esta categoría no tiene participantes elegibles (inscripción CONFIRMED y pago CONFIRMED o WAIVED). No hay nada que imprimir.', 'k-warn');
    } else if (!S.dists.length){
      msg('Con ' + S.eligibles.length + ' participantes no existe ninguna distribución válida (grupos de 3 a 5 con diferencia máxima de una persona).', 'k-danger');
    } else {
      msg('Propuesta predeterminada: ' + distLabel(S.dists[0]) + '. Puedes elegir otra distribución válida en el selector.', 'k-ok');
    }
  }

  async function loadEdition(editionId){
    setBusy(true);
    msg('Consultando inscripciones autorizadas…');
    try {
      S.editionId = editionId;
      S.edition = S.editions.find(e => String(e.id) === String(editionId)) || S.edition;
      S.edcats = await global.SB_CATALOG.getEditionCategories(editionId);
      S.rows = await fetchRows(editionId);
      const prev = S.catId;
      const keep = S.edcats.some(c => String(c.id) === String(prev));
      S.catId = keep ? prev : (S.edcats.length ? S.edcats[0].id : null);
      fillSelect($('#pgpCat'), S.edcats.map(c => ({ value: c.id, label: c.name || c.code })), S.catId);
      S.stale = false;
      recompute();
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-001', err);
      S.rows = []; S.eligibles = []; S.dists = [];
      renderKpis(); syncActions();
      msg((err && err.userMessage) || (err && err.message) || 'No se pudieron consultar las inscripciones. (PGP-001)', 'k-danger');
    } finally {
      setBusy(false);
    }
  }

  // ── 5. Documento imprimible ──────────────────────────────────────────
  function docShell(bodyHTML, size, cat){
    const a = S.assets || {};
    const sheet = cssCache
      ? '<style>' + cssCache + '</style>'
      : '<link rel="stylesheet" href="' + CSS_HREF + '">';
    return '<!doctype html><html lang="es" class="pgp-html"><head><meta charset="utf-8">' +
      '<title>Sorteo oficial de grupos · Ping Pong FI</title>' + sheet +
      '<style>.pgp-logo-fi{background-image:url("' + a.fi + '")}' +
      '.pgp-logo-cup{background-image:url("' + a.cup + '")}' +
      '.pgp-wm{background-image:url("' + a.esc + '")}</style>' +
      '</head><body><div class="pgp-doc' + (cat ? ' ' + cat : '') +
      '" style="--tw:' + size.w + 'mm;--th:' + size.h + 'mm">' +
      bodyHTML + '</div></body></html>';
  }

  const logoFi = white => '<span class="pgp-logo-fi' + (white ? ' is-white' : '') +
    '" role="img" aria-label="Facultad de Ingeniería"></span>';
  const logoCup = () => '<span class="pgp-logo-cup" role="img" aria-label="Ping Pong FI"></span>';

  function sheetHead(title, snap, o){
    const mini = o.page > 1;
    const pageTag = 'Página ' + o.page + '/' + o.pages;
    const strip = '<div class="pgp-head-strap"></div>';
    const top = '<div class="pgp-head-top">' + logoFi(true) +
      '<div class="pgp-head-c"><b>Sorteo oficial de grupos</b>' +
      '<span>' + esc(title) + ' · Torneo de Ping Pong FI · ' + esc(snap.editionLabel) +
      ' · ' + esc(snap.categoryLabel) + '</span></div>' + logoCup() + '</div>';
    const foot = '<div class="pgp-head-foot">' +
      '<span>' + esc(pageTag) + '</span>' +
      '<span>Lista tomada: ' + esc(snap.takenAtLabel) + '</span>' +
      '<span>Medida ' + snap.size.w + ' × ' + snap.size.h + ' mm · doblada ' + (snap.size.w / 4) + ' × ' + (snap.size.h / 2) + ' mm</span>' +
      '<span>Doblar con la impresión hacia dentro</span>' +
      '<span>Imprimir al 100 %, sin ajustar a página</span></div>';
    if (mini){
      return '<div class="pgp-head pgp-head--mini">' +
        (snap.test ? '<div class="pgp-test">Documento de prueba — no usar en el sorteo real</div>' : '') +
        top + strip + foot + '</div>';
    }
    const cells = [
      ['Edición', snap.editionLabel],
      ['Categoría', snap.categoryLabel],
      ['Papelitos', String(o.count)],
      ['Distribución', snap.dist.sizes.join('–')],
      ['Hoja', o.page + ' / ' + o.pages]
    ];
    return '<div class="pgp-head">' +
      (snap.test ? '<div class="pgp-test">Documento de prueba — no usar en el sorteo real</div>' : '') +
      top + strip +
      '<div class="pgp-head-grid">' +
        cells.map(c => '<div class="pgp-hcell"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>').join('') +
      '</div>' + foot + '</div>';
  }

  function moduleOne(snap, kind){
    return '<div class="pgp-m1">' +
      '<div class="pgp-brand">' + logoFi(true) + '</div>' +
      '<div class="pgp-m1-body">' +
        '<span><span class="pgp-lbl">Edición</span><span class="pgp-val-box">' +
          '<span class="pgp-val" data-fit="1">' + esc(snap.editionLabel) + '</span></span></span>' +
        '<span><span class="pgp-lbl">Categoría</span><span class="pgp-val-box">' +
          '<span class="pgp-val" data-fit="1">' + esc(snap.categoryShort) + '</span></span></span>' +
        '<span class="pgp-kind">' + esc(kind) + '</span>' +
      '</div>' +
    '</div>';
  }
  // marca de agua: escudo de la Facultad, muy tenue, detrás del dato del sorteo
  const orbit = () => '<span class="pgp-wm" aria-hidden="true"></span>';
  const proof = snap => snap.test ? '<span class="pgp-proof">Prueba</span>' : '';

  function participantTicket(p, snap){
    const total = snap.participants.length;
    const pad = String(total).length;
    const ctrl = 'P' + String(p.idx + 1).padStart(pad, '0') + '/' + total;
    return '<div class="pgp-cell"><div class="pgp-t">' +
      moduleOne(snap, 'Participante') +
      '<div class="pgp-m23">' + orbit() +
        '<span class="pgp-eyebrow">Sorteo oficial de grupos</span>' +
        '<span class="pgp-name-box"><span class="pgp-name" data-fit="2">' + esc(p.name) + '</span></span>' +
        '<span class="pgp-foot"><span class="pgp-code">' + esc(p.code || '—') + '</span>' +
        '<span class="pgp-ctrl">' + esc(ctrl) + '</span></span>' +
      '</div>' +
      '<div class="pgp-m4">' + logoCup() + '</div>' +
      proof(snap) +
    '</div></div>';
  }

  function groupTicket(g, snap){
    return '<div class="pgp-cell"><div class="pgp-t">' +
      moduleOne(snap, 'Destino') +
      '<div class="pgp-m23">' + orbit() +
        '<span class="pgp-eyebrow">Destino del sorteo</span>' +
        '<span class="pgp-gwrap"><span class="pgp-gletter">' + esc(g.letter) + '</span>' +
          '<span class="pgp-gmeta"><span class="pgp-gname">Grupo ' + esc(g.letter) + '</span>' +
          '<span class="pgp-speed"><i></i><i></i><i></i></span></span></span>' +
        '<span class="pgp-foot"><span class="pgp-code">Capacidad</span>' +
        '<span class="pgp-ctrl">' + esc(g.letter + ' ' + g.j + '/' + g.cap) + '</span></span>' +
      '</div>' +
      '<div class="pgp-m4">' + logoCup() + '</div>' +
      proof(snap) +
    '</div></div>';
  }

  function groupItemsFor(dist){
    const out = [];
    if (!dist) return out;
    dist.sizes.forEach((cap, gi) => {
      for (let j = 1; j <= cap; j++) out.push({ letter: groupLetter(gi), j: j, cap: cap });
    });
    return out;
  }
  const groupItems = snap => groupItemsFor(snap.dist);

  function sheetsFor(kind, snap){
    const items = kind === 'groups' ? groupItems(snap)
      : snap.participants.map((p, i) => Object.assign({ idx: i }, p));
    const pages = chunk(items, snap.layout.perPage);
    const title = kind === 'groups' ? 'Papelitos de grupos' : 'Papelitos de participantes';
    return pages.map((page, i) => '<section class="pgp-sheet">' +
      sheetHead(title, snap, { page: i + 1, pages: pages.length, count: items.length }) +
      '<div class="pgp-grid" style="--cols:' + snap.layout.cols + '">' +
        page.map(it => kind === 'groups' ? groupTicket(it, snap) : participantTicket(it, snap)).join('') +
      '</div></section>').join('');
  }

  function calibrationSheet(){
    const ticks = [];
    for (let i = 0; i <= 50; i++){
      const h = i % 10 === 0 ? 3.6 : (i % 5 === 0 ? 2.4 : 1.4);
      ticks.push('<i style="left:' + i + 'mm;height:' + h + 'mm"></i>');
      if (i % 10 === 0) ticks.push('<span style="left:' + i + 'mm">' + i + '</span>');
    }
    const sample = sz => {
      const snap = {
        editionLabel: '27-1', categoryLabel: 'Muestra', categoryShort: 'Muestra',
        size: sz, test: false, participants: [{ name: 'MUESTRA DE DOBLEZ', code: 'CALIBRACIÓN', idx: 0 }],
        dist: { sizes: [] }
      };
      return participantTicket(snap.participants[0], snap);
    };
    const blocks = Object.keys(SIZES).map(k => {
      const sz = SIZES[k];
      return '<div class="pgp-cal-block" style="--tw:' + sz.w + 'mm;--th:' + sz.h + 'mm">' +
        '<div class="pgp-cal-t">Muestra ' + sz.w + ' × ' + sz.h + ' mm</div>' +
        '<div class="pgp-cal-sub">Recorta por el contorno y dobla en cuartos a lo ancho y por la mitad a lo alto</div>' +
        '<div class="pgp-cal-row">' + sample(sz) +
          '<div class="pgp-cal-dims">' +
            '<span>Abierto <b>' + sz.w + ' × ' + sz.h + ' mm</b></span>' +
            '<span>Dobleces verticales <b>' + (sz.w / 4) + ' · ' + (sz.w / 2) + ' · ' + (sz.w * 3 / 4) + ' mm</b></span>' +
            '<span>Doblez horizontal <b>' + (sz.h / 2) + ' mm</b></span>' +
            '<span>Doblado final <b>' + (sz.w / 4) + ' × ' + (sz.h / 2) + ' mm</b></span>' +
            '<span>Diagonal aproximada ' + Math.round(Math.sqrt(Math.pow(sz.w / 4, 2) + Math.pow(sz.h / 2, 2))) +
              ' mm · pelota de 35 mm ø</span>' +
            '<span>Doblar con la impresión hacia dentro</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<section class="pgp-sheet">' +
      '<div class="pgp-cal-note">Imprimir al 100 %, sin ajustar a página<br>' +
      'Papel recomendado 75–90 g/m² · verifica con la regla y el cuadrado antes del paquete</div>' +
      blocks +
      '<div class="pgp-cal-block"><div class="pgp-cal-t">Control de escala</div>' +
        '<div class="pgp-cal-sub">Si la regla no mide 50 mm reales, la impresión no está al 100 %</div>' +
        '<div class="pgp-tools">' +
          '<div class="pgp-ruler"><em>Regla 50 mm</em>' + ticks.join('') + '</div>' +
          '<div class="pgp-square"><span>30 × 30 mm</span></div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // ── 6. Snapshot en memoria (fotografía de la lista) ──────────────────
  function buildSnapshot(){
    const cat = S.edcats.find(c => String(c.id) === String(S.catId));
    const now = new Date();
    const catName = (cat && (cat.name || cat.code)) || '—';
    const size = SIZES[S.sizeKey];
    return {
      participants: S.eligibles.slice(),
      fingerprint: S.fingerprint,
      dist: S.dists[S.distIdx],
      size: size,
      sizeKey: S.sizeKey,
      layout: layoutFor(size),
      test: !!$('#pgpTest').checked,
      editionLabel: (S.edition && (S.edition.slug || S.edition.name)) || '—',
      categoryLabel: catName,
      categoryShort: catName.replace(/\s*\/\s*open\s*$/i, '').trim() || catName,
      catClass: catClass(catName),
      takenAt: now,
      takenAtLabel: fmtDateTime(now)
    };
  }

  function docFor(kind, snap){
    if (kind === 'calibration') return docShell(calibrationSheet(), SIZES.s80);
    const cat = snap ? snap.catClass : '';
    if (kind === 'participants') return docShell(sheetsFor('participants', snap), snap.size, cat);
    if (kind === 'groups') return docShell(sheetsFor('groups', snap), snap.size, cat);
    return docShell(sheetsFor('participants', snap) + sheetsFor('groups', snap), snap.size, cat);
  }

  // ── 7. Modal de vista previa ─────────────────────────────────────────
  function buildModal(){
    if (S.modal) return S.modal;
    const bg = el('div', 'pgp-modal-bg');
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.setAttribute('aria-labelledby', 'pgpModalT');
    bg.innerHTML =
      '<div class="pgp-modal">' +
        '<header><h2 id="pgpModalT">Vista previa</h2>' +
        '<button class="pgp-x" type="button" id="pgpClose" aria-label="Cerrar vista previa">×</button></header>' +
        '<div class="pgp-modal-meta" id="pgpMeta"></div>' +
        '<div class="pgp-modal-warn" id="pgpWarn"></div>' +
        '<div class="pgp-modal-body"><div class="pgp-frame-wrap" id="pgpWrap">' +
        '<iframe id="pgpFrame" title="Vista previa del paquete imprimible"></iframe></div></div>' +
        '<footer>' +
          '<button class="btn btn-main" type="button" id="pgpDoPrint">Imprimir</button>' +
          '<button class="btn btn-ghost" type="button" id="pgpDownload">Descargar archivo</button>' +
          '<button class="btn btn-ghost" type="button" id="pgpRegen">Regenerar</button>' +
          '<button class="btn btn-ghost" type="button" id="pgpBack">Volver</button>' +
          '<span class="pgp-note">Desactiva encabezados y pies de página del navegador · Escala 100 % (sin «ajustar a página») · En el mismo diálogo puedes elegir «Guardar como PDF».</span>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(bg);
    bg.querySelector('#pgpClose').addEventListener('click', closeModal);
    bg.querySelector('#pgpBack').addEventListener('click', closeModal);
    bg.querySelector('#pgpDoPrint').addEventListener('click', printFrame);
    bg.querySelector('#pgpDownload').addEventListener('click', downloadFile);
    bg.querySelector('#pgpRegen').addEventListener('click', regenerate);
    bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && bg.classList.contains('open')) closeModal();
    });
    S.modal = bg;
    return bg;
  }

  function closeModal(){
    if (!S.modal) return;
    S.modal.classList.remove('open');
    S.modal.querySelector('#pgpFrame').srcdoc = '';
    document.body.style.overflow = '';
  }

  // Ajuste tipográfico real: reduce hasta que el texto quepa en su caja y en
  // el número de líneas permitido. Nunca recorta ni desborda.
  function fitTickets(doc){
    const view = doc.defaultView;
    doc.querySelectorAll('[data-fit]').forEach(n => {
      const lines = Number(n.getAttribute('data-fit')) || 2;
      const box = n.parentElement;
      const start = parseFloat(view.getComputedStyle(n).fontSize);
      let px = start, guard = 0;
      while (guard++ < 90 && px > start * 0.58){
        const maxH = Math.min(box.clientHeight + 0.5, Math.ceil(lines * px * 1.06) + 2);
        const wide = n.scrollWidth > n.clientWidth + 0.5 ||
          n.getBoundingClientRect().width > box.clientWidth + 0.5;
        const tall = n.scrollHeight > maxH;
        if (!wide && !tall) break;
        px -= Math.max(0.25, px * 0.04);
        n.style.fontSize = px + 'px';
      }
    });
  }

  function scaleFrame(){
    const wrap = document.getElementById('pgpWrap');
    const frame = document.getElementById('pgpFrame');
    if (!wrap || !frame || !frame.contentDocument) return;
    const doc = frame.contentDocument;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    frame.style.height = h + 'px';
    const avail = wrap.parentElement.clientWidth - 4;
    const scale = Math.min(1, avail / 794);
    wrap.style.transform = 'scale(' + scale + ')';
    wrap.style.width = 794 + 'px';
    wrap.style.height = (h * scale) + 'px';
  }

  function renderDoc(kind, snap, autoPrint){
    const bg = buildModal();
    const frame = bg.querySelector('#pgpFrame');
    const titles = { calibration: 'Hoja de calibración', participants: 'Vista previa · participantes',
      groups: 'Vista previa · grupos', full: 'Paquete completo del sorteo' };
    bg.querySelector('#pgpModalT').textContent = titles[kind] || 'Vista previa';
    const meta = bg.querySelector('#pgpMeta');
    meta.textContent = '';
    let bits;
    if (kind === 'calibration'){
      bits = [['Hoja', 'A4 · 3 medidas'], ['Escala', '100 %'], ['Papel', '75–90 g/m²'],
        ['Uso', 'recortar y probar en pelota de 35 mm']];
    } else {
      const nG = snap.dist.sizes.reduce((a, b) => a + b, 0);
      const pP = Math.ceil(snap.participants.length / snap.layout.perPage);
      const pG = Math.ceil(nG / snap.layout.perPage);
      bits = [
        ['Papelitos de participantes', kind === 'groups' ? '—' : String(snap.participants.length)],
        ['Papelitos de grupos', kind === 'participants' ? '—' : String(nG)],
        ['Hojas A4', String(kind === 'full' ? pP + pG : (kind === 'groups' ? pG : pP))],
        ['Medida', snap.size.w + ' × ' + snap.size.h + ' mm → ' + (snap.size.w / 4) + ' × ' + (snap.size.h / 2) + ' mm'],
        ['Distribución', snap.dist.sizes.join('–')],
        ['Lista tomada', snap.takenAtLabel]
      ];
    }
    bits.forEach(([k, v]) => {
      const s = el('span', null, k + ': ');
      s.appendChild(el('b', null, v));
      meta.appendChild(s);
    });
    const warn = bg.querySelector('#pgpWarn');
    warn.textContent = '';
    if (kind !== 'calibration' && snap.test){
      warn.appendChild(el('div', 'pgp-stale', 'Documento de prueba — no usar en el sorteo real.'));
    }
    if (S.stale){
      warn.appendChild(el('div', 'pgp-stale', 'LA LISTA DE INSCRITOS CAMBIÓ. REGENERA LOS IMPRIMIBLES ANTES DEL SORTEO.'));
    }
    bg.querySelector('#pgpRegen').style.display = kind === 'calibration' ? 'none' : '';
    bg.classList.add('open');
    document.body.style.overflow = 'hidden';

    frame.onload = function(){
      const doc = frame.contentDocument;
      const done = () => {
        try { fitTickets(doc); } catch(e){ global.SB_LOG && global.SB_LOG.error('PGP-FIT', e); }
        scaleFrame();
        setTimeout(scaleFrame, 60);
        if (autoPrint) setTimeout(printFrame, 220);
      };
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(done).catch(done);
      else done();
    };
    frame.srcdoc = docFor(kind, snap);
  }

  function printFrame(){
    const frame = document.getElementById('pgpFrame');
    const wrap = document.getElementById('pgpWrap');
    if (!frame || !frame.contentWindow) return;
    const prev = wrap ? wrap.style.transform : '';
    if (wrap) wrap.style.transform = 'none';
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-PRINT', err);
      msg('El navegador bloqueó el diálogo de impresión. Vuelve a intentar desde el botón IMPRIMIR.', 'k-danger');
    } finally {
      if (wrap) setTimeout(() => { wrap.style.transform = prev; }, 400);
    }
  }

  // Descarga autosuficiente: mismo HTML del iframe (con los tamaños de fuente
  // ya ajustados), la hoja de estilos incrustada, las fuentes en URL absoluta
  // y los dos logotipos ya embebidos como Data URI — funciona en file://.
  // docShell ya incrusta la hoja; el reemplazo del <link> queda como respaldo.
  async function buildStandalone(rawHtml){
    const needle = '<link rel="stylesheet" href="' + CSS_HREF + '">';
    let out = rawHtml;
    if (out.indexOf(needle) >= 0){
      const css = await inlineCss();
      out = out.replace(needle, () => '<style>' + css + '</style>');
    }
    if (!/url\("data:image\/svg\+xml/.test(out) || !/url\("data:image\/png/.test(out)){
      throw new Error('El archivo no incluye los dos logotipos incrustados. No se descargó nada.');
    }
    return out;
  }

  function saveBlob(html, name){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  }
  async function downloadHtml(rawHtml, name){
    saveBlob(await buildStandalone(rawHtml), name);
  }

  async function downloadFile(){
    const frame = document.getElementById('pgpFrame');
    const btn = document.getElementById('pgpDownload');
    if (!frame || !frame.contentDocument) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Preparando…';
    try {
      const src = frame.contentDocument;
      const copy = src.documentElement.cloneNode(true);
      const link = copy.querySelector('link[rel="stylesheet"]');
      if (link){
        const style = src.createElement('style');
        style.textContent = await inlineCss();
        link.replaceWith(style);
      }
      const html = await buildStandalone('<!doctype html>\n' + copy.outerHTML);
      const snap = S.snapshot;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const slug = (S.kind === 'calibration' ? 'calibracion'
        : (snap ? (snap.editionLabel + '-' + snap.categoryLabel).toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          : 'sorteo'));
      const name = 'papelitos-' + (S.kind === 'calibration' ? '' : S.kind + '-') + slug + '-' + stamp + '.html';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      msg('Archivo descargado: ' + name + '. Ábrelo e imprime al 100 % — conserva las medidas en milímetros y ambos logotipos.', 'k-ok');
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-DL', err);
      const warn = S.modal && S.modal.querySelector('#pgpWarn');
      if (warn) warn.appendChild(el('div', 'pgp-stale',
        (err && err.message) || 'No se pudo preparar el archivo para descargar.'));
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // Regenerar: vuelve a consultar la lista real y avisa si cambió.
  async function regenerate(){
    const bg = S.modal;
    if (!bg) return;
    const btns = bg.querySelectorAll('footer button');
    btns.forEach(b => { b.disabled = true; });
    try {
      S.rows = await fetchRows(S.editionId);
      const fresh = sanitize(S.rows, S.catId);
      const fp = fingerprintOf(fresh);
      S.stale = !!(S.snapshot && fp !== S.snapshot.fingerprint);
      S.eligibles = fresh;
      S.fingerprint = fp;
      const keep = S.dists[S.distIdx];
      S.dists = distributions(fresh.length);
      const same = S.dists.findIndex(d => keep && d.sizes.join('-') === keep.sizes.join('-'));
      S.distIdx = same >= 0 ? same : 0;
      const sel = $('#pgpDist');
      if (sel && S.dists.length){
        fillSelect(sel, S.dists.map((d, i) => ({ value: i, label: distLabel(d) })), S.distIdx);
      }
      renderKpis();
      if (!S.dists.length){
        closeModal();
        msg('Tras regenerar, ' + fresh.length + ' participantes no admiten ninguna distribución válida.', 'k-danger');
        return;
      }
      S.snapshot = buildSnapshot();
      renderDoc(S.kind, S.snapshot, false);
      if (S.stale) msg('LA LISTA DE INSCRITOS CAMBIÓ. Los imprimibles ya se regeneraron con la lista nueva.', 'k-warn');
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-002', err);
      const warn = bg.querySelector('#pgpWarn');
      warn.appendChild(el('div', 'pgp-stale',
        (err && err.userMessage) || (err && err.message) || 'No se pudo regenerar la lista. (PGP-002)'));
    } finally {
      btns.forEach(b => { b.disabled = false; });
      const regen = bg.querySelector('#pgpRegen');
      if (regen) regen.style.display = S.kind === 'calibration' ? 'none' : '';
    }
  }

  async function openPreview(kind){
    if (S.busy) return;
    setBusy(true);
    msg('Preparando la vista previa…');
    try {
      await loadAssets();          // sin logotipos NO se genera nada
      S.assetError = null;
      if (kind === 'calibration'){
        S.kind = kind;
        renderDoc(kind, null, true);
        msg('Hoja de calibración lista. Imprime al 100 % y recorta las tres muestras.', 'k-ok');
        return;
      }
      if (!S.dists.length){
        msg('No hay una distribución válida para esta lista. No se generó ningún imprimible.', 'k-danger');
        return;
      }
      S.stale = false;
      S.kind = kind;
      S.snapshot = buildSnapshot();     // fotografía en memoria: no cambia sola
      renderDoc(kind, S.snapshot, false);
      msg('Vista previa generada con ' + S.snapshot.participants.length + ' participantes · ' +
        S.snapshot.dist.sizes.join('–') + '. No se escribió nada en la base de datos.', 'k-ok');
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-003', err);
      S.assetError = (err && err.message) || 'No se pudo generar la vista previa. (PGP-003)';
      syncActions();
      msg(S.assetError, 'k-danger');
    } finally {
      setBusy(false);
    }
  }

  // ── 8. Montaje ───────────────────────────────────────────────────────
  function wire(){
    if (S.mounted) return;
    S.mounted = true;
    $('#pgpEdition').addEventListener('change', e => loadEdition(e.target.value));
    $('#pgpCat').addEventListener('change', e => { S.catId = e.target.value; S.stale = false; recompute(); });
    $('#pgpSize').addEventListener('change', e => { S.sizeKey = e.target.value; renderKpis(); });
    $('#pgpDist').addEventListener('change', e => { S.distIdx = Number(e.target.value) || 0; renderKpis(); notify(); });
    $('#pgpTest').addEventListener('change', () => { renderKpis(); notify(); });
    $('#pgpCalib').addEventListener('click', () => openPreview('calibration'));
    $('#pgpPrevP').addEventListener('click', () => openPreview('participants'));
    $('#pgpPrevG').addEventListener('click', () => openPreview('groups'));
    $('#pgpPkg').addEventListener('click', () => openPreview('full'));
    window.addEventListener('resize', () => {
      if (S.modal && S.modal.classList.contains('open')) scaleFrame();
    });
  }

  async function mount(editionId){
    const sect = $('#pgpSect');
    if (!sect) return;
    sect.style.display = '';
    wire();
    fillSelect($('#pgpSize'), Object.keys(SIZES).map(k => ({ value: k, label: SIZES[k].label })), S.sizeKey);
    try {
      S.editions = await global.SB_CATALOG.getAllEditions();
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-004', err);
      S.editions = [];
    }
    if (!S.editions.length && global.SB_CATALOG._cachedEdition()) S.editions = [global.SB_CATALOG._cachedEdition()];
    fillSelect($('#pgpEdition'), S.editions.map(e => ({ value: e.id, label: (e.slug || e.name) + (e.status ? ' · ' + e.status : '') })), editionId);
    try {
      await loadAssets();
      S.assetError = null;
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGP-005', err);
      S.assetError = err.message + ' Sin ese archivo no se genera ningún imprimible.';
    }
    await loadEdition(editionId);
  }

  global.SB_PRE_GROUP_PRINT = {
    mount, distributions, layoutFor, _state: S,
    // API reutilizada por supabase/pre-group-draw-capture.js
    getContext: getContext,
    onChange: fn => { S.listeners.push(fn); return getContext(); },
    groupItemsFor: groupItemsFor,
    groupLetter: groupLetter,
    fmtDateTime: fmtDateTime,
    esc: esc,
    loadAssets: loadAssets,
    docShell: docShell,
    logoFi: logoFi,
    logoCup: logoCup,
    buildStandalone: buildStandalone,
    downloadHtml: downloadHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
