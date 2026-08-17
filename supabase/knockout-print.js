// ── PAPELETAS DE LA FASE ELIMINATORIA ───────────────────────────────────
// MISMO papelito físico que el sorteo de grupos: 80 × 30 mm, cuatro módulos
// de 20 mm, tres dobleces, css/pre-group-print.css y los mismos logotipos
// incrustados. Solo cambia el CONTENIDO (bombos, cajas de posiciones y de
// acceso). Reutiliza supabase/pre-group-print.js — no duplica maquetación.
// Vista derivada: no escribe nada en Supabase.
(function(global){
  'use strict';
  const P = () => global.SB_PRE_GROUP_PRINT;
  const SIZE = { w: 80, h: 30 };
  const esc = s => (P() && P().esc) ? P().esc(s) : String(s == null ? '' : s);

  function catClass(name){
    const s = String(name || '').toLowerCase();
    if (s.indexOf('avanz') >= 0 || s.indexOf('open') >= 0) return 'cat-av';
    if (s.indexOf('interm') >= 0) return 'cat-in';
    if (s.indexOf('princip') >= 0 || s.indexOf('novat') >= 0) return 'cat-pr';
    return 'cat-av';
  }
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  };
  // «Torneo Ping Pong FI 2027-1» → «2027-1» (igual que el papelito de grupos)
  function shortEdition(s){
    const raw = String(s || '').trim();
    const m = raw.match(/(\d{4})\s*[-–\/_]\s*([12])/);
    return m ? (m[1] + '-' + m[2]) : raw;
  }
  const shortCat = s => {
    const t = String(s || '').trim();
    return t.length > 14 ? t.slice(0, 13) + '.' : t;
  };

  // ── módulos del papelito (idénticos a los del sorteo de grupos) ───────
  function moduleOne(meta, kind){
    return '<div class="pgp-m1">' +
      '<div class="pgp-brand">' + P().logoFi(true) + '</div>' +
      '<div class="pgp-m1-body">' +
        '<span><span class="pgp-lbl">Edición</span><span class="pgp-val-box">' +
          '<span class="pgp-val" data-fit="1">' + esc(meta.edition) + '</span></span></span>' +
        '<span><span class="pgp-lbl">Categoría</span><span class="pgp-val-box">' +
          '<span class="pgp-val" data-fit="1">' + esc(shortCat(meta.category)) + '</span></span></span>' +
        '<span class="pgp-kind">' + esc(kind) + '</span>' +
      '</div>' +
    '</div>';
  }
  const orbit = () => '<span class="pgp-wm" aria-hidden="true"></span>';
  const moduleFour = () => '<div class="pgp-m4">' + P().logoCup() + '</div>';
  const foot = (a, b) => '<span class="pgp-foot"><span class="pgp-code">' + esc(a || '—') +
    '</span><span class="pgp-ctrl">' + esc(b || '') + '</span></span>';

  // papelito de PERSONA (bombos y pases directos)
  function nameTicket(it, meta, doc){
    return '<div class="pgp-cell"><div class="pgp-t">' +
      moduleOne(meta, doc.kindLabel || 'Bombo') +
      '<div class="pgp-m23">' + orbit() +
        '<span class="pgp-eyebrow">' + esc(doc.eyebrow || 'Sorteo eliminatorio') + '</span>' +
        '<span class="pgp-name-box"><span class="pgp-name" data-fit="2">' + esc(it.main || '—') + '</span></span>' +
        foot(it.code, it.sub) +
      '</div>' + moduleFour() +
    '</div></div>';
  }

  // papelito de CAJA (posiciones del bracket y ronda de acceso)
  function boxTicket(it, meta, doc){
    return '<div class="pgp-cell"><div class="pgp-t">' +
      moduleOne(meta, doc.kindLabel || 'Posición') +
      '<div class="pgp-m23">' + orbit() +
        '<span class="pgp-eyebrow">' + esc(doc.eyebrow || 'Caja de posiciones') + '</span>' +
        '<span class="pgp-gwrap"><span class="pgp-gletter">' + esc(it.big == null ? '?' : it.big) + '</span>' +
          '<span class="pgp-gmeta"><span class="pgp-gname">' + esc(it.main || '') + '</span>' +
          '<span class="pgp-speed"><i></i><i></i><i></i></span></span></span>' +
        foot(it.code, it.sub) +
      '</div>' + moduleFour() +
    '</div></div>';
  }

  function head(doc, meta, o){
    const mini = o.page > 1;
    const top = '<div class="pgp-head-top">' + P().logoFi(true) +
      '<div class="pgp-head-c"><b>Sorteo oficial · fase eliminatoria</b>' +
      '<span>' + esc(String(doc.title || '').split(' — ')[0]) + ' · Torneo de Ping Pong FI · ' +
      esc(meta.edition) + ' · ' + esc(meta.category) + '</span></div>' + P().logoCup() + '</div>';
    const strip = '<div class="pgp-head-strap"></div>';
    const ft = '<div class="pgp-head-foot">' +
      '<span>Página ' + o.page + '/' + o.pages + '</span>' +
      '<span>Generado: ' + esc(meta.takenAtLabel) + '</span>' +
      '<span>Medida ' + SIZE.w + ' × ' + SIZE.h + ' mm · doblada ' + (SIZE.w / 4) + ' × ' + (SIZE.h / 2) + ' mm</span>' +
      '<span>Doblar con la impresión hacia dentro</span>' +
      '<span>Imprimir al 100 %, sin ajustar a página</span></div>';
    if (mini) return '<div class="pgp-head pgp-head--mini">' + top + strip + ft + '</div>';
    const cells = [
      ['Edición', meta.edition],
      ['Categoría', meta.category],
      ['Papeletas', String(o.count)],
      ['Documento', doc.kindLabel || 'Bombo'],
      ['Hoja', o.page + ' / ' + o.pages]
    ];
    return '<div class="pgp-head">' + top + strip +
      '<div class="pgp-head-grid">' +
        cells.map(c => '<div class="pgp-hcell"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>').join('') +
      '</div>' + ft + '</div>';
  }

  function sheetsFor(doc, meta, layout){
    const items = doc.items || [];
    const pages = chunk(items, layout.perPage);
    const draw = doc.type === 'box' ? boxTicket : nameTicket;
    return pages.map((page, i) => '<section class="pgp-sheet">' +
      head(doc, meta, { page: i + 1, pages: pages.length, count: items.length }) +
      '<div class="pgp-grid" style="--cols:' + layout.cols + '">' +
        page.map(it => draw(it, meta, doc)).join('') +
      '</div></section>').join('');
  }

  // el ajuste tipográfico corre DENTRO del documento generado
  const FIT = '<script>window.addEventListener("load",function(){' +
    'document.querySelectorAll("[data-fit]").forEach(function(n){' +
    'var lines=Number(n.getAttribute("data-fit"))||2,box=n.parentElement,' +
    'start=parseFloat(getComputedStyle(n).fontSize),px=start,guard=0;' +
    'while(guard++<90&&px>start*0.58){' +
    'var maxH=Math.min(box.clientHeight+0.5,Math.ceil(lines*px*1.06)+2);' +
    'var wide=n.scrollWidth>n.clientWidth+0.5||n.getBoundingClientRect().width>box.clientWidth+0.5;' +
    'if(!wide&&n.scrollHeight<=maxH)break;' +
    'px-=Math.max(0.25,px*0.04);n.style.fontSize=px+"px";}});});<\/script>';

  // ── Menú de impresión: MISMO modal que los papelitos del sorteo de grupos
  //    (vista previa a escala real, imprimir y descargar el archivo). ───────
  let MODAL = null, LAST = { html: '', name: 'papeletas' };

  function ensureModal(){
    if (MODAL) return MODAL;
    const bg = document.createElement('div');
    bg.className = 'pgp-modal-bg';
    bg.innerHTML =
      '<div class="pgp-modal" role="dialog" aria-modal="true" aria-label="Vista previa de papeletas">' +
        '<header><h2 id="koTitle">Papeletas del sorteo eliminatorio</h2>' +
          '<button class="pgp-x" type="button" id="koClose" aria-label="Cerrar">×</button></header>' +
        '<div class="pgp-modal-meta" id="koMeta"></div>' +
        '<div class="pgp-modal-warn" id="koWarn"></div>' +
        '<div class="pgp-modal-body"><div class="pgp-frame-wrap" id="koWrap">' +
          '<iframe id="koFrame" title="Vista previa de las papeletas"></iframe></div></div>' +
        '<footer>' +
          '<button class="btn btn-main" type="button" id="koPrint">Imprimir</button>' +
          '<button class="btn btn-ghost" type="button" id="koDownload">Descargar archivo</button>' +
          '<button class="btn btn-ghost" type="button" id="koCloseB">Cerrar</button>' +
          '<span class="pgp-note">Imprime al 100 %, sin ajustar a página. Papel 75–90 g/m². ' +
          'Dobla con la impresión hacia dentro: 80 × 30 mm abiertos, 20 × 15 mm doblados.</span>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(bg);
    const close = () => bg.classList.remove('open');
    bg.querySelector('#koClose').addEventListener('click', close);
    bg.querySelector('#koCloseB').addEventListener('click', close);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    bg.querySelector('#koPrint').addEventListener('click', () => {
      const f = bg.querySelector('#koFrame');
      const wrap = bg.querySelector('#koWrap');
      if (wrap) wrap.style.transform = 'none';
      try { f.contentWindow.focus(); f.contentWindow.print(); }
      catch(e){}
      setTimeout(() => scale(bg), 400);
    });
    bg.querySelector('#koDownload').addEventListener('click', () => {
      const blob = new Blob([LAST.html], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = LAST.name + '.html';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    });
    window.addEventListener('resize', () => { if (bg.classList.contains('open')) scale(bg); });
    MODAL = bg;
    return bg;
  }

  function scale(bg){
    const wrap = bg.querySelector('#koWrap');
    const frame = bg.querySelector('#koFrame');
    if (!wrap || !frame || !frame.contentDocument) return;
    const doc = frame.contentDocument;
    frame.style.height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 'px';
    const avail = wrap.parentElement.clientWidth - 4;
    const k = Math.min(1, avail / 794);
    wrap.style.transform = 'scale(' + k + ')';
    wrap.style.height = (frame.offsetHeight * k) + 'px';
    wrap.style.width = (794 * k) + 'px';
  }

  const slug = s => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function open(docs, meta){
    if (!P()) throw new Error('Falta supabase/pre-group-print.js en esta página.');
    await P().loadAssets();
    meta = Object.assign({ edition: '', category: '' }, meta || {});
    meta.edition = shortEdition(meta.edition);
    meta.takenAtLabel = meta.takenAtLabel || P().fmtDateTime(new Date());
    const layout = P().layoutFor(SIZE);
    const list = (docs || []).filter(d => d && (d.items || []).length);
    const body = list.map(d => sheetsFor(d, meta, layout)).join('');
    if (!body) throw new Error('No hay papeletas que imprimir todavía.');
    let html = P().docShell(body, SIZE, catClass(meta.category));
    html = html.replace('<title>Sorteo oficial de grupos · Ping Pong FI</title>',
                        '<title>Sorteo eliminatorio · Ping Pong FI</title>');
    html = html.replace('</body></html>', FIT + '</body></html>');

    const total = list.reduce((n, d) => n + d.items.length, 0);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    LAST = { html: html, name: 'papeletas-eliminatoria-' + slug(meta.edition + '-' + meta.category) + '-' + stamp };

    const bg = ensureModal();
    bg.querySelector('#koTitle').textContent = (meta.docLabel || 'Papeletas del sorteo eliminatorio');
    bg.querySelector('#koMeta').innerHTML =
      '<span>Edición <b>' + esc(meta.edition) + '</b></span>' +
      '<span>Categoría <b>' + esc(meta.category) + '</b></span>' +
      '<span>Papeletas <b>' + total + '</b></span>' +
      '<span>Medida <b>' + SIZE.w + ' × ' + SIZE.h + ' mm</b></span>' +
      '<span>Generado <b>' + esc(meta.takenAtLabel) + '</b></span>';
    const frame = bg.querySelector('#koFrame');
    frame.onload = () => { scale(bg); setTimeout(() => scale(bg), 80); };
    frame.srcdoc = html;
    bg.classList.add('open');
    return true;
  }

  // ── HOJAS DE CONTROL (lista maestra y acta) ──────────────────────────
  // Misma piel que el acta oficial del sorteo de grupos (§C de la hoja):
  // banda negra con los dos logotipos, rejilla de datos y pie de reglas.
  const SHEET_CSS = '<style>' +
    '.ko-tbl{width:100%;border-collapse:collapse;font-family:var(--pgp-body),Arial,sans-serif;font-size:2.9mm}' +
    '.ko-tbl th{background:#000;color:#fff;font-family:var(--pgp-mono),monospace;font-size:2.1mm;letter-spacing:.4mm;' +
      'text-transform:uppercase;padding:1.6mm 1.4mm;text-align:left;border:0.25mm solid #000}' +
    '.ko-tbl td{border:0.25mm solid #000;padding:1.7mm 1.4mm;vertical-align:middle;height:7mm}' +
    '.ko-tbl td.c,.ko-tbl th.c{text-align:center}' +
    '.ko-tbl tbody tr:nth-child(even) td{background:#f2f2f2}' +
    '.ko-tbl .ko-strong{font-family:var(--pgp-cond),Arial,sans-serif;font-weight:900;font-style:oblique 8deg;' +
      'text-transform:uppercase;font-size:3.5mm}' +
    '.ko-tot{display:flex;gap:6mm;align-items:center;border:0.35mm solid #000;margin-top:3mm;padding:2mm 3mm;' +
      'font-family:var(--pgp-mono),monospace;font-size:2.4mm;letter-spacing:.4mm;text-transform:uppercase}' +
    '.ko-tot b{font-weight:700}' +
    '.ko-sign{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:14mm}' +
    '.ko-sign div{border-top:0.35mm solid #000;padding-top:1.6mm;font-family:var(--pgp-mono),monospace;' +
      'font-size:2.2mm;letter-spacing:.4mm;text-transform:uppercase;text-align:center}' +
    '</style>';

  function sheetHead(doc, meta){
    const cells = [
      ['Edición', meta.edition],
      ['Categoría', meta.category],
      ['Documento', doc.docLabel || 'Hoja de control'],
      ['Renglones', String((doc.rows || []).length + (doc.emptyRows || 0))],
      ['Generado', meta.takenAtLabel]
    ];
    return '<div class="pgp-acta-head">' +
      '<div class="pgp-acta-top">' + P().logoFi(true) +
        '<div class="pgp-acta-c"><b>' + esc(doc.title) + '</b>' +
        '<span>Sorteo oficial · fase eliminatoria · Torneo de Ping Pong FI</span></div>' +
        P().logoCup() + '</div>' +
      '<div class="pgp-acta-grid">' +
        cells.map(c => '<div class="pgp-hcell"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b></div>').join('') +
      '</div>' +
      '<div class="pgp-acta-foot">' +
        (doc.footNotes || ['El sorteo es físico: esta hoja solo registra lo que salió de las pelotas',
          'No se escribe nada en la base de datos', 'Imprimir al 100 %'])
          .map(t => '<span>' + esc(t) + '</span>').join('') +
      '</div></div>';
  }

  function table(doc){
    const cols = doc.columns || [];
    const cell = (v, c) => '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' +
      (v == null || v === '' ? '&nbsp;' : esc(v)) + '</td>';
    let body = (doc.rows || []).map(r =>
      '<tr>' + cols.map(c => cell(r[c.key], c)).join('') + '</tr>').join('');
    const start = (doc.rows || []).length;
    for (let i = 0; i < (doc.emptyRows || 0); i++){
      body += '<tr>' + cols.map((c, j) =>
        cell(j === 0 ? String(start + i + 1) : '', c)).join('') + '</tr>';
    }
    return '<table class="ko-tbl"><thead><tr>' +
      cols.map(c => '<th' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + esc(c.label) + '</th>').join('') +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  async function openSheet(doc, meta){
    if (!P()) throw new Error('Falta supabase/pre-group-print.js en esta página.');
    await P().loadAssets();
    meta = Object.assign({ edition: '', category: '' }, meta || {});
    meta.edition = shortEdition(meta.edition);
    meta.takenAtLabel = meta.takenAtLabel || P().fmtDateTime(new Date());
    const body = '<div class="pgp-acta">' + sheetHead(doc, meta) + table(doc) +
      (doc.total ? '<div class="ko-tot"><span>Total esperado <b>' + esc(doc.total) +
        '</b></span><span>Total verificado <b>________</b></span>' +
        '<span>Marca cada renglón al prepararlo</span></div>' : '') +
      (doc.sign === false ? '' :
        '<div class="ko-sign"><div>Firma del organizador</div><div>Testigo</div></div>') +
    '</div>';
    let html = P().docShell(body, SIZE, catClass(meta.category));
    html = html.replace('<title>Sorteo oficial de grupos · Ping Pong FI</title>',
                        '<title>' + esc(doc.title) + ' · Ping Pong FI</title>');
    html = html.replace('</head>', SHEET_CSS + '</head>');

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    LAST = { html: html, name: slug(doc.title + '-' + meta.edition + '-' + meta.category) + '-' + stamp };
    const bg = ensureModal();
    bg.querySelector('#koTitle').textContent = doc.title;
    bg.querySelector('#koMeta').innerHTML =
      '<span>Edición <b>' + esc(meta.edition) + '</b></span>' +
      '<span>Categoría <b>' + esc(meta.category) + '</b></span>' +
      '<span>Renglones <b>' + ((doc.rows || []).length + (doc.emptyRows || 0)) + '</b></span>' +
      '<span>Hoja <b>A4 vertical</b></span>' +
      '<span>Generado <b>' + esc(meta.takenAtLabel) + '</b></span>';
    const frame = bg.querySelector('#koFrame');
    frame.onload = () => { scale(bg); setTimeout(() => scale(bg), 80); };
    frame.srcdoc = html;
    bg.classList.add('open');
    return true;
  }

  global.SB_KO_PRINT = { open: open, openSheet: openSheet, SIZE: SIZE };
})(typeof window !== 'undefined' ? window : globalThis);
