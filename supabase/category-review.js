// ── Revisión de categoría (compartido: ControlTorneo + Admin) ──────────
// Confirmar categoría / Cambiar categoría, misma lógica en ambas pantallas.
// Requiere sql/hotfix_category_review.sql aplicado manualmente (RPCs
// admin_confirm_registration_category / admin_change_registration_category).
(function(){
  'use strict';

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Confirmar categoría actual — sin selector, acción directa.
  async function confirmCategory(registrationId, { onDone, onError } = {}){
    try {
      const updated = await window.SB_ADMIN_ACTIONS.confirmRegistrationCategory(registrationId, null);
      onDone && onDone(updated);
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('CAT-CONFIRM', err);
      onError && onError(err);
    }
  }

  // Construye un <select> con las categorías de la edición (sin exponer IDs).
  function buildCategorySelect(edcats, currentEdcatId){
    const sel = document.createElement('select');
    sel.className = 'filter';
    edcats.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name || c.code;
      if (String(c.id) === String(currentEdcatId)) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  // Cambiar categoría — el flujo ahora vive en el Tablero de grupos
  // (preview/apply con impacto). El wrapper RPC antiguo devuelve siempre
  // REQUIRES_PREVIEW, así que aquí solo dirigimos al tablero.
  function openChangeCategoryForm(container, registrationId, edcats, currentEdcatId, { onCancel } = {}){
    container.textContent = '';
    const wrap = el('div', 'hud');
    wrap.style.padding = '10px'; wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '8px';
    wrap.appendChild(el('p', 'ssub',
      'Los cambios de categoría se hacen desde el Tablero de grupos: ahí verás el impacto (partidos conservados, cancelados y por crear) antes de confirmar.'));
    const actRow = el('div');
    actRow.style.display = 'flex'; actRow.style.gap = '8px';
    const go = el('a', 'btn btn-main', 'Ir al tablero de grupos');
    go.href = 'TableroGrupos.html';
    const btnCancel = el('button', 'btn btn-ghost', 'Cerrar');
    btnCancel.type = 'button';
    btnCancel.addEventListener('click', () => { container.textContent = ''; onCancel && onCancel(); });
    actRow.appendChild(go); actRow.appendChild(btnCancel);
    wrap.appendChild(actRow);
    container.appendChild(wrap);
  }

  window.SB_CATEGORY_REVIEW = { confirmCategory, openChangeCategoryForm, buildCategorySelect };
})();
