create or replace function public.can_manage_global_catalog()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('team_lead', 'platform_admin')
  )
$$;

create or replace function public.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and (
        role in ('team_lead', 'platform_admin')
        or (role = 'client_admin' and company_id = target_company_id)
      )
  )
$$;

create or replace function public.can_comment_on_ticket(ticket_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and (
        role in ('agent', 'team_lead', 'platform_admin')
        or (
          role in ('client_admin', 'client_operator')
          and company_id = ticket_company_id
        )
      )
  )
$$;

drop policy if exists "internal users can read companies" on public.companies;
drop policy if exists "users can read visible companies" on public.companies;
drop policy if exists "global catalog managers can create companies" on public.companies;
drop policy if exists "global catalog managers can update companies" on public.companies;

create policy "users can read visible companies"
on public.companies for select
using (
  public.is_internal_user()
  or id = (select company_id from public.current_app_user())
);

create policy "global catalog managers can create companies"
on public.companies for insert
with check (public.can_manage_global_catalog());

create policy "global catalog managers can update companies"
on public.companies for update
using (public.can_manage_global_catalog())
with check (public.can_manage_global_catalog());

drop policy if exists "allowed users can comment" on public.ticket_comments;

create policy "allowed users can comment"
on public.ticket_comments for insert
with check (
  author_id = auth.uid()
  and public.can_comment_on_ticket((select company_id from public.tickets where id = ticket_id))
  and (
    visibility = 'external'
    or public.is_internal_user()
  )
);

drop policy if exists "attachments inserted by ticket access" on public.ticket_attachments;

create policy "attachments inserted by ticket access"
on public.ticket_attachments for insert
with check (
  uploaded_by_id = auth.uid()
  and public.can_access_ticket((select company_id from public.tickets where id = ticket_id))
);

drop policy if exists "allowed users can insert history" on public.ticket_history;

create policy "allowed users can insert history"
on public.ticket_history for insert
with check (
  actor_id = auth.uid()
  and (
    public.is_internal_user()
    or public.can_comment_on_ticket((select company_id from public.tickets where id = ticket_id))
  )
);
