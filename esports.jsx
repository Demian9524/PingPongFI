// Dirección 0 · "Esports / Battle Royale" — estética gamer, AHORA con
// sistema de temas para variar color / tono / opacidad. Paletas basadas en
// la Facultad de Ingeniería (rojo carmesí, azul marino, oro UNAM) + la
// original eléctrica. Diseño ORIGINAL: el arte de personajes va en
// <image-slot> para que el usuario suelte sus imágenes.

const FN_FONTS = {
  disp: '"Saira Condensed", "Archivo", sans-serif',
  body: '"Saira", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

// ── Theme palettes ──────────────────────────────────────────────────────
// Tokens: bg1/bg2 page · navy sidebar rail · bright (display text) · ink
// (normal) · muted · dim · surface/surfaceHi (raised rows) · panelA/panelB
// · border/borderHi · primary/primaryDk · accent/accentDk · gold/goldDk ·
// green/red (status) · heroG1..3 + heroGlow (hero banner, siempre oscuro).
const FN_THEMES = {
  electrico: {
    name: 'Eléctrico', light: false,
    bg1: '#141f5a', bg2: '#0a1130', navy: '#070d24',
    bright: '#ffffff', ink: '#eaf1ff', muted: '#9fb0d8', dim: '#6678a8',
    surface: 'rgba(255,255,255,0.035)', surfaceHi: 'rgba(255,255,255,0.07)',
    panelA: 'rgba(34,50,108,0.55)', panelB: 'rgba(16,26,62,0.65)',
    border: 'rgba(96,132,232,0.34)', borderHi: 'rgba(120,160,255,0.55)',
    primary: '#3d8bff', primaryDk: '#1f5fe0', accent: '#8b46f0', accentDk: '#6a26d6',
    gold: '#ffce3a', goldDk: '#f5a313', green: '#22c77f', red: '#e23b5a',
    heroG1: '#2a1b6e', heroG2: '#131c52', heroG3: '#0a1130', heroGlow: '#8b46f0',
  },
  carmesi: {
    name: 'Carmesí FI', light: false,
    bg1: '#3a0d14', bg2: '#120608', navy: '#16060a',
    bright: '#ffffff', ink: '#ffe9ec', muted: '#d79aa2', dim: '#a8636d',
    surface: 'rgba(255,255,255,0.04)', surfaceHi: 'rgba(255,255,255,0.08)',
    panelA: 'rgba(122,22,34,0.5)', panelB: 'rgba(40,10,16,0.66)',
    border: 'rgba(224,80,98,0.32)', borderHi: 'rgba(255,128,140,0.52)',
    primary: '#e0263c', primaryDk: '#a4121f', accent: '#3a4f8c', accentDk: '#26356b',
    gold: '#ffce3a', goldDk: '#f5a313', green: '#22c77f', red: '#ff5a6e',
    heroG1: '#6a0f1c', heroG2: '#2a0810', heroG3: '#120608', heroGlow: '#e0263c',
  },
  unam: {
    name: 'Azul-Oro UNAM', light: false,
    bg1: '#16265c', bg2: '#0a1230', navy: '#07102a',
    bright: '#ffffff', ink: '#eef2ff', muted: '#9fb0d8', dim: '#5f6f9f',
    surface: 'rgba(255,255,255,0.04)', surfaceHi: 'rgba(255,255,255,0.07)',
    panelA: 'rgba(28,44,96,0.5)', panelB: 'rgba(12,22,56,0.66)',
    border: 'rgba(120,150,220,0.3)', borderHi: 'rgba(201,162,39,0.55)',
    primary: '#2f5bd0', primaryDk: '#1a3a96', accent: '#c9a227', accentDk: '#9c7d18',
    gold: '#e8c34a', goldDk: '#c79a20', green: '#22c77f', red: '#e23b5a',
    heroG1: '#1a2f7a', heroG2: '#10204f', heroG3: '#0a1230', heroGlow: '#c9a227',
  },
  nocturno: {
    name: 'Nocturno neón', light: false,
    bg1: '#1a0a0e', bg2: '#050204', navy: '#0a0305',
    bright: '#ffffff', ink: '#ffe2e6', muted: '#c08891', dim: '#7e4a52',
    surface: 'rgba(255,255,255,0.03)', surfaceHi: 'rgba(255,255,255,0.06)',
    panelA: 'rgba(60,12,20,0.42)', panelB: 'rgba(14,4,7,0.72)',
    border: 'rgba(255,60,90,0.26)', borderHi: 'rgba(255,80,110,0.6)',
    primary: '#ff2d4f', primaryDk: '#c00d2c', accent: '#ff7a1a', accentDk: '#c95400',
    gold: '#ffd24a', goldDk: '#e0a512', green: '#27e08a', red: '#ff3b5c',
    heroG1: '#4a0a16', heroG2: '#1a0408', heroG3: '#050204', heroGlow: '#ff2d4f',
  },
  claro: {
    name: 'Carmesí claro', light: true,
    bg1: '#ffffff', bg2: '#eef0f3', navy: '#6e0d15',
    bright: '#16100f', ink: '#2c2422', muted: '#837873', dim: '#b8aeaa',
    surface: 'rgba(20,16,15,0.04)', surfaceHi: 'rgba(20,16,15,0.07)',
    panelA: '#ffffff', panelB: '#f7f4f2',
    border: 'rgba(20,16,15,0.1)', borderHi: 'rgba(196,32,46,0.45)',
    primary: '#c4202e', primaryDk: '#8f1620', accent: '#1f3a8a', accentDk: '#15296b',
    gold: '#cf8a00', goldDk: '#a86f00', green: '#1f9d63', red: '#d23b52',
    heroG1: '#5a0e18', heroG2: '#2a0810', heroG3: '#14060a', heroGlow: '#e0263c',
  },
};

const FNCtx = React.createContext(FN_THEMES.electrico);
const useS = () => React.useContext(FNCtx);

// ── Data (gamertags) ────────────────────────────────────────────────────
const FN_GROUP = [
  { r: 1, n: 'Demian',   pj: 3, pg: 3, pp: 0, sets: '6-1', pts: 9, state: 'q' },
  { r: 2, n: 'JuanS',    pj: 3, pg: 2, pp: 1, sets: '5-3', pts: 6, state: 't' },
  { r: 3, n: 'CarlosM',  pj: 3, pg: 1, pp: 2, sets: '3-4', pts: 3, state: '' },
  { r: 4, n: 'LuisPlay', pj: 3, pg: 0, pp: 3, sets: '1-6', pts: 0, state: 'x' },
];
const FN_RANK = [
  { r: 1, n: 'Demian',  pts: 2400, crown: true },
  { r: 2, n: 'JuanS',   pts: 2100 },
  { r: 3, n: 'CarlosM', pts: 1850 },
  { r: 4, n: 'LuisPlay',pts: 1600 },
  { r: 5, n: 'Andres7', pts: 1500 },
];
const FN_NEXT = [
  { when: 'HOY · MESA 1', t: '2:30 PM', a: 'Demian', b: 'CarlosM' },
  { when: 'HOY · MESA 2', t: '2:30 PM', a: 'JuanS', b: 'LuisPlay' },
  { when: 'HOY · MESA 1', t: '3:00 PM', a: 'Demian', b: 'JuanS' },
];
const FN_NEWS = [
  { t: '¡Se abren las inscripciones!', ago: 'Hace 3 días' },
  { t: 'Así se vivió el torneo pasado', ago: 'Hace 1 semana' },
  { t: 'Reglamento oficial del torneo', ago: 'Hace 1 semana' },
];

// avatar = initial chip, hue seeded by name (theme-independent on purpose)
function fnHue(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
function FNAvatar({ name, size = 26, ring }) {
  const h = fnHue(name);
  return (
    <span style={{ width: size, height: size, flex: '0 0 auto', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FN_FONTS.disp, fontWeight: 700, fontSize: size * 0.42, color: '#fff', letterSpacing: 0.3, background: `linear-gradient(150deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 40%))`, boxShadow: ring ? `0 0 0 2px ${ring}` : `inset 0 0 0 1px rgba(255,255,255,0.25)` }}>{name.slice(0, 2).toUpperCase()}</span>
  );
}

// skewed gamer button
function FNButton({ children, kind = 'gold', size = 'md', style }) {
  const S = useS();
  const pal = kind === 'gold' ? { bg: `linear-gradient(180deg, ${S.gold}, ${S.goldDk})`, fg: '#231a02', sh: `${S.goldDk}88` }
    : kind === 'accent' ? { bg: `linear-gradient(180deg, ${S.accent}, ${S.accentDk})`, fg: '#fff', sh: `${S.accentDk}88` }
    : { bg: `linear-gradient(180deg, ${S.primary}, ${S.primaryDk})`, fg: '#fff', sh: `${S.primaryDk}88` };
  const pad = size === 'lg' ? '13px 30px' : size === 'sm' ? '6px 14px' : '9px 20px';
  const fs = size === 'lg' ? 19 : size === 'sm' ? 11 : 14;
  return (
    <div style={{ display: 'inline-block', transform: 'skewX(-9deg)', background: pal.bg, padding: pad, borderRadius: 5, boxShadow: `0 6px 18px -4px ${pal.sh}, inset 0 1px 0 rgba(255,255,255,0.4)`, ...style }}>
      <span style={{ display: 'inline-block', transform: 'skewX(9deg)', fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: fs, letterSpacing: 0.6, textTransform: 'uppercase', color: pal.fg, whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}

function FNPanel({ icon, title, action, children, style, bodyStyle }) {
  const S = useS();
  return (
    <div style={{ borderRadius: 16, background: `linear-gradient(160deg, ${S.panelA}, ${S.panelB})`, border: `1px solid ${S.border}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px -16px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px 11px' }}>
          {icon && <span style={{ color: S.gold, display: 'flex' }}>{icon}</span>}
          <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: S.ink }}>{title}</span>
          <div style={{ flex: 1 }} />
          {action}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px', ...bodyStyle }}>{children}</div>
    </div>
  );
}

// tiny inline icons
const FNIcon = ({ d, size = 17 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const ICN = {
  home: <FNIcon d={<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>} />,
  group: <FNIcon d={<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 5a3 3 0 010 6M21 20a5 5 0 00-4-4.9" /></>} />,
  trophy: <FNIcon d={<><path d="M7 4h10v5a5 5 0 01-10 0zM7 7H4v1a3 3 0 003 3M17 7h3v1a3 3 0 01-3 3M9 19h6M10 21h4" /></>} />,
  star: <FNIcon d={<path d="M12 3l2.7 5.8 6.3.6-4.8 4.2 1.4 6.2L12 16.8 6.4 19.8l1.4-6.2L3 9.4l6.3-.6z" />} />,
  user: <FNIcon d={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>} />,
  cal: <FNIcon d={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>} />,
  doc: <FNIcon d={<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>} />,
  mega: <FNIcon d={<><path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M16 9a4 4 0 010 6" /></>} />,
  clock: <FNIcon d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />,
  bell: <FNIcon d={<><path d="M6 10a6 6 0 1112 0c0 4 2 5 2 5H4s2-1 2-5z" /><path d="M10 19a2 2 0 004 0" /></>} />,
};

// ── Sidebar (rail siempre oscuro/sólido) ────────────────────────────────
function FNSidebar() {
  const S = useS();
  const items = [['home', 'INICIO', true], ['group', 'GRUPOS'], ['trophy', 'ELIMINATORIAS'], ['star', 'RANKINGS'], ['user', 'JUGADORES'], ['cal', 'CALENDARIO'], ['doc', 'REGLAMENTO'], ['mega', 'NOTICIAS']];
  return (
    <aside style={{ width: 188, flex: '0 0 auto', background: S.navy, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
      <div style={{ padding: '0 20px 22px' }}>
        <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 27, lineHeight: 0.86, color: '#fff', letterSpacing: 0.3 }}>PING<br />PONG<br />CUP</div>
        <span style={{ display: 'inline-block', marginTop: 6, transform: 'skewX(-9deg)', background: `linear-gradient(180deg, ${S.accent}, ${S.accentDk})`, padding: '2px 9px', borderRadius: 4 }}><span style={{ display: 'inline-block', transform: 'skewX(9deg)', fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 13, color: '#fff' }}>2.0</span></span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {items.map(([ic, label, active]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 9, position: 'relative', cursor: 'pointer', background: active ? `linear-gradient(90deg, ${S.primaryDk}, rgba(255,255,255,0.04))` : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>
            {active && <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderRadius: 2, background: S.gold }} />}
            <span style={{ color: active ? S.gold : 'rgba(255,255,255,0.4)', display: 'flex' }}>{ICN[ic]}</span>
            <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 14, letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, color: 'rgba(255,255,255,0.4)' }}>
          {['◎', '♪', '▷', '✦'].map((s, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{s}</span>)}
        </div>
        <div style={{ fontFamily: FN_FONTS.mono, fontSize: 8.5, letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>POWERED BY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 17, color: S.gold }}>FI</span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: '#fff', letterSpacing: 1 }}>ESPORTS</span>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ──────────────────────────────────────────────────────────────
function FNTopbar() {
  const S = useS();
  const tabs = ['INICIO', 'GRUPOS', 'ELIMINATORIAS', 'RANKINGS', 'JUGADORES', 'CALENDARIO', 'REGLAMENTO'];
  return (
    <div style={{ height: 56, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 26, padding: '0 28px', borderBottom: `1px solid ${S.border}` }}>
      {tabs.map((t, i) => (
        <span key={t} style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 14, letterSpacing: 0.7, textTransform: 'uppercase', color: i === 0 ? S.primary : S.muted, position: 'relative', paddingBottom: 4 }}>{t}{i === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, background: S.primary }} />}</span>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', color: S.muted }}>{ICN.bell}<span style={{ position: 'absolute', top: -4, right: -5, background: S.red, color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: FN_FONTS.mono, width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <FNAvatar name="Demian" size={32} ring={S.primary} />
        <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 14, letterSpacing: 0.5, color: S.ink }}>DEMIAN</span>
        <span style={{ color: S.dim, fontSize: 11 }}>▾</span>
      </div>
    </div>
  );
}

// ── Hero (banner SIEMPRE oscuro; texto blanco fijo) ─────────────────────
function FNCountdown() {
  const S = useS();
  const cells = [['12', 'DÍAS'], ['08', 'HORAS'], ['34', 'MIN'], ['56', 'SEG']];
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {cells.map(([v, l]) => (
        <div key={l} style={{ width: 72, padding: '8px 0', textAlign: 'center', borderRadius: 9, background: 'rgba(8,8,16,0.7)', border: `1px solid ${S.borderHi}`, boxShadow: `inset 0 0 14px ${S.heroGlow}40` }}>
          <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 32, lineHeight: 0.9, color: '#fff', textShadow: `0 0 12px ${S.heroGlow}` }}>{v}</div>
          <div style={{ fontFamily: FN_FONTS.mono, fontSize: 9, letterSpacing: 2, color: S.primary, marginTop: 2 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function FNHero() {
  const S = useS();
  return (
    <div style={{ position: 'relative', height: 320, flex: '0 0 auto', borderRadius: 16, overflow: 'hidden', border: `1px solid ${S.border}`, background: `radial-gradient(120% 120% at 50% -10%, ${S.heroG1} 0%, ${S.heroG2} 45%, ${S.heroG3} 100%)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, transparent 0 40px, rgba(255,255,255,0.04) 40px 41px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 520, height: 240, background: `radial-gradient(circle, ${S.heroGlow}55, transparent 70%)`, pointerEvents: 'none' }} />
      <image-slot id="fn-hero-left" shape="rounded" radius="0" placeholder="◳ Arrastra tu personaje (PNG)" style={{ position: 'absolute', left: 0, bottom: 0, top: 24, width: 300 }}></image-slot>
      <image-slot id="fn-hero-right" shape="rounded" radius="0" placeholder="◳ Arrastra tu personaje (PNG)" style={{ position: 'absolute', right: 0, bottom: 0, top: 24, width: 300 }}></image-slot>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 22, letterSpacing: 1, color: S.gold }}>2DO TORNEO DE</div>
        <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 76, lineHeight: 0.8, color: '#fff', letterSpacing: 1, textShadow: `0 4px 0 ${S.primaryDk}, 0 0 30px ${S.heroGlow}99`, marginTop: -4 }}>PING PONG</div>
        <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 34, lineHeight: 0.8, color: S.primary, letterSpacing: 4, textShadow: `0 0 18px ${S.heroGlow}` }}>FI 2026</div>
        <div style={{ marginTop: 4 }}><FNButton kind="gold" size="sm">¿Quién será el campeón?</FNButton></div>
        <FNCountdown />
        <div style={{ marginTop: 2 }}><FNButton kind="gold" size="lg">¡Regístrate ahora!</FNButton></div>
      </div>
    </div>
  );
}

