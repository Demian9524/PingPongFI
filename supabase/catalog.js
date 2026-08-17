// ── Catálogos públicos (RLS: public_read para anon) ─────────────────────
// Resuelve IDs por códigos estables — nunca hardcodear IDs numéricos.
//
// window.SB_CATALOG:
//   getActiveEdition()            → {id, name, slug, status, ...}
//   getEditionCategories(edId)    → [{id, category_id, code, name, ...}]
//   getFaculties()                → [{id, code, name}]
//   getCareersByFaculty(facId)    → [{id, code, name}]
//   getEditionTimeSlots(edId)     → [{id, starts_at, ends_at, ...}]
//   resolveFacultyId(formCode)    → int|null   (por code, luego por nombre)
//   resolveCareerId(facId, code)  → int|null

(function(){
  'use strict';
  const cache = {};

  function norm(s){
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  function requireClient(){
    if (!window.SB) throw new Error('SUPABASE_NOT_CONFIGURED');
    return window.SB;
  }

  async function getActiveEdition(){
    if (cache.edition) return cache.edition;
    const sb = requireClient();
    const slug = window.SB_EDITION_SLUG;
    const { data, error } = await sb.from('editions')
      .select('id, name, slug, status, starts_on, ends_on, registration_opens_at, registration_closes_at, timezone')
      .eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('EDITION_NOT_FOUND: no existe una edición con slug "' + slug + '"');
    cache.edition = data;
    return data;
  }

  async function getEditionBySlug(slug){
    const k = 'edition_' + slug;
    if (cache[k]) return cache[k];
    const sb = requireClient();
    const { data, error } = await sb.from('editions')
      .select('id, name, slug, status, starts_on, ends_on, registration_opens_at, registration_closes_at, timezone')
      .eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    cache[k] = data;
    return data;
  }

  // Todas las ediciones (para vista de participantes históricos). Tabla
  // pública de solo lectura (RLS public_read); no requiere is_organizer().
  async function getAllEditions(){
    if (cache.allEditions) return cache.allEditions;
    const sb = requireClient();
    const { data, error } = await sb.from('editions')
      .select('id, name, slug, status, starts_on, ends_on')
      .order('starts_on', { ascending: false });
    if (error) throw error;
    cache.allEditions = data || [];
    return cache.allEditions;
  }

  async function getEditionCategories(editionId){
    const k = 'edcats_' + editionId;
    if (cache[k]) return cache[k];
    const sb = requireClient();
    const { data, error } = await sb.from('edition_categories')
      .select('id, category_id, status, initial_capacity, maximum_capacity, categories(code, display_name)')
      .eq('edition_id', editionId);
    if (error) throw error;
    const rows = (data || []).map(r => ({
      id: r.id, category_id: r.category_id, status: r.status,
      initial_capacity: r.initial_capacity, maximum_capacity: r.maximum_capacity,
      code: r.categories ? r.categories.code : null,
      name: r.categories ? r.categories.display_name : null
    }));
    cache[k] = rows;
    return rows;
  }

  async function getFaculties(){
    if (cache.faculties) return cache.faculties;
    const sb = requireClient();
    const { data, error } = await sb.from('faculties').select('id, code, display_name');
    if (error) throw error;
    cache.faculties = (data || []).map(f => ({ id: f.id, code: f.code, name: f.display_name }));
    return cache.faculties;
  }

  async function getCareersByFaculty(facultyId){
    const k = 'careers_' + facultyId;
    if (cache[k]) return cache[k];
    const sb = requireClient();
    const { data, error } = await sb.from('careers')
      .select('id, code, display_name, faculty_id').eq('faculty_id', facultyId);
    if (error) throw error;
    cache[k] = (data || []).map(c => ({ id: c.id, code: c.code, name: c.display_name, faculty_id: c.faculty_id }));
    return cache[k];
  }

  async function getEditionTimeSlots(editionId){
    const k = 'slots_' + editionId;
    if (cache[k]) return cache[k];
    const sb = requireClient();
    const { data, error } = await sb.from('edition_time_slots')
      .select('id, starts_at, ends_at, location, enabled')
      .eq('edition_id', editionId).eq('enabled', true);
    if (error) throw error;
    cache[k] = data || [];
    return cache[k];
  }

  // El formulario envía los codes reales de la BD (INGENIERIA,
  // CONTADURIA_ADMINISTRACION, …). Se intenta empatar por code exacto y,
  // como respaldo, por nombre normalizado (borradores antiguos ya se
  // normalizan en registro.js antes de llegar aquí).
  async function resolveFacultyId(formCode){
    if (!formCode) return null;
    const list = await getFaculties();
    const exact = list.find(f => norm(f.code) === norm(formCode));
    if (exact) return exact.id;
    const n = norm(formCode);
    const byName = list.find(f => norm(f.name).includes(n) || n.includes(norm(f.code)));
    return byName ? byName.id : null;
  }

  async function resolveCareerId(facultyId, formCode){
    if (!facultyId || !formCode) return null;
    const list = await getCareersByFaculty(facultyId);
    const exact = list.find(c => norm(c.code) === norm(formCode));
    if (exact) return exact.id;
    const n = norm(formCode);
    const byName = list.find(c => norm(c.name).includes(n));
    return byName ? byName.id : null;
  }

  window.SB_CATALOG = {
    getActiveEdition, getEditionBySlug, getAllEditions, getEditionCategories, getFaculties,
    getCareersByFaculty, getEditionTimeSlots, resolveFacultyId, resolveCareerId,
    _cachedEdition: () => cache.edition || null
  };
})();
