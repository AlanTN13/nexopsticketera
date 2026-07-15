-- Ticket codes are generated only during authenticated ticket creation.
-- PostgreSQL grants sequence access to PUBLIC by default, so revoke it explicitly.
revoke all on sequence public.ticket_code_seq from public, anon;
grant usage, select on sequence public.ticket_code_seq to authenticated;
