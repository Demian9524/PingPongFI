// Dirección B: Cartoon vintage rubber-hose (años 30-60)
// Diseño original — papel envejecido, halftone, ribbons, type-first.

const vtStyles = {
  paper:     '#efe1c1',
  paperDeep: '#e3cf9f',
  paperShade:'#d4b87e',
  ink:       '#1a1208',
  inkSoft:   '#3a2818',
  red:       '#c2342b',
  redDark:   '#8a1d18',
  mustard:   '#d4a319',
  mustardDk: '#9c7714',
  teal:      '#2a7a72',
  tealDk:    '#185049',
  cream:     '#f7eccf',
  white:     '#fcf6e4',
  display:   '"Ultra", "Alfa Slab One", serif',
  serif:     '"Alfa Slab One", serif',
  accent:    '"Limelight", serif',
  body:      '"Special Elite", "Courier Prime", monospace',
  abril:     '"Abril Fatface", serif',
  bungee:    '"Bungee", sans-serif',
};

const halftone = (color = 'rgba(26,18,8,0.18)', size = 5) => ({
  backgroundImage: `radial-gradient(${color} 1px, transparent 1.2px)`,
  backgroundSize: `${size}px ${size}px`,
});

const paperTexture = {
  backgroundColor: vtStyles.paper,
  backgroundImage: `
    radial-gradient(rgba(140,100,40,0.10) 0.7px, transparent 1.4px),
    radial-gradient(rgba(180,140,80,0.06) 0.5px, transparent 1px),
    radial-gradient(circle at 20% 30%, rgba(180,130,60,0.10), transparent 60%),
    radial-gradient(circle at 80% 70%, rgba(120,80,30,0.08), transparent 60%)
  `,
  backgroundSize: '4px 4px, 7px 7px, 100% 100%, 100% 100%',
};

function VTStar({ size = 14, color }) {
  // 5-point star via SVG (simple shape, allowed)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block' }}>
      <polygon points="12,1 14.9,8.6 23,9 16.5,14.4 18.8,22 12,17.6 5.2,22 7.5,14.4 1,9 9.1,8.6" fill={color || vtStyles.ink} />
    </svg>
  );
}

function VTDiamond({ size = 10, color }) {
  return <span style={{ display: 'inline-block', width: size, height: size, background: color || vtStyles.ink, transform: 'rotate(45deg)' }} />;
}

function VTRibbon({ children, color = vtStyles.red, textColor = vtStyles.cream, height = 44, ornaments = true }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Ribbon tails left */}
      {ornaments && (
        <div style={{
          position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: `${height/2}px solid transparent`,
          borderBottom: `${height/2}px solid transparent`,
          borderRight: `14px solid ${color}`,
          filter: `drop-shadow(-2px 4px 0 ${vtStyles.ink}40)`,
        }} />
      )}
      <div style={{
        background: color, color: textColor, height,
        padding: '0 22px',
        display: 'inline-flex', alignItems: 'center',
        fontFamily: vtStyles.display,
        letterSpacing: 1.5,
        position: 'relative',
        boxShadow: `0 4px 0 ${vtStyles.ink}30`,
      }}>
        <span style={{ position: 'absolute', top: 4, bottom: 4, left: 4, right: 4, border: `1.5px solid ${textColor}80` }} />
        <span style={{ position: 'relative' }}>{children}</span>
      </div>
      {ornaments && (
        <div style={{
          position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: `${height/2}px solid transparent`,
          borderBottom: `${height/2}px solid transparent`,
          borderLeft: `14px solid ${color}`,
          filter: `drop-shadow(2px 4px 0 ${vtStyles.ink}40)`,
        }} />
      )}
    </div>
  );
}

function VTOrnamentalDivider({ color = vtStyles.ink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color, padding: '8px 0' }}>
      <div style={{ flex: 1, height: 2, background: color }} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
      <VTDiamond size={6} color={color} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <VTDiamond size={6} color={color} />
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
      <div style={{ flex: 1, height: 2, background: color }} />
    </div>
  );
}

