-- Disposable database only: seed auditable historical records, apply migration,
-- then exercise v2. Never run this fixture file against a live project.
begin;
create or replace function pg_temp.assert_true(condition boolean,message text) returns void language plpgsql as $$ begin if not coalesce(condition,false) then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,email) values('a1000000-0000-0000-0000-000000000001','budget@test.invalid');
insert into public.users(id,name,email,role,status) values('a1000000-0000-0000-0000-000000000001','Budget','budget@test.invalid','platform_admin','active');
insert into public.radar_control_settings(workspace_id,enabled,autonomy_mode,preferences) values('nexops',true,'review','{"publishingMode":"review"}'),('nexops-api-pilot',true,'review','{"publishingMode":"review"}');
update private.radar_api_pilot_usage set reserved_runs=6,reserved_usd=9;
create function pg_temp.provider_response(response_id text,input_count integer,output_count integer,web_count integer) returns jsonb language sql as $$
 select jsonb_build_object('id',response_id,'status','completed','usage',jsonb_build_object('input_tokens',input_count,'output_tokens',output_count),'output',(select coalesce(jsonb_agg(jsonb_build_object('type','web_search_call','status','completed')),'[]'::jsonb) from generate_series(1,web_count))) $$;
do $$ declare run_id uuid; n integer; input_count integer; output_count integer; webs integer; calls integer; responses jsonb; usage jsonb; context jsonb; begin
  for n in 1..6 loop
    run_id := (array['fb783cc0-29cc-4f69-b64d-cdc723de1b66','bb1947a9-0b9b-438b-a611-6356227151fd','d2ed8008-95f9-4604-9d98-576691e217c5','4260e34c-41b9-4b99-882f-9c297193cf53','db79020f-53ad-4751-89fa-f5cb118313c2','480e1520-51ec-453f-9b28-fd2eb2afb70e'])[n]::uuid;
    input_count := (array[12582,0,12507,12732,13265,32450])[n]; output_count := (array[1797,0,2127,2006,1634,3073])[n]; webs := (array[1,0,1,1,1,3])[n]; calls := case when n=2 then 0 when n=6 then 2 else 1 end;
    usage := jsonb_build_object('reserved',true,'reservedUsd',1.5,'pilotReservation',n,'pilotReservedUsd',n*1.5);
    context := jsonb_build_object('engine','radar_api_v1','model','gpt-5-mini');
    if n<>2 then usage := usage || jsonb_build_object('calls',calls,'inputTokens',input_count,'outputTokens',output_count,'webSearchCalls',webs,'responseIds',jsonb_build_array('resp_'||n),'estimatedUsd',input_count*0.25/1000000+output_count*2.0/1000000+webs*0.01); end if;
    if n=1 then context := context || '{"phase":"research_response_received"}'::jsonb;
    else context := context || jsonb_build_object('n8nIssuedCall',calls,'n8nExecutionId','history-'||n);
      if calls>0 then
        responses := case when n=6 then jsonb_build_array(pg_temp.provider_response('resp_6a',16000,1500,1),pg_temp.provider_response('resp_6b',16450,1573,2)) else jsonb_build_array(pg_temp.provider_response('resp_'||n,input_count,output_count,webs)) end;
        context := context || jsonb_build_object('n8nState',jsonb_build_object('responses',responses));
      end if;
    end if;
    insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_usage,created_at,started_at)
    values(run_id,'nexops','a1000000-0000-0000-0000-000000000001',run_id,'review','failed',context,usage,'2020-01-01','2020-01-01');
  end loop;
