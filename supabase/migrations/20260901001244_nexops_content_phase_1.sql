-- NexOps Contenido Fase 1: Instagram configuration and observed data only.
-- Additive migration. No publication, analysis, scoring, strategy or briefs.

alter table public.company_modules
  drop constraint company_modules_module_allowed;

alter table public.company_modules
  add constraint company_modules_module_allowed
  check (module in ('metrics', 'radar', 'content'));

insert into public.company_modules (company_id, module, enabled, settings)
select
  company.id,
  'content',
  company.slug = 'sysnexops',
  case
    when company.slug = 'sysnexops' then jsonb_build_object(
      'workspaceId', 'nexops',
      'syncFrequency', 'weekly'
    )
    else '{}'::jsonb
  end
from public.companies company
on conflict (company_id, module) do nothing;

create table public.content_workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9._-]{2,80}$'),
  sync_frequency text not null default 'weekly' check (sync_frequency = 'weekly'),
  scheduled_enabled boolean not null default false,
  next_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, slug)
);

insert into public.content_workspaces (company_id, slug)
select company.id, 'nexops'
from public.companies company
where company.slug = 'sysnexops'
on conflict (company_id, slug) do nothing;

create table public.content_instagram_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  status text not null default 'authorization_required'
    check (status in (
      'authorization_required', 'selection_required', 'connected',
      'reconnect_required', 'paused', 'error'
    )),
  enabled boolean not null default true,
  graph_version text,
  facebook_page_id text,
  facebook_page_name text,
  instagram_user_id text,
  instagram_username text,
  selection_options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(selection_options) = 'array'),
  authorized_scopes text[] not null default '{}',
  connected_by uuid references public.users(id) on delete set null,
  token_expires_at timestamptz,
  last_validated_at timestamptz,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id),
  unique (id, company_id)
);

create table public.content_meta_credentials (
  connection_id uuid primary key,
  company_id uuid not null,
  foreign key (connection_id, company_id)
    references public.content_instagram_connections(id, company_id) on delete cascade,
  token_ciphertext text,
  pending_selection_ciphertext text,
  updated_at timestamptz not null default now(),
  check (token_ciphertext is not null or pending_selection_ciphertext is not null)
);

create table public.content_meta_oauth_states (
  state_hash text primary key,
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  redirect_path text not null default '/portal/contenido/fuentes',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.content_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  account_kind text not null
    check (account_kind in ('own', 'competitor', 'reference')),
  username text not null,
  instagram_account_id text,
  display_name text,
  note text check (note is null or char_length(note) <= 500),
  active boolean not null default true,
  availability_status text not null default 'pending'
    check (availability_status in ('pending', 'available', 'unsupported', 'not_found', 'error')),
  last_access_at timestamptz,
  last_sync_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  retired_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, username),
  unique (workspace_id, instagram_account_id),
  unique (id, company_id, workspace_id)
);

create unique index content_instagram_accounts_one_own_idx
  on public.content_instagram_accounts(workspace_id)
  where account_kind = 'own' and retired_at is null;

create index content_instagram_accounts_company_active_idx
  on public.content_instagram_accounts(workspace_id, active)
  where retired_at is null;

create table public.content_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  request_key text not null,
  trigger text not null check (trigger in ('manual', 'scheduled')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  requested_by uuid references public.users(id) on delete set null,
  adapter_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  accounts_attempted integer not null default 0 check (accounts_attempted >= 0),
  accounts_succeeded integer not null default 0 check (accounts_succeeded >= 0),
  publications_new integer not null default 0 check (publications_new >= 0),
  publications_known integer not null default 0 check (publications_known >= 0),
  snapshots_created integer not null default 0 check (snapshots_created >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  unique (workspace_id, request_key),
  unique (id, company_id, workspace_id)
);

create unique index content_sync_runs_one_active_company_idx
  on public.content_sync_runs(workspace_id)
  where status = 'running';

create index content_sync_runs_company_started_idx
  on public.content_sync_runs(workspace_id, started_at desc);

create table public.content_sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null,
  account_id uuid,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id)
    on delete set null (account_id),
  level text not null check (level in ('info', 'warning', 'error')),
  code text not null,
  message text not null check (char_length(message) <= 1000),
  external_request_id text,
  occurred_at timestamptz not null default now(),
  event_key text not null,
  retryable boolean not null default false,
  unique (run_id, account_id, event_key)
);

