-- Isolated PGlite fixture, never executed against production.
begin;
create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(condition,false) then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,email) values ('71000000-0000-0000-0000-000000000001','nine@test.invalid');
insert into public.users(id,name,email,role,status) values ('71000000-0000-0000-0000-000000000001','Test','nine@test.invalid','platform_admin','active');
insert into public.radar_control_settings(workspace_id,enabled,preferences) values ('api-nine',true,'{"publishingMode":"review"}');
update private.radar_api_pilot_usage set reserved_runs=4,reserved_usd=6.00;
-- APPLY EXTENSION HERE
select pg_temp.assert_true((select reserved_runs=4 and reserved_usd=6.00 from private.radar_api_pilot_usage),'migration preserves all four historical reservations');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'authenticated denied');
select pg_temp.assert_true(not has_function_privilege('anon','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'anon denied');
select pg_temp.assert_true(has_function_privilege('service_role','public.reserve_radar_api_run(uuid,jsonb,integer)','EXECUTE'),'service ACL retained');
do $$ declare run_id uuid; i integer; begin
  for i in 1..2 loop
    run_id := ('72000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
    insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
    values (run_id,'api-nine','71000000-0000-0000-0000-000000000001',run_id,'review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
    perform public.reserve_radar_api_run(run_id,'{"model":"gpt-5-mini"}',6);
    perform pg_temp.assert_true((select reserved_runs=4+i and reserved_usd=6.00+1.50*i from private.radar_api_pilot_usage),'each new reservation adds exactly 1.50');
    perform public.reserve_radar_api_run(run_id,'{"model":"gpt-5-mini"}',6);
    perform public.cancel_radar_api_run(run_id,'api-nine');
    perform pg_temp.assert_true((select reserved_runs=4+i and reserved_usd=6.00+1.50*i from private.radar_api_pilot_usage),'idempotency and cancellation never refund');
  end loop;
end $$;
insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,api_context,api_deadline_at)
values ('72000000-0000-0000-0000-000000000003','api-nine','71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000003','review','dispatching','{"engine":"radar_api_v1"}',clock_timestamp()+interval '240 seconds');
do $$ begin
  perform public.reserve_radar_api_run('72000000-0000-0000-0000-000000000003','{"model":"gpt-5-mini"}',10);
  raise exception 'ASSERTION FAILED: seventh reservation accepted';
exception when sqlstate '55000' then null; end $$;
do $$ begin
  update private.radar_api_pilot_usage set reserved_usd=9.01;
  raise exception 'ASSERTION FAILED: constraint accepted over cap';
exception when check_violation then null; end $$;
select pg_temp.assert_true((select reserved_runs=6 and reserved_usd=9.00 from private.radar_api_pilot_usage),'two additional runs only, failed attempts do not mutate history');
rollback;
