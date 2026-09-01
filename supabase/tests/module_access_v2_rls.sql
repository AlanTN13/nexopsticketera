-- Run after `supabase db reset` with:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -v ON_ERROR_STOP=1 -f supabase/tests/module_access_v2_rls.sql
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
  ('10000000-0000-0000-0000-000000000001', 'platform@test.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'viewer-a@test.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'operator-a@test.invalid'),
  ('10000000-0000-0000-0000-000000000004', 'admin-a@test.invalid'),
  ('10000000-0000-0000-0000-000000000005', 'operator-b@test.invalid'),
  ('10000000-0000-0000-0000-000000000006', 'agent@test.invalid'),
  ('10000000-0000-0000-0000-000000000007', 'unassigned-agent@test.invalid');

insert into public.users (id, company_id, name, email, role, status)
values (
  '10000000-0000-0000-0000-000000000001', null, 'Platform', 'platform@test.invalid', 'platform_admin', 'active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

-- The company trigger must seed every catalog module for future companies.
insert into public.companies (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Tenant A', 'rls-tenant-a'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'rls-tenant-b');

select pg_temp.assert_true(
  (select count(*) = 8 from public.company_modules where company_id in (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  )),
  'new companies must receive every module row'
);

insert into public.users (id, company_id, name, email, role, status)
values
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Viewer A', 'viewer-a@test.invalid', 'client_viewer', 'active'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Operator A', 'operator-a@test.invalid', 'client_operator', 'active'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Admin A', 'admin-a@test.invalid', 'client_admin', 'active'),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Operator B', 'operator-b@test.invalid', 'client_operator', 'active'),
  ('10000000-0000-0000-0000-000000000006', null, 'Agent', 'agent@test.invalid', 'agent', 'active'),
  ('10000000-0000-0000-0000-000000000007', null, 'Unassigned Agent', 'unassigned-agent@test.invalid', 'agent', 'active');

select public.set_company_modules(
  '20000000-0000-0000-0000-000000000001',
  '[{"module":"support","enabled":true},{"module":"metrics","enabled":true},{"module":"radar","enabled":true},{"module":"content","enabled":true}]'::jsonb,
  'tenant-a-radar',
  false,
  'RLS fixture'
);
select public.set_company_modules(
  '20000000-0000-0000-0000-000000000002',
  '[{"module":"support","enabled":true},{"module":"metrics","enabled":true},{"module":"radar","enabled":true},{"module":"content","enabled":true}]'::jsonb,
  'tenant-b-radar',
  false,
  'RLS fixture'
);

select public.set_company_modules(
  '20000000-0000-0000-0000-000000000001',
  '[{"module":"radar","enabled":false}]'::jsonb,
  'tenant-a-radar',
  false,
  'Disable must remain possible'
);
select pg_temp.assert_true(
  not (select enabled from public.company_modules where company_id = '20000000-0000-0000-0000-000000000001' and module = 'radar'),
  'platform admin must be able to disable Radar without losing its settings'
);

insert into public.user_company_assignments (user_id, company_id, assigned_by)
values (
  '10000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.user_module_permissions (user_id, company_id, module, access_level, granted_by)
values
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'support', 'view', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'support', 'operate', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'support', 'admin', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'support', 'operate', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'support', 'operate', '10000000-0000-0000-0000-000000000001');

insert into public.tickets (
  id, code, company_id, title, description, type, area, created_by_id
)
values
  ('30000000-0000-0000-0000-000000000001', 'RLS-A-1', '20000000-0000-0000-0000-000000000001', 'Ticket A', 'A', 'issue', 'website', '10000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', 'RLS-B-1', '20000000-0000-0000-0000-000000000002', 'Ticket B', 'B', 'issue', 'website', '10000000-0000-0000-0000-000000000005');

set local role authenticated;

-- Direct URL/ID: Tenant A can resolve only its own ticket.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.tickets where id = '30000000-0000-0000-0000-000000000001'),
  'viewer A must read ticket A by direct ID'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.tickets where id = '30000000-0000-0000-0000-000000000002'),
  'viewer A must not read ticket B by direct ID'
);

-- Direct action: view cannot operate.
do $$
begin
  insert into public.ticket_comments (ticket_id, author_id, body)
  values (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'must fail'
  );
  raise exception 'ASSERTION FAILED: viewer A inserted a comment';
exception
  when insufficient_privilege then null;
end
$$;

-- The functional level, not the legacy client role, authorizes operations.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.set_user_module_permissions(
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '[{"module":"support","level":"operate"}]'::jsonb,
  'viewer promoted for hierarchy test'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.create_ticket_comment_with_attachments(
  '30000000-0000-0000-0000-000000000001',
  'viewer role with operate succeeds',
  'external',
  '[]'::jsonb
);
select public.create_ticket_with_history(
  '40000000-0000-0000-0000-000000000001',
  'Viewer promoted to operate',
  'The explicit module level authorizes this action.',
  '{}'::text[],
  'issue',
  'website'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
begin
  insert into public.ticket_comments (ticket_id, author_id, body)
  values (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'direct DML must fail'
  );
  raise exception 'ASSERTION FAILED: direct comment DML succeeded';
exception
  when insufficient_privilege then null;
end
$$;
select public.create_ticket_comment_with_attachments(
  '30000000-0000-0000-0000-000000000001',
  'operator succeeds',
  'external',
  '[]'::jsonb
);

do $$
declare
  updated_count integer;
begin
  update public.tickets
  set status = 'closed'
  where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics updated_count = row_count;
  if updated_count <> 0 then
    raise exception 'ASSERTION FAILED: client operator updated ticket workflow';
  end if;
exception
  when insufficient_privilege then null;
end
$$;

-- A/B internal assignment: the agent can attend A, never B.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.tickets where id = '30000000-0000-0000-0000-000000000001'),
  'assigned agent must read tenant A'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.tickets where id = '30000000-0000-0000-0000-000000000002'),
  'agent must not cross into tenant B'
);