create index content_sync_events_run_idx
  on public.content_sync_events(run_id, occurred_at);

create table public.content_sync_run_accounts (
  run_id uuid not null,
  account_id uuid not null,
  workspace_id uuid not null,
  company_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'unsupported', 'not_found', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  retryable boolean not null default false,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id) on delete cascade,
  primary key (run_id, account_id)
);

create table public.content_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null,
  run_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id) on delete cascade,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  source text not null default 'meta_graph' check (source = 'meta_graph'),
  adapter_version text not null,
  observed_at timestamptz not null,
  biography text,
  website text,
  profile_picture_url text,
  followers_count bigint,
  follows_count bigint,
  media_count bigint,
  raw_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, account_id, run_id)
);

create index content_account_snapshots_company_observed_idx
  on public.content_account_snapshots(company_id, observed_at desc);

create table public.content_instagram_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id) on delete cascade,
  instagram_media_id text not null,
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  media_url text,
  thumbnail_url text,
  published_at timestamptz,
  source text not null default 'meta_graph' check (source = 'meta_graph'),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, instagram_media_id),
  unique (id, company_id, workspace_id)
);

create index content_instagram_media_company_published_idx
  on public.content_instagram_media(company_id, published_at desc);

create table public.content_media_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  media_id uuid not null,
  run_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  foreign key (media_id, company_id, workspace_id)
    references public.content_instagram_media(id, company_id, workspace_id) on delete cascade,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  source text not null default 'meta_graph' check (source = 'meta_graph'),
  adapter_version text not null,
  observed_at timestamptz not null,
  like_count bigint,
  comments_count bigint,
  reach bigint,
  views bigint,
  saved bigint,
  shares bigint,
  total_interactions bigint,
  metrics_hash text not null,
  raw_metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_metrics) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, media_id, run_id)
);

create index content_media_metric_snapshots_company_observed_idx
  on public.content_media_metric_snapshots(company_id, observed_at desc);

alter table public.content_workspaces enable row level security;
alter table public.content_instagram_connections enable row level security;
alter table public.content_meta_credentials enable row level security;
alter table public.content_meta_oauth_states enable row level security;
alter table public.content_instagram_accounts enable row level security;
alter table public.content_sync_runs enable row level security;
alter table public.content_sync_events enable row level security;
alter table public.content_sync_run_accounts enable row level security;
alter table public.content_account_snapshots enable row level security;
alter table public.content_instagram_media enable row level security;
alter table public.content_media_metric_snapshots enable row level security;

revoke all on table public.content_workspaces from public, anon, authenticated;
revoke all on table public.content_instagram_connections from public, anon, authenticated;
revoke all on table public.content_meta_credentials from public, anon, authenticated;
revoke all on table public.content_meta_oauth_states from public, anon, authenticated;
revoke all on table public.content_instagram_accounts from public, anon, authenticated;
revoke all on table public.content_sync_runs from public, anon, authenticated;
revoke all on table public.content_sync_events from public, anon, authenticated;
revoke all on table public.content_sync_run_accounts from public, anon, authenticated;
revoke all on table public.content_account_snapshots from public, anon, authenticated;
revoke all on table public.content_instagram_media from public, anon, authenticated;
revoke all on table public.content_media_metric_snapshots from public, anon, authenticated;

grant select on table public.content_workspaces to authenticated;
grant select on table public.content_instagram_connections to authenticated;
grant select on table public.content_instagram_accounts to authenticated;
grant select on table public.content_sync_runs to authenticated;
grant select on table public.content_sync_events to authenticated;
grant select on table public.content_sync_run_accounts to authenticated;
grant select on table public.content_account_snapshots to authenticated;
grant select on table public.content_instagram_media to authenticated;
grant select on table public.content_media_metric_snapshots to authenticated;

