-- Radar business preferences live beside the company's module entitlement.
-- Clients can tune the commercial operation without changing engine thresholds,
-- prompts, credentials, workspace ownership, or the module entitlement itself.

update public.company_modules
set settings = settings || jsonb_build_object(
  'topics', coalesce(
    settings -> 'topics',
    '["IA aplicada", "Automatización", "CRM & Ventas", "Data & Analytics"]'::jsonb
  ),
  'publicationsPerWeek', coalesce(settings -> 'publicationsPerWeek', '4'::jsonb),
  'opportunityBehavior', coalesce(settings -> 'opportunityBehavior', '"discard"'::jsonb),
  'siteIntegrated', case
    when settings ? 'siteIntegrated' then settings -> 'siteIntegrated'
    else to_jsonb(coalesce(settings ->> 'workspaceId', '') = 'nexops')
  end,
  'publishingMode', coalesce(
    settings -> 'publishingMode',
    to_jsonb(
      case
        when coalesce(settings ->> 'workspaceId', '') = 'nexops' then 'automatic'
        else 'review'
      end
    )
  )
)
where module = 'radar';

drop function if exists public.update_company_module_configuration(uuid, boolean, boolean, text);

create function public.update_company_module_configuration(
  target_company_id uuid,
  metrics_enabled boolean,
  radar_enabled boolean,
  radar_workspace_id text,
  radar_site_integrated boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_workspace_id text := nullif(trim(radar_workspace_id), '');
begin
  if not private.can_manage_global_catalog() then
    raise exception 'No tenés permisos para habilitar productos.';
  end if;

  if not exists (
    select 1 from public.companies where id = target_company_id
  ) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;

  if radar_enabled and normalized_workspace_id is null then
    raise exception 'Asigná un workspace antes de habilitar Radar.';
  end if;

  if normalized_workspace_id is not null
    and normalized_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$'
  then
    raise exception 'El workspace de Radar no tiene un formato válido.';
  end if;

  insert into public.company_modules (company_id, module, enabled)
  values (target_company_id, 'metrics', metrics_enabled)
  on conflict (company_id, module) do update
  set enabled = excluded.enabled,
      updated_at = now();

  insert into public.company_modules (company_id, module, enabled, settings)
  values (
    target_company_id,
    'radar',
    radar_enabled,
    jsonb_build_object(
      'workspaceId', normalized_workspace_id,
      'siteIntegrated', radar_site_integrated,
      'topics', '["IA aplicada", "Automatización", "CRM & Ventas", "Data & Analytics"]'::jsonb,
      'publicationsPerWeek', 4,
      'opportunityBehavior', 'discard',
      'publishingMode', case when radar_site_integrated then 'automatic' else 'review' end
    )
  )
  on conflict (company_id, module) do update
  set enabled = excluded.enabled,
      settings = public.company_modules.settings
        || jsonb_build_object(
          'siteIntegrated', radar_site_integrated,
          'publishingMode', case
            when radar_site_integrated then coalesce(
              public.company_modules.settings ->> 'publishingMode',
              'automatic'
            )
            else 'review'
          end
        )
        || case
          when normalized_workspace_id is null then '{}'::jsonb
          else jsonb_build_object('workspaceId', normalized_workspace_id)
        end,
      updated_at = now();
end
$$;

revoke all on function public.update_company_module_configuration(
  uuid, boolean, boolean, text, boolean
) from public, anon;
grant execute on function public.update_company_module_configuration(
  uuid, boolean, boolean, text, boolean
) to authenticated;

create function public.update_radar_preferences(
  target_company_id uuid,
  radar_topics text[],
  radar_publications_per_week integer,
  radar_opportunity_behavior text,
  radar_publishing_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.users%rowtype;
  cleaned_topics text[];
  radar_settings jsonb;
begin
  select * into actor_profile
  from public.users
  where id = (select auth.uid())
    and status = 'active';

  if not found
    or (
      actor_profile.role <> 'platform_admin'
      and (
        actor_profile.role <> 'client_admin'
        or actor_profile.company_id is distinct from target_company_id
      )
    )
  then
    raise exception 'No autorizado para cambiar la estrategia de Radar.' using errcode = '42501';
  end if;

  if radar_topics is null
    or cardinality(radar_topics) not between 1 and 8
    or exists (
      select 1
      from unnest(radar_topics) as topic
      where topic is null
        or char_length(btrim(topic)) not between 2 and 50
        or topic ~ '[[:cntrl:]]'
    )
    or (
      select count(distinct lower(btrim(topic)))
      from unnest(radar_topics) as topic
    ) <> cardinality(radar_topics)
  then
    raise exception 'Las temáticas de Radar no son válidas.';
  end if;

  if radar_publications_per_week not between 1 and 5 then
    raise exception 'La frecuencia semanal no es válida.';
  end if;
  if radar_opportunity_behavior not in ('discard', 'suggest') then
    raise exception 'La decisión sobre oportunidades no es válida.';
  end if;
  if radar_publishing_mode not in ('review', 'automatic') then
    raise exception 'El modo de publicación no es válido.';
  end if;

  select settings into radar_settings
  from public.company_modules
  where company_id = target_company_id
    and module = 'radar'
    and enabled
  for update;

  if not found then
    raise exception 'Radar no está habilitado para esta empresa.';
  end if;
  if radar_publishing_mode = 'automatic'
    and not (radar_settings @> '{"siteIntegrated": true}'::jsonb)
  then
    raise exception 'La publicación automática requiere un sitio conectado por NexOps.';
  end if;

  select array_agg(btrim(topic) order by position)
  into cleaned_topics
  from unnest(radar_topics) with ordinality as selected(topic, position);

  update public.company_modules
  set settings = settings || jsonb_build_object(
        'topics', to_jsonb(cleaned_topics),
        'publicationsPerWeek', radar_publications_per_week,
        'opportunityBehavior', radar_opportunity_behavior,
        'publishingMode', radar_publishing_mode
      ),
      updated_at = now()
  where company_id = target_company_id
    and module = 'radar';
end
$$;

revoke all on function public.update_radar_preferences(uuid, text[], integer, text, text)
  from public, anon, authenticated;
grant execute on function public.update_radar_preferences(uuid, text[], integer, text, text)
  to authenticated;