// A stylized paddle illustration — simple shapes (circle + rect), allowed
function VTPaddle({ size = 80, color = vtStyles.red, angle = -25, halftoneColor }) {
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.4, transform: `rotate(${angle}deg)` }}>
      {/* handle */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: size * 0.18, height: size * 0.55,
        background: vtStyles.inkSoft,
        borderRadius: `${size*0.08}px ${size*0.08}px ${size*0.05}px ${size*0.05}px`,
        border: `2px solid ${vtStyles.ink}`,
      }} />
      <div style={{
        position: 'absolute', bottom: size * 0.5, left: '50%', transform: 'translateX(-50%)',
        width: size * 0.3, height: size * 0.1,
        background: vtStyles.mustard,
        border: `2px solid ${vtStyles.ink}`,
        borderRadius: 2,
      }} />
      {/* head */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        border: `3px solid ${vtStyles.ink}`,
        boxShadow: `4px 6px 0 ${vtStyles.ink}50`,
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, ...halftone(halftoneColor || 'rgba(26,18,8,0.25)', 4) }} />
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: '35%', height: '20%', borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />
      </div>
    </div>
  );
}

function VTBall({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: vtStyles.white,
      border: `2.5px solid ${vtStyles.ink}`,
      boxShadow: `2px 3px 0 ${vtStyles.ink}80`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '15%', left: '20%', width: '30%', height: '20%', borderRadius: '50%', background: 'rgba(0,0,0,0.08)' }} />
    </div>
  );
}

