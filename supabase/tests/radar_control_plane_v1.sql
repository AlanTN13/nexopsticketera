-- Run after `supabase db reset` with:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -v ON_ERROR_STOP=1 -f supabase/tests/radar_control_plane_v1.sql
-- Everything is rolled back. A failure raises and stops the script.

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end
$$;

insert into auth.users (id, email)
values
  ('51000000-0000-0000-0000-000000000001', 'platform-radar@test.invalid'),
  ('51000000-0000-0000-0000-000000000002', 'viewer-a-radar@test.invalid'),
  ('51000000-0000-0000-0000-000000000003', 'operator-a-radar@test.invalid'),
  ('51000000-0000-0000-0000-000000000004', 'admin-a-radar@test.invalid'),
  ('51000000-0000-0000-0000-000000000005', 'operator-b-radar@test.invalid');

insert into public.users (id, company_id, name, email, role, status)
values ('51000000-0000-0000-0000-000000000001', null, 'Platform Radar', 'platform-radar@test.invalid', 'platform_admin', 'active');

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.companies (id, name, slug)
values
  ('52000000-0000-0000-0000-000000000001', 'Radar Tenant A', 'radar-control-a'),
  ('52000000-0000-0000-0000-000000000002', 'Radar Tenant B', 'radar-control-b');

insert into public.users (id, company_id, name, email, role, status)
values
  ('51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Viewer A', 'viewer-a-radar@test.invalid', 'client_viewer', 'active'),
  ('51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', 'Operator A', 'operator-a-radar@test.invalid', 'client_operator', 'active'),
  ('51000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000001', 'Admin A', 'admin-a-radar@test.invalid', 'client_admin', 'active'),
  ('51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000002', 'Operator B', 'operator-b-radar@test.invalid', 'client_operator', 'active');

select public.set_company_modules(
  '52000000-0000-0000-0000-000000000001',
  '[{"module":"radar","enabled":true}]'::jsonb,
  'radar-control-a', false, 'Radar Control Plane test'
);
select public.set_company_modules(
  '52000000-0000-0000-0000-000000000002',
  '[{"module":"radar","enabled":true}]'::jsonb,
  'radar-control-b', false, 'Radar Control Plane test'
);

insert into public.user_module_permissions (user_id, company_id, module, access_level, granted_by)
values
  ('51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'radar', 'view', '51000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', 'radar', 'operate', '51000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000004', '52000000-0000-0000-0000-000000000001', 'radar', 'admin', '51000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000005', '52000000-0000-0000-0000-000000000002', 'radar', 'operate', '51000000-0000-0000-0000-000000000001');

select pg_temp.assert_true(
  (select count(*) = 2 from public.radar_control_settings where enabled and not scheduler_enabled),
  'commercial enablement must prepare both workspaces with scheduler off'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.radar_control_settings where schedule_days = array[1,2,3,4,5,6]::smallint[] and schedule_hour = 7),
  'new workspaces must be prepared Monday through Saturday in the 07:00 hour'
);

set local role authenticated;

-- URL/data boundary: view sees only its workspace and cannot operate it.
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.radar_control_settings where workspace_id = 'radar-control-a'),
  'viewer A must read workspace A'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.radar_control_settings where workspace_id = 'radar-control-b'),
  'viewer A must not read workspace B by direct ID'
);
do $$
begin
  perform public.request_radar_run('radar-control-a', '53000000-0000-0000-0000-000000000001', 'review');
  raise exception 'ASSERTION FAILED: viewer A started a run';
exception when insufficient_privilege then null;
end
$$;

-- Operate starts exactly one run and retries are idempotent.
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.request_radar_run('radar-control-a', '53000000-0000-0000-0000-000000000002', 'review');
select public.request_radar_run('radar-control-a', '53000000-0000-0000-0000-000000000002', 'review');
select pg_temp.assert_true(
  (select count(*) = 1 from public.radar_runs where workspace_id = 'radar-control-a' and idempotency_key = '53000000-0000-0000-0000-000000000002'),
  'the same request must create one durable run'
);
do $$
begin
  perform public.request_radar_run('radar-control-a', '53000000-0000-0000-0000-000000000003', 'suggest');
  raise exception 'ASSERTION FAILED: a second active run was created';
exception when sqlstate '55000' then null;
end
$$;

-- Tenant B cannot read or decide Tenant A by a direct run ID.
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000002'),
  'operator B must not read the run from A'
);
do $$
declare target_id uuid;
begin
  reset role;
  select id into target_id from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000002';
  set local role authenticated;
  perform public.decide_radar_run(target_id, '54000000-0000-0000-0000-000000000001', 'discard', null);
  raise exception 'ASSERTION FAILED: operator B decided a run from A';
exception when insufficient_privilege then null;
end
$$;

