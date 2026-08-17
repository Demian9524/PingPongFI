// ── Diagnóstico de conexión (solo lectura, sin escribir datos) ──────────
// Ejecuta comprobaciones no destructivas y devuelve estados + latencia.
// No expone claves completas ni teléfonos de participantes.

(function(){
  'use strict';

  async function timed(fn){
    const t0 = performance.now();
    try { const value = await fn(); return { ok: true, ms: Math.round(performance.now() - t0), value }; }
    catch(err){ return { ok: false, ms: Math.round(performance.now() - t0), error: (err && err.message) || String(err) }; }
  }

  // Cada check devuelve { ok, ms, detail } — detail SIN datos sensibles.
  const checks = [
    { id: 'client', name: 'Cliente Supabase inicializado', run: async () => {
        if (!window.SB_READY || !window.SB) throw new Error((window.SB_CONFIG_ERRORS || []).join('; ') || 'Cliente no inicializado');
        return 'URL ' + (window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG.url : '?') + ' · clave ' + window.SB_MASKED_KEY;
      } },
    { id: 'auth', name: 'Sesión de Auth actual', run: async () => {
        const { data, error } = await window.SB.auth.getSession();
        if (error) throw error;
        return data.session ? ('Sesión activa: ' + (data.session.user.email || 'usuario')) : 'Sin sesión (normal para público)';
      } },
    { id: 'edition', name: 'Edición por slug', run: async () => {
        const ed = await window.SB_CATALOG.getActiveEdition();
        return ed.name + ' · estado ' + ed.status + ' · id ' + ed.id;
      } },
    { id: 'categories', name: 'Categorías de la edición', run: async () => {
        const ed = await window.SB_CATALOG.getActiveEdition();
        const cats = await window.SB_CATALOG.getEditionCategories(ed.id);
        return cats.length + ' categorías';
      } },
    { id: 'faculties', name: 'Facultades', run: async () => {
        const f = await window.SB_CATALOG.getFaculties();
        return f.length + ' facultades';
      } },
    { id: 'directory', name: 'get_public_contact_directory', run: async () => {
        const ed = await window.SB_CATALOG.getActiveEdition();
        const rows = await window.SB_DIRECTORY.fetchDirectory(ed.id);
        return rows.length + ' registros públicos';
      } },
    { id: 'organizer', name: 'Estado de organizador', run: async () => {
        const { data } = await window.SB.auth.getSession();
        if (!data.session) return 'Sin sesión → no aplica';
        const org = await window.SB_AUTH.isOrganizer();
        return org ? 'Es organizador' : 'Autenticado sin permisos';
      } },
    { id: 'admin', name: 'admin_registrations (si autorizado)', run: async () => {
        const { data } = await window.SB.auth.getSession();
        if (!data.session) return 'Sin sesión → omitido';
        const org = await window.SB_AUTH.isOrganizer();
        if (!org) return 'Sin permisos → omitido';
        const ed = await window.SB_CATALOG.getActiveEdition();
        const rows = await window.SB_ADMIN.fetchAdminRegistrations(ed.id);
        return rows.length + ' inscripciones (autorizado)';
      } }
  ];

  async function runAll(onUpdate){
    const results = [];
    for (const c of checks){
      onUpdate && onUpdate(c.id, { status: 'running' });
      const r = await timed(c.run);
      const res = { id: c.id, name: c.name, ok: r.ok, ms: r.ms, detail: r.ok ? r.value : r.error };
      results.push(res);
      onUpdate && onUpdate(c.id, { status: r.ok ? 'ok' : 'error', ms: r.ms, detail: res.detail });
    }
    return results;
  }

  // Reporte de texto SIN secretos ni teléfonos
  function buildReport(results){
    const lines = [
      'DIAGNÓSTICO — Torneo de Ping Pong FI',
      'Fecha: ' + new Date().toISOString(),
      'Versión frontend: ' + (window.FRONTEND_VERSION || '?'),
      'Slug: ' + window.SB_EDITION_SLUG,
      'Clave: ' + window.SB_MASKED_KEY,
      'Red: ' + (navigator.onLine ? 'online' : 'offline'),
      ''
    ];
    results.forEach(r => {
      let detail = String(r.detail || '');
      detail = detail.replace(/\+?\d[\d\s-]{8,}\d/g, '[tel]').replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[token]');
      lines.push((r.ok ? '✓' : '✗') + ' ' + r.name + ' — ' + r.ms + 'ms — ' + detail);
    });
    return lines.join('\n');
  }

  window.SB_DIAGNOSTIC = { checks, runAll, buildReport };
})();
