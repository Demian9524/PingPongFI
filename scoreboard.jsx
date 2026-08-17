// Dirección E · "Marcador LED" — tablero de estadio / arcade
// Fondo casi negro, dígitos LED, colores neón por categoría. Energía y
// legibilidad a distancia: pensado también para proyector/pantalla grande.
// Apuestas = barra de "sentir de la grada", secundaria.

const ledStyles = {
  bg:      '#0a0c10',
  bg2:     '#11151c',
  panel:   '#161b24',
  panelHi: '#1d2531',
  line:    'rgba(255,255,255,0.09)',
  lineSoft:'rgba(255,255,255,0.05)',
  text:    '#eef3f8',
  muted:   '#7c8794',
  dim:     '#4a525d',
  amber:   '#ffb627',
  display: '"Bungee", system-ui, sans-serif',
  led:     '"Orbitron", "JetBrains Mono", monospace',
  mono:    '"JetBrains Mono", ui-monospace, monospace',
  body:    'Inter, system-ui, sans-serif',
};

// LED dot-matrix backdrop
const ledDots = `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1.4px)`;

function LEDFrame({ children }) {
  return (
    <div style={{ width: '100%', height: '100%', background: ledStyles.bg, backgroundImage: ledDots, backgroundSize: '14px 14px', fontFamily: ledStyles.body, color: ledStyles.text, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function LEDChip({ k, big = false }) {
  const c = CATS[k];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: ledStyles.mono, fontSize: big ? 12 : 10, fontWeight: 700, letterSpacing: 1, color: c.color, textTransform: 'uppercase', padding: big ? '4px 10px' : '2px 7px', border: `1px solid ${c.color}66`, borderRadius: 4, background: `${c.color}14` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, boxShadow: `0 0 8px ${c.color}` }} />{c.name}
    </span>
  );
}

function LEDHeader({ tab = 'EN VIVO' }) {
  return (
    <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 28px', borderBottom: `1px solid ${ledStyles.line}`, background: ledStyles.bg2, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: ledStyles.amber, color: ledStyles.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ledStyles.display, fontSize: 14, boxShadow: `0 0 20px ${ledStyles.amber}55` }}>FI</div>
        <div>
          <div style={{ fontFamily: ledStyles.display, fontSize: 17, letterSpacing: 0.5, lineHeight: 1 }}>COPA CONCRETO</div>
          <div style={{ fontFamily: ledStyles.mono, fontSize: 9, letterSpacing: 2, color: ledStyles.muted, marginTop: 2 }}>TENIS DE MESA · FAC. INGENIERÍA</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        {['EN VIVO', 'GRUPOS', 'LLAVES', 'JUGADORES'].map(t => (
          <span key={t} style={{ fontFamily: ledStyles.mono, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '8px 14px', borderRadius: 6, color: t === tab ? ledStyles.bg : ledStyles.muted, background: t === tab ? ledStyles.amber : 'transparent' }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// Big LED scoreboard
function LEDBoard() {
  const m = LIVE_MATCH;
  const c = CATS[m.cat];
  const Big = ({ children, color }) => (
    <span style={{ fontFamily: ledStyles.led, fontWeight: 800, color: color || ledStyles.text, textShadow: `0 0 18px ${(color || '#fff')}88`, letterSpacing: 1 }}>{children}</span>
  );
  return (
    <div style={{ borderRadius: 16, background: `linear-gradient(180deg, ${ledStyles.panel} 0%, ${ledStyles.bg2} 100%)`, border: `1px solid ${ledStyles.line}`, overflow: 'hidden', position: 'relative', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)` }}>
      <div style={{ position: 'absolute', inset: 0, background: ledDots, backgroundSize: '12px 12px', opacity: 0.5, pointerEvents: 'none' }} />
      {/* status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderBottom: `1px solid ${ledStyles.line}`, position: 'relative' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: ledStyles.mono, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#ff4d4d' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff4d4d', boxShadow: '0 0 12px #ff4d4d' }} />EN VIVO
        </span>
        <LEDChip k={m.cat} />
        <span style={{ fontFamily: ledStyles.mono, fontSize: 12, color: ledStyles.muted, letterSpacing: 1 }}>{m.table} · {m.group}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: ledStyles.led, fontSize: 13, color: ledStyles.amber, letterSpacing: 1 }}>{m.startedAgo}</span>
      </div>
      {/* main score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '26px 30px', position: 'relative' }}>
        {[m.p1, m.p2].map((p, idx) => (
          <div key={idx} style={{ textAlign: idx === 0 ? 'left' : 'right' }}>
            <div style={{ fontFamily: ledStyles.mono, fontSize: 11, letterSpacing: 1.5, color: ledStyles.muted }}>{p.fac.toUpperCase()}</div>
            <div style={{ fontFamily: ledStyles.display, fontSize: 30, letterSpacing: 0, lineHeight: 1.05, margin: '4px 0 10px', color: ledStyles.text }}>{p.n}</div>
            <div style={{ display: 'inline-flex', gap: 4, flexDirection: idx === 0 ? 'row' : 'row-reverse' }}>
              {p.form.split('').map((r, i) => (
                <span key={i} style={{ width: 18, height: 18, borderRadius: 3, fontFamily: ledStyles.mono, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r === 'W' ? ledStyles.bg : ledStyles.muted, background: r === 'W' ? c.color : 'transparent', border: `1px solid ${r === 'W' ? c.color : ledStyles.line}`, boxShadow: r === 'W' ? `0 0 10px ${c.color}88` : 'none' }}>{r === 'W' ? 'G' : 'P'}</span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ textAlign: 'center', padding: '0 20px' }}>
          <div style={{ fontFamily: ledStyles.mono, fontSize: 10, letterSpacing: 3, color: ledStyles.dim, marginBottom: 2 }}>SETS</div>
          <div style={{ fontSize: 70, lineHeight: 0.85 }}><Big color={c.color}>{m.p1.sets}</Big><span style={{ color: ledStyles.dim, margin: '0 10px', fontFamily: ledStyles.led }}>:</span><Big>{m.p2.sets}</Big></div>
          <div style={{ fontFamily: ledStyles.mono, fontSize: 10, letterSpacing: 3, color: ledStyles.dim, margin: '12px 0 2px' }}>SET 3</div>
          <div style={{ fontSize: 40, lineHeight: 0.9 }}><Big color={ledStyles.amber}>{String(m.p1.score).padStart(2, '0')}</Big><span style={{ color: ledStyles.dim, margin: '0 8px', fontFamily: ledStyles.led }}>:</span><Big color={ledStyles.amber}>{String(m.p2.score).padStart(2, '0')}</Big></div>
        </div>
      </div>
      {/* sets ledger + crowd sentiment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderTop: `1px solid ${ledStyles.line}`, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {m.history.map(h => (
            <span key={h.s} style={{ fontFamily: ledStyles.mono, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 5, color: h.live ? ledStyles.bg : ledStyles.muted, background: h.live ? c.color : ledStyles.panelHi, letterSpacing: 0.5 }}>S{h.s} {h.a}-{h.b}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* crowd sentiment - secondary betting */}
        <span style={{ fontFamily: ledStyles.mono, fontSize: 10, letterSpacing: 1, color: ledStyles.muted }}>LA GRADA</span>
        <div style={{ width: 160, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: ledStyles.panelHi }}>
          <div style={{ width: `${m.pctOnP1}%`, background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
          <div style={{ flex: 1, background: ledStyles.amber }} />
        </div>
        <span style={{ fontFamily: ledStyles.led, fontSize: 12, color: c.color }}>{m.pctOnP1}%</span>
      </div>
    </div>
  );
}

function LEDUpNext({ r }) {
  const cat = r.group.slice(0, 2);
  const c = CATS[cat] || CATS.AV;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: ledStyles.panel, border: `1px solid ${ledStyles.line}` }}>
      <span style={{ fontFamily: ledStyles.led, fontSize: 13, fontWeight: 700, color: ledStyles.amber, width: 48, flex: '0 0 auto' }}>{r.time}</span>
      <span style={{ width: 3, height: 30, background: c.color, borderRadius: 2, boxShadow: `0 0 8px ${c.color}`, flex: '0 0 auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: ledStyles.body, fontSize: 13.5, fontWeight: 600, color: ledStyles.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p1} <span style={{ color: ledStyles.dim }}>vs</span> {r.p2}</div>
        <div style={{ fontFamily: ledStyles.mono, fontSize: 9.5, color: ledStyles.muted, letterSpacing: 0.5 }}>GRUPO {r.group}</div>
      </div>
    </div>
  );
}

function LEDGroup({ gk }) {
  const g = GROUPS[gk];
  const c = CATS[g.cat];
  return (
    <div style={{ borderRadius: 12, background: ledStyles.panel, border: `1px solid ${ledStyles.line}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${ledStyles.line}`, background: `${c.color}14` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
        <span style={{ fontFamily: ledStyles.mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: ledStyles.text }}>{g.name}</span>
      </div>
      {g.players.map((p, i) => (
        <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 36px', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < 3 ? `1px solid ${ledStyles.lineSoft}` : 'none', background: i < 2 ? `${c.color}0d` : 'transparent' }}>
          <span style={{ fontFamily: ledStyles.led, fontSize: 12, fontWeight: 700, color: i < 2 ? c.color : ledStyles.dim }}>{i + 1}</span>
          <span style={{ fontFamily: ledStyles.body, fontSize: 12.5, fontWeight: i < 2 ? 700 : 500, color: ledStyles.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}{i === 2 && <span style={{ fontFamily: ledStyles.mono, fontSize: 8, color: ledStyles.amber, marginLeft: 5 }}>3°</span>}</span>
          <span style={{ fontFamily: ledStyles.led, fontSize: 14, fontWeight: 700, color: ledStyles.text, textAlign: 'right' }}>{p.pts}</span>
        </div>
      ))}
    </div>
  );
}

function LEDHome() {
  return (
    <LEDFrame>
      <LEDHeader tab="EN VIVO" />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 22, padding: '22px 28px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <LEDBoard />
          <div>
            <div style={{ fontFamily: ledStyles.mono, fontSize: 11, letterSpacing: 2, color: ledStyles.muted, marginBottom: 10 }}>▸&nbsp; PRÓXIMOS EN MESA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {UPCOMING.slice(0, 4).map((r, i) => <LEDUpNext key={i} r={r} />)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ fontFamily: ledStyles.mono, fontSize: 11, letterSpacing: 2, color: ledStyles.muted }}>▦&nbsp; POSICIONES</div>
          <LEDGroup gk="AV_A" />
          <LEDGroup gk="IN_B" />
        </div>
      </div>
    </LEDFrame>
  );
}

// ── Bracket ─────────────────────────────────────────────────────────────
const LED_THIRDS = [
  { pos: 1, n: 'M. "Pulpo" Morales', grp: 'AV·A', dif: -3, in: true },
  { pos: 2, n: 'A. Cabrera',         grp: 'AV·B', dif: -2, in: true },
  { pos: 3, n: 'R. Soto',            grp: 'IN·A', dif: -1, in: false },
  { pos: 4, n: 'J. Beltrán',         grp: 'PR·B', dif: -2, in: false },
];

function LEDNode({ tag, name, win, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, width: 196, background: win ? `${accent}1f` : ledStyles.panel, border: `1px solid ${win ? accent : ledStyles.line}`, boxShadow: win ? `0 0 16px ${accent}33` : 'none' }}>
      <span style={{ fontFamily: ledStyles.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: win ? accent : ledStyles.dim, width: 38, flex: '0 0 auto', lineHeight: 1.1 }}>{tag}</span>
      <span style={{ fontFamily: ledStyles.body, fontSize: 13, fontWeight: win ? 700 : 500, color: win ? ledStyles.text : ledStyles.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{name}</span>
    </div>
  );
}

function LEDBracket() {
  const c = CATS.AV;
  return (
    <LEDFrame>
      <LEDHeader tab="LLAVES" />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '290px 1fr', minHeight: 0, overflow: 'hidden' }}>
        {/* thirds */}
        <div style={{ padding: '24px 24px 24px 28px', borderRight: `1px solid ${ledStyles.line}`, background: ledStyles.bg2 }}>
          <div style={{ fontFamily: ledStyles.mono, fontSize: 11, letterSpacing: 2, color: ledStyles.amber, marginBottom: 6 }}>COMODINES</div>
          <div style={{ fontFamily: ledStyles.display, fontSize: 26, letterSpacing: 0.3, lineHeight: 1.05, marginBottom: 8 }}>MEJORES<br />TERCEROS</div>
          <p style={{ fontFamily: ledStyles.body, fontSize: 12, lineHeight: 1.5, color: ledStyles.muted, margin: '0 0 18px' }}>Pasan 1.º y 2.º de cada grupo. Los terceros compiten por las últimas plazas, ordenados por puntos y diferencia.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LED_THIRDS.map(t => (
              <div key={t.pos} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10, background: t.in ? `${ledStyles.amber}14` : ledStyles.panel, border: `1px solid ${t.in ? ledStyles.amber + '66' : ledStyles.line}` }}>
                <span style={{ fontFamily: ledStyles.led, fontSize: 18, fontWeight: 800, color: t.in ? ledStyles.amber : ledStyles.dim, width: 22 }}>{t.pos}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: ledStyles.body, fontSize: 13, fontWeight: 700, color: ledStyles.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.n}</div>
                  <div style={{ fontFamily: ledStyles.mono, fontSize: 9.5, color: ledStyles.muted }}>{t.grp} · DIF {t.dif}</div>
                </div>
                {t.in && <span style={{ fontFamily: ledStyles.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: ledStyles.bg, background: ledStyles.amber, padding: '3px 7px', borderRadius: 4 }}>PASA</span>}
              </div>
            ))}
          </div>
        </div>
        {/* bracket */}
        <div style={{ position: 'relative', padding: '24px 28px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <LEDChip k="AV" big />
            <span style={{ fontFamily: ledStyles.display, fontSize: 18, letterSpacing: 0.3 }}>FASE FINAL</span>
            <div style={{ flex: 1 }} />
            {['CUARTOS', 'SEMIS', 'FINAL'].map(t => <span key={t} style={{ fontFamily: ledStyles.mono, fontSize: 9, letterSpacing: 1.5, color: ledStyles.dim }}>{t}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'center', height: 'calc(100% - 50px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="1° A" name='D. "Profe" Ramírez' win accent={c.color} /><LEDNode tag="3° MEJ" name="M. Morales" accent={c.color} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="2° B" name="E. Quintero" win accent={c.color} /><LEDNode tag="3° MEJ" name="A. Cabrera" accent={c.color} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="1° B" name="C. Bermúdez" win accent={c.color} /><LEDNode tag="2° A" name="A. López" accent={c.color} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="2° B" name="S. Quintero" accent={c.color} /><LEDNode tag="1° A" name="D. Ramírez" win accent={c.color} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 130 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="SF 1" name="D. Ramírez" win accent={ledStyles.amber} /><LEDNode tag="SF 1" name="E. Quintero" accent={ledStyles.amber} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><LEDNode tag="SF 2" name="C. Bermúdez" win accent={ledStyles.amber} /><LEDNode tag="SF 2" name="D. Ramírez" accent={ledStyles.amber} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
              <div style={{ fontFamily: ledStyles.mono, fontSize: 10, letterSpacing: 1.5, color: ledStyles.amber, marginBottom: 8 }}>★ CAMPEÓN</div>
              <div style={{ width: 196, borderRadius: 10, padding: '16px 16px', background: `linear-gradient(160deg, ${ledStyles.amber}22, ${ledStyles.panel})`, border: `1.5px solid ${ledStyles.amber}`, boxShadow: `0 0 28px ${ledStyles.amber}33` }}>
                <div style={{ fontFamily: ledStyles.mono, fontSize: 9.5, color: ledStyles.muted, letterSpacing: 1 }}>POR DEFINIR</div>
                <div style={{ fontFamily: ledStyles.display, fontSize: 19, letterSpacing: 0.3, lineHeight: 1.1, marginTop: 4, color: ledStyles.text }}>GANADOR</div>
                <div style={{ fontFamily: ledStyles.mono, fontSize: 11, color: ledStyles.amber, marginTop: 4 }}>DOM · 19:00</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LEDFrame>
  );
}

Object.assign(window, { LEDHome, LEDBracket });
