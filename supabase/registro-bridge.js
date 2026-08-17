// ── Puente: sustituye REGISTRO_STORAGE.submit por la RPC real ───────────
// Se carga DESPUÉS de registro-storage.js.
//  * Fallback local SOLO si SUPABASE_CONFIG.localFallback === true.
//  * Valida el payload con SB_VALIDATE antes de enviar.
//  * Pantalla de recuperación si hay un intento previo pendiente/completado.
//  * Botón "Descargar comprobante" en la tarjeta de éxito (impresión).

(function(){
  'use strict';
  const STORAGE = window.REGISTRO_STORAGE;
  if (!STORAGE) return;
  const localSubmit = STORAGE.submit; // respaldo local original

  STORAGE.submit = async function(payloadForm){
    if (!window.SB_READY || !window.SB){
      if (window.SB_LOCAL_FALLBACK === true){
        console.warn('[registro] localFallback=true — guardando SOLO en este navegador.');
        return localSubmit(payloadForm);
      }
      const e = new Error('SUPABASE_NOT_CONFIGURED');
      e.friendly = 'El sitio no está conectado al servidor. Avisa a la organización (código REG-000).';
      throw e;
    }
    const CAT = window.SB_CATALOG, REG = window.SB_REGISTRO, V = window.SB_VALIDATE;

    // 1) resolver IDs por códigos estables (nunca hardcodear)
    const edition = await CAT.getActiveEdition();
    const edcats  = await CAT.getEditionCategories(edition.id);
    const facultyId = await CAT.resolveFacultyId(payloadForm.academicStage);
    let careerId = null;
    if (payloadForm.academicStage === 'INGENIERIA' && payloadForm.career){
      careerId = await CAT.resolveCareerId(facultyId, payloadForm.career);
    }
    // CONSERVAR flags: registration.js los convierte en review_flags[].
    // woodPaddle se conserva como metadato de la clasificación; la regla
    // REPRESENTATIVE ya viaja como bandera y como respuesta explícita.
    const sc = {
      category: payloadForm.provisionalCategory,
      reasons: payloadForm.provisionalReasons || [],
      requiresManualReview: payloadForm.requiresManualReview === true,
      flags: payloadForm.provisionalFlags || [],
      woodPaddle: payloadForm.provisionalWoodPaddle === true
    };
    const rpcPayload = REG.buildPayload(payloadForm, sc, { edition, edcats, facultyId, careerId });

    // 2) validación central previa (además de la validación por pasos de la UI)
    const errs = V.validateSubmission({
      nickname: rpcPayload.nickname, phone: rpcPayload.phone,
      faculty_id: rpcPayload.faculty_id, career_id: rpcPayload.career_id,
      requiresCareer: payloadForm.academicStage === 'INGENIERIA',
      consent_rules: rpcPayload.consent_rules, consent_data: rpcPayload.consent_data,
      consent_public_contact: rpcPayload.consent_public_contact
    });
    if (errs.length){
      const e = new Error(errs[0].msg);
      e.friendly = errs[0].msg;
      throw e;
    }

    // 3) RPC (idempotente por submission_id persistente)
    let data;
    try {
      data = await REG.submit(rpcPayload);
    } catch(err){
      const code = window.SB_LOG ? window.SB_LOG.error('REG-001', err) : 'REG-001';
      const e = new Error(REG.translateError(err) + ' (código ' + code + ')');
      e.friendly = e.message;
      e.original = err;
      throw e;   // NO limpiar submission_id: el reintento reusa el mismo
    }

    if (!data || data.ok !== true){
      const e = new Error('Respuesta inesperada del servidor (código REG-002).');
      e.friendly = e.message;
      throw e;
    }

    // 4) éxito → marcar completado (se conserva el folio para recuperación)
    REG.markDone(data.public_code);

    return {
      ok: true,
      folio: data.public_code,
      publicToken: data.public_code,
      createdAt: new Date().toISOString(),
      entry_status: data.entry_status || null,
      requires_review: data.requires_review === true,
      idempotent: data.idempotent === true
    };
  };

  // ── Pantalla de recuperación de envíos ────────────────────────────────
  function recoveryBanner(){
    const rec = window.SB_REGISTRO && window.SB_REGISTRO.getRecord();
    if (!rec) return;
    const host = document.querySelector('.grid') || document.body;
    const el = document.createElement('div');
    el.id = 'regRecovery';
    el.setAttribute('role','status');
    el.style.cssText = 'grid-column:1/-1;background:linear-gradient(180deg,#1d1d23,#17171c);'+
      'border:1px solid rgba(201,180,138,0.4);border-radius:10px;padding:14px 16px;'+
      'font-size:13.5px;line-height:1.5;color:#f4f4f6;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
    const txt = document.createElement('span');
    txt.style.flex = '1'; txt.style.minWidth = '220px';
    const btns = document.createElement('span');
    btns.style.cssText = 'display:flex;gap:8px';
    function mkBtn(label){
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'font:700 12px/1 "HN Display","Saira Condensed",sans-serif;letter-spacing:0.06em;'+
        'text-transform:uppercase;padding:10px 14px;border-radius:7px;border:1px solid rgba(235,236,242,0.2);'+
        'background:#2a2a31;color:#f4f4f6;cursor:pointer;min-height:44px';
      return b;
    }
    if (rec.status === 'done' && rec.folio){
      txt.innerHTML = 'Tu preinscripción ya fue enviada. Folio: <b style="color:#e9d8aa">' + String(rec.folio).replace(/[<>&]/g,'') + '</b>.';
      const ok = mkBtn('Entendido');
      ok.onclick = () => { window.SB_REGISTRO.clearSubmissionId(); el.remove(); };
      btns.appendChild(ok);
    } else if (rec.status === 'pending'){
      txt.textContent = 'Parece que ya intentaste enviar esta inscripción. Si reintentas con los mismos datos se usará el mismo identificador y no se duplicará. Si crees que ya quedó registrada, escribe a la organización antes de volver a enviarla.';
      // NO hay botón "Empezar de cero": borrar el submission_id tras un envío
      // pendiente o ambiguo es lo que produce inscripciones duplicadas.
      const retry = mkBtn('Reintentar igual');
      retry.onclick = () => { el.remove(); };
      btns.appendChild(retry);
    } else return;
    el.appendChild(txt); el.appendChild(btns);
    host.insertBefore(el, host.firstChild);
  }

  // ── Comprobante imprimible (sin librerías) ────────────────────────────
  window.SB_COMPROBANTE = function(){
    const g = id => { const n = document.getElementById(id); return n ? n.textContent : '—'; };
    const okMsg = document.getElementById('okMsg');
    const w = window.open('', '_blank', 'width=620,height=760');
    if (!w) return;
    const esc = s => String(s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de preinscripción</title>'+
      '<style>body{font:14px/1.6 system-ui,sans-serif;color:#1a1a1e;max-width:460px;margin:40px auto;padding:0 20px}'+
      'h1{font-size:19px;text-transform:uppercase;letter-spacing:0.04em}dl{border:1px solid #ccc;border-radius:8px;padding:16px 18px}'+
      'dt{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#777;margin-top:10px}dt:first-child{margin-top:0}'+
      'dd{margin:2px 0 0;font-weight:700;font-size:16px}p{color:#444;font-size:13px}@media print{button{display:none}}</style></head><body>'+
      '<h1>Torneo de Ping Pong FI · Comprobante de preinscripción</h1>'+
      '<dl><dt>Participante</dt><dd>' + esc(g('tkName')) + '</dd>'+
      '<dt>Folio</dt><dd>' + esc(g('tkFolio')) + '</dd>'+
      '<dt>Categoría provisional</dt><dd>' + esc(g('tkCat')) + '</dd>'+
      '<dt>Fecha de registro</dt><dd>' + esc(g('tkDate')) + '</dd></dl>'+
      '<p>' + esc(okMsg ? okMsg.textContent : '') + '</p>'+
      '<p>Guarda este comprobante. Tu lugar se confirma con el pago y la confirmación de la organización.</p>'+
      '<button onclick="window.print()">Imprimir / guardar PDF</button></body></html>');
    w.document.close();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recoveryBanner);
  else recoveryBanner();
})();