select public.create_ticket_comment_with_attachments(
  '30000000-0000-0000-0000-000000000001',
  'internal visibility fixture',
  'internal',
  '[]'::jsonb
);

reset role;
insert into public.ticket_attachments (
  ticket_id, comment_id, uploaded_by_id, storage_path, file_name, size_bytes, mime_type, kind
)
select
  comment.ticket_id,
  comment.id,
  comment.author_id,
  'tickets/' || comment.ticket_id::text || '/comments/' || comment.id::text || '/internal-rls.png',
  'internal-rls.png',
  1,
  'image/png',
  'screenshot'
from public.ticket_comments comment
where comment.body = 'internal visibility fixture';

insert into storage.objects (id, bucket_id, name, owner_id)
select
  '40000000-0000-0000-0000-000000000001'::uuid,
  'ticket-attachments',
  attachment.storage_path,
  '10000000-0000-0000-0000-000000000006'
from public.ticket_attachments attachment
where attachment.file_name = 'internal-rls.png';
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.ticket_attachments where file_name = 'internal-rls.png'),
  'client must not read metadata for an internal-comment attachment'
);
select pg_temp.assert_true(
  (select count(*) = 0 from storage.objects where id = '40000000-0000-0000-0000-000000000001'),
  'client must not read the storage object for an internal-comment attachment'
);
delete from storage.objects where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 0 from storage.objects where id = '40000000-0000-0000-0000-000000000001'),
  'client must not delete a hidden storage object'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.ticket_history where visibility = 'internal'),
  'client must not read history events for internal comments'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.ticket_attachments where file_name = 'internal-rls.png'),
  'assigned internal operator must read internal attachment metadata'
);
select pg_temp.assert_true(
  (select count(*) = 1 from storage.objects where id = '40000000-0000-0000-0000-000000000001'),
  'assigned internal owner must read the internal storage object'
);
delete from storage.objects where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 0 from storage.objects where id = '40000000-0000-0000-0000-000000000001'),
  'assigned internal owner must be able to delete its storage object'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.ticket_history where visibility = 'internal'),
  'assigned internal operator must read internal comment history'
);

-- Safe assignee projections repeat module and tenant authorization.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.support_assignee_ids('20000000-0000-0000-0000-000000000001')),
  'client operator must not enumerate internal assignee IDs'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.support_assignee_ids('20000000-0000-0000-0000-000000000001') where user_id = '10000000-0000-0000-0000-000000000006'),
  'assigned internal operator must resolve eligible assignees'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.support_assignee_ids('20000000-0000-0000-0000-000000000001')),
  'unassigned internal operator must not enumerate assignees'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.update_ticket_workflow_with_history(
  '30000000-0000-0000-0000-000000000001',
  'analysis',
  'medium',
  '10000000-0000-0000-0000-000000000006'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_true(
  public.ticket_assignee_display_name('30000000-0000-0000-0000-000000000001') = 'Agent',
  'tenant A must resolve its authorized assignee projection'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select pg_temp.assert_true(
  public.ticket_assignee_display_name('30000000-0000-0000-0000-000000000001') is null,
  'tenant B must not resolve tenant A assignee by direct ID'
);

-- Functional admin is not the entitlement control plane.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$
begin
  perform public.set_company_modules(
    '20000000-0000-0000-0000-000000000001',
    '[{"module":"support","enabled":false}]'::jsonb,
    null,
    false,
    'must fail'
  );
  raise exception 'ASSERTION FAILED: client admin changed an entitlement';
exception
  when insufficient_privilege then null;
end
$$;

-- Disabling a module nullifies every level without deleting grants.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.set_company_modules(
  '20000000-0000-0000-0000-000000000001',
  '[{"module":"support","enabled":false}]'::jsonb,
  'tenant-a-radar',
  false,
  'RLS isolation test'
);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.tickets where id = '30000000-0000-0000-0000-000000000001'),
  'disabled module must hide direct ticket access'
);

-- User status nullifies otherwise-valid tenant and permission rows.
reset role;
update public.users
set status = 'disabled'
where id = '10000000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.tickets where id = '30000000-0000-0000-0000-000000000002'),
  'disabled user must not retain ticket access'
);

-- Audit is readable only by platform and immutable even for the table owner.
reset role;
do $$
begin
  update public.access_audit_log set reason = 'tamper';
  raise exception 'ASSERTION FAILED: audit update succeeded';
exception
  when insufficient_privilege then null;
end
$$;
set local role service_role;
do $$
begin
  perform 1 from public.access_audit_log limit 1;
  raise exception 'ASSERTION FAILED: service_role read audit rows';
exception
  when insufficient_privilege then null;
end
$$;

reset role;
rollback;
