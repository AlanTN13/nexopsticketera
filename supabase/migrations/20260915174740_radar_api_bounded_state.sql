-- Additive API pilot state. No scheduling, historical reconciliation or API use.
alter table public.radar_runs
  add column api_context jsonb,
  add column api_deadline_at timestamptz,
  add column api_usage jsonb not null default '{}'::jsonb,
  add constraint radar_runs_api_context_object check (api_context is null or jsonb_typeof(api_context) = 'object'),
  add constraint radar_runs_api_usage_object check (jsonb_typeof(api_usage) = 'object');

create index radar_runs_api_deadline_idx on public.radar_runs(api_deadline_at)
  where api_context is not null and status in ('dispatching', 'running');

-- Lifetime reservation count is deliberately independent of deletable run history.
-- Ambiguous failures, cancellation and expiry never refund a reservation.
-- Explicit pilot authorization: USD 5 total; reserve USD 1.50 per gpt-5-mini run.
-- This is a conservative reservation, not a claim of billed usage. No reset RPC.
create table private.radar_api_pilot_usage (
  singleton boolean primary key default true check (singleton),
  reserved_runs integer not null default 0 check (reserved_runs between 0 and 10),
  reserved_usd numeric(8,2) not null default 0 check (reserved_usd between 0 and 5.00)
);
alter table private.radar_api_pilot_usage enable row level security;
revoke all on private.radar_api_pilot_usage from public, anon, authenticated, service_role;
insert into private.radar_api_pilot_usage(singleton) values (true);

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
  if not found or reserved_count >= pilot_max_runs or reserved_dollars + 1.50 > 5.00 then
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

