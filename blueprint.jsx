// Dirección C · "Pizarrón Técnico" — estética de plano de ingeniería
// Papel concreto + retícula fina, tinta negra, rojo FI como único acento.
// Enfoque 100% torneo: marcador, grupos, MEJORES TERCEROS y llaves como
// esquema técnico. Las apuestas viven como una nota lateral discreta.

const bpStyles = {
  paper:   '#e9e6df',
  paper2:  '#f2efe9',
  ink:     '#1b1a17',
  ink2:    '#4a473f',
  faint:   '#8c887d',
  line:    'rgba(27,26,23,0.16)',
  lineSoft:'rgba(27,26,23,0.08)',
  red:     '#c4202e',
  redDeep: '#8f1620',
  display: '"Space Grotesk", system-ui, sans-serif',
  cond:    '"Barlow Condensed", "Archivo", sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
};

// Fine engineering grid as a tiling SVG
const bpGrid = `url("data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%231b1a17' stroke-opacity='0.05'%3E%3Cpath d='M0 0H80V80' /%3E%3Cpath d='M16 0V80M32 0V80M48 0V80M64 0V80M0 16H80M0 32H80M0 48H80M0 64H80' stroke-opacity='0.035'/%3E%3C/g%3E%3C/svg%3E")`;

function BPSheet({ children, sheetNo, title }) {
  return (
    <div style={{ width: '100%', height: '100%', background: bpStyles.paper, backgroundImage: bpGrid, fontFamily: bpStyles.display, color: bpStyles.ink, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* drawing border */}
      <div style={{ position: 'absolute', inset: 14, border: `1.5px solid ${bpStyles.ink}`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 20, border: `1px solid ${bpStyles.line}`, pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

// Category tick — small square swatch + code
function BPCat({ k, withName = false }) {
  const c = CATS[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: bpStyles.mono, fontSize: 11, letterSpacing: 0.5, color: bpStyles.ink2 }}>
      <span style={{ width: 9, height: 9, background: c.color, display: 'inline-block', boxShadow: `0 0 0 1px ${bpStyles.ink}` }} />
      {withName ? c.name.toUpperCase() : c.k}
    </span>
  );
}

function BPLabel({ children, style }) {
  return <div style={{ fontFamily: bpStyles.mono, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: bpStyles.faint, ...style }}>{children}</div>;
}

// ── Title block (like an engineering drawing legend) ────────────────────
function BPTitleBlock() {
  return (
    <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 92, borderBottom: `1.5px solid ${bpStyles.ink}`, display: 'flex', alignItems: 'stretch' }}>
      <div style={{ width: 92, borderRight: `1px solid ${bpStyles.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 52, height: 52, border: `2px solid ${bpStyles.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bpStyles.display, fontWeight: 700, fontSize: 22, color: bpStyles.red, letterSpacing: -1 }}>FI</div>
      </div>
      <div style={{ flex: 1, padding: '0 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 34, letterSpacing: -1.2, lineHeight: 0.95 }}>COPA CONCRETO</div>
        <div style={{ fontFamily: bpStyles.mono, fontSize: 11, letterSpacing: 1.5, color: bpStyles.ink2, marginTop: 4 }}>TORNEO DE TENIS DE MESA · FAC. INGENIERÍA · XII EDICIÓN — 2026</div>
      </div>
      {/* legend cells */}
      <div style={{ width: 360, borderLeft: `1px solid ${bpStyles.line}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        {[
          ['HOJA', 'P-01 / GENERAL'],
          ['ESCALA', '1:1 — EN VIVO'],
          ['JUGADORES', '24 · 3 NIVELES'],
          ['FORMATO', '2 DIRECTOS + 3.º'],
        ].map(([k, v], i) => (
          <div key={k} style={{ padding: '8px 14px', borderRight: i % 2 === 0 ? `1px solid ${bpStyles.lineSoft}` : 'none', borderBottom: i < 2 ? `1px solid ${bpStyles.lineSoft}` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontFamily: bpStyles.mono, fontSize: 8.5, letterSpacing: 1.5, color: bpStyles.faint }}>{k}</span>
            <span style={{ fontFamily: bpStyles.mono, fontSize: 12, fontWeight: 700, color: bpStyles.ink, letterSpacing: 0.3 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live match — technical scoreboard ───────────────────────────────────
function BPLiveBoard() {
  const m = LIVE_MATCH;
  const c = CATS[m.cat];
  return (
    <div style={{ border: `1.5px solid ${bpStyles.ink}`, background: bpStyles.paper2, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${bpStyles.line}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: bpStyles.mono, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: bpStyles.red }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: bpStyles.red, boxShadow: `0 0 0 3px ${bpStyles.red}33` }} />EN VIVO
        </span>
        <span style={{ fontFamily: bpStyles.mono, fontSize: 11, color: bpStyles.ink2, letterSpacing: 0.5 }}>{m.set} · {m.table}</span>
        <div style={{ flex: 1 }} />
        <BPCat k={m.cat} withName />
        <span style={{ fontFamily: bpStyles.mono, fontSize: 11, color: bpStyles.faint }}>● {m.watching}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        {[m.p1, m.p2].map((p, idx) => (
          <React.Fragment key={idx}>
            {idx === 1 && (
              <div style={{ padding: '0 8px', textAlign: 'center', borderLeft: `1px solid ${bpStyles.lineSoft}`, borderRight: `1px solid ${bpStyles.lineSoft}` }}>
                <div style={{ fontFamily: bpStyles.mono, fontSize: 9, letterSpacing: 2, color: bpStyles.faint, paddingTop: 16 }}>SETS</div>
                <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 60, letterSpacing: -3, lineHeight: 0.9 }}>{m.p1.sets}<span style={{ color: bpStyles.faint, margin: '0 4px' }}>–</span>{m.p2.sets}</div>
                <div style={{ fontFamily: bpStyles.mono, fontSize: 22, fontWeight: 700, color: c.color, paddingBottom: 16 }}>{m.p1.score} : {m.p2.score}</div>
              </div>
            )}
            <div style={{ padding: '20px 22px', textAlign: idx === 0 ? 'left' : 'right' }}>
              <div style={{ fontFamily: bpStyles.mono, fontSize: 10, letterSpacing: 1.5, color: bpStyles.faint }}>{p.fac.toUpperCase()}</div>
              <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 25, letterSpacing: -0.8, lineHeight: 1.05, margin: '3px 0 8px' }}>{p.n}</div>
              <div style={{ display: 'inline-flex', gap: 4, justifyContent: idx === 0 ? 'flex-start' : 'flex-end' }}>
                {p.form.split('').map((r, i) => (
                  <span key={i} style={{ width: 16, height: 16, fontFamily: bpStyles.mono, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r === 'W' ? '#fff' : bpStyles.ink2, background: r === 'W' ? bpStyles.ink : 'transparent', border: `1px solid ${bpStyles.line}` }}>{r === 'W' ? 'G' : 'P'}</span>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {/* sets ledger */}
      <div style={{ display: 'flex', borderTop: `1px solid ${bpStyles.line}`, fontFamily: bpStyles.mono, fontSize: 11 }}>
        {m.history.map(h => (
          <div key={h.s} style={{ flex: 1, padding: '7px 0', textAlign: 'center', borderRight: h.s < 3 ? `1px solid ${bpStyles.lineSoft}` : 'none', background: h.live ? `${c.color}1f` : 'transparent', color: h.live ? bpStyles.ink : bpStyles.ink2, fontWeight: h.live ? 700 : 400 }}>
            SET {h.s} · {h.a}–{h.b}{h.live ? ' ◂' : ''}
          </div>
        ))}
        {/* discreet odds note */}
        <div style={{ flex: 1.2, padding: '7px 14px', textAlign: 'right', color: bpStyles.faint, borderLeft: `1px solid ${bpStyles.line}` }}>
          PRONÓSTICO {m.pctOnP1}% / {100 - m.pctOnP1}% <span style={{ color: bpStyles.red }}>◷</span>
        </div>
      </div>
    </div>
  );
}

// ── Upcoming list (schedule rows) ───────────────────────────────────────
function BPSchedule() {
  const rows = UPCOMING.slice(0, 6);
  return (
    <div style={{ border: `1.5px solid ${bpStyles.ink}`, background: bpStyles.paper2 }}>
      <div style={{ padding: '9px 16px', borderBottom: `1px solid ${bpStyles.line}`, display: 'flex', alignItems: 'center' }}>
        <BPLabel>Calendario — próximos partidos</BPLabel>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: bpStyles.mono, fontSize: 10, color: bpStyles.faint }}>HOY</span>
      </div>
      {rows.map((r, i) => {
        const cat = r.group.slice(0, 2);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px 1fr auto', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${bpStyles.lineSoft}` : 'none' }}>
            <span style={{ fontFamily: bpStyles.mono, fontSize: 14, fontWeight: 700, color: bpStyles.ink }}>{r.time}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: bpStyles.display, fontSize: 14, fontWeight: 600, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p1} <span style={{ color: bpStyles.faint, fontWeight: 400 }}>vs</span> {r.p2}</div>
              <div style={{ fontFamily: bpStyles.mono, fontSize: 9.5, letterSpacing: 0.8, color: bpStyles.faint, marginTop: 1 }}>GRUPO {r.group}</div>
            </div>
            <BPCat k={CATS[cat] ? cat : 'AV'} />
          </div>
        );
      })}
    </div>
  );
}

