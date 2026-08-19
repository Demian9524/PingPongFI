// ── Admin de "Restauremos las mesas" (Centro de control) ────────────────
// Misma mecánica que torneo-admin.js (PRIZE_POOL): config en localStorage
// + Supabase site_settings (RPC admin_save_site_setting). Si la página
// pública no definió window.REPAIR_FUND primero, este módulo la crea él
// mismo con los mismos valores por defecto.
(function(){
  'use strict';
  const STORAGE_KEY = 'torneo_repair_fund_v1';
  const DEFAULTS = { current: 0, goal: 1500, donors: [] };
  if (!window.REPAIR_FUND){
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e){}
    const c = window.REPAIR_FUND = {
      current: (s && s.current != null) ? s.current : DEFAULTS.current,
      goal: (s && s.goal != null) ? s.goal : DEFAULTS.goal,
      donors: (s && Array.isArray(s.donors)) ? s.donors : []
    };
    window.REPAIR_FUND_SAVE = function(){
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch(e){}
      if (window.SB && window.SB.rpc){
        window.SB.rpc('admin_save_site_setting', { p_key: STORAGE_KEY, p_value: c }).then(function(res){
          if (res.error){
            if (window.SB_UI) window.SB_UI.toast('No se guardó en el servidor: ' + res.error.message, 'error');
            else alert('No se guardó en el servidor: ' + res.error.message);
          }
        }).catch(function(e){
          alert('No se guardó en el servidor (fallo de red): ' + (e && e.message || e));
        });
      }
    };
    if (window.SB){
      window.SB.from('site_settings').select('value').eq('key', STORAGE_KEY).maybeSingle().then(function(res){
        if (res.error || !res.data || !res.data.value) return;
        Object.assign(c, res.data.value);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch(e){}
        mount();
      });
    }
  }

  function money(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-MX'); }

  function mount(){
    const host = document.getElementById('repairFundAdminMount');
    if (!host) return;
    const c = window.REPAIR_FUND;
    if (c.extra == null) c.extra = c.current || 0;
    const donorsSum = c.donors.reduce(function(a,d){ const n = Number(d.amount); return a + (isFinite(n) ? n : 0); }, 0);
    host.innerHTML =
      '<div class="rfa-row">' +
        '<label class="rfa-fld"><span>Otros ingresos (sin donador)</span><input type="number" min="0" step="1" id="rfaCurrent" value="' + c.extra + '"></label>' +
        '<label class="rfa-fld"><span>Meta</span><input type="number" min="1" step="1" id="rfaGoal" value="' + c.goal + '"></label>' +
        '<div class="rfa-fld"><span>Total recaudado (auto)</span><b class="rfa-total-readout">' + money(c.extra + donorsSum) + '</b></div>' +
      '</div>' +
      '<p class="ssub" style="margin:2px 0 0">El total recaudado se calcula solo: suma de los donadores de abajo + "Otros ingresos" (dinero recibido sin registrar a la persona).</p>' +
      '<div class="rfa-donors" id="rfaDonors"></div>' +
      '<div class="rfa-row">' +
        '<button type="button" class="btn btn-ghost" id="rfaAddDonor">+ Agregar donador</button>' +
        '<button type="button" class="btn btn-main" id="rfaSave">Guardar</button>' +
        '<span class="metaline" id="rfaMsg" aria-live="polite"></span>' +
      '</div>';
    renderDonorRows();
    document.getElementById('rfaAddDonor').onclick = function(){
      c.donors.push({ name: '', amount: 0, date: new Date().toISOString().slice(0,10), anonymous: false });
      renderDonorRows();
    };
    document.getElementById('rfaSave').onclick = function(){
      c.extra = Math.max(0, Number(document.getElementById('rfaCurrent').value) || 0);
      c.current = c.extra;
      c.goal = Math.max(1, Number(document.getElementById('rfaGoal').value) || DEFAULTS.goal);
      c.donors = Array.prototype.map.call(document.querySelectorAll('.rfa-donor-row'), function(row){
        const rawAmt = row.querySelector('.rfa-da').value.trim();
        const numAmt = Number(rawAmt);
        return {
          name: row.querySelector('.rfa-dn').value.trim(),
          amount: (rawAmt !== '' && isFinite(numAmt) && numAmt >= 0) ? numAmt : rawAmt,
          date: row.querySelector('.rfa-dd').value || new Date().toISOString().slice(0,10),
          anonymous: row.querySelector('.rfa-anon').checked
        };
      }).filter(function(d){ return d.name || d.anonymous; });
      window.REPAIR_FUND_SAVE();
      if (window.RESTORE_FUND_RENDER) window.RESTORE_FUND_RENDER();
      const msg = document.getElementById('rfaMsg');
      msg.textContent = 'Guardado ✓';
      setTimeout(function(){ msg.textContent = ''; }, 2000);
      mount();
    };
  }

  function renderDonorRows(){
    const wrap = document.getElementById('rfaDonors');
    const c = window.REPAIR_FUND;
    if (!wrap) return;
    wrap.innerHTML = c.donors.map(function(d, i){
      return '<div class="rfa-donor-row" data-i="' + i + '">' +
        '<input type="text" class="rfa-dn" placeholder="Nombre del donador" value="' + (d.name || '').replace(/"/g,'&quot;') + '">' +
        '<input type="text" class="rfa-da" placeholder="Monto o aporte (ej. 300 o Brochas)" value="' + String(d.amount != null ? d.amount : '').replace(/"/g,'&quot;') + '">' +
        '<input type="date" class="rfa-dd" value="' + (d.date || new Date().toISOString().slice(0,10)) + '">' +
        '<label class="rfa-anon-lbl"><input type="checkbox" class="rfa-anon"' + (d.anonymous ? ' checked' : '') + '> Anónimo</label>' +
        '<button type="button" class="rfa-del" aria-label="Quitar donador" data-i="' + i + '">×</button>' +
      '</div>';
    }).join('') || '<p class="ssub" style="margin:6px 0 0">Sin donadores registrados todavía. Cada fila es una aportación — si alguien dona varias veces, agrega una fila por cada una; el sitio público las agrupa por nombre automáticamente.</p>';
    wrap.querySelectorAll('.rfa-del').forEach(function(btn){
      btn.onclick = function(){ c.donors.splice(Number(btn.dataset.i), 1); renderDonorRows(); };
    });
  }

  const style = document.createElement('style');
  style.textContent = '.rfa-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin-top:4px}' +
    '.rfa-fld{display:flex;flex-direction:column;gap:4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);font-family:var(--mono)}' +
    '.rfa-fld input{background:#0a0a0e;border:1px solid var(--line2);border-radius:8px;color:var(--text);font-family:var(--body);font-size:15px;padding:9px 12px;width:150px;min-height:40px}' +
    '.rfa-total-readout{color:var(--gold);font-family:var(--disp);font-weight:800;font-size:18px;padding-top:4px}' +
    '.rfa-donors{margin-top:14px;display:flex;flex-direction:column;gap:8px}' +
    '.rfa-donor-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '.rfa-donor-row .rfa-dn{flex:1;background:#0a0a0e;border:1px solid var(--line2);border-radius:8px;color:var(--text);font-family:var(--body);font-size:14px;padding:9px 12px;min-height:40px}' +
    '.rfa-donor-row .rfa-da{width:200px;background:#0a0a0e;border:1px solid var(--line2);border-radius:8px;color:var(--text);font-family:var(--body);font-size:14px;padding:9px 12px;min-height:40px}' +
    '.rfa-donor-row .rfa-dd{width:150px;background:#0a0a0e;border:1px solid var(--line2);border-radius:8px;color:var(--text);font-family:var(--body);font-size:13px;padding:9px 10px;min-height:40px}' +
    '.rfa-anon-lbl{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);white-space:nowrap;flex:0 0 auto}' +
    '.rfa-del{width:34px;height:34px;flex:0 0 auto;border-radius:50%;border:1px solid var(--line2);background:none;color:var(--muted);font-size:18px;cursor:pointer}' +
    '.rfa-del:hover{color:var(--text);background:var(--raise)}';
  document.head.appendChild(style);

  if (document.getElementById('repairFundAdminMount')) mount();
  else document.addEventListener('DOMContentLoaded', function(){ if (document.getElementById('repairFundAdminMount')) mount(); });
})();
