-- Portal NexOps access control V2.
-- Additive data model, compatible backfill and fail-closed authorization.

create table public.portal_modules (
  key text primary key,
  label text not null,
  description text not null default '',
  sort_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint portal_modules_key_format check (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint portal_modules_label_length check (char_length(btrim(label)) between 2 and 80),
  constraint portal_modules_description_length check (char_length(description) <= 500)
);

insert into public.portal_modules (key, label, description, sort_order)
values
  ('support', 'Soporte', 'Tickets, comentarios, adjuntos y seguimiento operativo.', 10),
  ('metrics', 'Métricas', 'Reportería y actualización de resultados.', 20),
  ('radar', 'Radar', 'Inteligencia y operación editorial.', 30),
  ('content', 'Contenido', 'Base de acceso para el módulo de Contenido.', 40)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

alter table public.company_modules
  drop constraint if exists company_modules_module_allowed;

insert into public.company_modules (company_id, module, enabled)
select
  company.id,
  module.key,
  module.key = 'support'
from public.companies company
cross join public.portal_modules module
on conflict (company_id, module) do nothing;

alter table public.company_modules
  add constraint company_modules_catalog_fk
  foreign key (module) references public.portal_modules(key)
  on update cascade on delete restrict;

create table public.user_company_assignments (
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table public.user_module_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module text not null,
  access_level text not null,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id, module),
  constraint user_module_permissions_level_allowed
    check (access_level in ('view', 'operate', 'admin')),
  constraint user_module_permissions_company_module_fk
    foreign key (company_id, module)
    references public.company_modules(company_id, module)
    on update cascade on delete cascade
);

create table public.access_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  company_id uuid references public.companies(id) on delete set null,
  target_user_id uuid,
  module text,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now(),
  constraint access_audit_action_length check (char_length(action) between 3 and 120),
  constraint access_audit_reason_length check (reason is null or char_length(reason) <= 500),
  constraint access_audit_module_fk foreign key (module)
    references public.portal_modules(key) on update cascade on delete set null
);

alter table public.ticket_history
  add column visibility public.comment_visibility not null default 'external';

update public.ticket_history
set visibility = 'internal'
where event_type = 'commented'
  and message like '% comentario interno.';

create index user_company_assignments_company_idx
  on public.user_company_assignments(company_id, user_id);
create index user_module_permissions_company_module_idx
  on public.user_module_permissions(company_id, module, user_id);
create index access_audit_company_created_idx
  on public.access_audit_log(company_id, created_at desc);
create index access_audit_target_user_created_idx
  on public.access_audit_log(target_user_id, created_at desc)
  where target_user_id is not null;

-- Preserve existing support access without inventing internal access to Metrics/Radar.
insert into public.user_company_assignments (user_id, company_id)
select internal_user.id, company.id
from public.users internal_user
cross join public.companies company
where internal_user.company_id is null
  and internal_user.role in ('agent', 'team_lead')
  and internal_user.status = 'active'
on conflict (user_id, company_id) do nothing;

insert into public.user_module_permissions (user_id, company_id, module, access_level)
select
  client.id,
  client.company_id,
  company_module.module,
  case client.role
    when 'client_viewer' then 'view'
    when 'client_operator' then 'operate'
    when 'client_admin' then 'admin'
  end
from public.users client
join public.company_modules company_module
  on company_module.company_id = client.company_id
 and company_module.enabled
where client.company_id is not null
  and client.role in ('client_viewer', 'client_operator', 'client_admin')
on conflict (user_id, company_id, module) do nothing;

insert into public.user_module_permissions (user_id, company_id, module, access_level)
select
  assignment.user_id,
  assignment.company_id,
  'support',
  case internal_user.role when 'team_lead' then 'admin' else 'operate' end
from public.user_company_assignments assignment
join public.users internal_user on internal_user.id = assignment.user_id
join public.company_modules support
  on support.company_id = assignment.company_id
 and support.module = 'support'
 and support.enabled
where internal_user.role in ('agent', 'team_lead')
on conflict (user_id, company_id, module) do nothing;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'platform_admin'
     from public.users
     where id = (select auth.uid())
       and status = 'active'),
    false
  )
$$;

create or replace function private.can_manage_access_control()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
$$;

create or replace function private.can_manage_global_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
$$;

create or replace function private.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
      when profile.role = 'platform_admin' then true
      when profile.company_id is not null then profile.company_id = target_company_id
      else exists (
        select 1
        from public.user_company_assignments assignment
        where assignment.user_id = profile.id
          and assignment.company_id = target_company_id
      )
     end
     from public.users profile
     where profile.id = (select auth.uid())
       and profile.status = 'active'),
    false
  )
$$;

