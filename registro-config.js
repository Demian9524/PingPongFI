// ── Configuración centralizada del registro ─────────────────────────────
// Único lugar editable para fechas, costo, cupos, categorías y enlaces.
//
// ⚠ PLACEHOLDERS — valores provisionales que DEBEN confirmarse antes de abrir
//   el registro. Están marcados uno por uno con `placeholder: true` en
//   REGISTRO_CONFIG.pending y con el comentario «PLACEHOLDER» en su línea.
//   El formulario funciona con ellos, pero muestran datos que no son oficiales.

window.REGISTRO_CONFIG = {
  // — Metadatos del torneo —
  tournamentName: '3.er Torneo de Ping Pong FI',
  edition: 'Tercera edición · 2027-1',
  timezone: 'America/Mexico_City',

  // — Costo de inscripción —
  // Se muestra en la página y en el comprobante. Se define en MXN enteros.
  cost: 35,                                    // CONFIRMADO · 35 MXN por participante
  currency: 'MXN',

  // — Enlaces —
  // CONFIRMADO · grupo oficial de la comunidad.
  whatsappUrl: 'https://chat.whatsapp.com/KlF6bCXvd9VLAqaO8bJBBU',
  reglamentoUrl: '#reglamento',                // OK · abre el modal de reglas

  // — Fechas (YYYY-MM-DD, zona America/Mexico_City) —
  registrationOpen:  '2026-06-15',             // PLACEHOLDER · confirmar apertura
  registrationClose: '2026-08-15',             // PLACEHOLDER · confirmar cierre
  tournamentStart:   '2026-08-17',             // PLACEHOLDER · confirmar inicio
  tournamentEnd:     '2026-08-23',             // PLACEHOLDER · confirmar fin

  // El sorteo es 100% presencial: el formulario NO pide horarios ni
  // disponibilidad, y nada de eso influye en grupos, bombos ni bracket.

  // — Categorías — únicas tres oficiales; NO existe Novato —
  categories: [
    { id: 'PRINCIPIANTE',  label: 'Principiante',    color: '#37bb66' },
    { id: 'INTERMEDIO',    label: 'Intermedio',      color: '#3a63f0' },
    { id: 'AVANZADO_OPEN', label: 'Avanzado / Open', color: '#dd3b2c' }
  ],
  // Cupos por categoría — informativo, la cifra real la fija edition_categories
  cuposByCategory: {
    PRINCIPIANTE: 24,                          // PLACEHOLDER · confirmar cupo
    INTERMEDIO: 24,                            // PLACEHOLDER · confirmar cupo
    AVANZADO_OPEN: 16                          // PLACEHOLDER · confirmar cupo
  },

  // — Inventario de placeholders (para revisarlos de un vistazo) —
  // `true` = valor provisional. Cambiar a `false` al confirmarlo.
  pending: {
    cost: false,                               // 35 MXN confirmado
    whatsappUrl: false,
    registrationOpen: true,
    registrationClose: true,
    tournamentStart: true,
    tournamentEnd: true,
    cuposByCategory: true
  }
};

// Aviso en consola mientras queden placeholders (no afecta a la UI).
(function(){
  const p = window.REGISTRO_CONFIG.pending || {};
  const abiertos = Object.keys(p).filter(k => p[k] === true);
  if (abiertos.length) console.info('[registro-config] valores provisionales pendientes de confirmar:', abiertos.join(', '));
})();
