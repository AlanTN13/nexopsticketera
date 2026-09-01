-- A comment updates only tickets.updated_at through the protected
-- touch_ticket_after_comment trigger. Compare the immutable/business columns
-- explicitly so that this housekeeping write is not mistaken for workflow DML.

create or replace function private.enforce_support_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_company_id uuid;
begin
  if tg_table_name = 'tickets' then
    if tg_op = 'UPDATE'
      and not private.is_internal_user()
      and (
        new.id is distinct from old.id
        or new.code is distinct from old.code
        or new.company_id is distinct from old.company_id
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.type is distinct from old.type
        or new.area is distinct from old.area
        or new.priority is distinct from old.priority
        or new.status is distinct from old.status
        or new.created_by_id is distinct from old.created_by_id
        or new.assigned_to_id is distinct from old.assigned_to_id
        or new.created_at is distinct from old.created_at
        or new.context_urls is distinct from old.context_urls
        or new.creation_key is distinct from old.creation_key
      )
    then
      raise exception 'Sólo un integrante interno puede actualizar el flujo del ticket.' using errcode = '42501';
    end if;
    target_company_id := new.company_id;
  else
    select company_id into target_company_id
    from public.tickets
    where id = new.ticket_id;
  end if;

  if target_company_id is null
    or not private.has_module_access(target_company_id, 'support', 'operate')
  then
    raise exception 'No autorizado para operar Soporte en esta empresa.' using errcode = '42501';
  end if;

  if tg_table_name = 'tickets' then
    if new.assigned_to_id is not null
      and (
        not exists (
          select 1 from public.users assignee
          where assignee.id = new.assigned_to_id
            and assignee.company_id is null
            and assignee.status = 'active'
            and assignee.role in ('agent', 'team_lead', 'platform_admin')
        )
        or not private.user_has_module_access(
          new.assigned_to_id,
          target_company_id,
          'support',
          'operate'
        )
      )
    then
      raise exception 'El responsable no está asignado a esta empresa.' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.enforce_support_operation()
  from public, anon, authenticated;