create or replace function private.user_has_module_access(
  target_user_id uuid,
  target_company_id uuid,
  target_module text,
  required_level text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select
      case required_level
        when 'view' then permission_rank >= 1
        when 'operate' then permission_rank >= 2
        when 'admin' then permission_rank >= 3
        else false
      end
     from (
       select case
         when profile.status <> 'active' then 0
         when not module_access.enabled then 0
         when profile.role = 'platform_admin' then 3
         when profile.company_id is not null
              and profile.company_id <> target_company_id then 0
         when profile.company_id is null
              and not exists (
                select 1 from public.user_company_assignments assignment
                where assignment.user_id = profile.id
                  and assignment.company_id = target_company_id
              ) then 0
         else case permission.access_level
           when 'view' then 1
           when 'operate' then 2
           when 'admin' then 3
           else 0
         end
       end as permission_rank
       from public.users profile
       join public.company_modules module_access
         on module_access.company_id = target_company_id
        and module_access.module = target_module
       join public.portal_modules module_catalog
         on module_catalog.key = module_access.module
        and module_catalog.active
       left join public.user_module_permissions permission
         on permission.user_id = profile.id
        and permission.company_id = target_company_id
        and permission.module = target_module
       where profile.id = target_user_id
     ) evaluated),
    false
  )
$$;

create or replace function private.has_module_access(
  target_company_id uuid,
  target_module text,
  required_level text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_has_module_access(
    (select auth.uid()),
    target_company_id,
    target_module,
    required_level
  )
$$;

create or replace function private.can_comment_on_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_module_access(target_company_id, 'support', 'operate')
$$;

create or replace function private.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
      when actor.role = 'platform_admin' then true
      when actor.role = 'team_lead' then private.can_access_company(target_company_id)
      else actor.role = 'client_admin' and actor.company_id = target_company_id
     end
     from public.users actor
     where actor.id = (select auth.uid())
       and actor.status = 'active'),
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
      target_status::text in ('active', 'invited', 'disabled')
      and case
        when target_company_id is null then
          actor.role = 'platform_admin'
          and target_role in ('agent', 'team_lead', 'platform_admin')
        else
          target_role in ('client_admin', 'client_operator', 'client_viewer')
          and (
            actor.role = 'platform_admin'
            or (actor.role = 'team_lead' and private.can_access_company(target_company_id))
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
      when actor.role = 'team_lead' then
        target_company_id is not null and private.can_access_company(target_company_id)
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
          actor.role = 'platform_admin'
          or (actor.role = 'team_lead' and private.can_access_company(target_company_id))
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

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.can_manage_access_control() from public, anon;
revoke all on function private.can_manage_global_catalog() from public, anon;
revoke all on function private.can_access_company(uuid) from public, anon;
revoke all on function private.user_has_module_access(uuid, uuid, text, text) from public, anon;
revoke all on function private.has_module_access(uuid, text, text) from public, anon;
revoke all on function private.can_comment_on_company(uuid) from public, anon;
revoke all on function private.can_manage_company(uuid) from public, anon;
revoke all on function private.can_create_profile(uuid, public.user_role, public.user_status) from public, anon;
revoke all on function private.can_manage_profile(uuid, uuid) from public, anon;
revoke all on function private.can_update_profile(uuid, uuid, public.user_role, public.user_status) from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.can_manage_access_control() to authenticated;
grant execute on function private.can_manage_global_catalog() to authenticated;
grant execute on function private.can_access_company(uuid) to authenticated;
grant execute on function private.has_module_access(uuid, text, text) to authenticated;
grant execute on function private.can_comment_on_company(uuid) to authenticated;
grant execute on function private.can_manage_company(uuid) to authenticated;
grant execute on function private.can_create_profile(uuid, public.user_role, public.user_status) to authenticated;
grant execute on function private.can_manage_profile(uuid, uuid) to authenticated;
grant execute on function private.can_update_profile(uuid, uuid, public.user_role, public.user_status) to authenticated;

drop policy if exists "catalog managers update companies" on public.companies;
create policy "assigned catalog managers update companies"
on public.companies for update to authenticated
using (
  private.is_platform_admin()
  or (
    private.current_user_role() = 'team_lead'
    and private.can_access_company(id)
  )
)
with check (
  private.is_platform_admin()
  or (
    private.current_user_role() = 'team_lead'
    and private.can_access_company(id)
  )
);

drop policy if exists "catalog managers delete companies" on public.companies;
create policy "platform admins delete companies"
on public.companies for delete to authenticated
using (private.is_platform_admin());

alter table public.portal_modules enable row level security;
alter table public.user_company_assignments enable row level security;
alter table public.user_module_permissions enable row level security;
alter table public.access_audit_log enable row level security;

create policy "active users read module catalog"
on public.portal_modules for select to authenticated
using (private.is_active_user());

drop policy if exists "active users read visible company modules" on public.company_modules;
drop policy if exists "catalog managers create company modules" on public.company_modules;
drop policy if exists "catalog managers update company modules" on public.company_modules;
drop policy if exists "catalog managers delete company modules" on public.company_modules;
create policy "users read permitted company modules"
on public.company_modules for select to authenticated
using (
  private.is_active_user()
  and private.can_access_company(company_id)
  and (
    private.is_platform_admin()
    or (
      company_modules.enabled
      and exists (
      select 1 from public.user_module_permissions permission
      where permission.user_id = (select auth.uid())
        and permission.company_id = company_modules.company_id
        and permission.module = company_modules.module
      )
    )
  )
);

create policy "users read own company assignments"
on public.user_company_assignments for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_admin());

