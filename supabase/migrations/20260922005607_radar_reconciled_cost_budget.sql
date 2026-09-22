-- Cost-budget v2, explicitly authorized 2026-09-22. This is not a ledger reset.
-- Freeze the legacy six USD1.50 reservations; derive spend from persisted usage.
-- One NEW run is authorized. USD5 is a cost+uncertainty ceiling, not six runs.
create table private.radar_budget_accounts (
  singleton boolean primary key default true check (singleton),
  workspace_ids text[] not null default array['nexops','nexops-api-pilot'],
  cap_usd numeric(14,8) not null default 5 check (cap_usd = 5),
  hold_per_run_usd numeric(14,8) not null default 1.5 check (hold_per_run_usd = 1.5),
  authorized_new_runs integer not null default 1 check (authorized_new_runs = 1),
  new_runs_reserved integer not null default 0 check (new_runs_reserved between 0 and 1),
  legacy_reserved_runs integer not null,
  legacy_reserved_usd numeric(14,8) not null,
  created_at timestamptz not null default clock_timestamp()
);
create table private.radar_budget_entries (
  run_id uuid primary key, -- Deliberately no cascading FK: deleting history never refunds cost.
  workspace_id text not null,
  legacy boolean not null,
  reserved_at timestamptz not null,
  original_reserved_usd numeric(14,8) not null check (original_reserved_usd = 1.5),
  spent_usd numeric(14,8) not null default 0 check (spent_usd >= 0),
  held_usd numeric(14,8) not null default 1.5 check (held_usd between 0 and 1.5),
  released_usd numeric(14,8) not null default 0 check (released_usd between 0 and 1.5),
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  check (held_usd + released_usd = greatest(original_reserved_usd - spent_usd, 0))
);
create table private.radar_budget_audit (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  operation text not null check (operation in ('backfill','reserve','reconcile')),
  previous_values jsonb,
  current_values jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table private.radar_budget_accounts enable row level security;
alter table private.radar_budget_entries enable row level security;
alter table private.radar_budget_audit enable row level security;
revoke all on private.radar_budget_accounts, private.radar_budget_entries, private.radar_budget_audit from public, anon, authenticated, service_role;

-- Telemetry interpreter: no provider output text, source payload or secrets in audit.
-- A valid response with incomplete provider status can still have billable usage.
create function private.radar_budget_evidence(run public.radar_runs)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  responses jsonb := run.api_context #> '{n8nState,responses}';
  response jsonb; ids text[] := '{}'; response_id text;
  input_count bigint := 0; output_count bigint := 0; web_count integer := 0;
  known_calls integer := 0; issued integer; complete boolean := true;
  terminal boolean := run.status not in ('queued','dispatching','running');
  observed numeric(14,8) := 0; kind text := 'uncertain';
  usage jsonb := run.api_usage;
begin
  if run.api_context ->> 'model' is distinct from 'gpt-5-mini' then
    return jsonb_build_object('complete',false,'spentUsd',0,'kind','model_unverified');
  end if;
  if coalesce(run.api_context ->> 'n8nIssuedCall','') ~ '^[0-4]$' then issued := (run.api_context ->> 'n8nIssuedCall')::integer; end if;
  if jsonb_typeof(responses) = 'array' and jsonb_array_length(responses) <= 4 then
    for response in select value from jsonb_array_elements(responses) loop
      response_id := response ->> 'id';
      if nullif(response_id,'') is null or response_id = any(ids)
        or jsonb_typeof(response -> 'output') is distinct from 'array'
        or coalesce(response #>> '{usage,input_tokens}','') !~ '^[0-9]{1,9}$'
        or coalesce(response #>> '{usage,output_tokens}','') !~ '^[0-9]{1,9}$' then
        complete := false; continue;
      end if;
      ids := array_append(ids,response_id);
      known_calls := known_calls + 1;
      input_count := input_count + (response #>> '{usage,input_tokens}')::bigint;
      output_count := output_count + (response #>> '{usage,output_tokens}')::bigint;
      web_count := web_count + (select count(*) from jsonb_array_elements(response -> 'output') item where item ->> 'type' = 'web_search_call');
    end loop;
    observed := input_count * 0.25 / 1000000 + output_count * 2.00 / 1000000 + web_count * 0.01;
    complete := complete and issued is not null and known_calls = issued
      and jsonb_array_length(responses) = known_calls;
    -- Aggregate usage must agree with independently counted response telemetry.
    if known_calls > 0 then
      complete := complete and coalesce(usage ->> 'calls','') = known_calls::text
        and coalesce(usage ->> 'inputTokens','') = input_count::text
        and coalesce(usage ->> 'outputTokens','') = output_count::text
        and coalesce(usage ->> 'webSearchCalls','') = web_count::text;
      if usage ->> 'budgetVersion' = '2' then
        complete := complete and usage -> 'telemetryComplete' = 'true'::jsonb and usage ->> 'telemetryVersion' = '2';
      end if;
    end if;
    if known_calls = 0 then
      complete := complete and coalesce(usage->>'calls','0')='0'
        and coalesce(usage->>'inputTokens','0')='0' and coalesce(usage->>'outputTokens','0')='0'
        and coalesce(usage->>'webSearchCalls','0')='0'
        and (usage->'responseIds' is null or usage->'responseIds'='[]'::jsonb);
    end if;
    kind := 'response_telemetry';
  elsif issued = 0 and terminal and (responses is null or responses = '[]'::jsonb)
    and coalesce(usage ->> 'calls','0') = '0'
    and coalesce(usage->>'inputTokens','0')='0' and coalesce(usage->>'outputTokens','0')='0'
    and coalesce(usage->>'webSearchCalls','0')='0'
    and (usage->'responseIds' is null or usage->'responseIds'='[]'::jsonb) then
    -- Explicit durable zero authorization. Absence of telemetry alone is NOT zero.
    complete := true; kind := 'pre_provider_no_authorization';
  elsif run.api_context ->> 'engine' = 'radar_api_v1'
    and usage ? 'pilotReservation' and not (usage ? 'budgetVersion')
    and run.api_context ->> 'n8nExecutionId' is null
    and run.api_context ->> 'phase' = 'research_response_received'
    and usage ->> 'calls' = '1'
    and coalesce(usage ->> 'inputTokens','') ~ '^[0-9]{1,9}$'
    and coalesce(usage ->> 'outputTokens','') ~ '^[0-9]{1,9}$'
    and coalesce(usage ->> 'webSearchCalls','') ~ '^[0-9]{1,2}$'
    and jsonb_typeof(usage -> 'responseIds') = 'array' and jsonb_array_length(usage -> 'responseIds') = 1
    and nullif(usage #>> '{responseIds,0}','') is not null then
    -- Audited legacy worker predates n8n response persistence. Its received usage
    -- checkpoint is evidence; no invented zero or hardcoded historical amount.
    input_count := (usage ->> 'inputTokens')::bigint;
    output_count := (usage ->> 'outputTokens')::bigint;
    web_count := (usage ->> 'webSearchCalls')::integer;
    known_calls := 1; ids := array[usage #>> '{responseIds,0}'];
    observed := input_count * 0.25 / 1000000 + output_count * 2.00 / 1000000 + web_count * 0.01;
    complete := true; kind := 'legacy_received_usage';
  else complete := false;
  end if;
  return jsonb_build_object('complete',coalesce(complete,false) and terminal,'terminal',terminal,'spentUsd',observed,
    'kind',kind,'model','gpt-5-mini','inputTokens',input_count,'outputTokens',output_count,
    'webSearchCalls',web_count,'knownCalls',known_calls,'issuedCalls',issued,'responseIds',to_jsonb(ids),'pricingVersion','gpt-5-mini-2026-09');
end $$;
revoke all on function private.radar_budget_evidence(public.radar_runs) from public, anon, authenticated, service_role;

create function private.reconcile_radar_budget(run public.radar_runs)
returns void language plpgsql security definer set search_path = '' as $$
declare
  entry private.radar_budget_entries;
  observed_evidence jsonb; spent numeric(14,8); held numeric(14,8); released numeric(14,8);
begin
  -- Same global account lock as reserve; no other run row is touched here.
  perform 1 from private.radar_budget_accounts where singleton for update;
  select * into entry from private.radar_budget_entries where run_id=run.id for update;
  if not found then return; end if;
  observed_evidence := private.radar_budget_evidence(run);
  spent := greatest(entry.spent_usd,(observed_evidence ->> 'spentUsd')::numeric);
  -- Never lower recorded cost. Conflicting/regressed telemetry restores uncertainty.
  if (observed_evidence ->> 'spentUsd')::numeric < entry.spent_usd then observed_evidence := jsonb_set(observed_evidence,'{complete}','false'); end if;
  held := case when observed_evidence -> 'complete' = 'true'::jsonb then 0 else greatest(entry.original_reserved_usd-spent,0) end;
  released := greatest(entry.original_reserved_usd-spent,0)-held;
  if (entry.spent_usd,entry.held_usd,entry.released_usd,entry.evidence) is not distinct from (spent,held,released,observed_evidence) then return; end if;
  update private.radar_budget_entries set spent_usd=spent,held_usd=held,released_usd=released,evidence=observed_evidence,updated_at=clock_timestamp() where run_id=run.id;
  insert into private.radar_budget_audit(run_id,operation,previous_values,current_values)
  values(run.id,'reconcile',jsonb_build_object('spentUsd',entry.spent_usd,'heldUsd',entry.held_usd,'releasedUsd',entry.released_usd,'evidence',entry.evidence),
    jsonb_build_object('spentUsd',spent,'heldUsd',held,'releasedUsd',released,'evidence',observed_evidence));
end $$;
revoke all on function private.reconcile_radar_budget(public.radar_runs) from public, anon, authenticated, service_role;

-- Verify full correspondence before migrating; abort instead of forgiving missing history.
do $$ declare legacy private.radar_api_pilot_usage; run public.radar_runs; begin
  select * into strict legacy from private.radar_api_pilot_usage where singleton for update;
  if not ((legacy.reserved_runs=6 and legacy.reserved_usd=9) or (legacy.reserved_runs=0 and legacy.reserved_usd=0))
    or (select count(*) from public.radar_runs where api_usage -> 'reserved' = 'true'::jsonb) <> legacy.reserved_runs
    or (select coalesce(sum((api_usage ->> 'reservedUsd')::numeric),0) from public.radar_runs where api_usage -> 'reserved' = 'true'::jsonb) <> legacy.reserved_usd
    or (select count(distinct api_usage ->> 'pilotReservation') from public.radar_runs where api_usage -> 'reserved' = 'true'::jsonb) <> legacy.reserved_runs then
    raise exception 'El ledger legado no coincide con las reservas auditables (vacío o seis históricas).' using errcode='55000';
  end if;
  insert into private.radar_budget_accounts(legacy_reserved_runs,legacy_reserved_usd) values(legacy.reserved_runs,legacy.reserved_usd);
  for run in select * from public.radar_runs where api_usage -> 'reserved' = 'true'::jsonb order by created_at loop
    if run.workspace_id not in ('nexops','nexops-api-pilot') then raise exception 'Reserva histórica fuera del piloto NexOps.'; end if;
    if run.api_usage ->> 'reservedUsd' <> '1.5' and run.api_usage ->> 'reservedUsd' <> '1.50' then raise exception 'Reserva histórica inválida.'; end if;
    insert into private.radar_budget_entries(run_id,workspace_id,legacy,reserved_at,original_reserved_usd)
    values(run.id,run.workspace_id,true,coalesce(run.started_at,run.created_at),1.5);
    insert into private.radar_budget_audit(run_id,operation,current_values) values(run.id,'backfill',jsonb_build_object('originalReservedUsd',1.5,'legacy',true));
    perform private.reconcile_radar_budget(run);
  end loop;
end $$;

create function private.radar_legacy_budget_frozen() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'El ledger de reservas legado está congelado; usar presupuesto reconciliado.' using errcode='55000'; end $$;
revoke all on function private.radar_legacy_budget_frozen() from public,anon,authenticated,service_role;
create trigger radar_legacy_budget_frozen before insert or update or delete or truncate on private.radar_api_pilot_usage for each statement execute function private.radar_legacy_budget_frozen();

create function private.radar_budget_reconcile_trigger() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.reconcile_radar_budget(new); return new; end $$;
revoke all on function private.radar_budget_reconcile_trigger() from public,anon,authenticated,service_role;
create trigger radar_budget_reconcile after update of api_usage,api_context,status on public.radar_runs for each row when (new.workspace_id in ('nexops','nexops-api-pilot')) execute function private.radar_budget_reconcile_trigger();

create or replace function public.reserve_radar_api_run(target_run_id uuid, requested_context jsonb, pilot_max_runs integer)
returns public.radar_runs language plpgsql security definer set search_path = '' as $$
declare run public.radar_runs; settings public.radar_control_settings; account private.radar_budget_accounts;
  spent numeric; held numeric; daily integer;
begin
  if pilot_max_runs is null or pilot_max_runs not between 1 and 10 or jsonb_typeof(requested_context) is distinct from 'object' or requested_context ->> 'model' is distinct from 'gpt-5-mini' then
    raise exception 'Piloto API deshabilitado o contexto inválido.' using errcode='22023'; end if;
  select * into run from public.radar_runs where id=target_run_id for update;
  if not found or run.status <> 'dispatching' then return null; end if;
  if run.api_context ->> 'engine' is distinct from 'radar_api_v1' or run.api_deadline_at is null or run.api_deadline_at <= clock_timestamp() or run.api_deadline_at > clock_timestamp()+interval '240 seconds' then
    raise exception 'Reserva API ausente o vencida.' using errcode='55000'; end if;
  if run.workspace_id not in ('nexops','nexops-api-pilot') then raise exception 'Workspace fuera del piloto NexOps.' using errcode='42501'; end if;
  select * into settings from public.radar_control_settings where workspace_id=run.workspace_id for share;
  if not found or not settings.enabled or settings.scheduler_enabled or run.autonomy_mode <> 'review' or settings.autonomy_mode='automatic' or settings.preferences ->> 'publishingMode' = 'automatic' then
    raise exception 'Radar API sólo opera con revisión manual habilitada.' using errcode='55000'; end if;
  select * into account from private.radar_budget_accounts where singleton for update;
  if not found then raise exception 'Presupuesto reconciliado no disponible.' using errcode='55000'; end if;
  if not run.workspace_id=any(account.workspace_ids) then raise exception 'Workspace fuera del piloto NexOps.' using errcode='42501'; end if;
  if exists(select 1 from public.radar_runs other where other.workspace_id=any(account.workspace_ids)
    and other.id<>run.id and other.status in ('running','review_pending','approved','validating','publishing')) then
    raise exception 'Radar ya tiene una corrida activa.' using errcode='55000'; end if;
  select coalesce(sum(spent_usd),0),coalesce(sum(held_usd),0) into spent,held from private.radar_budget_entries;
  if spent+held+account.hold_per_run_usd > account.cap_usd then raise exception 'Límite persistente del piloto API alcanzado.' using errcode='55000'; end if;
  if account.new_runs_reserved >= account.authorized_new_runs then raise exception 'Límite de corridas autorizadas del piloto alcanzado.' using errcode='55000'; end if;
  select count(*) into daily from private.radar_budget_entries where (reserved_at at time zone settings.schedule_timezone)::date = (clock_timestamp() at time zone settings.schedule_timezone)::date;
  if daily >= pilot_max_runs then raise exception 'Límite diario de corridas del piloto alcanzado.' using errcode='55000'; end if;
  update private.radar_budget_accounts set new_runs_reserved=new_runs_reserved+1 where singleton;
  insert into private.radar_budget_entries(run_id,workspace_id,legacy,reserved_at,original_reserved_usd) values(run.id,run.workspace_id,false,clock_timestamp(),account.hold_per_run_usd);
  insert into private.radar_budget_audit(run_id,operation,current_values) values(run.id,'reserve',jsonb_build_object('originalReservedUsd',account.hold_per_run_usd,'budgetVersion',2));
  update public.radar_runs set status='running',started_at=clock_timestamp(),updated_at=clock_timestamp(),
    api_context=requested_context || jsonb_build_object('engine','radar_api_v1','settings',to_jsonb(settings),'preferences',settings.preferences,'workspaceId',run.workspace_id,'requestKind',run.request_kind,'requestPayload',run.request_payload),
    api_usage=jsonb_build_object('reserved',true,'reservedUsd',account.hold_per_run_usd,'budgetVersion',2,'budgetEntryId',run.id)
  where id=run.id returning * into run;
  insert into public.radar_run_events(run_id,event_type,public_message) values(run.id,'api_reserved','Investigación iniciada con presupuesto de costo y reserva temporal.');
  return run;
end $$;
revoke all on function public.reserve_radar_api_run(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.reserve_radar_api_run(uuid,jsonb,integer) to service_role;

create or replace function public.get_radar_admission(target_workspace_id text,pilot_max_runs integer,existing_queued_run_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare settings public.radar_control_settings; account private.radar_budget_accounts; spent numeric; held numeric; remaining integer; daily integer; reason text;
begin
  if target_workspace_id not in ('nexops','nexops-api-pilot') then return jsonb_build_object('allowed',false,'code','disabled','maxUsd',5); end if;
  if pilot_max_runs is null or pilot_max_runs not between 1 and 10 then return jsonb_build_object('allowed',false,'code','unavailable','maxUsd',5); end if;
  select * into settings from public.radar_control_settings where workspace_id=target_workspace_id;
  if not found or not settings.enabled or settings.scheduler_enabled or settings.autonomy_mode='automatic' or settings.preferences ->> 'publishingMode'='automatic' then return jsonb_build_object('allowed',false,'code','disabled','maxUsd',5); end if;
  if existing_queued_run_id is not null and not exists(select 1 from public.radar_runs where id=existing_queued_run_id and workspace_id=target_workspace_id and status='queued') then return jsonb_build_object('allowed',false,'code','unavailable','maxUsd',5); end if;
  select * into account from private.radar_budget_accounts where singleton;
  if not found then return jsonb_build_object('allowed',false,'code','unavailable','maxUsd',5); end if;
  select coalesce(sum(spent_usd),0),coalesce(sum(held_usd),0) into spent,held from private.radar_budget_entries;
  select count(*) into daily from private.radar_budget_entries where (reserved_at at time zone settings.schedule_timezone)::date=(now() at time zone settings.schedule_timezone)::date;
  remaining := greatest(0,least(account.authorized_new_runs-account.new_runs_reserved,pilot_max_runs-daily));
  reason := case when spent+held+account.hold_per_run_usd > account.cap_usd then 'budget_exhausted'
    when remaining=0 then 'run_limit'
    when exists(select 1 from public.radar_runs where workspace_id=any(account.workspace_ids) and id is distinct from existing_queued_run_id and status in ('queued','dispatching','running','review_pending','approved','validating','publishing')) then 'active_run'
    else 'available' end;
  return jsonb_build_object('allowed',reason='available','code',reason,'maxUsd',account.cap_usd,'spentUsd',spent,'heldUsd',held,
    'availableUsd',greatest(account.cap_usd-spent-held,0),'legacyReservedUsd',account.legacy_reserved_usd,'reservedUsd',held,'remainingRuns',remaining,'budgetVersion',2);
end $$;
revoke all on function public.get_radar_admission(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.get_radar_admission(text,integer,uuid) to service_role;
