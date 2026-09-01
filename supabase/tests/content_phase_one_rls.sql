-- Production-safe contract harness. Every fixture and assertion is rolled back.
begin;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub', id::text, 'role', 'authenticated')::text
   from public.users where role='platform_admin' and status='active' order by created_at limit 1),
  true
);

insert into auth.users (id,email) values
  ('11000000-0000-0000-0000-000000000001','content-a@test.invalid'),
  ('11000000-0000-0000-0000-000000000002','content-b@test.invalid');

insert into public.companies (id,name,slug) values
  ('21000000-0000-0000-0000-000000000001','Content Tenant A','content-rls-a'),
  ('21000000-0000-0000-0000-000000000002','Content Tenant B','content-rls-b');

insert into public.users (id,company_id,name,email,role,status) values
  ('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Content Admin A','content-a@test.invalid','client_admin','active'),
  ('11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','Content Viewer B','content-b@test.invalid','client_viewer','active');

select public.set_company_modules('21000000-0000-0000-0000-000000000001','[{"module":"content","enabled":true}]'::jsonb,null,false,'Content contract A');
select public.set_company_modules('21000000-0000-0000-0000-000000000002','[{"module":"content","enabled":true}]'::jsonb,null,false,'Content contract B');
select public.set_user_module_permissions('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','[{"module":"content","level":"admin"}]'::jsonb,'Content contract A');
select public.set_user_module_permissions('11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','[{"module":"content","level":"view"}]'::jsonb,'Content contract B');

do $$
begin
  if (select count(*) from public.content_workspaces where company_id in (
    '21000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000002'
  )) <> 2 then raise exception 'ASSERTION FAILED: content enablement must provision both workspaces'; end if;
  if has_column_privilege('authenticated','public.content_account_snapshots','raw_payload','select')
    or has_column_privilege('authenticated','public.content_instagram_media','raw_payload','select')
    or has_column_privilege('authenticated','public.content_media_metric_snapshots','raw_metrics','select')
  then raise exception 'ASSERTION FAILED: authenticated must not read raw Meta payloads'; end if;
  if has_table_privilege('authenticated','public.content_meta_credentials','select')
  then raise exception 'ASSERTION FAILED: authenticated must not read Meta credentials'; end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.content_workspaces) <> 1 then
    raise exception 'ASSERTION FAILED: tenant A must see only its workspace';
  end if;
  begin
    perform raw_payload from public.content_account_snapshots limit 1;
    raise exception 'ASSERTION FAILED: tenant A read raw account payload';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.content_meta_credentials limit 1;
    raise exception 'ASSERTION FAILED: tenant A read Meta credentials';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

insert into public.content_instagram_connections (id,workspace_id,company_id,status,enabled)
select '31000000-0000-0000-0000-000000000001',id,company_id,'authorization_required',true
from public.content_workspaces where company_id='21000000-0000-0000-0000-000000000001';

select public.set_content_pending_selection(
  '31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',
  (select id from public.content_workspaces where company_id='21000000-0000-0000-0000-000000000001'),
  (select id from public.users where role='platform_admin' and status='active' order by created_at limit 1),
  'cipher-pending','v24.0'
);

select public.finalize_content_meta_connection(
  '31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',
  (select id from public.content_workspaces where company_id='21000000-0000-0000-0000-000000000001'),
  (select id from public.users where role='platform_admin' and status='active' order by created_at limit 1),
  'page-a','Page A','ig-own-a','own.a',array['pages_show_list','pages_read_engagement','instagram_basic','instagram_manage_insights'],
  now()+interval '30 days','cipher-token','v24.0'
);

