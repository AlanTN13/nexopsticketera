-- Read-only product admission. The existing locked reserve remains the final guard.
-- No new budget, reservation, run, ledger reset/refund or scheduler change.
-- Private ledger access requires SECURITY DEFINER; only service_role may invoke it.
create or replace function public.get_radar_admission(target_workspace_id text, pilot_max_runs integer, existing_queued_run_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  settings public.radar_control_settings;
  usage private.radar_api_pilot_usage;
  remaining integer;
  reason text;
begin
  if pilot_max_runs is null or pilot_max_runs not between 1 and 10 then
    return jsonb_build_object('allowed', false, 'code', 'unavailable', 'maxUsd', 9);
  end if;
  select * into settings from public.radar_control_settings where workspace_id = target_workspace_id;
  if not found or not settings.enabled or settings.scheduler_enabled
    or settings.autonomy_mode = 'automatic' or settings.preferences ->> 'publishingMode' = 'automatic' then
    return jsonb_build_object('allowed', false, 'code', 'disabled', 'maxUsd', 9);
  end if;
  -- An idempotent retry may ignore only its existing, still-queued row. The
  -- server supplies this ID after authorized lookup; SQL checks scope/state again.
  if existing_queued_run_id is not null and not exists (select 1 from public.radar_runs
    where id = existing_queued_run_id and workspace_id = target_workspace_id and status = 'queued') then
    return jsonb_build_object('allowed', false, 'code', 'unavailable', 'maxUsd', 9);
  end if;
  select * into usage from private.radar_api_pilot_usage where singleton;
  if not found then
    return jsonb_build_object('allowed', false, 'code', 'unavailable', 'maxUsd', 9);
  end if;
  remaining := greatest(0, least(pilot_max_runs - usage.reserved_runs, floor((9.00 - usage.reserved_usd) / 1.50)::integer));
  reason := case
    when remaining = 0 then 'budget_exhausted'
    when exists (select 1 from public.radar_runs where workspace_id = target_workspace_id
      and id is distinct from existing_queued_run_id
      and status in ('queued', 'dispatching', 'running', 'review_pending', 'approved', 'validating', 'publishing')) then 'active_run'
    else 'available' end;
  return jsonb_build_object('allowed', reason = 'available', 'code', reason, 'reservedUsd', usage.reserved_usd,
    'maxUsd', 9, 'remainingRuns', remaining);
end
$$;
revoke all on function public.get_radar_admission(text, integer, uuid) from public, anon, authenticated;
grant execute on function public.get_radar_admission(text, integer, uuid) to service_role;

-- A postponed piece can return to a human decision without bypassing QA.
create or replace function public.decide_radar_run_authorized(
  target_run_id uuid,
  decision_idempotency_key uuid,
  requested_decision text,
  requested_actor_id uuid,
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
  if not found or requested_actor_id is null or not exists (
    select 1 from public.radar_control_settings settings
    where settings.workspace_id = run.workspace_id and case
      when settings.company_id is null then exists (select 1 from public.users actor
        where actor.id = requested_actor_id and actor.status = 'active' and actor.role = 'platform_admin')
      else private.user_has_module_access(requested_actor_id, settings.company_id, 'radar', 'operate') end
  ) then
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
  if run.status not in ('review_pending', 'postponed') then
    raise exception 'La oportunidad ya no espera una decisión.' using errcode = '55000';
  end if;
  if requested_decision not in ('approve', 'discard', 'postpone') then
    raise exception 'Decisión inválida.' using errcode = '22023';
  end if;

  -- Approval never upgrades an ineligible piece, including direct authenticated
  -- RPC callers. The existing publisher retains its exact-version preview gate.
  if requested_decision = 'approve' and (
    run.candidate #>> '{qa,verdict}' is distinct from 'PASS'
    or run.api_context #>> '{decision,eligibility}' is distinct from 'ELIGIBLE') then
    raise exception 'La pieza no superó QA y elegibilidad.' using errcode = '55000';
  end if;

  insert into public.radar_run_decisions (
    run_id, workspace_id, company_id, actor_user_id,
    idempotency_key, decision, reason
  ) values (
    run.id, run.workspace_id, run.company_id, requested_actor_id,
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

-- Only the server may deliver decisions after validating the signed preview and
-- current authenticated actor. Retain the old function for code rollback, but
-- prevent authenticated Data API callers from bypassing the server gate.
revoke all on function public.decide_radar_run(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.decide_radar_run_authorized(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_radar_run_authorized(uuid, uuid, text, uuid, text) to service_role;
-- Code rollback requires restoring EXECUTE on the old function to authenticated;
-- this is a deliberate separate rollback action, not an automatic gate bypass.
