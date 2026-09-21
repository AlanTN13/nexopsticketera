-- Disposable PGlite only: historical ledger fixture is not a production refund.
begin;
create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(condition,false) then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,email) values ('61000000-0000-0000-0000-000000000001','extension@test.invalid');
insert into public.users(id,name,email,role,status) values ('61000000-0000-0000-0000-000000000001','Test','extension@test.invalid','platform_admin','active');
insert into public.radar_control_settings(workspace_id,enabled,preferences) values ('api-extension',true,'{"publishingMode":"review"}');
update private.radar_api_pilot_usage set reserved_runs=3,reserved_usd=4.50;
-- APPLY EXTENSION HERE
select pg_temp.assert_true((select reserved_runs=3 and reserved_usd=4.50 from private.radar_api_pilot_usage),'migration preserves historical ledger');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'ACL retained');
select pg_temp.assert_true(not has_function_privilege('anon','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'anon denied');
select pg_temp.assert_true(has_function_privilege('service_role','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'service ACL retained');
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
select ('62000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'api-extension','61000000-0000-0000-0000-000000000001',('62000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds' from generate_series(1,1) i;
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',4);
select pg_temp.assert_true((select reserved_runs=4 and reserved_usd=6.00 from private.radar_api_pilot_usage),'fourth reservation reaches exactly six');
select public.reserve_radar_api_run('62000000-0000-0000-0000-000000000001','{"model":"gpt-5-mini"}',4);
select public.cancel_radar_api_run('62000000-0000-0000-0000-000000000001','api-extension');
select pg_temp.assert_true((select reserved_runs=4 and reserved_usd=6.00 from private.radar_api_pilot_usage),'duplicate and cancellation do not refund');
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
values ('62000000-0000-0000-0000-000000000002','api-extension','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
do $$ begin
 perform public.reserve_radar_api_run('62000000-0000-0000-0000-000000000002','{"model":"gpt-5-mini"}',10);
 raise exception 'ASSERTION FAILED: fifth reserve accepted';
exception when sqlstate '55000' then null; end $$;
do $$ begin
 update private.radar_api_pilot_usage set reserved_usd=6.01;
 raise exception 'ASSERTION FAILED: constraint accepted over cap';
exception when check_violation then null; end $$;
select pg_temp.assert_true((select reserved_runs=4 and reserved_usd=6.00 from private.radar_api_pilot_usage),'failed attempts preserve ledger');
rollback;
