// ── Cliente Supabase (navegador) ────────────────────────────────────────
// Orden de carga requerido en cada página:
//   1. supabase/config.js   (window.SUPABASE_CONFIG — no versionado)
//   2. CDN @supabase/supabase-js UMD (window.supabase)
//   3. supabase/logger.js
//   4. este archivo
//
// Expone:
//   window.SB               — cliente o null
//   window.SB_READY         — boolean
//   window.SB_EDITION_SLUG  — slug de la edición activa
//   window.SB_CONFIG_ERRORS — array de problemas de configuración
//   window.SB_LOCAL_FALLBACK— boolean (fallback local explícito)
//   window.SB_MASKED_KEY    — publishable key enmascarada (para diagnóstico)

(function(){
  'use strict';
  // compat: acepta el formato anterior SUPABASE_ENV si aún existiera
  const legacy = window.SUPABASE_ENV || {};
  const cfg = window.SUPABASE_CONFIG || {
    url: legacy.SUPABASE_URL, publishableKey: legacy.SUPABASE_PUBLISHABLE_KEY,
    editionSlug: legacy.TOURNAMENT_EDITION_SLUG, localFallback: false
  };

  const errors = [];
  const url = String(cfg.url || '');
  const key = String(cfg.publishableKey || '');

  if (!url) errors.push('Falta url en SUPABASE_CONFIG.');
  else if (/TU-PROYECTO|your-project/i.test(url)) errors.push('url sigue con el placeholder sin reemplazar.');
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) errors.push('url no parece un Project URL válido de Supabase (https://xxxx.supabase.co).');

  if (!key) errors.push('Falta publishableKey en SUPABASE_CONFIG.');
  else if (/REEMPLAZAR|your-publishable/i.test(key)) errors.push('publishableKey sigue con el placeholder sin reemplazar.');
  else if (!/^(sb_publishable_|eyJ)/.test(key)) errors.push('publishableKey no tiene formato de clave publishable.');
  else if (/^sb_secret_/.test(key)) errors.push('¡La clave configurada es SECRETA! Retírala inmediatamente y usa la publishable.');

  window.SB = null;
  window.SB_READY = false;
  window.SB_EDITION_SLUG = cfg.editionSlug || 'fi-2026-1';
  window.SB_LOCAL_FALLBACK = cfg.localFallback === true;
  window.SB_CONFIG_ERRORS = errors;
  window.SB_MASKED_KEY = key ? (key.slice(0, 15) + '****' + key.slice(-4)) : '(sin clave)';

  function banner(msg){
    // alerta visual no invasiva (solo si hay <body>)
    function mount(){
      if (document.getElementById('sbConfigBanner')) return;
      const el = document.createElement('div');
      el.id = 'sbConfigBanner';
      el.setAttribute('role','alert');
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;max-width:340px;'+
        'background:#2a1d12;color:#e9d8aa;border:1px solid rgba(201,180,138,0.5);border-radius:9px;'+
        'padding:10px 14px;font:12.5px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.5)';
      el.innerHTML = '<b style="display:block;margin-bottom:3px">Sitio sin conexión al servidor</b>';
      const p = document.createElement('span'); p.textContent = msg; el.appendChild(p);
      const x = document.createElement('button');
      x.textContent = '×'; x.setAttribute('aria-label','Cerrar aviso');
      x.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;color:inherit;font-size:15px;cursor:pointer';
      x.onclick = () => el.remove();
      el.appendChild(x);
      document.body.appendChild(el);
    }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }

  if (errors.length){
    console.error('[supabase] Configuración inválida:\n · ' + errors.join('\n · ') +
      '\nCopia supabase/config.example.js como supabase/config.js y completa los valores.');
    banner('Revisa supabase/config.js — ' + errors[0]);
    return;
  }
  if (!window.supabase || !window.supabase.createClient){
    console.error('[supabase] La librería @supabase/supabase-js (CDN) no cargó.');
    window.SB_CONFIG_ERRORS.push('CDN de supabase-js no cargó.');
    banner('No cargó la librería de conexión (CDN). Revisa tu internet.');
    return;
  }
  try {
    window.SB = window.supabase.createClient(url, key);
    window.SB_READY = true;
  } catch(e){
    console.error('[supabase] No se pudo crear el cliente:', e);
    window.SB_CONFIG_ERRORS.push('createClient falló: ' + (e && e.message));
    banner('No se pudo inicializar la conexión.');
  }
})();
