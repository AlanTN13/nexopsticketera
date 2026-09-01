-- NexOps Contenido Fase 1: official Instagram configuration and observed data.
-- Requires company_module_access_v2. No analysis, scoring, strategy or publishing.

create table public.content_workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  sync_frequency text not null default 'weekly' check (sync_frequency = 'weekly'),
  scheduled_enabled boolean not null default false,
  next_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create table public.content_instagram_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  status text not null default 'authorization_required'
    check (status in ('authorization_required','selection_required','connected','reconnect_required','paused','error')),
  enabled boolean not null default true,
  graph_version text,
  facebook_page_id text,
  facebook_page_name text,
  instagram_user_id text,
  instagram_username text,
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
  unique (id, company_id, workspace_id)
);

create table public.content_meta_credentials (
  connection_id uuid primary key,
  company_id uuid not null,
  workspace_id uuid not null,
  foreign key (connection_id, company_id, workspace_id)
    references public.content_instagram_connections(id, company_id, workspace_id) on delete cascade,
  token_ciphertext text,
  pending_selection_ciphertext text,
  pending_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    token_ciphertext is not null
    or (pending_selection_ciphertext is not null and pending_expires_at is not null)
  )
);

create table public.content_meta_oauth_states (
  state_hash text primary key,
  workspace_id uuid not null,
  company_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.content_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  account_kind text not null check (account_kind in ('own','competitor','reference')),
  username text not null,
  instagram_account_id text,
  display_name text,
  note text check (note is null or char_length(note) <= 500),
  active boolean not null default true,
  availability_status text not null default 'pending'
    check (availability_status in ('pending','available','unsupported','not_found','error')),
  last_access_at timestamptz,
  last_sync_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  retired_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  last_run_id uuid,
  last_lease_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id, workspace_id)
);

create unique index content_accounts_active_username_idx
  on public.content_instagram_accounts(workspace_id, lower(username)) where retired_at is null;
create unique index content_accounts_active_external_id_idx
  on public.content_instagram_accounts(workspace_id, instagram_account_id)
  where instagram_account_id is not null and retired_at is null;
create unique index content_accounts_one_own_idx
  on public.content_instagram_accounts(workspace_id) where account_kind = 'own' and retired_at is null;
create index content_accounts_active_idx
  on public.content_instagram_accounts(workspace_id, account_kind, active) where retired_at is null;

create table public.content_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  foreign key (workspace_id, company_id)
    references public.content_workspaces(id, company_id) on delete cascade,
  request_key text not null,
  trigger text not null check (trigger in ('manual','scheduled')),
  status text not null default 'running' check (status in ('running','completed','partial','failed')),
  requested_by uuid references public.users(id) on delete set null,
  adapter_version text not null,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
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

create unique index content_sync_one_running_idx
  on public.content_sync_runs(workspace_id) where status = 'running';
create index content_sync_started_idx on public.content_sync_runs(workspace_id, started_at desc);

create table public.content_sync_run_accounts (
  run_id uuid not null,
  account_id uuid not null,
  workspace_id uuid not null,
  company_id uuid not null,
  lease_token uuid not null,
  status text not null default 'pending'
    check (status in ('pending','completed','unsupported','not_found','failed')),
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

create table public.content_sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  run_id uuid not null,
  account_id uuid,
  lease_token uuid not null,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id) on delete set null (account_id),
  level text not null check (level in ('info','warning','error')),
  code text not null,
  message text not null check (char_length(message) <= 1000),
  external_request_id text,
  occurred_at timestamptz not null default now(),
  event_key text not null,
  retryable boolean not null default false,
  unique (run_id, account_id, event_key)
);

create index content_sync_events_run_idx on public.content_sync_events(run_id, occurred_at);