// ── Group standings table (engineering ledger) ──────────────────────────
function BPGroupTable({ gk, compact = false }) {
  const g = GROUPS[gk];
  const c = CATS[g.cat];
  return (
    <div style={{ border: `1px solid ${bpStyles.line}`, background: bpStyles.paper2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: bpStyles.ink, color: bpStyles.paper }}>
        <span style={{ width: 9, height: 9, background: c.color, boxShadow: '0 0 0 1px rgba(255,255,255,0.4)' }} />
        <span style={{ fontFamily: bpStyles.cond, fontSize: 15, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{g.name}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 26px 26px 26px 30px', fontFamily: bpStyles.mono, fontSize: 9, letterSpacing: 0.5, color: bpStyles.faint, padding: '6px 12px', borderBottom: `1px solid ${bpStyles.lineSoft}` }}>
        <span>#</span><span>JUGADOR</span><span style={{ textAlign: 'center' }}>PJ</span><span style={{ textAlign: 'center' }}>PG</span><span style={{ textAlign: 'center' }}>DIF</span><span style={{ textAlign: 'right' }}>PTS</span>
      </div>
      {g.players.map((p, i) => {
        const qual = i < 2; const third = i === 2;
        return (
          <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 26px 26px 26px 30px', alignItems: 'center', fontFamily: bpStyles.mono, fontSize: 12, padding: '7px 12px', borderBottom: i < 3 ? `1px solid ${bpStyles.lineSoft}` : 'none', background: qual ? `${c.color}14` : 'transparent', position: 'relative' }}>
            {qual && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.color }} />}
            <span style={{ fontWeight: 700, color: qual ? bpStyles.ink : third ? bpStyles.ink2 : bpStyles.faint }}>{i + 1}</span>
            <span style={{ fontFamily: bpStyles.display, fontSize: 12.5, fontWeight: qual ? 700 : 500, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: bpStyles.ink }}>{p.n}{third && <span style={{ fontFamily: bpStyles.mono, fontSize: 8, color: bpStyles.red, marginLeft: 5, letterSpacing: 0.5 }}>3.º</span>}</span>
            <span style={{ textAlign: 'center', color: bpStyles.ink2 }}>{p.pj}</span>
            <span style={{ textAlign: 'center', color: bpStyles.ink2 }}>{p.pg}</span>
            <span style={{ textAlign: 'center', color: bpStyles.ink2 }}>{p.sf - p.sc > 0 ? '+' : ''}{p.sf - p.sc}</span>
            <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{p.pts}</span>
          </div>
        );
      })}
    </div>
  );
}

