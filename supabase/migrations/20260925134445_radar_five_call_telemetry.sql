-- Preserve every budget and ledger rule; only admit the fifth authorized provider response.
create or replace function private.radar_budget_evidence(run public.radar_runs)
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
  if coalesce(run.api_context ->> 'n8nIssuedCall','') ~ '^[0-5]$' then issued := (run.api_context ->> 'n8nIssuedCall')::integer; end if;
  if jsonb_typeof(responses) = 'array' and jsonb_array_length(responses) <= 5 then
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
