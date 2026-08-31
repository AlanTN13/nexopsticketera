-- Radar can only be enabled when the company is bound to a validated workspace.
-- The RPC keeps the entitlement and its data ownership setting in one transaction.

create or replace function public.update_company_module_configuration(
  target_company_id uuid,
  metrics_enabled boolean,
  radar_enabled boolean,
  radar_workspace_id text
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
    case
      when normalized_workspace_id is null then '{}'::jsonb
      else jsonb_build_object('workspaceId', normalized_workspace_id)
    end
  )
  on conflict (company_id, module) do update
  set enabled = excluded.enabled,
      settings = case
        when normalized_workspace_id is null then public.company_modules.settings
        else jsonb_set(
          public.company_modules.settings,
          '{workspaceId}',
          to_jsonb(normalized_workspace_id),
          true
        )
      end,
      updated_at = now();
end
$$;

revoke all on function public.update_company_module_configuration(uuid, boolean, boolean, text)
  from public, anon;
grant execute on function public.update_company_module_configuration(uuid, boolean, boolean, text)
  to authenticated;