end $$;
create temp table legacy_budget_snapshot as select id,api_usage,api_context,status from public.radar_runs;
-- APPLY RECONCILED MIGRATION HERE
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9 from private.radar_api_pilot_usage),'legacy ledger remains six/USD9');
select pg_temp.assert_true(not exists(select id,api_usage,api_context,status from public.radar_runs except select * from legacy_budget_snapshot),'historical telemetry and states byte-for-byte JSONB preserved');
select pg_temp.assert_true((select count(*)=6 and sum(original_reserved_usd)=9 and sum(spent_usd)=0.112158 and sum(held_usd)=0 and sum(released_usd)=8.887842 from private.radar_budget_entries),'six reserves reconcile from evidence without hardcoded spend');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'availableUsd'='4.88784200','USD5 less observed cost is available');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'remainingRuns'='1','money does not authorize additional runs');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.radar_budget_entries','SELECT') and not has_table_privilege('service_role','private.radar_budget_entries','UPDATE'),'budget tables have no direct API permissions');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('private.radar_budget_accounts'::regclass,'private.radar_budget_entries'::regclass,'private.radar_budget_audit'::regclass)),'private budget RLS enabled');
do $$ begin update private.radar_api_pilot_usage set reserved_runs=0; raise exception 'ASSERTION FAILED: legacy ledger thawed'; exception when sqlstate '55000' then null; end $$;
create function pg_temp.new_budget_run(n integer,workspace text default 'nexops') returns uuid language plpgsql as $$ declare id uuid:=('a2000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid; begin
 insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
 values(id,workspace,'a1000000-0000-0000-0000-000000000001',id,'review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds'); return id; end $$;
create function pg_temp.reserve_budget(n integer,workspace text default 'nexops') returns uuid language plpgsql as $$ declare id uuid; begin
 id:=pg_temp.new_budget_run(n,workspace); perform public.reserve_radar_api_run(id,'{"model":"gpt-5-mini","n8nIssuedCall":0,"n8nExecutionId":"new-run"}',6); return id; end $$;
-- An aborted/pre-provider run releases only its hold, never its one-run authorization.
savepoint pre_provider;
select pg_temp.reserve_budget(1);
select pg_temp.assert_true((select held_usd=1.5 and spent_usd=0 from private.radar_budget_entries where not legacy),'start holds USD1.50');
select pg_temp.assert_true((select api_usage->>'budgetVersion'='2' and api_usage->>'budgetEntryId'=id::text from public.radar_runs where id='a2000000-0000-0000-0000-000000000001'),'new reservation has durable entry proof');
select pg_temp.assert_true((public.reserve_radar_api_run('a2000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',6)).id is null,'duplicate reserve idempotent');
update public.radar_runs set status='failed' where id='a2000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select spent_usd=0 and held_usd=0 and released_usd=1.5 from private.radar_budget_entries where not legacy),'explicit issued0 proves pre-provider zero');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='run_limit','released dollars do not grant another run');
select pg_temp.new_budget_run(2,'nexops-api-pilot');
do $$ begin perform public.reserve_radar_api_run('a2000000-0000-0000-0000-000000000002','{"model":"gpt-5-mini","n8nIssuedCall":0}',6); raise exception 'ASSERTION FAILED: second new run accepted'; exception when sqlstate '55000' then if sqlerrm<>'Límite de corridas autorizadas del piloto alcanzado.' then raise; end if; end $$;
select pg_temp.assert_true((select new_runs_reserved=1 from private.radar_budget_accounts) and (select count(*)=7 from private.radar_budget_entries),'concurrent/stale second claim leaves one new entry');
rollback to pre_provider;
-- Contradictory zero-call telemetry is uncertainty, not permission to release.
savepoint contradictory_zero;
select pg_temp.reserve_budget(6);
update public.radar_runs set status='failed',api_context=api_context||'{"n8nState":{"responses":[]}}'::jsonb,api_usage=api_usage||'{"calls":1,"inputTokens":100}'::jsonb where id='a2000000-0000-0000-0000-000000000006';
select pg_temp.assert_true((select held_usd=1.5 and released_usd=0 from private.radar_budget_entries where not legacy),'issued0 with contradictory measured call never releases hold');
rollback to contradictory_zero;
-- Complete running telemetry still holds room for the next authorized editorial call.
savepoint completed_success;
select pg_temp.reserve_budget(7);
update public.radar_runs set api_context=api_context||jsonb_build_object('n8nIssuedCall',1,'n8nState',jsonb_build_object('responses',jsonb_build_array(pg_temp.provider_response('success-response',1000,200,1)))),api_usage=api_usage||'{"calls":1,"inputTokens":1000,"outputTokens":200,"webSearchCalls":1,"telemetryVersion":2,"telemetryComplete":true}'::jsonb where id='a2000000-0000-0000-0000-000000000007';
select pg_temp.assert_true((select spent_usd=0.01065 and held_usd=1.48935 from private.radar_budget_entries where not legacy),'running complete response preserves the remaining hold');
select public.finish_radar_api_run('a2000000-0000-0000-0000-000000000007','no_publication',null,'No opportunity offline fixture','{}');
select pg_temp.assert_true((select spent_usd=0.01065 and held_usd=0 and released_usd=1.48935 from private.radar_budget_entries where not legacy),'normal terminal callback settles observed cost');
rollback to completed_success;
-- A timeout after issued call with no telemetry keeps uncertainty, then late usage settles without reopening.
savepoint late_usage;
select pg_temp.reserve_budget(3);
update public.radar_runs set api_context=api_context||'{"n8nIssuedCall":1}'::jsonb,status='failed',error_code='API_TIMEOUT' where id='a2000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select held_usd=1.5 and released_usd=0 from private.radar_budget_entries where not legacy),'timeout with unknown provider usage keeps full hold');
update public.radar_runs set api_context=api_context||jsonb_build_object('n8nState',jsonb_build_object('responses',jsonb_build_array(pg_temp.provider_response('late-response',1000,200,1)))),api_usage=api_usage||'{"calls":1,"inputTokens":1000,"outputTokens":200,"webSearchCalls":1,"telemetryVersion":2,"telemetryComplete":true}'::jsonb where id='a2000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select spent_usd=0.01065 and held_usd=0 and released_usd=1.48935 from private.radar_budget_entries where not legacy),'late measured response reconciles actual derived cost');
select pg_temp.assert_true((select status='failed' and error_code='API_TIMEOUT' from public.radar_runs where id='a2000000-0000-0000-0000-000000000003'),'late cost never reopens editorial status');
create temp table audit_after_late as select count(*) n from private.radar_budget_audit;
update public.radar_runs set api_usage=api_usage where id='a2000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select count(*) from private.radar_budget_audit)=(select n from audit_after_late),'duplicate callback produces no duplicate ledger/audit charge');
rollback to late_usage;
-- While running, measured cost plus remaining hold still covers a possible next call.
savepoint partial_usage;
select pg_temp.reserve_budget(4);
update public.radar_runs set api_context=api_context||jsonb_build_object('n8nIssuedCall',2,'n8nState',jsonb_build_object('responses',jsonb_build_array(pg_temp.provider_response('partial-response',1000,200,1)))),api_usage=api_usage||'{"calls":1,"inputTokens":1000,"outputTokens":200,"webSearchCalls":1,"telemetryVersion":2,"telemetryComplete":true}'::jsonb where id='a2000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select spent_usd=0.01065 and held_usd=1.48935 and released_usd=0 from private.radar_budget_entries where not legacy),'partial known spend plus hold remains USD1.50');
update public.radar_runs set status='canceled' where id='a2000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select held_usd=1.48935 from private.radar_budget_entries where not legacy),'missing second response remains held after cancellation');
update public.radar_runs set api_context=api_context||jsonb_build_object('n8nState',jsonb_build_object('responses',jsonb_build_array(pg_temp.provider_response('partial-response',1000,200,1),pg_temp.provider_response('second-response',1000,200,1)))),api_usage=api_usage||'{"calls":2,"inputTokens":2000,"outputTokens":400,"webSearchCalls":2,"telemetryVersion":2,"telemetryComplete":true}'::jsonb where id='a2000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select spent_usd=0.0213 and held_usd=0 from private.radar_budget_entries where not legacy),'all issued responses settle cancellation safely');
rollback to partial_usage;
-- Even ample run permission never bypasses insufficient monetary capacity.
savepoint monetary_cap;
update private.radar_budget_entries set spent_usd=4.0,held_usd=0,released_usd=0 where run_id='fb783cc0-29cc-4f69-b64d-cdc723de1b66';
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='budget_exhausted','actual spend cap independent of run count');
select pg_temp.new_budget_run(5);
do $$ begin perform public.reserve_radar_api_run('a2000000-0000-0000-0000-000000000005','{"model":"gpt-5-mini"}',6); raise exception 'ASSERTION FAILED: monetary cap bypassed'; exception when sqlstate '55000' then if sqlerrm<>'Límite persistente del piloto API alcanzado.' then raise; end if; end $$;
rollback to monetary_cap;
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9 from private.radar_api_pilot_usage),'all v2 paths leave legacy ledger frozen');
rollback;
