-- Disposable offline SQL verification only; all fixture writes roll back.
begin;
create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(condition,false) then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,email) values ('91000000-0000-0000-0000-000000000001','decisions@test.invalid'),('91000000-0000-0000-0000-000000000002','outside@test.invalid');
insert into public.users(id,name,email,role,status) values
('91000000-0000-0000-0000-000000000001','Test','decisions@test.invalid','platform_admin','active'),
('91000000-0000-0000-0000-000000000002','Outside','outside@test.invalid','client_user','active');
insert into public.radar_control_settings(workspace_id,enabled) values ('postponed-test',true);
create function pg_temp.postponed_run(run_number integer) returns uuid language plpgsql as $$
declare run_id uuid := ('92000000-0000-0000-0000-'||lpad(run_number::text,12,'0'))::uuid;
begin
  insert into public.radar_runs(id,workspace_id,requested_by,idempotency_key,autonomy_mode,status,candidate,api_context)
  values (run_id,'postponed-test','91000000-0000-0000-0000-000000000001',run_id,'review','postponed',
    '{"title":"Qualified offline fixture","topic":"Test","sourceName":"Source","sourceUrl":"https://example.com/news","score":99,"businessReasons":["evidence"],"qa":{"verdict":"PASS"}}',
    '{"engine":"radar_api_v1","decision":{"eligibility":"ELIGIBLE"}}');
  return run_id;
end $$;
-- Test-only privileged read captures precisely the persisted candidate for CAS.
create function pg_temp.candidate_for_preview(run_id uuid) returns jsonb
language sql security definer set search_path = '' as $$ select candidate from public.radar_runs where id=run_id $$;
select pg_temp.postponed_run(1);
select pg_temp.postponed_run(2);
select pg_temp.postponed_run(3);
select pg_temp.postponed_run(4);
select pg_temp.assert_true(not has_function_privilege('anon','public.decide_radar_run(uuid,uuid,text,text)','EXECUTE'),'anonymous decisions remain denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.decide_radar_run(uuid,uuid,text,text)','EXECUTE'),'old RPC cannot bypass signed preview');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.decide_radar_run_authorized(uuid,uuid,text,uuid,text,jsonb)','EXECUTE'),'new RPC requires server authorization');
select pg_temp.assert_true(has_function_privilege('service_role','public.decide_radar_run_authorized(uuid,uuid,text,uuid,text,jsonb)','EXECUTE'),'service role can deliver authorized decision');
set local role authenticated;
do $$ begin
  perform public.decide_radar_run('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','approve');
  raise exception 'ASSERTION FAILED: direct old RPC bypassed server preview gate';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','approve','91000000-0000-0000-0000-000000000001',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000001'));
  raise exception 'ASSERTION FAILED: direct new RPC forged actor';
exception when insufficient_privilege then null; end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role service_role;
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','approve','91000000-0000-0000-0000-000000000002',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000001'));
  raise exception 'ASSERTION FAILED: unauthorized actor approved postponed run';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role service_role;
select pg_temp.assert_true((public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','approve','91000000-0000-0000-0000-000000000001',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000001'))).status='approved','postponed eligible piece can be approved');
select pg_temp.assert_true((public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','approve','91000000-0000-0000-0000-000000000001')).status='approved','approval retry remains idempotent');
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','discard','91000000-0000-0000-0000-000000000001');
  raise exception 'ASSERTION FAILED: decision key was repurposed';
exception when invalid_parameter_value then null; end $$;
select pg_temp.assert_true((public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000002','discard','91000000-0000-0000-0000-000000000001')).status='rejected','postponed piece can be discarded');
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000003','approve','91000000-0000-0000-0000-000000000001',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000003'));
  raise exception 'ASSERTION FAILED: approval ignored another active piece';
exception when unique_violation then null; end $$;
reset role;
select pg_temp.assert_true((select status='postponed' from public.radar_runs where id='92000000-0000-0000-0000-000000000003'),'active conflict preserves postponed piece');
select pg_temp.assert_true((select count(*)=0 from public.radar_run_decisions where run_id='92000000-0000-0000-0000-000000000003'),'failed conflict decision rolled back atomically');
update public.radar_runs set candidate=jsonb_set(candidate,'{qa,verdict}','"REJECT"') where id='92000000-0000-0000-0000-000000000004';
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000004','93000000-0000-0000-0000-000000000004','approve','91000000-0000-0000-0000-000000000001',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000004'));
  raise exception 'ASSERTION FAILED: high score bypassed failed QA';
exception when sqlstate '55000' then
  if sqlerrm <> 'La pieza no superó QA y elegibilidad.' then raise; end if;
