// ── supabase/public-links.js — helpers compartidos de navegación pública ──
// Único lugar donde se arma la URL de perfil/facultad/carrera y el logo
// animado clicable de Ingeniería (facultad ↔ carrera). Cargar después de
// logo-resolver.js y antes del script de cada página.
//
// IDENTIFICADOR DE PERFIL — decisión documentada:
// registrations.public_code (el "folio") NO se expone hoy en ninguna vista
// ni RPC pública (confirmado en sql/03_security_rls.sql: get_public_contact_directory
// devuelve registration_id, no public_code; v_public_group_members tampoco lo trae).
// Mientras esa RPC no exista (ver sql/PROPUESTA_public_player_profiles.sql),
// se usa registration_id — que YA es público hoy (viaja en get_public_contact_directory)
// — como identificador estable en la URL, con el parámetro `id`. En cuanto
// exista get_public_player_profile(p_public_code), este módulo cambia a `folio`
// sin tocar las páginas que lo consumen.
(function(global){
  'use strict';
  const FI_CODE = 'INGENIERIA';

  function buildPlayerProfileUrl(registrationId){
    if (!registrationId) return null;
    return 'PerfilJugador.html?id=' + encodeURIComponent(registrationId);
  }
  function buildFacultyUrl(facultyCode){
    if (!facultyCode) return null;
    return 'Facultad.html?code=' + encodeURIComponent(facultyCode);
  }
  function buildCareerUrl(careerCode){
    // Se eliminaron las páginas de carrera: cualquier logo/enlace de carrera
    // (incluida la cara "carrera" del logo animado de Ingeniería) va directo
    // a la Facultad de Ingeniería.
    return buildFacultyUrl(FI_CODE);
  }

  // Enlace de apodo → perfil. Si no hay registration_id, devuelve un <span>
  // (nunca un <a href="#">) para no prometer una navegación que no existe.
  function makePlayerLink(nickname, registrationId, opts){
    opts = opts || {};
    const url = buildPlayerProfileUrl(registrationId);
    const label = nickname || '—';
    if (!url) {
      const span = document.createElement('span');
      span.textContent = label;
      if (opts.className) span.className = opts.className;
      return span;
    }
    const a = document.createElement('a');
    a.href = url;
    a.textContent = label;
    if (opts.className) a.className = opts.className;
    if (opts.stopPropagation) a.addEventListener('click', e => e.stopPropagation());
    return a;
  }

  // ── Logo académico clicable ──────────────────────────────────────────
  // Reutiliza EXACTAMENTE las specs de animación fac-wrap/fac-flip/mcBob/mcSpin
  // (30s de ciclo: 0-12s cara frontal, 12-15s giro, 15-27s cara trasera,
  // 27-30s giro de regreso). El destino del clic depende de la cara
  // realmente visible en ese instante (no de un timeout aproximado): se
  // calcula el ángulo real de rotación a partir del tiempo transcurrido.
  function makeAcademicLogoLink(facultyCode, careerCode, facultyName, careerName){
    if (!facultyCode) return null;
    const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFI = facultyCode === FI_CODE && !!careerCode;

    const a = document.createElement('a');
    a.className = 'acad-logo-link';
    a.style.display = 'block';
    a.style.lineHeight = '0';
    a.style.flex = '0 0 auto';

    const wrap = document.createElement('span');
    wrap.className = 'fac-wrap';
    // dentro de un <a> el span queda display:inline y las animaciones de
    // transform (mcBob/mcSpin) no aplican a elementos inline — forzar block.
    wrap.style.display = 'block';

    function setStaticFaculty(){
      a.href = buildFacultyUrl(facultyCode);
      a.setAttribute('aria-label', 'Abrir ' + (facultyName || facultyCode));
      wrap.dataset.face = 'faculty';
    }

    if (!isFI || reduced){
      // otras facultades, o Ingeniería sin carrera/con reduced-motion:
      // logo estático (o solo bob), siempre hacia Facultad.html
      const img = document.createElement('img');
      img.className = 'fac-item';
      img.src = global.SB_LOGOS.facultyLogo(facultyCode);
      img.alt = facultyName || facultyCode;
      img.loading = 'lazy';
      img.onerror = () => { img.src = global.SB_LOGOS.FALLBACK_FACULTY; img.onerror = null; };
      wrap.appendChild(img);
      setStaticFaculty();
      a.appendChild(wrap);
      a.tabIndex = 0;
      a.addEventListener('keydown', e => {
        if (e.key === ' '){ e.preventDefault(); global.location.href = a.href; }
      });
      return a;
    }

    // Ingeniería con carrera: dos caras + estado de cara visible sincronizado.
    const flip = document.createElement('span');
    flip.className = 'fac-flip';
    const front = document.createElement('img');
    front.className = 'fac-face fac-front';
    front.src = global.SB_LOGOS.facultyLogo(facultyCode);
    front.alt = ''; front.loading = 'lazy';
    front.onerror = () => { front.src = global.SB_LOGOS.FALLBACK_FACULTY; front.onerror = null; };
    const back = document.createElement('img');
    back.className = 'fac-face fac-back';
    back.src = global.SB_LOGOS.careerLogo(careerCode);
    back.alt = ''; back.loading = 'lazy';
    back.onerror = () => { back.src = global.SB_LOGOS.FALLBACK_CAREER; back.onerror = null; };
    flip.appendChild(front); flip.appendChild(back);
    wrap.appendChild(flip);
    a.appendChild(wrap);
    a.tabIndex = 0;

    const CYCLE = 30000, T_START_SPIN = 12000, T_MID = 13500, T_BACK_FIXED = 27000, T_MID2 = 28500;
    const t0 = performance.now();
    function currentFace(){
      const t = (performance.now() - t0) % CYCLE;
      if (t < T_START_SPIN) return 'faculty';
      if (t < T_MID) return 'faculty';        // <90° de giro: sigue viéndose la cara frontal
      if (t < T_BACK_FIXED) return 'career';  // >=90°: ya se ve la trasera
      if (t < T_MID2) return 'career';
      return 'faculty';
    }
    function sync(){
      const face = currentFace();
      wrap.dataset.face = face;
      if (face === 'career'){
        a.href = buildCareerUrl(careerCode);
        a.setAttribute('aria-label', 'Abrir ' + (careerName || careerCode));
      } else {
        a.href = buildFacultyUrl(facultyCode);
        a.setAttribute('aria-label', 'Abrir ' + (facultyName || facultyCode));
      }
    }
    sync();
    const timer = setInterval(sync, 250);
    // limpiar el timer si el elemento se retira del DOM
    const mo = new MutationObserver(() => {
      if (!document.contains(a)){ clearInterval(timer); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    a.addEventListener('keydown', e => {
      if (e.key === ' '){ e.preventDefault(); global.location.href = a.href; }
    });
    return a;
  }

  // ── Header de facultad/carrera (Facultad.html, Carrera.html) ──────────
  // A diferencia de makeAcademicLogoLink (usado en listas/tarjetas), el
  // logo de hasta arriba NUNCA gira: si hay carrera, se muestran ambos
  // escudos lado a lado (facultad estático a la izquierda, carrera estática
  // a la derecha), cada uno con su propio enlace.
  function makeAcademicLogoHeader(facultyCode, careerCode, facultyName, careerName){
    if (!facultyCode) return null;
    const frag = document.createDocumentFragment();

    const facLink = document.createElement('a');
    facLink.className = 'ah-logo-box';
    facLink.href = buildFacultyUrl(facultyCode);
    facLink.setAttribute('aria-label', 'Abrir ' + (facultyName || facultyCode));
    const facImg = document.createElement('img');
    facImg.src = global.SB_LOGOS.facultyLogo(facultyCode);
    facImg.alt = facultyName || facultyCode;
    facImg.loading = 'lazy';
    facImg.onerror = () => { facImg.src = global.SB_LOGOS.FALLBACK_FACULTY; facImg.onerror = null; };
    facLink.appendChild(facImg);
    frag.appendChild(facLink);

    if (careerCode){
      const carLink = document.createElement('a');
      carLink.className = 'ah-logo-box ah-logo-career';
      carLink.href = buildCareerUrl(careerCode);
      carLink.setAttribute('aria-label', 'Abrir ' + (careerName || careerCode));
      const carImg = document.createElement('img');
      carImg.src = global.SB_LOGOS.careerLogo(careerCode);
      carImg.alt = careerName || careerCode;
      carImg.loading = 'lazy';
      carImg.onerror = () => { carImg.src = global.SB_LOGOS.FALLBACK_CAREER; carImg.onerror = null; };
      carLink.appendChild(carImg);
      frag.appendChild(carLink);
    }
    return frag;
  }

  const api = { buildPlayerProfileUrl, buildFacultyUrl, buildCareerUrl, makePlayerLink, makeAcademicLogoLink, makeAcademicLogoHeader };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_LINKS = api;
})(typeof window !== 'undefined' ? window : globalThis);