create policy "users read own module permissions"
on public.user_module_permissions for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_admin());

create policy "platform admins read access audit"
on public.access_audit_log for select to authenticated
using (private.is_platform_admin());

revoke all on public.portal_modules from public, anon, authenticated;
revoke all on public.company_modules from public, anon, authenticated;
revoke all on public.user_company_assignments from public, anon, authenticated;
revoke all on public.user_module_permissions from public, anon, authenticated;
revoke all on public.access_audit_log from public, anon, authenticated;
grant select on public.portal_modules to authenticated;
grant select on public.company_modules to authenticated;
grant select on public.user_company_assignments to authenticated;
grant select on public.user_module_permissions to authenticated;
grant select on public.access_audit_log to authenticated;

-- Business mutations stay RPC-only; repeat the cutover explicitly in this boundary.
revoke insert, update on public.tickets from authenticated;
revoke insert on public.ticket_comments from authenticated;
revoke insert on public.ticket_attachments from authenticated;
revoke insert on public.ticket_history from authenticated;

drop policy if exists "active users read visible profiles" on public.users;
create policy "active users read visible profiles"
on public.users for select to authenticated
using (
  private.is_active_user()
  and (
    id = (select auth.uid())
    or private.is_platform_admin()
    or (company_id is not null and private.can_access_company(company_id))
    or (company_id is null and private.is_internal_user())
  )
);

drop policy if exists "authenticated users read visible tickets" on public.tickets;
create policy "authenticated users read visible tickets"
on public.tickets for select to authenticated
using (private.has_module_access(company_id, 'support', 'view'));

drop policy if exists "client editors create own company tickets" on public.tickets;
create policy "support operators create company tickets"
on public.tickets for insert to authenticated
with check (
  created_by_id = (select auth.uid())
  and private.has_module_access(company_id, 'support', 'operate')
  and company_id = private.current_company_id()
);

drop policy if exists "internal operators update tickets" on public.tickets;
create policy "support operators update tickets"
on public.tickets for update to authenticated
using (
  private.is_internal_user()
  and private.has_module_access(company_id, 'support', 'operate')
)
with check (
  private.is_internal_user()
  and private.has_module_access(company_id, 'support', 'operate')
);

drop policy if exists "authenticated users read visible comments" on public.ticket_comments;
create policy "support viewers read visible comments"
on public.ticket_comments for select to authenticated
using (
  private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'view'
  )
  and (visibility = 'external' or private.is_internal_user())
);

drop policy if exists "authorized users create comments" on public.ticket_comments;
create policy "support operators create comments"
on public.ticket_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'operate'
  )
  and (visibility = 'external' or private.is_internal_user())
);

drop policy if exists "authenticated users read visible attachments" on public.ticket_attachments;
create policy "support viewers read attachments"
on public.ticket_attachments for select to authenticated
using (
  private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'view'
  )
  and (
    comment_id is null
    or exists (
      select 1 from public.ticket_comments comment
      where comment.id = ticket_attachments.comment_id
        and comment.ticket_id = ticket_attachments.ticket_id
        and (comment.visibility = 'external' or private.is_internal_user())
    )
  )
);

drop policy if exists "authorized users create attachment metadata" on public.ticket_attachments;
create policy "support operators create attachment metadata"
on public.ticket_attachments for insert to authenticated
with check (
  uploaded_by_id = (select auth.uid())
  and private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'operate'
  )
  and (
    comment_id is null
    or exists (
      select 1 from public.ticket_comments comment
      where comment.id = ticket_attachments.comment_id
        and comment.ticket_id = ticket_attachments.ticket_id
        and comment.author_id = (select auth.uid())
    )
  )
);

drop policy if exists "authenticated users read visible history" on public.ticket_history;
create policy "support viewers read history"
on public.ticket_history for select to authenticated
using (
  private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'view'
  )
  and (visibility = 'external' or private.is_internal_user())
);

drop policy if exists "authorized users create history" on public.ticket_history;
create policy "support operators create history"
on public.ticket_history for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and private.has_module_access(
    (select company_id from public.tickets where id = ticket_id),
    'support',
    'operate'
  )
);

drop policy if exists "ticket attachment read" on storage.objects;
drop policy if exists "ticket attachment upload" on storage.objects;
drop policy if exists "ticket attachment delete" on storage.objects;

