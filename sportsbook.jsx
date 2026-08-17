// Dirección A · Sportsbook estilo Stake — versión colorida y amigable
// Cards completas en color de categoría. Solo "¿Quién gana?" como mercado.
// Paleta FI UNAM como acento global, fondo dark Stake.

const sbStyles = {
  bg:        '#0f1419',
  bgDeep:    '#0a0e12',
  panel:     '#161b22',
  panel2:    '#1c222b',
  card:      '#222933',
  cardHover: '#2a323e',
  line:      '#2a313c',
  lineSoft:  '#222932',
  text:      '#eef1f5',
  muted:     '#8a93a0',
  mutedSoft: '#5e6773',

  fiRed:     '#d92438',
  fiRedDk:   '#a8182a',
  fiRedSoft: '#3a1418',
  unamGold:  '#f0b429',
  unamGoldD: '#a87a14',

  font:      'Inter, system-ui, sans-serif',
  mono:      '"JetBrains Mono", ui-monospace, monospace',
};

const radius = { sm: 6, md: 10, lg: 14, xl: 18 };

// ── Iconography ─────────────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor' }) {
  const s = size;
  const stroke = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'menu': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case 'play': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...stroke} /><path d="M10 8.5l6 3.5-6 3.5z" fill={color} /></svg>;
    case 'clock': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...stroke} /><path d="M12 7v5l3 2" {...stroke} /></svg>;
    case 'grid': return <svg width={s} height={s} viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="4" y="13" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="13" width="7" height="7" rx="1" {...stroke} /></svg>;
    case 'ticket': return <svg width={s} height={s} viewBox="0 0 24 24"><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z" {...stroke} /><path d="M15 6v12" {...stroke} strokeDasharray="2 3" /></svg>;
    case 'paddle': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="10" cy="9" r="6" fill={color} /><rect x="13" y="13" width="3" height="8" rx="1.4" fill={color} transform="rotate(-30 14.5 17)" /></svg>;
    case 'ball': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill={color} /></svg>;
    case 'chevron': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M9 6l6 6-6 6" /></svg>;
    case 'search': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" {...stroke} /><path {...stroke} d="M20 20l-4-4" /></svg>;
    case 'bell': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M6 10a6 6 0 1112 0c0 4 2 5 2 5H4s2-1 2-5zM10 19a2 2 0 004 0" /></svg>;
    case 'people': return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="9" cy="9" r="3" {...stroke} /><path {...stroke} d="M3 19a6 6 0 0112 0M16 6a3 3 0 010 6M21 19a5 5 0 00-3-4.6" /></svg>;
    case 'fire': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M12 2c1 4 5 6 5 11a5 5 0 11-10 0c0-3 2-4 2-7 2 1 3 3 3 6z" /></svg>;
    case 'star': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M12 3l2.9 6 6.6.6-5 4.6 1.5 6.4L12 17l-6 3.6 1.5-6.4-5-4.6 6.6-.6z" /></svg>;
    case 'wallet': return <svg width={s} height={s} viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" {...stroke} /><path d="M16 13h3" {...stroke} /><path d="M17 6V4a1 1 0 00-1.3-1L4 7" {...stroke} /></svg>;
    case 'live': return <svg width={s} height={s} viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="11" rx="2" {...stroke} /><path d="M17 10l4-2v8l-4-2z" fill={color} /></svg>;
    case 'shield': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M12 3l8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6z" /><path d="M9 12l2 2 4-4" {...stroke} /></svg>;
    case 'boost': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M5 19c4-6 8-10 14-14M9 19c0-3 3-6 6-7M5 19l4 0M9 19l0-4" /></svg>;
    case 'cup': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M7 4h10v6a5 5 0 01-10 0zM7 7H4v2a3 3 0 003 3M17 7h3v2a3 3 0 01-3 3M10 18h4M9 21h6" /></svg>;
    case 'heart': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M12 21s-8-4.5-8-11a5 5 0 019-3 5 5 0 019 3c0 6.5-8 11-8 11z" /></svg>;
    case 'spark': return <svg width={s} height={s} viewBox="0 0 24 24"><path {...stroke} d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>;
    default: return null;
  }
}

