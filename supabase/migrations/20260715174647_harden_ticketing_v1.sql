-- NexOps V1 hardening: user-scoped Data API access, deterministic grants,
-- non-recursive tenant helpers, atomic ticket codes and Storage isolation.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid())
$$;

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.users where id = (select auth.uid())
$$;

create or replace function private.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('agent', 'team_lead', 'platform_admin')
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.can_manage_global_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('team_lead', 'platform_admin')
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('agent', 'team_lead', 'platform_admin')
         or company_id = target_company_id
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('team_lead', 'platform_admin')
         or (role = 'client_admin' and company_id = target_company_id)
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.can_comment_on_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('agent', 'team_lead', 'platform_admin')
         or (role in ('client_admin', 'client_operator') and company_id = target_company_id)
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.ticket_id_from_storage_path(storage_path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if split_part(storage_path, '/', 1) <> 'tickets' then
    return null;
  end if;
  return split_part(storage_path, '/', 2)::uuid;
exception when invalid_text_representation then
  return null;
end
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

create or replace function private.touch_ticket_from_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return new;
end
$$;

revoke all on function private.touch_ticket_from_comment() from public, anon, authenticated;

drop trigger if exists touch_ticket_after_comment on public.ticket_comments;
create trigger touch_ticket_after_comment
after insert on public.ticket_comments
for each row execute function private.touch_ticket_from_comment();

drop policy if exists "internal users can read companies" on public.companies;
drop policy if exists "users can read visible companies" on public.companies;
drop policy if exists "global catalog managers can create companies" on public.companies;
drop policy if exists "global catalog managers can update companies" on public.companies;
drop policy if exists "users can read company peers" on public.users;
drop policy if exists "client admins can manage company users" on public.users;
drop policy if exists "tickets visible by tenant or internal" on public.tickets;
drop policy if exists "clients create own company tickets" on public.tickets;
drop policy if exists "internal workflow updates" on public.tickets;
drop policy if exists "comments visible by ticket access" on public.ticket_comments;
drop policy if exists "allowed users can comment" on public.ticket_comments;
drop policy if exists "attachments visible by ticket access" on public.ticket_attachments;
drop policy if exists "attachments inserted by ticket access" on public.ticket_attachments;
drop policy if exists "history visible by ticket access" on public.ticket_history;
drop policy if exists "allowed users can insert history" on public.ticket_history;

create policy "authenticated users read visible companies"
on public.companies for select to authenticated
using (private.can_access_company(id));

create policy "catalog managers create companies"
on public.companies for insert to authenticated
with check (private.can_manage_global_catalog());

create policy "catalog managers update companies"
on public.companies for update to authenticated
using (private.can_manage_global_catalog())
with check (private.can_manage_global_catalog());

create policy "catalog managers delete companies"
on public.companies for delete to authenticated
using (private.can_manage_global_catalog());

create policy "authenticated users read visible profiles"
on public.users for select to authenticated
using (
  private.is_internal_user()
  or company_id = private.current_company_id()
  or id = (select auth.uid())
);

create policy "authorized managers create profiles"
on public.users for insert to authenticated
with check (private.can_manage_company(company_id));

create policy "authorized managers update profiles"
on public.users for update to authenticated
using (private.can_manage_company(company_id))
with check (private.can_manage_company(company_id));

create policy "authenticated users read visible tickets"
on public.tickets for select to authenticated
using (private.can_access_company(company_id));

create policy "client editors create own company tickets"
on public.tickets for insert to authenticated
with check (
  created_by_id = (select auth.uid())
  and company_id = private.current_company_id()
  and private.current_user_role() in ('client_admin', 'client_operator')
);

create policy "internal operators update tickets"
on public.tickets for update to authenticated
using (private.is_internal_user())
with check (private.is_internal_user());

create policy "authenticated users read visible comments"
on public.ticket_comments for select to authenticated
using (
  private.can_access_company((select company_id from public.tickets where id = ticket_id))
  and (visibility = 'external' or private.is_internal_user())
);

create policy "authorized users create comments"
on public.ticket_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_comment_on_company((select company_id from public.tickets where id = ticket_id))
  and (visibility = 'external' or private.is_internal_user())
);