// ── Groups panel ────────────────────────────────────────────────────────
function FNGroups() {
  const S = useS();
  const tabs = ['GRUPO A', 'GRUPO B', 'GRUPO C', 'GRUPO D'];
  const stateBg = { q: S.green, t: S.primary, x: S.red, '': 'transparent' };
  return (
    <FNPanel icon={ICN.group} title="Fase de Grupos" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {tabs.map((t, i) => (
          <span key={t} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 7, fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 12, letterSpacing: 0.4, color: i === 0 ? '#fff' : S.muted, background: i === 0 ? `linear-gradient(180deg, ${S.primary}, ${S.primaryDk})` : S.surface }}>{t}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 30px 30px 30px 44px 34px', fontFamily: FN_FONTS.mono, fontSize: 9.5, letterSpacing: 0.5, color: S.dim, padding: '0 10px 6px' }}>
        <span>#</span><span>JUGADOR</span><span style={{ textAlign: 'center' }}>PJ</span><span style={{ textAlign: 'center' }}>PG</span><span style={{ textAlign: 'center' }}>PP</span><span style={{ textAlign: 'center' }}>SETS</span><span style={{ textAlign: 'right' }}>PTS</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {FN_GROUP.map((p) => (
          <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 30px 30px 30px 44px 34px', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: p.state ? `${stateBg[p.state]}22` : S.surface, boxShadow: p.state ? `inset 3px 0 0 ${stateBg[p.state]}` : 'none' }}>
            <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: p.state ? stateBg[p.state] : S.muted }}>{p.r}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}><FNAvatar name={p.n} size={24} /><span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: S.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}</span></span>
            <span style={{ textAlign: 'center', fontFamily: FN_FONTS.mono, fontSize: 12, color: S.muted }}>{p.pj}</span>
            <span style={{ textAlign: 'center', fontFamily: FN_FONTS.mono, fontSize: 12, color: S.muted }}>{p.pg}</span>
            <span style={{ textAlign: 'center', fontFamily: FN_FONTS.mono, fontSize: 12, color: S.muted }}>{p.pp}</span>
            <span style={{ textAlign: 'center', fontFamily: FN_FONTS.mono, fontSize: 12, color: S.ink }}>{p.sets}</span>
            <span style={{ textAlign: 'right', fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 17, color: S.bright }}>{p.pts}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${S.border}` }}>
        {[['Clasificado', S.green], ['Mejor tercero', S.primary], ['Eliminado', S.red]].map(([l, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FN_FONTS.mono, fontSize: 9.5, letterSpacing: 0.5, color: S.muted, textTransform: 'uppercase' }}><span style={{ width: 11, height: 11, borderRadius: 3, background: c }} />{l}</span>
        ))}
      </div>
    </FNPanel>
  );
}

// ── Upcoming panel ──────────────────────────────────────────────────────
function FNUpcoming() {
  const S = useS();
  return (
    <FNPanel icon={ICN.clock} title="Próximos Partidos" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        {FN_NEXT.map((m, i) => (
          <div key={i} style={{ borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, padding: '10px 12px' }}>
            <div style={{ fontFamily: FN_FONTS.mono, fontSize: 9, letterSpacing: 1.5, color: S.gold, marginBottom: 7 }}>{m.when}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><FNAvatar name={m.a} size={26} /><span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: S.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.a}</span></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 12, color: S.dim }}>VS</div><div style={{ fontFamily: FN_FONTS.mono, fontSize: 10, color: S.primary }}>{m.t}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}><span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: S.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.b}</span><FNAvatar name={m.b} size={26} /></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 11, textAlign: 'center' }}><FNButton kind="accent" size="sm" style={{ width: '100%' }}>Ver calendario completo</FNButton></div>
    </FNPanel>
  );
}

// ── Bracket mini ────────────────────────────────────────────────────────
function FNBracketChip({ name, win, w = 100 }) {
  const S = useS();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: w, padding: '5px 8px', borderRadius: 7, background: win ? `linear-gradient(90deg, ${S.primaryDk}, ${S.surface})` : S.surface, border: `1px solid ${win ? S.borderHi : S.border}` }}>
      <FNAvatar name={name} size={20} />
      <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 12.5, color: win ? '#fff' : S.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    </div>
  );
}

function FNBracketMini() {
  const S = useS();
  const colLabel = (t) => <div style={{ fontFamily: FN_FONTS.mono, fontSize: 8.5, letterSpacing: 1.5, color: S.dim, marginBottom: 8 }}>{t}</div>;
  const oct = [['Demian', 'CarlosM'], ['JuanS', 'LuisPlay'], ['Andres7', 'Ricardo'], ['Matias', 'Alexis']];
  return (
    <FNPanel icon={ICN.trophy} title="Eliminatorias" action={<FNButton kind="accent" size="sm">Ver bracket completo</FNButton>} bodyStyle={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
      <div style={{ flex: 1, display: 'flex', gap: 14, paddingTop: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {colLabel('OCTAVOS')}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flex: 1, gap: 8 }}>
            {oct.map((pair, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <FNBracketChip name={pair[0]} win={i === 0} />
                <FNBracketChip name={pair[1]} win={false} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {colLabel('CUARTOS')}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flex: 1 }}>
            <FNBracketChip name="Demian" win />
            <FNBracketChip name="JuanS" />
            <FNBracketChip name="Ricardo" />
            <FNBracketChip name="Alexis" win />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {colLabel('SEMIFINAL')}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flex: 1 }}>
            <FNBracketChip name="Demian" win />
            <FNBracketChip name="Alexis" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {colLabel('FINAL')}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 64, height: 64, borderRadius: 14, background: `radial-gradient(circle at 50% 30%, ${S.gold}33, ${S.panelB})`, border: `1.5px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 22px ${S.gold}44` }}>
              <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 30, color: S.gold }}>?</span>
            </div>
            <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 14, letterSpacing: 1, color: S.gold }}>CAMPEÓN</span>
          </div>
        </div>
      </div>
    </FNPanel>
  );
}

// ── Ranking ─────────────────────────────────────────────────────────────
function FNRanking() {
  const S = useS();
  return (
    <FNPanel icon={ICN.star} title="Ranking Top 5" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {FN_RANK.map((p) => (
          <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', borderRadius: 8, background: p.r === 1 ? `linear-gradient(90deg, ${S.gold}22, transparent)` : S.surface }}>
            <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 16, width: 16, color: p.r === 1 ? S.gold : S.dim }}>{p.r}</span>
            <FNAvatar name={p.n} size={26} ring={p.r === 1 ? S.gold : null} />
            <span style={{ flex: 1, fontFamily: FN_FONTS.disp, fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: p.r === 1 ? S.gold : S.ink }}>{p.n}</span>
            <span style={{ fontFamily: FN_FONTS.mono, fontSize: 12, fontWeight: 700, color: S.ink }}>{p.pts.toLocaleString()}</span>
            <span style={{ fontFamily: FN_FONTS.mono, fontSize: 9, color: S.dim }}>pts</span>
            {p.crown && <span style={{ color: S.gold, fontSize: 13 }}>♔</span>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 11, textAlign: 'center' }}><FNButton kind="accent" size="sm" style={{ width: '100%' }}>Ver ranking completo</FNButton></div>
    </FNPanel>
  );
}

// ── Featured player ─────────────────────────────────────────────────────
function FNFeatured() {
  const S = useS();
  return (
    <FNPanel icon={ICN.group} title="Jugador Destacado" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', background: `radial-gradient(120% 100% at 30% 0%, ${S.accent}33, ${S.panelB})`, border: `1px solid ${S.border}`, display: 'flex' }}>
        <image-slot id="fn-featured" shape="rounded" radius="0" placeholder="◳ Foto del jugador" style={{ width: 130, flex: '0 0 auto' }}></image-slot>
        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 28, color: S.bright, letterSpacing: 0.5, textShadow: S.light ? 'none' : `0 0 16px ${S.accent}` }}>DEMIAN</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 8px', marginTop: 14 }}>
            {[['12', 'Partidos ganados', S.primary], ['24', 'Sets ganados', S.primary], ['92%', 'Efectividad', S.green], ['#1', 'Ranking', S.gold]].map(([v, l, c]) => (
              <div key={l}>
                <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 24, color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: FN_FONTS.mono, fontSize: 9, letterSpacing: 0.5, color: S.muted, textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div><FNButton kind="gold" size="sm">¡Invicto en fase de grupos!</FNButton></div>
        </div>
      </div>
    </FNPanel>
  );
}

// ── News ────────────────────────────────────────────────────────────────
function FNNews() {
  const S = useS();
  return (
    <FNPanel icon={ICN.mega} title="Noticias" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {FN_NEWS.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 9, background: S.surface }}>
            <div style={{ width: 42, height: 42, flex: '0 0 auto', borderRadius: 8, background: `linear-gradient(150deg, ${S.primary}, ${S.accent})`, opacity: 0.6 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FN_FONTS.body, fontWeight: 600, fontSize: 13, color: S.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.t}</div>
              <div style={{ fontFamily: FN_FONTS.mono, fontSize: 9.5, color: S.dim, marginTop: 2 }}>{n.ago}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 11, textAlign: 'center' }}><FNButton kind="accent" size="sm" style={{ width: '100%' }}>Ver todas las noticias</FNButton></div>
    </FNPanel>
  );
}

// ── Sponsors ────────────────────────────────────────────────────────────
function FNSponsors() {
  const S = useS();
  return (
    <FNPanel title="Patrocinadores" bodyStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, borderRadius: 12, background: S.surface, border: `1px solid ${S.border}`, padding: '16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: FN_FONTS.disp, fontWeight: 800, fontStyle: 'italic', fontSize: 20, color: S.bright, lineHeight: 1 }}>APOYA EL TORNEO</div>
        <div style={{ fontFamily: FN_FONTS.body, fontSize: 12, color: S.muted, marginTop: 6 }}>¡Gracias a nuestros patrocinadores!</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map(i => <image-slot key={i} id={`fn-sponsor-${i}`} shape="rounded" radius="8" placeholder="logo" style={{ flex: 1, height: 40 }}></image-slot>)}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ marginTop: 12 }}><FNButton kind="gold" size="sm">Conócelos</FNButton></div>
      </div>
    </FNPanel>
  );
}

// ── Home (recibe theme) ─────────────────────────────────────────────────
function FNHome({ theme = 'electrico' }) {
  const S = FN_THEMES[theme] || FN_THEMES.electrico;
  return (
    <FNCtx.Provider value={S}>
      <div style={{ width: '100%', height: '100%', display: 'flex', background: `radial-gradient(130% 90% at 70% 0%, ${S.bg1} 0%, ${S.bg2} 55%)`, color: S.ink, fontFamily: FN_FONTS.body }}>
        <FNSidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <FNTopbar />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FNHero />
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr 1.5fr', gap: 16, height: 322, flex: '0 0 auto' }}>
              <FNGroups />
              <FNUpcoming />
              <FNBracketMini />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1.1fr 0.95fr', gap: 16, height: 260, flex: '0 0 auto' }}>
              <FNRanking />
              <FNFeatured />
              <FNNews />
              <FNSponsors />
            </div>
          </div>
        </div>
      </div>
    </FNCtx.Provider>
  );
}

Object.assign(window, { FNHome });
