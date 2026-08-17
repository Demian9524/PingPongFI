// ── LISTA PREVIA AL SORTEO — bloque administrativo (ControlTorneo.html) ──
// Fuente ÚNICA de verdad: RPC administrativas
//   admin_get_pre_group_visibility(p_edition_id)
//   admin_set_pre_group_visibility(p_edcat, p_visible, p_reason)
//   admin_set_pre_group_visibility_for_edition(p_edition_id, p_visible, p_reason)
// Se llaman con el MISMO cliente autenticado del panel (window.SB, sesión de
// supabase/auth.js). Nunca se crea un cliente anónimo ni se usa service_role.
// El apagado automático al iniciar la fase de grupos es atómico en Supabase:
// aquí NUNCA se fuerza OFF desde el frontend.

(function(global){
  'use strict';

  const S = { editionId: null, data: null, busy: false, mounted: false, lastMsg: null };

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const $ = s => document.querySelector(s);

  async function rpc(name, params, tag){
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const t0 = performance.now();
    const { data, error } = await global.SB.rpc(name, params);
    if (global.SB_LOG) global.SB_LOG.op(tag || 'PGV', name, performance.now() - t0, !error);
    if (error){
      if (error.code === 'PGRST202' || /function .* does not exist/i.test(error.message || '')){
        const e = new Error('RPC_MISSING:' + name);
        e.userMessage = 'La función ' + name + ' no está disponible en el backend.';
        throw e;
      }
      if (error.code === '42501' || /permission denied|not authorized|unauthorized/i.test(error.message || '')){
        const e = new Error('UNAUTHORIZED:' + name);
        e.userMessage = 'Tu sesión no tiene autorización para cambiar la visibilidad. Vuelve a iniciar sesión como organizador.';
        throw e;
      }
      throw error;
    }
    return Array.isArray(data) ? data[0] : data;
  }

  async function requireSession(){
    if (!global.SB_AUTH) return;
    const session = await global.SB_AUTH.getSession();
    if (!session){
      const e = new Error('NO_SESSION');
      e.userMessage = 'Tu sesión administrativa caducó. Inicia sesión de nuevo; el cambio NO se guardó.';
      throw e;
    }
  }

  function msg(text, cls){
    const n = $('#pgvMsg');
    if (!n) return;
    S.lastMsg = text || null;
    n.textContent = text || '';
    n.className = 'metaline' + (cls ? ' ' + cls : '');
  }

  function overallState(cats){
    const on = cats.filter(c => c.is_visible).length;
    if (!cats.length) return { key: 'off', label: 'Oculta', cls: 'neutral' };
    if (on === cats.length) return { key: 'on', label: 'Visible', cls: 'ok' };
    if (on === 0) return { key: 'off', label: 'Oculta', cls: 'neutral' };
    return { key: 'partial', label: 'Parcial', cls: 'warn' };
  }

  function reason(){
    const n = $('#pgvReason');
    return n ? n.value.trim() : '';
  }

  function setBusy(v){
    S.busy = v;
    const root = $('#pgvBody');
    if (!root) return;
    root.querySelectorAll('input,button,select,textarea').forEach(n => { n.disabled = v; });
    const rn = $('#pgvReason');
    if (rn) rn.disabled = v;
    root.setAttribute('aria-busy', String(v));
  }

  function switchNode(id, checked, indeterminate, onChange){
    const lab = el('label', 'pgvsw');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!checked;
    input.indeterminate = !!indeterminate;
    const track = el('span', 'pgvsw-track');
    track.appendChild(el('span', 'pgvsw-dot'));
    lab.appendChild(input);
    lab.appendChild(track);
    input.addEventListener('change', () => onChange(input.checked, input));
    return { node: lab, input };
  }

  function render(){
    const body = $('#pgvBody');
    if (!body) return;
    body.textContent = '';
    if (!S.data){
      const st = el('div', 'metaline', 'Sin datos de visibilidad.');
      body.appendChild(st);
      return;
    }
    const cats = Array.isArray(S.data.categories) ? S.data.categories : [];
    const st = overallState(cats);

    // ── cabecera: estado general + interruptor global ──────────────────
    const head = el('div', 'pgvhead');
    const label = el('div', 'pgvhead-t');
    label.appendChild(el('span', 'metaline', 'Estado general de la sección pública'));
    const bd = el('span', 'badge ' + st.cls, st.label);
    label.appendChild(bd);
    head.appendChild(label);

    const gwrap = el('div', 'pgvhead-a');
    gwrap.appendChild(el('span', 'pgvsw-lbl', st.key === 'partial' ? 'Mixto — activar todas' : (st.key === 'on' ? 'Todas visibles' : 'Todas ocultas')));
    const gsw = switchNode('pgvGlobal', st.key === 'on', st.key === 'partial', (checked) => setAll(checked));
    gwrap.appendChild(gsw.node);
    head.appendChild(gwrap);
    body.appendChild(head);

    if (st.key === 'partial'){
      const warn = el('div', 'alert warn');
      warn.appendChild(el('span', 'an', '!'));
      warn.appendChild(el('span', null, 'Estado parcial: unas categorías están visibles y otras no. El interruptor general no representa ON ni OFF total.'));
      body.appendChild(warn);
    }

    // ── una tarjeta por categoría ──────────────────────────────────────
    const grid = el('div', 'pgvcats');
    cats.forEach(c => {
      const card = el('div', 'hud pgvcat');
      const top = el('div', 'pgvcat-top');
      const tt = el('div');
      tt.appendChild(el('b', null, c.category_name || c.category_code || '—'));
      tt.appendChild(el('span', 'metaline', c.category_code || ''));
      top.appendChild(tt);
      const sw = switchNode('pgvCat' + c.edition_category_id, !!c.is_visible, false,
        (checked) => setOne(c, checked));
      top.appendChild(sw.node);
      card.appendChild(top);

      card.appendChild(el('span', 'badge ' + (c.is_visible ? 'ok' : 'neutral'), c.is_visible ? 'Visible' : 'Oculta'));

      const kp = el('div', 'pgvkpis');
      [
        ['Elegibles', c.eligible_participants],
        ['Grupos', c.groups_total],
        ['Partidos', c.group_matches_total]
      ].forEach(([lbl, val]) => {
        const k = el('div', 'pgvkpi');
        k.appendChild(el('b', null, String(val == null ? '—' : val)));
        k.appendChild(el('small', null, lbl));
        kp.appendChild(k);
      });
      card.appendChild(kp);

      const info = el('div', 'pgvinfo');
      if (c.competition_started_at){
        info.appendChild(el('span', 'pill warn', 'Fase iniciada ' + fmt(c.competition_started_at)));
      } else {
        info.appendChild(el('span', 'pill', 'Fase no iniciada'));
      }
      if (c.auto_hidden_at){
        info.appendChild(el('span', 'pill late', 'Apagada automáticamente ' + fmt(c.auto_hidden_at)));
      }
      if (c.updated_at) info.appendChild(el('span', 'pill', 'Cambio ' + fmt(c.updated_at)));
      card.appendChild(info);

      if (c.auto_hidden_reason){
        card.appendChild(el('span', 'metaline', 'Motivo del apagado: ' + c.auto_hidden_reason));
      }
      if (c.is_visible && (c.competition_started_at || Number(c.groups_total) > 0 || Number(c.group_matches_total) > 0)){
        const w = el('div', 'alert warn');
        w.appendChild(el('span', 'an', '!'));
        w.appendChild(el('span', null, 'Esta categoría ya tiene grupos o partidos. La lista previa sigue publicándose porque el staff la reactivó manualmente.'));
        card.appendChild(w);
      }
      grid.appendChild(card);
    });
    if (!cats.length){
      grid.appendChild(el('div', 'metaline', 'La edición activa no tiene categorías registradas.'));
    }
    body.appendChild(grid);

    setBusy(S.busy);
  }

  function fmt(iso){
    try { return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }
    catch(e){ return String(iso); }
  }

  async function reload(){
    if (!S.editionId) return;
    try {
      S.data = await rpc('admin_get_pre_group_visibility', { p_edition_id: S.editionId }, 'PGV-GET');
      render();
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGV-001', err);
      S.data = null;
      render();
      msg((err && err.userMessage) || (err && err.message) || 'No se pudo consultar la visibilidad. (PGV-001)', 'k-danger');
    }
  }

  function guardReason(){
    const r = reason();
    if (!r){
      msg('Escribe un motivo antes de cambiar la visibilidad. El cambio NO se guardó.', 'k-danger');
      const n = $('#pgvReason');
      if (n) n.focus();
      render(); // devuelve los interruptores al estado real del servidor
      return null;
    }
    return r;
  }

  async function mutate(fn, okText){
    if (S.busy) return;
    const r = guardReason();
    if (!r) return;
    setBusy(true);
    msg('Guardando…');
    try {
      await requireSession();
      await fn(r);
      // El estado definitivo se relee del servidor, nunca por optimismo local.
      await reload();
      msg(okText, 'k-ok');
      global.SB_UI && global.SB_UI.toast(okText, 'ok');
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('PGV-002', err);
      setBusy(false);
      await reload();
      const text = (err && err.userMessage) || (err && err.message) || 'No se pudo guardar el cambio. (PGV-002)';
      msg(text, 'k-danger');
      global.SB_UI && global.SB_UI.toast(text, 'warn');
      return;
    }
    setBusy(false);
  }

  function setOne(cat, visible){
    const willWarn = visible && (cat.competition_started_at || Number(cat.groups_total) > 0 || Number(cat.group_matches_total) > 0);
    mutate(
      r => rpc('admin_set_pre_group_visibility', {
        p_edcat: cat.edition_category_id, p_visible: !!visible, p_reason: r
      }, 'PGV-SET'),
      (visible ? 'Categoría publicada' : 'Categoría oculta') + ': ' + (cat.category_name || cat.category_code)
        + (willWarn ? ' — atención: su fase de grupos ya inició.' : '.')
    );
  }

  function setAll(visible){
    mutate(
      r => rpc('admin_set_pre_group_visibility_for_edition', {
        p_edition_id: S.editionId, p_visible: !!visible, p_reason: r
      }, 'PGV-SET-ALL'),
      visible ? 'Todas las categorías quedaron visibles.' : 'La sección pública quedó oculta por completo.'
    );
  }

  // mount(editionId) — llamado por control-torneo-v2.js tras validar organizador
  async function mount(editionId){
    S.editionId = editionId;
    S.mounted = true;
    const sect = $('#pgvSect');
    if (sect) sect.style.display = '';
    await reload();
  }

  global.SB_PRE_GROUP_ADMIN = { mount, refresh: reload };
})(typeof window !== 'undefined' ? window : globalThis);
