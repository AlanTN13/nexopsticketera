-- Conversation attachments remain in the existing private bucket. This is additive:
-- historical ticket attachments keep comment_id = null.

alter table public.ticket_comments
  add constraint ticket_comments_id_ticket_id_unique unique (id, ticket_id);

alter table public.ticket_attachments
  add column if not exists comment_id uuid,
  add column if not exists mime_type text;

alter table public.ticket_attachments
  add constraint ticket_attachments_comment_ticket_fk
  foreign key (comment_id, ticket_id)
  references public.ticket_comments(id, ticket_id)
  on delete cascade;

alter table public.ticket_attachments
  add constraint ticket_attachments_safe_image_mime
  check (comment_id is null or mime_type in ('image/jpeg', 'image/png', 'image/webp'));

create index if not exists ticket_attachments_comment_id_idx
  on public.ticket_attachments(comment_id);

-- A safe, intentionally narrow projection for the client portal. It never exposes
-- an internal profile row, email, role, or identifier.
create or replace function public.ticket_assignee_display_name(target_ticket_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.can_access_company(t.company_id) then null
    else (
      select u.name
      from public.users u
      where u.id = t.assigned_to_id
        and u.role in ('agent', 'team_lead', 'platform_admin')
    )
  end
  from public.tickets t
  where t.id = target_ticket_id
$$;

revoke all on function public.ticket_assignee_display_name(uuid) from public, anon;
grant execute on function public.ticket_assignee_display_name(uuid) to authenticated;

-- Storage upload happens first; this function then commits the comment, attachment
-- metadata and history atomically. A failed call leaves no database references and
-- the server action compensates by deleting the uploaded objects.
create or replace function public.create_ticket_comment_with_attachments(
  target_ticket_id uuid,
  comment_body text,
  comment_visibility public.comment_visibility,
  attachment_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_comment_id uuid;
  actor_name text;
begin
  if nullif(btrim(comment_body), '') is null then
    raise exception 'El comentario no puede estar vacío.';
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
      or item.size_bytes <= 0
      or item.size_bytes > 10485760
      or item.mime_type not in ('image/jpeg', 'image/png', 'image/webp')
  ) then
    raise exception 'Metadatos de imagen inválidos.';
  end if;

  select name into actor_name from public.users where id = (select auth.uid());
  insert into public.ticket_comments (ticket_id, author_id, visibility, body)
  values (target_ticket_id, (select auth.uid()), comment_visibility, comment_body)
  returning id into new_comment_id;

  insert into public.ticket_attachments (
    ticket_id, comment_id, uploaded_by_id, storage_path, file_name, size_bytes, mime_type, kind
  )
  select target_ticket_id, new_comment_id, (select auth.uid()),
    item.storage_path, item.file_name, item.size_bytes, item.mime_type, 'screenshot'
  from jsonb_to_recordset(attachment_rows) as item(
    storage_path text, file_name text, size_bytes bigint, mime_type text
  );

  insert into public.ticket_history (ticket_id, actor_id, event_type, message)
  values (
    target_ticket_id,
    (select auth.uid()),
    'commented',
    actor_name || ' agregó un comentario ' ||
      case when comment_visibility = 'internal' then 'interno.' else 'externo.' end
  );
  return new_comment_id;
end
$$;

revoke all on function public.create_ticket_comment_with_attachments(uuid, text, public.comment_visibility, jsonb) from public, anon;
grant execute on function public.create_ticket_comment_with_attachments(uuid, text, public.comment_visibility, jsonb) to authenticated;

drop policy if exists "authenticated users read visible attachments" on public.ticket_attachments;
create policy "authenticated users read visible attachments"
on public.ticket_attachments for select to authenticated
using (
  private.can_access_company((select company_id from public.tickets where id = ticket_id))
  and (
    comment_id is null
    or exists (
      select 1 from public.ticket_comments c
      where c.id = comment_id
        and (c.visibility = 'external' or private.is_internal_user())
    )
  )
);

drop policy if exists "authorized users create attachment metadata" on public.ticket_attachments;
create policy "authorized users create attachment metadata"
on public.ticket_attachments for insert to authenticated
with check (
  uploaded_by_id = (select auth.uid())
  and private.can_comment_on_company((select company_id from public.tickets where id = ticket_id))
  and (
    comment_id is null
    or exists (
      select 1 from public.ticket_comments c
      where c.id = comment_id
        and c.ticket_id = ticket_attachments.ticket_id
        and c.author_id = (select auth.uid())
    )
  )
);

drop policy if exists "ticket attachment read" on storage.objects;
create policy "ticket attachment read"
on storage.objects for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.ticket_attachments a
    join public.tickets t on t.id = a.ticket_id
    left join public.ticket_comments c on c.id = a.comment_id
    where a.storage_path = storage.objects.name
      and private.can_access_company(t.company_id)
      and (a.comment_id is null or c.visibility = 'external' or private.is_internal_user())
  )
);

drop policy if exists "ticket attachment delete" on storage.objects;
create policy "ticket attachment delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ticket-attachments'
  and owner_id = (select auth.uid())::text
  and private.can_comment_on_company((
    select company_id from public.tickets
    where id = private.ticket_id_from_storage_path(storage.objects.name)
  ))
);
