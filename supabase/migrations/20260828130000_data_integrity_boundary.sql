-- Client-readiness hardening: move auditable mutations behind narrow RPCs,
-- constrain user-controlled text/files, and set private bucket upload limits.

alter table public.tickets drop constraint if exists tickets_title_length;
alter table public.tickets add constraint tickets_title_length
  check (char_length(btrim(title)) between 1 and 160);
alter table public.tickets drop constraint if exists tickets_description_length;
alter table public.tickets add constraint tickets_description_length
  check (char_length(btrim(description)) between 1 and 10000);

alter table public.ticket_comments drop constraint if exists ticket_comments_body_length;
alter table public.ticket_comments add constraint ticket_comments_body_length
  check (char_length(btrim(body)) between 1 and 10000);

alter table public.ticket_history drop constraint if exists ticket_history_event_type_allowed;
alter table public.ticket_history add constraint ticket_history_event_type_allowed
  check (event_type in ('created', 'status_changed', 'priority_changed', 'assigned', 'commented'));
alter table public.ticket_history drop constraint if exists ticket_history_message_length;
alter table public.ticket_history add constraint ticket_history_message_length
  check (char_length(btrim(message)) between 1 and 500);

alter table public.ticket_attachments drop constraint if exists ticket_attachments_file_metadata_valid;
alter table public.ticket_attachments add constraint ticket_attachments_file_metadata_valid
  check (
    char_length(btrim(file_name)) between 1 and 255
    and char_length(storage_path) between 1 and 1024
    and size_bytes between 1 and 10485760
    and (
      (mime_type is not null and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
      or (storage_path like 'seed/%' and mime_type is null)
    )
  );

alter table public.users drop constraint if exists users_profile_text_lengths;
alter table public.users add constraint users_profile_text_lengths
  check (
    char_length(btrim(name)) between 1 and 120
    and char_length(btrim(email)) between 3 and 254
    and char_length(coalesce(title, '')) <= 120
    and char_length(coalesce(avatar, '')) <= 16
  );

alter table public.companies drop constraint if exists companies_profile_text_lengths;
alter table public.companies add constraint companies_profile_text_lengths
  check (
    char_length(btrim(name)) between 1 and 160
    and char_length(slug) between 1 and 160
    and char_length(coalesce(industry, '')) <= 160
    and char_length(coalesce(primary_contact, '')) <= 254
  );

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'ticket-attachments';

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
    or actor_profile.role not in ('client_admin', 'client_operator') then
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
    ) then
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

  return jsonb_build_object(
    'ticket', to_jsonb(created_ticket),
    'created', inserted_ticket
  );
end
$$;

revoke all on function public.create_ticket_with_history(
  uuid, text, text, text[], public.ticket_type, public.ticket_area
) from public, anon;
grant execute on function public.create_ticket_with_history(
  uuid, text, text, text[], public.ticket_type, public.ticket_area
) to authenticated;

create or replace function public.update_ticket_workflow_with_history(
  target_ticket_id uuid,
  next_status public.ticket_status,
  next_priority public.ticket_priority,
  next_assigned_to_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.users%rowtype;
  current_ticket public.tickets%rowtype;
  assignee_profile public.users%rowtype;
  status_history_id uuid := null;
begin
  select * into actor_profile
  from public.users
  where id = (select auth.uid())
    and status = 'active'
    and role in ('agent', 'team_lead', 'platform_admin');
  if not found then
    raise exception 'No autorizado para actualizar el workflow.' using errcode = '42501';
  end if;

  select * into current_ticket
  from public.tickets
  where id = target_ticket_id
  for update;
  if not found then
    raise exception 'Ticket inexistente.';
  end if;

  if next_assigned_to_id is not null then
    select * into assignee_profile
    from public.users
    where id = next_assigned_to_id
      and company_id is null
      and status = 'active'
      and role in ('agent', 'team_lead', 'platform_admin');
    if not found then
      raise exception 'Responsable inválido.';
    end if;
  end if;

  update public.tickets
  set status = next_status,
      priority = next_priority,
      assigned_to_id = next_assigned_to_id,
      updated_at = now()
  where id = current_ticket.id;

  if current_ticket.status is distinct from next_status then
    status_history_id := gen_random_uuid();
    insert into public.ticket_history (id, ticket_id, actor_id, event_type, message)
    values (
      status_history_id, current_ticket.id, actor_profile.id, 'status_changed',
      actor_profile.name || ' cambió el estado a ' || next_status::text || '.'
    );
  end if;
  if current_ticket.priority is distinct from next_priority then
    insert into public.ticket_history (ticket_id, actor_id, event_type, message)
    values (
      current_ticket.id, actor_profile.id, 'priority_changed',
      actor_profile.name || ' cambió la prioridad a ' || next_priority::text || '.'
    );
  end if;
  if current_ticket.assigned_to_id is distinct from next_assigned_to_id then
    insert into public.ticket_history (ticket_id, actor_id, event_type, message)
    values (
      current_ticket.id, actor_profile.id, 'assigned',
      case
        when next_assigned_to_id is null then actor_profile.name || ' dejó el ticket sin asignar.'
        else actor_profile.name || ' asignó el ticket a ' || assignee_profile.name || '.'
      end
    );
  end if;

  return status_history_id;
end
$$;

revoke all on function public.update_ticket_workflow_with_history(
  uuid, public.ticket_status, public.ticket_priority, uuid
) from public, anon;
grant execute on function public.update_ticket_workflow_with_history(
  uuid, public.ticket_status, public.ticket_priority, uuid
) to authenticated;

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
    or not (
      actor_profile.role in ('agent', 'team_lead', 'platform_admin')
      or (
        actor_profile.role in ('client_admin', 'client_operator')
        and actor_profile.company_id = ticket_company_id
      )
    ) then
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
    ) then
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

revoke all on function public.register_ticket_attachment(uuid, text, text, bigint, text)
  from public, anon;
grant execute on function public.register_ticket_attachment(uuid, text, text, bigint, text)
  to authenticated;

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
    or not (
      actor_profile.role in ('agent', 'team_lead', 'platform_admin')
      or (
        actor_profile.role in ('client_admin', 'client_operator')
        and actor_profile.company_id = ticket_company_id
      )
    )
    or (comment_visibility = 'internal' and actor_profile.role not in ('agent', 'team_lead', 'platform_admin')) then
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
  ) then
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

  insert into public.ticket_history (ticket_id, actor_id, event_type, message)
  values (
    target_ticket_id,
    actor_profile.id,
    'commented',
    actor_profile.name || ' agregó un comentario ' ||
      case when comment_visibility = 'internal' then 'interno.' else 'externo.' end
  );

  return new_comment_id;
end
$$;

revoke all on function public.create_ticket_comment_with_attachments(
  uuid, text, public.comment_visibility, jsonb
) from public, anon;
grant execute on function public.create_ticket_comment_with_attachments(
  uuid, text, public.comment_visibility, jsonb
) to authenticated;
