create or replace function public.persist_content_media_observation(
  target_run_id uuid, target_lease_token uuid, target_company_id uuid, target_workspace_id uuid,
  target_account_id uuid, target_adapter_version text, target_observed_at timestamptz,
  target_media jsonb, target_metrics jsonb, target_metrics_hash text
) returns table(media_id uuid, created boolean, snapshot_created boolean)
language plpgsql security definer set search_path = '' as $$
declare stored_id uuid; was_created boolean := false; made_snapshot boolean := false; latest_hash text;
begin
  if not private.content_lease_active(target_run_id,target_lease_token) then raise exception 'Content sync lease expired' using errcode='55000'; end if;
  insert into public.content_instagram_media(workspace_id,company_id,account_id,last_run_id,lease_token,
    instagram_media_id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,published_at,
    first_observed_at,last_observed_at,raw_payload)
  values(target_workspace_id,target_company_id,target_account_id,target_run_id,target_lease_token,
    target_media->>'id',target_media->>'caption',target_media->>'media_type',target_media->>'media_product_type',
    target_media->>'permalink',target_media->>'media_url',target_media->>'thumbnail_url',
    (target_media->>'timestamp')::timestamptz,target_observed_at,target_observed_at,target_media)
  on conflict(workspace_id,instagram_media_id) do nothing returning id into stored_id;
  if stored_id is not null then was_created := true;
  else
    update public.content_instagram_media set account_id=target_account_id,last_run_id=target_run_id,
      lease_token=target_lease_token,caption=target_media->>'caption',media_type=target_media->>'media_type',
      media_product_type=target_media->>'media_product_type',permalink=target_media->>'permalink',
      media_url=target_media->>'media_url',thumbnail_url=target_media->>'thumbnail_url',
      published_at=(target_media->>'timestamp')::timestamptz,last_observed_at=target_observed_at,
      raw_payload=target_media,updated_at=target_observed_at
    where workspace_id=target_workspace_id and instagram_media_id=target_media->>'id' returning id into stored_id;
  end if;
  select snapshot.metrics_hash into latest_hash from public.content_media_metric_snapshots snapshot
    where snapshot.company_id=target_company_id and snapshot.media_id=stored_id
    order by snapshot.observed_at desc limit 1;
  if latest_hash is distinct from target_metrics_hash then
    insert into public.content_media_metric_snapshots(workspace_id,company_id,media_id,run_id,lease_token,
      adapter_version,observed_at,like_count,comments_count,reach,views,saved,shares,total_interactions,metrics_hash,raw_metrics)
    values(target_workspace_id,target_company_id,stored_id,target_run_id,target_lease_token,target_adapter_version,
      target_observed_at,(target_metrics->>'like_count')::bigint,(target_metrics->>'comments_count')::bigint,
      (target_metrics->>'reach')::bigint,(target_metrics->>'views')::bigint,(target_metrics->>'saved')::bigint,
      (target_metrics->>'shares')::bigint,(target_metrics->>'total_interactions')::bigint,target_metrics_hash,target_metrics);
    made_snapshot := true;
  end if;
  return query select stored_id,was_created,made_snapshot;
end
$$;

revoke all on function public.persist_content_media_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.persist_content_media_observation(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb,text) to service_role;
