-- Radar Control Plane V1.
-- The Portal owns authorization, requests and visible state. webneoxps remains
-- the editorial engine. This migration is additive and does not enable either
-- automatic scheduling or production publication.

create table public.radar_control_settings (
  workspace_id text primary key,
  company_id uuid unique references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  scheduler_enabled boolean not null default false,
  schedule_days smallint[] not null default array[1, 2, 3, 4, 5, 6]::smallint[],
  schedule_hour smallint not null default 7,
  schedule_timezone text not null default 'America/Argentina/Buenos_Aires',
  autonomy_mode text not null default 'suggest',
  next_run_at timestamptz,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint radar_control_workspace_company_unique unique (workspace_id, company_id),
  constraint radar_control_workspace_format
    check (workspace_id ~ '^[a-z0-9][a-z0-9._-]{2,80}$'),
  constraint radar_control_autonomy_allowed
    check (autonomy_mode in ('suggest', 'review', 'automatic')),
  constraint radar_control_schedule_hour_allowed
    check (schedule_hour between 0 and 23),
  constraint radar_control_schedule_days_allowed
    check (
      cardinality(schedule_days) between 1 and 7
      and schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
  constraint radar_control_timezone_length
    check (char_length(schedule_timezone) between 3 and 80)
);

create table public.radar_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.radar_control_settings(workspace_id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  trigger_kind text not null default 'manual',
  autonomy_mode text not null,
  status text not null default 'queued',
  external_run_id text,
  external_run_url text,
  candidate jsonb,
  result_reason text,
  final_url text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint radar_runs_workspace_company_consistency
    foreign key (workspace_id, company_id)
    references public.radar_control_settings(workspace_id, company_id),
  constraint radar_runs_idempotency unique (workspace_id, idempotency_key),
  constraint radar_runs_trigger_allowed check (trigger_kind in ('manual', 'scheduled')),
  constraint radar_runs_autonomy_allowed check (autonomy_mode in ('suggest', 'review', 'automatic')),
  constraint radar_runs_status_allowed check (status in (
    'queued', 'dispatching', 'running', 'no_publication', 'suggested', 'review_pending',
    'postponed', 'rejected', 'approved', 'validating', 'publishing',
    'published', 'failed', 'canceled'
  )),
  constraint radar_runs_external_id_length
    check (external_run_id is null or char_length(external_run_id) <= 120),
  constraint radar_runs_reason_length
    check (result_reason is null or char_length(result_reason) <= 1200),
  constraint radar_runs_error_length
    check (
      (error_code is null or char_length(error_code) <= 80)
      and (error_message is null or char_length(error_message) <= 500)
    ),
  constraint radar_runs_candidate_shape check (
    candidate is null or (
      jsonb_typeof(candidate) = 'object'
      and candidate ?& array['title', 'topic', 'sourceName', 'sourceUrl', 'score', 'businessReasons']
    )
  )
);

create unique index radar_runs_workspace_active_uq
  on public.radar_runs(workspace_id)
  where status in ('queued', 'dispatching', 'running', 'review_pending', 'approved', 'validating', 'publishing');
create index radar_runs_workspace_created_idx
  on public.radar_runs(workspace_id, created_at desc);
create index radar_runs_company_idx on public.radar_runs(company_id) where company_id is not null;
create index radar_runs_requested_by_idx on public.radar_runs(requested_by);
create index radar_control_settings_updated_by_idx
  on public.radar_control_settings(updated_by) where updated_by is not null;

create table public.radar_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.radar_runs(id) on delete cascade,
  event_type text not null,
  public_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint radar_run_events_type_format check (event_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint radar_run_events_message_length check (char_length(public_message) between 2 and 500),
  constraint radar_run_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index radar_run_events_run_created_idx
  on public.radar_run_events(run_id, created_at asc);

create table public.radar_run_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.radar_runs(id) on delete cascade,
  workspace_id text not null references public.radar_control_settings(workspace_id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  decision text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint radar_run_decisions_workspace_company_consistency
    foreign key (workspace_id, company_id)
    references public.radar_control_settings(workspace_id, company_id),
  constraint radar_run_decisions_idempotency unique (run_id, idempotency_key),
  constraint radar_run_decisions_allowed check (decision in ('approve', 'discard', 'postpone')),
  constraint radar_run_decisions_reason_length check (reason is null or char_length(reason) <= 500)
);
create index radar_run_decisions_workspace_created_idx
  on public.radar_run_decisions(workspace_id, created_at desc);
create index radar_run_decisions_company_idx
  on public.radar_run_decisions(company_id) where company_id is not null;
create index radar_run_decisions_actor_idx on public.radar_run_decisions(actor_user_id);

-- Existing client workspaces are prepared but the scheduler remains off.
insert into public.radar_control_settings (
  workspace_id,
  company_id,
  enabled,
  scheduler_enabled,
  autonomy_mode
)
select
  module.settings ->> 'workspaceId',
  module.company_id,
  module.enabled,
  false,
  case module.settings ->> 'publishingMode'
    when 'automatic' then 'automatic'
    when 'review' then 'review'
    else 'suggest'
  end
from public.company_modules module
where module.module = 'radar'
  and coalesce(module.settings ->> 'workspaceId', '') ~ '^[a-z0-9][a-z0-9._-]{2,80}$'
on conflict (workspace_id) do nothing;

-- Keep the commercial module switch as the source of truth without granting
-- clients any direct write access to the control-plane tables.
create or replace function private.sync_radar_control_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id text := nullif(btrim(new.settings ->> 'workspaceId'), '');
  current_workspace_id text;
begin
  if new.module <> 'radar' then return new; end if;

  select workspace_id into current_workspace_id
  from public.radar_control_settings
  where company_id = new.company_id;

  if target_workspace_id is null
    or target_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$' then
    if current_workspace_id is not null then
      update public.radar_control_settings
      set enabled = false, scheduler_enabled = false, next_run_at = null, updated_at = now()
      where company_id = new.company_id;
    end if;
    return new;
  end if;

  if current_workspace_id is not null and current_workspace_id <> target_workspace_id then
    if exists (select 1 from public.radar_runs where workspace_id = current_workspace_id) then
      raise exception 'No se puede cambiar el workspace de Radar con historial existente.' using errcode = '55000';
    end if;
    update public.radar_control_settings
    set workspace_id = target_workspace_id,
        enabled = new.enabled,
        scheduler_enabled = case when new.enabled then scheduler_enabled else false end,
        next_run_at = case when new.enabled then next_run_at else null end,
        updated_at = now()
    where company_id = new.company_id;
  elsif current_workspace_id is not null then
    update public.radar_control_settings
    set enabled = new.enabled,
        scheduler_enabled = case when new.enabled then scheduler_enabled else false end,
        next_run_at = case when new.enabled then next_run_at else null end,
        updated_at = now()
    where company_id = new.company_id;
  else
    insert into public.radar_control_settings (
      workspace_id, company_id, enabled, scheduler_enabled
    ) values (
      target_workspace_id, new.company_id, new.enabled, false
    );
  end if;
  return new;
end
$$;

create trigger sync_radar_control_setting_after_company_module
after insert or update of enabled, settings on public.company_modules
for each row execute function private.sync_radar_control_setting();

alter table public.radar_control_settings enable row level security;
alter table public.radar_runs enable row level security;
alter table public.radar_run_events enable row level security;
alter table public.radar_run_decisions enable row level security;

create or replace function private.radar_workspace_has_access(
  target_workspace_id text,
  required_level text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
      when settings.company_id is null then private.is_platform_admin()
      else private.has_module_access(settings.company_id, 'radar', required_level)
    end
    from public.radar_control_settings settings
    where settings.workspace_id = target_workspace_id),
    false
  )
$$;

revoke all on function private.radar_workspace_has_access(text, text) from public, anon;
grant execute on function private.radar_workspace_has_access(text, text) to authenticated;

create policy "authorized users read radar control settings"
on public.radar_control_settings for select to authenticated
using (private.radar_workspace_has_access(workspace_id, 'view'));

create policy "authorized users read radar runs"
on public.radar_runs for select to authenticated
using (private.radar_workspace_has_access(workspace_id, 'view'));

create policy "authorized users read radar run events"
on public.radar_run_events for select to authenticated
using (
  exists (
    select 1 from public.radar_runs run
    where run.id = radar_run_events.run_id
      and private.radar_workspace_has_access(run.workspace_id, 'view')
  )
);

create policy "authorized users read radar run decisions"
on public.radar_run_decisions for select to authenticated
using (private.radar_workspace_has_access(workspace_id, 'view'));

revoke all on public.radar_control_settings from public, anon, authenticated;
revoke all on public.radar_runs from public, anon, authenticated;
revoke all on public.radar_run_events from public, anon, authenticated;
revoke all on public.radar_run_decisions from public, anon, authenticated;
grant select on public.radar_control_settings to authenticated;
grant select on public.radar_runs to authenticated;
grant select on public.radar_run_events to authenticated;
grant select on public.radar_run_decisions to authenticated;

create or replace function public.request_radar_run(
  target_workspace_id text,
  request_idempotency_key uuid,
  request_mode text
)
returns public.radar_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  settings public.radar_control_settings;
  existing_run public.radar_runs;
  created_run public.radar_runs;
begin
  if actor_id is null or not private.radar_workspace_has_access(target_workspace_id, 'operate') then
    raise exception 'No autorizado para iniciar Radar.' using errcode = '42501';
  end if;

  select * into existing_run
  from public.radar_runs
  where workspace_id = target_workspace_id
    and idempotency_key = request_idempotency_key;
  if found then return existing_run; end if;

  select * into settings
  from public.radar_control_settings
  where workspace_id = target_workspace_id
  for update;
  if not found or not settings.enabled then
    raise exception 'Radar está pausado para este workspace.' using errcode = '55000';
  end if;
  if request_mode not in ('suggest', 'review') then
    raise exception 'La primera versión sólo permite sugerencia o revisión.' using errcode = '22023';
  end if;

  insert into public.radar_runs (
    workspace_id, company_id, requested_by, idempotency_key,
    trigger_kind, autonomy_mode, status
  ) values (
    settings.workspace_id, settings.company_id, actor_id, request_idempotency_key,
    'manual', request_mode, 'queued'
  ) returning * into created_run;

  insert into public.radar_run_events (run_id, event_type, public_message)
  values (created_run.id, 'request_created', 'Solicitud recibida por Radar.');

  return created_run;
exception
  when unique_violation then
    select * into existing_run
    from public.radar_runs
    where workspace_id = target_workspace_id
      and idempotency_key = request_idempotency_key;
    if found then return existing_run; end if;
    raise exception 'Radar ya tiene una corrida activa.' using errcode = '55000';
end
$$;

create or replace function public.update_radar_control_schedule(
  target_workspace_id text,
  requested_scheduler_enabled boolean,
  requested_schedule_days smallint[],
  requested_schedule_hour smallint,
  requested_timezone text,
  requested_autonomy_mode text
)
returns public.radar_control_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_settings public.radar_control_settings;
begin
  if (select auth.uid()) is null
    or not private.radar_workspace_has_access(target_workspace_id, 'admin') then
    raise exception 'No autorizado para configurar Radar.' using errcode = '42501';
  end if;
  if requested_scheduler_enabled then
    raise exception 'El scheduler productivo requiere un gate separado.' using errcode = '55000';
  end if;
  if requested_autonomy_mode not in ('suggest', 'review', 'automatic')
    or requested_schedule_hour not between 0 and 23
    or cardinality(requested_schedule_days) not between 1 and 7
    or not requested_schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    or char_length(btrim(requested_timezone)) not between 3 and 80 then
    raise exception 'La programación de Radar no es válida.' using errcode = '22023';
  end if;

  update public.radar_control_settings
  set scheduler_enabled = false,
      schedule_days = requested_schedule_days,
      schedule_hour = requested_schedule_hour,
      schedule_timezone = btrim(requested_timezone),
      autonomy_mode = requested_autonomy_mode,
      updated_by = (select auth.uid()),
      updated_at = now()
  where workspace_id = target_workspace_id
  returning * into updated_settings;

  if not found then raise exception 'Workspace de Radar inexistente.' using errcode = 'P0002'; end if;
  return updated_settings;
end
$$;

create or replace function public.decide_radar_run(
  target_run_id uuid,
  decision_idempotency_key uuid,
  requested_decision text,
  decision_reason text default null
)
returns public.radar_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.radar_runs;
  existing_decision public.radar_run_decisions;
begin
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or not private.radar_workspace_has_access(run.workspace_id, 'operate') then
    raise exception 'Corrida no disponible.' using errcode = '42501';
  end if;
  select * into existing_decision
  from public.radar_run_decisions
  where run_id = run.id and idempotency_key = decision_idempotency_key;
  if found then
    if existing_decision.decision <> requested_decision then
      raise exception 'La clave de decisión ya fue utilizada.' using errcode = '22023';
    end if;
    return run;
  end if;
  if run.status <> 'review_pending' then
    raise exception 'La oportunidad ya no espera una decisión.' using errcode = '55000';
  end if;
  if requested_decision not in ('approve', 'discard', 'postpone') then
    raise exception 'Decisión inválida.' using errcode = '22023';
  end if;

  insert into public.radar_run_decisions (
    run_id, workspace_id, company_id, actor_user_id,
    idempotency_key, decision, reason
  ) values (
    run.id, run.workspace_id, run.company_id, (select auth.uid()),
    decision_idempotency_key, requested_decision, nullif(btrim(decision_reason), '')
  );

  update public.radar_runs
  set status = case requested_decision
        when 'approve' then 'approved'
        when 'discard' then 'rejected'
        else 'postponed'
      end,
      completed_at = case when requested_decision = 'approve' then null else now() end,
      updated_at = now()
  where id = run.id
  returning * into run;

  insert into public.radar_run_events (run_id, event_type, public_message)
  values (
    run.id,
    'decision_' || requested_decision,
    case requested_decision
      when 'approve' then 'Oportunidad aprobada. La publicación continúa detrás del gate de producción.'
      when 'discard' then 'Oportunidad descartada por un usuario autorizado.'
      else 'Oportunidad postergada para una revisión posterior.'
    end
  );
  return run;
end
$$;

revoke all on function public.request_radar_run(text, uuid, text) from public, anon;
revoke all on function public.update_radar_control_schedule(text, boolean, smallint[], smallint, text, text) from public, anon;
revoke all on function public.decide_radar_run(uuid, uuid, text, text) from public, anon;
grant execute on function public.request_radar_run(text, uuid, text) to authenticated;
grant execute on function public.update_radar_control_schedule(text, boolean, smallint[], smallint, text, text) to authenticated;
grant execute on function public.decide_radar_run(uuid, uuid, text, text) to authenticated;

-- Platform workspaces are registered explicitly by the NexOps control plane.
-- This RPC is intentionally not available to clients or ordinary authenticated users.
create or replace function public.register_platform_radar_workspace(target_workspace_id text)
returns public.radar_control_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.radar_control_settings;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Sólo NexOps puede registrar el workspace interno.' using errcode = '42501';
  end if;
  insert into public.radar_control_settings (workspace_id, company_id, enabled, scheduler_enabled)
  values (btrim(target_workspace_id), null, true, false)
  on conflict (workspace_id) do update
    set enabled = excluded.enabled,
        updated_by = (select auth.uid()),
        updated_at = now()
  returning * into settings;
  return settings;
end
$$;
revoke all on function public.register_platform_radar_workspace(text) from public, anon, authenticated;
grant execute on function public.register_platform_radar_workspace(text) to service_role;