// ── Colorful match card (full bleed in category color) ──────────────────
function MatchCard({ m, big = false }) {
  const c = CATS[m.cat];
  return (
    <div style={{
      background: `linear-gradient(140deg, ${c.color} 0%, ${c.dark} 75%, ${c.deep} 100%)`,
      borderRadius: radius.lg,
      padding: big ? 22 : 16,
      position: 'relative',
      overflow: 'hidden',
      color: '#fff',
      boxShadow: `0 14px 30px -10px ${c.color}80, inset 0 1px 0 rgba(255,255,255,0.18)`,
    }}>
      {/* Decorative paddles + ball */}
      <div style={{ position: 'absolute', top: -40, right: -50, opacity: 0.13, transform: 'rotate(28deg)', pointerEvents: 'none' }}>
        <Icon name="paddle" size={170} color="#fff" />
      </div>
      <div style={{ position: 'absolute', bottom: -50, left: -50, opacity: 0.09, transform: 'rotate(-160deg)', pointerEvents: 'none' }}>
        <Icon name="paddle" size={140} color="#fff" />
      </div>
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', opacity: 0.18, pointerEvents: 'none' }}>
        <Icon name="ball" size={16} color="#fff" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.18) 0%, transparent 50%)', pointerEvents: 'none' }} />

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        {m.live ? (
          <span style={{
            background: '#fff', color: c.dark,
            padding: '4px 11px', borderRadius: 999,
            fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
            display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
            boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            EN VIVO · {m.set}
          </span>
        ) : (
          <span style={{
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            padding: '5px 12px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(4px)',
          }}>
            <Icon name="clock" size={12} /> {m.time}
          </span>
        )}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{c.name} · {m.group}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <Icon name="people" size={13} /> {m.watchers}
        </span>
      </div>

      {/* Players row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: `0 6px 16px rgba(0,0,0,0.25)`,
          }}><Icon name="paddle" size={28} color={c.color} /></div>
          <div style={{ fontSize: big ? 18 : 15, fontWeight: 800, color: '#fff', letterSpacing: -0.2, lineHeight: 1.15 }}>{m.p1}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,0.22)',
            border: '2px solid rgba(255,255,255,0.4)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: 0.5,
          }}>VS</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: `0 6px 16px rgba(0,0,0,0.25)`,
            transform: 'scaleX(-1)',
          }}><Icon name="paddle" size={28} color={c.color} /></div>
          <div style={{ fontSize: big ? 18 : 15, fontWeight: 800, color: '#fff', letterSpacing: -0.2, lineHeight: 1.15 }}>{m.p2}</div>
        </div>
      </div>

      {/* Sentiment bar */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.9)', marginBottom: 5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          <span>{m.pct}% le va a {m.p1.split(' ').pop()}</span>
          <span>{100 - m.pct}% a {m.p2.split(' ').pop()}</span>
        </div>
        <div style={{ height: 7, background: 'rgba(0,0,0,0.28)', borderRadius: 999, overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
          <div style={{ width: `${m.pct}%`, height: '100%', background: '#fff', borderRadius: 999 }} />
        </div>
      </div>

      {/* Question + odds */}
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)', fontWeight: 700, letterSpacing: 0.6, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' }}>¿Quién gana?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative' }}>
        {[[m.p1, m.odds[0], 0], [m.p2, m.odds[2], 1]].map(([name, val, i]) => (
          <div key={i} style={{
            background: '#fff', color: c.dark,
            padding: '12px 14px', borderRadius: radius.md,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontWeight: 800,
            boxShadow: `0 6px 18px rgba(0,0,0,0.2)`,
            border: `1px solid rgba(255,255,255,0.6)`,
          }}>
            <span style={{ fontSize: 13, color: c.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.split(' ').pop()}</span>
            <span style={{ fontSize: 18, fontFamily: sbStyles.mono, color: c.dark }}>{val.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pill toggle ─────────────────────────────────────────────────────────
function PillToggle({ active = 'Apuestas' }) {
  return (
    <div style={{ display: 'inline-flex', background: sbStyles.bgDeep, borderRadius: 999, padding: 4, gap: 4, border: `1px solid ${sbStyles.line}` }}>
      {['Casino', 'Apuestas'].map(k => {
        const isActive = k === active;
        const bg = k === 'Apuestas' ? sbStyles.fiRed : sbStyles.unamGold;
        return (
          <div key={k} style={{
            padding: '7px 18px',
            borderRadius: 999,
            background: isActive ? bg : 'transparent',
            color: isActive ? (k === 'Apuestas' ? '#fff' : sbStyles.bgDeep) : sbStyles.muted,
            fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
          }}>{k}</div>
        );
      })}
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{ background: sbStyles.panel, borderBottom: `1px solid ${sbStyles.line}`, height: 60, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sbStyles.muted }}>
          <Icon name="menu" size={20} />
        </div>
        <PillToggle active="Apuestas" />
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: radius.sm,
            background: sbStyles.fiRed,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, letterSpacing: -0.5,
            fontFamily: sbStyles.font, fontSize: 12,
            boxShadow: `inset 0 0 0 2px ${sbStyles.fiRedDk}, 0 0 14px ${sbStyles.fiRed}55`,
          }}>FI</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 1.2 }}>COPA CONCRETO</span>
            <span style={{ fontSize: 9, color: sbStyles.muted, letterSpacing: 1.4, textTransform: 'uppercase' }}>Facultad de Ingeniería · XII Edición</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: sbStyles.bgDeep, border: `1px solid ${sbStyles.line}`, borderRadius: radius.md, padding: '6px 10px 6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#fff', fontFamily: sbStyles.mono, fontWeight: 700 }}>$ 145,500</span>
          <span style={{ fontSize: 10, color: sbStyles.unamGold, fontFamily: sbStyles.mono }}>MXN</span>
          <div style={{
            background: sbStyles.fiRed, color: '#fff',
            padding: '5px 14px', borderRadius: radius.sm,
            fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Icon name="wallet" size={13} /> Cartera
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: radius.md, background: sbStyles.bgDeep, border: `1px solid ${sbStyles.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sbStyles.muted }}>
          <Icon name="bell" size={16} />
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: sbStyles.fiRedSoft, border: `1.5px solid ${sbStyles.fiRed}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>JR</div>
      </div>
    </div>
  );
}

// ── Left rail ───────────────────────────────────────────────────────────
function NavItem({ icon, label, badge, active = false, color, big = false }) {
  return (
    <div style={{
      padding: big ? '11px 16px' : '9px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: active ? sbStyles.cardHover : 'transparent',
      borderLeft: active ? `3px solid ${color || sbStyles.fiRed}` : '3px solid transparent',
      cursor: 'pointer',
    }}>
      {icon && (
        <span style={{ color: color || (active ? '#fff' : sbStyles.muted), display: 'flex' }}>
          {typeof icon === 'string' ? <Icon name={icon} size={big ? 18 : 16} /> : icon}
        </span>
      )}
      <span style={{ flex: 1, fontSize: big ? 14 : 13, color: active ? '#fff' : sbStyles.text, fontWeight: active ? 700 : 500 }}>{label}</span>
      {badge != null && (
        <span style={{
          fontSize: 10, color: active ? '#fff' : sbStyles.muted,
          background: active ? (color || sbStyles.fiRed) : sbStyles.bgDeep,
          padding: '2px 8px', borderRadius: 10, fontWeight: 700,
          minWidth: 22, textAlign: 'center',
        }}>{badge}</span>
      )}
    </div>
  );
}

function CategoryRailCard({ c, active }) {
  return (
    <div style={{
      margin: '4px 12px',
      borderRadius: radius.md,
      background: active
        ? `linear-gradient(135deg, ${c.color} 0%, ${c.dark} 100%)`
        : sbStyles.card,
      border: active ? 'none' : `1px solid ${sbStyles.line}`,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'relative', overflow: 'hidden',
      boxShadow: active ? `0 6px 18px -6px ${c.color}90` : 'none',
    }}>
      {active && (
        <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.18, pointerEvents: 'none' }}>
          <Icon name="paddle" size={80} color="#fff" />
        </div>
      )}
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: active ? 'rgba(255,255,255,0.25)' : c.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? 'inset 0 0 0 2px rgba(255,255,255,0.4)' : 'none',
        position: 'relative',
      }}>
        <Icon name="paddle" size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#fff' : sbStyles.text }}>{c.name}</div>
        <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.8)' : sbStyles.muted, letterSpacing: 0.4 }}>{c.emoji} · nivel</div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 800, fontFamily: sbStyles.mono,
        color: active ? '#fff' : c.color,
        background: active ? 'rgba(255,255,255,0.2)' : `${c.color}22`,
        padding: '3px 9px', borderRadius: 10,
        position: 'relative',
      }}>{c.k === 'AV' ? '8' : c.k === 'IN' ? '8' : '8'}</span>
    </div>
  );
}