create policy "ticket attachment read"
on storage.objects for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.ticket_attachments attachment
    join public.tickets ticket on ticket.id = attachment.ticket_id
    left join public.ticket_comments comment on comment.id = attachment.comment_id
    where attachment.storage_path = storage.objects.name
      and private.has_module_access(ticket.company_id, 'support', 'view')
      and (
        attachment.comment_id is null
        or comment.visibility = 'external'
        or private.is_internal_user()
      )
  )
);

create policy "ticket attachment upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and private.has_module_access((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ), 'support', 'operate')
);

create policy "ticket attachment delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and owner_id = (select auth.uid())::text
  and private.has_module_access((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ), 'support', 'operate')
);

create or replace function private.enforce_access_control_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'company_modules'
    and tg_op = 'UPDATE'
    and old.company_id = new.company_id
    and old.module = new.module
    and old.enabled = new.enabled
  then
    if not private.can_manage_access_control()
      and not private.has_module_access(new.company_id, new.module, 'admin')
    then
      raise exception 'No autorizado para administrar la configuración del módulo.' using errcode = '42501';
    end if;
    return new;
  end if;

  if not private.can_manage_access_control() then
    raise exception 'Sólo un administrador de plataforma puede cambiar accesos.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;

create or replace function private.audit_access_control_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  record_value jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  audit_reason text := nullif(current_setting('nexops.access_reason', true), '');
begin
  if actor_id is null then
    raise exception 'Los cambios de acceso requieren una identidad autenticada.' using errcode = '42501';
  end if;

  insert into public.access_audit_log (
    actor_user_id,
    company_id,
    target_user_id,
    module,
    action,
    previous_value,
    new_value,
    reason
  ) values (
    actor_id,
    nullif(record_value ->> 'company_id', '')::uuid,
    nullif(record_value ->> 'user_id', '')::uuid,
    nullif(record_value ->> 'module', ''),
    tg_table_name || '.' || lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    audit_reason
  );
  return coalesce(new, old);
end
$$;

create or replace function private.seed_company_modules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_modules (company_id, module, enabled)
  select new.id, module.key, module.key = 'support'
  from public.portal_modules module
  where module.active;
  return new;
end
$$;

create or replace function private.reject_access_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'La auditoría de accesos es inmutable.' using errcode = '42501';
end
$$;

revoke all on function private.enforce_access_control_write() from public, anon, authenticated;
revoke all on function private.audit_access_control_write() from public, anon, authenticated;
revoke all on function private.seed_company_modules() from public, anon, authenticated;
revoke all on function private.reject_access_audit_mutation() from public, anon, authenticated;

create trigger enforce_company_module_write
before insert or update or delete on public.company_modules
for each row execute function private.enforce_access_control_write();
create trigger audit_company_module_write
after insert or update or delete on public.company_modules
for each row execute function private.audit_access_control_write();
create trigger enforce_user_company_assignment_write
before insert or update or delete on public.user_company_assignments
for each row execute function private.enforce_access_control_write();
create trigger audit_user_company_assignment_write
after insert or update or delete on public.user_company_assignments
for each row execute function private.audit_access_control_write();
create trigger enforce_user_module_permission_write
before insert or update or delete on public.user_module_permissions
for each row execute function private.enforce_access_control_write();
create trigger audit_user_module_permission_write
after insert or update or delete on public.user_module_permissions
for each row execute function private.audit_access_control_write();
create trigger seed_company_modules
after insert on public.companies
for each row execute function private.seed_company_modules();
create trigger reject_access_audit_mutation
before update or delete on public.access_audit_log
for each row execute function private.reject_access_audit_mutation();

revoke all on public.access_audit_log from service_role;

create or replace function private.enforce_support_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_company_id uuid;
begin
  if tg_table_name = 'tickets'
    and tg_op = 'UPDATE'
    and not private.is_internal_user()
  then
    raise exception 'Sólo un integrante interno puede actualizar el flujo del ticket.' using errcode = '42501';
  end if;

  if tg_table_name = 'tickets' then
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

  if tg_table_name = 'tickets'
    and new.assigned_to_id is not null
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
  return new;
end
$$;

revoke all on function private.enforce_support_operation() from public, anon, authenticated;
create trigger enforce_ticket_support_operation
before insert or update on public.tickets
for each row execute function private.enforce_support_operation();
create trigger enforce_comment_support_operation
before insert on public.ticket_comments
for each row execute function private.enforce_support_operation();
create trigger enforce_attachment_support_operation
before insert on public.ticket_attachments
for each row execute function private.enforce_support_operation();
create trigger enforce_history_support_operation
before insert on public.ticket_history
for each row execute function private.enforce_support_operation();

