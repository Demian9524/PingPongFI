// ── Zonas de clasificación configurables (lectura compartida) ────────────
// Fuente: rpc get_public_qualification_config(p_edcat). Si la RPC aún no
// existe en la instancia (SQL propuesto sin ejecutar) o falla, se usa el
// MISMO fallback que define el backend → la página se ve como hoy.
// Solo visualización: nunca crea partidos ni toca standings/bracket.
(function(global){
  'use strict';
  // Tokens de color: siguen el color de la categoría activa (var(--red2) →
  // rojo en avanzados, azul en intermedios, verde en principiantes) con los
  // MISMOS tonos que usa «Bombos al momento», para que la leyenda de la Fase de
  // Grupos y los bombos de abajo coincidan exactamente.
  const TOKENS = {
    '@bombo1':'color-mix(in oklab,var(--red2,#dd3b2c) 40%,#fff0d8)',
    '@bombo2':'var(--red2,#dd3b2c)',
    '@bombo3':'color-mix(in oklab,var(--red2,#dd3b2c) 80%,#3d0f1e)',
    // fondo propio del bombo 3: casi negro, para que su fila no se confunda con
    // la del bombo 2 (el acento sí conserva color para verse en la leyenda)
    '@bombo3bg':'color-mix(in oklab,var(--red2,#dd3b2c) 24%,#0b0306)',
    '@fuera':'var(--dim,#71614b)'
  };
  // equivalente hex aproximado, solo para el selector de color del admin
  const SWATCH = { '@bombo1':'#F5C3A2', '@bombo2':'#DD3B2C', '@bombo3':'#7A2119', '@fuera':'#71614B' };
  const ckey = c => String(c == null ? '' : c).trim().toLowerCase();
  function isToken(c){ return !!TOKENS[ckey(c)]; }
  function resolve(c){ return TOKENS[ckey(c)] || c; }
  function swatchHex(c){
    const k = ckey(c);
    return SWATCH[k] || (/^#[0-9a-f]{6}$/.test(k) ? String(c).trim() : '#888888');
  }
  // Por defecto las zonas SON los bombos: la tabla de grupos y su leyenda dicen
  // lo mismo —y con el mismo color— que «Bombos al momento» debajo.
  const DEFAULT = {
    version: 1,
    bands: [
      { id:'pot1', enabled:true, label:'BOMBO 1', color:'@bombo1', bgPct:30, textColor:'#1A1712', positionFrom:1, positionTo:1, showInLegend:true, displayOrder:1, displayStyle:'ROW' },
      { id:'pot2', enabled:true, label:'BOMBO 2', color:'@bombo2', bgPct:24, textColor:'#FFFFFF', positionFrom:2, positionTo:2, showInLegend:true, displayOrder:2, displayStyle:'ROW' },
      { id:'pot3', enabled:true, label:'BOMBO 3', color:'@bombo3', bg:'@bombo3bg', bgPct:66, textColor:'#FFFFFF', positionFrom:3, positionTo:3, showInLegend:true, displayOrder:3, displayStyle:'ROW' },
      { id:'out', enabled:true, label:'NO ENTRAN AL SORTEO', color:'@fuera', bgPct:6, textColor:'#FFFFFF', positionFrom:4, positionTo:null, showInLegend:true, displayOrder:4, displayStyle:'ROW' }
    ],
    bestThirds: {
      enabled:true, sourcePosition:3, qualifyingSlots:2,
      title:'TERCEROS · SISTEMA 5–4–3',
      subtitle:'Las plazas de tercero se reparten por tamaño efectivo de grupo: primero los de grupos de 5 (Nivel A), después los de 4 (Nivel B) y solo si es indispensable los de 3 (Nivel C).',
      qualifiedLabel:'PASA', eliminatedLabel:'FUERA',
      // qualifyingSlots y rankingRules los DERIVA el reglamento (format-engine.js):
      // el número de plazas depende del número de grupos y del tamaño efectivo.
      rankingRules:['WINS','SET_DIFFERENCE','SET_PCT']
    }
  };
  const cache = {};

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  // Config heredada = las 3 zonas viejas (clasifica directo / tercero /
  // eliminado, azul-amarillo-gris). Nadie la configuró a propósito: es el
  // default anterior guardado en la base, así que se sustituye por el nuevo
  // default —los BOMBOS— para que la Fase de Grupos y «Bombos al momento»
  // coincidan. En cuanto el admin toque las zonas (ids pot1/pot2/pot3/out u
  // otros) se respeta lo que haya guardado.
  const LEGACY = ['direct','repechage','eliminated'];
  function normalize(cfg){
    if (!cfg || !Array.isArray(cfg.bands) || !cfg.bands.length) return cfg;
    const legacy = cfg.bands.every(b => LEGACY.indexOf(b.id) >= 0);
    if (!legacy) return cfg;
    const out = clone(cfg);
    out.bands = clone(DEFAULT.bands);
    return out;
  }

  async function get(edcatId){
    if (cache[edcatId]) return cache[edcatId];
    let cfg = null;
    try {
      if (global.SB){
        const { data, error } = await global.SB.rpc('get_public_qualification_config', { p_edcat: edcatId });
        if (!error && data && Array.isArray(data.bands)) cfg = data;
      }
    } catch(e){ /* RPC ausente → fallback */ }
    cache[edcatId] = cfg ? normalize(cfg) : clone(DEFAULT);
    return cache[edcatId];
  }

  function invalidate(edcatId){
    if (edcatId == null) Object.keys(cache).forEach(k => delete cache[k]);
    else delete cache[edcatId];
  }

  // zonas activas en orden de displayOrder (fallback: orden del arreglo)
  function activeBands(cfg){
    return ((cfg && cfg.bands) || [])
      .map((b, i) => ({ b, i }))
      .filter(x => x.b.enabled !== false)
      .sort((a, c) => ((a.b.displayOrder ?? a.i) - (c.b.displayOrder ?? c.i)))
      .map(x => x.b);
  }

  // primera zona activa cuyo rango [positionFrom, positionTo||∞] contiene pos (1-based)
  function bandFor(cfg, pos){
    return activeBands(cfg).find(b =>
      pos >= (b.positionFrom || 1) && (b.positionTo == null || pos <= b.positionTo)) || null;
  }

  function legendBands(cfg){
    return activeBands(cfg).filter(b => b.showInLegend !== false);
  }

  // fondo suave a partir del color pleno de la zona
  // color de fondo de la zona: usa band.bg si existe, si no el propio color
  function bgOf(band){ return band && (band.bg || band.color); }

  function softBg(hex, pct){
    return 'color-mix(in srgb, ' + resolve(hex) + ' ' + (pct || 16) + '%, transparent)';
  }

  global.SB_QUALCONFIG = { get, invalidate, bandFor, activeBands, legendBands, softBg,
    resolve, isToken, swatchHex, normalize, bgOf, TOKENS, DEFAULT, clone };
})(window);