create table public.content_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  account_id uuid not null,
  run_id uuid not null,
  lease_token uuid not null,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  foreign key (account_id, company_id, workspace_id)
    references public.content_instagram_accounts(id, company_id, workspace_id) on delete cascade,
  source text not null default 'meta_graph' check (source = 'meta_graph'),
  adapter_version text not null,
  observed_at timestamptz not null,
  biography text,
  website text,
  profile_picture_url text,
  followers_count bigint check (followers_count is null or followers_count >= 0),
  follows_count bigint check (follows_count is null or follows_count >= 0),
  media_count bigint check (media_count is null or media_count >= 0),
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, account_id, run_id)
);

create index content_account_snapshots_observed_idx
  on public.content_account_snapshots(company_id, observed_at desc);

create table public.content_instagram_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  account_id uuid not null,
  last_run_id uuid not null,
  lease_token uuid not null,
  foreign key (last_run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id),
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
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, instagram_media_id),
  unique (id, company_id, workspace_id)
);

create index content_media_published_idx on public.content_instagram_media(company_id, published_at desc);

create table public.content_media_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  media_id uuid not null,
  run_id uuid not null,
  lease_token uuid not null,
  foreign key (run_id, company_id, workspace_id)
    references public.content_sync_runs(id, company_id, workspace_id) on delete cascade,
  foreign key (media_id, company_id, workspace_id)
    references public.content_instagram_media(id, company_id, workspace_id) on delete cascade,
  source text not null default 'meta_graph' check (source = 'meta_graph'),
  adapter_version text not null,
  observed_at timestamptz not null,
  like_count bigint check (like_count is null or like_count >= 0),
  comments_count bigint check (comments_count is null or comments_count >= 0),
  reach bigint check (reach is null or reach >= 0),
  views bigint check (views is null or views >= 0),
  saved bigint check (saved is null or saved >= 0),
  shares bigint check (shares is null or shares >= 0),
  total_interactions bigint check (total_interactions is null or total_interactions >= 0),
  metrics_hash text not null,
  raw_metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_metrics) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, media_id, run_id)
);

create index content_metric_snapshots_observed_idx
  on public.content_media_metric_snapshots(company_id, observed_at desc);

alter table public.content_workspaces enable row level security;
alter table public.content_instagram_connections enable row level security;
alter table public.content_meta_credentials enable row level security;
alter table public.content_meta_oauth_states enable row level security;
alter table public.content_instagram_accounts enable row level security;
alter table public.content_sync_runs enable row level security;
alter table public.content_sync_run_accounts enable row level security;
alter table public.content_sync_events enable row level security;
alter table public.content_account_snapshots enable row level security;
alter table public.content_instagram_media enable row level security;
alter table public.content_media_metric_snapshots enable row level security;

revoke all on table public.content_workspaces, public.content_instagram_connections,
  public.content_meta_credentials, public.content_meta_oauth_states,
  public.content_instagram_accounts, public.content_sync_runs,
  public.content_sync_run_accounts, public.content_sync_events,
  public.content_account_snapshots, public.content_instagram_media,
  public.content_media_metric_snapshots from public, anon, authenticated;

grant select (id, company_id, sync_frequency, scheduled_enabled, next_sync_at, created_at, updated_at)
  on public.content_workspaces to authenticated;
grant select (id, workspace_id, company_id, status, enabled, graph_version, facebook_page_name,
  instagram_user_id, instagram_username, authorized_scopes, token_expires_at,
  last_validated_at, last_sync_at, next_sync_at, last_error, created_at, updated_at)
  on public.content_instagram_connections to authenticated;
grant select (id, workspace_id, company_id, account_kind, username, instagram_account_id,
  display_name, note, active, availability_status, last_access_at, last_sync_at,
  last_error, retired_at, created_at, updated_at)
  on public.content_instagram_accounts to authenticated;
grant select (id, workspace_id, company_id, request_key, trigger, status, requested_by,
  adapter_version, started_at, finished_at, accounts_attempted, accounts_succeeded,
  publications_new, publications_known, snapshots_created, error_count, last_error, created_at)
  on public.content_sync_runs to authenticated;
