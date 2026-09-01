-- LOCAL ONLY. Load after `supabase db reset --local --no-seed`.
-- The fixed UUIDs intentionally make accidental reuse fail fast.

begin;

insert into auth.users (id, email)
values
  ('51000000-0000-0000-0000-000000000001', 'platform-storage@test.invalid'),
  ('51000000-0000-0000-0000-000000000002', 'client-storage@test.invalid'),
  ('51000000-0000-0000-0000-000000000003', 'agent-storage@test.invalid');

insert into public.users (id, company_id, name, email, role, status)
values ('51000000-0000-0000-0000-000000000001', null, 'Platform Storage', 'platform-storage@test.invalid', 'platform_admin', 'active');

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.companies (id, name, slug)
values ('52000000-0000-0000-0000-000000000001', 'Storage Tenant', 'storage-tenant');

insert into public.users (id, company_id, name, email, role, status)
values
  ('51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Client Storage', 'client-storage@test.invalid', 'client_operator', 'active'),
  ('51000000-0000-0000-0000-000000000003', null, 'Agent Storage', 'agent-storage@test.invalid', 'agent', 'active');

select public.set_company_modules(
  '52000000-0000-0000-0000-000000000001',
  '[{"module":"support","enabled":true}]'::jsonb,
  null,
  false,
  'local Storage API fixture'
);

insert into public.user_company_assignments (user_id, company_id, assigned_by)
values (
  '51000000-0000-0000-0000-000000000003',
  '52000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001'
);

insert into public.user_module_permissions (user_id, company_id, module, access_level, granted_by)
values
  ('51000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'support', 'operate', '51000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', 'support', 'operate', '51000000-0000-0000-0000-000000000001');

insert into public.tickets (
  id, code, company_id, title, description, type, area, created_by_id
)
values (
  '53000000-0000-0000-0000-000000000001',
  'STORAGE-API-1',
  '52000000-0000-0000-0000-000000000001',
  'Storage API isolation',
  'Local-only fixture',
  'issue',
  'website',
  '51000000-0000-0000-0000-000000000002'
);

commit;
