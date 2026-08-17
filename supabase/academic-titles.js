// ── supabase/academic-titles.js — títulos (campeonatos) de una facultad ──
// Fuente ÚNICA: RPC pública get_public_player_trophies(p_ref) por cada jugador
// del roster histórico que ya cargó la página (misma fuente que el perfil).
// Presentación: EXACTAMENTE la fila de trofeos del perfil del jugador
// (.pjx-trophy-row + .cerdito-tunnel/.pjx-trophy-card + .cerdito-26-back-* +
// .cerdito-logo-animado, CSS de css/perfil-jugador.css), justo debajo del
// nombre de la facultad. Orden: Avanzado → Intermedio → Principiante y, dentro
// de cada categoría, de la edición más reciente a la más antigua.

(function(global){
  'use strict';

  const CAT_RANK = { avanzado: 0, intermedio: 1, principiante: 2 };
  const TROPHY_FALLBACK_ASSET = 'assets/cerdito-pingpongfi.gif';

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function catKey(row){
    const k = String(row.category_key || '').toLowerCase();
    if (CAT_RANK[k] != null) return k;
    const c = String(row.category_code || row.category_name || '').toUpperCase();
    if (c.indexOf('AVANZ') >= 0) return 'avanzado';
    if (c.indexOf('INTER') >= 0) return 'intermedio';
    if (c.indexOf('PRINCIP') >= 0 || c.indexOf('NOVAT') >= 0) return 'principiante';
    return 'neutral';
  }
  // mismo mapeo de color que perfil-jugador.js
  function glowColor(key){
    if (key === 'intermedio') return 'blue';
    if (key === 'principiante') return 'green';
    return 'red';
  }
  function assetOf(t){
    if (t.asset_key) return t.asset_key;
    if (t.edition_key) return 'assets/cerdito-' + t.edition_key + '.gif';
    return TROPHY_FALLBACK_ASSET;
  }
  function edLabel(row){    if (row.edition_key) return String(row.edition_key);
    const m = String(row.edition_slug || row.edition_name || '').match(/(\d{4})-(\d+)/);
    return m ? m[1] + '-' + m[2] : (row.edition_name || '—');
  }
  // Nombre de categoría en plural, como en la barra de la portada.
  const CAT_PLURAL = { avanzado: 'Avanzados', intermedio: 'Intermedios', principiante: 'Principiantes' };
  function catPlural(t){
    const k = catKey(t);
    if (CAT_PLURAL[k]) return CAT_PLURAL[k];
    const raw = String(t.category_name || t.category_code || '').replace(/\s*\/\s*open\s*$/i, '').trim();
    if (!raw) return '';
    return /s$/i.test(raw) ? raw : raw + 's';
  }

  function labelOf(t, player){
    const title = t.title || 'Trofeo';
    const category = t.category_name || t.category_code || 'Categoría';
    const who = (player && player.nickname) ? player.nickname + ' · ' : '';
    return who + title + ' de ' + category + ' · ' + edLabel(t);
  }

  // onlyCat: 'avanzado' | 'intermedio' | 'principiante' → deja SOLO los títulos
  // ganados EN esa categoría (el perfil de categoría muestra a los campeones de
  // la categoría, no todos los trofeos de quienes hoy compiten en ella).
  async function fetchTitles(roster, onlyCat){
    if (!global.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    const refs = [...new Set((roster || []).map(r => r.player_id).filter(Boolean))];
    if (!refs.length) return [];
    const byPlayer = new Map((roster || []).map(r => [r.player_id, r]));
    const t0 = performance.now();
    let failures = 0;
    const lists = await Promise.all(refs.map(async ref => {
      const { data, error } = await global.SB.rpc('get_public_player_trophies', { p_ref: ref });
      if (error){ failures++; global.SB_LOG && global.SB_LOG.error('FAC-TIT-002', error); return []; }
      return (Array.isArray(data) ? data : []).map(t => Object.assign({}, t, { _player: byPlayer.get(ref) || null }));
    }));
    if (global.SB_LOG) global.SB_LOG.op('FAC-TIT', 'get_public_player_trophies x' + refs.length, performance.now() - t0, failures === 0);
    if (failures && failures === refs.length) throw new Error('TROPHIES_UNAVAILABLE');
    let rows = lists.flat();
    if (onlyCat) rows = rows.filter(t => catKey(t) === onlyCat);
    rows.sort((a, b) => {
      const ra = CAT_RANK[catKey(a)] ?? 3, rb = CAT_RANK[catKey(b)] ?? 3;
      if (ra !== rb) return ra - rb;
      const ea = edLabel(a), eb = edLabel(b);
      if (ea !== eb) return eb.localeCompare(ea, 'es', { numeric: true });
      return String((a._player && a._player.nickname) || '').localeCompare(String((b._player && b._player.nickname) || ''), 'es');
    });
    return rows;
  }

  // ── Mini popover anclado al trofeo (no modal centrado) ─────────────────
  const POP_STYLE = [
    '.fac-tpop{position:fixed;z-index:9000;min-width:210px;max-width:260px;padding:12px 14px;',
      'background:linear-gradient(158deg,var(--tp-2,#2a1f14) 0%,var(--tp-1,#140d08) 100%);',
      'border:1.5px solid var(--tp-bd,rgba(245,166,35,0.55));',
      'box-shadow:0 18px 34px -18px rgba(0,0,0,0.85),0 0 22px -14px var(--tp-glow,rgba(245,166,35,0.5));',
      'clip-path:polygon(0 8px,8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);',
      'display:flex;flex-direction:column;gap:5px}',
    '.fac-tpop-kind{font-family:var(--fj-lab,"Burbank Regular Bold",sans-serif);font-weight:800;font-size:9px;letter-spacing:0.14em;',
      'text-transform:uppercase;color:#fff;background:var(--tp-ac,#f5a623);align-self:flex-start;padding:2px 9px;',
      'clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)}',
    '.fac-tpop-name{font-family:"Burbank Regular Bold","Heading Now 6",sans-serif;font-weight:700;font-size:16px;line-height:1.1;color:#f6efe2}',
    '.fac-tpop-name a{color:#f6efe2;text-decoration:none}.fac-tpop-name a:hover{color:#fff;text-decoration:underline}',
    '.fac-tpop-meta{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.74);line-height:1.5}',
    '.fac-tpop-ed,.fac-tpop-cat{font-family:"Burbank Leaderboard","HN Display",sans-serif;font-weight:900;font-size:16px;line-height:1.1;color:#fff}',
    '.fac-tpop-cat a{color:#fff;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,0.42)}',
    '.fac-tpop-cat a:hover,.fac-tpop-cat a:focus-visible{text-decoration-color:#fff}',
    '.fac-tpop.tp-avanzado{--tp-ac:#dd3b2c;--tp-1:#1c0d0a;--tp-2:#5c1d14;--tp-bd:rgba(221,59,44,0.6);--tp-glow:rgba(221,59,44,0.5)}',
    '.fac-tpop.tp-intermedio{--tp-ac:#3a63f0;--tp-1:#0a1024;--tp-2:#152b5c;--tp-bd:rgba(58,99,240,0.6);--tp-glow:rgba(58,99,240,0.5)}',
    '.fac-tpop.tp-principiante{--tp-ac:#37bb66;--tp-1:#081a11;--tp-2:#12452b;--tp-bd:rgba(55,187,102,0.6);--tp-glow:rgba(55,187,102,0.5)}',
    '#facTitles .pjx-trophy-card{cursor:pointer}'
  ].join('');

  let openPop = null, popCard = null;
  function ensurePopStyles(){
    if (document.getElementById('fac-tpop-styles')) return;
    const s = document.createElement('style'); s.id = 'fac-tpop-styles';
    s.textContent = POP_STYLE; document.head.appendChild(s);
  }
  function closePop(){
    if (openPop){ openPop.remove(); openPop = null; }
    if (popCard){ popCard.setAttribute('aria-expanded', 'false'); popCard = null; }
  }
  function placePop(pop, card){
    const r = card.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, M = 8;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(M, Math.min(left, window.innerWidth - w - M));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - M) top = Math.max(M, r.top - h - 6);
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }
  function openTrophyPop(card, t, opts){
    opts = opts || {};
    ensurePopStyles();
    const same = popCard === card;
    closePop();
    if (same) return;
    const key = catKey(t);
    const pop = el('div', 'fac-tpop tp-' + key);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Detalle del título');
    pop.appendChild(el('span', 'fac-tpop-kind', t.title || 'Campeón'));
    const p = t._player || {};
    if (opts.showName !== false){
      const nm = el('div', 'fac-tpop-name');
      if (global.SB_LINKS) nm.appendChild(global.SB_LINKS.makePlayerLink(p.nickname || '—', t.registration_id || p.registration_id));
      else nm.textContent = p.nickname || '—';
      pop.appendChild(nm);
    }
    pop.appendChild(el('div', 'fac-tpop-ed', 'Edición ' + edLabel(t)));
    const catText = catPlural(t);
    if (catText){
      const catBox = el('div', 'fac-tpop-cat');
      // La categoría del título abre su ficha (Categoria2.html), igual que el
      // nombre del jugador abre su perfil.
      if (key === 'avanzado' || key === 'intermedio' || key === 'principiante'){
        const a = el('a', null, catText);
        a.href = 'Categoria2.html?code=' + key;
        a.setAttribute('aria-label', 'Ver la categoría ' + catText);
        catBox.appendChild(a);
      } else catBox.textContent = catText;
      pop.appendChild(catBox);
    }
    document.body.appendChild(pop);
    openPop = pop; popCard = card;
    card.setAttribute('aria-expanded', 'true');
    placePop(pop, card);
  }
  if (typeof document !== 'undefined'){
    document.addEventListener('click', e => {
      if (!openPop) return;
      if (openPop.contains(e.target) || (popCard && popCard.contains(e.target))) return;
      closePop();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    window.addEventListener('resize', () => { if (openPop && popCard) placePop(openPop, popCard); });
    window.addEventListener('scroll', () => { if (openPop && popCard) placePop(openPop, popCard); }, true);
  }

  function trophyCard(t){
    const key = catKey(t);
    const card = el('div', 'cerdito-tunnel pjx-trophy-card');
    card.dataset.trophyType = String(t.trophy_type || 'CHAMPION').toUpperCase();
    card.dataset.category = key;
    card.setAttribute('role', 'img');
    const label = labelOf(t, t._player);
    card.setAttribute('aria-label', label);
    card.title = label;
    const back = el('div', 'cerdito-26-back cerdito-26-back-' + glowColor(key));
    back.setAttribute('aria-hidden', 'true');
    const img = el('img', 'cerdito-logo-animado');
    img.src = assetOf(t) + '?v=trophies-v4';
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      img.src = TROPHY_FALLBACK_ASSET + '?v=trophies-v4';
    }, { once: true });
    card.appendChild(back);
    card.appendChild(img);
    card.tabIndex = 0;
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', e => { e.stopPropagation(); openTrophyPop(card, t); });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openTrophyPop(card, t); }
    });
    return card;
  }

  // render(roster, hostSelector) → número de títulos. El host queda vacío y
  // oculto si la facultad no tiene títulos (sin hueco ni mensaje).
  async function render(roster, hostSelector, onlyCat){
    const host = document.querySelector(hostSelector);
    if (!host) return 0;
    closePop();
    host.textContent = '';
    host.hidden = true;
    ensurePopStyles();
    try {
      const rows = await fetchTitles(roster, onlyCat);
      if (!rows.length) return 0;
      const row = el('div', 'pjx-trophy-row');
      row.setAttribute('aria-label', rows.length === 1 ? '1 título de la facultad' : rows.length + ' títulos de la facultad');
      rows.forEach(t => row.appendChild(trophyCard(t)));
      host.appendChild(row);
      host.hidden = false;
      return rows.length;
    } catch(err){
      global.SB_LOG && global.SB_LOG.error('FAC-TIT-001', err);
      host.hidden = false;
      host.appendChild(el('div', 'empty-note', 'No se pudieron cargar los títulos de la facultad. (código FAC-TIT-001)'));
      return 0;
    }
  }

  // attachTrophyPopover(card, trophy, opts) — reutilizable en cualquier página
  // con fichas de trofeo (perfil del jugador: opts.showName = false).
  function attachTrophyPopover(card, t, opts){
    if (!card) return;
    ensurePopStyles();
    card.classList.add('fac-tpop-anchor');
    card.style.cursor = 'pointer';
    if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', e => { e.stopPropagation(); openTrophyPop(card, t, opts); });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openTrophyPop(card, t, opts); }
    });
  }

  global.SB_ACADEMIC_TITLES = { render, fetchTitles, attachTrophyPopover, closeTrophyPopover: closePop };
})(typeof window !== 'undefined' ? window : globalThis);
