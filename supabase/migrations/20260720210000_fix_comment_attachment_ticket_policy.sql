-- Keep the metadata policy's ticket comparison explicitly correlated with the
-- attachment row. The composite FK already enforces this invariant; this policy
-- remains a clear second authorization barrier.
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