grant select, insert, update, delete on table public.content_workspaces to service_role;
grant select, insert, update, delete on table public.content_instagram_connections to service_role;
grant select, insert, update, delete on table public.content_meta_credentials to service_role;
grant select, insert, update, delete on table public.content_meta_oauth_states to service_role;
grant select, insert, update, delete on table public.content_instagram_accounts to service_role;
grant select, insert, update, delete on table public.content_sync_runs to service_role;
grant select, insert, update, delete on table public.content_sync_events to service_role;
grant select, insert, update, delete on table public.content_sync_run_accounts to service_role;
grant select, insert, update, delete on table public.content_account_snapshots to service_role;
grant select, insert, update, delete on table public.content_instagram_media to service_role;
grant select, insert, update, delete on table public.content_media_metric_snapshots to service_role;

create or replace function private.can_read_content(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_user_role() in ('platform_admin', 'team_lead')
    or (
      private.current_company_id() = target_company_id
      and exists (
        select 1 from public.company_modules module_access
        where module_access.company_id = target_company_id
          and module_access.module = 'content'
          and module_access.enabled = true
      )
    ),
    false
  )
$$;

revoke all on function private.can_read_content(uuid) from public, anon;
grant execute on function private.can_read_content(uuid) to authenticated;

create policy "workspace members read content workspaces"
on public.content_workspaces for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content connection"
on public.content_instagram_connections for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content accounts"
on public.content_instagram_accounts for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content runs"
on public.content_sync_runs for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content events"
on public.content_sync_events for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content run accounts"
on public.content_sync_run_accounts for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content account snapshots"
on public.content_account_snapshots for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content media"
on public.content_instagram_media for select to authenticated
using (private.can_read_content(company_id));

create policy "workspace members read content metric snapshots"
on public.content_media_metric_snapshots for select to authenticated
using (private.can_read_content(company_id));

create or replace function private.enforce_content_watchlist_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
  limit_count integer;
begin
  if new.account_kind = 'own' or not new.active or new.retired_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text || ':' || new.account_kind, 451));
  limit_count := case when new.account_kind = 'competitor' then 5 else 3 end;

  select count(*) into active_count
  from public.content_instagram_accounts account
  where account.workspace_id = new.workspace_id
    and account.account_kind = new.account_kind
    and account.active = true
    and account.retired_at is null
    and account.id <> new.id;

  if active_count >= limit_count then
    raise exception 'La watchlist alcanzó el máximo permitido para esta categoría.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_content_watchlist_capacity() from public, anon, authenticated;

create trigger content_watchlist_capacity
before insert or update of account_kind, active, retired_at, workspace_id
on public.content_instagram_accounts
for each row execute function private.enforce_content_watchlist_capacity();