function LeftRail({ activeCat }) {
  return (
    <aside style={{ width: 240, background: sbStyles.panel, borderRight: `1px solid ${sbStyles.line}`, padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
      <NavItem icon={<Icon name="play" size={18} color={sbStyles.fiRed} />} label="En vivo" badge={3} active big />
      <NavItem icon="clock" label="Empezando pronto" badge={9} big />
      <NavItem icon="grid" label="Todos los retos" badge={42} big />
      <NavItem icon="ticket" label="Mis apuestas" badge={2} big />
      <NavItem icon="star" label="Favoritos" big />

      <div style={{ padding: '20px 16px 8px', fontSize: 10, color: sbStyles.mutedSoft, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>Por nivel</div>
      {Object.values(CATS).map(c => (
        <CategoryRailCard key={c.k} c={c} active={activeCat === c.k} />
      ))}

      <div style={{ flex: 1 }} />

      {/* Promotion card */}
      <div style={{
        margin: '12px 12px 12px',
        borderRadius: radius.lg,
        background: `linear-gradient(135deg, ${sbStyles.unamGold} 0%, ${sbStyles.unamGoldD} 100%)`,
        padding: '14px 14px 16px',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 10px 24px -8px ${sbStyles.unamGold}80`,
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.2 }}>
          <Icon name="cup" size={100} color="#fff" />
        </div>
        <div style={{ fontSize: 10, color: sbStyles.bgDeep, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 800, marginBottom: 4 }}>PREMIO MAYOR</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: sbStyles.bgDeep, letterSpacing: -0.5, lineHeight: 1, position: 'relative' }}>$ 580,000</div>
        <div style={{ fontSize: 11, color: sbStyles.bgDeep, marginTop: 6, opacity: 0.8, position: 'relative' }}>Acierta los grupos completos</div>
      </div>
    </aside>
  );
}

// ── Hero promo cards ────────────────────────────────────────────────────
function HeroCard({ kicker, kickerBg, title, sub, cta, ctaBg, bg, illust }) {
  return (
    <div style={{
      background: bg, borderRadius: radius.lg, overflow: 'hidden',
      position: 'relative', minHeight: 130,
      display: 'flex', alignItems: 'stretch',
      boxShadow: `0 10px 24px -10px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, position: 'relative', zIndex: 2 }}>
        <span style={{
          alignSelf: 'flex-start',
          fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase',
          color: '#fff', background: kickerBg,
          padding: '3px 9px', borderRadius: 12,
        }}>{kicker}</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.05, textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, maxWidth: 210 }}>{sub}</span>
        <div style={{
          marginTop: 'auto',
          alignSelf: 'flex-start',
          background: ctaBg, color: '#fff',
          padding: '7px 14px', borderRadius: radius.sm,
          fontSize: 12, fontWeight: 800,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>{cta} ›</div>
      </div>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {illust}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.16) 0%, transparent 50%)', pointerEvents: 'none' }} />
    </div>
  );
}

function HeroCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <HeroCard
        kicker="Nuevo"
        kickerBg="rgba(0,0,0,0.3)"
        title="Escudo FI"
        sub="Mete 3+ picks, te cubrimos si fallas una"
        cta="Cómo funciona"
        ctaBg={sbStyles.fiRedDk}
        bg={`linear-gradient(135deg, #e63946 0%, ${sbStyles.fiRed} 50%, ${sbStyles.fiRedDk} 100%)`}
        illust={
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={100} color="rgba(255,255,255,0.92)" />
            <span style={{ position: 'absolute', fontSize: 28, fontWeight: 900, color: sbStyles.fiRedDk, textShadow: 'none' }}>FI</span>
          </div>
        }
      />
      <HeroCard
        kicker="Promo"
        kickerBg="rgba(0,0,0,0.3)"
        title="Boost +15%"
        sub="En combinadas con 3 niveles distintos"
        cta="Apostar ahora"
        ctaBg={sbStyles.unamGoldD}
        bg={`linear-gradient(135deg, #f0b429 0%, #d4901f 60%, #a87a14 100%)`}
        illust={<Icon name="spark" size={90} color="#fff" />}
      />
      <HeroCard
        kicker="Especial"
        kickerBg="rgba(0,0,0,0.3)"
        title="Pronóstico Perfecto"
        sub="Adivina los 6 grupos y gana $580,000"
        cta="Participar gratis"
        ctaBg="#0a3d1f"
        bg={`linear-gradient(135deg, #34d399 0%, #16a34a 50%, #0a3d1f 100%)`}
        illust={<Icon name="cup" size={90} color="#fff" />}
      />
    </div>
  );
}