grant select (run_id, account_id, workspace_id, company_id, status, started_at,
  finished_at, error_code, retryable) on public.content_sync_run_accounts to authenticated;
grant select (id, workspace_id, company_id, run_id, account_id, level, code,
  message, external_request_id, occurred_at, event_key, retryable)
  on public.content_sync_events to authenticated;
grant select (id, workspace_id, company_id, account_id, run_id, source, adapter_version,
  observed_at, biography, website, profile_picture_url, followers_count, follows_count,
  media_count, created_at) on public.content_account_snapshots to authenticated;
grant select (id, workspace_id, company_id, account_id, instagram_media_id, caption,
  media_type, media_product_type, permalink, media_url, thumbnail_url, published_at,
  source, first_observed_at, last_observed_at, created_at, updated_at)
  on public.content_instagram_media to authenticated;
grant select (id, workspace_id, company_id, media_id, run_id, source, adapter_version,
  observed_at, like_count, comments_count, reach, views, saved, shares,
  total_interactions, metrics_hash, created_at)
  on public.content_media_metric_snapshots to authenticated;

grant all on public.content_workspaces, public.content_instagram_connections,
  public.content_meta_credentials, public.content_meta_oauth_states,
  public.content_instagram_accounts, public.content_sync_runs,
  public.content_sync_run_accounts, public.content_sync_events,
  public.content_account_snapshots, public.content_instagram_media,
  public.content_media_metric_snapshots to service_role;

create policy "content viewers read workspaces" on public.content_workspaces
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read connections" on public.content_instagram_connections
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read accounts" on public.content_instagram_accounts
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read runs" on public.content_sync_runs
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read run accounts" on public.content_sync_run_accounts
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read events" on public.content_sync_events
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read account snapshots" on public.content_account_snapshots
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read media" on public.content_instagram_media
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));
create policy "content viewers read metric snapshots" on public.content_media_metric_snapshots
  for select to authenticated using (private.has_module_access(company_id, 'content', 'view'));

create or replace function private.ensure_content_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.module = 'content' and new.enabled then
    insert into public.content_workspaces(company_id) values (new.company_id)
    on conflict (company_id) do update set updated_at = now();
  end if;
  return new;
end
$$;

create trigger ensure_content_workspace
after insert or update of enabled on public.company_modules
for each row execute function private.ensure_content_workspace();
revoke all on function private.ensure_content_workspace() from public, anon, authenticated;

create or replace function private.enforce_content_watchlist_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare active_count integer; limit_count integer;
begin
  if new.account_kind = 'own' or not new.active or new.retired_at is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text || ':' || new.account_kind, 451));
  limit_count := case when new.account_kind = 'competitor' then 5 else 3 end;
  select count(*) into active_count from public.content_instagram_accounts account
  where account.workspace_id = new.workspace_id and account.account_kind = new.account_kind
    and account.active and account.retired_at is null and account.id <> new.id;
  if active_count >= limit_count then raise exception 'La watchlist alcanzó el máximo permitido para esta categoría.'; end if;
  return new;
end
$$;

create trigger content_watchlist_capacity before insert or update of account_kind, active, retired_at, workspace_id
on public.content_instagram_accounts for each row execute function private.enforce_content_watchlist_capacity();
revoke all on function private.enforce_content_watchlist_capacity() from public, anon, authenticated;

create or replace function private.content_lease_active(target_run_id uuid, target_lease_token uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.content_sync_runs run where run.id = target_run_id
    and run.lease_token = target_lease_token and run.status = 'running' and run.lease_expires_at > now())
$$;
revoke all on function private.content_lease_active(uuid, uuid) from public, anon, authenticated;

