// Dirección D · "Editorial Deportivo" — revista de deportes premium
// Papel crema, titulares enormes, mucho aire, fotografía protagonista.
// Enfoque torneo: la crónica del día, posiciones y llaves con tipografía.
// Apuestas = "La Quiniela", un recuadro discreto.

const edStyles = {
  paper:   '#f6f2e9',
  paper2:  '#fffdf8',
  ink:     '#15130f',
  ink2:    '#4f4a40',
  faint:   '#928c7e',
  line:    'rgba(21,19,15,0.14)',
  lineSoft:'rgba(21,19,15,0.07)',
  accent:  '#b5341f',     // ladrillo / brick red
  display: '"Anton", "Archivo", sans-serif',
  serif:   '"DM Serif Display", Georgia, serif',
  body:    'Inter, system-ui, sans-serif',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
};

// Striped photo placeholder
function EDPhoto({ label, h = 200, accent = false }) {
  const stripe = accent ? edStyles.accent : edStyles.ink;
  return (
    <div style={{ height: h, width: '100%', position: 'relative', overflow: 'hidden', background: `repeating-linear-gradient(135deg, ${edStyles.lineSoft} 0 14px, transparent 14px 28px), ${edStyles.paper2}`, border: `1px solid ${edStyles.line}` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 12 }}>
        <span style={{ fontFamily: edStyles.mono, fontSize: 10, letterSpacing: 1, color: edStyles.faint, background: edStyles.paper, padding: '3px 7px', border: `1px solid ${edStyles.line}` }}>◳ {label}</span>
      </div>
      <div style={{ position: 'absolute', top: 12, left: 12, width: 26, height: 26, borderTop: `2px solid ${stripe}`, borderLeft: `2px solid ${stripe}`, opacity: 0.5 }} />
    </div>
  );
}

function EDKicker({ children, accent = false }) {
  return <div style={{ fontFamily: edStyles.mono, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent ? edStyles.accent : edStyles.faint, fontWeight: 500 }}>{children}</div>;
}

function EDRule({ heavy = false }) {
  return <div style={{ height: 0, borderTop: heavy ? `2px solid ${edStyles.ink}` : `1px solid ${edStyles.line}` }} />;
}