function VTMarquee() {
  const items = ['APUESTAS EN VIVO', 'HOY · 7 PARTIDOS', 'CUOTAS MEJORADAS', 'PREMIO MAYOR $580.000', 'COPA CONCRETO XII', 'MESA DE CEMENTO · PALA Y TEMPLE'];
  return (
    <div style={{
      background: vtStyles.ink, color: vtStyles.cream,
      height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden',
      borderTop: `2px solid ${vtStyles.ink}`,
      borderBottom: `4px double ${vtStyles.mustard}`,
    }}>
      <div style={{ display: 'flex', gap: 28, paddingLeft: 28, fontFamily: vtStyles.accent, fontSize: 13, letterSpacing: 3, whiteSpace: 'nowrap' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <VTStar size={10} color={vtStyles.mustard} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function VTTopBanner() {
  return (
    <div style={{ background: vtStyles.cream, borderBottom: `3px solid ${vtStyles.ink}`, padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, position: 'relative' }}>
      {/* halftone band on right side */}
      <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(194,52,43,0.15)', 6), pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: vtStyles.red, border: `3px solid ${vtStyles.ink}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: vtStyles.cream, fontFamily: vtStyles.display, fontSize: 22, letterSpacing: -1,
          boxShadow: `3px 4px 0 ${vtStyles.ink}`,
        }}>CC</div>
        <div>
          <div style={{ fontFamily: vtStyles.accent, fontSize: 12, letterSpacing: 4, color: vtStyles.inkSoft }}>EST. 2014 · XII EDICIÓN · CAMPUS</div>
          <div style={{ fontFamily: vtStyles.display, fontSize: 32, letterSpacing: -0.5, color: vtStyles.ink, lineHeight: 1 }}>Copa Concreto</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <nav style={{ display: 'flex', gap: 4, position: 'relative' }}>
        {[
          { k: 'Inicio', active: true },
          { k: 'Grupos' },
          { k: 'Llaves' },
          { k: 'Apuestas', live: true },
          { k: 'Galería' },
        ].map(t => (
          <div key={t.k} style={{
            padding: '10px 16px',
            background: t.active ? vtStyles.ink : 'transparent',
            color: t.active ? vtStyles.cream : vtStyles.ink,
            fontFamily: vtStyles.serif, fontSize: 13, letterSpacing: 1.5,
            textTransform: 'uppercase',
            border: `2px solid ${vtStyles.ink}`,
            position: 'relative',
            boxShadow: t.active ? `3px 4px 0 ${vtStyles.red}` : 'none',
          }}>
            {t.k}
            {t.live && <span style={{
              position: 'absolute', top: -8, right: -8,
              background: vtStyles.red, color: vtStyles.cream,
              padding: '2px 5px', fontSize: 8, letterSpacing: 1,
              border: `1.5px solid ${vtStyles.ink}`, transform: 'rotate(8deg)',
              fontFamily: vtStyles.bungee,
            }}>LIVE</span>}
          </div>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2, color: vtStyles.inkSoft }}>SU FORTUNA</div>
          <div style={{ fontFamily: vtStyles.display, fontSize: 18, color: vtStyles.red, letterSpacing: -0.5 }}>$ 145.500</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: vtStyles.mustard, border: `2.5px solid ${vtStyles.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: vtStyles.display, color: vtStyles.ink, boxShadow: `2px 3px 0 ${vtStyles.ink}` }}>JR</div>
      </div>
    </div>
  );
}

function VTPoster() {
  const m = LIVE_MATCH;
  return (
    <div style={{
      background: vtStyles.red,
      border: `4px solid ${vtStyles.ink}`,
      boxShadow: `8px 10px 0 ${vtStyles.ink}`,
      padding: 0,
      position: 'relative',
      overflow: 'hidden',
      color: vtStyles.cream,
    }}>
      {/* halftone overlay */}
      <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(255,240,200,0.15)', 5), pointerEvents: 'none' }} />
      {/* burst radial lines */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-conic-gradient(from 0deg at 50% 55%, rgba(255,235,180,0.18) 0deg 8deg, transparent 8deg 16deg)`,
        pointerEvents: 'none',
      }} />

      {/* Top strip */}
      <div style={{ background: vtStyles.ink, color: vtStyles.mustard, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: vtStyles.accent, fontSize: 12, letterSpacing: 3, position: 'relative' }}>
        <VTStar size={12} color={vtStyles.mustard} />
        <span>FUNCIÓN DE HOY · MESA 3 · 18:32 · EN DIRECTO</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: vtStyles.cream }}>SET 3 · {m.p1.score} a {m.p2.score}</span>
        <VTStar size={12} color={vtStyles.mustard} />
      </div>

      <div style={{ padding: '20px 32px 28px', position: 'relative' }}>
        <div style={{ fontFamily: vtStyles.accent, fontSize: 13, letterSpacing: 4, color: vtStyles.cream, textAlign: 'center', marginBottom: 4 }}>★  EL DUELO DEL DÍA  ★</div>
        <div style={{ fontFamily: vtStyles.display, fontSize: 68, lineHeight: 0.9, textAlign: 'center', letterSpacing: -1.5, color: vtStyles.cream, textShadow: `4px 4px 0 ${vtStyles.ink}` }}>
          MATCH<br />OF THE DAY
        </div>

        {/* Versus row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, marginTop: 22 }}>
          {/* Player 1 column */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <VTPaddle size={120} color={vtStyles.mustard} angle={-22} />
            </div>
            <div style={{ marginTop: 14, fontFamily: vtStyles.accent, fontSize: 10, letterSpacing: 3, color: vtStyles.mustard }}>{m.p1.fac.toUpperCase()} · RANK #2</div>
            <div style={{ fontFamily: vtStyles.display, fontSize: 26, color: vtStyles.cream, letterSpacing: -0.5, lineHeight: 1.05, marginTop: 4 }}>{m.p1.n.toUpperCase()}</div>
            <div style={{ display: 'inline-block', marginTop: 8, padding: '6px 12px', background: vtStyles.mustard, color: vtStyles.ink, fontFamily: vtStyles.bungee, fontSize: 18, border: `2.5px solid ${vtStyles.ink}`, boxShadow: `3px 3px 0 ${vtStyles.ink}` }}>{m.p1.odd.toFixed(2)}</div>
          </div>
          {/* VS */}
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: vtStyles.cream, border: `3.5px solid ${vtStyles.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: vtStyles.red, fontFamily: vtStyles.display, fontSize: 36, letterSpacing: -1,
              boxShadow: `4px 5px 0 ${vtStyles.ink}, inset 0 0 0 5px ${vtStyles.cream}, inset 0 0 0 6px ${vtStyles.red}`,
              transform: 'rotate(-6deg)',
            }}>VS</div>
            <div style={{ marginTop: 20, fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2, color: vtStyles.cream }}>SETS</div>
            <div style={{ fontFamily: vtStyles.display, fontSize: 32, color: vtStyles.cream, lineHeight: 1 }}>
              {m.p1.sets} · {m.p2.sets}
            </div>
          </div>
          {/* Player 2 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <VTPaddle size={120} color={vtStyles.teal} angle={22} halftoneColor="rgba(255,240,200,0.30)" />
            </div>
            <div style={{ marginTop: 14, fontFamily: vtStyles.accent, fontSize: 10, letterSpacing: 3, color: vtStyles.mustard }}>{m.p2.fac.toUpperCase()} · RANK #5</div>
            <div style={{ fontFamily: vtStyles.display, fontSize: 26, color: vtStyles.cream, letterSpacing: -0.5, lineHeight: 1.05, marginTop: 4 }}>{m.p2.n.toUpperCase()}</div>
            <div style={{ display: 'inline-block', marginTop: 8, padding: '6px 12px', background: vtStyles.mustard, color: vtStyles.ink, fontFamily: vtStyles.bungee, fontSize: 18, border: `2.5px solid ${vtStyles.ink}`, boxShadow: `3px 3px 0 ${vtStyles.ink}` }}>{m.p2.odd.toFixed(2)}</div>
          </div>
        </div>

        {/* Floating ball */}
        <div style={{ position: 'absolute', top: 100, right: 60, transform: 'rotate(20deg)' }}>
          <VTBall size={40} />
        </div>
      </div>

      {/* Bottom ribbon */}
      <div style={{ background: vtStyles.ink, color: vtStyles.cream, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', fontFamily: vtStyles.accent, fontSize: 12, letterSpacing: 2 }}>
        <span>★ APUESTE AHORA</span>
        <div style={{ flex: 1, borderTop: `1.5px dotted ${vtStyles.mustard}80` }} />
        <span style={{ color: vtStyles.mustard }}>{m.watching} ALMAS MIRANDO</span>
        <div style={{ flex: 1, borderTop: `1.5px dotted ${vtStyles.mustard}80` }} />
        <span>$ {(m.totalBet/1000).toFixed(1)}K EN JUEGO ★</span>
      </div>
    </div>
  );
}

function VTGroupCard({ k, g, accentColor }) {
  return (
    <div style={{
      background: vtStyles.cream,
      border: `3px solid ${vtStyles.ink}`,
      boxShadow: `5px 5px 0 ${vtStyles.ink}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ background: accentColor, color: vtStyles.cream, padding: '8px 14px', borderBottom: `3px solid ${vtStyles.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(255,240,200,0.15)', 4) }} />
        <span style={{ fontFamily: vtStyles.display, fontSize: 18, letterSpacing: 1, position: 'relative' }}>{g.name}</span>
        <span style={{ fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2, position: 'relative' }}>JORN. 3/4</span>
      </div>
      <div style={{ padding: '4px 12px 10px' }}>
        {g.players.map((p, i) => (
          <div key={p.n} style={{
            display: 'grid', gridTemplateColumns: '22px 1fr 28px 28px 36px',
            alignItems: 'center', gap: 6,
            padding: '8px 0',
            borderBottom: i < 3 ? `1.5px dashed ${vtStyles.ink}40` : 'none',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: i < 2 ? vtStyles.mustard : vtStyles.paperDeep,
              border: `2px solid ${vtStyles.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: vtStyles.display, fontSize: 11, color: vtStyles.ink,
            }}>{i + 1}</div>
            <div>
              <div style={{ fontFamily: vtStyles.serif, fontSize: 13, color: vtStyles.ink, letterSpacing: 0.2 }}>{p.n}</div>
              <div style={{ fontFamily: vtStyles.body, fontSize: 9, color: vtStyles.inkSoft, letterSpacing: 0.5 }}>{p.fac}</div>
            </div>
            <span style={{ fontFamily: vtStyles.body, fontSize: 11, color: vtStyles.inkSoft, textAlign: 'center' }}>{p.pg}/{p.pj}</span>
            <span style={{ fontFamily: vtStyles.body, fontSize: 11, color: vtStyles.inkSoft, textAlign: 'center' }}>{p.sf}-{p.sc}</span>
            <span style={{ fontFamily: vtStyles.display, fontSize: 18, color: i < 2 ? vtStyles.red : vtStyles.ink, textAlign: 'right' }}>{p.pts}</span>
          </div>
        ))}
      </div>
      {/* Bottom stamp */}
      <div style={{ background: vtStyles.ink, color: vtStyles.mustard, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2 }}>
        <span>★ CLASIFICAN 2 ★</span>
        <span>CUOTA GANADOR · {(1 + Math.random() * 1.4).toFixed(2)}</span>
      </div>
    </div>
  );
}

