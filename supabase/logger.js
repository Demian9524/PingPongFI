// ── Logger sanitizado + códigos de error para soporte ──────────────────
// Producción: sin payloads, sin teléfonos, sin tokens, sin claves.
// Desarrollo (torneo_debug=true): operación, duración, código, mensaje corto.
//
// window.SB_LOG:
//   isDebug()
//   op(area, name, ms, ok, extra?)   — traza de operación
//   error(code, err)                 — registra y devuelve código de soporte
//   lastOps()                        — últimas 20 operaciones (para debug panel)
//
// Códigos: REG-xxx (registro), AUTH-xxx, DIR-xxx (directorio),
//          ADM-xxx (admin), CAT-xxx (catálogos), GRP-xxx (grupos), DIA-xxx.

(function(){
  'use strict';
  const ops = [];

  function isDebug(){
    try { return localStorage.getItem('torneo_debug') === 'true'; } catch(_){ return false; }
  }
  function sanitize(msg){
    return String(msg || '')
      .replace(/\+?\d[\d\s-]{8,}\d/g, '[tel]')             // teléfonos
      .replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[token]')       // JWTs
      .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, '[clave]')
      .slice(0, 300);
  }
  function op(area, name, ms, ok, extra){
    const rec = { t: new Date().toISOString(), area, name, ms: Math.round(ms), ok: !!ok,
                  extra: extra ? sanitize(JSON.stringify(extra)) : undefined };
    ops.push(rec); if (ops.length > 20) ops.shift();
    if (isDebug()) console.info('[' + area + '] ' + name + ' · ' + rec.ms + 'ms · ' + (ok ? 'OK' : 'ERROR'));
    try { window.dispatchEvent(new CustomEvent('sb:op', { detail: rec })); } catch(_){}
  }
  function error(code, err){
    const msg = sanitize(err && err.message);
    if (isDebug()) console.error('[' + code + ']', msg, err);
    else console.error('[' + code + '] ' + msg);
    return code;
  }
  window.SB_LOG = { isDebug, op, error, lastOps: () => ops.slice() };
})();