end $$;
update public.radar_runs set candidate=jsonb_set(candidate,'{qa,verdict}','"PASS"'),api_context='{"engine":"radar_api_v1","decision":{"eligibility":"INELIGIBLE"}}' where id='92000000-0000-0000-0000-000000000004';
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000004','93000000-0000-0000-0000-000000000004','approve','91000000-0000-0000-0000-000000000001',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000004'));
  raise exception 'ASSERTION FAILED: PASS bypassed failed eligibility';
exception when sqlstate '55000' then
  if sqlerrm <> 'La pieza no superó QA y elegibilidad.' then raise; end if;
end $$;
select pg_temp.assert_true((public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000004','93000000-0000-0000-0000-000000000004','discard','91000000-0000-0000-0000-000000000001')).status='rejected','ineligible postponed piece can still be discarded');
select pg_temp.assert_true((select count(*)=1 from public.radar_run_decisions where run_id='92000000-0000-0000-0000-000000000001'),'idempotent approval records exactly one decision');
select pg_temp.assert_true((select actor_user_id='91000000-0000-0000-0000-000000000001' from public.radar_run_decisions where run_id='92000000-0000-0000-0000-000000000001'),'explicit authenticated actor is persisted without relying on service JWT sub');
-- Capture A, change the persisted candidate to B, then submit approval of A.
select pg_temp.postponed_run(7);
do $$ declare previewed jsonb; begin
  previewed := pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000007');
  update public.radar_runs set candidate=jsonb_set(candidate,'{title}','"Changed after preview"')
  where id='92000000-0000-0000-0000-000000000007';
  begin
    perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000007','93000000-0000-0000-0000-000000000007','approve','91000000-0000-0000-0000-000000000001',null,previewed);
    raise exception 'ASSERTION FAILED: stale preview approved changed candidate';
  exception when sqlstate '55000' then
    if sqlerrm <> 'La pieza cambió desde la revisión. Abrí nuevamente la preview antes de aprobar.' then raise; end if;
  end;
end $$;
select pg_temp.assert_true((select status='postponed' and candidate->>'title'='Changed after preview' from public.radar_runs where id='92000000-0000-0000-0000-000000000007'),'stale approval preserves current candidate and state');
select pg_temp.assert_true((select count(*)=0 from public.radar_run_decisions where run_id='92000000-0000-0000-0000-000000000007'),'stale approval records no decision');
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000007','93000000-0000-0000-0000-000000000007','approve','91000000-0000-0000-0000-000000000001');
  raise exception 'ASSERTION FAILED: omitted expected candidate bypassed CAS';
exception when sqlstate '55000' then
  if sqlerrm <> 'La pieza cambió desde la revisión. Abrí nuevamente la preview antes de aprobar.' then raise; end if;
end $$;


-- Reuse the real actor-aware access helper against isolated company fixtures.
insert into public.companies(id) values ('94000000-0000-0000-0000-000000000001'),('94000000-0000-0000-0000-000000000002');
insert into public.portal_modules(key,active) values ('radar',true);
insert into public.company_modules(company_id,module,enabled) values ('94000000-0000-0000-0000-000000000001','radar',true),('94000000-0000-0000-0000-000000000002','radar',true);
update public.users set company_id='94000000-0000-0000-0000-000000000001' where id='91000000-0000-0000-0000-000000000002';
insert into public.user_module_permissions(user_id,company_id,module,access_level)
values ('91000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000001','radar','operate');
insert into public.radar_control_settings(workspace_id,company_id,enabled)
values ('decision-company-one','94000000-0000-0000-0000-000000000001',true),('decision-company-two','94000000-0000-0000-0000-000000000002',true);
select pg_temp.postponed_run(5);
select pg_temp.postponed_run(6);
update public.radar_runs set workspace_id='decision-company-one',company_id='94000000-0000-0000-0000-000000000001' where id='92000000-0000-0000-0000-000000000005';
update public.radar_runs set workspace_id='decision-company-two',company_id='94000000-0000-0000-0000-000000000002' where id='92000000-0000-0000-0000-000000000006';
set local role service_role;
select pg_temp.assert_true((public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000005','93000000-0000-0000-0000-000000000005','approve','91000000-0000-0000-0000-000000000002',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000005'))).status='approved','authorized company operator retains access');
do $$ begin
  perform public.decide_radar_run_authorized('92000000-0000-0000-0000-000000000006','93000000-0000-0000-0000-000000000006','approve','91000000-0000-0000-0000-000000000002',null,pg_temp.candidate_for_preview('92000000-0000-0000-0000-000000000006'));
  raise exception 'ASSERTION FAILED: actor escaped company scope';
exception when insufficient_privilege then null; end $$;
reset role;
rollback;
