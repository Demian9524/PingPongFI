// ── Capa de servicio para preinscripciones ─────────────────────────────
// Aísla la persistencia del formulario. El envío REAL lo hace
// supabase/registro-bridge.js (RPC preinscribir); lo que queda aquí es solo
// el borrador del wizard y un submit de respaldo local que SOLO se usa si
// SUPABASE_CONFIG.localFallback === true.
//
// localStorage permitido en el registro — nada más:
//   · borrador del formulario        (fi_pingpong_registro_draft_v3, aquí)
//   · submission_id / recuperación / folio confirmado
//     (fi_pp_submission_v2, en supabase/registration.js)
//
// NO existe una lista local de preinscritos: era engañosa (solo veía los
// envíos hechos en ESE navegador, nunca los de Supabase) y su exportación
// CSV parecía un padrón oficial sin serlo. La lista real vive en Admin.html.
//
// API pública (window.REGISTRO_STORAGE):
//   saveDraft(state) · loadDraft() · clearDraft() · submit(payload)

(function(){
  const DRAFT_KEY = 'fi_pingpong_registro_draft_v3';
  // Claves de versiones anteriores del formulario: contenían calendario,
  // turnos y disponibilidad. Se purgan al cargar; NUNCA se restauran.
  const LEGACY_DRAFT_KEYS = ['fi_pingpong_registro_draft', 'fi_pingpong_registro_draft_v2'];
  // Lista local de preinscritos de versiones anteriores: se elimina.
  const LEGACY_LIST_KEYS = ['fi_pingpong_registros_v2', 'fi_pingpong_registros'];
  // Campos del sistema antiguo que no deben sobrevivir en el borrador.
  const DROPPED_DRAFT_FIELDS = [
    'availability','availabilityGrid','availabilityNote','generalAvailability',
    'stayLate','usual_shifts','usualShifts','timeSlots','playSchedules',
    'selectedDaysCount','selectedSlotsCount','approximateAvailableHours','time_playing'
  ];

  function read(k, fb){ try { return JSON.parse(localStorage.getItem(k)) || fb; } catch { return fb; } }
  function write(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  // Migración de versión del formulario: se conservan datos personales y de
  // nivel compatibles; se descarta todo lo horario y la lista local.
  (function migrateDrafts(){
    let legacy = null;
    LEGACY_DRAFT_KEYS.forEach(k => {
      if (!legacy){ const d = read(k, null); if (d && d.state) legacy = d.state; }
      try { localStorage.removeItem(k); } catch(_){}
    });
    LEGACY_LIST_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch(_){} });
    if (legacy && !localStorage.getItem(DRAFT_KEY)){
      write(DRAFT_KEY, { state: stripLegacy(legacy), updatedAt: new Date().toISOString() });
    }
  })();

  function stripLegacy(state){
    const out = { ...(state || {}) };
    DROPPED_DRAFT_FIELDS.forEach(f => { delete out[f]; });
    return out;
  }

  function saveDraft(state){
    try { write(DRAFT_KEY, { state: stripLegacy(state), updatedAt: new Date().toISOString() }); }
    catch(e){ console.warn('No se pudo guardar el progreso', e); }
  }
  function loadDraft(){
    const d = read(DRAFT_KEY, null);
    return d && d.state ? stripLegacy(d.state) : null;
  }
  function clearDraft(){
    try { localStorage.removeItem(DRAFT_KEY); } catch(_){}
  }

  function randomFolio(){
    const n = Math.floor(Math.random() * 9000) + 1000;
    return 'FI2-' + n;
  }
  function uuid(){
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
  }

  // — Envío de respaldo (solo con localFallback activado) —
  // No persiste ningún padrón: devuelve un folio local para que la UI pueda
  // cerrar el flujo. La inscripción oficial siempre pasa por la RPC.
  async function submit(){
    await new Promise(r => setTimeout(r, 300));
    const now = new Date().toISOString();
    console.warn('[registro] envío local de respaldo: NO quedó registrado en Supabase.');
    return { ok: true, id: uuid(), folio: randomFolio(), publicToken: null, createdAt: now };
  }

  window.REGISTRO_STORAGE = { saveDraft, loadDraft, clearDraft, submit };
})();