function BPHome() {
  return (
    <BPSheet>
      <BPTitleBlock />
      <div style={{ position: 'absolute', top: 132, left: 20, right: 20, bottom: 20, padding: '0 26px 22px', display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 24, overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div>
            <BPLabel style={{ marginBottom: 8 }}>Mesa central — transmisión</BPLabel>
            <BPLiveBoard />
          </div>
          <BPSchedule />
        </div>
        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div>
            <BPLabel style={{ marginBottom: 8 }}>Posiciones — vista rápida</BPLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <BPGroupTable gk="AV_A" />
              <BPGroupTable gk="IN_A" />
            </div>
          </div>
          {/* discreet betting note */}
          <div style={{ border: `1px dashed ${bpStyles.line}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, border: `1.5px solid ${bpStyles.red}`, color: bpStyles.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bpStyles.mono, fontSize: 14, flex: '0 0 auto' }}>◷</span>
            <div>
              <div style={{ fontFamily: bpStyles.display, fontSize: 13, fontWeight: 600 }}>Quiniela de la facu</div>
              <div style={{ fontFamily: bpStyles.mono, fontSize: 10, color: bpStyles.faint, letterSpacing: 0.3 }}>Predice resultados con fichas · opcional</div>
            </div>
          </div>
        </div>
      </div>
    </BPSheet>
  );
}

// ── Bracket sheet: best-thirds qualification + elimination schematic ─────
const BP_THIRDS = [
  { pos: 1, n: 'M. "Pulpo" Morales', grp: 'AV·A', pts: 3, dif: -3, in: true },
  { pos: 2, n: 'A. Cabrera',         grp: 'AV·B', pts: 3, dif: -2, in: true },
  { pos: 3, n: 'R. Soto',            grp: 'IN·A', pts: 3, dif: -1, in: false },
  { pos: 4, n: 'J. Beltrán',         grp: 'PR·B', pts: 3, dif: -2, in: false },
];

function BPBracketNode({ seed, name, tag, win, x, y, w }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, border: `1.5px solid ${win ? bpStyles.ink : bpStyles.line}`, background: win ? bpStyles.ink : bpStyles.paper2, color: win ? bpStyles.paper : bpStyles.ink, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ fontFamily: bpStyles.mono, fontSize: 9, fontWeight: 700, color: win ? bpStyles.paper : bpStyles.faint, width: 30, flex: '0 0 auto', lineHeight: 1 }}>{tag}</span>
      <span style={{ fontFamily: bpStyles.display, fontSize: 13, fontWeight: 600, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{name}</span>
    </div>
  );
}

function BPBracket() {
  // connector lines drawn with absolutely positioned divs
  const conn = (x, y, w, h) => <div key={`${x}-${y}-${w}-${h}`} style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderTop: w ? `1.5px solid ${bpStyles.line}` : 'none', borderLeft: h ? `1.5px solid ${bpStyles.line}` : 'none' }} />;
  const NW = 210, col1 = 360, col2 = 360 + 250, col3 = 360 + 500;
  const qf = [
    { y: 0, a: { tag: '1° A', n: 'D. "Profe" Ramírez', win: true }, b: { tag: '3° MEJOR', n: 'M. "Pulpo" Morales' } },
    { y: 130, a: { tag: '2° B', n: 'E. Quintero', win: true }, b: { tag: '3° MEJOR', n: 'A. Cabrera' } },
    { y: 300, a: { tag: '1° B', n: 'C. Bermúdez', win: true }, b: { tag: '2° A', n: 'A. "Tornado" López' } },
    { y: 430, a: { tag: '2° A', n: 'A. López', win: false }, b: { tag: '1° A', n: 'D. Ramírez', win: true } },
  ];
  return (
    <BPSheet>
      {/* mini title */}
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 64, borderBottom: `1.5px solid ${bpStyles.ink}`, display: 'flex', alignItems: 'center', padding: '0 26px', gap: 18 }}>
        <div style={{ width: 40, height: 40, border: `2px solid ${bpStyles.red}`, color: bpStyles.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: bpStyles.display, fontWeight: 700, fontSize: 17 }}>FI</div>
        <div>
          <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 22, letterSpacing: -0.8, lineHeight: 1 }}>FASE FINAL — AVANZADO</div>
          <div style={{ fontFamily: bpStyles.mono, fontSize: 10, letterSpacing: 1.2, color: bpStyles.ink2, marginTop: 2 }}>HOJA P-04 / LLAVES · CUARTOS → SEMIS → FINAL</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 18 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: bpStyles.mono, fontSize: 10, color: bpStyles.ink2 }}><span style={{ width: 14, height: 10, background: `${CATS.AV.color}30`, border: `1px solid ${bpStyles.line}` }} /> CLASIFICADO DIRECTO</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: bpStyles.mono, fontSize: 10, color: bpStyles.red }}><span style={{ width: 14, height: 10, border: `1px dashed ${bpStyles.red}` }} /> MEJOR TERCERO</span>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 104, left: 20, right: 20, bottom: 20, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0 }}>
        {/* Best thirds qualification panel */}
        <div style={{ borderRight: `1.5px solid ${bpStyles.ink}`, padding: '0 22px 0 26px', display: 'flex', flexDirection: 'column' }}>
          <BPLabel style={{ marginBottom: 4 }}>Clasificación de comodines</BPLabel>
          <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 26, letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>Mejores<br />terceros</div>
          <div style={{ fontFamily: bpStyles.mono, fontSize: 10, color: bpStyles.faint, lineHeight: 1.5, marginBottom: 16 }}>Los 3.º lugar de cada grupo se ordenan por puntos y diferencia de sets. Los 2 mejores entran a cuartos.</div>
          <div style={{ border: `1px solid ${bpStyles.line}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 34px 30px', fontFamily: bpStyles.mono, fontSize: 8.5, letterSpacing: 0.5, color: bpStyles.faint, padding: '6px 10px', borderBottom: `1px solid ${bpStyles.lineSoft}` }}>
              <span>#</span><span>JUGADOR</span><span style={{ textAlign: 'center' }}>GRP</span><span style={{ textAlign: 'right' }}>DIF</span>
            </div>
            {BP_THIRDS.map((t) => (
              <div key={t.pos} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 34px 30px', alignItems: 'center', fontFamily: bpStyles.mono, fontSize: 11, padding: '9px 10px', borderBottom: t.pos < 4 ? `1px solid ${bpStyles.lineSoft}` : 'none', background: t.in ? `${bpStyles.red}10` : 'transparent', position: 'relative' }}>
                {t.in && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: bpStyles.red }} />}
                <span style={{ fontWeight: 700, color: t.in ? bpStyles.red : bpStyles.faint }}>{t.pos}</span>
                <span style={{ fontFamily: bpStyles.display, fontSize: 12, fontWeight: t.in ? 700 : 500, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: bpStyles.ink }}>{t.n}</span>
                <span style={{ textAlign: 'center', color: bpStyles.ink2, fontSize: 9 }}>{t.grp}</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{t.dif}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, fontFamily: bpStyles.mono, fontSize: 9.5, color: bpStyles.ink2, alignItems: 'center' }}>
            <span style={{ color: bpStyles.red }}>▲</span> Se recalcula solo al cargar cada resultado.
          </div>
        </div>

        {/* Bracket schematic */}
        <div style={{ position: 'relative', padding: '14px 26px 0 30px', overflow: 'hidden' }}>
          {/* column labels */}
          {[['CUARTOS', col1], ['SEMIFINALES', col2], ['FINAL', col3]].map(([t, x]) => (
            <div key={t} style={{ position: 'absolute', left: x, top: 0, fontFamily: bpStyles.mono, fontSize: 9.5, letterSpacing: 2, color: bpStyles.faint }}>{t}</div>
          ))}
          <div style={{ position: 'absolute', left: 0, top: 28, right: 0, bottom: 0 }}>
            {/* QF nodes */}
            {qf.map((p, i) => (
              <React.Fragment key={i}>
                <BPBracketNode tag={p.a.tag} name={p.a.n} win={p.a.win} x={0} y={p.y} w={NW} />
                <BPBracketNode tag={p.b.tag} name={p.b.n} win={p.b.win} x={0} y={p.y + 36} w={NW} />
              </React.Fragment>
            ))}
            {/* connectors QF->SF */}
            {conn(NW, 20, 30, 0)}{conn(NW, 166, 30, 0)}
            {conn(NW + 30, 20, 0, 146)}{conn(NW + 30, 93, 30, 0)}
            {conn(NW, 320, 30, 0)}{conn(NW, 466, 30, 0)}
            {conn(NW + 30, 320, 0, 146)}{conn(NW + 30, 393, 30, 0)}
            {/* SF nodes */}
            <BPBracketNode tag="SF·1" name="D. Ramírez" win x={250} y={75} w={NW} />
            <BPBracketNode tag="SF·1" name="E. Quintero" x={250} y={111} w={NW} />
            <BPBracketNode tag="SF·2" name="C. Bermúdez" win x={250} y={375} w={NW} />
            <BPBracketNode tag="SF·2" name="D. Ramírez" x={250} y={411} w={NW} />
            {/* connectors SF->F */}
            {conn(250 + NW, 93, 30, 0)}{conn(250 + NW, 393, 30, 0)}
            {conn(250 + NW + 30, 93, 0, 300)}{conn(250 + NW + 30, 243, 30, 0)}
            {/* Final */}
            <div style={{ position: 'absolute', left: 500, top: 215 }}>
              <div style={{ fontFamily: bpStyles.mono, fontSize: 9, letterSpacing: 1.5, color: bpStyles.red, marginBottom: 6 }}>★ CAMPEÓN AVANZADO</div>
              <div style={{ width: NW + 24, border: `2px solid ${bpStyles.red}`, background: bpStyles.paper2, padding: '12px 14px' }}>
                <div style={{ fontFamily: bpStyles.mono, fontSize: 9, color: bpStyles.faint, letterSpacing: 1 }}>POR DEFINIR</div>
                <div style={{ fontFamily: bpStyles.display, fontWeight: 700, fontSize: 18, letterSpacing: -0.5, color: bpStyles.ink }}>Ganador SF·1 / SF·2</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BPSheet>
  );
}

Object.assign(window, { BPHome, BPBracket });
