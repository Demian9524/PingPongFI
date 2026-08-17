// ── Autenticación de organizadores (Supabase Auth) ─────────────────────
// La autorización REAL vive en el backend: organizer_users + is_organizer()
// + RLS + admin_registrations(). Aquí solo manejamos sesión y una
// verificación explícita vía RPC — nunca una bandera en localStorage.
//
// window.SB_AUTH:
//   signIn(email, password) → session
//   signOut()
//   getSession()            → session|null (recuperación al recargar)
//   onAuthChange(cb)
//   isOrganizer()           → boolean (rpc is_organizer, requiere sesión)

(function(){
  'use strict';
  function requireClient(){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    return window.SB;
  }

  async function signIn(email, password){
    const sb = requireClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }
  async function signOut(){
    const sb = requireClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }
  async function getSession(){
    const sb = requireClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }
  function onAuthChange(cb){
    const sb = requireClient();
    return sb.auth.onAuthStateChange((_evt, session) => cb(session || null));
  }
  async function isOrganizer(){
    const sb = requireClient();
    const { data, error } = await sb.rpc('is_organizer');
    if (error) throw error;
    return data === true;
  }

  function translateAuthError(err){
    const m = String((err && err.message) || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (m.includes('email not confirmed')) return 'Tu correo no está confirmado. Revisa tu bandeja.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión con el servidor. Intenta de nuevo.';
    if (m.includes('supabase_not_configured')) return 'El sitio no está conectado al servidor.';
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }

  window.SB_AUTH = { signIn, signOut, getSession, onAuthChange, isOrganizer, translateAuthError };
})();
