// ── supabase/payments-status.js — historial de pago coherente ────────────
// PROBLEMA QUE RESUELVE
// La tabla payments es un historial: una inscripción puede tener varias filas
// (CONFIRMED, REJECTED, …). Distintas partes del sistema resuelven ese
// historial de forma DISTINTA y llegan a conclusiones opuestas:
//
//   v_admin_registrations  → «existe algún pago CONFIRMED»  → insignia CONFIRMADO
//   confirmar/exentar pago → «existe un pago activo»        → PAYMENT_STATE_CONFLICT
//   tablero de grupos      → parece leer el pago más reciente → «no elegible»
//
// Con el historial CONFIRMED → REJECTED → REJECTED las tres dan resultados
// diferentes y el staff se queda sin pistas: la insignia dice confirmado, el
// tablero bloquea la asignación y el botón de confirmar se niega a actuar.
//
// Este módulo NO decide cuál regla es la correcta (eso se arregla en la base,
// ver sql/MIGRACION_estado_pago_unico.sql). Lo que hace es leer el historial
// completo y marcar las inscripciones AMBIGUAS para poder avisarlas:
//   _payHistory   → historial completo, del más viejo al más nuevo
//   _payLatest    → estado del registro más reciente
//   _payConflict  → true si el historial es contradictorio (hay un pago
//                   aceptado y además un rechazo posterior, o al revés)
// payment_status se deja INTACTO: es el que reporta la vista.

(function(global){
  'use strict';

  // pay_status_ck de esta base: PENDING, CONFIRMED, WAIVED, REJECTED, REFUNDED.
  const OK = ['CONFIRMED', 'WAIVED'];
  const CHUNK = 150;

  function idOf(r){ return String(r && (r.registration_id || r.id) || ''); }
  function up(s){ return String(s || '').toUpperCase(); }

  async function fetchHistories(ids){
    const map = new Map();
    if (!global.SB || !ids.length) return map;
    for (let i = 0; i < ids.length; i += CHUNK){
      const { data, error } = await global.SB.from('payments')
        .select('id,registration_id,status,created_at,confirmed_at,amount_cents')
        .in('registration_id', ids.slice(i, i + CHUNK))
        .order('created_at', { ascending: true });
      if (error) throw error;
      (data || []).forEach(p => {
        const k = String(p.registration_id);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(p);
      });
    }
    return map;
  }

  // Marca los historiales ambiguos. Devuelve esas filas (para avisar).
  // Si la consulta falla, no toca nada y lo registra en la bitácora.
  async function reconcile(rows){
    const list = Array.isArray(rows) ? rows : [];
    let map;
    try {
      map = await fetchHistories(list.map(idOf).filter(Boolean));
    } catch(e){
      global.SB_LOG && global.SB_LOG.error('PAY-001', e);
      return [];
    }
    const conflicts = [];
    list.forEach(r => {
      const h = map.get(idOf(r)) || [];
      r._payHistory = h;
      r._payLatest = h.length ? up(h[h.length - 1].status) : null;
      const accepted = h.some(p => OK.indexOf(up(p.status)) >= 0);
      const rejected = h.some(p => OK.indexOf(up(p.status)) < 0 && up(p.status) !== 'PENDING');
      // Ambiguo = conviven aceptación y rechazo en el mismo historial.
      r._payConflict = accepted && rejected;
      if (r._payConflict) conflicts.push(r);
    });
    return conflicts;
  }

  function isSettled(r){
    return OK.indexOf(up(r && r.payment_status)) >= 0;
  }

  // Texto para tooltip: «CONFIRMED · 10 jul 03:54  →  REJECTED · 10 jul 03:54»
  function historyText(r){
    const h = (r && r._payHistory) || [];
    if (!h.length) return 'Sin registros de pago.';
    return h.map(p => up(p.status) + ' · ' +
      new Date(p.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    ).join('  →  ');
  }

  global.SB_PAYMENTS = { reconcile, isSettled, historyText, OK };
})(typeof window !== 'undefined' ? window : globalThis);
