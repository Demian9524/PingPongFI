// ── SB_UI: utilidades de interfaz compartidas (Fase 3) ─────────────────
// Traducciones de estados, badges, toasts, modal de confirmación y
// drawer de detalle. Sin dependencias. Cargar después de client.js y
// antes del script de página. Requiere css/design-system.css.

(function(global){
  'use strict';

  // ── Traducción de estados (backend → español) ──────────────────────
  const TR = {
    CONFIRMED: 'Confirmado', PRE_REGISTERED: 'Prerregistrado',
    PENDING: 'Pendiente', PAYMENT_PENDING: 'Pago pendiente', CANCELLED: 'Cancelado', WAITLISTED: 'Lista de espera',
    WAIVED: 'Exentado', REJECTED: 'Rechazado', REFUNDED: 'Reembolsado',
    ON_TIME: 'Registro regular', LATE_REGISTERED: 'Registro tardío',
    WAITING_FOR_LATE_GROUP: 'Esperando grupo tardío',
    SCHEDULED: 'Programado', PLAYED: 'Jugado', WALKOVER: 'Walkover',
    VOID: 'Anulado', DISPUTED: 'En revisión', BYE: 'BYE',
    STANDARD: 'Grupo regular', LATE_ENTRY: 'Grupo tardío',
    OPEN: 'Abierta', RUNNING: 'En curso', FINISHED: 'Finalizada', DRAFT: 'Borrador',
    TRUE: 'Sí', FALSE: 'No'
  };
  function tr(v){
    if (v == null || v === '') return '—';
    const k = String(v).toUpperCase().trim();
    return TR[k] || String(v).replace(/_/g, ' ');
  }
  function badgeClass(v){
    const k = String(v || '').toUpperCase();
    if (['CONFIRMED','PLAYED','ON_TIME','OPEN'].includes(k)) return 'ok';
    if (['PRE_REGISTERED','SCHEDULED','PENDING','PAYMENT_PENDING','RUNNING','WAITLISTED'].includes(k)) return 'warn';
    if (['LATE_REGISTERED','WAITING_FOR_LATE_GROUP','LATE_ENTRY','WALKOVER','BYE'].includes(k)) return 'late';
    if (k === 'WAIVED') return 'waived';
    if (['CANCELLED','VOID','DISPUTED','REJECTED','REFUNDED'].includes(k)) return 'danger';
    return 'neutral';
  }
  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function badge(v){ return el('span', 'badge ' + badgeClass(v), tr(v)); }

  // ── Botón de acción pendiente de RPC administrativa ────────────────
  function pendingButton(label){
    const b = el('button', 'btn-pending', label);
    b.type = 'button';
    b.disabled = true;
    b.title = 'Pendiente de RPC administrativa segura';
    b.setAttribute('aria-disabled', 'true');
    return b;
  }

  // ── Toasts ─────────────────────────────────────────────────────────
  let toastWrap = null;
  function toast(msg, type){
    if (!toastWrap){
      toastWrap = el('div', 'toasts');
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    const t = el('div', 'toast ' + (type || ''), msg);
    toastWrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3600);
    setTimeout(() => t.remove(), 4000);
  }

  // ── Modal de confirmación (Promise<boolean>) ───────────────────────
  function confirmModal(title, text, okLabel){
    return new Promise(resolve => {
      const bg = el('div', 'modal-bg open');
      const m = el('div', 'hud modal');
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      m.appendChild(el('h2', null, title));
      m.appendChild(el('p', null, text));
      const act = el('div', 'mact');
      const no = el('button', 'btn btn-ghost', 'Cancelar'); no.type = 'button';
      const ok = el('button', 'btn btn-main', okLabel || 'Confirmar'); ok.type = 'button';
      act.appendChild(no); act.appendChild(ok);
      m.appendChild(act); bg.appendChild(m);
      const prev = document.activeElement;
      function close(val){
        bg.remove();
        document.removeEventListener('keydown', onKey);
        if (prev && prev.focus) prev.focus();
        resolve(val);
      }
      function onKey(e){ if (e.key === 'Escape') close(false); }
      no.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      bg.addEventListener('click', e => { if (e.target === bg) close(false); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(bg);
      ok.focus();
    });
  }

  // ── Drawer de detalle ──────────────────────────────────────────────
  let drawerEls = null;
  function ensureDrawer(){
    if (drawerEls) return drawerEls;
    const bg = el('div', 'drawer-bg');
    const d = el('aside', 'drawer');
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Detalle');
    const head = document.createElement('header');
    const h2 = el('h2', null, '');
    const x = el('button', 'dclose', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Cerrar detalle');
    head.appendChild(h2); head.appendChild(x);
    const body = el('div', 'dbody');
    const act = el('div', 'dact');
    d.appendChild(head); d.appendChild(body); d.appendChild(act);
    document.body.appendChild(bg); document.body.appendChild(d);
    x.addEventListener('click', closeDrawer);
    bg.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && d.classList.contains('open')) closeDrawer();
    });
    drawerEls = { bg, d, h2, body, act, x, prevFocus: null };
    return drawerEls;
  }
  // rows: [{label, value}|{label, node}] · actions: [HTMLElement]
  function openDrawer(title, rows, actions){
    const D = ensureDrawer();
    D.prevFocus = document.activeElement;
    D.h2.textContent = title || 'Detalle';
    D.body.textContent = '';
    const dl = document.createElement('dl');
    (rows || []).forEach(r => {
      if (r == null) return;
      const row = el('div', 'drow');
      row.appendChild(el('dt', null, r.label));
      const dd = document.createElement('dd');
      if (r.node) dd.appendChild(r.node);
      else dd.textContent = (r.value == null || r.value === '') ? '—' : String(r.value);
      row.appendChild(dd);
      dl.appendChild(row);
    });
    D.body.appendChild(dl);
    D.act.textContent = '';
    (actions || []).forEach(a => D.act.appendChild(a));
    D.act.style.display = (actions && actions.length) ? 'flex' : 'none';
    D.bg.classList.add('open'); D.d.classList.add('open');
    D.x.focus();
  }
  function closeDrawer(){
    if (!drawerEls) return;
    drawerEls.bg.classList.remove('open');
    drawerEls.d.classList.remove('open');
    if (drawerEls.prevFocus && drawerEls.prevFocus.focus) drawerEls.prevFocus.focus();
  }

  // Variante de drawer que acepta un nodo de contenido ya construido
  // (secciones custom) en vez de una lista plana de {label,value}.
  function openDrawer2(title, bodyNode, actions){
    const D = ensureDrawer();
    D.prevFocus = document.activeElement;
    D.h2.textContent = title || 'Detalle';
    D.body.textContent = '';
    D.body.appendChild(bodyNode);
    D.act.textContent = '';
    (actions || []).forEach(a => D.act.appendChild(a));
    D.act.style.display = (actions && actions.length) ? 'flex' : 'none';
    D.bg.classList.add('open'); D.d.classList.add('open');
    D.x.focus();
  }

  const api = { tr, badge, badgeClass, pendingButton, toast, confirmModal, openDrawer, openDrawer2, closeDrawer, el };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_UI = api;
})(typeof window !== 'undefined' ? window : globalThis);