function EDCatTag({ k }) {
  const c = CATS[k];
  return <span style={{ fontFamily: edStyles.mono, fontSize: 10, letterSpacing: 1, color: edStyles.ink2, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />{c.name.toUpperCase()}</span>;
}

// ── Masthead ────────────────────────────────────────────────────────────
function EDMasthead({ sheet = 'EL DIARIO DE LA MESA' }) {
  return (
    <div style={{ padding: '22px 48px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: edStyles.mono, fontSize: 11, letterSpacing: 2, color: edStyles.ink2 }}>FAC. DE INGENIERÍA</span>
        <span style={{ fontFamily: edStyles.mono, fontSize: 11, letterSpacing: 2, color: edStyles.ink2 }}>VIERNES · 2026 · Nº 12</span>
      </div>
      <EDRule heavy />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 0 10px' }}>
        <span style={{ fontFamily: edStyles.serif, fontSize: 46, letterSpacing: -1, lineHeight: 1, color: edStyles.ink }}>Copa Concreto</span>
      </div>
      <EDRule heavy />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 0 0' }}>
        {['EN VIVO', 'POSICIONES', 'LLAVES', 'JUGADORES', 'LA QUINIELA'].map((t, i) => (
          <span key={t} style={{ fontFamily: edStyles.mono, fontSize: 11, letterSpacing: 1.5, color: i === 0 ? edStyles.accent : edStyles.ink2, fontWeight: i === 0 ? 700 : 400 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Standings strip (editorial table) ───────────────────────────────────
function EDStanding({ gk }) {
  const g = GROUPS[gk];
  const c = CATS[g.cat];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
        <span style={{ fontFamily: edStyles.display, fontSize: 16, letterSpacing: 0.3, color: edStyles.ink }}>{g.name}</span>
      </div>
      <EDRule />
      {g.players.map((p, i) => (
        <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '16px 1fr 28px', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: i < 3 ? `1px solid ${edStyles.lineSoft}` : 'none' }}>
          <span style={{ fontFamily: edStyles.serif, fontSize: 15, color: i < 2 ? edStyles.accent : edStyles.faint }}>{i + 1}</span>
          <span style={{ fontFamily: edStyles.body, fontSize: 13.5, fontWeight: i < 2 ? 700 : 500, color: edStyles.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}{i === 2 && <span style={{ fontFamily: edStyles.mono, fontSize: 8.5, color: edStyles.accent, marginLeft: 6 }}>3.º</span>}</span>
          <span style={{ fontFamily: edStyles.mono, fontSize: 13, fontWeight: 700, color: edStyles.ink, textAlign: 'right' }}>{p.pts}</span>
        </div>
      ))}
    </div>
  );
}

function EDHome() {
  const m = LIVE_MATCH;
  return (
    <div style={{ width: '100%', height: '100%', background: edStyles.paper, fontFamily: edStyles.body, color: edStyles.ink, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <EDMasthead />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 0, padding: '14px 48px 40px', minHeight: 0 }}>
        {/* Feature story */}
        <div style={{ paddingRight: 36, borderRight: `1px solid ${edStyles.line}`, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontFamily: edStyles.mono, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#fff', background: edStyles.accent, padding: '4px 10px' }}>● EN VIVO · {m.set}</span>
            <EDCatTag k={m.cat} />
            <span style={{ fontFamily: edStyles.mono, fontSize: 11, color: edStyles.faint }}>{m.table} · {m.group}</span>
          </div>
          <h1 style={{ fontFamily: edStyles.display, fontSize: 56, lineHeight: 0.92, letterSpacing: -0.5, margin: '0 0 14px', textWrap: 'balance' }}>
            EL PROFE Y EL TORNADO<br />SE PARTEN LA MESA 3
          </h1>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: edStyles.serif, fontSize: 15, fontStyle: 'italic', color: edStyles.ink2 }}>Iban 1–1 en sets cuando el reloj marcaba {m.startedAgo}.</span>
          </div>
          <EDPhoto label="FOTO · DUELO EN MESA CENTRAL" h={250} accent />
          {/* scoreline under photo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, marginTop: 18 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: edStyles.display, fontSize: 26, letterSpacing: -0.3, lineHeight: 1 }}>{m.p1.n}</div>
              <div style={{ fontFamily: edStyles.mono, fontSize: 11, color: edStyles.faint, marginTop: 3 }}>{m.p1.fac} · FORMA {m.p1.form}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <div style={{ fontFamily: edStyles.serif, fontSize: 50, lineHeight: 0.9, color: edStyles.accent }}>{m.p1.sets}–{m.p2.sets}</div>
              <div style={{ fontFamily: edStyles.mono, fontSize: 12, fontWeight: 700, color: edStyles.ink }}>{m.p1.score} : {m.p2.score}</div>
            </div>
            <div>
              <div style={{ fontFamily: edStyles.display, fontSize: 26, letterSpacing: -0.3, lineHeight: 1 }}>{m.p2.n}</div>
              <div style={{ fontFamily: edStyles.mono, fontSize: 11, color: edStyles.faint, marginTop: 3 }}>{m.p2.fac} · FORMA {m.p2.form}</div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0, overflow: 'hidden' }}>
          <div>
            <EDKicker accent>Posiciones · jornada 3</EDKicker>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <EDStanding gk="AV_A" />
              <EDStanding gk="PR_A" />
            </div>
          </div>
          {/* Upcoming */}
          <div>
            <EDKicker>Hoy en las mesas</EDKicker>
            <div style={{ marginTop: 8 }}>
              {UPCOMING.slice(0, 4).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', borderBottom: `1px solid ${edStyles.lineSoft}` }}>
                  <span style={{ fontFamily: edStyles.mono, fontSize: 12, fontWeight: 700, color: edStyles.accent, width: 42 }}>{r.time}</span>
                  <span style={{ fontFamily: edStyles.body, fontSize: 12.5, color: edStyles.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p1} <span style={{ color: edStyles.faint }}>vs</span> {r.p2}</span>
                </div>
              ))}
            </div>
          </div>
          {/* La Quiniela — discreet betting */}
          <div style={{ marginTop: 'auto', border: `1.5px solid ${edStyles.ink}`, padding: '14px 16px', background: edStyles.paper2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: edStyles.serif, fontSize: 19, color: edStyles.ink }}>La Quiniela</span>
              <span style={{ fontFamily: edStyles.mono, fontSize: 10, color: edStyles.faint }}>OPCIONAL</span>
            </div>
            <p style={{ fontFamily: edStyles.body, fontSize: 12, lineHeight: 1.5, color: edStyles.ink2, margin: '6px 0 0' }}>Predice quién gana con fichas de la casa. El más atinado encabeza la tabla de pronósticos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bracket / Llaves — editorial ────────────────────────────────────────
const ED_THIRDS = [
  { pos: 1, n: 'M. "Pulpo" Morales', grp: 'Avanzado · A', dif: '−3', in: true },
  { pos: 2, n: 'A. Cabrera',         grp: 'Avanzado · B', dif: '−2', in: true },
  { pos: 3, n: 'R. Soto',            grp: 'Intermedio · A', dif: '−1', in: false },
  { pos: 4, n: 'J. Beltrán',         grp: 'Principiante · B', dif: '−2', in: false },
];

function EDMatchup({ a, b, aw, bw, accent }) {
  const row = (name, tag, win) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: win ? edStyles.ink : 'transparent', color: win ? edStyles.paper : edStyles.ink }}>
      <span style={{ fontFamily: edStyles.mono, fontSize: 8.5, letterSpacing: 0.5, color: win ? 'rgba(255,255,255,0.6)' : edStyles.faint, width: 46, flex: '0 0 auto' }}>{tag}</span>
      <span style={{ fontFamily: edStyles.body, fontSize: 13, fontWeight: win ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${edStyles.line}`, background: edStyles.paper2, width: 200 }}>
      {row(a.n, a.tag, aw)}
      <div style={{ height: 1, background: edStyles.line }} />
      {row(b.n, b.tag, bw)}
    </div>
  );
}

function EDBracket() {
  return (
    <div style={{ width: '100%', height: '100%', background: edStyles.paper, fontFamily: edStyles.body, color: edStyles.ink, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '22px 48px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <EDKicker accent>Copa Concreto · fase final</EDKicker>
            <h1 style={{ fontFamily: edStyles.display, fontSize: 46, letterSpacing: -0.5, margin: '6px 0 0', lineHeight: 0.95 }}>EL CAMINO A LA FINAL</h1>
          </div>
          <span style={{ fontFamily: edStyles.serif, fontSize: 17, fontStyle: 'italic', color: edStyles.ink2 }}>Categoría Avanzado</span>
        </div>
        <div style={{ marginTop: 12 }}><EDRule heavy /></div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 0, padding: '0 48px 36px' }}>
        {/* Best thirds */}
        <div style={{ paddingRight: 32, borderRight: `1px solid ${edStyles.line}` }}>
          <EDKicker accent>Los comodines</EDKicker>
          <h2 style={{ fontFamily: edStyles.serif, fontSize: 30, lineHeight: 0.95, margin: '8px 0 8px', letterSpacing: -0.3 }}>Mejores terceros</h2>
          <p style={{ fontFamily: edStyles.body, fontSize: 12.5, lineHeight: 1.55, color: edStyles.ink2, margin: '0 0 18px' }}>Pasan los dos primeros de cada grupo. Las plazas restantes las disputan los <b>terceros lugares</b>, ordenados por puntos y diferencia de sets.</p>
          {ED_THIRDS.map((t, i) => (
            <div key={t.pos} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${edStyles.lineSoft}`, opacity: t.in ? 1 : 0.5 }}>
              <span style={{ fontFamily: edStyles.serif, fontSize: 28, lineHeight: 1, color: t.in ? edStyles.accent : edStyles.faint, width: 26 }}>{t.pos}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: edStyles.body, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.n}</div>
                <div style={{ fontFamily: edStyles.mono, fontSize: 10, color: edStyles.faint }}>{t.grp} · DIF {t.dif}</div>
              </div>
              {t.in && <span style={{ fontFamily: edStyles.mono, fontSize: 9, letterSpacing: 1, color: '#fff', background: edStyles.accent, padding: '3px 7px' }}>PASA</span>}
            </div>
          ))}
        </div>

        {/* Bracket */}
        <div style={{ paddingLeft: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'center', position: 'relative' }}>
          {[['CUARTOS'], ['SEMIFINALES'], ['FINAL']].map(([t], i) => (
            <div key={t} style={{ position: 'absolute', top: 0, left: `calc(40px + ${i} * (100% - 40px) / 3)`, fontFamily: edStyles.mono, fontSize: 10, letterSpacing: 2, color: edStyles.faint }}>{t}</div>
          ))}
          {/* QF column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <EDMatchup a={{ n: 'D. "Profe" Ramírez', tag: '1° GRUPO A' }} b={{ n: 'M. Morales', tag: '3° MEJOR' }} aw />
            <EDMatchup a={{ n: 'E. Quintero', tag: '2° GRUPO B' }} b={{ n: 'A. Cabrera', tag: '3° MEJOR' }} aw />
            <EDMatchup a={{ n: 'C. Bermúdez', tag: '1° GRUPO B' }} b={{ n: 'A. López', tag: '2° GRUPO A' }} aw />
            <EDMatchup a={{ n: 'S. Quintero', tag: '2° GRUPO B' }} b={{ n: 'D. Ramírez', tag: '1° GRUPO A' }} bw />
          </div>
          {/* SF column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 150 }}>
            <EDMatchup a={{ n: 'D. Ramírez', tag: 'SEMIFINAL 1' }} b={{ n: 'E. Quintero', tag: 'SEMIFINAL 1' }} aw />
            <EDMatchup a={{ n: 'C. Bermúdez', tag: 'SEMIFINAL 2' }} b={{ n: 'D. Ramírez', tag: 'SEMIFINAL 2' }} aw />
          </div>
          {/* Final column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ fontFamily: edStyles.mono, fontSize: 10, letterSpacing: 1.5, color: edStyles.accent, marginBottom: 8 }}>★ GRAN FINAL</div>
            <div style={{ width: 210, border: `2px solid ${edStyles.accent}`, background: edStyles.paper2, padding: '16px 16px' }}>
              <div style={{ fontFamily: edStyles.mono, fontSize: 10, color: edStyles.faint, letterSpacing: 1 }}>POR DEFINIR</div>
              <div style={{ fontFamily: edStyles.display, fontSize: 24, letterSpacing: -0.3, lineHeight: 1, marginTop: 4 }}>EL CAMPEÓN</div>
              <div style={{ fontFamily: edStyles.serif, fontSize: 14, fontStyle: 'italic', color: edStyles.ink2, marginTop: 6 }}>Domingo, 19:00 h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EDHome, EDBracket });