create or replace function public.create_ticket_with_history(
  request_creation_key uuid,
  ticket_title text,
  ticket_description text,
  ticket_context_urls text[],
  ticket_type public.ticket_type,
  ticket_area public.ticket_area
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.users%rowtype;
  created_ticket public.tickets%rowtype;
  inserted_ticket boolean := false;
begin
  select * into actor_profile
  from public.users
  where id = (select auth.uid())
    and status = 'active';

  if not found
    or actor_profile.company_id is null
    or not private.has_module_access(actor_profile.company_id, 'support', 'operate')
  then
    raise exception 'No autorizado para crear tickets.' using errcode = '42501';
  end if;
  if request_creation_key is null then
    raise exception 'Clave de idempotencia inválida.';
  end if;
  if ticket_title is null or char_length(btrim(ticket_title)) not between 1 and 160 then
    raise exception 'Título inválido.';
  end if;
  if ticket_description is null or char_length(btrim(ticket_description)) not between 1 and 10000 then
    raise exception 'Descripción inválida.';
  end if;
  if coalesce(array_length(ticket_context_urls, 1), 0) > 3
    or exists (
      select 1 from unnest(coalesce(ticket_context_urls, '{}'::text[])) as item
      where item is null
        or char_length(item) > 2048
        or item !~* '^https?://[^[:space:]]+$'
    )
  then
    raise exception 'Links de contexto inválidos.';
  end if;

  insert into public.tickets (
    company_id, title, description, context_urls, type, area,
    priority, status, created_by_id, assigned_to_id, creation_key
  ) values (
    actor_profile.company_id, btrim(ticket_title), btrim(ticket_description),
    coalesce(ticket_context_urls, '{}'::text[]), ticket_type, ticket_area,
    'medium', 'new', actor_profile.id, null, request_creation_key
  )
  on conflict (created_by_id, creation_key) do nothing
  returning * into created_ticket;

  if found then
    inserted_ticket := true;
  else
    select * into created_ticket
    from public.tickets
    where created_by_id = actor_profile.id
      and creation_key = request_creation_key;
  end if;
  if created_ticket.id is null then
    raise exception 'No se pudo crear el ticket.';
  end if;

  if inserted_ticket then
    insert into public.ticket_history (ticket_id, actor_id, event_type, message)
    values (
      created_ticket.id,
      actor_profile.id,
      'created',
      actor_profile.name || ' creó el ticket ' || created_ticket.code || '.'
    );
  end if;

  return jsonb_build_object('ticket', to_jsonb(created_ticket), 'created', inserted_ticket);
end
$$;

create or replace function public.register_ticket_attachment(
  target_ticket_id uuid,
  attachment_storage_path text,
  attachment_file_name text,
  attachment_size_bytes bigint,
  attachment_mime_type text
)
returns public.ticket_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.users%rowtype;
  ticket_company_id uuid;
  attachment_record public.ticket_attachments%rowtype;
begin
  select * into actor_profile
  from public.users
  where id = (select auth.uid()) and status = 'active';
  select company_id into ticket_company_id from public.tickets where id = target_ticket_id;

  if actor_profile.id is null
    or ticket_company_id is null
    or not private.has_module_access(ticket_company_id, 'support', 'operate')
  then
    raise exception 'No autorizado para adjuntar archivos.' using errcode = '42501';
  end if;

  if attachment_storage_path is null
    or attachment_file_name is null
    or attachment_size_bytes is null
    or attachment_mime_type is null
    or attachment_storage_path not like ('tickets/' || target_ticket_id::text || '/%')
    or attachment_storage_path like ('tickets/' || target_ticket_id::text || '/comments/%')
    or char_length(attachment_storage_path) > 1024
    or char_length(btrim(attachment_file_name)) not between 1 and 255
    or attachment_size_bytes not between 1 and 10485760
    or attachment_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'ticket-attachments'
        and name = attachment_storage_path
        and owner_id = actor_profile.id::text
    )
  then
    raise exception 'Metadatos de adjunto inválidos.';
  end if;

  insert into public.ticket_attachments (
    ticket_id, uploaded_by_id, storage_path, file_name, size_bytes, mime_type, kind
  ) values (
    target_ticket_id, actor_profile.id, attachment_storage_path,
    attachment_file_name, attachment_size_bytes, attachment_mime_type, 'screenshot'
  ) returning * into attachment_record;
  return attachment_record;
end
$$;

