// ── Datos administrativos (solo organizadores autenticados) ────────────
// Única fuente: RPC admin_registrations(p_edition_id) — valida is_organizer()
// en el backend. El JWT del usuario viaja automáticamente con el cliente.
// NUNCA usar service_role/secret keys en el navegador.
//
// TODO (sin RPC segura todavía — acciones deshabilitadas en la UI):
//   * confirmar pago            → necesitaría p.ej. admin_confirm_payment(reg_id)
//   * cambiar categoría         → admin_change_category(reg_id, edcat_id, reason)
//   * editar notas del staff    → admin_update_notes(reg_id, notes)

(function(){
  'use strict';
  async function fetchAdminRegistrations(editionId){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await window.SB.rpc('admin_registrations',
      editionId != null ? { p_edition_id: editionId } : {});
    if (error) throw error;
    return data || [];
  }
  window.SB_ADMIN = { fetchAdminRegistrations };
})();
