alter table public.tickets
add column if not exists context_urls text[] not null default '{}';

alter table public.tickets
drop constraint if exists tickets_context_urls_limit;

alter table public.tickets
add constraint tickets_context_urls_limit
check (coalesce(array_length(context_urls, 1), 0) <= 3);
