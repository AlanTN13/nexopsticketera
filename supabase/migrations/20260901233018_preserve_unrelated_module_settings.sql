create or replace function public.set_company_modules(
  target_company_id uuid,
  module_updates jsonb,
  radar_workspace_id text default null,
  radar_site_integrated boolean default false,
  kommo_embed_url text default null,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  selected_module text;
  selected_enabled boolean;
  effective_radar_workspace text;
begin
  if not private.can_manage_access_control() then
    raise exception 'Sólo un administrador de plataforma puede habilitar productos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = target_company_id) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;
  if jsonb_typeof(module_updates) <> 'array' or jsonb_array_length(module_updates) > 50 then
    raise exception 'La matriz de módulos no es válida.';
  end if;
  if change_reason is not null and char_length(change_reason) > 500 then
    raise exception 'El motivo es demasiado largo.';
  end if;
  if radar_workspace_id is not null
    and radar_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$'
  then
    raise exception 'El workspace de Radar no es válido.';
  end if;
  if kommo_embed_url is not null
    and btrim(kommo_embed_url) <> ''
    and not private.is_valid_kommo_embed_url(btrim(kommo_embed_url))
  then
    raise exception 'El reporte de Kommo no es una URL de embed válida.';
  end if;

  perform set_config('nexops.access_reason', coalesce(change_reason, ''), true);
  for item in select value from jsonb_array_elements(module_updates)
  loop
    selected_module := item ->> 'module';
    if jsonb_typeof(item -> 'enabled') <> 'boolean' then
      raise exception 'El estado del módulo no es válido.';
    end if;
    selected_enabled := (item ->> 'enabled')::boolean;
    if not exists (select 1 from public.portal_modules where key = selected_module and active) then
      raise exception 'El módulo % no existe.', selected_module;
    end if;

    update public.company_modules
    set enabled = selected_enabled,
        updated_at = now()
    where company_id = target_company_id
      and module = selected_module
      and enabled is distinct from selected_enabled;
  end loop;

  select coalesce(radar_workspace_id, settings ->> 'workspaceId')
  into effective_radar_workspace
  from public.company_modules
  where company_id = target_company_id
    and module = 'radar';

  if exists (
    select 1 from public.company_modules
    where company_id = target_company_id
      and module = 'radar'
      and enabled
  ) and effective_radar_workspace is null
  then
    raise exception 'Configurá el workspace antes de habilitar Radar.';
  end if;

  update public.company_modules
  set settings = settings
      || case
        when radar_workspace_id is null then '{}'::jsonb
        else jsonb_build_object('workspaceId', radar_workspace_id)
      end
      || jsonb_build_object('siteIntegrated', radar_site_integrated),
      updated_at = now()
  where company_id = target_company_id
    and module = 'radar'
    and settings is distinct from (
      settings
      || case
        when radar_workspace_id is null then '{}'::jsonb
        else jsonb_build_object('workspaceId', radar_workspace_id)
      end
      || jsonb_build_object('siteIntegrated', radar_site_integrated)
    );

  update public.company_modules
  set settings = case
        when kommo_embed_url is null then settings
        when btrim(kommo_embed_url) = '' then settings - 'kommoEmbedUrl'
        else settings || jsonb_build_object('kommoEmbedUrl', btrim(kommo_embed_url))
      end,
      updated_at = now()
  where company_id = target_company_id
    and module = 'metrics'
    and kommo_embed_url is not null
    and settings is distinct from case
      when btrim(kommo_embed_url) = '' then settings - 'kommoEmbedUrl'
      else settings || jsonb_build_object('kommoEmbedUrl', btrim(kommo_embed_url))
    end;
end
$$;