create or replace function public.finish_radar_api_run(
  target_run_id uuid, requested_status text, requested_candidate jsonb,
  requested_reason text, requested_usage jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  run public.radar_runs;
  outcome text := requested_status;
  reason text := requested_reason;
begin
  if requested_status is null or requested_status not in ('review_pending', 'no_publication', 'rejected', 'failed')
    or jsonb_typeof(requested_usage) is distinct from 'object'
    or (requested_candidate is not null and jsonb_typeof(requested_candidate) <> 'object')
    or (requested_status = 'review_pending' and (
      requested_candidate is null
      or coalesce(requested_candidate ->> 'topicFingerprint', '') !~ '^[a-z0-9:._-]{5,240}$'
      or requested_candidate #>> '{qa,verdict}' is distinct from 'PASS'
      or jsonb_typeof(requested_candidate -> 'sources') is distinct from 'array'
      or jsonb_typeof(requested_candidate -> 'composition') is distinct from 'object'
      or jsonb_typeof(requested_candidate -> 'cover') is distinct from 'object'))
    or (requested_status <> 'review_pending' and nullif(btrim(requested_reason), '') is null) then
    raise exception 'Resultado API inválido.' using errcode = '22023';
  end if;
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or run.api_context ->> 'engine' is distinct from 'radar_api_v1'
    or (run.status <> 'running' and not (run.status = 'dispatching' and requested_status = 'failed')) then return false; end if;
  if run.api_deadline_at is null or run.api_deadline_at <= clock_timestamp() then
    update public.radar_runs set status = 'failed', error_code = 'API_TIMEOUT',
      error_message = 'La búsqueda API superó su plazo máximo.',
      result_reason = 'La búsqueda API superó su plazo máximo.',
      completed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = run.id;
    insert into public.radar_run_events(run_id, event_type, public_message)
    values (run.id, 'api_expired', 'La búsqueda API superó su plazo máximo. El historial se conserva.');
    return false;
  end if;
  if outcome = 'review_pending' and exists (
    select 1 from public.radar_runs previous
    where previous.workspace_id = run.workspace_id and previous.id <> run.id
      and (
        previous.status in ('review_pending', 'approved', 'validating', 'publishing', 'published', 'postponed')
        or exists (select 1 from public.radar_publication_jobs job where job.run_id = previous.id)
        or exists (select 1 from public.radar_run_decisions decision
          where decision.run_id = previous.id and decision.decision = 'approve')
      )
      and previous.candidate ->> 'topicFingerprint' = requested_candidate ->> 'topicFingerprint'
  ) then
    outcome := 'no_publication';
    reason := 'El tema ya fue seleccionado o publicado en este workspace.';
  end if;
  update public.radar_runs set status = outcome, candidate = requested_candidate,
    result_reason = left(reason, 1200), api_usage = api_usage || (requested_usage - array['reserved','pilotReservation','reservedUsd','pilotReservedUsd']),
    error_code = case when outcome = 'failed' then 'API_FAILED' else null end,
    error_message = case when outcome = 'failed' then left(reason, 500) else null end,
    completed_at = case when outcome = 'review_pending' then null else clock_timestamp() end,
    updated_at = clock_timestamp()
  where id = run.id;
  insert into public.radar_run_events(run_id, event_type, public_message)
  values (run.id, 'api_' || outcome, case outcome
    when 'review_pending' then 'Nota y portada listas para revisión humana tras QA aprobado.'
    when 'no_publication' then 'Búsqueda finalizada sin una nueva publicación.'
    when 'rejected' then 'La revisión editorial rechazó la propuesta.'
    else 'La búsqueda API no pudo completarse. El historial se conserva.' end);
  return true;
end
$$;

create or replace function public.expire_radar_api_runs()
returns integer language plpgsql security definer set search_path = '' as $$
declare expired_count integer;
begin
  with expired as (
    update public.radar_runs set status = 'failed', error_code = 'API_TIMEOUT',
      error_message = 'La búsqueda API superó su plazo máximo.',
      result_reason = 'La búsqueda API superó su plazo máximo.',
      completed_at = clock_timestamp(), updated_at = clock_timestamp()
    where api_context ->> 'engine' = 'radar_api_v1'
      and status in ('dispatching', 'running') and api_deadline_at <= clock_timestamp()
    returning id
  ), events as (
    insert into public.radar_run_events(run_id, event_type, public_message)
    select id, 'api_expired', 'La búsqueda API superó su plazo máximo. El historial se conserva.' from expired
    returning run_id
  ) select count(*)::integer into expired_count from events;
  return expired_count;
end
$$;

create or replace function public.cancel_radar_api_run(target_run_id uuid, target_workspace_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.radar_runs set status = 'canceled', result_reason = 'Búsqueda cancelada por un usuario autorizado.',
    completed_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = target_run_id and workspace_id = target_workspace_id
    and api_context ->> 'engine' = 'radar_api_v1' and status in ('dispatching', 'running');
  if not found then return false; end if;
  insert into public.radar_run_events(run_id, event_type, public_message)
  values (target_run_id, 'api_canceled', 'Búsqueda cancelada. Se conserva el uso ya reservado.');
  return true;
end
$$;

revoke all on function public.reserve_radar_api_run(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.finish_radar_api_run(uuid, text, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_radar_api_runs() from public, anon, authenticated;
revoke all on function public.cancel_radar_api_run(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_radar_api_run(uuid, jsonb, integer) to service_role;
grant execute on function public.finish_radar_api_run(uuid, text, jsonb, text, jsonb) to service_role;
grant execute on function public.expire_radar_api_runs() to service_role;
grant execute on function public.cancel_radar_api_run(uuid, text) to service_role;

-- Legacy callbacks remain supported only for legacy runs.
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
  current_api_context jsonb;
  existing_metadata jsonb;
begin
  select status, api_context into current_status, current_api_context
  from public.radar_runs
  where id = target_run_id
  for update;
  if not found then raise exception 'Corrida de Radar inexistente.' using errcode = 'P0002'; end if;

  if current_api_context is not null then
    raise exception 'El callback anterior no puede modificar corridas API.' using errcode = '55000';
  end if;

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

-- Retrying publication reuses exactly the approved package and never reruns research.
-- Each attempt has a separate callback identity; merged results require reconciliation.
alter table public.radar_publication_jobs add column attempt integer not null default 1 check (attempt >= 1);

create or replace function public.request_manual_radar_publication(
  target_run_id uuid,
  publication_idempotency_key uuid,
  requested_composition_digest text,
  requested_composition jsonb
)
returns public.radar_publication_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.radar_runs;
  settings public.radar_control_settings;
  existing_job public.radar_publication_jobs;
  created_job public.radar_publication_jobs;
  retrying boolean := false;
begin
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or not private.radar_workspace_has_access(run.workspace_id, 'admin') then
    raise exception 'Corrida no disponible para publicación.' using errcode = '42501';
  end if;

  select * into existing_job
  from public.radar_publication_jobs
  where workspace_id = run.workspace_id and idempotency_key = publication_idempotency_key;
  if found then
    if existing_job.run_id <> run.id or existing_job.composition_digest is distinct from requested_composition_digest then
      raise exception 'La clave de publicación ya fue utilizada.' using errcode = '22023';
    end if;
    return existing_job;
  end if;

  select * into existing_job from public.radar_publication_jobs where run_id = run.id for update;
  retrying := found and existing_job.status = 'failed' and run.status = 'failed'
    and run.api_context ->> 'engine' = 'radar_api_v1';
  if retrying and (existing_job.composition_digest is distinct from requested_composition_digest
    or existing_job.composition is distinct from requested_composition
    or existing_job.merge_sha is not null or existing_job.external_pr_number = 73) then
    raise exception 'El reintento exige el paquete aprobado exacto y ninguna publicación fusionada o histórica protegida.' using errcode = '55000';
  end if;
  select * into settings from public.radar_control_settings where workspace_id = run.workspace_id;
  if (run.status <> 'approved' and not retrying) or run.autonomy_mode <> 'review' or run.candidate is null
    or not settings.enabled or settings.scheduler_enabled
    or coalesce(settings.preferences ->> 'publishingMode', 'review') <> 'review'
    or coalesce(requested_composition_digest, '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(requested_composition) is distinct from 'object' then
    raise exception 'Radar sólo permite publicación manual de una nota aprobada en modo revisión.' using errcode = '55000';
  end if;

  if retrying then
    update public.radar_publication_jobs set status = 'reserved',
      idempotency_key = publication_idempotency_key, requested_by = (select auth.uid()),
      attempt = attempt + 1, external_pr_number = null, external_pr_url = null,
      external_workflow_url = null, final_url = null, callback_delivery_id = null,
      error_message = null, completed_at = null, updated_at = clock_timestamp()
    where run_id = run.id returning * into created_job;
  else
  insert into public.radar_publication_jobs (
    run_id, workspace_id, company_id, requested_by, idempotency_key,
    composition_digest, composition
  ) values (
    run.id, run.workspace_id, run.company_id, (select auth.uid()),
    publication_idempotency_key, requested_composition_digest, requested_composition
  ) returning * into created_job;
  end if;

  update public.radar_runs
  set status = 'validating', completed_at = null, error_code = null, error_message = null, updated_at = now()
  where id = run.id;

  insert into public.radar_run_events (run_id, event_type, public_message, metadata)
  values (
    run.id,
    case when retrying then 'manual_publication_retried' else 'manual_publication_reserved' end,
    'Publicación confirmada manualmente; webneoxps inició sus validaciones.',
    jsonb_build_object('compositionDigest', requested_composition_digest, 'attempt', created_job.attempt)
  );

  return created_job;
end
$$;

revoke all on function public.request_manual_radar_publication(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function public.request_manual_radar_publication(uuid, uuid, text, jsonb)
  to authenticated;

create or replace function public.record_radar_publication_result(
  target_run_id uuid,
  requested_composition_digest text,
  requested_delivery_id text,
  requested_status text,
  requested_workflow_url text,
  requested_merge_sha text,
  requested_final_url text,
  requested_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.radar_publication_jobs;
begin
  perform 1 from public.radar_runs where id = target_run_id for update;
  select * into job from public.radar_publication_jobs where run_id = target_run_id for update;
  if not found then raise exception 'Publicación de Radar inexistente.' using errcode = 'P0002'; end if;
  if job.composition_digest is distinct from requested_composition_digest
    or requested_delivery_id is distinct from ('radar-publication-' || target_run_id::text
      || case when job.attempt = 1 then '' else '-attempt-' || job.attempt::text end)
    or requested_status is null or requested_status not in ('published', 'failed')
    or (requested_merge_sha is not null and requested_merge_sha !~ '^[0-9a-f]{40}$')
    or (requested_status = 'published' and (
      coalesce(requested_merge_sha, '') !~ '^[0-9a-f]{40}$'
      or coalesce(requested_final_url, '') not like 'https://www.nexopstech.com/noticias/%'
    ))
    or (requested_status = 'failed' and nullif(btrim(requested_error_message), '') is null) then
    raise exception 'Resultado de publicación inválido.' using errcode = '22023';
  end if;
  if job.status = requested_status and job.callback_delivery_id = requested_delivery_id then return true; end if;
  if job.status <> 'dispatched' then
    raise exception 'La publicación ya no espera resultado.' using errcode = '55000';
  end if;

  update public.radar_publication_jobs
  set status = requested_status,
      external_workflow_url = left(requested_workflow_url, 2000),
      merge_sha = coalesce(requested_merge_sha, merge_sha),
      final_url = case when requested_status = 'published' then requested_final_url else null end,
      callback_delivery_id = requested_delivery_id,
      error_message = case when requested_status = 'failed' then left(requested_error_message, 500) else null end,
      completed_at = now(), updated_at = now()
  where run_id = target_run_id;

  update public.radar_runs
  set status = requested_status,
      final_url = case when requested_status = 'published' then requested_final_url else null end,
      error_code = case when requested_status = 'failed' then 'PUBLICATION_FAILED' else null end,
      error_message = case when requested_status = 'failed' then left(requested_error_message, 500) else null end,
      completed_at = now(), updated_at = now()
  where id = target_run_id and status = 'publishing';

  insert into public.radar_run_events (run_id, event_type, public_message, metadata)
  values (
    target_run_id,
    'manual_publication_' || requested_status,
    case requested_status
      when 'published' then 'Nota publicada y verificada en producción.'
      else 'La publicación no pudo verificarse. Se conservan el borrador y la evidencia para revisión.'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'workflowUrl', requested_workflow_url,
      'mergeSha', requested_merge_sha,
      'finalUrl', requested_final_url,
      'deliveryId', requested_delivery_id, 'attempt', job.attempt
    ))
  );
  return false;
end
$$;

revoke all on function public.record_radar_publication_result(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_radar_publication_result(uuid, text, text, text, text, text, text, text)
  to service_role;

-- Guard delayed dispatch receipts across publication retries.
drop function public.record_radar_publication_dispatch(uuid, text, bigint, text);
create or replace function public.record_radar_publication_dispatch(
  target_run_id uuid,
  requested_composition_digest text,
  requested_pr_number bigint,
  requested_pr_url text,
  requested_attempt integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.radar_publication_jobs;
begin
  perform 1 from public.radar_runs where id = target_run_id for update;
  select * into job from public.radar_publication_jobs where run_id = target_run_id for update;
  if not found then raise exception 'Publicación de Radar inexistente.' using errcode = 'P0002'; end if;
  if job.attempt is distinct from requested_attempt
    or job.composition_digest is distinct from requested_composition_digest
    or requested_pr_number is null or requested_pr_number <= 0
    or coalesce(requested_pr_url, '') not like 'https://github.com/%' then
    raise exception 'Despacho de publicación inválido.' using errcode = '22023';
  end if;
  if job.status = 'dispatched' and job.external_pr_number = requested_pr_number
    and job.external_pr_url = requested_pr_url then return true; end if;
  if job.status <> 'reserved' then
    raise exception 'La publicación ya no espera despacho.' using errcode = '55000';
  end if;

  update public.radar_publication_jobs
  set status = 'dispatched', external_pr_number = requested_pr_number,
      external_pr_url = requested_pr_url, updated_at = now()
  where run_id = target_run_id;
  update public.radar_runs set status = 'publishing', updated_at = now()
  where id = target_run_id and status = 'validating';
  insert into public.radar_run_events (run_id, event_type, public_message, metadata)
  values (target_run_id, 'manual_publication_dispatched',
    'La publicación ingresó al circuito validado de webneoxps.',
    jsonb_build_object('pullRequest', requested_pr_url));
  return false;
end
$$;

revoke all on function public.record_radar_publication_dispatch(uuid, text, bigint, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_radar_publication_dispatch(uuid, text, bigint, text, integer)
  to service_role;


-- Dispatch errors are scoped to their attempt and update job, run and event together.
create or replace function public.fail_radar_publication_dispatch(
  target_run_id uuid, requested_attempt integer, requested_message text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  run public.radar_runs;
  job public.radar_publication_jobs;
begin
  if requested_attempt is null or requested_attempt < 1
    or nullif(btrim(requested_message), '') is null then
    raise exception 'Fallo de despacho inválido.' using errcode = '22023';
  end if;
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or run.status <> 'validating' then return false; end if;
  select * into job from public.radar_publication_jobs where run_id = target_run_id for update;
  if not found or job.status <> 'reserved' or job.attempt <> requested_attempt then return false; end if;
  update public.radar_publication_jobs set status = 'failed',
    error_message = left(requested_message, 500), completed_at = clock_timestamp(), updated_at = clock_timestamp()
  where run_id = target_run_id;
  update public.radar_runs set status = 'failed', error_code = 'PUBLICATION_DISPATCH_FAILED',
    error_message = left(requested_message, 500), completed_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = target_run_id;
  insert into public.radar_run_events(run_id, event_type, public_message, metadata)
  values (target_run_id, 'manual_publication_dispatch_failed',
    'No se pudo confirmar el despacho. Se conservan el paquete y la evidencia para revisión.',
    jsonb_build_object('attempt', requested_attempt, 'compositionDigest', job.composition_digest));
  return true;
end
$$;
revoke all on function public.fail_radar_publication_dispatch(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.fail_radar_publication_dispatch(uuid, integer, text) to service_role;