create policy "authenticated users read visible attachments"
on public.ticket_attachments for select to authenticated
using (private.can_access_company((select company_id from public.tickets where id = ticket_id)));

create policy "authorized users create attachment metadata"
on public.ticket_attachments for insert to authenticated
with check (
  uploaded_by_id = (select auth.uid())
  and private.can_comment_on_company((select company_id from public.tickets where id = ticket_id))
);

create policy "authenticated users read visible history"
on public.ticket_history for select to authenticated
using (private.can_access_company((select company_id from public.tickets where id = ticket_id)));

create policy "authorized users create history"
on public.ticket_history for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and private.can_comment_on_company((select company_id from public.tickets where id = ticket_id))
);

drop policy if exists "ticket attachment read" on storage.objects;
drop policy if exists "ticket attachment upload" on storage.objects;
drop policy if exists "ticket attachment delete" on storage.objects;

create policy "ticket attachment read"
on storage.objects for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and private.can_access_company((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ))
);

create policy "ticket attachment upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and private.can_comment_on_company((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ))
);

create policy "ticket attachment delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and private.can_comment_on_company((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ))
);

alter table public.users drop constraint if exists users_role_company_consistency;
alter table public.users add constraint users_role_company_consistency check (
  (company_id is not null and role in ('client_admin', 'client_operator', 'client_viewer'))
  or
  (company_id is null and role in ('agent', 'team_lead', 'platform_admin'))
);

alter table public.companies drop constraint if exists companies_plan_allowed;
alter table public.companies add constraint companies_plan_allowed
  check (plan in ('starter', 'growth', 'enterprise'));
alter table public.companies drop constraint if exists companies_status_allowed;
alter table public.companies add constraint companies_status_allowed
  check (status in ('active', 'onboarding'));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.companies, public.users, public.tickets,
  public.ticket_comments, public.ticket_attachments, public.ticket_history to authenticated;
grant insert on public.companies, public.users, public.tickets to authenticated;
grant delete on public.companies to authenticated;
grant update (name, slug, plan, industry, status, primary_contact)
  on public.companies to authenticated;
grant update (name, email, role, status, title, avatar)
  on public.users to authenticated;
grant update (status, priority, assigned_to_id, updated_at)
  on public.tickets to authenticated;
grant insert on public.ticket_comments, public.ticket_attachments, public.ticket_history to authenticated;

create sequence if not exists public.ticket_code_seq start with 1001;
select setval(
  'public.ticket_code_seq',
  greatest(
    coalesce((select max(substring(code from 5)::bigint) from public.tickets where code ~ '^NEX-[0-9]+$'), 1000),
    1000
  ),
  true
);
alter table public.tickets
  alter column code set default ('NEX-' || lpad(nextval('public.ticket_code_seq')::text, 4, '0'));
grant usage, select on sequence public.ticket_code_seq to authenticated;

create index if not exists users_company_id_idx on public.users(company_id);
create index if not exists tickets_company_id_idx on public.tickets(company_id);
create index if not exists tickets_assigned_to_id_idx on public.tickets(assigned_to_id);
create index if not exists ticket_comments_ticket_id_idx on public.ticket_comments(ticket_id);
create index if not exists ticket_attachments_ticket_id_idx on public.ticket_attachments(ticket_id);
create index if not exists ticket_history_ticket_id_idx on public.ticket_history(ticket_id);

drop function if exists public.current_app_user();
drop function if exists public.is_internal_user();
drop function if exists public.can_access_ticket(uuid);
drop function if exists public.can_manage_company(uuid);
drop function if exists public.can_manage_global_catalog();
drop function if exists public.can_comment_on_ticket(uuid);