create or replace function private.enforce_content_lease()
returns trigger language plpgsql security definer set search_path = '' as $$
declare checked_run_id uuid;
begin
  checked_run_id := case when tg_table_name = 'content_instagram_media' then new.last_run_id else new.run_id end;
  if not private.content_lease_active(checked_run_id,new.lease_token) then
    raise exception 'Content sync lease expired' using errcode='55000';
  end if;
  return new;
end
$$;
revoke all on function private.enforce_content_lease() from public,anon,authenticated;
create trigger fence_content_run_accounts before insert or update on public.content_sync_run_accounts
  for each row execute function private.enforce_content_lease();
create trigger fence_content_events before insert or update on public.content_sync_events
  for each row execute function private.enforce_content_lease();
create trigger fence_content_account_snapshots before insert or update on public.content_account_snapshots
  for each row execute function private.enforce_content_lease();
create trigger fence_content_media before insert or update on public.content_instagram_media
  for each row execute function private.enforce_content_lease();
create trigger fence_content_metric_snapshots before insert or update on public.content_media_metric_snapshots
  for each row execute function private.enforce_content_lease();

create or replace function public.claim_content_sync(
  target_company_id uuid, target_workspace_id uuid, target_trigger text,
  target_request_key text, target_requested_by uuid default null,
  target_adapter_version text default 'meta-graph-v1'
)
returns table(run_id uuid, lease_token uuid, acquired boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare active_run public.content_sync_runs%rowtype; existing_run public.content_sync_runs%rowtype;
  new_run_id uuid; new_lease uuid := gen_random_uuid();
begin
  if target_trigger not in ('manual','scheduled') then raise exception 'Invalid content sync trigger'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text, 919));
  if not exists(select 1 from public.content_workspaces where id=target_workspace_id and company_id=target_company_id)
    or not exists(select 1 from public.company_modules where company_id=target_company_id and module='content' and enabled)
  then raise exception 'Content workspace is not enabled'; end if;
  if target_trigger = 'manual' and (target_requested_by is null
    or not private.user_has_module_access(target_requested_by, target_company_id, 'content', 'operate'))
  then raise exception 'Not authorized to sync Content' using errcode='42501'; end if;
  select * into existing_run from public.content_sync_runs
    where workspace_id=target_workspace_id and request_key=target_request_key;
  if found then return query select existing_run.id, existing_run.lease_token, false, 0; return; end if;
  select * into active_run from public.content_sync_runs
    where workspace_id=target_workspace_id and status='running' order by started_at desc limit 1 for update;
  if found and active_run.lease_expires_at > now() then
    return query select active_run.id, active_run.lease_token, false,
      greatest(1,ceil(extract(epoch from (active_run.lease_expires_at-now())))::integer); return;
  end if;
  if found then update public.content_sync_runs set status='failed',finished_at=now(),error_count=greatest(error_count,1),
    last_error='La corrida anterior perdió su lease y fue cerrada.' where id=active_run.id; end if;
  insert into public.content_sync_runs(workspace_id,company_id,request_key,trigger,requested_by,
    adapter_version,lease_token,lease_expires_at)
  values(target_workspace_id,target_company_id,target_request_key,target_trigger,target_requested_by,
    target_adapter_version,new_lease,now()+interval '20 minutes') returning id into new_run_id;
  return query select new_run_id,new_lease,true,0;
