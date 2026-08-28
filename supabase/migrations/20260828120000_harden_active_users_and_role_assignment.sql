-- Enforce account lifecycle and privilege boundaries at the database layer.
-- This migration is additive and is not applied automatically by the app.

alter type public.user_status add value if not exists 'disabled';

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select status = 'active'
     from public.users where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.users
  where id = (select auth.uid())
    and status = 'active'
$$;

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id
  from public.users
  where id = (select auth.uid())
    and status = 'active'
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
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
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
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
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
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
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
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
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
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
    false
  )
$$;

create or replace function private.can_create_profile(
  target_company_id uuid,
  target_role public.user_role,
  target_status public.user_status
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select
      target_status::text in ('active', 'invited')
      and case
        when target_company_id is null then
          actor.role = 'platform_admin'
          and target_role in ('agent', 'team_lead', 'platform_admin')
        else
          target_role in ('client_admin', 'client_operator', 'client_viewer')
          and (
            actor.role in ('team_lead', 'platform_admin')
            or (actor.role = 'client_admin' and actor.company_id = target_company_id)
          )
      end
     from public.users actor
     where actor.id = (select auth.uid())
       and actor.status = 'active'),
    false
  )
$$;

create or replace function private.can_manage_profile(
  target_user_id uuid,
  target_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
      when actor.role = 'platform_admin' then true
      when actor.role = 'team_lead' then target_company_id is not null
      else actor.role = 'client_admin' and actor.company_id = target_company_id
     end
     from public.users actor
     where actor.id = (select auth.uid())
       and actor.status = 'active'),
    false
  )
$$;

create or replace function private.can_update_profile(
  target_user_id uuid,
  target_company_id uuid,
  target_role public.user_role,
  target_status public.user_status
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
      when actor.id = target_user_id then
        existing.role = target_role and existing.status = target_status
      when target_company_id is null then
        actor.role = 'platform_admin'
        and target_role in ('agent', 'team_lead', 'platform_admin')
      else
        target_role in ('client_admin', 'client_operator', 'client_viewer')
        and (
          actor.role in ('team_lead', 'platform_admin')
          or (actor.role = 'client_admin' and actor.company_id = target_company_id)
        )
     end
     from public.users actor
     join public.users existing on existing.id = target_user_id
     where actor.id = (select auth.uid())
       and actor.status = 'active'
       and existing.company_id is not distinct from target_company_id),
    false
  )
$$;

revoke all on function private.is_active_user() from public, anon;
revoke all on function private.can_create_profile(uuid, public.user_role, public.user_status) from public, anon;
revoke all on function private.can_manage_profile(uuid, uuid) from public, anon;
revoke all on function private.can_update_profile(uuid, uuid, public.user_role, public.user_status) from public, anon;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.can_create_profile(uuid, public.user_role, public.user_status) to authenticated;
grant execute on function private.can_manage_profile(uuid, uuid) to authenticated;
grant execute on function private.can_update_profile(uuid, uuid, public.user_role, public.user_status) to authenticated;

drop policy if exists "authenticated users read visible profiles" on public.users;
create policy "active users read visible profiles"
on public.users for select to authenticated
using (
  private.is_active_user()
  and (
    private.is_internal_user()
    or company_id = private.current_company_id()
    or id = (select auth.uid())
  )
);

drop policy if exists "authorized managers create profiles" on public.users;
create policy "authorized managers create profiles"
on public.users for insert to authenticated
with check (private.can_create_profile(company_id, role, status));

drop policy if exists "authorized managers update profiles" on public.users;
create policy "authorized managers update profiles"
on public.users for update to authenticated
using (private.can_manage_profile(id, company_id))
with check (private.can_update_profile(id, company_id, role, status));

create or replace function public.activate_current_user_profile()
returns public.user_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_status public.user_status;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  select status
  into profile_status
  from public.users
  where id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Operational profile not found.';
  end if;

  if profile_status::text = 'disabled' then
    raise exception 'Account disabled.';
  end if;

  if profile_status = 'invited' then
    update public.users
    set status = 'active'
    where id = (select auth.uid());
    profile_status := 'active';
  end if;

  return profile_status;
end
$$;

revoke all on function public.activate_current_user_profile() from public, anon, authenticated;
grant execute on function public.activate_current_user_profile() to authenticated;