create or replace function public.create_ticket_comment_with_attachments(
  target_ticket_id uuid,
  comment_body text,
  comment_visibility public.comment_visibility,
  attachment_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_comment_id uuid;
  actor_profile public.users%rowtype;
  ticket_company_id uuid;
begin
  select * into actor_profile
  from public.users
  where id = (select auth.uid()) and status = 'active';
  select company_id into ticket_company_id from public.tickets where id = target_ticket_id;

  if actor_profile.id is null
    or ticket_company_id is null
    or not private.has_module_access(ticket_company_id, 'support', 'operate')
    or (comment_visibility = 'internal' and actor_profile.company_id is not null)
  then
    raise exception 'No autorizado para comentar.' using errcode = '42501';
  end if;
  if comment_body is null or char_length(btrim(comment_body)) not between 1 and 10000 then
    raise exception 'Comentario inválido.';
  end if;
  if jsonb_typeof(attachment_rows) <> 'array' or jsonb_array_length(attachment_rows) > 3 then
    raise exception 'Cantidad de imágenes inválida.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(attachment_rows) as item(
      storage_path text, file_name text, size_bytes bigint, mime_type text
    )
    where item.storage_path not like ('tickets/' || target_ticket_id::text || '/comments/%')
      or char_length(item.storage_path) > 1024
      or char_length(btrim(item.file_name)) not between 1 and 255
      or item.size_bytes not between 1 and 10485760
      or item.mime_type not in ('image/jpeg', 'image/png', 'image/webp')
      or not exists (
        select 1 from storage.objects object
        where object.bucket_id = 'ticket-attachments'
          and object.name = item.storage_path
          and object.owner_id = actor_profile.id::text
      )
  )
  then
    raise exception 'Metadatos de imagen inválidos.';
  end if;

  insert into public.ticket_comments (ticket_id, author_id, visibility, body)
  values (target_ticket_id, actor_profile.id, comment_visibility, btrim(comment_body))
  returning id into new_comment_id;

  insert into public.ticket_attachments (
    ticket_id, comment_id, uploaded_by_id, storage_path, file_name, size_bytes, mime_type, kind
  )
  select target_ticket_id, new_comment_id, actor_profile.id,
    item.storage_path, item.file_name, item.size_bytes, item.mime_type, 'screenshot'
  from jsonb_to_recordset(attachment_rows) as item(
    storage_path text, file_name text, size_bytes bigint, mime_type text
  );

  insert into public.ticket_history (ticket_id, actor_id, event_type, message, visibility)
  values (
    target_ticket_id,
    actor_profile.id,
    'commented',
    actor_profile.name || ' agregó un comentario ' ||
      case when comment_visibility = 'internal' then 'interno.' else 'externo.' end,
    comment_visibility
  );
  return new_comment_id;
end
$$;

