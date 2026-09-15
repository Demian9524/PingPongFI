// ── Candado de inscripciones (público) ───────────────────────────────────
// Lee la MISMA llave que el Centro de control (torneo_sections_cfg_v1, campo
// `registro`, escrito por supabase/public-sections-admin.js y guardado en
// Supabase → site_settings). Con el formulario en «Oculto»:
//   · desaparecen todos los botones/enlaces que llevan a Registro.html
//     (nav, hero, pop-up de reglas…), incluso los que se inyectan después;
//   · Registro.html queda inaccesible aunque se escriba la URL a mano: el
//     formulario no se muestra y el envío se bloquea.
// El valor local se usa para pintar sin parpadeo y SIEMPRE se confirma con el
// servidor: mientras no responda, el botón de envío queda desactivado.
(function(global){
  'use strict';
  var KEY = 'torneo_sections_cfg_v1';
  var CTA_SEL = 'a[href^="Registro.html"],a[href*="/Registro.html"],[data-reg-cta]';
  var resolved = false;

  function cfg(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){ return {}; }
  }
  function stateOf(){
    var v = cfg().registro;
    if (v === false) return 'off';
    if (v === true || v == null) return 'on';
    return (v === 'on' || v === 'off' || v === 'empty') ? v : 'on';
  }
  // 'empty' también cierra: el organizador no quiere recibir inscripciones.
  function isOpen(){ return stateOf() === 'on'; }
  function isRegPage(){ return /(^|\/)Registro\.html$/i.test(location.pathname); }

  function applyCtas(){
    var off = !isOpen();
    var list = document.querySelectorAll(CTA_SEL);
    for (var i = 0; i < list.length; i++){
      var a = list[i];
      if (a.hidden !== off) a.hidden = off;
      if (off) a.setAttribute('aria-hidden', 'true');
      else a.removeAttribute('aria-hidden');
    }
  }

  function injectStyle(){
    if (document.getElementById('regGateCss')) return;
    var st = document.createElement('style');
    st.id = 'regGateCss';
    st.textContent = '.reg-closed{max-width:620px;margin:0 auto;padding:44px 28px;text-align:center}' +
      '.reg-closed h1{font-size:26px;letter-spacing:-0.01em;margin:0 0 14px}' +
      '.reg-closed p{margin:0 0 22px;line-height:1.6;opacity:.85}' +
      '.reg-closed-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:10px;' +
      'border:1px solid rgba(237,187,82,0.45);color:#edbb52;text-decoration:none;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:12px}' +
      '.reg-closed-btn:hover{background:rgba(237,187,82,0.12)}';
    document.head.appendChild(st);
  }

  function closePage(){
    if (document.getElementById('regClosed')) return;
    injectStyle();
    var wrap = document.querySelector('.wrap');
    if (!wrap) return;
    for (var i = 0; i < wrap.children.length; i++) wrap.children[i].hidden = true;
    var box = document.createElement('div');
    box.id = 'regClosed';
    box.className = 'reg-closed';
    box.innerHTML = '<h1>Inscripciones cerradas</h1>' +
      '<p>El formulario de inscripción no está disponible por el momento. ' +
      'Cuando el comité organizador lo vuelva a abrir, aparecerá aquí mismo.</p>' +
      '<a class="reg-closed-btn" href="Pagina Torneo.html">Volver al inicio</a>';
    wrap.appendChild(box);
    document.title = 'Inscripciones cerradas · Torneo de Ping Pong FI';
  }

  // Bloqueo duro del envío: activo mientras no se confirme con el servidor y
  // permanente si las inscripciones están cerradas.
  function guardSubmit(){
    document.addEventListener('submit', function(e){
      var f = e.target;
      if (!f || f.id !== 'regForm') return;
      if (!isOpen() || !resolved){
        e.preventDefault();
        e.stopImmediatePropagation();
        if (global.SB_UI && global.SB_UI.toast){
          global.SB_UI.toast(isOpen() ? 'Verificando si las inscripciones están abiertas…'
            : 'Las inscripciones están cerradas.', 'error');
        }
      }
    }, true);
  }
  function setSubmitEnabled(on){
    var b = document.getElementById('btnSubmit');
    if (b) b.disabled = !on;
  }

  function applyAll(){
    applyCtas();
    if (isRegPage()){
      if (!isOpen()) closePage();
      setSubmitEnabled(resolved && isOpen());
    }
  }

  // Confirmación con el servidor (fuente de verdad para todos los visitantes).
  function syncFromServer(tries){
    if (!global.SB || !global.SB.from){
      if ((tries || 0) > 12){ resolved = true; applyAll(); return; }
      setTimeout(function(){ syncFromServer((tries || 0) + 1); }, 250);
      return;
    }
    global.SB.from('site_settings').select('value').eq('key', KEY).maybeSingle()
      .then(function(res){
        if (!res.error && res.data && res.data.value){
          var wasOpen = isOpen();
          try { localStorage.setItem(KEY, JSON.stringify(res.data.value)); } catch(e){}
          resolved = true;
          // Si el caché local decía «cerrado» pero el servidor dice «abierto»,
          // se recarga una sola vez para devolver el formulario completo.
          if (!wasOpen && isOpen() && isRegPage() && document.getElementById('regClosed')){
            if (!sessionStorage.getItem('regGateReloaded')){
              try { sessionStorage.setItem('regGateReloaded', '1'); } catch(e){}
              location.reload();
              return;
            }
          }
        } else {
          resolved = true;
        }
        applyAll();
      })
      .catch(function(){ resolved = true; applyAll(); });
  }

  function boot(){
    guardSubmit();
    setSubmitEnabled(false);
    applyAll();
    // La nav y el botón «Inscribirse» se inyectan por JS después: se vigila
    // el DOM para ocultarlos en cuanto aparezcan.
    if (global.MutationObserver){
      var t = 0;
      new MutationObserver(function(){
        clearTimeout(t);
        t = setTimeout(applyCtas, 60);
      }).observe(document.body, { childList: true, subtree: true });
    }
    global.addEventListener('storage', function(e){ if (e.key === KEY) applyAll(); });
    syncFromServer(0);
  }

  global.SB_REGISTRO_GATE = { isOpen: isOpen, apply: applyAll, KEY: KEY };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
