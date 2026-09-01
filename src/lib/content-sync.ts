import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getContentPortalContext, getContentSyncCredential } from "@/lib/content-store";
import {
  InstagramMedia,
  InstagramProfileSnapshot,
  MetaGraphError,
  fetchInstagramMediaInsights,
  fetchObservedInstagramProfile,
  fetchOwnInstagramProfile,
} from "@/lib/meta-instagram";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

type SyncTrigger = "manual" | "scheduled";

function dataHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeError(error: unknown) {
  if (error instanceof MetaGraphError) {
    return { message: error.message, code: error.code, retryable: error.retryable, requestId: error.requestId ?? null };
  }
  return {
    message: error instanceof Error ? error.message.slice(0, 1000) : "La fuente no pudo completar la consulta.",
    code: "unexpected",
    retryable: false,
    requestId: null,
  };
}

async function recordSyncEvent(input: {
  runId: string;
  workspaceId: string;
  companyId: string;
  accountId?: string;
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  requestId?: string | null;
  retryable?: boolean;
  eventKey: string;
}) {
  const admin = getSupabaseAdminClient();
  await admin.from("content_sync_events").upsert({
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    run_id: input.runId,
    account_id: input.accountId ?? null,
    level: input.level,
    code: input.code,
    message: input.message.slice(0, 1000),
    external_request_id: input.requestId ?? null,
    retryable: input.retryable ?? false,
    event_key: input.eventKey,
  }, { onConflict: "run_id,account_id,event_key", ignoreDuplicates: true });
}

