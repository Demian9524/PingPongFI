// ── Countdown fijo: 8 de septiembre de 2026, 00:00 hora de Ciudad de México ──
// CDMX es UTC-6 fijo (sin horario de verano desde 2022), por lo que la fecha
// objetivo se expresa como instante UTC explícito: 2026-09-08T06:00:00Z.
// La fecha NO es móvil: no salta a 2027 al llegar a cero; muestra "done".
//
// window.TORNEO_COUNTDOWN (navegador) / module.exports (vitest)

(function(global){
  'use strict';

  // Instante fijo: 2026-09-08 00:00:00 America/Mexico_City (UTC-6) → 06:00 UTC
  var TARGET_MS = Date.UTC(2026, 8, 8, 6, 0, 0, 0);

  function pad(n){ return String(n).padStart(2, '0'); }

  // Descompone el tiempo restante; nunca devuelve valores negativos.
  function remaining(nowMs){
    var diff = TARGET_MS - nowMs;
    if (diff <= 0) return { done: true, days: 0, hours: 0, mins: 0, secs: 0 };
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    return { done: false, days: d, hours: h, mins: m, secs: s };
  }

  var api = { TARGET_MS: TARGET_MS, remaining: remaining, pad: pad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TORNEO_COUNTDOWN = api;

  // ── Montaje en la página (solo navegador) ──
  if (typeof document === 'undefined') return;
  var box = document.getElementById('heroCountdown');
  if (!box) return;
  var elD = document.getElementById('cdDays'), elH = document.getElementById('cdHours'),
      elM = document.getElementById('cdMins'), elS = document.getElementById('cdSecs');

  var timer = null;
  function tick(){
    var r = remaining(Date.now());
    if (r.done){
      box.classList.add('is-done');
      if (timer) clearInterval(timer);
      return;
    }
    elD.textContent = pad(r.days);
    elH.textContent = pad(r.hours);
    elM.textContent = pad(r.mins);
    elS.textContent = pad(r.secs);
  }
  tick();
  timer = setInterval(tick, 1000);
})(typeof window !== 'undefined' ? window : globalThis);