// ── Section header (colorida) ───────────────────────────────────────────
function SectionHeader({ title, sub, cat, action, icon, iconColor }) {
  const c = cat ? CATS[cat] : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      {c ? (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${c.color} 0%, ${c.dark} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 14px -4px ${c.color}90`,
        }}><Icon name="paddle" size={20} color="#fff" /></div>
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: iconColor || sbStyles.fiRed,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 14px -4px ${iconColor || sbStyles.fiRed}90`,
        }}><Icon name={icon || 'fire'} size={20} color="#fff" /></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 16, color: '#fff', fontWeight: 800, letterSpacing: -0.2 }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: sbStyles.muted }}>{sub}</span>}
      </div>
      <div style={{ flex: 1 }} />
      {action && <span style={{ fontSize: 12, color: c ? c.color : sbStyles.fiRed, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>{action} <Icon name="chevron" size={14} /></span>}
    </div>
  );
}

// ── Search + tabs ───────────────────────────────────────────────────────
function MainTabs() {
  const tabs = [
    { k: 'Todos', icon: 'grid', active: true },
    { k: 'En vivo', icon: 'live', badge: 3 },
    { k: 'Próximos', icon: 'clock' },
    { k: 'Mis picks', icon: 'ticket' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, background: sbStyles.bgDeep, padding: 6, borderRadius: radius.md, border: `1px solid ${sbStyles.line}` }}>
      {tabs.map(t => (
        <div key={t.k} style={{
          flex: 1, padding: '10px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: t.active ? sbStyles.card : 'transparent',
          borderRadius: radius.sm,
          color: t.active ? '#fff' : sbStyles.muted,
          fontSize: 13, fontWeight: 700,
        }}>
          <Icon name={t.icon} size={15} color={t.active ? sbStyles.fiRed : sbStyles.muted} />
          {t.k}
          {t.badge && (
            <span style={{ background: sbStyles.fiRed, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9 }}>{t.badge}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Group card (fully colored) ──────────────────────────────────────────
function GroupCard({ k, g }) {
  const c = CATS[g.cat];
  return (
    <div style={{
      background: `linear-gradient(170deg, ${c.color} 0%, ${c.dark} 80%, ${c.deep} 100%)`,
      borderRadius: radius.lg,
      padding: '16px 18px 18px',
      color: '#fff',
      position: 'relative', overflow: 'hidden',
      boxShadow: `0 12px 24px -10px ${c.color}80, inset 0 1px 0 rgba(255,255,255,0.18)`,
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, opacity: 0.12, pointerEvents: 'none' }}>
        <Icon name="paddle" size={120} color="#fff" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative' }}>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>{g.name}</span>
        <span style={{ fontSize: 10, opacity: 0.75, fontFamily: sbStyles.mono, background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>{g.players[0].pj > 2 ? 'JOR 3/4' : 'JOR 2/4'}</span>
      </div>

      {g.players.map((p, i) => (
        <div key={p.n} style={{
          display: 'grid', gridTemplateColumns: '22px 1fr 30px 36px',
          gap: 10, alignItems: 'center',
          padding: '8px 0',
          borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.16)' : 'none',
          position: 'relative',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: i < 2 ? '#fff' : 'rgba(0,0,0,0.22)',
            color: i < 2 ? c.dark : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900, boxShadow: i < 2 ? `0 4px 10px rgba(0,0,0,0.2)` : 'none',
          }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{p.n}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{p.fac}</div>
          </div>
          <span style={{ fontSize: 11, fontFamily: sbStyles.mono, opacity: 0.85, textAlign: 'center' }}>{p.pg}/{p.pj}</span>
          <span style={{ fontSize: 17, fontFamily: sbStyles.mono, fontWeight: 900, textAlign: 'right' }}>{p.pts}</span>
        </div>
      ))}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1.5px dashed rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>¿Quién gana?</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ background: '#fff', color: c.dark, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, fontFamily: sbStyles.mono }}>
            {g.players[0].n.split(' ').slice(-1)[0]} · {(1.2 + Math.random() * 0.8).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bet slip (simplificado) ─────────────────────────────────────────────
function BetSlip() {
  const total = BET_SLIP.reduce((s, b) => s + b.amount, 0);
  const combOdd = BET_SLIP.reduce((s, b) => s * b.odd, 1);
  const win = total * combOdd;
  return (
    <aside style={{ width: 320, background: sbStyles.panel, borderLeft: `1px solid ${sbStyles.line}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${sbStyles.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${sbStyles.fiRed} 0%, ${sbStyles.fiRedDk} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px -2px ${sbStyles.fiRed}90`,
        }}><Icon name="ticket" size={16} color="#fff" /></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, color: '#fff', fontWeight: 800 }}>Tus picks</span>
          <span style={{ fontSize: 10, color: sbStyles.muted, letterSpacing: 0.5 }}>{BET_SLIP.length} selecciones · combinada</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: sbStyles.muted, cursor: 'pointer' }}>Limpiar</span>
      </div>

      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
        {BET_SLIP.map((b, i) => {
          const c = CATS[b.cat];
          return (
            <div key={i} style={{
              background: `linear-gradient(135deg, ${c.color} 0%, ${c.dark} 100%)`,
              borderRadius: radius.md, padding: '12px 14px',
              color: '#fff',
              boxShadow: `0 8px 18px -8px ${c.color}90`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -15, opacity: 0.15 }}>
                <Icon name="paddle" size={70} color="#fff" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, position: 'relative' }}>
                <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>{c.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>×</span>
              </div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, position: 'relative' }}>{b.pick}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, position: 'relative' }}>{b.match}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, position: 'relative' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 9px', borderRadius: 8, fontSize: 11, color: '#fff', fontWeight: 700 }}>cuota <b style={{ fontFamily: sbStyles.mono }}>{b.odd.toFixed(2)}</b></div>
                <div style={{ background: '#fff', color: c.dark, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontFamily: sbStyles.mono, fontWeight: 800 }}>
                  $ {b.amount.toLocaleString('es-MX')}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ background: sbStyles.bgDeep, border: `1.5px dashed ${sbStyles.line}`, borderRadius: radius.md, padding: 12, textAlign: 'center', fontSize: 12, color: sbStyles.muted }}>
          + suma otro reto
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: sbStyles.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>¿Cuánto apuestas?</div>
          <div style={{ background: sbStyles.bgDeep, border: `1px solid ${sbStyles.line}`, borderRadius: radius.md, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 22, color: '#fff', fontFamily: sbStyles.mono, fontWeight: 800 }}>$ {total.toLocaleString('es-MX')}</span>
            <span style={{ fontSize: 11, color: sbStyles.muted, fontFamily: sbStyles.mono }}>MXN</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[100, 250, 500, 1000].map(v => (
              <div key={v} style={{ flex: 1, padding: '7px 0', textAlign: 'center', background: sbStyles.card, border: `1px solid ${sbStyles.line}`, fontSize: 11, color: '#fff', fontFamily: sbStyles.mono, borderRadius: 8, fontWeight: 700 }}>+${v}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${sbStyles.line}`, padding: 16, background: sbStyles.bgDeep }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: sbStyles.muted, marginBottom: 4 }}>
          <span>Cuota combinada</span>
          <span style={{ color: sbStyles.unamGold, fontFamily: sbStyles.mono, fontWeight: 800 }}>{combOdd.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: sbStyles.muted }}>Ganas si aciertas</span>
          <span style={{ color: '#fff', fontFamily: sbStyles.mono, fontWeight: 900, fontSize: 22 }}>$ {Math.round(win).toLocaleString('es-MX')}</span>
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${sbStyles.fiRed} 0%, ${sbStyles.fiRedDk} 100%)`,
          color: '#fff', textAlign: 'center', padding: '14px 0',
          borderRadius: radius.md, fontSize: 14, fontWeight: 900, letterSpacing: 0.8,
          boxShadow: `0 8px 24px -4px ${sbStyles.fiRed}80`,
        }}>
          CONFIRMAR APUESTA
        </div>
      </div>
    </aside>
  );
}

// ── Home ────────────────────────────────────────────────────────────────
function SportsbookHome() {
  return (
    <div style={{ width: '100%', height: '100%', background: sbStyles.bg, color: sbStyles.text, fontFamily: sbStyles.font, display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex' }}>
        <LeftRail />
        <main style={{ flex: 1, padding: '20px 22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <HeroCards />
          <MainTabs />

          {/* Featured matches */}
          <div>
            <SectionHeader title="Pasando ahora" sub="3 mesas en vivo" icon="fire" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {FEATURED.map(m => <MatchCard key={m.id} m={m} />)}
            </div>
          </div>

          {/* By category — colored grids */}
          {[
            { cat: 'AV', title: 'Avanzado', sub: 'Los más rifados de la facu', data: UPCOMING_AV },
            { cat: 'IN', title: 'Intermedio', sub: 'Buen nivel, partidos cerrados', data: UPCOMING_IN },
            { cat: 'PR', title: 'Principiante', sub: 'Aprendiendo a remar', data: UPCOMING_PR },
          ].map(s => (
            <div key={s.cat}>
              <SectionHeader title={s.title} sub={s.sub} cat={s.cat} action="Ver categoría" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {s.data.slice(0, 3).map((m, i) => <MatchCard key={i} m={{ ...m, watchers: 20 + i * 18, group: m.group + ' · ' + CATS[s.cat].name }} />)}
              </div>
            </div>
          ))}

          {/* Groups */}
          <div>
            <SectionHeader title="Fase de grupos" sub="los 2 primeros pasan a llaves" icon="grid" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <GroupCard k="AV_A" g={GROUPS.AV_A} />
              <GroupCard k="IN_A" g={GROUPS.IN_A} />
              <GroupCard k="PR_A" g={GROUPS.PR_A} />
            </div>
          </div>
        </main>
        <BetSlip />
      </div>
    </div>
  );
}

// ── Match detail (solo ¿quién gana?) ────────────────────────────────────
function FriendBet({ name, avatarColor, pick, amount }) {
  return (
    <div style={{
      background: sbStyles.card, border: `1px solid ${sbStyles.line}`,
      borderRadius: radius.md, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: avatarColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11, fontWeight: 800,
      }}>{name.split(' ').map(p => p[0]).join('').slice(0, 2)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 10, color: sbStyles.muted }}>apostó por <b style={{ color: '#fff' }}>{pick}</b></div>
      </div>
      <span style={{ fontSize: 11, color: sbStyles.unamGold, fontFamily: sbStyles.mono, fontWeight: 700 }}>${amount}</span>
    </div>
  );
}

function SportsbookMatch() {
  const m = LIVE_MATCH;
  const c = CATS[m.cat];

  return (
    <div style={{ width: '100%', height: '100%', background: sbStyles.bg, color: sbStyles.text, fontFamily: sbStyles.font, display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex' }}>
        <LeftRail activeCat={m.cat} />
        <main style={{ flex: 1, padding: '20px 22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: sbStyles.muted }}>
            <span>Apuestas</span><Icon name="chevron" size={12} />
            <span>Copa Concreto</span><Icon name="chevron" size={12} />
            <span style={{ color: c.color, fontWeight: 700 }}>{c.name}</span>
            <Icon name="chevron" size={12} />
            <span style={{ color: '#fff' }}>{m.group}</span>
          </div>

          {/* MASSIVE colorful scoreboard */}
          <div style={{
            background: `linear-gradient(160deg, ${c.color} 0%, ${c.dark} 65%, ${c.deep} 100%)`,
            borderRadius: radius.xl,
            padding: '28px 32px 32px',
            position: 'relative', overflow: 'hidden',
            color: '#fff',
            boxShadow: `0 20px 50px -16px ${c.color}80, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}>
            {/* decorative */}
            <div style={{ position: 'absolute', top: -70, right: -70, opacity: 0.14, transform: 'rotate(20deg)' }}>
              <Icon name="paddle" size={280} color="#fff" />
            </div>
            <div style={{ position: 'absolute', bottom: -80, left: -80, opacity: 0.10, transform: 'rotate(-160deg)' }}>
              <Icon name="paddle" size={230} color="#fff" />
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 55%)', pointerEvents: 'none' }} />

            {/* Top */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
              <span style={{
                background: '#fff', color: c.dark,
                padding: '6px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                boxShadow: `0 6px 16px rgba(0,0,0,0.25)`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                EN VIVO · {m.startedAgo}
              </span>
              <span style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>· {m.group} · {m.table}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.95)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Icon name="people" size={14} /> {m.watching} mirando
              </span>
            </div>

            {/* Players */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 28, position: 'relative' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: `0 12px 32px rgba(0,0,0,0.25)`,
                  border: '4px solid rgba(255,255,255,0.4)',
                }}><Icon name="paddle" size={46} color={c.color} /></div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{m.p1.fac} · RANK #2</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.05 }}>{m.p1.n}</div>
                <div style={{ marginTop: 10, display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>FORMA</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: sbStyles.mono, letterSpacing: 1 }}>{m.p1.form}</span>
                </div>
              </div>

              {/* Score column */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.4, marginBottom: 4, fontWeight: 700 }}>SETS</div>
                <div style={{ fontSize: 64, fontWeight: 900, color: '#fff', fontFamily: sbStyles.mono, letterSpacing: -2, lineHeight: 0.95 }}>
                  {m.p1.sets} <span style={{ opacity: 0.5 }}>·</span> {m.p2.sets}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, marginTop: 4, fontWeight: 700 }}>SET 3</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: 'rgba(255,255,255,0.92)', fontFamily: sbStyles.mono, letterSpacing: -1, lineHeight: 1 }}>
                  {m.p1.score} <span style={{ opacity: 0.5, fontSize: 28 }}>·</span> {m.p2.score}
                </div>
                {/* Set pills */}
                <div style={{ marginTop: 12, display: 'flex', gap: 5, justifyContent: 'center' }}>
                  {m.history.map(h => (
                    <div key={h.s} style={{
                      fontSize: 10, fontFamily: sbStyles.mono, fontWeight: 800,
                      color: h.live ? c.dark : '#fff',
                      background: h.live ? '#fff' : 'rgba(0,0,0,0.25)',
                      padding: '3px 8px', borderRadius: 6,
                    }}>S{h.s} {h.a}-{h.b}{h.live && ' ●'}</div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: `0 12px 32px rgba(0,0,0,0.25)`,
                  border: '4px solid rgba(255,255,255,0.4)',
                  transform: 'scaleX(-1)',
                }}><Icon name="paddle" size={46} color={c.color} /></div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{m.p2.fac} · RANK #1</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1.05 }}>{m.p2.n}</div>
                <div style={{ marginTop: 10, display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>FORMA</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: sbStyles.mono, letterSpacing: 1 }}>{m.p2.form}</span>
                </div>
              </div>
            </div>

            {/* The ONE market: ¿Quién gana? */}
            <div style={{ marginTop: 28, position: 'relative' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <span style={{
                  display: 'inline-block', padding: '6px 18px',
                  background: 'rgba(0,0,0,0.25)', borderRadius: 999,
                  fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase',
                }}>¿Quién se lleva el partido?</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 720, margin: '0 auto' }}>
                {[
                  { p: m.p1, picked: true },
                  { p: m.p2, picked: false },
                ].map((x, i) => (
                  <div key={i} style={{
                    background: x.picked ? sbStyles.unamGold : '#fff',
                    color: x.picked ? sbStyles.bgDeep : c.dark,
                    borderRadius: radius.lg,
                    padding: '18px 22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontWeight: 900,
                    boxShadow: x.picked
                      ? `0 12px 28px -8px ${sbStyles.unamGold}AA, inset 0 0 0 3px ${sbStyles.bgDeep}`
                      : `0 12px 24px -6px rgba(0,0,0,0.35)`,
                    border: x.picked ? `2px solid ${sbStyles.bgDeep}` : '2px solid #fff',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.65, letterSpacing: 0.8, textTransform: 'uppercase' }}>{x.picked ? '✓ TU PICK' : 'gana'}</div>
                      <div style={{ fontSize: 18, marginTop: 2 }}>{x.p.n}</div>
                    </div>
                    <div style={{ fontSize: 30, fontFamily: sbStyles.mono }}>{x.p.odd.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment */}
            <div style={{ marginTop: 22, position: 'relative', maxWidth: 720, margin: '22px auto 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.92)', marginBottom: 6, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                <span><b style={{ fontSize: 13 }}>{m.pctOnP1}%</b> le va a {m.p1.n.split(' ').pop()}</span>
                <span>{100 - m.pctOnP1}% a {m.p2.n.split(' ').pop()}</span>
              </div>
              <div style={{ height: 10, background: 'rgba(0,0,0,0.28)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${m.pctOnP1}%`, height: '100%', background: '#fff' }} />
              </div>
            </div>
          </div>

          {/* Head-to-head + friends — friendly, social, not stats-heavy */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
            <div>
              <SectionHeader title="Cara a cara" sub="Cómo llegan a este partido" icon="trend" iconColor={sbStyles.unamGold} />
              <div style={{ background: sbStyles.card, border: `1px solid ${sbStyles.line}`, borderRadius: radius.lg, padding: '18px 20px' }}>
                {[
                  { k: 'Win rate en el torneo', a: '74%', b: '82%', winner: 'b' },
                  { k: 'Sets ganados', a: '7', b: '8', winner: 'b' },
                  { k: 'Promedio puntos/set', a: '9.2', b: '10.4', winner: 'b' },
                  { k: 'Veces que se enfrentaron', a: '4', b: '4', winner: 'tie' },
                  { k: 'Último enfrentamiento', a: 'Ganó', b: 'Perdió', winner: 'a' },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                    borderBottom: i < 4 ? `1px solid ${sbStyles.lineSoft}` : 'none',
                  }}>
                    <span style={{ fontSize: 14, color: s.winner === 'a' ? c.color : '#fff', fontWeight: s.winner === 'a' ? 800 : 600, textAlign: 'right', fontFamily: s.winner === 'a' ? sbStyles.font : sbStyles.font }}>{s.a}</span>
                    <span style={{ fontSize: 11, color: sbStyles.muted, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.k}</span>
                    <span style={{ fontSize: 14, color: s.winner === 'b' ? c.color : '#fff', fontWeight: s.winner === 'b' ? 800 : 600 }}>{s.b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionHeader title="Tus carnales apostando" sub="quién le va a quién" icon="heart" iconColor={sbStyles.fiRed} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FriendBet name="Andrés Gómez"  avatarColor={c.color}                pick={m.p1.n.split(' ').pop()} amount="500" />
                <FriendBet name="María Téllez"  avatarColor={sbStyles.unamGold}      pick={m.p1.n.split(' ').pop()} amount="200" />
                <FriendBet name="Pablo Cuevas"  avatarColor={sbStyles.intermedio || '#3b82f6'} pick={m.p2.n.split(' ').pop()} amount="350" />
                <FriendBet name="Lucía Romero"  avatarColor={sbStyles.principiante || '#22c55e'} pick={m.p1.n.split(' ').pop()} amount="100" />
                <FriendBet name="Diego Jiménez" avatarColor={c.color}                pick={m.p1.n.split(' ').pop()} amount="750" />
                <div style={{ fontSize: 11, color: sbStyles.muted, textAlign: 'center', marginTop: 4 }}>+ 18 carnales más</div>
              </div>
            </div>
          </div>
        </main>
        <BetSlip />
      </div>
    </div>
  );
}

// ── Category page (Avanzado) — colorful grids ──────────────────────────
function SportsbookCategory() {
  const cat = 'AV';
  const c = CATS[cat];
  const allUp = [...UPCOMING_AV];
  return (
    <div style={{ width: '100%', height: '100%', background: sbStyles.bg, color: sbStyles.text, fontFamily: sbStyles.font, display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex' }}>
        <LeftRail activeCat={cat} />
        <main style={{ flex: 1, padding: '20px 22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Big colorful banner */}
          <div style={{
            background: `linear-gradient(120deg, ${c.color} 0%, ${c.dark} 65%, ${c.deep} 100%)`,
            borderRadius: radius.xl,
            padding: '26px 30px',
            display: 'flex', alignItems: 'center', gap: 22,
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 20px 50px -16px ${c.color}90`,
            color: '#fff',
          }}>
            <div style={{ position: 'absolute', top: -60, right: -60, opacity: 0.16, transform: 'rotate(20deg)' }}>
              <Icon name="paddle" size={280} color="#fff" />
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.22) 0%, transparent 55%)', pointerEvents: 'none' }} />

            <div style={{
              width: 88, height: 88, borderRadius: 22,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 12px 28px rgba(0,0,0,0.25)`,
              position: 'relative',
            }}><Icon name="paddle" size={48} color={c.color} /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 800 }}>CATEGORÍA · {c.emoji}</div>
              <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: -0.8, lineHeight: 1 }}>Avanzado</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>Los que llevan años raqueteando. 8 jugadores, 2 grupos, cuartos el viernes 19h.</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
              {[
                { k: 'Jugadores', v: '8' },
                { k: 'Partidos', v: '14' },
                { k: 'Premio', v: '$280K' },
              ].map(s => (
                <div key={s.k} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: radius.md, minWidth: 80 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', fontFamily: sbStyles.mono, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4, fontWeight: 700 }}>{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live + upcoming as colorful cards */}
          <div>
            <SectionHeader title="Próximos retos" sub={`${allUp.length} partidos por venir`} cat={cat} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[FEATURED[0], ...allUp].slice(0, 3).map((m, i) => (
                <MatchCard key={i} m={{ ...m, watchers: m.watchers || (30 + i * 22), group: m.group + ' · ' + c.name }} />
              ))}
            </div>
          </div>

          {/* Tournament winner — single market, kept simple */}
          <div>
            <SectionHeader title="¿Quién se lleva la categoría?" sub="Apuesta al campeón Avanzado" cat={cat} />
            <div style={{
              background: `linear-gradient(135deg, ${c.color}26 0%, ${sbStyles.card} 60%)`,
              border: `1.5px solid ${c.color}55`,
              borderRadius: radius.lg, padding: 18,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { n: 'D. "Profe" Ramírez', odd: 2.10, hot: true },
                  { n: 'C. Bermúdez',        odd: 2.80 },
                  { n: 'A. "Tornado" López', odd: 3.40 },
                  { n: 'E. Quintero',        odd: 4.50 },
                  { n: '"Pulpo" Morales',    odd: 5.50 },
                  { n: 'A. Cabrera',         odd: 7.20 },
                  { n: '"Chino" Pérez',      odd: 8.50 },
                  { n: 'F. Torres',          odd: 12.0 },
                ].map((p, i) => (
                  <div key={i} style={{
                    background: p.hot ? `linear-gradient(135deg, ${c.color} 0%, ${c.dark} 100%)` : sbStyles.bgDeep,
                    border: p.hot ? 'none' : `1px solid ${sbStyles.line}`,
                    borderRadius: radius.md, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: p.hot ? `0 8px 20px -6px ${c.color}99` : 'none',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {p.hot && (
                      <div style={{ position: 'absolute', top: -14, right: -14, opacity: 0.18 }}>
                        <Icon name="paddle" size={50} color="#fff" />
                      </div>
                    )}
                    {p.hot && <span style={{ position: 'absolute', top: 6, right: 6, background: sbStyles.unamGold, color: sbStyles.bgDeep, fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.4 }}>FAV</span>}
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, position: 'relative' }}>{p.n}</span>
                    <span style={{ fontSize: 16, color: p.hot ? '#fff' : sbStyles.unamGold, fontFamily: sbStyles.mono, fontWeight: 900, position: 'relative' }}>{p.odd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Groups */}
          <div>
            <SectionHeader title="Grupos Avanzado" sub="los 2 primeros pasan a llaves" cat={cat} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <GroupCard k="AV_A" g={GROUPS.AV_A} />
              <GroupCard k="AV_B" g={GROUPS.AV_B} />
            </div>
          </div>
        </main>
        <BetSlip />
      </div>
    </div>
  );
}

Object.assign(window, { SportsbookHome, SportsbookMatch, SportsbookCategory });
