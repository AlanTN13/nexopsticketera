-- Additive release: deploy this migration before the application.
alter type public.ticket_status add value if not exists 'on_hold' after 'waiting_for_client';

-- A bounded transaction delegates each change to the existing workflow/history
-- boundary. Definer is required because authenticated has no direct UPDATE grant.
-- V2 helpers and existing triggers remain authoritative; no elevated client is used.
create or replace function public.update_ticket_statuses_with_history(
  target_ticket_ids uuid[],
  next_status public.ticket_status
)
returns table(ticket_id uuid, previous_status public.ticket_status, status_history_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_ids uuid[];
  current_ticket public.tickets%rowtype;
  locked_count integer := 0;
begin
  if not private.is_internal_user() then
    raise exception 'No autorizado para actualizar el workflow.' using errcode = '42501';
  end if;
  if next_status is null or target_ticket_ids is null
    or cardinality(target_ticket_ids) not between 1 and 100
    or array_position(target_ticket_ids, null) is not null then
    raise exception 'Seleccioná entre 1 y 100 tickets y un estado válido.' using errcode = '22023';
  end if;
  select array_agg(distinct id order by id) into requested_ids
  from unnest(target_ticket_ids) as selected(id);

  -- Lock in stable order before reading values to preserve concurrent assignment
  -- and priority edits. Every requested ID must exist and be authorized, even no-ops.
  for current_ticket in
    select * from public.tickets where id = any(requested_ids) order by id for update
  loop
    if not private.has_module_access(current_ticket.company_id, 'support', 'operate') then
      raise exception 'No autorizado para actualizar la selección.' using errcode = '42501';
    end if;
    locked_count := locked_count + 1;
  end loop;
  if locked_count <> cardinality(requested_ids) then
    raise exception 'No autorizado para actualizar la selección.' using errcode = '42501';
  end if;

  for current_ticket in
    select * from public.tickets where id = any(requested_ids) order by id
  loop
    ticket_id := current_ticket.id;
    previous_status := current_ticket.status;
    status_history_id := null;
    if current_ticket.status is distinct from next_status then
      status_history_id := public.update_ticket_workflow_with_history(
        current_ticket.id, next_status, current_ticket.priority, current_ticket.assigned_to_id
      );
    end if;
    return next;
  end loop;
end
$$;

revoke all on function public.update_ticket_statuses_with_history(uuid[], public.ticket_status)
  from public, anon, authenticated;
grant execute on function public.update_ticket_statuses_with_history(uuid[], public.ticket_status)
  to authenticated;
