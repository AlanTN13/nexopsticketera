alter table public.tickets
  add column if not exists creation_key uuid;

create unique index if not exists tickets_created_by_creation_key_unique
  on public.tickets (created_by_id, creation_key);

comment on column public.tickets.creation_key is
  'Browser-generated key used to make ticket creation retries idempotent.';
