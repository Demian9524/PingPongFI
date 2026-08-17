// ── Panel de administración — configura premio y distribución ────────────
// Edita window.PRIZE_POOL (persistido en localStorage por la página) y
// re-renderiza el puerquito + tarjetas en vivo.
(function(){
  const CATS = ['avanzado','intermedio','principiante'];
  const LBL  = { avanzado:'Avanzados', intermedio:'Intermedios', principiante:'Principiantes' };
  const COL  = { avanzado:'#dd3b2c', intermedio:'#3a63f0', principiante:'#37bb66' };
  const fmt  = n => '$' + Math.round(n||0).toLocaleString('es-MX');

  // ── estilos ────────────────────────────────────────────────────────────
  const css = `
  .admin-fab{position:fixed;right:18px;bottom:18px;z-index:9000;width:46px;height:46px;border-radius:50%;
    border:1px solid rgba(237,187,82,0.5);background:linear-gradient(150deg,#2a2014,#1a140d);color:#edbb52;
    display:flex;align-items:center;justify-content:center;cursor:pointer;
    box-shadow:0 6px 20px rgba(0,0,0,0.5),0 0 0 1px rgba(237,187,82,0.1) inset;
    transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s,border-color .2s}
  .admin-fab:hover{transform:translateY(-2px) rotate(35deg);border-color:rgba(237,187,82,0.9);
    box-shadow:0 8px 26px rgba(0,0,0,0.55),0 0 18px rgba(237,187,82,0.25)}
  .admin-fab svg{width:23px;height:23px}

  .admin-ov{position:fixed;inset:0;z-index:9001;background:rgba(8,5,2,0.6);backdrop-filter:blur(3px);
    opacity:0;pointer-events:none;transition:opacity .25s cubic-bezier(.4,0,.2,1)}
  .admin-ov.open{opacity:1;pointer-events:auto}

  .admin-panel{position:fixed;top:0;right:0;z-index:9002;height:100%;width:min(420px,100vw);
    background:linear-gradient(180deg,#1c1610,#15100b);border-left:1px solid rgba(237,187,82,0.22);
    box-shadow:-18px 0 50px rgba(0,0,0,0.5);transform:translateX(100%);
    transition:transform .32s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;
    font-family:'HN Text','Inter',system-ui,sans-serif;color:#f6efe2}
  .admin-panel.open{transform:translateX(0)}
  .admin-hd{display:flex;align-items:center;gap:12px;padding:20px 22px 16px;
    border-bottom:1px solid rgba(255,240,220,0.09);flex:0 0 auto}
  .admin-hd .ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
    background:rgba(237,187,82,0.14);color:#edbb52}
  .admin-hd h2{font-family:'HN Display','Saira Condensed',sans-serif;font-weight:800;font-size:19px;
    letter-spacing:0.01em;flex:1;line-height:1.1}
  .admin-hd .sub{display:block;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2px;
    color:#b09a7e;text-transform:uppercase;margin-top:3px;font-weight:400}
  .admin-x{background:none;border:1px solid rgba(255,240,220,0.16);color:#b09a7e;width:30px;height:30px;
    border-radius:7px;cursor:pointer;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;
    transition:color .15s,border-color .15s}
  .admin-x:hover{color:#f6efe2;border-color:rgba(255,240,220,0.4)}

  .admin-body{flex:1;overflow-y:auto;padding:18px 22px 28px;display:flex;flex-direction:column;gap:22px}
  .admin-sec{display:flex;flex-direction:column;gap:13px}
  .admin-sec > .sec-t{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2.5px;
    text-transform:uppercase;color:#edbb52;font-weight:700;display:flex;align-items:center;gap:9px}
  .admin-sec > .sec-t::after{content:"";flex:1;height:1px;background:rgba(237,187,82,0.16)}

  .adm-row{display:flex;align-items:center;gap:12px}
  .adm-row .rl{flex:1;display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600}
  .adm-dot{width:11px;height:11px;border-radius:3px;flex:0 0 auto}
  .adm-field{position:relative;display:flex;align-items:center}
  .adm-field .pfx{position:absolute;left:11px;color:#71614b;font-family:'JetBrains Mono',monospace;font-size:13px;pointer-events:none}
  .adm-field .sfx{position:absolute;right:11px;color:#71614b;font-family:'JetBrains Mono',monospace;font-size:12px;pointer-events:none}
  .adm-input{background:#120d08;border:1px solid rgba(255,240,220,0.14);border-radius:8px;color:#f6efe2;
    font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;padding:9px 11px;width:104px;text-align:right;
    transition:border-color .15s,box-shadow .15s;-moz-appearance:textfield}
  .adm-input::-webkit-outer-spin-button,.adm-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  .adm-input:focus{outline:none;border-color:rgba(237,187,82,0.7);box-shadow:0 0 0 3px rgba(237,187,82,0.12)}
  .adm-input.pad-l{padding-left:24px}
  .adm-input.pad-r{padding-right:30px}
  .adm-input.wide{width:100%;text-align:left;font-size:17px}

  .pct-sum{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-radius:8px;
    font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.5px;
    background:rgba(255,240,220,0.04);border:1px solid rgba(255,240,220,0.09)}
  .pct-sum b{font-size:14px}
  .pct-sum.ok{color:#5fd08a;border-color:rgba(95,208,138,0.3);background:rgba(95,208,138,0.08)}
  .pct-sum.bad{color:#ee6b5a;border-color:rgba(238,107,90,0.35);background:rgba(238,107,90,0.08)}

  .seg-tog{display:flex;gap:0;border:1px solid rgba(255,240,220,0.14);border-radius:9px;overflow:hidden;background:#120d08}
  .seg-tog button{flex:1;background:none;border:none;color:#b09a7e;font-family:'HN Text',sans-serif;font-weight:700;
    font-size:12.5px;padding:10px 8px;cursor:pointer;transition:background .15s,color .15s;letter-spacing:0.02em}
  .seg-tog button.on{background:linear-gradient(150deg,rgba(237,187,82,0.22),rgba(237,187,82,0.1));color:#f8e9c4}
  .seg-tog button:not(.on):hover{color:#f6efe2;background:rgba(255,240,220,0.04)}

  .adm-mode{display:none;flex-direction:column;gap:13px}
  .adm-mode.on{display:flex}

  .adm-readout{margin-top:2px;padding:15px 17px;border-radius:11px;
    background:linear-gradient(135deg,rgba(237,187,82,0.16),rgba(40,25,8,0.4));
    border:1px solid rgba(237,187,82,0.34);display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .adm-readout .rl2{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:2.5px;text-transform:uppercase;color:#edbb52;font-weight:700}
  .adm-readout .rv{font-family:'HN Display','Saira Condensed',sans-serif;font-weight:800;font-size:30px;color:#edbb52;
    line-height:1;text-shadow:0 0 18px rgba(237,187,82,0.4);font-variant-numeric:tabular-nums}

  .adm-fill{margin-top:4px;display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:11px;
    background:rgba(255,240,220,0.035);border:1px solid rgba(255,240,220,0.09)}
  .adm-fill-hd{display:flex;align-items:center;justify-content:space-between;
    font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a86a}
  .adm-fill-hd b{font-family:'HN Display','Saira Condensed',sans-serif;font-size:20px;color:#f0cf6e;letter-spacing:0;font-variant-numeric:tabular-nums}
  .adm-fill-track{height:10px;border-radius:6px;background:#100b06;overflow:hidden;
    border:1px solid rgba(255,240,220,0.1);box-shadow:inset 0 1px 3px rgba(0,0,0,0.5)}
  .adm-fill-bar{height:100%;width:0;border-radius:5px;
    background:linear-gradient(90deg,#d29a30,#f0cf6e);box-shadow:0 0 10px rgba(237,187,82,0.5);
    transition:width .5s cubic-bezier(.4,0,.2,1)}
  .adm-fill-note{font-family:'HN Text',sans-serif;font-size:11px;color:#71614b;line-height:1.4}
  .adm-fill-note b{color:#c9a86a}

  .adm-foot{flex:0 0 auto;padding:15px 22px;border-top:1px solid rgba(255,240,220,0.09);display:flex;gap:10px}
  .adm-btn{flex:1;border-radius:9px;padding:11px;font-family:'HN Text',sans-serif;font-weight:700;font-size:13px;
    cursor:pointer;transition:transform .15s,filter .15s,background .15s,border-color .15s;letter-spacing:0.02em}
  .adm-btn.ghost{background:none;border:1px solid rgba(255,240,220,0.18);color:#b09a7e}
  .adm-btn.ghost:hover{color:#f6efe2;border-color:rgba(255,240,220,0.4)}
  .adm-btn.gold{background:linear-gradient(150deg,#f0cf6e,#d29a30);border:1px solid rgba(237,187,82,0.5);color:#231703}
  .adm-btn.gold:hover{transform:translateY(-1px);filter:brightness(1.06)}
  .adm-hint{font-size:11.5px;color:#71614b;line-height:1.5;font-family:'HN Text',sans-serif}
  .adm-saved{position:fixed;bottom:78px;right:18px;z-index:9003;background:rgba(95,208,138,0.14);
    border:1px solid rgba(95,208,138,0.4);color:#5fd08a;padding:9px 15px;border-radius:9px;
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1px;opacity:0;transform:translateY(8px);
    transition:opacity .25s,transform .25s;pointer-events:none}
  .adm-saved.show{opacity:1;transform:translateY(0)}

  /* ── MODO INLINE (Centro de control) ─────────────────────────────────
     El mismo panel, pero incrustado en la página: sin botón flotante, sin
     cajón deslizante y sin encabezado propio (el <h2> de la sección manda). */
  .admin-panel.admin-inline{position:static;height:auto;width:auto;transform:none;transition:none;
    border:1px solid rgba(237,187,82,0.22);border-radius:12px;box-shadow:none;display:block}
  .admin-inline .admin-hd{display:none}
  .admin-inline .admin-body{overflow:visible;padding:20px 22px;display:grid;gap:26px;
    grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start}
  .admin-inline .adm-foot{border-top:1px solid rgba(255,240,220,0.09);justify-content:flex-end}
  .admin-inline .adm-btn{flex:0 0 auto;min-width:140px}
  .admin-inline .adm-input{width:110px}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── markup ───────────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.className = 'admin-fab';
  fab.setAttribute('aria-label','Panel de administración');
  fab.title = 'Administración (Shift+A)';
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  const ov = document.createElement('div');
  ov.className = 'admin-ov';

  const panel = document.createElement('aside');
  panel.className = 'admin-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Panel de administración del premio');

  const pctRows = CATS.map(c => `
    <div class="adm-row">
      <span class="rl"><span class="adm-dot" style="background:${COL[c]}"></span>${LBL[c]}</span>
      <div class="adm-field">
        <input class="adm-input pad-r" id="adm-pct-${c}" type="number" min="0" max="100" step="1" inputmode="numeric">
        <span class="sfx">%</span>
      </div>
    </div>`).join('');

  const paidRows = CATS.map(c => `
    <div class="adm-row">
      <span class="rl"><span class="adm-dot" style="background:${COL[c]}"></span>${LBL[c]}</span>
      <div class="adm-field">
        <input class="adm-input" id="adm-paid-${c}" type="number" min="0" step="1" inputmode="numeric" style="width:64px">
      </div>
      <span style="color:#71614b;font-family:'JetBrains Mono',monospace;font-size:13px">/</span>
      <div class="adm-field">
        <input class="adm-input" id="adm-tot-${c}" type="number" min="0" step="1" inputmode="numeric" style="width:64px">
      </div>
    </div>`).join('');

  panel.innerHTML = `
    <div class="admin-hd">
      <span class="ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10v5a5 5 0 01-10 0zM7 7H4v1a3 3 0 003 3M17 7h3v1a3 3 0 01-3 3M9 19h6M10 21h4"/></svg></span>
      <div style="flex:1">
        <h2>Administración<span class="sub">Premio · Distribución</span></h2>
      </div>
      <button class="admin-x" id="adm-close" aria-label="Cerrar">✕</button>
    </div>
    <div class="admin-body">
      <div class="admin-sec">
        <span class="sec-t">Distribución del premio</span>
        ${pctRows}
        <div class="pct-sum" id="adm-sum"><span>Suma de porcentajes</span><b id="adm-sum-v">100%</b></div>
        <p class="adm-hint">Cada porcentaje define cuánto de la bolsa va a cada categoría y se refleja en el relleno del puerquito.</p>
      </div>

      <div class="admin-sec">
        <span class="sec-t">Bolsa del torneo</span>
        <div class="seg-tog" id="adm-mode">
          <button data-mode="auto">Automática</button>
          <button data-mode="manual">Manual</button>
        </div>

        <div class="adm-mode" id="adm-mode-auto">
          <div class="adm-row">
            <span class="rl">Cuota por jugador</span>
            <div class="adm-field">
              <span class="pfx">$</span>
              <input class="adm-input pad-l" id="adm-cuota" type="number" min="0" step="10" inputmode="numeric">
            </div>
          </div>
          <p class="adm-hint" style="margin:-4px 0 2px">Pagos confirmados / cupos por categoría:</p>
          ${paidRows}
        </div>

        <div class="adm-mode" id="adm-mode-manual">
          <div class="adm-row" style="flex-direction:column;align-items:stretch;gap:7px">
            <span class="rl" style="flex:none">Bolsa total (fija)</span>
            <div class="adm-field">
              <span class="pfx">$</span>
              <input class="adm-input pad-l wide" id="adm-manual" type="number" min="0" step="100" inputmode="numeric">
            </div>
          </div>
          <p class="adm-hint" style="margin-top:-2px">En modo manual la cifra no depende de los pagos; se reparte directo según los porcentajes.</p>
        </div>

        <div class="adm-readout">
          <span class="rl2">Bolsa actual</span>
          <span class="rv" id="adm-total">$0</span>
        </div>

        <div class="adm-fill">
          <div class="adm-fill-hd"><span>Llenado del puerquito</span><b id="adm-fill-pct">0%</b></div>
          <div class="adm-fill-track"><div class="adm-fill-bar" id="adm-fill-bar"></div></div>
          <span class="adm-fill-note">100% de llenado = <b>$1,200</b> en el bote &middot; mostrando imagen <b id="adm-fill-img">—</b>/100</span>
          <span class="adm-fill-note" id="adm-fill-over">—</span>
        </div>
      </div>
    </div>
    <div class="adm-foot">
      <button class="adm-btn ghost" id="adm-reset">Restablecer</button>
      <button class="adm-btn gold" id="adm-done">Listo</button>
    </div>`;

  const saved = document.createElement('div');
  saved.className = 'adm-saved';
  saved.textContent = '✓ Guardado';

  // ── montaje ──────────────────────────────────────────────────────────
  // INLINE: si la página declara un contenedor (#prizeAdminMount), el panel
  // vive dentro de ella como una sección más — es el caso del Centro de
  // control. DRAWER: sin contenedor, se añade el botón flotante + cajón.
  const host = document.getElementById('prizeAdminMount');
  const INLINE = !!host;
  if (INLINE){
    panel.classList.add('admin-inline');
    panel.removeAttribute('role');
    host.appendChild(panel);
  } else {
    document.body.appendChild(fab);
    document.body.appendChild(ov);
    document.body.appendChild(panel);
  }
  document.body.appendChild(saved);

  // ── lógica ───────────────────────────────────────────────────────────
  // La configuración vive en localStorage (misma llave que lee la página
  // pública del torneo). Si la página anfitriona no la cargó — el Centro de
  // control no dibuja el puerquito — este módulo la carga y la guarda él mismo.
  const STORAGE_KEY = 'torneo_prize_cfg_v1';
  const FALLBACK_DEFAULTS = {
    cuota: 35,
    totals: { avanzado: 12, intermedio: 24, principiante: 24 },
    pcts:   { avanzado: 0.50, intermedio: 0.30, principiante: 0.20 },
    paid:   { avanzado: 0, intermedio: 0, principiante: 0 },
    mode:   'auto',
    manualTotal: 16600
  };
  if (!window.PRIZE_POOL){
    const d = FALLBACK_DEFAULTS;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e){}
    const c = window.PRIZE_POOL = {
      cuota: (s && s.cuota != null) ? s.cuota : d.cuota,
      totals: Object.assign({}, d.totals, (s && s.totals) || {}),
      pcts:   Object.assign({}, d.pcts,   (s && s.pcts)   || {}),
      paid:   Object.assign({}, d.paid,   (s && s.paid)   || {}),
      mode:   (s && s.mode) || d.mode,
      manualTotal: (s && s.manualTotal != null) ? s.manualTotal : d.manualTotal
    };
    window.PRIZE_POOL_DEFAULTS = JSON.parse(JSON.stringify(d));
    window.PRIZE_POOL_SAVE = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch(e){}
    };
  }
  const cfg = () => window.PRIZE_POOL;
  const $ = id => document.getElementById(id);

  function fillInputs(){
    const c = cfg(); if (!c) return;
    CATS.forEach(cat => {
      $('adm-pct-'+cat).value  = Math.round(c.pcts[cat]*100);
      $('adm-paid-'+cat).value = c.paid[cat];
      $('adm-tot-'+cat).value  = c.totals[cat];
    });
    $('adm-cuota').value  = c.cuota;
    $('adm-manual').value = c.manualTotal;
    setMode(c.mode || 'auto', false);
    refreshDerived();
  }

  function setMode(mode, apply){
    document.querySelectorAll('#adm-mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('adm-mode-auto').classList.toggle('on', mode === 'auto');
    $('adm-mode-manual').classList.toggle('on', mode === 'manual');
    if (apply){ cfg().mode = mode; commit(); }
  }

  function refreshDerived(){
    const c = cfg();
    // suma de %
    const sum = CATS.reduce((a,cat)=>a + (+$('adm-pct-'+cat).value || 0), 0);
    const sumEl = $('adm-sum'), sumV = $('adm-sum-v');
    sumV.textContent = sum + '%';
    sumEl.classList.toggle('ok', sum === 100);
    sumEl.classList.toggle('bad', sum !== 100);
    // bolsa total
    let total;
    if (c.mode === 'manual') total = +c.manualTotal || 0;
    else total = CATS.reduce((a,cat)=>a + (+c.paid[cat]||0), 0) * (+c.cuota||0);
    $('adm-total').textContent = fmt(total);
    refreshFill(total);
  }

  function refreshFill(total){
    const full = window.PIGGY_FILL_FULL || 1200;
    const raw = (total/full)*100;
    const pct = Math.max(0, Math.min(100, Math.round(raw)));
    const over = Math.max(0, Math.round(raw - 100));
    let lvl;
    if (total <= 0) lvl = 0;
    else { lvl = Math.round(pct/5)*5; if (lvl<5) lvl=5; if (lvl>100) lvl=100; }
    const pe=$('adm-fill-pct'), be=$('adm-fill-bar'), ie=$('adm-fill-img'), oe=$('adm-fill-over');
    if (pe) pe.textContent = pct + '%' + (over>0 ? ' (+' + over + '%)' : '');
    if (be) be.style.width = pct + '%';
    if (ie) ie.textContent = lvl === 0 ? 'vacío' : lvl;
    if (oe) oe.textContent = over > 0 ? ('+' + over + '% sobre la meta · bono visible') : '—';
  }
  window.ADMIN_REFRESH_FILL = () => {
    const c = cfg(); if (!c) return;
    let total;
    if (c.mode === 'manual') total = +c.manualTotal || 0;
    else total = CATS.reduce((a,cat)=>a + (+c.paid[cat]||0), 0) * (+c.cuota||0);
    refreshFill(total);
  };

  // lee inputs → cfg, re-renderiza página, persiste
  function commit(){
    const c = cfg();
    CATS.forEach(cat => {
      c.pcts[cat]   = Math.max(0, Math.min(100, +$('adm-pct-'+cat).value || 0)) / 100;
      c.totals[cat] = Math.max(0, +$('adm-tot-'+cat).value || 0);
      c.paid[cat]   = Math.max(0, Math.min(c.totals[cat], +$('adm-paid-'+cat).value || 0));
    });
    c.cuota = Math.max(0, +$('adm-cuota').value || 0);
    c.manualTotal = Math.max(0, +$('adm-manual').value || 0);
    if (window.PRIZE_POOL_SAVE) window.PRIZE_POOL_SAVE();
    if (window.renderPrizePool) window.renderPrizePool();
    refreshDerived();
    flashSaved();
  }

  let savedT;
  function flashSaved(){
    saved.classList.add('show');
    clearTimeout(savedT);
    savedT = setTimeout(()=>saved.classList.remove('show'), 1100);
  }

  // wire inputs (commit en input para feedback en vivo)
  panel.querySelectorAll('.adm-input').forEach(inp => {
    inp.addEventListener('input', () => { clampPaid(inp); commit(); });
  });
  function clampPaid(inp){
    // asegura paid ≤ cupos cuando cambian cupos
    CATS.forEach(cat => {
      const tot = +$('adm-tot-'+cat).value || 0;
      const pe = $('adm-paid-'+cat);
      if (+pe.value > tot) pe.value = tot;
    });
  }
  document.querySelectorAll('#adm-mode button').forEach(b => {
    b.onclick = () => setMode(b.dataset.mode, true);
  });

  // open/close
  function open(){ ov.classList.add('open'); panel.classList.add('open'); fillInputs(); }
  function close(){ ov.classList.remove('open'); panel.classList.remove('open'); }
  if (INLINE){
    fillInputs();
    $('adm-done').onclick = flashSaved;   // los cambios ya se guardan al teclear
  } else {
    fab.onclick = open;
    ov.onclick = close;
    $('adm-close').onclick = close;
    $('adm-done').onclick = close;
  }
  $('adm-reset').onclick = () => {
    const d = window.PRIZE_POOL_DEFAULTS;
    if (!d) return;
    const c = cfg();
    c.cuota = d.cuota; c.mode = d.mode; c.manualTotal = d.manualTotal;
    CATS.forEach(cat => { c.pcts[cat]=d.pcts[cat]; c.totals[cat]=d.totals[cat]; c.paid[cat]=d.paid[cat]; });
    if (window.PRIZE_POOL_SAVE) window.PRIZE_POOL_SAVE();
    if (window.renderPrizePool) window.renderPrizePool();
    fillInputs();
    flashSaved();
  };

  // atajo de teclado Shift+A (solo en modo cajón)
  if (!INLINE) document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) close();
    if ((e.key === 'A' || e.key === 'a') && e.shiftKey && !e.ctrlKey && !e.metaKey){
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      panel.classList.contains('open') ? close() : open();
    }
  });
})();
