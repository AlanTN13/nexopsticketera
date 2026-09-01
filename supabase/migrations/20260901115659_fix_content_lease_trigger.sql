-- Resolve the run identifier without dereferencing fields absent from a
-- particular fenced table's trigger record.
create or replace function private.enforce_content_lease()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare checked_run_id uuid;
begin
  if tg_table_name = 'content_instagram_media' then
    checked_run_id := (to_jsonb(new) ->> 'last_run_id')::uuid;
  else
    checked_run_id := (to_jsonb(new) ->> 'run_id')::uuid;
  end if;
  if not private.content_lease_active(checked_run_id, new.lease_token) then
    raise exception 'Content sync lease expired' using errcode='55000';
  end if;
  return new;
end
$$;

revoke all on function private.enforce_content_lease() from public, anon, authenticated;
