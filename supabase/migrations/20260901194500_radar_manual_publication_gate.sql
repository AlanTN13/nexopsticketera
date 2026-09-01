-- Manual publication gate for Radar.
-- A content approval only opens the composer. A second, admin-only action
-- reserves the publication and the trusted webneoxps workflow closes it.

create table public.radar_publication_jobs (
  run_id uuid primary key references public.radar_runs(id) on delete cascade,
  workspace_id text not null references public.radar_control_settings(workspace_id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete restrict,
  idempotency_key uuid not null,
  composition_digest text not null,
  composition jsonb not null,
  status text not null default 'reserved',
  external_pr_number bigint,
  external_pr_url text,
  external_workflow_url text,
  merge_sha text,
  final_url text,
  callback_delivery_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint radar_publication_jobs_workspace_company_consistency
    foreign key (workspace_id, company_id)
    references public.radar_control_settings(workspace_id, company_id),
  constraint radar_publication_jobs_idempotency unique (workspace_id, idempotency_key),
  constraint radar_publication_jobs_digest check (composition_digest ~ '^[0-9a-f]{64}$'),
  constraint radar_publication_jobs_composition_object check (jsonb_typeof(composition) = 'object'),
  constraint radar_publication_jobs_status check (status in ('reserved', 'dispatched', 'published', 'failed')),
  constraint radar_publication_jobs_pr_url check (external_pr_url is null or external_pr_url like 'https://github.com/%'),
  constraint radar_publication_jobs_final_url check (final_url is null or final_url like 'https://www.nexopstech.com/noticias/%'),
  constraint radar_publication_jobs_error_length check (error_message is null or char_length(error_message) <= 500)
);

create index radar_publication_jobs_workspace_created_idx
  on public.radar_publication_jobs(workspace_id, created_at desc);
create index radar_publication_jobs_company_idx
  on public.radar_publication_jobs(company_id) where company_id is not null;
create index radar_publication_jobs_requested_by_idx
  on public.radar_publication_jobs(requested_by);
create index radar_publication_jobs_workspace_company_idx
  on public.radar_publication_jobs(workspace_id, company_id);

alter table public.radar_publication_jobs enable row level security;

create policy "authorized users read radar publication jobs"
on public.radar_publication_jobs for select to authenticated
using (private.radar_workspace_has_access(workspace_id, 'view'));

revoke all on public.radar_publication_jobs from public, anon, authenticated;
grant select on public.radar_publication_jobs to authenticated;
grant select, insert, update on public.radar_publication_jobs to service_role;

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
begin
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or not private.radar_workspace_has_access(run.workspace_id, 'admin') then
    raise exception 'Corrida no disponible para publicación.' using errcode = '42501';
  end if;

  select * into existing_job
  from public.radar_publication_jobs
  where workspace_id = run.workspace_id and idempotency_key = publication_idempotency_key;
  if found then
    if existing_job.run_id <> run.id or existing_job.composition_digest <> requested_composition_digest then
      raise exception 'La clave de publicación ya fue utilizada.' using errcode = '22023';
    end if;
    return existing_job;
  end if;

  select * into settings from public.radar_control_settings where workspace_id = run.workspace_id;
  if run.status <> 'approved' or run.autonomy_mode <> 'review' or run.candidate is null
    or not settings.enabled or settings.scheduler_enabled
    or coalesce(settings.preferences ->> 'publishingMode', 'review') <> 'review'
    or requested_composition_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(requested_composition) <> 'object' then
    raise exception 'Radar sólo permite publicación manual de una nota aprobada en modo revisión.' using errcode = '55000';
  end if;

  insert into public.radar_publication_jobs (
    run_id, workspace_id, company_id, requested_by, idempotency_key,
    composition_digest, composition
  ) values (
    run.id, run.workspace_id, run.company_id, (select auth.uid()),
    publication_idempotency_key, requested_composition_digest, requested_composition
  ) returning * into created_job;

  update public.radar_runs
  set status = 'validating', error_code = null, error_message = null, updated_at = now()
  where id = run.id;

  insert into public.radar_run_events (run_id, event_type, public_message, metadata)
  values (
    run.id,
    'manual_publication_reserved',
    'Publicación confirmada manualmente; webneoxps inició sus validaciones.',
    jsonb_build_object('compositionDigest', requested_composition_digest)
  );

  return created_job;
end
$$;

revoke all on function public.request_manual_radar_publication(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function public.request_manual_radar_publication(uuid, uuid, text, jsonb)
  to authenticated;

create or replace function public.record_radar_publication_dispatch(
  target_run_id uuid,
  requested_composition_digest text,
  requested_pr_number bigint,
  requested_pr_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.radar_publication_jobs;
begin
  select * into job from public.radar_publication_jobs where run_id = target_run_id for update;
  if not found then raise exception 'Publicación de Radar inexistente.' using errcode = 'P0002'; end if;
  if job.composition_digest <> requested_composition_digest
    or requested_pr_number <= 0
    or requested_pr_url not like 'https://github.com/%' then
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

revoke all on function public.record_radar_publication_dispatch(uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.record_radar_publication_dispatch(uuid, text, bigint, text)
  to service_role;

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
  select * into job from public.radar_publication_jobs where run_id = target_run_id for update;
  if not found then raise exception 'Publicación de Radar inexistente.' using errcode = 'P0002'; end if;
  if job.composition_digest <> requested_composition_digest
    or requested_delivery_id <> 'radar-publication-' || target_run_id::text
    or requested_status not in ('published', 'failed')
    or (requested_status = 'published' and (
      requested_merge_sha !~ '^[0-9a-f]{40}$'
      or requested_final_url not like 'https://www.nexopstech.com/noticias/%'
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
      merge_sha = case when requested_status = 'published' then requested_merge_sha else null end,
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
      else 'La publicación se detuvo sin publicar; NexOps conserva el detalle para corregirla.'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'workflowUrl', requested_workflow_url,
      'mergeSha', requested_merge_sha,
      'finalUrl', requested_final_url,
      'deliveryId', requested_delivery_id
    ))
  );
  return false;
end
$$;

revoke all on function public.record_radar_publication_result(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_radar_publication_result(uuid, text, text, text, text, text, text, text)
  to service_role;
