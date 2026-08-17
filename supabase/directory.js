// ── Directorio público de contacto ─────────────────────────────────────
// Única fuente permitida: RPC get_public_contact_directory(p_edition_id).
// No se consulta registrations/players directamente. Solo se muestran los
// campos que devuelve la función (sin email, pagos ni notas internas).

(function(){
  'use strict';
  async function fetchDirectory(editionId){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await window.SB.rpc('get_public_contact_directory', { p_edition_id: editionId });
    if (error) throw error;
    return data || [];
  }
  window.SB_DIRECTORY = { fetchDirectory };
})();
