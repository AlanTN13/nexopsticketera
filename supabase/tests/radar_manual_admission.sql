-- Isolated PGlite only; transaction/legacy setup from radar_reconciled_budget.sql.
update private.radar_budget_accounts set new_runs_reserved=1;
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='run_limit','consumed agent quota blocks before correction');
create temp table manual_before as select md5(jsonb_agg(to_jsonb(e) order by run_id)::text) digest from private.radar_budget_entries e;
-- APPLY MANUAL MIGRATION HERE
select pg_temp.assert_true((select new_runs_reserved=1 and authorized_new_runs is null and cap_usd=5 and hold_per_run_usd=1.5 from private.radar_budget_accounts),'remove lifetime cap without resetting history or money controls');
select pg_temp.assert_true((select md5(jsonb_agg(to_jsonb(e) order by run_id)::text) from private.radar_budget_entries e)=(select digest from manual_before),'migration leaves entries byte-identical');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'remainingRuns'='6','manual capacity uses configured daily frequency');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='available','manual admission allowed');
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
values('c2000000-0000-0000-0000-000000000001','nexops','a1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
select public.reserve_radar_api_run('c2000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini","n8nIssuedCall":0}',6);
select pg_temp.assert_true((select new_runs_reserved=2 from private.radar_budget_accounts),'counter grows beyond agent run, never reset');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='active_run','concurrency still enforced');
select pg_temp.assert_true((public.reserve_radar_api_run('c2000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',6)).id is null,'duplicate does not reserve twice');
update public.radar_runs set status='failed' where id='c2000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.get_radar_admission('nexops',1)->>'code'='run_limit','daily limit still enforced after zero-cost failure');
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'remainingRuns'='5','manual next attempt keeps remaining daily capacity');
update private.radar_budget_entries set spent_usd=4,held_usd=0,released_usd=0 where run_id='fb783cc0-29cc-4f69-b64d-cdc723de1b66';
select pg_temp.assert_true(public.get_radar_admission('nexops',6)->>'code'='budget_exhausted','manual use cannot bypass USD5 with USD1.50 hold');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'reserve remains server-only');
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9 from private.radar_api_pilot_usage),'legacy unchanged');
rollback;
