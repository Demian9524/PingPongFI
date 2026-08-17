// ── Resolución de logos (solo frontend) ─────────────────────────────────
// El backend NUNCA guarda rutas de imagen: solo faculty_code y career_code.
// Este módulo decide qué logo mostrar según esos códigos.
//
// Rutas esperadas (coloca los archivos ahí; nombres = code de la BD en MAYÚSCULAS):
//   assets/logos/facultades/<FACULTY_CODE>.svg
//   assets/logos/carreras-fi/<CAREER_CODE>.svg
//   assets/logos/fallback/facultad-default.png
//   assets/logos/fallback/carrera-default.png

(function(global){
  'use strict';

  const FACULTY_DIR = 'assets/logos/facultades/';
  const CAREER_DIR = 'assets/logos/carreras-fi/';
  const FALLBACK_FACULTY = 'assets/logos/fallback/facultad-default.png';
  const FALLBACK_CAREER = 'assets/logos/fallback/carrera-default.png';
  const FI_CODE = 'INGENIERIA';

  function facultyLogo(facultyCode){
    if (!facultyCode) return FALLBACK_FACULTY;
    return FACULTY_DIR + String(facultyCode).toUpperCase() + '.svg';
  }
  function careerLogo(careerCode){
    if (!careerCode) return FALLBACK_CAREER;
    return CAREER_DIR + String(careerCode).toUpperCase() + '.png';
  }

  // hash estable simple (no criptográfico) para alternar determinísticamente
  function stableHash(str){
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  // Para tarjetas grandes: devuelve una lista de {src, alt} a mostrar.
  // Si es FI y hay carrera, muestra ambos logos (Facultad + carrera).
  function resolveForCard(facultyCode, careerCode, facultyName, careerName){
    if (facultyCode !== FI_CODE){
      return [{ src: facultyLogo(facultyCode), alt: facultyName || facultyCode || 'Facultad' }];
    }
    const out = [{ src: facultyLogo(facultyCode), alt: facultyName || 'Facultad de Ingeniería' }];
    if (careerCode) out.push({ src: careerLogo(careerCode), alt: careerName || careerCode });
    return out;
  }

  // Para tablas pequeñas: un solo logo. Si es FI con carrera, alterna
  // determinísticamente entre el logo de FI y el de la carrera usando
  // un identificador estable (registration_id o nickname).
  function resolveForTable(facultyCode, careerCode, stableKey){
    if (facultyCode !== FI_CODE) return { src: facultyLogo(facultyCode), alt: facultyCode || 'Facultad' };
    if (!careerCode) return { src: facultyLogo(facultyCode), alt: 'Facultad de Ingeniería' };
    const useCareer = stableHash(stableKey) % 2 === 0;
    return useCareer
      ? { src: careerLogo(careerCode), alt: careerCode }
      : { src: facultyLogo(facultyCode), alt: 'Facultad de Ingeniería' };
  }

  const api = { facultyLogo, careerLogo, resolveForCard, resolveForTable, FALLBACK_FACULTY, FALLBACK_CAREER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SB_LOGOS = api;
})(typeof window !== 'undefined' ? window : globalThis);