end
$$;
revoke all on function public.claim_content_sync(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_content_sync(uuid,uuid,text,text,uuid,text) to service_role;

create or replace function public.persist_content_account_observation(
  target_run_id uuid, target_lease_token uuid, target_company_id uuid, target_workspace_id uuid,
  target_account_id uuid, target_adapter_version text, target_observed_at timestamptz,
  target_profile jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.content_lease_active(target_run_id,target_lease_token) then raise exception 'Content sync lease expired' using errcode='55000'; end if;
  update public.content_instagram_accounts set instagram_account_id=coalesce(target_profile->>'id',target_profile->>'ig_id'),
    username=lower(target_profile->>'username'),display_name=coalesce(target_profile->>'name',target_profile->>'username'),
    availability_status='available',last_access_at=target_observed_at,last_sync_at=target_observed_at,last_error=null,
    last_run_id=target_run_id,last_lease_token=target_lease_token,updated_at=target_observed_at
  where id=target_account_id and company_id=target_company_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Content account not found'; end if;
  insert into public.content_account_snapshots(workspace_id,company_id,account_id,run_id,lease_token,
    adapter_version,observed_at,biography,website,profile_picture_url,followers_count,follows_count,media_count,raw_payload)
  values(target_workspace_id,target_company_id,target_account_id,target_run_id,target_lease_token,target_adapter_version,
    target_observed_at,target_profile->>'biography',target_profile->>'website',target_profile->>'profile_picture_url',
    (target_profile->>'followers_count')::bigint,(target_profile->>'follows_count')::bigint,
    (target_profile->>'media_count')::bigint,target_profile) on conflict(company_id,account_id,run_id) do nothing;
end
$$;

create or replace function public.persist_content_media_observation(
  target_run_id uuid, target_lease_token uuid, target_company_id uuid, target_workspace_id uuid,
  target_account_id uuid, target_adapter_version text, target_observed_at timestamptz,
  target_media jsonb, target_metrics jsonb, target_metrics_hash text
) returns table(media_id uuid, created boolean, snapshot_created boolean)
language plpgsql security definer set search_path = '' as $$
declare stored_id uuid; was_created boolean := false; made_snapshot boolean := false; latest_hash text;
begin
  if not private.content_lease_active(target_run_id,target_lease_token) then raise exception 'Content sync lease expired' using errcode='55000'; end if;
  insert into public.content_instagram_media(workspace_id,company_id,account_id,last_run_id,lease_token,
    instagram_media_id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,published_at,
    first_observed_at,last_observed_at,raw_payload)
  values(target_workspace_id,target_company_id,target_account_id,target_run_id,target_lease_token,
    target_media->>'id',target_media->>'caption',target_media->>'media_type',target_media->>'media_product_type',
    target_media->>'permalink',target_media->>'media_url',target_media->>'thumbnail_url',
    (target_media->>'timestamp')::timestamptz,target_observed_at,target_observed_at,target_media)
  on conflict(workspace_id,instagram_media_id) do nothing returning id into stored_id;
  if stored_id is not null then was_created := true;
  else
    update public.content_instagram_media set account_id=target_account_id,last_run_id=target_run_id,
      lease_token=target_lease_token,caption=target_media->>'caption',media_type=target_media->>'media_type',
      media_product_type=target_media->>'media_product_type',permalink=target_media->>'permalink',
      media_url=target_media->>'media_url',thumbnail_url=target_media->>'thumbnail_url',
      published_at=(target_media->>'timestamp')::timestamptz,last_observed_at=target_observed_at,
      raw_payload=target_media,updated_at=target_observed_at
    where workspace_id=target_workspace_id and instagram_media_id=target_media->>'id' returning id into stored_id;
  end if;
  select metrics_hash into latest_hash from public.content_media_metric_snapshots
    where company_id=target_company_id and media_id=stored_id order by observed_at desc limit 1;
  if latest_hash is distinct from target_metrics_hash then
    insert into public.content_media_metric_snapshots(workspace_id,company_id,media_id,run_id,lease_token,
      adapter_version,observed_at,like_count,comments_count,reach,views,saved,shares,total_interactions,metrics_hash,raw_metrics)
    values(target_workspace_id,target_company_id,stored_id,target_run_id,target_lease_token,target_adapter_version,
      target_observed_at,(target_metrics->>'like_count')::bigint,(target_metrics->>'comments_count')::bigint,
      (target_metrics->>'reach')::bigint,(target_metrics->>'views')::bigint,(target_metrics->>'saved')::bigint,
      (target_metrics->>'shares')::bigint,(target_metrics->>'total_interactions')::bigint,target_metrics_hash,target_metrics);
    made_snapshot := true;
  end if;
  return query select stored_id,was_created,made_snapshot;
end
$$;

create or replace function public.finalize_content_meta_connection(
  target_connection_id uuid,target_company_id uuid,target_workspace_id uuid,target_actor_id uuid,
  target_page_id text,target_page_name text,target_instagram_user_id text,target_instagram_username text,
  target_scopes text[],target_token_expires_at timestamptz,target_token_ciphertext text,target_graph_version text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.user_has_module_access(target_actor_id,target_company_id,'content','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.content_instagram_connections set status='connected',enabled=true,graph_version=target_graph_version,
    facebook_page_id=target_page_id,facebook_page_name=target_page_name,instagram_user_id=target_instagram_user_id,
    instagram_username=target_instagram_username,authorized_scopes=target_scopes,connected_by=target_actor_id,
    token_expires_at=target_token_expires_at,last_validated_at=now(),last_error=null,updated_at=now()
  where id=target_connection_id and company_id=target_company_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Content connection not found'; end if;
  insert into public.content_meta_credentials(connection_id,company_id,workspace_id,token_ciphertext,updated_at)
  values(target_connection_id,target_company_id,target_workspace_id,target_token_ciphertext,now())
  on conflict(connection_id) do update set token_ciphertext=excluded.token_ciphertext,
    pending_selection_ciphertext=null,pending_expires_at=null,updated_at=now();
  insert into public.content_instagram_accounts(workspace_id,company_id,account_kind,username,
    instagram_account_id,display_name,active,availability_status,created_by,updated_at)
  values(target_workspace_id,target_company_id,'own',lower(target_instagram_username),target_instagram_user_id,
    target_instagram_username,true,'available',target_actor_id,now())
  on conflict(workspace_id,instagram_account_id) where instagram_account_id is not null and retired_at is null
  do update set username=excluded.username,display_name=excluded.display_name,active=true,
    availability_status='available',retired_at=null,updated_at=now();
end
$$;

create or replace function public.set_content_pending_selection(
  target_connection_id uuid,target_company_id uuid,target_workspace_id uuid,target_actor_id uuid,
  target_pending_ciphertext text,target_graph_version text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.user_has_module_access(target_actor_id,target_company_id,'content','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.content_instagram_connections set status='selection_required',enabled=true,
    graph_version=target_graph_version,connected_by=target_actor_id,last_error=null,updated_at=now()
  where id=target_connection_id and company_id=target_company_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Content connection not found'; end if;
  insert into public.content_meta_credentials(connection_id,company_id,workspace_id,pending_selection_ciphertext,pending_expires_at,updated_at)
  values(target_connection_id,target_company_id,target_workspace_id,target_pending_ciphertext,now()+interval '15 minutes',now())
  on conflict(connection_id) do update set token_ciphertext=null,pending_selection_ciphertext=excluded.pending_selection_ciphertext,
    pending_expires_at=excluded.pending_expires_at,updated_at=now();
end
$$;

create or replace function public.set_content_connector_state(
  target_company_id uuid,target_workspace_id uuid,target_actor_id uuid,target_enabled boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.user_has_module_access(target_actor_id,target_company_id,'content','admin') then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.content_instagram_connections set enabled=target_enabled,
    status=case when target_enabled and instagram_user_id is not null then 'connected' when target_enabled then 'authorization_required' else 'paused' end,
    updated_at=now() where company_id=target_company_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Content connection not found'; end if;
end
$$;

create or replace function public.finish_content_sync(
  target_run_id uuid,target_lease_token uuid,target_connection_id uuid,target_status text,
  target_accounts_attempted integer,target_accounts_succeeded integer,target_publications_new integer,
  target_publications_known integer,target_snapshots_created integer,target_error_count integer,target_last_error text
) returns void language plpgsql security definer set search_path = '' as $$
declare run_row public.content_sync_runs%rowtype; finished timestamptz:=now(); next_run timestamptz;
begin
  select * into run_row from public.content_sync_runs where id=target_run_id and lease_token=target_lease_token
    and status='running' and lease_expires_at>now() for update;
  if not found then raise exception 'Content sync lease expired' using errcode='55000'; end if;
  if target_status not in ('completed','partial','failed') then raise exception 'Invalid content sync status'; end if;
  next_run := (date_trunc('week',now() at time zone 'UTC')+interval '7 days 9 hours 15 minutes') at time zone 'UTC';
  update public.content_sync_runs set status=target_status,finished_at=finished,accounts_attempted=target_accounts_attempted,
    accounts_succeeded=target_accounts_succeeded,publications_new=target_publications_new,
    publications_known=target_publications_known,snapshots_created=target_snapshots_created,
    error_count=target_error_count,last_error=target_last_error where id=target_run_id;
  update public.content_instagram_connections set last_sync_at=finished,next_sync_at=next_run,
    last_error=case when target_status='failed' then target_last_error else null end,updated_at=finished
    where id=target_connection_id and company_id=run_row.company_id and workspace_id=run_row.workspace_id;
  update public.content_workspaces set next_sync_at=next_run,updated_at=finished
    where id=run_row.workspace_id and company_id=run_row.company_id;
end
$$;

create or replace function public.record_content_account_failure(
  target_run_id uuid,target_lease_token uuid,target_company_id uuid,target_workspace_id uuid,
  target_account_id uuid,target_status text,target_error text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.content_lease_active(target_run_id,target_lease_token) then raise exception 'Content sync lease expired' using errcode='55000'; end if;
  if target_status not in ('unsupported','not_found','error') then raise exception 'Invalid account status'; end if;
  update public.content_instagram_accounts set availability_status=target_status,last_access_at=now(),
    last_error=left(target_error,1000),last_run_id=target_run_id,last_lease_token=target_lease_token,updated_at=now()
  where id=target_account_id and company_id=target_company_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Content account not found'; end if;
end
$$;

revoke all on function public.persist_content_account_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.persist_content_media_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.finalize_content_meta_connection(uuid,uuid,uuid,uuid,text,text,text,text,text[],timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.set_content_pending_selection(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.set_content_connector_state(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.finish_content_sync(uuid,uuid,uuid,text,integer,integer,integer,integer,integer,integer,text) from public,anon,authenticated;
revoke all on function public.record_content_account_failure(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.persist_content_account_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb) to service_role;
grant execute on function public.persist_content_media_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb,text) to service_role;
grant execute on function public.finalize_content_meta_connection(uuid,uuid,uuid,uuid,text,text,text,text,text[],timestamptz,text,text) to service_role;
grant execute on function public.set_content_pending_selection(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.set_content_connector_state(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.finish_content_sync(uuid,uuid,uuid,text,integer,integer,integer,integer,integer,integer,text) to service_role;
grant execute on function public.record_content_account_failure(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;

-- Pilot enablement is data, not runtime authorization logic. Only the existing
-- platform admin receives effective access until more users are assigned.
do $$
declare migration_actor uuid;
begin
  select id into migration_actor from public.users
  where role='platform_admin' and status='active' order by created_at limit 1;
  if migration_actor is null then raise exception 'NexOps Contenido requires an active platform administrator'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', migration_actor::text,
    'role', 'authenticated'
  )::text, true);
  update public.company_modules module set enabled=true,updated_at=now()
  from public.companies company where module.company_id=company.id
    and module.module='content' and company.slug='sysnexops';
end
$$;

comment on table public.content_meta_credentials is 'Server-only encrypted Meta credentials and 15-minute pending selection.';
comment on table public.content_instagram_media is 'Observed media identity; raw payload is service-role only.';
comment on function public.claim_content_sync(uuid,uuid,text,text,uuid,text) is 'One fenced lease per workspace; stale workers cannot persist observations.';
