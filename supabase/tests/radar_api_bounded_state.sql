-- Execute against a disposable migrated database. All fixture writes roll back.
begin;
create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'ASSERTION FAILED: %', message; end if;
end $$;

insert into auth.users(id,email) values ('61000000-0000-0000-0000-000000000001','radar-api@test.invalid');
insert into public.users(id,company_id,name,email,role,status)
values ('61000000-0000-0000-0000-000000000001',null,'API test','radar-api@test.invalid','platform_admin','active');
select set_config('request.jwt.claims','{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into public.radar_control_settings(workspace_id,enabled,preferences)
values ('api-test-a',true,'{"topics":["Authoritative"],"publishingMode":"review"}'), ('api-test-b',true,'{}'), ('api-test-legacy',true,'{}');
update private.radar_api_pilot_usage set reserved_runs = 0, reserved_usd = 0;

create or replace function pg_temp.new_api_run(workspace text, run_number integer)
returns uuid language plpgsql as $$
declare run_id uuid := ('62000000-0000-0000-0000-' || lpad(run_number::text,12,'0'))::uuid;
begin
  insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
  values (run_id,workspace,'61000000-0000-0000-0000-000000000001',run_id,'review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
  return run_id;
end $$;

select pg_temp.new_api_run('api-test-a',1);
-- ACLs protect privileged endpoints and private lifetime usage.
select pg_temp.assert_true(not has_function_privilege('authenticated','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'authenticated cannot reserve');
select pg_temp.assert_true(not has_function_privilege('anon','public.finish_radar_api_run(uuid,text,jsonb,text,jsonb)','EXECUTE'),'anon cannot finish');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.cancel_radar_api_run(uuid,text)','EXECUTE'),'authenticated cannot directly cancel');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.radar_api_pilot_usage','SELECT'),'private usage is not exposed');
select pg_temp.assert_true(has_function_privilege('service_role','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'service can reserve');

do $$ begin
  perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',0);
  raise exception 'ASSERTION FAILED: zero budget accepted';
exception when sqlstate '22023' then null; end $$;
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini","preferences":{"topics":["Forged"]},"corpus":["captured"],"workspaceId":"forged"}',2);
select pg_temp.assert_true((select status='running' and api_context #>> '{preferences,topics,0}'='Authoritative' and api_context ->> 'workspaceId'='api-test-a' and api_context -> 'corpus'='["captured"]' from public.radar_runs where id='62000000-0000-0000-0000-000000000001'),'reservation captures authoritative settings and caller corpus');
select pg_temp.assert_true((public.reserve_radar_api_run('62000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',2)).id is null,'duplicate reservation returns null');
select pg_temp.assert_true((select reserved_runs=1 from private.radar_api_pilot_usage),'duplicate does not consume twice');

-- Old callback cannot race or replace API result.
do $$ begin
  perform public.record_radar_worker_result('62000000-0000-0000-0000-000000000001','running','no_publication','legacy callback',null,'legacy reason',null,null,'radar-62000000-0000-0000-0000-000000000001',repeat('a',64),repeat('b',64));
  raise exception 'ASSERTION FAILED: legacy callback changed API run';
exception when sqlstate '55000' then null; end $$;

-- Cancellation never refunds usage; late completion cannot resurrect it.
select pg_temp.assert_true(not public.cancel_radar_api_run('62000000-0000-0000-0000-000000000001','api-test-b'),'wrong workspace cannot cancel');
select pg_temp.assert_true(public.cancel_radar_api_run('62000000-0000-0000-0000-000000000001','api-test-a'),'cancel applies immediately');
select pg_temp.assert_true(not public.finish_radar_api_run('62000000-0000-0000-0000-000000000001','no_publication',null,'late result','{}'),'late canceled response ignored');
select pg_temp.assert_true((select status='canceled' from public.radar_runs where id='62000000-0000-0000-0000-000000000001'),'canceled stays terminal');

-- One global persistent budget covers different workspaces.
select pg_temp.new_api_run('api-test-b',2);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000002','{"model":"gpt-5-mini"}',2);
select pg_temp.new_api_run('api-test-a',3);
do $$ begin
  perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000003','{"model":"gpt-5-mini"}',2);
  raise exception 'ASSERTION FAILED: pilot exceeded lifetime cap';
exception when sqlstate '55000' then null; end $$;
select pg_temp.assert_true((select reserved_runs=2 from private.radar_api_pilot_usage),'budget is global and persistent after cancellation');

-- Both orphan dispatch and running timeout expire; historical legacy runs survive.
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status)
values ('62000000-0000-0000-0000-000000000004','api-test-legacy','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000004','review','dispatching');
update public.radar_runs set api_deadline_at=clock_timestamp()-interval '1 second' where id in ('62000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(public.expire_radar_api_runs()=2,'running and orphan dispatch expire');
select pg_temp.assert_true(public.expire_radar_api_runs()=0,'expiry is idempotent');
select pg_temp.assert_true((select status='dispatching' from public.radar_runs where id='62000000-0000-0000-0000-000000000004'),'legacy history unchanged');
select pg_temp.assert_true((select count(*)=2 from public.radar_run_events where event_type='api_expired'),'expiry events atomic and single');

-- Independent package fixtures start a fresh disposable pilot ledger.
update private.radar_api_pilot_usage set reserved_runs=0, reserved_usd=0;
-- Accepted candidate persists the complete editorial package and receipt.
select pg_temp.new_api_run('api-test-a',5);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000005','{"model":"gpt-5-mini"}',10);
create temporary table test_api_candidate as select '{"title":"Test title","topic":"IA","sourceName":"Official","sourceUrl":"https://example.org","score":88,"businessReasons":["Useful"],"topicFingerprint":"topic:regression","sources":[{"name":"Official","url":"https://example.org","evidence":"Verified"}],"qa":{"verdict":"PASS","reason":"Evidence verified"},"composition":{"title":"Exact"},"cover":{"pngBase64":"simulated-fixture","sha256":"simulated-fixture"}}'::jsonb as candidate;
select pg_temp.assert_true(public.finish_radar_api_run('62000000-0000-0000-0000-000000000005','review_pending',(select candidate from test_api_candidate),null,'{"requests":2}'),'PASS candidate accepted');
select pg_temp.assert_true((select candidate=(select candidate from test_api_candidate) and api_usage->>'requests'='2' from public.radar_runs where id='62000000-0000-0000-0000-000000000005'),'whole candidate and usage preserved');
select pg_temp.assert_true(not public.finish_radar_api_run('62000000-0000-0000-0000-000000000005','review_pending',(select candidate from test_api_candidate),null,'{}'),'completion cannot repeat');
update public.radar_runs set status='published' where id='62000000-0000-0000-0000-000000000005';
select pg_temp.new_api_run('api-test-a',6);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000006','{"model":"gpt-5-mini"}',10);
select public.finish_radar_api_run('62000000-0000-0000-0000-000000000006','review_pending',(select candidate from test_api_candidate),null,'{}');
select pg_temp.assert_true((select status='no_publication' and candidate is not null from public.radar_runs where id='62000000-0000-0000-0000-000000000006'),'duplicate topic becomes no_publication preserving proposal');

-- Late response without maintenance also materializes visible timeout atomically.
select pg_temp.new_api_run('api-test-a',7);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000007','{"model":"gpt-5-mini"}',10);
update public.radar_runs set api_deadline_at=clock_timestamp()-interval '1 second' where id='62000000-0000-0000-0000-000000000007';
select pg_temp.assert_true(not public.finish_radar_api_run('62000000-0000-0000-0000-000000000007','no_publication',null,'late','{}'),'expired finish rejected');
select pg_temp.assert_true((select status='failed' and error_code='API_TIMEOUT' from public.radar_runs where id='62000000-0000-0000-0000-000000000007'),'late response leaves visible terminal timeout');
select pg_temp.new_api_run('api-test-a',8);
do $$ begin
  perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000008','{"model":"gpt-5-mini"}',10);
  raise exception 'ASSERTION FAILED: USD 5 budget exceeded';
exception when sqlstate '55000' then null; end $$;
select pg_temp.assert_true((select reserved_runs=3 and reserved_usd=4.50 from private.radar_api_pilot_usage),'USD cap overrides larger run limit and never refunds');
select pg_temp.assert_true((select bool_and(not scheduler_enabled) from public.radar_control_settings where workspace_id like 'api-test-%'),'scheduler remains off');

-- Reject/disabled/model/pre-reservation failure guards use a new disposable ledger.
update private.radar_api_pilot_usage set reserved_runs=0,reserved_usd=0;
select public.cancel_radar_api_run('62000000-0000-0000-0000-000000000008','api-test-a');
select pg_temp.new_api_run('api-test-a',9);
do $$ begin
  perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000009','{"model":"gpt-6-astra"}',10);
  raise exception 'ASSERTION FAILED: unapproved model reserved';
exception when sqlstate '22023' then null; end $$;
update public.radar_control_settings set enabled=false where workspace_id='api-test-a';
do $$ begin
  perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000009','{"model":"gpt-5-mini"}',10);
  raise exception 'ASSERTION FAILED: disabled workspace reserved';
exception when sqlstate '55000' then null; end $$;
select pg_temp.assert_true(public.finish_radar_api_run('62000000-0000-0000-0000-000000000009','failed',null,'Configuration unavailable','{}'),'pre-reservation failures become terminal immediately');
select pg_temp.assert_true((select reserved_runs=0 and reserved_usd=0 from private.radar_api_pilot_usage),'failed preconditions do not reserve API use');
update public.radar_control_settings set enabled=true where workspace_id='api-test-a';
select pg_temp.new_api_run('api-test-a',10);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000010','{"model":"gpt-5-mini"}',10);
select pg_temp.assert_true(public.finish_radar_api_run('62000000-0000-0000-0000-000000000010','rejected',null,'Source evidence insufficient','{"requests":2}'),'editorial rejection is durable');
-- Restore prior ledger fixture so publication tests can assert no additional API use.
update private.radar_api_pilot_usage set reserved_runs=3,reserved_usd=4.50;

-- Publication failures preserve approved drafts and retry the exact package only.
select public.cancel_radar_api_run('62000000-0000-0000-0000-000000000008','api-test-a');
update public.radar_runs set status='approved' where id='62000000-0000-0000-0000-000000000005';
select public.request_manual_radar_publication('62000000-0000-0000-0000-000000000005','63000000-0000-0000-0000-000000000001',repeat('a',64),'{"approved":"exact"}');
select public.record_radar_publication_dispatch('62000000-0000-0000-0000-000000000005',repeat('a',64),101,'https://github.com/example/repo/pull/101',1);
select public.record_radar_publication_result('62000000-0000-0000-0000-000000000005',repeat('a',64),'radar-publication-62000000-0000-0000-0000-000000000005','failed',null,null,null,'Validation failed');
do $$ begin
  perform public.request_manual_radar_publication('62000000-0000-0000-0000-000000000005','63000000-0000-0000-0000-000000000002',repeat('a',64),'{"approved":"changed"}');
  raise exception 'ASSERTION FAILED: altered package retry allowed';
exception when sqlstate '55000' then null; end $$;
select public.request_manual_radar_publication('62000000-0000-0000-0000-000000000005','63000000-0000-0000-0000-000000000002',repeat('a',64),'{"approved":"exact"}');
select pg_temp.assert_true((select attempt=2 and status='reserved' and composition='{"approved":"exact"}' from public.radar_publication_jobs where run_id='62000000-0000-0000-0000-000000000005'),'retry preserves package and increments attempt');
do $$ begin
  perform public.record_radar_publication_dispatch('62000000-0000-0000-0000-000000000005',repeat('a',64),101,'https://github.com/example/repo/pull/101',1);
  raise exception 'ASSERTION FAILED: stale dispatch applied to new attempt';
exception when sqlstate '22023' then null; end $$;
select pg_temp.assert_true(not public.fail_radar_publication_dispatch('62000000-0000-0000-0000-000000000005',1,'Stale attempt failure'),'late failure cannot terminate newer publication attempt');
select public.record_radar_publication_dispatch('62000000-0000-0000-0000-000000000005',repeat('a',64),102,'https://github.com/example/repo/pull/102',2);
do $$ begin
  perform public.record_radar_publication_result('62000000-0000-0000-0000-000000000005',repeat('a',64),'radar-publication-62000000-0000-0000-0000-000000000005','failed',null,null,null,'Stale validation failure');
  raise exception 'ASSERTION FAILED: stale callback applied to new attempt';
exception when sqlstate '22023' then null; end $$;
select public.record_radar_publication_result('62000000-0000-0000-0000-000000000005',repeat('a',64),'radar-publication-62000000-0000-0000-0000-000000000005-attempt-2','failed',null,repeat('b',40),null,'Merge completed but live verification unavailable');
select pg_temp.assert_true((select status='failed' and merge_sha=repeat('b',40) and final_url is null from public.radar_publication_jobs where run_id='62000000-0000-0000-0000-000000000005'),'failed verification preserves merge evidence without false final URL');
select pg_temp.assert_true((select candidate=(select candidate from test_api_candidate) from public.radar_runs where id='62000000-0000-0000-0000-000000000005'),'publication failure preserves whole draft');
do $$ begin
  perform public.request_manual_radar_publication('62000000-0000-0000-0000-000000000005','63000000-0000-0000-0000-000000000003',repeat('a',64),'{"approved":"exact"}');
  raise exception 'ASSERTION FAILED: merged publication blindly retried';
exception when sqlstate '55000' then null; end $$;
select pg_temp.assert_true((select reserved_runs=3 and reserved_usd=4.50 from private.radar_api_pilot_usage),'publication retries never reserve research/API again');


-- A fresh publication dispatch failure is atomic and idempotent, preserving package.
update public.radar_runs set status='approved' where id='62000000-0000-0000-0000-000000000010';
-- Use existing full candidate for this independent dispatch fixture.
update public.radar_runs set candidate=(select candidate from test_api_candidate) where id='62000000-0000-0000-0000-000000000010';
select public.request_manual_radar_publication('62000000-0000-0000-0000-000000000010','63000000-0000-0000-0000-000000000004',repeat('c',64),'{"approved":"dispatch fixture"}');
select pg_temp.assert_true(public.fail_radar_publication_dispatch('62000000-0000-0000-0000-000000000010',1,'Simulated dispatch ambiguity'),'current dispatch failure applies');
select pg_temp.assert_true(not public.fail_radar_publication_dispatch('62000000-0000-0000-0000-000000000010',1,'Same error'),'dispatch failure applies once');
select pg_temp.assert_true((select run.status='failed' and job.status='failed' and run.candidate is not null and job.composition='{"approved":"dispatch fixture"}' from public.radar_runs run join public.radar_publication_jobs job on job.run_id=run.id where run.id='62000000-0000-0000-0000-000000000010'),'job and run fail together preserving package');
select pg_temp.assert_true((select count(*)=1 from public.radar_run_events where run_id='62000000-0000-0000-0000-000000000010' and event_type='manual_publication_dispatch_failed'),'dispatch failure event recorded once');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.fail_radar_publication_dispatch(uuid,integer,text)','EXECUTE'),'authenticated cannot directly fail publication dispatch');

-- Accepted topics remain protected after failed publication or later run failure.
update private.radar_api_pilot_usage set reserved_runs=0,reserved_usd=0;
select pg_temp.new_api_run('api-test-a',11);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000011','{"model":"gpt-5-mini"}',10);
select public.finish_radar_api_run('62000000-0000-0000-0000-000000000011','review_pending',(select candidate from test_api_candidate),null,'{}');
select pg_temp.assert_true((select status='no_publication' from public.radar_runs where id='62000000-0000-0000-0000-000000000011'),'failed publication job still prevents duplicate topic');
update public.radar_runs set candidate=jsonb_set((select candidate from test_api_candidate),'{topicFingerprint}','"topic:prior-approval"')
where id='62000000-0000-0000-0000-000000000002';
insert into public.radar_run_decisions(run_id,workspace_id,actor_user_id,idempotency_key,decision)
values ('62000000-0000-0000-0000-000000000002','api-test-b','61000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','approve');
select pg_temp.new_api_run('api-test-b',12);
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000012','{"model":"gpt-5-mini"}',10);
select public.finish_radar_api_run('62000000-0000-0000-0000-000000000012','review_pending',jsonb_set((select candidate from test_api_candidate),'{topicFingerprint}','"topic:prior-approval"'),null,'{}');
select pg_temp.assert_true((select status='no_publication' from public.radar_runs where id='62000000-0000-0000-0000-000000000012'),'failed previously approved run still prevents duplicate topic');

-- Internal workspaces have no company; only active platform admins pass access.
select pg_temp.assert_true(private.radar_workspace_has_access('api-test-a','admin'),'active platform admin can operate internal workspace');
select set_config('request.jwt.claims','{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true(not private.radar_workspace_has_access('api-test-a','view'),'ordinary or unknown user cannot view internal workspace');
select set_config('request.jwt.claims','{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
rollback;
