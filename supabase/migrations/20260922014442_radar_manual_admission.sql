-- Alan clarified the single-run STOP applies to agent execution, not his manual use.
-- NULL removes only the lifetime test quota. Daily limits, locking, USD5 cap,
-- USD1.50 holds and review-only settings remain enforced by the existing RPCs.
-- Historical counters, spend, holds and audit entries are never reset.
alter table private.radar_budget_accounts
  drop constraint radar_budget_accounts_authorized_new_runs_check,
  drop constraint radar_budget_accounts_new_runs_reserved_check,
  alter column authorized_new_runs drop not null,
  alter column authorized_new_runs drop default,
  add constraint radar_budget_accounts_authorized_new_runs_check check (authorized_new_runs is null or authorized_new_runs >= 0),
  add constraint radar_budget_accounts_new_runs_reserved_check check (new_runs_reserved >= 0);
update private.radar_budget_accounts set authorized_new_runs=null where singleton;
comment on column private.radar_budget_accounts.authorized_new_runs is
  'Optional lifetime pilot quota. NULL: manual use governed by daily/concurrency and reconciled USD5 budget. Agent STOP is an execution instruction, not a user lock.';

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
  if account.authorized_new_runs is not null and account.new_runs_reserved >= account.authorized_new_runs then raise exception 'Límite de corridas autorizadas del piloto alcanzado.' using errcode='55000'; end if;
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
  remaining := greatest(0,least(coalesce(account.authorized_new_runs-account.new_runs_reserved,pilot_max_runs),pilot_max_runs-daily));
  reason := case when spent+held+account.hold_per_run_usd > account.cap_usd then 'budget_exhausted'
    when remaining=0 then 'run_limit'
    when exists(select 1 from public.radar_runs where workspace_id=any(account.workspace_ids) and id is distinct from existing_queued_run_id and status in ('queued','dispatching','running','review_pending','approved','validating','publishing')) then 'active_run'
    else 'available' end;
  return jsonb_build_object('allowed',reason='available','code',reason,'maxUsd',account.cap_usd,'spentUsd',spent,'heldUsd',held,
    'availableUsd',greatest(account.cap_usd-spent-held,0),'legacyReservedUsd',account.legacy_reserved_usd,'reservedUsd',held,'remainingRuns',remaining,'budgetVersion',2);
end $$;
revoke all on function public.get_radar_admission(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.get_radar_admission(text,integer,uuid) to service_role;
