create table public.metrics_sync_state (
  company_id uuid primary key references public.companies(id) on delete cascade,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'ready', 'error')),
  last_trigger text
    check (last_trigger is null or last_trigger in ('manual', 'scheduled', 'bootstrap')),
  requested_by uuid references public.users(id) on delete set null,
  last_attempt_at timestamptz,
  refresh_started_at timestamptz,
  last_success_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  updated_at timestamptz not null default now()
);

create index metrics_sync_state_requested_by_idx
  on public.metrics_sync_state (requested_by)
  where requested_by is not null;

create table public.metrics_source_snapshots (
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null
    check (source_type in ('clients', 'strategy', 'meta', 'mailchimp')),
  source_url text not null,
  content text,
  status text not null default 'ready'
    check (status in ('ready', 'error')),
  fetched_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (company_id, source_type)
);

alter table public.metrics_sync_state enable row level security;
alter table public.metrics_source_snapshots enable row level security;

revoke all on table public.metrics_sync_state from public, anon, authenticated;
revoke all on table public.metrics_source_snapshots from public, anon, authenticated;
grant select, insert, update on table public.metrics_sync_state to service_role;
grant select, insert, update on table public.metrics_source_snapshots to service_role;

create or replace function public.claim_metrics_refresh(
  target_company_id uuid,
  target_trigger text,
  target_requested_by uuid default null
)
returns table(acquired boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_state public.metrics_sync_state%rowtype;
  seconds_remaining integer;
begin
  if target_trigger not in ('manual', 'scheduled', 'bootstrap') then
    raise exception 'Invalid metrics refresh trigger';
  end if;

  if not exists (
    select 1
    from public.company_modules module_access
    where module_access.company_id = target_company_id
      and module_access.module = 'metrics'
      and module_access.enabled = true
  ) then
    raise exception 'Metrics are not enabled for this company';
  end if;

  insert into public.metrics_sync_state (company_id)
  values (target_company_id)
  on conflict (company_id) do nothing;

  select *
  into current_state
  from public.metrics_sync_state
  where company_id = target_company_id
  for update;

  if current_state.status = 'running'
    and current_state.refresh_started_at > now() - interval '5 minutes' then
    seconds_remaining := greatest(
      1,
      ceil(extract(epoch from (
        current_state.refresh_started_at + interval '5 minutes' - now()
      )))::integer
    );
    return query select false, seconds_remaining;
    return;
  end if;

  if current_state.last_attempt_at > now() - interval '1 minute' then
    seconds_remaining := greatest(
      1,
      ceil(extract(epoch from (
        current_state.last_attempt_at + interval '1 minute' - now()
      )))::integer
    );
    return query select false, seconds_remaining;
    return;
  end if;

  update public.metrics_sync_state
  set status = 'running',
      last_trigger = target_trigger,
      requested_by = target_requested_by,
      last_attempt_at = now(),
      refresh_started_at = now(),
      last_error = null,
      updated_at = now()
  where company_id = target_company_id;

  return query select true, 0;
end;
$$;

revoke all on function public.claim_metrics_refresh(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_metrics_refresh(uuid, text, uuid)
  to service_role;

comment on table public.metrics_source_snapshots is
  'Last valid server-only CSV snapshot for each metrics source and company.';
comment on function public.claim_metrics_refresh(uuid, text, uuid) is
  'Atomically enforces a one-minute refresh cooldown and prevents concurrent source fetches.';
