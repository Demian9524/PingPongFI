// ── Configuración de Supabase (PLANTILLA) ──────────────────────────────
// Copia este archivo como  supabase/config.js  y coloca ahí tus valores.
// supabase/config.js está en .gitignore y NO se versiona.
//
// SOLO credenciales públicas de frontend:
//   url            → Supabase → Settings → API → Project URL
//   publishableKey → Supabase → Settings → API keys → Publishable key
//
// NUNCA coloques aquí: service_role, secret key (sb_secret…), JWT secret,
// contraseña de PostgreSQL ni URIs postgres:// — no son necesarias.

window.SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co',        // ← reemplazar
  publishableKey: 'sb_publishable_REEMPLAZAR',   // ← reemplazar
  editionSlug: 'fi-2026-1',

  // Fallback a almacenamiento local SOLO para desarrollo sin backend.
  // Por defecto false: si la conexión falla, se muestra el error real.
  localFallback: false
};
