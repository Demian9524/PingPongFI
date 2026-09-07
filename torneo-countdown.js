// ── Countdown del hero (configurable desde el modo admin) ────────────────
// Por defecto: 8 de septiembre de 2026, 00:00 hora de Ciudad de México.
// CDMX es UTC-6 fijo (sin horario de verano desde 2022), así que las fechas se
// interpretan siempre en ese huso, no en el del visitante.
// La fecha NO es móvil: al llegar a cero muestra el mensaje "done".
//
// window.TORNEO_COUNTDOWN (navegador) / module.exports (vitest)

(function(global){
  'use strict';

  var CDMX_OFFSET_H = 6;                 // UTC-6 fijo
  var STORAGE_KEY = 'torneo_countdown_v1';
  var DEFAULTS = {
    enabled: true,
    // fecha y hora locales de CDMX, formato "YYYY-MM-DDTHH:MM"
    target: '2026-09-08T00:00',
    label: 'Arranca el 8 de septiembre',
    doneText: '¡El torneo ha comenzado!'
  };

  // "YYYY-MM-DDTHH:MM" (hora CDMX) → instante UTC en ms
  function parseTarget(local){
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local || ''));
    if (!m) return Date.UTC(2026, 8, 8, CDMX_OFFSET_H, 0, 0, 0);
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + CDMX_OFFSET_H, +m[5], 0, 0);
  }

  function pad(n){ return String(n).padStart(2, '0'); }

  // Descompone el tiempo restante; nunca devuelve valores negativos.
  function remaining(nowMs, targetMs){
    var t = targetMs == null ? api.TARGET_MS : targetMs;
    var diff = t - nowMs;
    if (diff <= 0) return { done: true, days: 0, hours: 0, mins: 0, secs: 0 };
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    return { done: false, days: d, hours: h, mins: m, secs: s };
  }

  var api = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEY: STORAGE_KEY,
    TARGET_MS: parseTarget(DEFAULTS.target),
    parseTarget: parseTarget,
    remaining: remaining,
    pad: pad
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TORNEO_COUNTDOWN = api;

  // ── Montaje en la página (solo navegador) ──
  if (typeof document === 'undefined') return;

  var cfg = Object.assign({}, DEFAULTS);
  try {
    var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (s && typeof s === 'object') Object.assign(cfg, s);
  } catch(e){}
  global.COUNTDOWN_CFG = cfg;

  global.COUNTDOWN_SAVE = function(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch(e){}
    if (global.SB && global.SB.rpc){
      global.SB.rpc('admin_save_site_setting', { p_key: STORAGE_KEY, p_value: cfg })
        .then(function(r){ if (r && r.error) console.error('[countdown] no se guardó:', r.error.message); });
    }
    apply();
  };

  var box = document.getElementById('heroCountdown');
  var elD = document.getElementById('cdDays'), elH = document.getElementById('cdHours'),
      elM = document.getElementById('cdMins'), elS = document.getElementById('cdSecs');
  var timer = null;

  function tick(){
    if (!box) return;
    var r = remaining(Date.now(), api.TARGET_MS);
    if (r.done){
      box.classList.add('is-done');
      if (timer){ clearInterval(timer); timer = null; }
      return;
    }
    box.classList.remove('is-done');
    if (elD) elD.textContent = pad(r.days);
    if (elH) elH.textContent = pad(r.hours);
    if (elM) elM.textContent = pad(r.mins);
    if (elS) elS.textContent = pad(r.secs);
  }

  // Repinta etiqueta, fecha objetivo y visibilidad tras cualquier cambio.
  function apply(){
    api.TARGET_MS = parseTarget(cfg.target);
    if (!box) return;
    box.hidden = cfg.enabled === false;
    var lbl = box.querySelector('.cd-lbl');
    if (lbl){
      var svg = lbl.querySelector('svg');
      lbl.textContent = '';
      if (svg) lbl.appendChild(svg);
      lbl.appendChild(document.createTextNode(cfg.label || DEFAULTS.label));
    }
    var done = box.querySelector('.cd-done');
    if (done) done.textContent = cfg.doneText || DEFAULTS.doneText;
    tick();
    if (!timer && cfg.enabled !== false) timer = setInterval(tick, 1000);
  }
  global.COUNTDOWN_APPLY = apply;
  apply();

  // Config global del servidor: gana sobre la copia local.
  if (global.SB){
    global.SB.from('site_settings').select('value').eq('key', STORAGE_KEY).maybeSingle()
      .then(function(r){
        if (!r || r.error || !r.data || !r.data.value) return;
        Object.assign(cfg, r.data.value);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch(e){}
        apply();
      });
  }
})(typeof window !== 'undefined' ? window : globalThis);