-- Admin can only configure the fixed pilot window; arbitrary schedules fail.
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  perform public.update_radar_control_schedule('radar-control-a', false, array[1,3,5]::smallint[], 10::smallint, 'America/Argentina/Buenos_Aires', 'review');
  raise exception 'ASSERTION FAILED: arbitrary scheduler was accepted';
exception when sqlstate '55000' then null;
end
$$;
select public.update_radar_control_schedule('radar-control-a', false, array[1,2,3,4,5,6]::smallint[], 7::smallint, 'America/Argentina/Buenos_Aires', 'review');
select public.update_radar_control_preferences(
  'radar-control-a', array['IA aplicada','Operaciones']::text[], 6::smallint, 'suggest', 'automatic'
);
select pg_temp.assert_true(
  (select preferences -> 'topics' = '["IA aplicada","Operaciones"]'::jsonb
    and preferences ->> 'publicationsPerWeek' = '6'
    and preferences ->> 'opportunityBehavior' = 'suggest'
    and preferences ->> 'publishingMode' = 'review'
    from public.radar_control_settings where workspace_id = 'radar-control-a'),
  'admin preferences must persist while direct publication remains gated without an integrated site'
);
do $$
begin
  perform public.update_radar_control_schedule('radar-control-a', true, array[1,2,3,4,5,6]::smallint[], 7::smallint, 'America/Argentina/Buenos_Aires', 'automatic');
  raise exception 'ASSERTION FAILED: scheduler left review mode';
exception when sqlstate '55000' then null;
end
$$;

-- Simulate the signed engine result locally: candidate waits for review.
reset role;
update public.radar_runs
set status = 'review_pending',
    candidate = '{"title":"Oportunidad A","topic":"IA aplicada","sourceName":"Fuente oficial","sourceUrl":"https://example.org/source","score":88,"businessReasons":["Relevancia comercial"]}'::jsonb,
    updated_at = now()
where idempotency_key = '53000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.decide_radar_run(
  (select id from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000002'),
  '54000000-0000-0000-0000-000000000002', 'discard', 'Fuera de foco'
);
select public.decide_radar_run(
  (select id from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000002'),
  '54000000-0000-0000-0000-000000000002', 'discard', 'Fuera de foco'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.radar_run_decisions where idempotency_key = '54000000-0000-0000-0000-000000000002'),
  'a retried decision must remain single and durable'
);

-- A manual note keeps its source and can finish as durable NO_PUBLICATION.
select public.request_radar_run(
  'radar-control-a',
  '53000000-0000-0000-0000-000000000004',
  'review',
  'manual_note',
  '{"sourceUrl":"https://example.org/manual","title":"Nota manual","instructions":"Prioridad alta"}'::jsonb
);
select pg_temp.assert_true(
  (select request_kind = 'manual_note'
    and request_payload ->> 'sourceUrl' = 'https://example.org/manual'
    from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000004'),
  'manual note intake must be durable and workspace-scoped'
);
reset role;
update public.radar_runs
set status = 'dispatching', updated_at = now()
where idempotency_key = '53000000-0000-0000-0000-000000000004';
select public.record_radar_worker_result(
  id, 'dispatching', 'no_publication', 'No se encontró una oportunidad suficiente.',
  null, 'No alcanzó el umbral comercial.', null, null,
  'radar-' || id::text, repeat('a', 64), repeat('b', 64)
)
from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000004';
select pg_temp.assert_true(
  (select public.record_radar_worker_result(
    id, 'no_publication', 'no_publication', 'No se encontró una oportunidad suficiente.',
    null, 'No alcanzó el umbral comercial.', null, null,
    'radar-' || id::text, repeat('a', 64), repeat('b', 64)
  ) from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000004'),
  'an exact callback retry must be reported as duplicate'
);
do $$
declare target_id uuid;
begin
  select id into target_id from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000004';
  perform public.record_radar_worker_result(
    target_id, 'no_publication', 'no_publication', 'No se encontró una oportunidad suficiente.',
    null, 'No alcanzó el umbral comercial.', null, null,
    'radar-' || target_id::text, repeat('a', 64), repeat('c', 64)
  );
  raise exception 'ASSERTION FAILED: an altered callback retry was accepted';
exception when sqlstate '22023' then null;
end
$$;
select pg_temp.assert_true(
  (select count(*) = 1 from public.radar_run_events event
    join public.radar_runs run on run.id = event.run_id
    where run.idempotency_key = '53000000-0000-0000-0000-000000000004'
      and event.event_type = 'engine_no_publication'),
  'callback state and receipt must commit exactly once'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.radar_runs where idempotency_key = '53000000-0000-0000-0000-000000000004' and status = 'no_publication'),
  'manual note outcome must remain visible and durable in the workspace history'
);
select pg_temp.assert_true(
  (select not scheduler_enabled from public.radar_control_settings where workspace_id = 'radar-control-a'),
  'scheduler must still be paused'
);

rollback;
