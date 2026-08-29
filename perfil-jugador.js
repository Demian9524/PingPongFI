// ── PerfilJugador.html — lógica (PLAYER-CENTRIC) ────────────────────────
// Identidad: la URL (`?id=`) acepta players.id, registrations.id o
// registrations.public_code. Se resuelve al players.id canónico (siguiendo
// la fusión manual existente) y desde ahí se cargan TODAS las inscripciones
// del jugador, en cualquier edición — no solo la inscripción/edición actual.
//
// Fuente (player-centric): RPCs get_public_player_registrations,
// get_public_player_stats, get_public_player_matches. Si esas RPC no existen
// en el servidor, SB_PARTICIPANTS las detecta como ausentes y esta página cae
// al flujo antiguo por-inscripción (loadLegacy).
//
// La posición de grupo ACTUAL sigue viniendo de get_group_standings(group_id).
//
// REWORK visual 2026-07: composición competitiva (hero asimétrico, panel
// crema diagonal, ring grande, selector skew). Solo cambia la capa de
// render; cálculos, filtros y reglas de datos quedan idénticos:
// PENDING nunca cuenta como jugado/derrota ni entra en forma reciente.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function qs(name){ return new URLSearchParams(location.search).get(name); }

  function showState(title, sub, retry){
    const st = $('#pjState');
    $('#pjBody').hidden = true;
    st.style.display = 'block';
    st.textContent = '';
    st.appendChild(el('b', null, title));
    if (sub) st.appendChild(document.createTextNode(' ' + sub));
    if (retry){
      const b = el('button', 'btn btn-ghost', 'Reintentar');
      b.style.marginTop = '16px'; b.style.display = 'block'; b.type = 'button';
      b.onclick = load;
      st.appendChild(b);
    }
  }

  function editionShortLabel(reg){
    if (reg.edition_slug){
      const m = reg.edition_slug.match(/(\d{4}-\d+)/);
      if (m) return m[1];
    }
    return reg.edition_name || ('Edición ' + reg.edition_id);
  }

  // Fallback SOLO visual (ver notas históricas): sin facultad real se usa
  // el código 'EXTERNO' para el logo; nunca se escribe en Supabase.
  const EXTERNO_CODE = 'EXTERNO';
  const EXTERNO_NAME = 'Otra / Externo';
  function presentationAcademic(row){
    const hasFaculty = !!row.faculty_code;
    return {
      facultyCode: row.faculty_code || EXTERNO_CODE,
      facultyName: row.faculty_name || (hasFaculty ? row.faculty_code : EXTERNO_NAME),
      careerCode: hasFaculty ? row.career_code : null,
      careerName: hasFaculty ? row.career_name : null,
      isFallback: !hasFaculty
    };
  }

  // Color por categoría — tonos adaptados a la paleta del rework
  // (verde victoria / ámbar crema / rojo del torneo).
  function categoryTone(code, name){
    const key = normalizeMetaText(name || code || '').replace(/[\s-]+/g, '_');
    if (/PRINCIPIANTE/.test(key)) return { fg: '#79d19c', bg: 'rgba(46,143,84,0.16)', border: 'rgba(46,143,84,0.5)' };
    if (/INTERMEDI/.test(key)) return { fg: '#7aa0ff', bg: 'rgba(58,99,240,0.16)', border: 'rgba(58,99,240,0.5)' };
    if (/AVANZAD/.test(key)) return { fg: '#dd3b2c', bg: 'rgba(196,51,42,0.14)', border: 'rgba(221,59,44,0.5)' };
    return { fg: '#f3e9d2', bg: 'rgba(243,233,210,0.1)', border: 'rgba(243,233,210,0.3)' };
  }
  // Color EXACTO de marca de cada categoría — el mismo que usan Categoria2.html,
  // el registro y el resto del sistema. categoryTone() devuelve versiones
  // aclaradas, pensadas para texto pequeño sobre fondos oscuros; la medalla usa
  // el tono canónico para que coincida con el título del hero.
  function categoryBrandColor(code, name){
    const key = normalizeMetaText(name || code || '').replace(/[\s-]+/g, '_');
    if (/PRINCIPIANTE|NOVATO/.test(key)) return '#37bb66';
    if (/INTERMEDI/.test(key)) return '#3a63f0';
    if (/AVANZAD/.test(key)) return '#dd3b2c';
    return null;
  }

  function buildCrumbs(row){
    const nav = $('#pjCrumbs');
    nav.textContent = '';
    nav.appendChild(el('a', null, 'Inicio')).href = 'Directorio.html';
    const acad = presentationAcademic(row);
    nav.appendChild(document.createTextNode(' › '));
    const facUrl = window.SB_LINKS.buildFacultyUrl(acad.facultyCode);
    if (facUrl){
      const a = el('a', null, acad.facultyName);
      a.href = facUrl;
      nav.appendChild(a);
    } else {
      nav.appendChild(el('span', null, acad.facultyName));
    }
    if (acad.careerCode){
      nav.appendChild(document.createTextNode(' › '));
      const a = el('a', null, acad.careerName || acad.careerCode);
      a.href = window.SB_LINKS.buildCareerUrl(acad.careerCode);
      nav.appendChild(a);
    }
    nav.appendChild(document.createTextNode(' › '));
    nav.appendChild(el('span', null, row.nickname || row.nickname_snapshot || 'Jugador'));
  }


  // ── Trofeos oficiales del jugador ────────────────────────────────────────
  // La edición y categoría vienen de Supabase; el frontend solo decide la
  // presentación visual. La URL del perfil sirve como referencia canónica.
  const TROPHY_GLOW_BY_CATEGORY = {
    principiante: 'green',
    intermedio: 'blue',
    avanzado: 'red'
  };
  function trophyGlowColor(categoryKey, categoryName, categoryCode){
    const key = [categoryKey, categoryName, categoryCode].filter(Boolean).join(' ').toLowerCase();
    if (/intermedi/.test(key)) return 'blue';
    if (/avanzad/.test(key)) return 'red';
    if (/principiante|novato/.test(key)) return 'green';
    return 'red';
  }
  const TROPHY_FALLBACK_ASSET = 'assets/cerdito-pingpongfi.gif';

  function trophyAssetOf(trophy){
    if (trophy.asset_key) return trophy.asset_key;
    if (trophy.edition_key) return 'assets/cerdito-' + trophy.edition_key + '.gif';
    return TROPHY_FALLBACK_ASSET;
  }

  function trophyLabelOf(trophy){
    const title = trophy.title || 'Trofeo';
    const category = trophy.category_name || trophy.category_code || 'Categoría';
    const edition = trophy.edition_key || trophy.edition_name || 'Edición';
    return title + ' de ' + category + ' · ' + edition;
  }

  // Se puede llamar varias veces (p.ej. al re-renderizar el header cuando cambia
  // la visibilidad del teléfono). Sin un guardia, dos llamadas concurrentes
  // limpiaban ANTES de su await y ambas insertaban después → fila de trofeos
  // duplicada de forma intermitente. Token de generación + limpieza justo antes
  // de insertar lo evita.
  let _trophySeq = 0;
  function clearTrophyRows(){
    document.querySelectorAll('[data-pj-trophy-row]').forEach(n => n.remove());
    const legacy = document.getElementById('pjTrophyRow');
    if (legacy) legacy.remove();
  }
  async function renderPlayerTrophies(playerRef){
    const seq = ++_trophySeq;
    clearTrophyRows();
    if (!playerRef || !window.SB_TROPHIES) return;

    try {
      const trophies = await window.SB_TROPHIES.fetchPlayerTrophies(playerRef);
      if (seq !== _trophySeq) return; // otra llamada más reciente manda
      if (!trophies.length) return;

      const trophyRow = el('div', 'pjx-trophy-row');
      trophyRow.id = 'pjTrophyRow';
      trophyRow.setAttribute('data-pj-trophy-row', '1');
      trophyRow.setAttribute('aria-label', trophies.length === 1 ? '1 trofeo ganado' : trophies.length + ' trofeos ganados');

      trophies.forEach(t => {
        const categoryKey = String(t.category_key || '').toLowerCase();
        const type = String(t.trophy_type || 'CHAMPION').toUpperCase();
        const label = trophyLabelOf(t);

        const card = el('div', 'cerdito-tunnel pjx-trophy-card');
        card.dataset.trophyType = type;
        card.dataset.category = categoryKey || 'neutral';
        card.setAttribute('role', 'img');
        card.setAttribute('aria-label', label);
        card.title = label;

        const back = el('div', 'cerdito-26-back cerdito-26-back-' + trophyGlowColor(categoryKey, t.category_name, t.category_code));
        back.setAttribute('aria-hidden', 'true');

        const img = el('img', 'cerdito-logo-animado');
        img.src = trophyAssetOf(t) + '?v=trophies-v4';
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.setAttribute('aria-hidden', 'true');
        img.addEventListener('error', () => {
          if (img.dataset.fallbackApplied === '1') return;
          img.dataset.fallbackApplied = '1';
          img.src = TROPHY_FALLBACK_ASSET + '?v=trophies-v4';
        }, { once: true });

        card.appendChild(back);
        card.appendChild(img);
        // mini pop-up anclado al trofeo (mismo componente que Facultad.html;
        // aquí sin el nombre del jugador: ya estamos en su perfil)
        if (window.SB_ACADEMIC_TITLES){
          window.SB_ACADEMIC_TITLES.attachTrophyPopover(card, t, { showName: false });
        }
        trophyRow.appendChild(card);
      });

      if (seq !== _trophySeq) return;
      clearTrophyRows();
      const actions = document.getElementById('pjx-id-actions') || document.querySelector('.pjx-id-actions');
      if (actions) actions.insertAdjacentElement('afterend', trophyRow);
      else $('#pjName').insertAdjacentElement('afterend', trophyRow);
    } catch (error) {
      if (window.SB_LOG) window.SB_LOG.error('PJ-TROPHIES', error);
      else console.error('[PJ-TROPHIES]', error);
    }
  }

  let _lastHeaderRow = null;
  function renderHeader(row){
    _lastHeaderRow = row;
    const nickname = row.nickname || row.nickname_snapshot || 'Jugador';
    document.title = nickname + ' · Perfil de jugador · Torneo de Ping Pong FI';
    $('#pjDesc').setAttribute('content', 'Perfil público de ' + nickname + ' en el Torneo de Ping Pong FI: facultad, carrera, categoría, grupo y estadísticas oficiales.');
    const nameEl = $('#pjName');
    nameEl.textContent = nickname;
    // Escalón de tamaño por longitud del nombre: evita títulos de 4 renglones.
    const nlen = nickname.length;
    nameEl.dataset.len = nlen > 30 ? 'xl' : nlen > 22 ? 'l' : nlen > 14 ? 'm' : 's';
    $('#pjGiant').textContent = nickname;

    renderPlayerTrophies(qs('id'));

    const acad = presentationAcademic(row);

    // Marca de agua grande del hero: escudo de la facultad del jugador (mask → tinte limpio, sin caja)
    const facMark = document.getElementById('pjFacMark');
    if (facMark){
      const markSrc = window.SB_LOGOS.facultyLogo(acad.facultyCode);
      facMark.style.setProperty('--fac-mark', 'url("' + new URL(markSrc, document.baseURI).href + '")');
    }

    const logoSlot = $('#pjLogoSlot');
    logoSlot.textContent = '';
    const logoFrame = el('div', 'pj-logo-frame');
    const header = window.SB_LINKS.makeAcademicLogoHeader(acad.facultyCode, acad.careerCode, acad.facultyName, acad.careerName);
    if (header){
      logoFrame.appendChild(header);
      logoSlot.appendChild(logoFrame);
    }
    const chips = $('#pjChips');
    chips.textContent = '';
    const facChip = el('span', 'chip fac', acad.facultyName);
    if (acad.careerCode){
      // Facultad + carrera agrupadas: en móvil comparten renglón (facultad a la izquierda, carrera a la derecha)
      const acadWrap = el('span', 'pj-acad');
      acadWrap.appendChild(facChip);
      acadWrap.appendChild(el('span', 'chip fac', acad.careerName || acad.careerCode));
      chips.appendChild(acadWrap);
    } else {
      chips.appendChild(facChip);
    }
    if (row.entry_status && row.entry_status !== 'ON_TIME' && window.SB_UI)
      chips.appendChild(el('span', 'chip late', window.SB_UI.tr(row.entry_status)));

    const catSlot = $('#pjCatSlot');
    catSlot.textContent = '';
    // Tema de la barra de navegación según la categoría del jugador
    {
      const catKey = normalizeMetaText(row.category_name || row.category_code || '').replace(/[\s-]+/g, '_');
      document.body.dataset.cat =
        /AVANZAD/.test(catKey) ? 'avanzado' :
        /INTERMEDI/.test(catKey) ? 'intermedio' :
        /PRINCIPIANTE|NOVATO/.test(catKey) ? 'principiante' : 'neutral';
    }
    if (row.category_name || row.category_code){
      const tone = categoryTone(row.category_code, row.category_name);
      // La categoría es navegable: abre el perfil de esa categoría.
      const catUrlKey = (function(){
        const k = normalizeMetaText(row.category_name || row.category_code || '').replace(/[\s-]+/g, '_');
        if (/AVANZAD/.test(k)) return 'avanzado';
        if (/INTERMEDI/.test(k)) return 'intermedio';
        if (/PRINCIPIANTE|NOVATO/.test(k)) return 'principiante';
        return null;
      })();
      const block = el(catUrlKey ? 'a' : 'span', 'cat-block');
      if (catUrlKey){
        block.href = 'Categoria2.html?code=' + catUrlKey;
        block.setAttribute('aria-label', 'Ver la categoría ' + (categoryLabel(row) || row.category_name || row.category_code));
      }
      block.appendChild(el('span', null, categoryLabel(row) || row.category_name || row.category_code));
      block.style.setProperty('--pj-accent', tone.fg);
      block.style.setProperty('--pj-accent-soft', tone.bg);
      block.style.setProperty('--pj-accent-border', tone.border);
      catSlot.appendChild(block);
    }

    const waSlot = $('#pjWaSlot');
    waSlot.textContent = '';
    const phonesVisible = !window.PHONE_VISIBILITY || window.PHONE_VISIBILITY.show;
    const waUrl = phonesVisible ? (row._waUrl || row.whatsapp_url) : null;
    if (waUrl){
      const a = el('a', 'wa');
      const icon = el('img', 'wa-icon');
      icon.src = 'assets/whatsapp-icon.png?v=2';
      icon.alt = '';
      a.appendChild(icon);
      a.appendChild(el('span', null, 'WhatsApp'));
      a.href = waUrl;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', 'Abrir WhatsApp con ' + nickname);
      waSlot.appendChild(a);
    } else {
      waSlot.appendChild(el('span', 'wa-none', 'Contacto no público'));
    }
  }

  // Una "marca" del hero: caja #N / DE T + título y subtítulo. Se usa tanto
  // para la posición de grupo como para los podios históricos (facultad y
  // categoría), que se apilan uno sobre otro dentro de #pjRankSlot.
  function rankLine(num, of, title, sub, titleColor){
    const line = el('div', 'pjx-rank-line');
    // Chasis (contexto) + núcleo metálico (posición). El núcleo lleva el metal;
    // el chasis lo colorea la categoría o lo deja en grafito la facultad.
    const pos = el('div', 'pjx-rank-pos');
    const core = el('div', 'pjx-rank-core');
    core.appendChild(el('b', null, num));
    core.appendChild(el('small', null, of));
    pos.appendChild(core);
    line.appendChild(pos);
    const meta = el('div', 'pjx-rank-meta');
    const b = el('b', null, title);
    if (titleColor) b.style.color = titleColor;
    meta.appendChild(b);
    meta.appendChild(el('span', null, sub));
    line.appendChild(meta);
    return line;
  }
  function paintPlace(line, place){
    const pos = line && line.querySelector('.pjx-rank-pos');
    if (!pos) return;
    const metal = place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze';
    pos.classList.remove('pjx-rank-gold', 'pjx-rank-silver', 'pjx-rank-bronze');
    pos.classList.add('pjx-rank-' + metal);
    // El metal también se marca en la línea para que la etiqueta pueda tomar
    // su color (oro / plata / bronce) en la marca de facultad.
    line.classList.remove('pjx-line-gold', 'pjx-line-silver', 'pjx-line-bronze');
    line.classList.add('pjx-line-' + metal);
  }

  // NOTA: el slot del hero (#pjRankSlot) es EXCLUSIVO de podios históricos
  // (facultad y/o categoría). La posición de grupo nunca va aquí — vive en el
  // panel "Torneo actual" (renderGroupPosition).

  // ── Badge de podio histórico de facultad (top 3) ─────────────────────
  // Mismo ranking ponderado por categoría que usa Facultad.html: si este
  // jugador cae en el top 3 histórico de su facultad, coloreamos el badge
  // "#N / GRUPO X" con los mismos tonos oro/plata/bronce del podio, en vez
  // del rojo de marca por defecto. No cambia el número mostrado (que sigue
  // siendo la posición de grupo de la edición activa) — solo el color.
  function normCatText(s){
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  // Clave canónica de categoría a partir de cualquier código/nombre.
  function catKeyOf(s){
    const k = normCatText(s);
    if (/AVANZAD/.test(k)) return 'avanzado';
    if (/INTERMEDI/.test(k)) return 'intermedio';
    if (/PRINCIPIANT|NOVAT/.test(k)) return 'principiante';
    return '';
  }
  // Categoría HISTÓRICA del jugador: aquella en la que jugó más partidos
  // oficiales. Un ascenso (p. ej. de intermedios a avanzados) cambia su
  // categoría actual, pero su podio histórico sigue siendo el de la categoría
  // donde realmente compitió.
  async function historicCategoryKey(regId){
    const ms = await matchesOf(regId);
    const tally = {};
    (ms || []).forEach(m => {
      if (!m.is_official) return;
      const k = catKeyOf(m.category_code || m.category_name);
      if (k) tally[k] = (tally[k] || 0) + 1;
    });
    let best = '', n = 0;
    Object.keys(tally).forEach(k => { if (tally[k] > n){ n = tally[k]; best = k; } });
    return best;
  }
  function winWeightOf(m){
    const key = normCatText(m.category_name || m.category_code || '');
    if (/AVANZAD/.test(key)) return 1.30;
    if (/INTERMEDI/.test(key)) return 1.15;
    return 1.00;
  }
  function fingerprintOfMatches(ms){
    return (ms || []).map(m => m.match_id).sort().join(',');
  }
  async function computeFacultyPodiumPlace(facultyCode, registrationId){
    if (!facultyCode || !registrationId || !window.SB_PARTICIPANTS) return { place: 0, total: 0 };
    try {
      const roster = await window.SB_PARTICIPANTS.fetchAcademicRoster('faculty', facultyCode);
      if (!roster || !roster.length) return { place: 0, total: 0 };
      return await rankInRoster(roster, registrationId);
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('PJ-PODIUM', e);
      return { place: 0, total: 0 };
    }
  }
  // Podio histórico de la CATEGORÍA: no existe RPC propia, se arma con los
  // padrones de facultad (mismo método que supabase/academic-page.js) y se
  // filtra por código de categoría. Los partidos se reutilizan del caché.
  async function computeCategoryPodiumPlace(categoryKey, registrationId){
    if (!categoryKey || !registrationId || !window.SB_PARTICIPANTS || !window.SB_CATALOG) return { place: 0, total: 0 };
    try {
      const want = catKeyOf(categoryKey);
      if (!want) return { place: 0, total: 0 };
      const facs = await window.SB_CATALOG.getFaculties();
      const lists = await Promise.all((facs || []).map(f =>
        window.SB_PARTICIPANTS.fetchAcademicRoster('faculty', f.code).catch(() => [])));
      const all = [].concat.apply([], lists);
      const roster = all.filter(r => catKeyOf(r.category_code || r.category_name) === want);
      // Ascensos: quien hoy está en una categoría MÁS ALTA pudo haber jugado su
      // historia en ésta. Se revisan esos padrones y se suman los que tengan
      // partidos oficiales aquí, para que el podio no se recorra al faltarles.
      const HIGHER = { principiante: ['intermedio','avanzado'], intermedio: ['avanzado'], avanzado: [] };
      const above = all.filter(r => (HIGHER[want] || []).indexOf(catKeyOf(r.category_code || r.category_name)) >= 0);
      const promoted = await Promise.all(above.map(async r => {
        const ms = await matchesOf(r.registration_id);
        return (ms || []).some(m => m.is_official && catKeyOf(m.category_code || m.category_name) === want) ? r : null;
      }));
      promoted.forEach(r => { if (r) roster.push(r); });
      if (!roster.some(r => r.registration_id === registrationId)){
        const own = all.find(r => r.registration_id === registrationId);
        if (own) roster.push(own);
      }
      if (!roster.length) return { place: 0, total: 0 };
      return await rankInRoster(roster, registrationId, want);
    } catch(e){
      window.SB_LOG && window.SB_LOG.error('PJ-PODIUM-CAT', e);
      return { place: 0, total: 0 };
    }
  }
  const pjMatchCache = new Map();
  async function matchesOf(regId){
    if (pjMatchCache.has(regId)) return pjMatchCache.get(regId);
    let ms = [];
    try { ms = (await window.SB_PARTICIPANTS.fetchPlayerMatches(regId, 200, null)) || []; } catch(e){ ms = []; }
    pjMatchCache.set(regId, ms);
    return ms;
  }
  // Ranking ponderado sobre cualquier padrón (facultad o categoría).
  async function rankInRoster(roster, registrationId, catKey){
    {
      const matchesByReg = new Map();
      await Promise.all(roster.map(async r => {
        matchesByReg.set(r.registration_id, await matchesOf(r.registration_id));
      }));
      const seenFp = new Set();
      const dedupedRegIds = new Set();
      roster.forEach(r => {
        const ms = matchesByReg.get(r.registration_id) || [];
        const fp = fingerprintOfMatches(ms);
        if (ms.length){
          if (seenFp.has(fp)) return;
          seenFp.add(fp);
        }
        dedupedRegIds.add(r.registration_id);
      });
      function statsFromMatches(ms){
        // Con catKey solo cuentan los partidos JUGADOS en esa categoría: quien
        // llegó ahí por ascenso no arrastra su historial de otra categoría.
        const official = (ms || []).filter(m => m.is_official &&
          (!catKey || catKeyOf(m.category_code || m.category_name) === catKey));
        let wins = 0, losses = 0, weighted = 0;
        official.forEach(m => {
          if (m.result === 'WON'){ wins++; weighted += winWeightOf(m); }
          else if (m.result === 'LOST') losses++;
        });
        const mp = wins + losses;
        return { mp, wins, losses, weighted, win_pct: mp ? wins / mp : 0 };
      }
      const MIN_MATCHES_FOR_PODIUM = 3;
      const ranked = roster
        .filter(r => dedupedRegIds.has(r.registration_id))
        .map(r => {
          const s = statsFromMatches(matchesByReg.get(r.registration_id));
          const puntaje = ((s.weighted + 5) / (s.mp + 10)) * 100;
          return { r, mp: s.mp, wins: s.wins, win_pct: s.win_pct, puntaje };
        })
        .filter(p => p.mp >= MIN_MATCHES_FOR_PODIUM)
        .sort((a, b) => (b.puntaje - a.puntaje) || (b.win_pct - a.win_pct) || (b.wins - a.wins));

      // "DE N": total de jugadores históricos del padrón (mismo número que
      // "N Jugadores" en Facultad.html / Categoria2.html), no solo los
      // elegibles al podio.
      const total = roster.length;
      const myFp = fingerprintOfMatches(matchesByReg.get(registrationId));
      if (!myFp){
        // El registration_id del perfil puede no coincidir literalmente con
        // ninguna fila del roster (otro estado de inscripción, etc.) —
        // pedimos sus partidos directamente en vez de asumir que ya están
        // en matchesByReg.
        try {
          const ownMs = await matchesOf(registrationId);
          const ownFp = fingerprintOfMatches(ownMs);
          if (!ownFp) return { place: 0, total };
          const idx2 = ranked.findIndex(p => fingerprintOfMatches(matchesByReg.get(p.r.registration_id)) === ownFp);
          return { place: (idx2 >= 0 && idx2 < 3) ? idx2 + 1 : 0, total };
        } catch(e){ return { place: 0, total }; }
      }
      const idx = ranked.findIndex(p => fingerprintOfMatches(matchesByReg.get(p.r.registration_id)) === myFp);
      return { place: (idx >= 0 && idx < 3) ? idx + 1 : 0, total };
    }
  }
  // ── Panel de estadísticas del hero (ring + filas) ────────────────────
  // Fuente: get_public_player_stats (general o filtrado por edición).
  function renderHeroStats(stats){
    const box = $('#pjStatsBody');
    box.textContent = '';
    if (!stats || !stats.matches_played){
      box.appendChild(el('div', 'empty-note', 'Aún no tiene partidos oficiales registrados en este filtro.'));
      return;
    }
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const pct = Math.round((stats.win_pct || 0) * 100);
    const setsW = stats.sets_won || 0;
    const setsL = stats.sets_lost || 0;
    const diff = setsW - setsL;

    // ring central: donut grueso estilo arcade (conic-gradient con gaps + sombra desplazada)
    const row = el('div', 'pjx-ringrow');
    const left = el('div', 'pjx-ring-side loss');
    const lossIcon = el('div', 'pjx-ring-icon');
    lossIcon.innerHTML = '<img src="assets/cross-white.png" alt="" style="display:block">';
    left.appendChild(lossIcon);
    left.appendChild(el('b', null, String(losses)));
    left.appendChild(el('span', null, 'PERDIDOS'));
    row.appendChild(left);

    const wrap = el('div', 'pjx-ring-wrap');
    wrap.style.setProperty('--pjx-pct-deg', (pct * 3.6) + 'deg');
    wrap.innerHTML =
      '<div class="pjx-ring-shadow" aria-hidden="true"></div>' +
      '<div class="pjx-ring-hole" aria-hidden="true"></div>' +
      '<div class="pjx-ring-donut" aria-hidden="true"></div>';
    const center = el('div', 'pjx-ring-center');
    const b = el('b', null, String(pct));
    b.appendChild(el('i', 'pjx-pct-sign', '%'));
    center.appendChild(b);
    center.appendChild(el('span', null, 'VICTORIAS'));
    wrap.appendChild(center);
    row.appendChild(wrap);

    const right = el('div', 'pjx-ring-side win');
    const winIcon = el('div', 'pjx-ring-icon');
    winIcon.innerHTML = '<img src="assets/trophy-white.svg" alt="" style="display:block">';
    right.appendChild(winIcon);
    right.appendChild(el('b', null, String(wins)));
    right.appendChild(el('span', null, 'GANADOS'));
    row.appendChild(right);
    box.appendChild(row);

    const rows = el('div', 'pjx-statrows');
    const items = [
      ['Partidos jugados', String(stats.matches_played), ''],
      ['Sets ganados', String(setsW), ''],
      ['Sets perdidos', String(setsL), ''],
      ['Diferencia de sets', (diff > 0 ? '+' : '') + diff, diff > 0 ? 'pos' : (diff < 0 ? 'neg' : '')]
    ];
    items.forEach(([label, val, cls]) => {
      const r = el('div', 'pjx-statrow');
      r.appendChild(el('span', null, label));
      r.appendChild(el('b', cls || null, val));
      rows.appendChild(r);
    });
    box.appendChild(rows);
  }

  // ── Panel "Torneo actual" (posición de grupo, edición activa) ────────
  function renderGroupPosition(standing){
    const box = $('#pjGroupBody');
    box.textContent = '';
    if (!standing){
      box.appendChild(el('div', 'empty-note', 'Sin grupo activo en la edición actual, o la posición todavía no está publicada.'));
      return;
    }
    const s = standing.row;
    const panel = el('div', 'pjx-now');
    const pos = el('div', 'pjx-now-pos');
    pos.appendChild(el('b', null, standing.position + '.º'));
    pos.appendChild(el('span', null, 'DE ' + standing.groupSize + ' · GRUPO'));
    panel.appendChild(pos);

    const played = s.matches_played || 0;
    // Un PENDING jamás cuenta como jugado ni como derrota: si PJ es 0,
    // PG/PP se muestran en 0 aunque la fila trajera otra cosa.
    const wins = played === 0 ? 0 : (s.wins || 0);
    const losses = played === 0 ? 0 : (s.losses || 0);
    const grid = el('div', 'pjx-now-stats');
    [['PJ', String(played), ''],
     ['PG', String(wins), wins > 0 ? 'pos' : ''],
     ['PP', String(losses), losses > 0 ? 'neg' : ''],
     ['DIF. SETS', (s.set_diff > 0 ? '+' : '') + (played === 0 ? 0 : s.set_diff), s.set_diff > 0 ? 'pos' : (s.set_diff < 0 && played > 0 ? 'neg' : '')]
    ].forEach(([label, val, cls]) => {
      const c = el('div', 'pjx-now-cell');
      c.appendChild(el('b', cls || null, val));
      c.appendChild(el('span', null, label));
      grid.appendChild(c);
    });
    panel.appendChild(grid);
    box.appendChild(panel);

    if (played === 0)
      box.appendChild(el('p', 'pjx-now-note', 'Todavía no ha disputado partidos en esta edición.'));
    if (s.is_asymmetric)
      box.appendChild(el('p', 'pjx-now-note', 'Los grupos de esta categoría tienen distinto número de partidos: la comparación oficial usa % de victorias y % de sets, no solo victorias brutas.'));
  }

  // Valores reales permitidos por rounds_type_ck en la base.
  const ROUND_LABELS = {
    GROUP: 'FASE DE GRUPOS',
    BEST_THIRD_TIEBREAK: 'DESEMPATE MEJOR TERCERO',
    STANDARD_REPECHAGE: 'REPECHAJE',
    LATE_ENTRY_PLAYIN: 'REPECHAJE / INGRESO TARDÍO',
    ROUND_OF_32: 'DIECISEISAVOS DE FINAL',
    ROUND_OF_16: 'OCTAVOS DE FINAL',
    QUARTERFINAL: 'CUARTOS DE FINAL',
    SEMIFINAL: 'SEMIFINAL',
    THIRD_PLACE: 'TERCER LUGAR',
    FINAL: 'FINAL',
    CONSOLATION: 'CONSOLACIÓN'
  };

  function normalizeMetaText(value){
    return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  }
  function roundKey(value){
    return normalizeMetaText(value).replace(/[\s-]+/g, '_');
  }
  function groupMetaLabel(value){
    const label = normalizeMetaText(value);
    if (!label) return null;
    if (/^GRUPO\b/.test(label)) return label;
    if (/^GROUP\b/.test(label)) return label.replace(/^GROUP\b/, 'GRUPO');
    return 'GRUPO ' + label;
  }
  function isGroupRound(m){
    const type = roundKey(m.round_type);
    const code = roundKey(m.round_code);
    const name = normalizeMetaText(m.round_name);
    return type === 'GROUP'
      || code === 'GROUP'
      || code.startsWith('GROUP_')
      || (!!m.group_label && /\b(GRUPO|GROUP)\b/.test(name));
  }
  function phaseLabel(m){
    if (isGroupRound(m)) return ROUND_LABELS.GROUP;
    const roundName = normalizeMetaText(m.round_name);
    if (roundName) return roundName;
    const type = roundKey(m.round_type);
    if (type && ROUND_LABELS[type]) return ROUND_LABELS[type];
    const code = roundKey(m.round_code);
    if (code && ROUND_LABELS[code]) return ROUND_LABELS[code];
    return 'PARTIDO';
  }

  const CATEGORY_LABELS = {
    PRINCIPIANTE: 'PRINCIPIANTES', PRINCIPIANTES: 'PRINCIPIANTES',
    PRINCIPIANTE_OPEN: 'PRINCIPIANTES', BEGINNER: 'PRINCIPIANTES',
    // histórico: ya no existe la categoría Novato → se muestra como Principiantes
    NOVATO: 'PRINCIPIANTES', NOVATOS: 'PRINCIPIANTES', NOVATO_OPEN: 'PRINCIPIANTES',
    INTERMEDIO: 'INTERMEDIOS', INTERMEDIOS: 'INTERMEDIOS',
    INTERMEDIO_OPEN: 'INTERMEDIOS', INTERMEDIATE: 'INTERMEDIOS',
    AVANZADO: 'AVANZADOS', AVANZADOS: 'AVANZADOS',
    AVANZADO_OPEN: 'AVANZADOS', ADVANCED: 'AVANZADOS'
  };
  function humanizeCode(code){
    if (!code) return null;
    return code.replace(/_OPEN$/, '').replace(/_/g, ' ').trim() || null;
  }
  function categoryLabel(m){
    const code = normalizeMetaText(m.category_code).replace(/[\s-]+/g, '_');
    if (code && CATEGORY_LABELS[code]) return CATEGORY_LABELS[code];
    const publicName = m.category_name || m.category_display_name || '';
    if (publicName && String(publicName).trim()) return normalizeMetaText(publicName);
    return humanizeCode(code);
  }

  function matchMetaText(m, showEdition){
    const parts = [];
    const normalizedParts = new Set();
    const pushUnique = value => {
      const normalized = normalizeMetaText(value);
      if (!normalized || normalizedParts.has(normalized)) return;
      normalizedParts.add(normalized);
      parts.push(value);
    };
    if (showEdition){
      pushUnique(editionShortLabel({
        edition_slug: m.edition_slug,
        edition_name: m.edition_name,
        edition_id: m.edition_id
      }));
    }
    pushUnique(categoryLabel(m));
    pushUnique(phaseLabel(m));
    if (isGroupRound(m) && m.group_label){
      const groupText = ('GRUPO ' + m.group_label).toUpperCase();
      const alreadyIncluded = parts.some(part => String(part).toUpperCase().includes(groupText));
      if (!alreadyIncluded) pushUnique(groupMetaLabel(m.group_label));
    }
    return parts.join(' · ');
  }

  // Orden: temporada más reciente primero; dentro de la temporada, fase más
  // importante primero; empates por fecha.
  const ROUND_IMPORTANCE = {
    GROUP: 0, CONSOLATION: 0,
    BEST_THIRD_TIEBREAK: 1,
    STANDARD_REPECHAGE: 2, LATE_ENTRY_PLAYIN: 2,
    ROUND_OF_32: 3,
    ROUND_OF_16: 4,
    QUARTERFINAL: 5,
    SEMIFINAL: 6, THIRD_PLACE: 6,
    FINAL: 7
  };
  function roundImportance(m){
    const type = roundKey(m.round_type);
    if (type && ROUND_IMPORTANCE[type] != null) return ROUND_IMPORTANCE[type];
    const code = roundKey(m.round_code);
    if (code && ROUND_IMPORTANCE[code] != null) return ROUND_IMPORTANCE[code];
    return 0;
  }
  function editionSortKey(m){
    const label = editionShortLabel({ edition_slug: m.edition_slug, edition_name: m.edition_name, edition_id: m.edition_id });
    const match = String(label || '').match(/(\d{4})-(\d+)/);
    if (match) return Number(match[1]) * 10 + Number(match[2]);
    return Number(m.edition_id) || 0;
  }
  function sortMatchesByPhase(matches){
    return [...matches].sort((a, b) => {
      const ed = editionSortKey(b) - editionSortKey(a);
      if (ed !== 0) return ed;
      const imp = roundImportance(b) - roundImportance(a);
      if (imp !== 0) return imp;
      const ta = a.played_at ? new Date(a.played_at).getTime() : 0;
      const tb = b.played_at ? new Date(b.played_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
  }

  function matchStatusKind(m){
    // Normalización obligatoria: CANCELLED tiene prioridad absoluta sobre
    // result/PENDING. status y voided_for_standings mandan, nunca solo result.
    const status = String(m.status || '').trim().toUpperCase();
    const isCancelled = status === 'CANCELLED' || m.voided_for_standings === true;
    if (isCancelled) return 'cancelled';
    if (m.result === 'WON') return 'won';
    if (m.result === 'LOST') return 'lost';
    return 'pending'; // SCHEDULED / PENDING / WALKOVER sin ganador aún
  }

  function matchScoreText(m){
    if (m.score_kind === 'SETS' && (m.my_sets != null || m.opp_sets != null)){
      return (m.my_sets ?? 0) + '–' + (m.opp_sets ?? 0);
    }
    if (m.score_kind === 'SINGLE_GAME_POINTS' && m.points_summary && m.points_summary.length){
      return m.points_summary.map(g => (g.my_points ?? '?') + '–' + (g.opp_points ?? '?')).join(', ');
    }
    return '—';
  }

  // ── Forma reciente: tira competitiva. PENDING y CANCELLED excluidos. ──
  function renderFormFromMatches(matches){
    const form = $('#pjForm');
    form.textContent = '';
    const official = matches.filter(m => m.is_official && matchStatusKind(m) !== 'pending' && matchStatusKind(m) !== 'cancelled');
    if (!official.length){
      form.appendChild(el('div', 'empty-note', 'Aún no tiene partidos oficiales en este filtro.'));
      return;
    }
    const strip = el('div', 'pjx-form');
    official.slice(0, 8).forEach((m, idx) => {
      if (idx > 0) strip.appendChild(el('span', 'pjx-form-link'));
      const won = matchStatusKind(m) === 'won';
      const chip = el('div', 'pjx-form-chip ' + (won ? 'w' : 'l') + (idx === 0 ? ' is-latest' : ''));
      chip.appendChild(el('span', null, won ? 'G' : 'P'));
      const ed = editionShortLabel({ edition_slug: m.edition_slug, edition_name: m.edition_name, edition_id: m.edition_id });
      chip.title = (idx === 0 ? 'Más reciente · ' : '') + (m.opponent_nickname || 'Rival') + ' · ' + ed + ' · ' + matchScoreText(m);
      strip.appendChild(chip);
    });
    form.appendChild(strip);
  }

  // Enlaza el rival únicamente por opponent_public_code.
  function appendOpponentName(top, m){
    const nickname = m.opponent_nickname || 'Rival';
    top.appendChild(el('span', 'match-vs', 'vs'));
    if (m.opponent_public_code){
      const a = el('a', 'match-opponent-link', nickname);
      a.href = 'PerfilJugador.html?id=' + encodeURIComponent(m.opponent_public_code);
      a.setAttribute('aria-label', 'Ver perfil de ' + nickname);
      top.appendChild(a);
    } else {
      top.appendChild(el('span', 'match-opp', nickname));
    }
  }

  function renderMatchesInto(boxId, matches, showEdition, emptyText){
    const box = $(boxId);
    box.textContent = '';
    if (!matches.length){
      box.appendChild(el('div', 'empty-note', emptyText));
      return;
    }
    const list = el('div', 'pjx-mlist');
    matches.forEach(m => {
      const kind = matchStatusKind(m);
      const row = el('div', 'pjx-mrow ' + kind);
      const badge = el('div', 'pjx-mbadge', kind === 'won' ? 'G' : (kind === 'lost' ? 'P' : (kind === 'cancelled' ? '—' : '·')));
      badge.setAttribute('aria-hidden', 'true');
      row.appendChild(badge);
      const main = el('div', 'pjx-mmain');
      const top = el('div', 'pjx-mtop');
      appendOpponentName(top, m);
      main.appendChild(top);
      const meta = matchMetaText(m, showEdition);
      if (meta){
        const metaEl = el('div', 'pjx-mmeta');
        const catLbl = normalizeMetaText(categoryLabel(m));
        const catColor = { AVANZADOS:'#dd3b2c', INTERMEDIOS:'#3a63f0', PRINCIPIANTES:'#37bb66' };
        meta.split(' · ').forEach((part, i) => {
          if (i) metaEl.appendChild(document.createTextNode(' · '));
          const color = catColor[normalizeMetaText(part)];
          if (color && normalizeMetaText(part) === catLbl){
            const s = el('span', 'pjx-mcat', part);
            s.style.setProperty('--cat', color);
            metaEl.appendChild(s);
          } else {
            metaEl.appendChild(document.createTextNode(part));
          }
        });
        main.appendChild(metaEl);
      }
      row.appendChild(main);
      const right = el('div', 'pjx-mright');
      right.appendChild(el('span', 'pjx-mscore', kind === 'pending' ? 'VS' : (kind === 'cancelled' ? '—' : matchScoreText(m))));
      right.appendChild(el('span', 'pjx-mres', kind === 'won' ? 'Ganó' : (kind === 'lost' ? 'Perdió' : (kind === 'cancelled' ? 'Anulado' : 'Pendiente'))));
      if (kind === 'cancelled') row.setAttribute('aria-label', 'Partido anulado');
      row.appendChild(right);
      list.appendChild(row);
    });
    box.appendChild(list);
    fitMetaLines(list);
  }

  // La línea que describe el enfrentamiento (edición · categoría · fase · grupo)
  // NUNCA debe partirse en dos renglones: va en nowrap y aquí se reduce su
  // tamaño hasta que quepa en el ancho real del dispositivo. Como el
  // letter-spacing está en em, escalar la fuente escala la línea completa.
  function fitMetaLines(root){
    if (!root) return;
    const nodes = root.querySelectorAll ? root.querySelectorAll('.pjx-mmeta') : [];
    nodes.forEach(n => {
      n.style.fontSize = '';
      const avail = n.clientWidth;
      if (!avail) return;
      const base = parseFloat(getComputedStyle(n).fontSize) || 12;
      let w = n.scrollWidth;
      if (w <= avail) return;
      let size = Math.max(6, base * (avail / w) * 0.985);
      n.style.fontSize = size.toFixed(2) + 'px';
      w = n.scrollWidth;
      if (w > n.clientWidth){
        size = Math.max(6, size * (n.clientWidth / w) * 0.985);
        n.style.fontSize = size.toFixed(2) + 'px';
      }
    });
  }
  let fitRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => fitMetaLines(document));
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitMetaLines(document));

  // ── Selector [Actual] [General] [Ediciones] ──────────────────────────
  let state = null; // { ref, editions:[{id,label}], selectedEditionId, currentReg, activeEditionId }

  function buildSelector(){
    const sel = $('#pjEdSelector');
    sel.textContent = '';
    if (state.editions.length < 2 && state.activeEditionId == null){ sel.hidden = true; return; }
    sel.hidden = false;
    const mk = (label, editionId) => {
      const b = el('button', 'pjx-edtab' + (state.selectedEditionId === editionId ? ' on' : ''));
      b.appendChild(el('span', null, label));
      b.type = 'button';
      b.setAttribute('aria-pressed', state.selectedEditionId === editionId ? 'true' : 'false');
      b.onclick = () => { state.selectedEditionId = editionId; buildSelector(); refreshFilteredData(); };
      return b;
    };
    // General primero, luego todas las ediciones de más vieja a más actual.
    sel.appendChild(mk('General', null));
    state.editions.slice()
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
      .forEach(e => sel.appendChild(mk(e.label, e.id)));
  }

  async function refreshFilteredData(){
    const [stats, matches] = await Promise.all([
      window.SB_PARTICIPANTS.fetchPlayerStats(state.ref, state.selectedEditionId),
      window.SB_PARTICIPANTS.fetchPlayerMatches(state.ref, 30, state.selectedEditionId)
    ]);
    // etiqueta de contexto en el panel de stats del hero
    const isActual = state.activeEditionId != null && state.selectedEditionId === state.activeEditionId;
    const selEd = state.editions.find(e => e.id === state.selectedEditionId);
    $('#pjStatsTag').textContent = isActual
      ? ('TORNEO ACTUAL · ' + (selEd ? selEd.label : ''))
      : (state.selectedEditionId === null ? 'Estadísticas del jugador' : ('Edición ' + (selEd ? selEd.label : '')));

    renderHeroStats(stats);

    const orderedList = sortMatchesByPhase(matches || []);
    renderFormFromMatches(orderedList);

    // Próximos: solo SCHEDULED/PENDING reales. CANCELLED nunca entra aquí,
    // y jamás cuenta como jugado. Prioridad: status/voided_for_standings.
    const upcoming = orderedList.filter(m => matchStatusKind(m) === 'pending');
    const decided = orderedList.filter(m => ['won', 'lost'].includes(matchStatusKind(m)));
    const cancelledMatches = orderedList.filter(m => matchStatusKind(m) === 'cancelled');
    const played = decided.concat(cancelledMatches); // anulados siempre al final
    const showEdition = state.selectedEditionId === null;
    const upSect = $('#pjUpcomingSection');
    upSect.hidden = !upcoming.length;
    if (upcoming.length) renderMatchesInto('#pjUpcoming', upcoming, showEdition, '');
    renderMatchesInto('#pjMatches', played, showEdition, 'Aún no tiene partidos disputados en este filtro.');

    // "Torneo actual" solo tiene sentido en el contexto de la edición activa.
    $('#pjGroupSection').hidden = !(isActual && state.currentReg && state.currentReg.is_active_edition);
  }

  async function loadPlayerCentric(regs){
    // Sin edición activa: usa la inscripción de la edición más reciente
    // según la clave año-semestre (los ids de edición NO son cronológicos:
    // las ediciones históricas se crearon después con ids mayores).
    const current = regs.find(r => r.is_active_edition) ||
      regs.slice().sort((a, b) => editionSortKey(b) - editionSortKey(a))[0];
    buildCrumbs(current);
    renderHeader(current);
    const acad = presentationAcademic(current);

    const editionsSeen = new Map();
    regs.forEach(r => { if (!editionsSeen.has(r.edition_id)) editionsSeen.set(r.edition_id, editionShortLabel(r)); });
    const activeEditionId = current.is_active_edition ? current.edition_id : null;
    state = {
      ref: qs('id'),
      editions: [...editionsSeen.entries()].map(([id, label]) => ({ id, label })),
      // Abre por defecto en la vista General (histórico).
      selectedEditionId: null,
      currentReg: current,
      activeEditionId
    };
    buildSelector();

    // Posición de grupo SOLO si está inscrito en la edición activa.
    const groupStandingP = (current.is_active_edition && current.group_id)
      ? window.SB_PARTICIPANTS.fetchOwnStanding(current.registration_id, current.group_id)
      : Promise.resolve(null);

    const [standing] = await Promise.all([groupStandingP, refreshFilteredData()]);
    const podium = await computeFacultyPodiumPlace(acad.facultyCode, current.registration_id);
    const podiumPlace = podium.place;
    const slot = document.getElementById('pjRankSlot');
    // Los dos podios son INDEPENDIENTES: un jugador puede estar en el top 3 de
    // su categoría sin estarlo en el de toda la facultad (y viceversa). Se
    // evalúa cada uno por separado y se apilan las marcas que apliquen.
    // El podio de categoría se evalúa en la categoría donde el jugador
    // realmente jugó (histórica), no en la que tiene asignada hoy.
    const histCat = (await historicCategoryKey(current.registration_id))
      || catKeyOf(current.category_code || current.category_name);
    const catPodium = await computeCategoryPodiumPlace(histCat, current.registration_id);
    const facTop = podiumPlace >= 1 && podiumPlace <= 3;
    const catTop = catPodium.place >= 1 && catPodium.place <= 3;
    if (slot) slot.textContent = '';
    if (slot && facTop){
      // La marca del hero SIEMPRE es el podio histórico de facultad, tenga o no
      // grupo activo. (Antes, si había standing vigente, se pintaba de oro la
      // posición de grupo — «#1 DE 4 · GRUPO D» — lo que confundía dos cosas
      // distintas; la posición de grupo ya vive en el panel «Torneo actual».)
      slot.appendChild(rankLine('#' + podiumPlace, 'DE ' + podium.total, 'FACULTAD', 'PODIO HISTÓRICO'));
      const facLine = slot.querySelector('.pjx-rank-line');
      if (facLine){
        // Marca institucional: nunca lleva color de categoría.
        facLine.classList.add('pjx-rank-fac');
        facLine.style.removeProperty('--pjx-accent');
        paintPlace(facLine, podiumPlace);
      }
    }
    // Marca de categoría: misma caja, con el nombre de la categoría en su color
    // y el filo del marco en ese mismo tono. Va siempre arriba de la de facultad.
    if (slot && catTop){
      const CAT_CODE = { avanzado:'AVANZADO_OPEN', intermedio:'INTERMEDIO', principiante:'PRINCIPIANTE' };
      const CAT_NAME = { avanzado:'Avanzados', intermedio:'Intermedios', principiante:'Principiantes' };
      const useCode = CAT_CODE[histCat] || current.category_code;
      const useName = CAT_NAME[histCat] || current.category_name;
      const tone = categoryTone(useCode, useName);
      const accent = categoryBrandColor(useCode, useName) || tone.fg;
      const label = normalizeMetaText(CAT_NAME[histCat] || categoryLabel(current) || current.category_name || current.category_code);
      const catLine = rankLine('#' + catPodium.place, 'DE ' + catPodium.total,
        label, 'PODIO HISTÓRICO', accent);
      paintPlace(catLine, catPodium.place);
      catLine.classList.add('pjx-rank-cat');
      if (accent) catLine.style.setProperty('--pjx-accent', accent);
      slot.insertBefore(catLine, slot.firstChild);
    }
    if (current.is_active_edition) renderGroupPosition(standing);
  }

  // ── Fallback: flujo antiguo por-inscripción (si las RPC nuevas no existen) ──
  async function loadLegacy(id){
    const { byId } = await window.SB_PARTICIPANTS.fetchEnrichedDirectory();
    const row = byId.get(id);
    if (!row){
      showState('Perfil no encontrado', 'No hay un participante público con ese identificador. Puede que aún no haya dado su consentimiento de contacto o que la liga no coincida.');
      return;
    }
    $('#pjGroupSection').hidden = true;
    $('#pjUpcomingSection').hidden = true;
    $('#pjEdSelector').hidden = true;
    buildCrumbs(row);
    renderHeader(row);
    const standing = row.group_id ? await window.SB_PARTICIPANTS.fetchOwnStanding(row.registration_id, row.group_id) : null;
    if (!standing){
      const box = $('#pjStatsBody');
      box.textContent = '';
      box.appendChild(el('div', 'empty-note', 'Aún no hay estadísticas suficientes para este jugador (sin grupo asignado o datos aún no publicados).'));
    } else {
      const s = standing.row;
      renderHeroStats({
        matches_played: s.matches_played, wins: s.wins, losses: s.losses,
        win_pct: s.win_pct, sets_won: s.sets_won, sets_lost: s.sets_lost
      });
      $('#pjGroupSection').hidden = false;
      renderGroupPosition(standing);
    }
    $('#pjForm').textContent = '';
    $('#pjForm').appendChild(el('div', 'empty-note', 'El detalle partido a partido todavía no está disponible públicamente (falta ejecutar la RPC player-centric propuesta). La organización está preparando esta sección.'));
    $('#pjMatches').textContent = '';
    $('#pjMatches').appendChild(el('div', 'empty-note', 'El detalle partido a partido todavía no está disponible públicamente (falta ejecutar la RPC player-centric propuesta). La organización está preparando esta sección.'));
  }

  async function load(){
    const id = qs('id');
    if (!id){
      showState('Perfil no encontrado', 'Falta el identificador del jugador en la URL.');
      return;
    }
    if (!window.SB_READY){
      showState('Sitio no conectado', 'Falta configurar la conexión al servidor.');
      return;
    }
    try {
      const regs = await window.SB_PARTICIPANTS.fetchPlayerRegistrations(id);
      $('#pjState').style.display = 'none';
      $('#pjBody').hidden = false;
      if (regs === null){
        await loadLegacy(id);
        return;
      }
      if (!regs.length){
        $('#pjBody').hidden = true;
        showState('Perfil no encontrado', 'No hay ningún participante público con ese identificador.');
        return;
      }
      await loadPlayerCentric(regs);
    } catch(err){
      window.SB_LOG && window.SB_LOG.error('PJ-001', err);
      showState('No se pudo cargar el perfil', 'Revisa tu conexión e intenta de nuevo. (código PJ-001)', true);
    }
  }

  $('#pjBack').addEventListener('click', () => {
    if (document.referrer) history.back(); else location.href = 'Directorio.html';
  });

  if (window.PHONE_VISIBILITY_ON_CHANGE){
    window.PHONE_VISIBILITY_ON_CHANGE(() => { if (_lastHeaderRow) renderHeader(_lastHeaderRow); });
  }

  load();
})();
