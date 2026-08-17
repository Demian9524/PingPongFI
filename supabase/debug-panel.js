// ── Panel de observabilidad local (desactivado por defecto) ─────────────
// Se activa con:  localStorage.setItem('torneo_debug','true')
// Muestra: edición/categoría resueltas, estado Auth, último RPC + duración,
// estado de red, versión del frontend. NUNCA teléfonos, contraseñas, JWT,
// claves completas ni respuestas administrativas completas.
//
// También revela el enlace discreto a Diagnostico.html.

(function(){
  'use strict';
  window.FRONTEND_VERSION = 'fase2-2026-07';

  function debugOn(){
    try { return localStorage.getItem('torneo_debug') === 'true'; } catch(_){ return false; }
  }
  if (!debugOn()) return;

  const box = document.createElement('div');
  box.id = 'sbDebugPanel';
  box.setAttribute('aria-label','Panel de depuración');
  box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9998;width:270px;max-height:60vh;overflow:auto;'+
    'background:rgba(12,12,16,0.95);color:#c8c9d0;border:1px solid rgba(201,180,138,0.4);border-radius:10px;'+
    'padding:10px 12px;font:11px/1.5 ui-monospace,monospace;box-shadow:0 10px 30px rgba(0,0,0,0.6)';
  function line(label, val){
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = label + ': '; b.style.color = '#e9d8aa';
    d.appendChild(b); d.appendChild(document.createTextNode(val == null ? '—' : String(val)));
    return d;
  }
  const title = document.createElement('div');
  title.textContent = '🔧 torneo_debug';
  title.style.cssText = 'font-weight:700;color:#e9d8aa;margin-bottom:6px;display:flex;justify-content:space-between';
  const close = document.createElement('button');
  close.textContent = 'off'; close.style.cssText = 'background:none;border:1px solid #444;border-radius:5px;color:#aaa;cursor:pointer;font-size:10px;padding:1px 6px';
  close.onclick = () => { try { localStorage.setItem('torneo_debug','false'); } catch(_){}; box.remove(); };
  title.appendChild(close);
  box.appendChild(title);

  const body = document.createElement('div');
  box.appendChild(body);
  const dlink = document.createElement('a');
  dlink.href = 'Diagnostico.html'; dlink.textContent = '→ Página de diagnóstico';
  dlink.style.cssText = 'display:block;margin-top:8px;color:#74a98a';
  box.appendChild(dlink);

  function refresh(){
    body.textContent = '';
    body.appendChild(line('versión', window.FRONTEND_VERSION));
    body.appendChild(line('red', navigator.onLine ? 'online' : 'offline'));
    body.appendChild(line('SB listo', window.SB_READY ? 'sí' : 'no'));
    body.appendChild(line('slug', window.SB_EDITION_SLUG));
    body.appendChild(line('clave', window.SB_MASKED_KEY));
    const ed = window.SB_CATALOG && window.SB_CATALOG._cachedEdition && window.SB_CATALOG._cachedEdition();
    if (ed) body.appendChild(line('edición', ed.name + ' (' + ed.id + ')'));
    const ops = window.SB_LOG ? window.SB_LOG.lastOps() : [];
    const last = ops[ops.length - 1];
    if (last) body.appendChild(line('último RPC', last.area + '.' + last.name + ' ' + last.ms + 'ms ' + (last.ok ? 'OK' : 'ERR')));
    if (window.SB){
      window.SB.auth.getSession().then(({ data }) => {
        body.appendChild(line('auth', data.session ? (data.session.user.email || 'sesión') : 'sin sesión'));
      }).catch(()=>{});
    }
  }
  window.addEventListener('sb:op', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);

  function mount(){ document.body.appendChild(box); refresh(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
