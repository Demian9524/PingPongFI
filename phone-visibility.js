// ── Visibilidad global de teléfonos/WhatsApp ─────────────────────────────
// Interruptor único (site_settings, misma mecánica que torneo_prize_cfg_v1)
// que decide si los botones de WhatsApp/teléfono se muestran en el sitio
// público. Cargar ANTES de perfil-jugador.js y de torneo-admin.js.
(function(){
  const KEY = 'torneo_phone_visibility_v1';
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){}
  const state = window.PHONE_VISIBILITY = { show: (s && typeof s.show === 'boolean') ? s.show : false };
  const listeners = [];
  window.PHONE_VISIBILITY_ON_CHANGE = fn => { if (typeof fn === 'function') listeners.push(fn); };
  function notify(){ listeners.forEach(fn => { try { fn(state.show); } catch(e){} }); }

  window.PHONE_VISIBILITY_SAVE = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}
    notify();
    if (window.SB && window.SB.rpc){
      window.SB.rpc('admin_save_site_setting', { p_key: KEY, p_value: state }).then(({ error }) => {
        if (error){
          console.error('[phone-visibility] No se guardó en Supabase:', error.message);
          if (window.SB_UI) window.SB_UI.toast('No se guardó en el servidor (¿ya corriste el SQL de site_settings?): ' + error.message, 'error');
        }
      });
    }
  };

  window.PHONE_VISIBILITY_READY = window.SB
    ? window.SB.from('site_settings').select('value').eq('key', KEY).maybeSingle().then(({ data, error }) => {
        if (!error && data && data.value && typeof data.value.show === 'boolean'){
          state.show = data.value.show;
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}
          notify();
        }
      }).catch(()=>{})
    : Promise.resolve();
})();
