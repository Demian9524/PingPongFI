// ── Validación y utilidades puras (testeables) ──────────────────────────
// Sin dependencias del DOM. Usado por el formulario, directorio, admin y
// las pruebas unitarias (tests/).
//
// window.SB_VALIDATE (navegador) / module.exports (vitest)

(function(global){
  'use strict';

  function stripAccents(s){
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function normText(s){
    return stripAccents(s).toLowerCase().replace(/\s+/g,' ').trim();
  }

  // — Teléfono mexicano: 10 dígitos; acepta +52/52 al frente —
  function normalizePhone(raw){
    let d = String(raw || '').replace(/\D/g,'');
    if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
    if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
    return d;
  }
  function isValidPhone(raw){
    const d = normalizePhone(raw);
    return d.length === 10 && !/^0{10}$/.test(d);
  }
  function formatPhoneE164(raw){
    return isValidPhone(raw) ? '+52' + normalizePhone(raw) : null;
  }

  // — Apodo: 2–40 caracteres visibles, sin HTML —
  function isValidNickname(s){
    const t = String(s || '').trim();
    return t.length >= 2 && t.length <= 40 && !/[<>]/.test(t);
  }
  function sanitizeText(s, max){
    return String(s || '').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0, max || 400);
  }

  // — Huella estable del intento de inscripción (idempotencia) —
  function fingerprint(fields){
    return [
      normalizePhone(fields.phone),
      normText(fields.nickname),
      String(fields.editionCategoryId ?? '')
    ].join('|');
  }

  // — Validación del payload previo al envío —
  function validateSubmission(p){
    const errs = [];
    if (!isValidNickname(p.nickname)) errs.push({ field:'nickname', msg:'Escribe un apodo de 2 a 40 caracteres, sin símbolos < >.' });
    if (!isValidPhone(p.phone)) errs.push({ field:'phone', msg:'El teléfono debe tener 10 dígitos de México.' });
    if (!p.faculty_id) errs.push({ field:'faculty', msg:'Selecciona tu facultad o escuela.' });
    if (p.requiresCareer && !p.career_id) errs.push({ field:'career', msg:'Selecciona tu carrera.' });
    if (!p.consent_rules) errs.push({ field:'consent', msg:'Debes aceptar el reglamento.' });
    if (!p.consent_data) errs.push({ field:'consent', msg:'Debes aceptar el tratamiento de datos.' });
    if (!p.consent_public_contact) errs.push({ field:'consent', msg:'Debes aceptar el directorio público de contacto.' });
    return errs;
  }

  // — WhatsApp: solo URLs wa.me válidas —
  function safeWhatsappUrl(u){
    const s = String(u || '');
    return /^https:\/\/wa\.me\/\d{6,15}(\?[\w=&%+.-]*)?$/.test(s) ? s : null;
  }

  // — Enmascarado de claves para reportes —
  function maskKey(k){
    const s = String(k || '');
    if (!s) return '(sin clave)';
    return s.slice(0, 15) + '****' + s.slice(-4);
  }

  // — Escape CSV (RFC 4180) —
  function csvEscape(v){
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }
  function toCSV(rows, cols, headers){
    const head = (headers || cols).map(csvEscape).join(',');
    const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\r\n');
    return '\ufeff' + head + '\r\n' + body;   // BOM UTF-8
  }

  // — Filtro del directorio (puro, testeable) —
  function filterDirectory(rows, f){
    const q = normText(f.q || '');
    return (rows || []).filter(r =>
      (!q || normText(r.nickname).includes(q)) &&
      (!f.cat || r.category_code === f.cat) &&
      (!f.grp || r.group_label === f.grp) &&
      (!f.entry || r.entry_status === f.entry)
    ).sort((a, b) =>
      String(a.group_label || 'zz').localeCompare(String(b.group_label || 'zz')) ||
      normText(a.nickname).localeCompare(normText(b.nickname))
    );
  }

  const api = {
    stripAccents, normText, normalizePhone, isValidPhone, formatPhoneE164,
    isValidNickname, sanitizeText, fingerprint, validateSubmission,
    safeWhatsappUrl, maskKey, csvEscape, toCSV, filterDirectory
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_VALIDATE = api;
})(typeof window !== 'undefined' ? window : globalThis);
