// Datos del torneo "Copa Concreto" — Facultad de Ingeniería UNAM
// Categorías por nivel: AVANZADO (rojo), INTERMEDIO (azul), PRINCIPIANTE (verde)

const TOURNAMENT = {
  name: 'COPA CONCRETO',
  edition: 'XII edición',
  year: '2026',
  venue: 'Mesas del Anexo · Facultad de Ingeniería',
  motto: 'Mesa de cemento · Pala y temple',
};

// Paleta categorías (con variantes para gradientes y elementos colorblock)
const CATS = {
  AV: { k: 'AV', name: 'Avanzado',     emoji: '★★★', color: '#e63946', dark: '#9b1c2a', deep: '#5a0f18', light: '#ffb3bb', soft: '#3a1f24', glow: 'rgba(230,57,70,0.35)' },
  IN: { k: 'IN', name: 'Intermedio',   emoji: '★★',  color: '#3b82f6', dark: '#1d4ed8', deep: '#0f2a6b', light: '#bfdbfe', soft: '#1e2a44', glow: 'rgba(59,130,246,0.35)' },
  PR: { k: 'PR', name: 'Principiante', emoji: '★',   color: '#22c55e', dark: '#15803d', deep: '#0a3d1f', light: '#bbf7d0', soft: '#1d3528', glow: 'rgba(34,197,94,0.35)' },
};

const GROUPS = {
  // Avanzado
  AV_A: { cat: 'AV', name: 'GRUPO A · AVANZADO', players: [
    { n: 'D. "Profe" Ramírez',  fac: 'Computación',         pj: 3, pg: 3, pp: 0, sf: 9, sc: 2, pts: 9 },
    { n: 'A. "Tornado" López',  fac: 'Mecatrónica',         pj: 3, pg: 2, pp: 1, sf: 7, sc: 4, pts: 6 },
    { n: 'M. "Pulpo" Morales',  fac: 'Eléctrica',           pj: 3, pg: 1, pp: 2, sf: 4, sc: 7, pts: 3 },
    { n: '"Chino" Pérez',       fac: 'Civil',               pj: 3, pg: 0, pp: 3, sf: 2, sc: 8, pts: 0 },
  ]},
  AV_B: { cat: 'AV', name: 'GRUPO B · AVANZADO', players: [
    { n: 'Carlos Bermúdez',     fac: 'Petrolera',           pj: 3, pg: 3, pp: 0, sf: 9, sc: 3, pts: 9 },
    { n: 'Esteban Quintero',    fac: 'Industrial',          pj: 3, pg: 2, pp: 1, sf: 6, sc: 5, pts: 6 },
    { n: 'Andrés Cabrera',      fac: 'Minas',               pj: 3, pg: 1, pp: 2, sf: 4, sc: 6, pts: 3 },
    { n: 'Felipe Torres',       fac: 'Geofísica',           pj: 3, pg: 0, pp: 3, sf: 2, sc: 7, pts: 0 },
  ]},
  // Intermedio
  IN_A: { cat: 'IN', name: 'GRUPO A · INTERMEDIO', players: [
    { n: 'Sofía Vega',          fac: 'Computación',         pj: 3, pg: 3, pp: 0, sf: 9, sc: 4, pts: 9 },
    { n: 'Camila "Gata" Ortiz', fac: 'Telecomunicaciones',  pj: 3, pg: 2, pp: 1, sf: 7, sc: 5, pts: 6 },
    { n: 'Renata Soto',         fac: 'Civil',               pj: 3, pg: 1, pp: 2, sf: 5, sc: 6, pts: 3 },
    { n: 'Daniel Suárez',       fac: 'Mecánica',            pj: 3, pg: 0, pp: 3, sf: 3, sc: 8, pts: 0 },
  ]},
  IN_B: { cat: 'IN', name: 'GRUPO B · INTERMEDIO', players: [
    { n: 'Valeria Cano',        fac: 'Geomática',           pj: 2, pg: 2, pp: 0, sf: 6, sc: 1, pts: 6 },
    { n: 'Julián Reyes',        fac: 'Industrial',          pj: 2, pg: 1, pp: 1, sf: 4, sc: 3, pts: 3 },
    { n: 'Tomás Bravo',         fac: 'Petrolera',           pj: 2, pg: 1, pp: 1, sf: 3, sc: 4, pts: 3 },
    { n: 'David Cruz',          fac: 'Eléctrica',           pj: 2, pg: 0, pp: 2, sf: 1, sc: 6, pts: 0 },
  ]},
  // Principiante
  PR_A: { cat: 'PR', name: 'GRUPO A · PRINCIPIANTE', players: [
    { n: 'Luna Herrera',        fac: 'Computación',         pj: 3, pg: 3, pp: 0, sf: 9, sc: 1, pts: 9 },
    { n: 'Diana Castro',        fac: 'Biomédica',           pj: 3, pg: 2, pp: 1, sf: 7, sc: 4, pts: 6 },
    { n: 'Miguel Aguilar',      fac: 'Civil',               pj: 3, pg: 1, pp: 2, sf: 4, sc: 6, pts: 3 },
    { n: 'Paula Mejía',         fac: 'Industrial',          pj: 3, pg: 0, pp: 3, sf: 2, sc: 7, pts: 0 },
  ]},
  PR_B: { cat: 'PR', name: 'GRUPO B · PRINCIPIANTE', players: [
    { n: 'Mateo Vásquez',       fac: 'Mecatrónica',         pj: 3, pg: 3, pp: 0, sf: 9, sc: 2, pts: 9 },
    { n: 'Isabela Rincón',      fac: 'Geomática',           pj: 3, pg: 2, pp: 1, sf: 6, sc: 5, pts: 6 },
    { n: 'Joaquín Beltrán',     fac: 'Minas',               pj: 3, pg: 1, pp: 2, sf: 4, sc: 6, pts: 3 },
    { n: 'Sara Gómez',          fac: 'Ambiental',           pj: 3, pg: 0, pp: 3, sf: 2, sc: 7, pts: 0 },
  ]},
};

