-- ── site_settings: configuración pública editable por el organizador ─────
-- Objetivo: los interruptores de "Secciones de la página pública" y la
-- config de "Premio y bolsa" (ControlTorneo.html) hoy viven en localStorage
-- (solo ese navegador). Esta tabla los hace globales: cualquier visitante,
-- en cualquier dispositivo, ve el mismo valor.
--
-- Uso: ejecutar UNA vez en el SQL Editor de Supabase. No toca ninguna otra
-- tabla, no borra datos, no afecta inscripciones/grupos/partidos.

create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.site_settings enable row level security;

-- Lectura pública (anon + authenticated): cualquier visitante debe poder
-- ver la config vigente sin sesión.
drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public on public.site_settings
  for select using (true);

-- Sin insert/update/delete directo desde el frontend: solo vía RPC
-- (security definer) que valida is_organizer(). No se crean policies de
-- escritura → RLS las deniega por defecto.

-- ── RPC de escritura (requiere is_organizer()) ───────────────────────────
create or replace function public.admin_save_site_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_organizer() then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'INVALID_KEY';
  end if;

  insert into public.site_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), current_actor_id())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;

  return jsonb_build_object('ok', true, 'key', p_key);
end;
$$;

revoke all on function public.admin_save_site_setting(text, jsonb) from public;
grant execute on function public.admin_save_site_setting(text, jsonb) to authenticated;

-- ── RPC de lectura pública (alternativa a select directo; anon incluido) ─
create or replace function public.get_public_site_settings()
returns table(key text, value jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select key, value from public.site_settings;
$$;

revoke all on function public.get_public_site_settings() from public;
grant execute on function public.get_public_site_settings() to anon, authenticated;

-- Llaves usadas hoy por el frontend (se crean vacías; el primer guardado
-- desde ControlTorneo.html las llena con los valores reales):
--   'torneo_sections_cfg_v1' → visibilidad de secciones públicas
--   'torneo_prize_cfg_v1'    → premio y bolsa del torneo
