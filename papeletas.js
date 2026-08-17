// ── PapeletasSorteo: generador de papeletas, lista maestra y acta ────────
// Vista derivada e imprimible (window.print → Guardar como PDF).
// Datos: sessionStorage['papeletas-payload'] (copiado al abrir en pestaña
// nueva) o ?data=<base64 JSON> en la URL. No toca Supabase ni crea partidos.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  let payload = null;

  function loadPayload(){
    try {
      const u = new URLSearchParams(location.search).get('data');
      if (u) return JSON.parse(decodeURIComponent(escape(atob(u))));
    } catch(e){}
    try {
      const raw = sessionStorage.getItem('papeletas-payload');
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return null;
  }

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const up = s => opts().upper ? String(s).toUpperCase() : String(s);

  function opts(){
    return {
      paper: $('#pPaper').value,
      orient: $('#pOrient').value,
      size: $('#pSize').value,
      customH: Math.max(15, parseInt($('#pCustomH').value, 10) || 40),
      cols: Math.min(6, Math.max(1, parseInt($('#pCols').value, 10) || 3)),
      font: Math.min(48, Math.max(10, parseInt($('#pFont').value, 10) || 22)),
      copies: Math.min(10, Math.max(1, parseInt($('#pCopies').value, 10) || 1)),
      cut: $('#pCut').checked,
      code: $('#pCode').checked,
      upper: $('#pUpper').checked,
      head: $('#pHead').checked
    };
  }
  function applyPage(){
    const o = opts();
    let st = document.getElementById('pageStyle');
    if (!st){ st = document.createElement('style'); st.id = 'pageStyle'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:' + (o.paper === 'a4' ? 'A4' : 'letter') + ' ' + o.orient + ';margin:12mm}}';
  }

  function ballotHeight(o){
    if (o.size === 'custom') return o.customH + 'mm';
    return o.size === 'small' ? '28mm' : '42mm';
  }

  function render(){
    const main = $('#pMain');
    main.textContent = '';
    applyPage();
    if (!payload || !Array.isArray(payload.docs) || !payload.docs.length){
      const s = el('div', 'state');
      s.appendChild(el('b', null, 'Sin documento que mostrar. '));
      s.appendChild(document.createTextNode('Abre esta vista desde «Documentos para el sorteo físico» en PreparacionEliminatoria.html o desde «Preparar papeletas de grupos» en TableroGrupos.html.'));
      main.appendChild(s);
      return;
    }
    const o = opts();
    const meta = [payload.edition, payload.category,
      new Date(payload.generatedAt || Date.now()).toLocaleString('es-MX')].filter(Boolean).join(' · ');

    payload.docs.forEach(doc => {
      main.appendChild(el('h2', 'doc-title', up(doc.title || '')));
      main.appendChild(el('p', 'doc-meta', meta));
      if (doc.type === 'ballots') renderBallots(main, doc, o);
      else if (doc.type === 'master') renderMaster(main, doc);
      else if (doc.type === 'acta') renderActa(main, doc);
    });
  }

  // ── papeletas ────────────────────────────────────────────────────────
  function renderBallots(main, doc, o){
    const grid = el('div', 'grid' + (o.cut ? ' cut' : ''));
    grid.style.gridTemplateColumns = 'repeat(' + o.cols + ',1fr)';
    const h = ballotHeight(o);
    const items = [];
    (doc.items || []).forEach(it => {
      const copies = (it.copies || 1) * o.copies;
      for (let c = 0; c < copies; c++) items.push(Object.assign({}, it, { _copy: c + 1, _copies: copies }));
    });
    items.forEach(it => {
      const b = el('div', 'ballot');
      b.style.minHeight = h;
      if (o.head && payload.category) b.appendChild(el('span', 'cat', up(payload.category)));
      const m = el('span', 'main', up(it.main || '—'));
      m.style.fontSize = o.font + 'px';
      b.appendChild(m);
      if (it.sub) b.appendChild(el('span', 'sub', up(it.sub)));
      if (o.code && it.code){
        let code = it.code;
        if (it._copies > 1) code += '-' + String(it._copy).padStart(2, '0') + '/' + String(it._copies).padStart(2, '0');
        b.appendChild(el('span', 'code', code));
      }
      grid.appendChild(b);
    });
    main.appendChild(grid);
    main.appendChild(el('p', 'doc-meta', 'Total de papeletas: ' + items.length + '. Recorta por las líneas punteadas; cada papeleta va dentro de una pelota.'));
  }

  // ── lista maestra ────────────────────────────────────────────────────
  function renderMaster(main, doc){
    if (doc.meta){
      const m = el('p', 'doc-meta',
        Object.keys(doc.meta).map(k => k.toUpperCase() + ': ' + doc.meta[k]).join(' · '));
      main.appendChild(m);
    }
    const t = el('table', 'sheet');
    t.innerHTML = '<thead><tr><th class="c">#</th><th>Papeleta</th><th>Detalle</th><th>Código</th><th class="c">Copias</th><th class="c">Preparada ☐</th></tr></thead>';
    const tb = document.createElement('tbody');
    let expected = 0;
    (doc.rows || []).forEach((r, i) => {
      expected += (r.count || 1);
      const tr = document.createElement('tr');
      [String(i + 1), up(r.text || ''), r.detail || '', r.code || '', String(r.count || 1), '☐'].forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (j === 0 || j === 4 || j === 5) td.className = 'c';
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    main.appendChild(t);
    const tot = el('p', 'totals',
      'TOTAL ESPERADO: ' + expected + '  ·  TOTAL VERIFICADO: ________  (marca cada papeleta al prepararla)');
    main.appendChild(tot);
    const w = el('div', 'warn no-print', 'Si el total impreso no coincide con el total esperado, revisa la lista antes del sorteo.');
    main.appendChild(w);
  }

  // ── acta del sorteo ──────────────────────────────────────────────────
  function renderActa(main, doc){
    const t = el('table', 'sheet');
    t.innerHTML = '<thead><tr><th class="c">Ext.</th><th>Participante A</th><th>Bombo/origen A</th><th>Participante B</th><th>Bombo/origen B</th><th>Partido</th><th class="c">Válido</th><th>Motivo reextracción</th><th>Observaciones</th></tr></thead>';
    const tb = document.createElement('tbody');
    (doc.rows || []).forEach(r => {
      const tr = document.createElement('tr');
      [String(r.n), up(r.a || ''), r.aOrigin || '', up(r.b || ''), r.bOrigin || '',
       r.match || '', r.valid || '', r.reason || '', r.notes || ''].forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (j === 0 || j === 6) td.className = 'c';
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    const start = (doc.rows || []).length;
    for (let i = 0; i < (doc.emptyRows || 0); i++){
      const tr = document.createElement('tr');
      for (let j = 0; j < 9; j++){
        const td = document.createElement('td');
        td.innerHTML = j === 0 ? String(start + i + 1) : '&nbsp;';
        if (j === 0) td.className = 'c';
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    main.appendChild(t);
    const sign = el('div', 'sign');
    sign.appendChild(el('div', null, 'Firma del organizador'));
    sign.appendChild(el('div', null, 'Testigo'));
    main.appendChild(sign);
  }

  function wire(){
    ['pPaper','pOrient','pSize','pCols','pFont','pCopies','pCut','pCode','pUpper','pHead','pCustomH']
      .forEach(id => $('#' + id).addEventListener('change', () => {
        $('#pCustomWrap').style.display = $('#pSize').value === 'custom' ? 'flex' : 'none';
        render();
      }));
    $('#pPrint').addEventListener('click', () => window.print());
  }

  document.addEventListener('DOMContentLoaded', () => {
    payload = loadPayload();
    wire();
    render();
  });
})();