function VintageHome() {
  const accents = [vtStyles.red, vtStyles.teal, vtStyles.mustardDk, vtStyles.tealDk];
  return (
    <div style={{
      width: '100%', height: '100%',
      ...paperTexture,
      fontFamily: vtStyles.body, color: vtStyles.ink,
      overflow: 'hidden',
    }}>
      <VTTopBanner />
      <VTMarquee />

      <div style={{ padding: '24px 32px 40px' }}>
        {/* Hero row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 24 }}>
          <VTPoster />

          {/* Side: Today's Slate */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <VTRibbon color={vtStyles.teal} textColor={vtStyles.cream} height={40}>EL CALENDARIO</VTRibbon>
            </div>
            <div style={{
              background: vtStyles.cream,
              border: `3px solid ${vtStyles.ink}`,
              boxShadow: `5px 5px 0 ${vtStyles.ink}`,
              padding: '4px 0',
              position: 'relative',
            }}>
              {UPCOMING.slice(0, 5).map((u, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '64px 1fr auto',
                  alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  borderBottom: i < 4 ? `1.5px dashed ${vtStyles.ink}30` : 'none',
                }}>
                  <div style={{
                    fontFamily: vtStyles.display, fontSize: 22, color: vtStyles.red, letterSpacing: -0.5,
                    background: vtStyles.paperDeep, border: `2px solid ${vtStyles.ink}`,
                    textAlign: 'center', padding: '2px 0',
                    boxShadow: `2px 2px 0 ${vtStyles.ink}`,
                  }}>{u.time}</div>
                  <div>
                    <div style={{ fontFamily: vtStyles.serif, fontSize: 13, color: vtStyles.ink, letterSpacing: 0.2 }}>{u.p1} <span style={{ color: vtStyles.red, fontFamily: vtStyles.accent, margin: '0 4px' }}>vs</span> {u.p2}</div>
                    <div style={{ fontFamily: vtStyles.body, fontSize: 9, color: vtStyles.inkSoft, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>GRUPO {u.group} · MESA {(i % 3) + 1}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {u.odds.slice(0, 2).map((o, j) => (
                      <div key={j} style={{
                        padding: '5px 8px',
                        border: `2px solid ${vtStyles.ink}`,
                        background: j === 0 ? vtStyles.mustard : vtStyles.cream,
                        fontFamily: vtStyles.bungee, fontSize: 12, color: vtStyles.ink,
                        boxShadow: `1.5px 2px 0 ${vtStyles.ink}`, minWidth: 38, textAlign: 'center',
                      }}>{o.toFixed(2)}</div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ background: vtStyles.ink, color: vtStyles.cream, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: vtStyles.accent, fontSize: 10, letterSpacing: 2 }}>
                <span>★ VER LOS 7 DEL DÍA</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ margin: '30px 0 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <VTOrnamentalDivider />
          </div>
          <div style={{ textAlign: 'center', marginTop: -28, position: 'relative' }}>
            <span style={{
              display: 'inline-block', padding: '6px 20px',
              background: vtStyles.paper, color: vtStyles.ink,
              fontFamily: vtStyles.display, fontSize: 26, letterSpacing: 1.5,
            }}>LA Fase de Grupos</span>
          </div>
          <div style={{ textAlign: 'center', fontFamily: vtStyles.accent, fontSize: 11, letterSpacing: 3, color: vtStyles.inkSoft, marginTop: 4 }}>
            ★ 16 jugadores · 4 grupos · clasifican los 2 mejores ★
          </div>
        </div>

        {/* Groups */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 18 }}>
          {Object.entries(GROUPS).map(([k, g], i) => (
            <VTGroupCard key={k} k={k} g={g} accentColor={accents[i]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Vintage Bets artboard ----

function VTTicket({ children, color = vtStyles.cream, accent = vtStyles.red }) {
  // Ticket-like card with notched edges
  return (
    <div style={{
      position: 'relative',
      background: color,
      border: `3px solid ${vtStyles.ink}`,
      boxShadow: `4px 5px 0 ${vtStyles.ink}`,
    }}>
      {/* Punch holes left/right */}
      {[-7, 'auto'].map((l, i) => (
        <React.Fragment key={i}>
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            [i === 0 ? 'left' : 'right']: -7,
            width: 14, height: 14, borderRadius: '50%',
            background: vtStyles.paper,
            border: `3px solid ${vtStyles.ink}`,
          }} />
        </React.Fragment>
      ))}
      {children}
    </div>
  );
}

function VintageBets() {
  return (
    <div style={{
      width: '100%', height: '100%',
      ...paperTexture,
      fontFamily: vtStyles.body, color: vtStyles.ink,
      overflow: 'hidden',
    }}>
      <VTTopBanner />
      <VTMarquee />

      <div style={{ padding: '24px 32px 40px' }}>
        {/* Big title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: vtStyles.accent, fontSize: 13, letterSpacing: 4, color: vtStyles.inkSoft }}>SECCIÓN ESPECIAL</div>
            <div style={{ fontFamily: vtStyles.display, fontSize: 56, letterSpacing: -1.5, color: vtStyles.ink, lineHeight: 0.95 }}>Casa de Apuestas</div>
            <div style={{ fontFamily: vtStyles.body, fontSize: 13, color: vtStyles.inkSoft, marginTop: 4, letterSpacing: 0.5 }}>"Done su moneda, escoja su atleta, y que la suerte le sonría."</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            background: vtStyles.mustard, border: `3px solid ${vtStyles.ink}`,
            padding: '10px 18px', boxShadow: `4px 4px 0 ${vtStyles.ink}`,
            transform: 'rotate(-3deg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{ fontFamily: vtStyles.accent, fontSize: 10, letterSpacing: 3 }}>JACKPOT DEL DÍA</span>
            <span style={{ fontFamily: vtStyles.display, fontSize: 32, lineHeight: 1, color: vtStyles.redDark }}>$580.000</span>
            <span style={{ fontFamily: vtStyles.body, fontSize: 9, letterSpacing: 1 }}>· PRONOSTICO PERFECTO ·</span>
          </div>
        </div>

        {/* Main grid: featured ticket + side stack */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
          {/* Featured: TOP CARTOMANTE'S PICK */}
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <VTRibbon color={vtStyles.red} height={36}>EL FAVORITO</VTRibbon>
              <VTRibbon color={vtStyles.ink} textColor={vtStyles.mustard} height={36}>MEJORADA +0.30</VTRibbon>
            </div>
            <div style={{
              background: vtStyles.teal,
              border: `4px solid ${vtStyles.ink}`,
              boxShadow: `7px 8px 0 ${vtStyles.ink}`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(255,240,200,0.18)', 6), pointerEvents: 'none' }} />
              {/* burst */}
              <div style={{
                position: 'absolute', inset: 0,
                background: `repeating-conic-gradient(from 20deg at 30% 50%, rgba(255,235,180,0.12) 0deg 10deg, transparent 10deg 22deg)`,
                pointerEvents: 'none',
              }} />
              <div style={{ padding: '24px 28px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                  <VTPaddle size={130} color={vtStyles.red} angle={-15} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: vtStyles.accent, fontSize: 11, letterSpacing: 3, color: vtStyles.mustard }}>★ APUESTA RECOMENDADA ★</div>
                    <div style={{ fontFamily: vtStyles.display, fontSize: 38, color: vtStyles.cream, lineHeight: 1, letterSpacing: -0.5, marginTop: 4 }}>"PULPO" MORALES<br /><span style={{ fontSize: 18, fontFamily: vtStyles.accent, letterSpacing: 3 }}>gana el grupo D</span></div>
                    <div style={{ fontFamily: vtStyles.body, fontSize: 12, color: vtStyles.cream, opacity: 0.85, marginTop: 12, lineHeight: 1.5, maxWidth: 360 }}>
                      Invicto en sus 3 jornadas. Promedia 11-3 por set. La pala de Ed. Física no perdona en mesa de cemento.
                    </div>
                  </div>
                  <div style={{
                    background: vtStyles.cream,
                    border: `3.5px solid ${vtStyles.ink}`,
                    padding: '14px 22px',
                    boxShadow: `4px 5px 0 ${vtStyles.ink}`,
                    textAlign: 'center',
                    minWidth: 130,
                  }}>
                    <div style={{ fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2.5, color: vtStyles.inkSoft }}>CUOTA</div>
                    <div style={{ fontFamily: vtStyles.display, fontSize: 48, lineHeight: 1, color: vtStyles.red, letterSpacing: -1 }}>1.40</div>
                    <div style={{ fontFamily: vtStyles.body, fontSize: 9, color: vtStyles.inkSoft, letterSpacing: 1, marginTop: 4 }}>$10K → $14K</div>
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `2px dashed ${vtStyles.cream}50`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { k: 'Forma', v: 'WWW' },
                    { k: 'Sets gan.', v: '9' },
                    { k: 'Sets perd.', v: '1' },
                    { k: 'Aces/set', v: '3.8' },
                    { k: 'Mesa fav.', v: '#2' },
                  ].map(s => (
                    <div key={s.k} style={{ background: vtStyles.tealDk, border: `2px solid ${vtStyles.ink}`, padding: '6px 12px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontFamily: vtStyles.body, fontSize: 9, color: vtStyles.mustard, letterSpacing: 1, textTransform: 'uppercase' }}>{s.k}</span>
                      <span style={{ fontFamily: vtStyles.display, fontSize: 16, color: vtStyles.cream, lineHeight: 1 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Markets grid below */}
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <VTRibbon color={vtStyles.mustard} textColor={vtStyles.ink} height={36}>MERCADOS DEL DÍA</VTRibbon>
                <div style={{ flex: 1, height: 2, background: vtStyles.ink, opacity: 0.4 }} />
                <span style={{ fontFamily: vtStyles.body, fontSize: 10, letterSpacing: 1.5, color: vtStyles.inkSoft }}>32 MERCADOS</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { title: 'GANADOR DE LA COPA', opts: [['Pulpo Morales', 3.20, true], ['Tornado López', 3.80], ['Profe Ramírez', 4.50], ['Chino Pérez', 5.00], ['Otro', 7.00]] },
                  { title: 'CAMPEÓN POR FACULTAD', opts: [['Ed. Física', 2.40], ['Derecho', 3.60], ['Ing. Sistemas', 4.20], ['Diseño', 6.80]] },
                  { title: 'TOTAL DE SETS EN LA FINAL', opts: [['Más de 4.5', 1.85], ['Menos de 4.5', 1.92]] },
                  { title: 'PARTIDO MÁS LARGO', opts: [['Cuartos', 2.80], ['Semis', 2.20], ['Final', 1.85]] },
                ].map((mk, i) => (
                  <div key={i} style={{ background: vtStyles.cream, border: `3px solid ${vtStyles.ink}`, boxShadow: `4px 4px 0 ${vtStyles.ink}` }}>
                    <div style={{ padding: '8px 12px', borderBottom: `2px solid ${vtStyles.ink}`, fontFamily: vtStyles.display, fontSize: 13, letterSpacing: 1, color: vtStyles.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{mk.title}</span>
                      <VTStar size={10} />
                    </div>
                    <div style={{ padding: 10 }}>
                      {mk.opts.map(([label, val, picked], j) => (
                        <div key={j} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 8px',
                          background: picked ? vtStyles.mustard : 'transparent',
                          borderBottom: j < mk.opts.length - 1 ? `1.5px dashed ${vtStyles.ink}30` : 'none',
                          border: picked ? `2px solid ${vtStyles.ink}` : 'none',
                        }}>
                          <span style={{ fontFamily: vtStyles.serif, fontSize: 12, color: vtStyles.ink }}>{label}</span>
                          <span style={{ fontFamily: vtStyles.bungee, fontSize: 13, color: vtStyles.red }}>{val.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Bet ticket + bonus */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <VTRibbon color={vtStyles.ink} textColor={vtStyles.mustard} height={36}>SU BOLETO</VTRibbon>
            </div>

            <VTTicket>
              <div style={{ padding: '14px 18px', background: vtStyles.ink, color: vtStyles.cream, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: vtStyles.display, fontSize: 20, letterSpacing: 1, color: vtStyles.mustard }}>BOLETO #4471</span>
                <span style={{ fontFamily: vtStyles.body, fontSize: 9, letterSpacing: 1.5 }}>EXP. 21·MAY·2026 — 22:00</span>
              </div>
              <div style={{ padding: '18px 20px', borderBottom: `2px dashed ${vtStyles.ink}50` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {BET_SLIP.map((b, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2, color: vtStyles.inkSoft }}>SELECCIÓN {i + 1} · {b.type.toUpperCase()}</div>
                      <div style={{ fontFamily: vtStyles.display, fontSize: 18, color: vtStyles.ink, letterSpacing: 0.2, marginTop: 2 }}>{b.pick}</div>
                      <div style={{ fontFamily: vtStyles.body, fontSize: 10, color: vtStyles.inkSoft, letterSpacing: 1, marginTop: 2 }}>{b.match}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontFamily: vtStyles.serif, fontSize: 11, color: vtStyles.inkSoft }}>cuota</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: vtStyles.bungee, fontSize: 16, color: vtStyles.red }}>{b.odd.toFixed(2)}</span>
                          <span style={{ fontFamily: vtStyles.body, fontSize: 10, color: vtStyles.inkSoft }}>·</span>
                          <span style={{ fontFamily: vtStyles.bungee, fontSize: 14, color: vtStyles.ink }}>${b.amount.toLocaleString('es')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div style={{ padding: '14px 20px', background: vtStyles.paperDeep, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: vtStyles.body, fontSize: 11, letterSpacing: 1, color: vtStyles.inkSoft }}>CUOTA COMBINADA</span>
                  <span style={{ fontFamily: vtStyles.display, fontSize: 18, color: vtStyles.ink }}>{(1.42 * 3.20).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: vtStyles.body, fontSize: 11, letterSpacing: 1, color: vtStyles.inkSoft }}>APUESTA TOTAL</span>
                  <span style={{ fontFamily: vtStyles.display, fontSize: 18, color: vtStyles.ink }}>$ 35.000</span>
                </div>
                <div style={{ borderTop: `2px dashed ${vtStyles.ink}50`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: vtStyles.accent, fontSize: 11, letterSpacing: 2, color: vtStyles.redDark }}>POSIBLE GANANCIA</span>
                  <span style={{ fontFamily: vtStyles.display, fontSize: 32, color: vtStyles.red, lineHeight: 1, letterSpacing: -1 }}>$ 159.040</span>
                </div>
              </div>

              <div style={{ padding: '14px 20px', background: vtStyles.red, color: vtStyles.cream, textAlign: 'center', fontFamily: vtStyles.display, fontSize: 22, letterSpacing: 1.5, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(255,240,200,0.2)', 4) }} />
                <span style={{ position: 'relative' }}>★ CONFIRMAR APUESTA ★</span>
              </div>
            </VTTicket>

            {/* Bonus card */}
            <div style={{ marginTop: 18 }}>
              <div style={{
                background: vtStyles.mustard,
                border: `3px solid ${vtStyles.ink}`,
                boxShadow: `4px 5px 0 ${vtStyles.ink}`,
                padding: '14px 18px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <div style={{ position: 'absolute', inset: 0, ...halftone('rgba(26,18,8,0.15)', 5) }} />
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: vtStyles.red, border: `3px solid ${vtStyles.ink}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: vtStyles.display, fontSize: 22, color: vtStyles.cream,
                  boxShadow: `3px 3px 0 ${vtStyles.ink}`,
                  position: 'relative', flexShrink: 0,
                  transform: 'rotate(-8deg)',
                }}>+15%</div>
                <div style={{ position: 'relative' }}>
                  <div style={{ fontFamily: vtStyles.display, fontSize: 18, letterSpacing: 0.5, color: vtStyles.ink, lineHeight: 1 }}>BONO DE LA SUERTE</div>
                  <div style={{ fontFamily: vtStyles.body, fontSize: 11, color: vtStyles.inkSoft, marginTop: 4, lineHeight: 1.4, letterSpacing: 0.3 }}>Combina 3 mesas distintas y obtenga 15% extra en su ganancia. Válido hoy.</div>
                </div>
              </div>
            </div>

            {/* Cash out */}
            <div style={{ marginTop: 14 }}>
              <div style={{
                background: vtStyles.cream, border: `3px solid ${vtStyles.ink}`,
                boxShadow: `4px 5px 0 ${vtStyles.ink}`,
                padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: vtStyles.display, fontSize: 16, letterSpacing: 0.5 }}>RETIRO ANTICIPADO</span>
                  <span style={{ fontFamily: vtStyles.accent, fontSize: 9, letterSpacing: 2, color: vtStyles.teal }}>● DISPONIBLE</span>
                </div>
                <div style={{ fontFamily: vtStyles.body, fontSize: 11, color: vtStyles.inkSoft, marginBottom: 10, letterSpacing: 0.3 }}>
                  Su boleto #4470 (López gana set 2) puede retirarse ahora por:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: vtStyles.teal, border: `2.5px solid ${vtStyles.ink}`, color: vtStyles.cream }}>
                  <span style={{ fontFamily: vtStyles.accent, fontSize: 11, letterSpacing: 2 }}>★ TOMAR AHORA</span>
                  <span style={{ fontFamily: vtStyles.display, fontSize: 24, color: vtStyles.mustard }}>$ 42.300</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer ornamental */}
        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16, fontFamily: vtStyles.accent, fontSize: 11, letterSpacing: 3, color: vtStyles.inkSoft }}>
          <div style={{ flex: 1, borderTop: `2px solid ${vtStyles.ink}` }} />
          <VTStar size={12} />
          <span>"PALA EN MANO, FORTUNA EN PIE" — COPA CONCRETO MMXXVI</span>
          <VTStar size={12} />
          <div style={{ flex: 1, borderTop: `2px solid ${vtStyles.ink}` }} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VintageHome, VintageBets });
