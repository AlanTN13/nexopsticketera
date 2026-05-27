create extension if not exists "pgcrypto";

create type public.ticket_type as enum ('issue', 'improvement');
create type public.ticket_area as enum ('automation', 'custom_system', 'website', 'ai_agent', 'crm', 'erp');
create type public.ticket_priority as enum ('low', 'medium', 'high', 'critical');
create type public.ticket_status as enum ('new', 'analysis', 'in_progress', 'waiting_for_client', 'resolved', 'closed');
create type public.user_role as enum ('client_admin', 'client_operator', 'client_viewer', 'agent', 'team_lead', 'platform_admin');
create type public.user_status as enum ('active', 'invited');
create type public.comment_visibility as enum ('external', 'internal');
create type public.attachment_kind as enum ('brief', 'screenshot', 'log');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter',
  industry text,
  status text not null default 'active',
  primary_contact text,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  email text not null unique,
  role public.user_role not null,
  status public.user_status not null default 'invited',
  title text,
  avatar text,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text not null,
  type public.ticket_type not null,
  area public.ticket_area not null,
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'new',
  created_by_id uuid not null references public.users(id),
  assigned_to_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.users(id),
  visibility public.comment_visibility not null default 'external',
  body text not null,
  created_at timestamptz not null default now()
);

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uploaded_by_id uuid not null references public.users(id),
  storage_path text not null,
  file_name text not null,
  size_bytes bigint not null default 0,
  kind public.attachment_kind not null default 'screenshot',
  created_at timestamptz not null default now()
);

create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid not null references public.users(id),
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_user()
returns public.users
language sql
stable
as $$
  select *
  from public.users
  where id = auth.uid()
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('agent', 'team_lead', 'platform_admin')
  )
$$;

create or replace function public.can_access_ticket(ticket_company_id uuid)
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
        or company_id = ticket_company_id
      )
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
        role = 'platform_admin'
        or (role = 'client_admin' and company_id = target_company_id)
      )
  )
$$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_history enable row level security;

create policy "internal users can read companies"
on public.companies for select
using (public.is_internal_user());

create policy "users can read company peers"
on public.users for select
using (
  public.is_internal_user()
  or company_id = (select company_id from public.current_app_user())
);

create policy "client admins can manage company users"
on public.users for all
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy "tickets visible by tenant or internal"
on public.tickets for select
using (public.can_access_ticket(company_id));

create policy "clients create own company tickets"
on public.tickets for insert
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('client_admin', 'client_operator')
      and company_id = tickets.company_id
      and created_by_id = auth.uid()
  )
);

create policy "internal workflow updates"
on public.tickets for update
using (public.is_internal_user())
with check (public.is_internal_user());

create policy "comments visible by ticket access"
on public.ticket_comments for select
using (
  public.can_access_ticket((select company_id from public.tickets where id = ticket_id))
  and (
    visibility = 'external'
    or public.is_internal_user()
  )
);

create policy "allowed users can comment"
on public.ticket_comments for insert
with check (
  public.can_access_ticket((select company_id from public.tickets where id = ticket_id))
  and (
    visibility = 'external'
    or public.is_internal_user()
  )
);

create policy "attachments visible by ticket access"
on public.ticket_attachments for select
using (public.can_access_ticket((select company_id from public.tickets where id = ticket_id)));

create policy "attachments inserted by ticket access"
on public.ticket_attachments for insert
with check (public.can_access_ticket((select company_id from public.tickets where id = ticket_id)));

create policy "history visible by ticket access"
on public.ticket_history for select
using (public.can_access_ticket((select company_id from public.tickets where id = ticket_id)));

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;

create policy "ticket attachment read"
on storage.objects for select
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.ticket_attachments attachments
    join public.tickets tickets on tickets.id = attachments.ticket_id
    where attachments.storage_path = storage.objects.name
      and public.can_access_ticket(tickets.company_id)
  )
);

create policy "ticket attachment upload"
on storage.objects for insert
with check (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.ticket_attachments attachments
    join public.tickets tickets on tickets.id = attachments.ticket_id
    where attachments.storage_path = storage.objects.name
      and public.can_access_ticket(tickets.company_id)
  )
);