const LIVE_MATCH = {
  status: 'EN VIVO',
  cat: 'AV',
  group: 'GRUPO A · AVANZADO',
  set: 'SET 3',
  table: 'Mesa 3',
  startedAgo: '32:14',
  p1: { n: 'A. "Tornado" López', fac: 'Mecatrónica', sets: 1, score: 8, odd: 1.42, form: 'WWLWW' },
  p2: { n: 'D. "Profe" Ramírez', fac: 'Computación', sets: 1, score: 6, odd: 2.75, form: 'WWWLW' },
  history: [
    { s: 1, a: 11, b: 8 },
    { s: 2, a: 9,  b: 11 },
    { s: 3, a: 8,  b: 6, live: true },
  ],
  watching: 142,
  totalBet: 318600,
  pctOnP1: 67,
};

const FEATURED = [
  { id: 'm1', cat: 'AV', live: true, set: 'Set 3', p1: 'A. López',  p2: 'D. Ramírez',   odds: [1.42, 0, 2.75], pct: 67, watchers: 142, group: 'Grupo A' },
  { id: 'm2', cat: 'IN', live: true, set: 'Set 2', p1: 'S. Vega',   p2: 'C. Ortiz',     odds: [1.85, 0, 1.95], pct: 51, watchers: 88,  group: 'Grupo A' },
  { id: 'm3', cat: 'PR', live: true, set: 'Set 1', p1: 'L. Herrera', p2: 'D. Castro',    odds: [2.30, 0, 1.65], pct: 33, watchers: 41,  group: 'Grupo A' },
];

const UPCOMING_AV = [
  { time: '30 min', cat: 'AV', p1: 'C. Bermúdez',    p2: 'E. Quintero',   odds: [1.55, 3.60, 2.30], pct: 62, group: 'Grupo B' },
  { time: '1h 15m', cat: 'AV', p1: '"Chino" Pérez',  p2: '"Pulpo" Morales', odds: [2.10, 3.40, 1.75], pct: 41, group: 'Grupo A' },
  { time: '2h',     cat: 'AV', p1: 'A. Cabrera',     p2: 'F. Torres',     odds: [1.40, 3.80, 2.90], pct: 75, group: 'Grupo B' },
];

const UPCOMING_IN = [
  { time: '45 min', cat: 'IN', p1: 'V. Cano',        p2: 'J. Reyes',      odds: [1.50, 3.70, 2.45], pct: 70, group: 'Grupo B' },
  { time: '1h 30m', cat: 'IN', p1: 'R. Soto',        p2: 'D. Suárez',     odds: [1.70, 3.50, 2.05], pct: 58, group: 'Grupo A' },
  { time: '2h 30m', cat: 'IN', p1: 'T. Bravo',       p2: 'D. Cruz',       odds: [1.85, 3.30, 1.95], pct: 49, group: 'Grupo B' },
];

const UPCOMING_PR = [
  { time: '1h',     cat: 'PR', p1: 'M. Vásquez',     p2: 'I. Rincón',     odds: [1.40, 3.80, 2.90], pct: 78, group: 'Grupo B' },
  { time: '1h 45m', cat: 'PR', p1: 'M. Aguilar',     p2: 'P. Mejía',      odds: [1.75, 3.50, 2.00], pct: 55, group: 'Grupo A' },
  { time: '3h',     cat: 'PR', p1: 'J. Beltrán',     p2: 'S. Gómez',      odds: [1.50, 3.65, 2.50], pct: 67, group: 'Grupo B' },
];

const BET_SLIP = [
  { match: 'López vs Ramírez', cat: 'AV', pick: '"Tornado" López gana', type: 'Ganador', odd: 1.42, amount: 25000 },
  { match: 'Vega vs Ortiz',    cat: 'IN', pick: 'Sofía Vega gana 3-1',  type: 'Exacto',  odd: 4.20, amount: 10000 },
];

// Combined for vintage view (kept time-style hour labels)
const UPCOMING = [
  { time: '14:00', group: 'AV-A', p1: 'Profe Ramírez',  p2: 'A. López',     odds: [1.65, 3.40, 2.10] },
  { time: '14:45', group: 'AV-B', p1: 'C. Bermúdez',    p2: 'E. Quintero',  odds: [1.55, 3.60, 2.30] },
  { time: '15:30', group: 'IN-A', p1: 'S. Vega',        p2: 'C. Ortiz',     odds: [1.85, 3.30, 1.95] },
  { time: '16:15', group: 'PR-A', p1: 'L. Herrera',     p2: 'D. Castro',    odds: [1.70, 3.50, 2.05] },
  { time: '17:00', group: 'IN-B', p1: 'V. Cano',        p2: 'J. Reyes',     odds: [1.50, 3.70, 2.45] },
  { time: '17:45', group: 'PR-B', p1: 'M. Vásquez',     p2: 'I. Rincón',    odds: [1.40, 3.80, 2.90] },
  { time: '18:30', group: 'AV-A', p1: '"Chino" Pérez',  p2: '"Pulpo" Morales', odds: [2.10, 3.40, 1.75] },
];

Object.assign(window, { TOURNAMENT, CATS, GROUPS, LIVE_MATCH, FEATURED, UPCOMING, UPCOMING_AV, UPCOMING_IN, UPCOMING_PR, BET_SLIP });
