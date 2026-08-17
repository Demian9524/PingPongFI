// ── Datos del torneo por categoría ──────────────────────────────────────
// Formato: pasan los 2 primeros de cada grupo + los mejores terceros, hasta
// llenar el bracket. Avanzado = 3 grupos → Cuartos (8). Intermedio y
// Principiante = 6 grupos → Octavos (16).

// Plantillas de desempeño (rank 1→4 dentro del grupo)
const TPL = [
  [{ pj: 3, pg: 3, pp: 0, sf: 6, sc: 1, pts: 9 }, { pj: 3, pg: 2, pp: 1, sf: 5, sc: 3, pts: 6 }, { pj: 3, pg: 1, pp: 2, sf: 3, sc: 4, pts: 3 }, { pj: 3, pg: 0, pp: 3, sf: 1, sc: 6, pts: 0 }],
  [{ pj: 3, pg: 3, pp: 0, sf: 6, sc: 2, pts: 9 }, { pj: 3, pg: 2, pp: 1, sf: 5, sc: 4, pts: 6 }, { pj: 3, pg: 1, pp: 2, sf: 4, sc: 5, pts: 3 }, { pj: 3, pg: 0, pp: 3, sf: 2, sc: 6, pts: 0 }],
  [{ pj: 3, pg: 3, pp: 0, sf: 6, sc: 3, pts: 9 }, { pj: 3, pg: 2, pp: 1, sf: 6, sc: 4, pts: 6 }, { pj: 3, pg: 1, pp: 2, sf: 4, sc: 4, pts: 3 }, { pj: 3, pg: 0, pp: 3, sf: 1, sc: 6, pts: 0 }],
  [{ pj: 3, pg: 3, pp: 0, sf: 6, sc: 0, pts: 9 }, { pj: 3, pg: 2, pp: 1, sf: 4, sc: 3, pts: 6 }, { pj: 3, pg: 1, pp: 2, sf: 3, sc: 5, pts: 3 }, { pj: 3, pg: 0, pp: 3, sf: 2, sc: 6, pts: 0 }],
];

const POOLS = {
  avanzado: [
    ['D. "Profe" Ramírez', 'A. "Tornado" López', 'M. "Pulpo" Morales', 'R. Beltrán'],
    ['C. Bermúdez', 'E. Quintero', 'A. Cabrera', 'J. Núñez'],
    ['S. Vega', 'H. Cordero', 'R. Soto', 'P. Aguilar'],
  ],
  intermedio: [
    ['G. Salas', 'M. Ortega', 'L. Fuentes', 'D. Ríos'],
    ['F. Campos', 'I. Mendoza', 'O. Rivas', 'T. Lara'],
    ['B. Navarro', 'K. Herrera', 'N. Peña', 'V. Castro'],
    ['J. Bravo', 'A. Domínguez', 'R. Cano', 'S. Vargas'],
    ['P. Solís', 'E. Macías', 'C. Reyna', 'M. Gallardo'],
    ['L. Téllez', 'D. Acosta', 'F. Ibarra', 'H. Pacheco'],
  ],
  principiante: [
    ['A. García', 'V. Cruz', 'J. Mora', 'D. Sandoval'],
    ['R. Salazar', 'J. Ramírez', 'F. Rodríguez', 'M. Sánchez'],
    ['E. Pérez', 'G. Flores', 'N. Romero', 'T. Vázquez'],
    ['C. Luna', 'P. Espinoza', 'A. Rojas', 'B. Maldonado'],
    ['S. Carrillo', 'D. Fierro', 'L. Otero', 'R. Mejía'],
    ['M. Cervantes', 'J. Valdez', 'K. Ponce', 'E. Galván'],
  ],
};

function buildGroup(letter, names, seed) {
  const t = TPL[seed % TPL.length];
  const players = names.map((n, i) => ({
    n, rank: i + 1, ...t[i], dif: t[i].sf - t[i].sc,
  }));
  return { letter, name: 'GRUPO ' + letter, players };
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function buildCategory(key, label, nGroups, bracketSize) {
  const groups = [];
  for (let i = 0; i < nGroups; i++) {
    groups.push(buildGroup(LETTERS[i], POOLS[key][i], i + (key === 'principiante' ? 1 : key === 'intermedio' ? 2 : 0)));
  }
  // mejores terceros: ordenar todos los 3.º por pts, luego dif, luego sf
  const thirds = groups.map(g => ({ ...g.players[2], grp: g.letter }))
    .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.sf - a.sf);
  const directQual = bracketSize - (bracketSize / 2 - nGroups < 0 ? 0 : 0);
  // nº de terceros que entran = bracketSize - 2*nGroups
  const thirdsIn = bracketSize - 2 * nGroups;
  thirds.forEach((t, i) => { t.in = i < thirdsIn; t.pos = i + 1; });

  // sembrar bracket: 1.º de grupos (semilla alta), luego 2.º, luego terceros que entran
  const firsts = groups.map((g, i) => ({ name: g.players[0].n, seedTag: '1° ' + g.letter, src: 'first' }));
  const seconds = groups.map((g, i) => ({ name: g.players[1].n, seedTag: '2° ' + g.letter, src: 'second' }));
  const thirdSeeds = thirds.filter(t => t.in).map(t => ({ name: t.n, seedTag: '3° MEJOR', src: 'third' }));
  let seeded = [...firsts, ...seconds, ...thirdSeeds];
  // emparejar 1 vs último, etc.
  const matchups = [];
  const half = seeded.length / 2;
  for (let i = 0; i < half; i++) {
    matchups.push([seeded[i], seeded[seeded.length - 1 - i]]);
  }

  return { key, label, nGroups, bracketSize, groups, thirds, thirdsIn, matchups, nPlayers: nGroups * 4 };
}

const CATS_DATA = {
  avanzado:     buildCategory('avanzado', 'Avanzados', 3, 8),
  intermedio:   buildCategory('intermedio', 'Intermedios', 6, 16),
  principiante: buildCategory('principiante', 'Principiantes', 6, 16),
};

// próximos partidos y top jugadores derivados por categoría
function deriveExtras(cat) {
  const all = [];
  cat.groups.forEach(g => g.players.forEach(p => all.push({ ...p, grp: g.letter })));
  const top = [...all].sort((a, b) => b.pts - a.pts || b.dif - a.dif).slice(0, 5);
  // próximos: tomar pares de la primera ronda del bracket
  const horas = ['10:00 AM', '11:30 AM', '1:00 PM'];
  const mesas = ['Mesa 1', 'Mesa 2', 'Mesa 1'];
  const next = cat.matchups.slice(0, 3).map((m, i) => ({
    t: horas[i], table: mesas[i], a: m[0].name, b: m[1].name,
    round: cat.bracketSize === 16 ? 'Octavos' : 'Cuartos',
  }));
  return { top, next };
}

window.TOURNAMENT = { CATS_DATA, deriveExtras };
