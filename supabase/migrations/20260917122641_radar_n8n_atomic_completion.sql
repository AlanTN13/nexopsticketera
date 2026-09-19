-- n8n adapter only. Existing tables, RLS, lifetime budget and publisher stay unchanged.
-- SECURITY INVOKER: only the existing backend service role may invoke this adapter.
create or replace function public.finish_radar_n8n_run(
  target_run_id uuid, requested_execution_id text, expected_revision integer,
  requested_status text, requested_candidate jsonb, requested_reason text,
  requested_usage jsonb, requested_context jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  run public.radar_runs;
  decision jsonb := requested_context -> 'decision';
  gate text;
  finished boolean;
begin
  select * into run from public.radar_runs where id = target_run_id for update;
  if not found or run.api_context ->> 'n8nExecutionId' is distinct from requested_execution_id then
    raise exception 'n8n execution mismatch' using errcode = '55000';
  end if;
  if run.api_context -> 'n8nReceipt' is not null then return run.api_context -> 'n8nReceipt'; end if;
  if run.status <> 'running' or (run.api_context ->> 'n8nRevision')::integer is distinct from expected_revision
    or jsonb_typeof(decision) is distinct from 'object' then
    raise exception 'n8n transition rejected' using errcode = '55000';
  end if;
  if requested_status = 'review_pending' then
    if decision ->> 'eligibility' is distinct from 'ELIGIBLE'
      or decision ->> 'outcome' not in ('AUTO_PUBLISH','READY_FOR_REVIEW')
      or decision -> 'score' is distinct from requested_candidate -> 'score'
      or jsonb_typeof(decision -> 'score') is distinct from 'number' then
      raise exception 'n8n eligibility mismatch' using errcode = '22023';
    end if;
    foreach gate in array array['sources','facts','novelty','clientClaims','content','cover','siteValidation','budget','consistency'] loop
      if requested_context #> array['gates',gate] is distinct from 'true'::jsonb then
        raise exception 'n8n critical gate failed' using errcode = '22023';
      end if;
    end loop;
  elsif requested_candidate is not null then
    requested_candidate := jsonb_set(requested_candidate,'{score}','0');
  end if;
  finished := public.finish_radar_api_run(target_run_id, requested_status, requested_candidate, requested_reason, requested_usage);
  select * into run from public.radar_runs where id = target_run_id;
  if not finished and run.status <> 'failed' then raise exception 'n8n completion rejected' using errcode = '55000'; end if;
  if run.status <> 'review_pending' then
    decision := decision || jsonb_build_object('eligibility','INELIGIBLE','score',null,
      'outcome',case run.status when 'no_publication' then 'NO_PUBLICATION' when 'rejected' then 'REJECT' else 'FAILED' end,
      'reason',run.result_reason);
    if run.candidate is not null then run.candidate := jsonb_set(run.candidate,'{score}','0'); end if;
  end if;
  requested_context := requested_context || jsonb_build_object('decision',decision,'n8nReceipt',
    jsonb_build_object('ok',true,'decision',decision,'usage',run.api_usage,'controlledPublication',true));
  update public.radar_runs set api_context=requested_context, candidate=run.candidate where id=target_run_id;
  return requested_context -> 'n8nReceipt';
end $$;
revoke all on function public.finish_radar_n8n_run(uuid,text,integer,text,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finish_radar_n8n_run(uuid,text,integer,text,jsonb,text,jsonb,jsonb) to service_role;