create function public.update_company_module_configuration(
  target_company_id uuid,
  metrics_enabled boolean,
  radar_enabled boolean,
  radar_workspace_id text,
  radar_site_integrated boolean,
  content_enabled boolean,
  content_workspace_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_radar_workspace_id text := nullif(trim(radar_workspace_id), '');
  normalized_content_workspace_id text := nullif(trim(content_workspace_id), '');
begin
  if not private.can_manage_global_catalog() then
    raise exception 'No tenés permisos para habilitar productos.';
  end if;

  if not exists (select 1 from public.companies where id = target_company_id) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;

  if radar_enabled and normalized_radar_workspace_id is null then
    raise exception 'Asigná un workspace antes de habilitar Radar.';
  end if;
  if normalized_radar_workspace_id is not null
    and normalized_radar_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$'
  then
    raise exception 'El workspace de Radar no tiene un formato válido.';
  end if;

  if content_enabled and normalized_content_workspace_id is null then
    raise exception 'Asigná un workspace antes de habilitar Contenido.';
  end if;
  if normalized_content_workspace_id is not null
    and normalized_content_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$'
  then
    raise exception 'El workspace de Contenido no tiene un formato válido.';
  end if;

  perform public.update_company_module_configuration(
    target_company_id,
    metrics_enabled,
    radar_enabled,
    normalized_radar_workspace_id,
    radar_site_integrated
  );

  insert into public.company_modules (company_id, module, enabled, settings)
  values (
    target_company_id,
    'content',
    content_enabled,
    case
      when normalized_content_workspace_id is null then jsonb_build_object('syncFrequency', 'weekly')
      else jsonb_build_object(
        'workspaceId', normalized_content_workspace_id,
        'syncFrequency', 'weekly'
      )
    end
  )
  on conflict (company_id, module) do update
  set enabled = excluded.enabled,
      settings = public.company_modules.settings
        || jsonb_build_object('syncFrequency', 'weekly')
        || case
          when normalized_content_workspace_id is null then '{}'::jsonb
          else jsonb_build_object('workspaceId', normalized_content_workspace_id)
        end,
      updated_at = now();

  if normalized_content_workspace_id is not null then
    insert into public.content_workspaces (company_id, slug)
    values (target_company_id, normalized_content_workspace_id)
    on conflict (company_id, slug) do update
    set sync_frequency = 'weekly',
        updated_at = now();
  end if;
end
$$;

revoke all on function public.update_company_module_configuration(
  uuid, boolean, boolean, text, boolean, boolean, text
) from public, anon;
grant execute on function public.update_company_module_configuration(
  uuid, boolean, boolean, text, boolean, boolean, text
) to authenticated;

create or replace function public.claim_content_sync(
  target_company_id uuid,
  target_workspace_id uuid,
  target_trigger text,
  target_request_key text,
  target_requested_by uuid default null,
  target_adapter_version text default 'meta-graph-v1'
)
returns table(run_id uuid, acquired boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run public.content_sync_runs%rowtype;
  created_run_id uuid;
begin
  if target_trigger not in ('manual', 'scheduled') then
    raise exception 'Invalid content sync trigger';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text, 919));

  if not exists (
    select 1
    from public.company_modules module_access
    where module_access.company_id = target_company_id
      and module_access.module = 'content'
      and module_access.enabled = true
  ) then
    raise exception 'Content is not enabled for this company';
  end if;

  if not exists (
    select 1 from public.content_workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.company_id = target_company_id
  ) then
    raise exception 'Content workspace not found';
  end if;

  select existing.id into created_run_id
  from public.content_sync_runs existing
  where existing.workspace_id = target_workspace_id
    and existing.request_key = target_request_key;

  if created_run_id is not null then
    return query select created_run_id, false, 0;
    return;
  end if;

  select * into active_run
  from public.content_sync_runs
  where workspace_id = target_workspace_id and status = 'running'
  order by started_at desc
  limit 1;

  if active_run.id is not null and active_run.started_at > now() - interval '20 minutes' then
    return query select active_run.id, false, greatest(
      1,
      ceil(extract(epoch from (active_run.started_at + interval '20 minutes' - now())))::integer
    );
    return;
  end if;

  if active_run.id is not null then
    update public.content_sync_runs
    set status = 'failed',
        finished_at = now(),
        error_count = greatest(error_count, 1),
        last_error = 'La corrida anterior excedió el tiempo máximo y fue cerrada automáticamente.'
    where id = active_run.id;
  end if;

  insert into public.content_sync_runs (
    workspace_id, company_id, request_key, trigger, requested_by, adapter_version
  ) values (
    target_workspace_id, target_company_id, target_request_key,
    target_trigger, target_requested_by, target_adapter_version
  ) returning id into created_run_id;

  return query select created_run_id, true, 0;
end;
$$;

revoke all on function public.claim_content_sync(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_content_sync(uuid, uuid, text, text, uuid, text)
  to service_role;

comment on table public.content_meta_credentials is
  'Server-only encrypted Meta tokens. Never readable by authenticated clients.';
comment on table public.content_instagram_media is
  'Observed Instagram media identity. Interpretation belongs to a later Radar phase.';
comment on function public.claim_content_sync(uuid, uuid, text, text, uuid, text) is
  'Serializes one content sync per workspace and closes stale runs safely.';