do $$
declare ws uuid; actor uuid; claimed record; observed_account uuid; result record;
begin
  select id into ws from public.content_workspaces where company_id='21000000-0000-0000-0000-000000000001';
  select id into actor from public.users where role='platform_admin' and status='active' order by created_at limit 1;
  if not exists(select 1 from public.content_meta_credentials where connection_id='31000000-0000-0000-0000-000000000001' and token_ciphertext='cipher-token' and pending_selection_ciphertext is null)
  then raise exception 'ASSERTION FAILED: connection finalization must atomically replace pending credentials'; end if;
  if not exists(select 1 from public.content_instagram_accounts where workspace_id=ws and account_kind='own' and instagram_account_id='ig-own-a')
  then raise exception 'ASSERTION FAILED: finalization must provision the own account'; end if;

  insert into public.content_instagram_accounts(workspace_id,company_id,account_kind,username,created_by)
  values(ws,'21000000-0000-0000-0000-000000000001','competitor','competitor.one',actor) returning id into observed_account;

  select * into claimed from public.claim_content_sync(
    '21000000-0000-0000-0000-000000000001',ws,'manual','content-contract-run',actor,'meta-graph-v1'
  );
  if not claimed.acquired or claimed.lease_token is null then raise exception 'ASSERTION FAILED: manual claim must acquire a fenced lease'; end if;

  insert into public.content_sync_run_accounts(run_id,account_id,workspace_id,company_id,lease_token,status,started_at)
  values(claimed.run_id,observed_account,ws,'21000000-0000-0000-0000-000000000001',claimed.lease_token,'pending',now());

  perform public.persist_content_account_observation(
    claimed.run_id,claimed.lease_token,'21000000-0000-0000-0000-000000000001',ws,observed_account,
    'meta-graph-v1',now(),'{"id":"ig-observed-a","username":"competitor.one","followers_count":42,"media_count":1}'::jsonb
  );
  select * into result from public.persist_content_media_observation(
    claimed.run_id,claimed.lease_token,'21000000-0000-0000-0000-000000000001',ws,observed_account,
    'meta-graph-v1',now(),'{"id":"media-a","media_type":"IMAGE","timestamp":"2026-09-01T00:00:00Z"}'::jsonb,
    '{"like_count":5,"comments_count":1,"reach":10}'::jsonb,'hash-a'
  );
  if not result.created or not result.snapshot_created then raise exception 'ASSERTION FAILED: first media observation must create identity and snapshot'; end if;
  select * into result from public.persist_content_media_observation(
    claimed.run_id,claimed.lease_token,'21000000-0000-0000-0000-000000000001',ws,observed_account,
    'meta-graph-v1',now(),'{"id":"media-a","media_type":"IMAGE","timestamp":"2026-09-01T00:00:00Z"}'::jsonb,
    '{"like_count":5,"comments_count":1,"reach":10}'::jsonb,'hash-a'
  );
  if result.created or result.snapshot_created then raise exception 'ASSERTION FAILED: replay must not duplicate media or unchanged metrics'; end if;
  if (select count(*) from public.content_instagram_media where workspace_id=ws and instagram_media_id='media-a') <> 1
    or (select count(*) from public.content_media_metric_snapshots where workspace_id=ws and metrics_hash='hash-a') <> 1
  then raise exception 'ASSERTION FAILED: observation persistence is not idempotent'; end if;

  update public.content_sync_runs set lease_expires_at=now()-interval '1 second' where id=claimed.run_id;
  begin
    perform public.persist_content_account_observation(
      claimed.run_id,claimed.lease_token,'21000000-0000-0000-0000-000000000001',ws,observed_account,
      'meta-graph-v1',now(),'{"username":"stale.worker"}'::jsonb
    );
    raise exception 'ASSERTION FAILED: stale lease wrote data';
  exception when sqlstate '55000' then null;
  end;
end
$$;

do $$
declare ws uuid; actor uuid; i integer;
begin
  select id into ws from public.content_workspaces where company_id='21000000-0000-0000-0000-000000000001';
  select id into actor from public.users where role='platform_admin' and status='active' order by created_at limit 1;
  for i in 2..5 loop
    insert into public.content_instagram_accounts(workspace_id,company_id,account_kind,username,created_by)
    values(ws,'21000000-0000-0000-0000-000000000001','competitor','competitor.'||i,actor);
  end loop;
  begin
    insert into public.content_instagram_accounts(workspace_id,company_id,account_kind,username,created_by)
    values(ws,'21000000-0000-0000-0000-000000000001','competitor','competitor.overflow',actor);
    raise exception 'ASSERTION FAILED: watchlist accepted a sixth competitor';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED:%' then raise; end if;
  end;
end
$$;

rollback;
