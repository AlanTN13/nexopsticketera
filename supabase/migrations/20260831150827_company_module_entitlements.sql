-- Portal products are enabled per company. Support remains available to every
-- client account; optional products are opt-in and enforced server-side.

create table public.company_modules (
  company_id uuid not null references public.companies(id) on delete cascade,
  module text not null,
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (company_id, module),
  constraint company_modules_module_allowed
    check (module in ('metrics', 'radar')),
  constraint company_modules_settings_object
    check (jsonb_typeof(settings) = 'object')
);

alter table public.company_modules enable row level security;

create policy "active users read visible company modules"
on public.company_modules for select to authenticated
using (
  private.is_active_user()
  and (
    private.is_internal_user()
    or company_id = private.current_company_id()
  )
);

create policy "catalog managers create company modules"
on public.company_modules for insert to authenticated
with check (private.can_manage_global_catalog());

create policy "catalog managers update company modules"
on public.company_modules for update to authenticated
using (private.can_manage_global_catalog())
with check (private.can_manage_global_catalog());

create policy "catalog managers delete company modules"
on public.company_modules for delete to authenticated
using (private.can_manage_global_catalog());

revoke all on public.company_modules from anon;
grant select, insert, update, delete on public.company_modules to authenticated;

create or replace function public.update_company_module_availability(
  target_company_id uuid,
  metrics_enabled boolean,
  radar_enabled boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.can_manage_global_catalog() then
    raise exception 'No tenés permisos para habilitar productos.';
  end if;

  if not exists (
    select 1 from public.companies where id = target_company_id
  ) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;

  insert into public.company_modules (company_id, module, enabled)
  values
    (target_company_id, 'metrics', metrics_enabled),
    (target_company_id, 'radar', radar_enabled)
  on conflict (company_id, module) do update
  set enabled = excluded.enabled,
      updated_at = now();
end
$$;

revoke all on function public.update_company_module_availability(uuid, boolean, boolean)
  from public, anon;
grant execute on function public.update_company_module_availability(uuid, boolean, boolean)
  to authenticated;

insert into public.company_modules (company_id, module, enabled)
select
  company.id,
  available.module,
  available.module = 'metrics' and company.slug = 'global-trip'
from public.companies company
cross join (values ('metrics'), ('radar')) as available(module)
on conflict (company_id, module) do nothing;

create index company_modules_enabled_idx
  on public.company_modules(module, company_id)
  where enabled;
