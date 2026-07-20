-- Resolve the safe assignee projection for all visible tickets in one call.
-- The result contains only ticket IDs the caller can already access and names.
create or replace function public.ticket_assignee_display_names(target_ticket_ids uuid[])
returns table(ticket_id uuid, assignee_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, u.name
  from public.tickets t
  join public.users u on u.id = t.assigned_to_id
  where t.id = any(target_ticket_ids)
    and private.can_access_company(t.company_id)
    and u.role in ('agent', 'team_lead', 'platform_admin')
$$;

revoke all on function public.ticket_assignee_display_names(uuid[]) from public, anon;
grant execute on function public.ticket_assignee_display_names(uuid[]) to authenticated;