revoke all on function public.create_ticket_with_history(
  uuid, text, text, text[], public.ticket_type, public.ticket_area
) from public, anon, authenticated;
revoke all on function public.register_ticket_attachment(uuid, text, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.create_ticket_comment_with_attachments(
  uuid, text, public.comment_visibility, jsonb
) from public, anon, authenticated;
grant execute on function public.create_ticket_with_history(
  uuid, text, text, text[], public.ticket_type, public.ticket_area
) to authenticated;
grant execute on function public.register_ticket_attachment(uuid, text, text, bigint, text)
  to authenticated;
grant execute on function public.create_ticket_comment_with_attachments(
  uuid, text, public.comment_visibility, jsonb
) to authenticated;

create or replace function public.ticket_assignee_display_name(target_ticket_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.has_module_access(ticket.company_id, 'support', 'view') then null
    else (
      select profile.name
      from public.users profile
      where profile.id = ticket.assigned_to_id
        and profile.role in ('agent', 'team_lead', 'platform_admin')
    )
  end
  from public.tickets ticket
  where ticket.id = target_ticket_id
$$;

create or replace function public.ticket_assignee_display_names(target_ticket_ids uuid[])
returns table(ticket_id uuid, assignee_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select ticket.id, profile.name
  from public.tickets ticket
  join public.users profile on profile.id = ticket.assigned_to_id
  where ticket.id = any(target_ticket_ids)
    and private.has_module_access(ticket.company_id, 'support', 'view')
    and profile.role in ('agent', 'team_lead', 'platform_admin')
$$;

create or replace function public.support_assignee_ids(target_company_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id
  from public.users profile
  where private.is_internal_user()
    and private.has_module_access(target_company_id, 'support', 'operate')
    and profile.company_id is null
    and profile.status = 'active'
    and profile.role in ('agent', 'team_lead', 'platform_admin')
    and private.user_has_module_access(
      profile.id,
      target_company_id,
      'support',
      'operate'
    )
$$;

revoke all on function public.ticket_assignee_display_name(uuid) from public, anon, authenticated;
revoke all on function public.ticket_assignee_display_names(uuid[]) from public, anon, authenticated;
revoke all on function public.support_assignee_ids(uuid) from public, anon, authenticated;
grant execute on function public.ticket_assignee_display_name(uuid) to authenticated;
grant execute on function public.ticket_assignee_display_names(uuid[]) to authenticated;
grant execute on function public.support_assignee_ids(uuid) to authenticated;

create function public.set_company_modules(
  target_company_id uuid,
  module_updates jsonb,
  radar_workspace_id text default null,
  radar_site_integrated boolean default false,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  selected_module text;
  selected_enabled boolean;
  effective_radar_workspace text;
begin
  if not private.can_manage_access_control() then
    raise exception 'Sólo un administrador de plataforma puede habilitar productos.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = target_company_id) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;
  if jsonb_typeof(module_updates) <> 'array' or jsonb_array_length(module_updates) > 50 then
    raise exception 'La matriz de módulos no es válida.';
  end if;
  if change_reason is not null and char_length(change_reason) > 500 then
    raise exception 'El motivo es demasiado largo.';
  end if;
  if radar_workspace_id is not null
    and radar_workspace_id !~ '^[a-z0-9][a-z0-9._-]{2,80}$'
  then
    raise exception 'El workspace de Radar no es válido.';
  end if;

  perform set_config('nexops.access_reason', coalesce(change_reason, ''), true);
  for item in select value from jsonb_array_elements(module_updates)
  loop
    selected_module := item ->> 'module';
    if jsonb_typeof(item -> 'enabled') <> 'boolean' then
      raise exception 'El estado del módulo no es válido.';
    end if;
    selected_enabled := (item ->> 'enabled')::boolean;
    if not exists (select 1 from public.portal_modules where key = selected_module and active) then
      raise exception 'El módulo % no existe.', selected_module;
    end if;

    update public.company_modules
    set enabled = selected_enabled,
        updated_at = now()
    where company_id = target_company_id
      and module = selected_module
      and enabled is distinct from selected_enabled;
  end loop;

  select coalesce(radar_workspace_id, settings ->> 'workspaceId')
  into effective_radar_workspace
  from public.company_modules
  where company_id = target_company_id
    and module = 'radar';

  if exists (
    select 1 from public.company_modules
    where company_id = target_company_id
      and module = 'radar'
      and enabled
  ) and effective_radar_workspace is null
  then
    raise exception 'Configurá el workspace antes de habilitar Radar.';
  end if;

  update public.company_modules
  set settings = settings
      || case
        when radar_workspace_id is null then '{}'::jsonb
        else jsonb_build_object('workspaceId', radar_workspace_id)
      end
      || jsonb_build_object('siteIntegrated', radar_site_integrated),
      updated_at = now()
  where company_id = target_company_id
    and module = 'radar';
end
$$;

create function public.set_user_module_permissions(
  target_user_id uuid,
  target_company_id uuid,
  permission_updates jsonb,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.users%rowtype;
  item jsonb;
  selected_module text;
  selected_level text;
begin
  if not private.can_manage_access_control() then
    raise exception 'Sólo un administrador de plataforma puede conceder permisos.' using errcode = '42501';
  end if;
  select * into target_profile from public.users where id = target_user_id;
  if not found or target_profile.role = 'platform_admin' then
    raise exception 'El usuario objetivo no admite permisos explícitos.';
  end if;
  if target_profile.company_id is not null
    and target_profile.company_id <> target_company_id
  then
    raise exception 'Un usuario cliente no puede recibir acceso a otra empresa.' using errcode = '42501';
  end if;
  if target_profile.company_id is null
    and not exists (
      select 1 from public.user_company_assignments assignment
      where assignment.user_id = target_user_id
        and assignment.company_id = target_company_id
    )
  then
    raise exception 'Asigná primero la empresa al integrante interno.' using errcode = '42501';
  end if;
  if jsonb_typeof(permission_updates) <> 'array' or jsonb_array_length(permission_updates) > 50 then
    raise exception 'La matriz de permisos no es válida.';
  end if;
  if change_reason is not null and char_length(change_reason) > 500 then
    raise exception 'El motivo es demasiado largo.';
  end if;

  perform set_config('nexops.access_reason', coalesce(change_reason, ''), true);
  for item in select value from jsonb_array_elements(permission_updates)
  loop
    selected_module := item ->> 'module';
    selected_level := item ->> 'level';
    if not exists (
      select 1 from public.company_modules
      where company_id = target_company_id and module = selected_module
    ) then
      raise exception 'El módulo % no pertenece a la empresa.', selected_module;
    end if;

    if selected_level = 'none' then
      delete from public.user_module_permissions
      where user_id = target_user_id
        and company_id = target_company_id
        and module = selected_module;
    elsif selected_level in ('view', 'operate', 'admin') then
      insert into public.user_module_permissions (
        user_id, company_id, module, access_level, granted_by
      ) values (
        target_user_id, target_company_id, selected_module, selected_level, (select auth.uid())
      )
      on conflict (user_id, company_id, module) do update
      set access_level = excluded.access_level,
          granted_by = excluded.granted_by,
          updated_at = now()
      where public.user_module_permissions.access_level is distinct from excluded.access_level;
    else
      raise exception 'El nivel % no es válido.', selected_level;
    end if;
  end loop;
end
$$;

create function public.set_internal_company_access(
  target_user_id uuid,
  target_company_id uuid,
  company_assigned boolean,
  permission_updates jsonb,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.users%rowtype;
begin
  if not private.can_manage_access_control() then
    raise exception 'Sólo un administrador de plataforma puede asignar empresas.' using errcode = '42501';
  end if;
  select * into target_profile from public.users where id = target_user_id;
  if not found
    or target_profile.company_id is not null
    or target_profile.role not in ('agent', 'team_lead')
  then
    raise exception 'La asignación sólo admite integrantes internos no globales.';
  end if;
  if not exists (select 1 from public.companies where id = target_company_id) then
    raise exception 'No pudimos encontrar la empresa.';
  end if;
  if change_reason is not null and char_length(change_reason) > 500 then
    raise exception 'El motivo es demasiado largo.';
  end if;

  perform set_config('nexops.access_reason', coalesce(change_reason, ''), true);
  if not company_assigned then
    delete from public.user_module_permissions
    where user_id = target_user_id and company_id = target_company_id;
    delete from public.user_company_assignments
    where user_id = target_user_id and company_id = target_company_id;
    return;
  end if;

  insert into public.user_company_assignments (
    user_id, company_id, assigned_by
  ) values (
    target_user_id, target_company_id, (select auth.uid())
  ) on conflict (user_id, company_id) do nothing;

  perform public.set_user_module_permissions(
    target_user_id,
    target_company_id,
    permission_updates,
    change_reason
  );
end
$$;

create function public.update_radar_preferences(
  target_company_id uuid,
  radar_topics text[],
  radar_publications_per_week integer,
  radar_opportunity_behavior text,
  radar_publishing_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_topics text[];
  radar_settings jsonb;
begin
  if not private.has_module_access(target_company_id, 'radar', 'admin') then
    raise exception 'No autorizado para administrar Radar en esta empresa.' using errcode = '42501';
  end if;

  if radar_topics is null
    or cardinality(radar_topics) not between 1 and 8
    or exists (
      select 1
      from unnest(radar_topics) as topic
      where topic is null
        or char_length(btrim(topic)) not between 2 and 50
        or topic ~ '[[:cntrl:]]'
    )
    or (
      select count(distinct lower(btrim(topic)))
      from unnest(radar_topics) as topic
    ) <> cardinality(radar_topics)
  then
    raise exception 'Las temáticas de Radar no son válidas.';
  end if;

  if radar_publications_per_week not between 1 and 5 then
    raise exception 'La frecuencia semanal no es válida.';
  end if;
  if radar_opportunity_behavior not in ('discard', 'suggest') then
    raise exception 'La decisión sobre oportunidades no es válida.';
  end if;
  if radar_publishing_mode not in ('review', 'automatic') then
    raise exception 'El modo de publicación no es válido.';
  end if;

  select settings into radar_settings
  from public.company_modules
  where company_id = target_company_id
    and module = 'radar'
    and enabled
  for update;

  if not found then
    raise exception 'Radar no está habilitado para esta empresa.';
  end if;
  if radar_publishing_mode = 'automatic'
    and not (radar_settings @> '{"siteIntegrated": true}'::jsonb)
  then
    raise exception 'La publicación automática requiere un sitio conectado por NexOps.';
  end if;

  select array_agg(btrim(topic) order by position)
  into cleaned_topics
  from unnest(radar_topics) with ordinality as selected(topic, position);

  update public.company_modules
  set settings = settings || jsonb_build_object(
        'topics', to_jsonb(cleaned_topics),
        'publicationsPerWeek', radar_publications_per_week,
        'opportunityBehavior', radar_opportunity_behavior,
        'publishingMode', radar_publishing_mode
      ),
      updated_at = now()
  where company_id = target_company_id
    and module = 'radar';
end
$$;

revoke all on function public.set_company_modules(uuid, jsonb, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.set_user_module_permissions(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.set_internal_company_access(uuid, uuid, boolean, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.update_radar_preferences(uuid, text[], integer, text, text)
  from public, anon, authenticated;
grant execute on function public.set_company_modules(uuid, jsonb, text, boolean, text)
  to authenticated;
grant execute on function public.set_user_module_permissions(uuid, uuid, jsonb, text)
  to authenticated;
grant execute on function public.set_internal_company_access(uuid, uuid, boolean, jsonb, text)
  to authenticated;
grant execute on function public.update_radar_preferences(uuid, text[], integer, text, text)
  to authenticated;

-- Legacy entitlement RPCs are superseded because they do not model the control plane.
revoke execute on function public.update_company_module_availability(uuid, boolean, boolean)
  from authenticated;
revoke execute on function public.update_company_module_configuration(uuid, boolean, boolean, text, boolean)
  from authenticated;

comment on table public.user_company_assignments is
  'Companies an internal NexOps user may attend. Clients remain single-company through public.users.company_id.';
comment on table public.user_module_permissions is
  'Functional module level. Admin does not grant control-plane access.';
comment on table public.access_audit_log is
  'Append-only audit generated by protected triggers for entitlement, assignment and permission changes.';
