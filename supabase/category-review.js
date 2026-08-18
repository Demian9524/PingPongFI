// Revision de categoria (compartido: ControlTorneo + Admin).
// Requiere la RPC admin_change_registration_category instalada con el hotfix
// corregido. El frontend nunca actualiza registrations directamente.
(function(){
  'use strict';

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function integerId(value){
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }

  function rpcError(res, fallback){
    const err = new Error((res && (res.message || res.code)) || fallback);
    if (res && res.code) err.code = res.code;
    return err;
  }

  // Confirmar categoria actual, sin selector.
  async function confirmCategory(registrationId, { onDone, onError } = {}){
    try {
      if (!window.SB_ADMIN_ACTIONS ||
          typeof window.SB_ADMIN_ACTIONS.confirmRegistrationCategory !== 'function'){
        throw new Error('Acciones administrativas no disponibles.');
      }

      const res = await window.SB_ADMIN_ACTIONS.confirmRegistrationCategory(
        registrationId,
        null
      );

      if (res && res.ok === false){
        throw rpcError(res, 'No se pudo confirmar la categoria.');
      }

      // Conserva el contrato anterior de confirmCategory: entrega al llamador
      // exactamente la respuesta de la RPC.
      if (onDone) onDone(res);
      return res;
    } catch(err){
      if (window.SB_LOG) window.SB_LOG.error('CAT-CONFIRM', err);
      if (onError) onError(err);
      return null;
    }
  }

  // Construye un select solo con IDs enteros validos.
  function buildCategorySelect(edcats, currentEdcatId){
    const sel = document.createElement('select');
    sel.className = 'filter';

    const currentId = integerId(currentEdcatId);
    const seen = new Set();
    const categories = Array.isArray(edcats) ? edcats : [];

    categories.forEach(c => {
      const id = c && integerId(c.id);
      if (id == null || seen.has(id)) return;
      seen.add(id);

      const o = document.createElement('option');
      o.value = String(id);
      o.textContent = c.name || c.code || ('Categoria ' + id);
      if (id === currentId) o.selected = true;
      sel.appendChild(o);
    });

    if (!sel.options.length){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'No hay categorias disponibles';
      o.disabled = true;
      o.selected = true;
      sel.appendChild(o);
      sel.disabled = true;
    }

    return sel;
  }

  function showBoardFallback(container, { onCancel } = {}){
    container.textContent = '';

    const wrap = el('div', 'hud');
    wrap.style.padding = '10px';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    wrap.appendChild(el(
      'p',
      'ssub',
      'Este participante tiene o tuvo grupo/partidos. El cambio debe revisarse en el Tablero de grupos.'
    ));

    const row = el('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    const go = el('a', 'btn btn-main', 'Ir al tablero de grupos');
    go.href = 'TableroGrupos.html';

    const close = el('button', 'btn btn-ghost', 'Cerrar');
    close.type = 'button';
    close.addEventListener('click', () => {
      container.textContent = '';
      if (onCancel) onCancel();
    });

    row.appendChild(go);
    row.appendChild(close);
    wrap.appendChild(row);
    container.appendChild(wrap);
  }

  // Aplica directo solo cuando el backend confirma que no existe impacto.
  function openChangeCategoryForm(
    container,
    registrationId,
    edcats,
    currentEdcatId,
    { onDone, onError, onCancel } = {}
  ){
    if (!container || typeof container.appendChild !== 'function'){
      throw new TypeError('Se requiere un contenedor DOM valido.');
    }

    container.textContent = '';

    const wrap = el('div', 'hud');
    wrap.style.padding = '10px';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';

    const sel = buildCategorySelect(edcats, currentEdcatId);
    const reason = el('input');
    reason.type = 'text';
    reason.className = 'filter';
    reason.placeholder = 'Motivo (opcional)';

    const msg = el('p', 'ssub', '');
    const actRow = el('div');
    actRow.style.display = 'flex';
    actRow.style.gap = '8px';

    const btnApply = el('button', 'btn btn-main', 'Cambiar categoria');
    btnApply.type = 'button';
    btnApply.disabled = sel.disabled;

    const btnCancel = el('button', 'btn btn-ghost', 'Cancelar');
    btnCancel.type = 'button';
    btnCancel.addEventListener('click', () => {
      container.textContent = '';
      if (onCancel) onCancel();
    });

    btnApply.addEventListener('click', async () => {
      msg.textContent = '';

      const targetId = integerId(sel.value);
      const currentId = integerId(currentEdcatId);

      if (targetId == null){
        msg.textContent = 'Selecciona una categoria valida.';
        return;
      }

      if (targetId === currentId){
        msg.textContent = 'Selecciona una categoria diferente.';
        return;
      }

      btnApply.disabled = true;

      try {
        if (!window.SB_ADMIN_ACTIONS ||
            typeof window.SB_ADMIN_ACTIONS.changeRegistrationCategory !== 'function'){
          throw new Error('Acciones administrativas no disponibles.');
        }

        const cleanReason = reason.value.trim() || null;
        const res = await window.SB_ADMIN_ACTIONS.changeRegistrationCategory(
          registrationId,
          targetId,
          cleanReason
        );

        if (res && res.ok === false){
          if (res.code === 'REQUIRES_PREVIEW'){
            showBoardFallback(container, { onCancel });
            return;
          }
          throw rpcError(res, 'El servidor rechazo el cambio de categoria.');
        }

        if (!res || res.ok !== true){
          throw rpcError(res, 'Respuesta inesperada al cambiar la categoria.');
        }

        const updated = res.registration;
        container.textContent = '';
        if (onDone) onDone(updated);
      } catch(err){
        if (window.SB_LOG) window.SB_LOG.error('CAT-CHANGE', err);
        msg.textContent = err && err.message
          ? err.message
          : 'No se pudo cambiar la categoria.';
        if (onError) onError(err);
      } finally {
        btnApply.disabled = false;
      }
    });

    actRow.appendChild(btnApply);
    actRow.appendChild(btnCancel);
    wrap.appendChild(sel);
    wrap.appendChild(reason);
    wrap.appendChild(actRow);
    wrap.appendChild(msg);
    container.appendChild(wrap);
  }

  window.SB_CATEGORY_REVIEW = {
    confirmCategory,
    openChangeCategoryForm,
    buildCategorySelect
  };
})();
