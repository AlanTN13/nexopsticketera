-- GitHub-backed editorial queue bridge.
-- Supabase remains the source of truth; this migration only opens the
-- review-only scheduler gate and makes callback events idempotent.

create unique index radar_run_events_engine_status_uq
  on public.radar_run_events(run_id, event_type)
  where event_type like 'engine\_%' escape '\';

grant select on public.radar_control_settings to service_role;
grant select, insert, update on public.radar_runs to service_role;
grant select, insert on public.radar_run_events to service_role;
grant select on public.users to service_role;

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
  if requested_autonomy_mode <> 'review'
    or requested_schedule_hour <> 7
    or requested_schedule_days <> array[1, 2, 3, 4, 5, 6]::smallint[]
    or requested_timezone <> 'America/Argentina/Buenos_Aires' then
    raise exception 'El scheduler temporal sólo opera lunes a sábado a las 07:00 ART y en revisión.' using errcode = '55000';
  end if;

  update public.radar_control_settings
  set scheduler_enabled = requested_scheduler_enabled,
      schedule_days = requested_schedule_days,
      schedule_hour = requested_schedule_hour,
      schedule_timezone = btrim(requested_timezone),
      autonomy_mode = requested_autonomy_mode,
      next_run_at = null,
      updated_by = (select auth.uid()),
      updated_at = now()
  where workspace_id = target_workspace_id
  returning * into updated_settings;

  if not found then raise exception 'Workspace de Radar inexistente.' using errcode = 'P0002'; end if;
  return updated_settings;
end
$$;

revoke all on function public.update_radar_control_schedule(text, boolean, smallint[], smallint, text, text)
  from public, anon;
grant execute on function public.update_radar_control_schedule(text, boolean, smallint[], smallint, text, text)
  to authenticated;

create or replace function public.record_radar_worker_result(
  target_run_id uuid,
  expected_status text,
  requested_status text,
  requested_public_message text,
  requested_candidate jsonb,
  requested_result_reason text,
  requested_external_run_id text,
  requested_external_run_url text,
  requested_delivery_id text,
  requested_request_digest text,
  requested_result_digest text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  existing_metadata jsonb;
begin
  select status into current_status
  from public.radar_runs
  where id = target_run_id
  for update;
  if not found then raise exception 'Corrida de Radar inexistente.' using errcode = 'P0002'; end if;

  if current_status = requested_status then
    select metadata into existing_metadata
    from public.radar_run_events
    where run_id = target_run_id and event_type = 'engine_' || requested_status;
    if existing_metadata ->> 'deliveryId' = requested_delivery_id
      and existing_metadata ->> 'requestDigest' = requested_request_digest
      and existing_metadata ->> 'resultDigest' = requested_result_digest then
      return true;
    end if;
    raise exception 'El callback repetido no coincide con el resultado registrado.' using errcode = '22023';
  end if;

  if current_status <> expected_status
    or current_status not in ('dispatching', 'running')
    or requested_status not in ('no_publication', 'suggested', 'review_pending', 'failed')
    or char_length(coalesce(requested_public_message, '')) not between 1 and 500
    or coalesce(requested_delivery_id, '') <> ('radar-' || target_run_id::text)
    or coalesce(requested_request_digest, '') !~ '^[0-9a-f]{64}$'
    or coalesce(requested_result_digest, '') !~ '^[0-9a-f]{64}$'
    or (requested_status in ('suggested', 'review_pending') and requested_candidate is null)
    or (requested_status in ('no_publication', 'failed') and nullif(btrim(requested_result_reason), '') is null) then
    raise exception 'Transición o resultado de Radar inválido.' using errcode = '22023';
  end if;

  update public.radar_runs
  set status = requested_status,
      external_run_id = coalesce(left(requested_external_run_id, 120), external_run_id),
      external_run_url = coalesce(requested_external_run_url, external_run_url),
      candidate = requested_candidate,
      result_reason = left(requested_result_reason, 1200),
      error_code = case when requested_status = 'failed' then 'WORKER_FAILED' else null end,
      error_message = case when requested_status = 'failed' then left(requested_result_reason, 500) else null end,
      started_at = coalesce(started_at, now()),
      completed_at = case when requested_status = 'review_pending' then null else now() end,
      updated_at = now()
  where id = target_run_id;

  insert into public.radar_run_events (run_id, event_type, public_message, metadata)
  values (
    target_run_id,
    'engine_' || requested_status,
    requested_public_message,
    jsonb_build_object(
      'deliveryId', requested_delivery_id,
      'requestDigest', requested_request_digest,
      'resultDigest', requested_result_digest
    )
  );
  return false;
end
$$;

revoke all on function public.record_radar_worker_result(
  uuid, text, text, text, jsonb, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_radar_worker_result(
  uuid, text, text, text, jsonb, text, text, text, text, text, text
) to service_role;
