-- Offline-only fixtures. Never apply this test file to a live project.
begin;
create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(condition,false) then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,email) values ('81000000-0000-0000-0000-000000000001','admission@test.invalid');
insert into public.users(id,name,email,role,status) values ('81000000-0000-0000-0000-000000000001','Test','admission@test.invalid','platform_admin','active');
insert into public.radar_control_settings(workspace_id,enabled,preferences)
values ('admission-one',true,'{"publishingMode":"review"}'),('admission-two',true,'{"publishingMode":"review"}');
select pg_temp.assert_true(not has_function_privilege('anon','public.get_radar_admission(text,integer,uuid)','EXECUTE'),'anon cannot read private ledger');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.get_radar_admission(text,integer,uuid)','EXECUTE'),'authenticated cannot bypass application workspace authorization');
select pg_temp.assert_true(has_function_privilege('service_role','public.get_radar_admission(text,integer,uuid)','EXECUTE'),'service role can read admission');
select pg_temp.assert_true((select provolatile='s' and prosecdef and proconfig=array['search_path=""']::text[] from pg_proc where oid='public.get_radar_admission(text,integer,uuid)'::regprocedure),'read-only stable, fixed search path');
set local role anon;
do $$ begin
  perform public.get_radar_admission('admission-one',6);
  raise exception 'ASSERTION FAILED: anon accessed admission';
exception when insufficient_privilege then null; end $$;
reset role;
set local role authenticated;
do $$ begin
  perform public.get_radar_admission('admission-one',6);
  raise exception 'ASSERTION FAILED: authenticated accessed admission';
exception when insufficient_privilege then null; end $$;
reset role;

-- A fully consumed pilot reports exhaustion without creating or reserving anything.
update private.radar_api_pilot_usage set reserved_runs=6,reserved_usd=9;
select pg_temp.assert_true(public.get_radar_admission('admission-one',6) = '{"allowed":false,"code":"budget_exhausted","reservedUsd":9,"maxUsd":9,"remainingRuns":0}'::jsonb,'exhausted pilot is explicit');
select pg_temp.assert_true((select count(*)=0 from public.radar_runs where workspace_id like 'admission-%'),'availability read creates zero rows');
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9 from private.radar_api_pilot_usage),'availability read never refunds or resets ledger');
select pg_temp.assert_true(public.get_radar_admission('unknown-workspace',6)->>'code'='disabled','unknown workspace is unavailable');
select pg_temp.assert_true(public.get_radar_admission('admission-one',0)->>'code'='unavailable','invalid configured cap fails closed');

-- Stale admission: two clients see the final slot before either claim. The actual
-- lock-based reserve still accepts only one. PGlite runs statements serially;
-- this verifies stale-read/final-guard behavior, not multi-session lock timing.
update private.radar_api_pilot_usage set reserved_runs=5,reserved_usd=7.5;
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status)
values ('83000000-0000-0000-0000-000000000001','admission-one','81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','review','queued');
select pg_temp.assert_true(public.get_radar_admission('admission-one',6)->>'code'='active_run','ordinary admission sees existing queued row');
select pg_temp.assert_true((public.get_radar_admission('admission-one',6,'83000000-0000-0000-0000-000000000001')->>'allowed')::boolean,'retry ignores only own queued row');
select pg_temp.assert_true(public.get_radar_admission('admission-two',6,'83000000-0000-0000-0000-000000000001')->>'code'='unavailable','retry cannot exclude another workspace row');
select pg_temp.assert_true(public.get_radar_admission('admission-one',6,'83000000-0000-0000-0000-000000000099')->>'code'='unavailable','retry cannot invent a row');
select pg_temp.assert_true(public.get_radar_admission('admission-one',5,'83000000-0000-0000-0000-000000000001')->>'code'='budget_exhausted','queued retry never bypasses budget');
update public.radar_runs set status='dispatching' where id='83000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.get_radar_admission('admission-one',6,'83000000-0000-0000-0000-000000000001')->>'code'='unavailable','retry cannot exclude a dispatched row');
update public.radar_runs set status='canceled' where id='83000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.assert_true((public.get_radar_admission('admission-one',6)->>'allowed')::boolean,'first caller sees last slot');
select pg_temp.assert_true((public.get_radar_admission('admission-two',6)->>'allowed')::boolean,'second caller sees same last slot');
reset role;
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
values ('82000000-0000-0000-0000-000000000001','admission-one','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds'),
('82000000-0000-0000-0000-000000000002','admission-two','81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
select pg_temp.assert_true(public.get_radar_admission('admission-one',6)->>'code'='active_run','active work blocks a second request');
select public.reserve_radar_api_run('82000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',6);
select pg_temp.assert_true(public.reserve_radar_api_run('82000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',6) is null,'duplicate claim idempotent');
do $$ begin
  perform public.reserve_radar_api_run('82000000-0000-0000-0000-000000000002','{"model":"gpt-5-mini"}',6);
  raise exception 'ASSERTION FAILED: stale admission overspent final slot';
exception when sqlstate '55000' then
  if sqlerrm <> 'Límite persistente del piloto API alcanzado.' then raise; end if;
end $$;
select pg_temp.assert_true(public.finish_radar_api_run('82000000-0000-0000-0000-000000000002','failed',null,'El presupuesto autorizado del piloto está agotado. No se inició la investigación ni se llamó a OpenAI.','{}'),'budget loser closes immediately through existing finalization');
select pg_temp.assert_true((select status='failed' and result_reason like 'El presupuesto autorizado%' and api_usage='{}'::jsonb from public.radar_runs where id='82000000-0000-0000-0000-000000000002'),'specific failure persisted with zero usage');
select pg_temp.assert_true(public.expire_radar_api_runs()=0,'known failed outcome does not become timeout');
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9 from private.radar_api_pilot_usage),'only one final reservation, never refund');
select pg_temp.assert_true((select count(*)=1 from public.radar_run_events where run_id='82000000-0000-0000-0000-000000000002' and event_type='api_failed'),'terminal event exists');

update public.radar_control_settings set scheduler_enabled=true where workspace_id='admission-one';
select pg_temp.assert_true(public.get_radar_admission('admission-one',6)->>'code'='disabled','scheduler is not admitted');
update public.radar_control_settings set enabled=false where workspace_id='admission-two';
select pg_temp.assert_true(public.get_radar_admission('admission-two',6)->>'code'='disabled','disabled settings are not admitted');
update public.radar_control_settings set scheduler_enabled=false,preferences='{"publishingMode":"automatic"}' where workspace_id='admission-one';
select pg_temp.assert_true(public.get_radar_admission('admission-one',6)->>'code'='disabled','autopublication settings are not admitted');
update public.radar_control_settings set preferences='{"publishingMode":"review"}' where workspace_id='admission-one';
delete from private.radar_api_pilot_usage;
select pg_temp.assert_true(public.get_radar_admission('admission-one',6)->>'code'='unavailable','missing ledger fails closed instead of treating it as zero usage');
rollback;
