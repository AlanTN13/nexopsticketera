-- Disposable PGlite fixture only. The fifth response must reconcile at observed cost;
-- a sixth response must remain incomplete, with all historical ledger rows untouched.
create temp table five_call_ledger_before as
  select md5(jsonb_agg(to_jsonb(e) order by run_id)::text) digest from private.radar_budget_entries e;
-- APPLY FIVE CALL MIGRATION HERE
select pg_temp.assert_true(
  (select md5(jsonb_agg(to_jsonb(e) order by run_id)::text) from private.radar_budget_entries e) =
  (select digest from five_call_ledger_before),
  'five-call migration leaves the historical ledger untouched');
savepoint five_call_fixture;
update public.radar_runs set
  api_context = jsonb_build_object('engine','radar_api_v1','model','gpt-5-mini','n8nIssuedCall',5,
    'n8nExecutionId','offline-five-call',
    'n8nState',jsonb_build_object('responses',(
      select jsonb_agg(pg_temp.provider_response('five-'||n,1000,200,1))
      from generate_series(1,5) n))),
  api_usage = jsonb_build_object('calls',5,'inputTokens',5000,'outputTokens',1000,
    'webSearchCalls',5,'responseIds',jsonb_build_array('five-1','five-2','five-3','five-4','five-5'))
where id='480e1520-51ec-453f-9b28-fd2eb2afb70e';
select pg_temp.assert_true(
  (select private.radar_budget_evidence(r)->>'complete'='true'
    and private.radar_budget_evidence(r)->>'knownCalls'='5'
    and (private.radar_budget_evidence(r)->>'spentUsd')::numeric=0.05325
   from public.radar_runs r where id='480e1520-51ec-453f-9b28-fd2eb2afb70e'),
  'five distinct responses reconcile to observed provider cost');
update public.radar_runs set api_context=jsonb_set(api_context,'{n8nIssuedCall}','6'::jsonb)
where id='480e1520-51ec-453f-9b28-fd2eb2afb70e';
select pg_temp.assert_true(
  (select private.radar_budget_evidence(r)->>'complete'='false'
   from public.radar_runs r where id='480e1520-51ec-453f-9b28-fd2eb2afb70e'),
  'sixth issued call without matching telemetry is incomplete');
rollback to five_call_fixture;
