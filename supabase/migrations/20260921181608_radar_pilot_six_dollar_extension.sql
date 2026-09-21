-- Alan explicitly authorized USD5 -> USD6 on 2026-09-21 for one further run.
-- Preserve the existing lifetime ledger, locks, ACLs and USD1.50 reservation.
-- No ledger UPDATE/DELETE/reset or refund; no scheduler/publication change.
alter table private.radar_api_pilot_usage
  drop constraint radar_api_pilot_usage_reserved_usd_check,
  add constraint radar_api_pilot_usage_reserved_usd_check check (reserved_usd between 0 and 6.00);

create or replace function public.reserve_radar_api_run(
  target_run_id uuid, requested_context jsonb, pilot_max_runs integer
)
returns public.radar_runs language plpgsql security definer set search_path = '' as $$
declare
  run public.radar_runs;
  settings public.radar_control_settings;
  reserved_count integer;
  reserved_dollars numeric(8,2);
begin
  if pilot_max_runs is null or pilot_max_runs not between 1 and 10
    or jsonb_typeof(requested_context) is distinct from 'object'
    or requested_context ->> 'model' is distinct from 'gpt-5-mini' then
    raise exception 'Piloto API deshabilitado o contexto inválido.' using errcode = '22023';
  end if;
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or run.status <> 'dispatching' then return null; end if;
  if run.api_context ->> 'engine' is distinct from 'radar_api_v1'
    or run.api_deadline_at is null or run.api_deadline_at <= clock_timestamp()
    or run.api_deadline_at > clock_timestamp() + interval '240 seconds' then
    raise exception 'Reserva API ausente o vencida.' using errcode = '55000';
  end if;
  select * into settings from public.radar_control_settings
  where workspace_id = run.workspace_id for share;
  if not settings.enabled or settings.scheduler_enabled or run.autonomy_mode <> 'review' then
    raise exception 'Radar API sólo opera con revisión manual habilitada.' using errcode = '55000';
  end if;
  select reserved_runs, reserved_usd into reserved_count, reserved_dollars from private.radar_api_pilot_usage
  where singleton for update;
  if not found or reserved_count >= pilot_max_runs or reserved_dollars + 1.50 > 6.00 then
    raise exception 'Límite persistente del piloto API alcanzado.' using errcode = '55000';
  end if;
  update private.radar_api_pilot_usage set reserved_runs = reserved_runs + 1, reserved_usd = reserved_usd + 1.50 where singleton;
  update public.radar_runs set
    status = 'running', started_at = clock_timestamp(), updated_at = clock_timestamp(),
    api_context = requested_context || jsonb_build_object(
      'engine', 'radar_api_v1', 'settings', to_jsonb(settings),
      'preferences', settings.preferences, 'workspaceId', run.workspace_id,
      'requestKind', run.request_kind, 'requestPayload', run.request_payload),
    api_usage = jsonb_build_object('reserved', true, 'pilotReservation', reserved_count + 1,
      'reservedUsd', 1.50, 'pilotReservedUsd', reserved_dollars + 1.50)
  where id = run.id returning * into run;
  insert into public.radar_run_events(run_id, event_type, public_message)
  values (run.id, 'api_reserved', 'Búsqueda API iniciada con plazo y uso reservados.');
  return run;
end
$$;