async function persistMedia(input: {
  workspaceId: string;
  companyId: string;
  accountId: string;
  runId: string;
  media: InstagramMedia;
  token: string;
  own: boolean;
  adapterVersion: string;
  observedAt: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin.from("content_instagram_media")
    .select("id").eq("workspace_id", input.workspaceId).eq("instagram_media_id", input.media.id).maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const values = {
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    account_id: input.accountId,
    instagram_media_id: input.media.id,
    caption: input.media.caption ?? null,
    media_type: input.media.media_type ?? null,
    media_product_type: input.media.media_product_type ?? null,
    permalink: input.media.permalink ?? null,
    media_url: input.media.media_url ?? null,
    thumbnail_url: input.media.thumbnail_url ?? null,
    published_at: input.media.timestamp ?? null,
    last_observed_at: input.observedAt,
    raw_payload: input.media,
    updated_at: input.observedAt,
  };

  let mediaId: string;
  let created: boolean;
  if (existing) {
    const { data, error } = await admin.from("content_instagram_media").update(values)
      .eq("id", existing.id).eq("company_id", input.companyId).select("id").single();
    if (error) throw new Error(error.message);
    mediaId = String(data.id);
    created = false;
  } else {
    const { data, error } = await admin.from("content_instagram_media").insert({
      ...values,
      first_observed_at: input.observedAt,
    }).select("id").single();
    if (error) throw new Error(error.message);
    mediaId = String(data.id);
    created = true;
  }

  let insights: Record<string, number | null> = {};
  if (input.own) {
    try {
      insights = await fetchInstagramMediaInsights(input.media.id, input.token);
    } catch (error) {
      const detail = safeError(error);
      await recordSyncEvent({
        runId: input.runId,
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        accountId: input.accountId,
        level: "warning",
        code: `media_insights_${detail.code}`,
        message: "La publicación se guardó, pero Meta no entregó todas sus métricas.",
        requestId: detail.requestId,
        retryable: detail.retryable,
        eventKey: `media-insights:${input.media.id}`,
      });
    }
  }

  const metrics = {
    like_count: input.media.like_count ?? null,
    comments_count: input.media.comments_count ?? null,
    reach: insights.reach ?? null,
    views: insights.views ?? null,
    saved: insights.saved ?? null,
    shares: insights.shares ?? null,
    total_interactions: insights.total_interactions ?? null,
  };
  const metricsHash = dataHash(metrics);
  const { data: latest, error: latestError } = await admin.from("content_media_metric_snapshots")
    .select("metrics_hash").eq("company_id", input.companyId).eq("media_id", mediaId)
    .order("observed_at", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw new Error(latestError.message);
  let snapshotCreated = false;
  if (!latest || latest.metrics_hash !== metricsHash) {
    const { error } = await admin.from("content_media_metric_snapshots").insert({
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      media_id: mediaId,
      run_id: input.runId,
      adapter_version: input.adapterVersion,
      observed_at: input.observedAt,
      ...metrics,
      metrics_hash: metricsHash,
      raw_metrics: metrics,
    });
    if (error) throw new Error(error.message);
    snapshotCreated = true;
  }
  return { created, snapshotCreated };
}

async function persistAccountSnapshot(input: {
  workspaceId: string;
  companyId: string;
  account: { id: string; kind: "own" | "competitor" | "reference"; username: string };
  profile: InstagramProfileSnapshot;
  runId: string;
  adapterVersion: string;
  observedAt: string;
  token: string;
}) {
  const admin = getSupabaseAdminClient();
  const { error: accountError } = await admin.from("content_instagram_accounts").update({
    instagram_account_id: input.profile.id ?? input.profile.ig_id ?? null,
    username: input.profile.username.toLowerCase(),
    display_name: input.profile.name ?? input.profile.username,
    availability_status: "available",
    last_access_at: input.observedAt,
    last_sync_at: input.observedAt,
    last_error: null,
    updated_at: input.observedAt,
  }).eq("id", input.account.id).eq("company_id", input.companyId).eq("workspace_id", input.workspaceId);
  if (accountError) throw new Error(accountError.message);

  const { error: snapshotError } = await admin.from("content_account_snapshots").insert({
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    account_id: input.account.id,
    run_id: input.runId,
    adapter_version: input.adapterVersion,
    observed_at: input.observedAt,
    biography: input.profile.biography ?? null,
    website: input.profile.website ?? null,
    profile_picture_url: input.profile.profile_picture_url ?? null,
    followers_count: input.profile.followers_count ?? null,
    follows_count: input.profile.follows_count ?? null,
    media_count: input.profile.media_count ?? null,
    raw_payload: input.profile,
  });
  if (snapshotError) throw new Error(snapshotError.message);

  let publicationsNew = 0;
  let publicationsKnown = 0;
  let snapshotsCreated = 1;
  for (const media of input.profile.media?.data ?? []) {
    const result = await persistMedia({
      workspaceId: input.workspaceId,
      companyId: input.companyId,
      accountId: input.account.id,
      runId: input.runId,
      media,
      token: input.token,
      own: input.account.kind === "own",
      adapterVersion: input.adapterVersion,
      observedAt: input.observedAt,
    });
    if (result.created) publicationsNew += 1;
    else publicationsKnown += 1;
    if (result.snapshotCreated) snapshotsCreated += 1;
  }
  return { publicationsNew, publicationsKnown, snapshotsCreated };
}

export async function refreshContentWorkspace(input: {
  companyId: string;
  workspaceId: string;
  trigger: SyncTrigger;
  requestKey: string;
  requestedBy?: string | null;
}) {
  const { connection, token, admin, adapterVersion } = await getContentSyncCredential(input.workspaceId, input.companyId);
  if (input.trigger === "manual" && connection.last_sync_at) {
    const elapsed = Date.now() - new Date(String(connection.last_sync_at)).getTime();
    if (elapsed < 60_000) {
      return { acquired: false, runId: null, retryAfterSeconds: Math.ceil((60_000 - elapsed) / 1000) };
    }
  }

  const { data: claim, error: claimError } = await admin.rpc("claim_content_sync", {
    target_company_id: input.companyId,
    target_workspace_id: input.workspaceId,
    target_trigger: input.trigger,
    target_request_key: input.requestKey,
    target_requested_by: input.requestedBy ?? null,
    target_adapter_version: adapterVersion,
  });
  if (claimError) throw new Error(claimError.message);
  const claimed = Array.isArray(claim) ? claim[0] : claim;
  if (!claimed?.acquired) {
    return { acquired: false, runId: claimed?.run_id ? String(claimed.run_id) : null, retryAfterSeconds: Number(claimed?.retry_after_seconds ?? 0) };
  }

  const runId = String(claimed.run_id);
  const { data: accounts, error: accountsError } = await admin.from("content_instagram_accounts")
    .select("id, account_kind, username").eq("workspace_id", input.workspaceId).eq("company_id", input.companyId)
    .eq("active", true).is("retired_at", null).order("account_kind");
  if (accountsError) throw new Error(accountsError.message);

  let accountsSucceeded = 0;
  let publicationsNew = 0;
  let publicationsKnown = 0;
  let snapshotsCreated = 0;
  let errorCount = 0;
  let lastError: string | null = null;
  const observedAt = new Date().toISOString();

  for (const account of accounts ?? []) {
    await admin.from("content_sync_run_accounts").upsert({
      run_id: runId,
      account_id: account.id,
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      status: "pending",
      started_at: new Date().toISOString(),
    }, { onConflict: "run_id,account_id" });
    try {
      const profile = account.account_kind === "own"
        ? await fetchOwnInstagramProfile(String(connection.instagram_user_id), token)
        : await fetchObservedInstagramProfile(String(connection.instagram_user_id), String(account.username), token);
      const persisted = await persistAccountSnapshot({
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        account: { id: String(account.id), kind: account.account_kind, username: String(account.username) },
        profile,
        runId,
        adapterVersion,
        observedAt,
        token,
      });
      accountsSucceeded += 1;
      publicationsNew += persisted.publicationsNew;
      publicationsKnown += persisted.publicationsKnown;
      snapshotsCreated += persisted.snapshotsCreated;
      await admin.from("content_sync_run_accounts").update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("run_id", runId).eq("account_id", account.id);
    } catch (error) {
      const detail = safeError(error);
      errorCount += 1;
      lastError = detail.message;
      const status = detail.code === "unsupported" ? "unsupported" : "failed";
      await admin.from("content_instagram_accounts").update({
        availability_status: status === "unsupported" ? "unsupported" : "error",
        last_access_at: observedAt,
        last_error: detail.message,
        updated_at: observedAt,
      }).eq("id", account.id).eq("company_id", input.companyId);
      await admin.from("content_sync_run_accounts").update({
        status,
        finished_at: new Date().toISOString(),
        error_code: detail.code,
        retryable: detail.retryable,
      }).eq("run_id", runId).eq("account_id", account.id);
      await recordSyncEvent({
        runId,
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        accountId: String(account.id),
        level: "error",
        code: detail.code,
        message: detail.message,
        requestId: detail.requestId,
        retryable: detail.retryable,
        eventKey: "account-sync",
      });
    }
  }

  const nextSyncAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const status = errorCount === 0 ? "completed" : accountsSucceeded > 0 ? "partial" : "failed";
  const finishedAt = new Date().toISOString();
  const { error: finishError } = await admin.from("content_sync_runs").update({
    status,
    finished_at: finishedAt,
    accounts_attempted: accounts?.length ?? 0,
    accounts_succeeded: accountsSucceeded,
    publications_new: publicationsNew,
    publications_known: publicationsKnown,
    snapshots_created: snapshotsCreated,
    error_count: errorCount,
    last_error: lastError,
  }).eq("id", runId).eq("company_id", input.companyId).eq("workspace_id", input.workspaceId);
  if (finishError) throw new Error(finishError.message);

  await Promise.all([
    admin.from("content_instagram_connections").update({
      last_sync_at: finishedAt,
      next_sync_at: nextSyncAt,
      last_error: status === "failed" ? lastError : null,
      updated_at: finishedAt,
    }).eq("id", connection.id).eq("company_id", input.companyId),
    admin.from("content_workspaces").update({ next_sync_at: nextSyncAt, updated_at: finishedAt })
      .eq("id", input.workspaceId).eq("company_id", input.companyId),
  ]);

  return { acquired: true, runId, retryAfterSeconds: 0, status, accountsSucceeded, errorCount, publicationsNew, publicationsKnown, snapshotsCreated };
}

export async function refreshCurrentContentWorkspace(requestKey: string = randomUUID()) {
  const context = await getContentPortalContext();
  if (!context.canManage) throw new Error("Tu rol puede consultar Contenido, pero no actualizar sus fuentes.");
  return refreshContentWorkspace({
    companyId: context.company.id,
    workspaceId: context.workspace.id,
    trigger: "manual",
    requestKey,
    requestedBy: context.actor.id,
  });
}

export async function refreshScheduledContentWorkspaces() {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: workspaces, error } = await admin.from("content_workspaces")
    .select("id, company_id").eq("scheduled_enabled", true).or(`next_sync_at.is.null,next_sync_at.lte.${now}`);
  if (error) throw new Error(error.message);
  const weekKey = now.slice(0, 10);
  return Promise.all((workspaces ?? []).map(async (workspace) => {
    try {
      return await refreshContentWorkspace({
        companyId: String(workspace.company_id),
        workspaceId: String(workspace.id),
        trigger: "scheduled",
        requestKey: `scheduled:${weekKey}:${workspace.id}`,
      });
    } catch (syncError) {
      return { acquired: false, runId: null, retryAfterSeconds: 0, error: safeError(syncError).message };
    }
  }));
}
