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
  leaseToken: string;
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
  const { error } = await admin.from("content_sync_events").upsert({
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    run_id: input.runId,
    lease_token: input.leaseToken,
    account_id: input.accountId ?? null,
    level: input.level,
    code: input.code,
    message: input.message.slice(0, 1000),
    external_request_id: input.requestId ?? null,
    retryable: input.retryable ?? false,
    event_key: input.eventKey,
  }, { onConflict: "run_id,account_id,event_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

async function persistMedia(input: {
  workspaceId: string;
  companyId: string;
  accountId: string;
  runId: string;
  leaseToken: string;
  media: InstagramMedia;
  token: string;
  own: boolean;
  adapterVersion: string;
  observedAt: string;
}) {
  const admin = getSupabaseAdminClient();
  let insights: Record<string, number | null> = {};
  if (input.own) {
    try {
      insights = await fetchInstagramMediaInsights(input.media.id, input.token, input.media);
    } catch (error) {
      const detail = safeError(error);
      await recordSyncEvent({
        runId: input.runId,
        leaseToken: input.leaseToken,
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
  const { data, error } = await admin.rpc("persist_content_media_observation", {
    target_run_id: input.runId,
    target_lease_token: input.leaseToken,
    target_company_id: input.companyId,
    target_workspace_id: input.workspaceId,
    target_account_id: input.accountId,
    target_adapter_version: input.adapterVersion,
    target_observed_at: input.observedAt,
    target_media: input.media,
    target_metrics: metrics,
    target_metrics_hash: metricsHash,
  });
  if (error) throw new Error(error.message);
  const result = Array.isArray(data) ? data[0] : data;
  return { created: Boolean(result?.created), snapshotCreated: Boolean(result?.snapshot_created) };
}

async function persistAccountSnapshot(input: {
  workspaceId: string;
  companyId: string;
  account: { id: string; kind: "own" | "competitor" | "reference"; username: string };
  profile: InstagramProfileSnapshot;
  runId: string;
  leaseToken: string;
  adapterVersion: string;
  observedAt: string;
  token: string;
}) {
  const admin = getSupabaseAdminClient();
  const { error: snapshotError } = await admin.rpc("persist_content_account_observation", {
    target_run_id: input.runId,
    target_lease_token: input.leaseToken,
    target_company_id: input.companyId,
    target_workspace_id: input.workspaceId,
    target_account_id: input.account.id,
    target_adapter_version: input.adapterVersion,
    target_observed_at: input.observedAt,
    target_profile: input.profile,
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
      leaseToken: input.leaseToken,
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
  const leaseToken = String(claimed.lease_token);
  const { data: accounts, error: accountsError } = await admin.from("content_instagram_accounts")
    .select("id, account_kind, username").eq("workspace_id", input.workspaceId).eq("company_id", input.companyId)
    .eq("active", true).is("retired_at", null).order("account_kind");
  if (accountsError) throw new Error(accountsError.message);

  let accountsSucceeded = 0;
  let accountsAttempted = 0;
  let publicationsNew = 0;
  let publicationsKnown = 0;
  let snapshotsCreated = 0;
  let errorCount = 0;
  let lastError: string | null = null;
  const observedAt = new Date().toISOString();

  for (const account of accounts ?? []) {
    accountsAttempted += 1;
    const { error: runAccountError } = await admin.from("content_sync_run_accounts").upsert({
      run_id: runId,
      account_id: account.id,
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      lease_token: leaseToken,
      status: "pending",
      started_at: new Date().toISOString(),
    }, { onConflict: "run_id,account_id" });
    if (runAccountError) throw new Error(runAccountError.message);
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
        leaseToken,
        adapterVersion,
        observedAt,
        token,
      });
      accountsSucceeded += 1;
      publicationsNew += persisted.publicationsNew;
      publicationsKnown += persisted.publicationsKnown;
      snapshotsCreated += persisted.snapshotsCreated;
      const { error: completeError } = await admin.from("content_sync_run_accounts").update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("run_id", runId).eq("account_id", account.id).eq("lease_token", leaseToken);
      if (completeError) throw new Error(completeError.message);
    } catch (error) {
      const detail = safeError(error);
      errorCount += 1;
      lastError = detail.message;
      const availabilityStatus = detail.code === "unsupported"
        ? "unsupported"
        : detail.code === "not_found" ? "not_found" : "error";
      const runAccountStatus = availabilityStatus === "error" ? "failed" : availabilityStatus;
      const { error: accountFailureError } = await admin.rpc("record_content_account_failure", {
        target_run_id: runId,
        target_lease_token: leaseToken,
        target_company_id: input.companyId,
        target_workspace_id: input.workspaceId,
        target_account_id: account.id,
        target_status: availabilityStatus,
        target_error: detail.message,
      });
      if (accountFailureError) throw new Error(accountFailureError.message);
      const { error: runFailureError } = await admin.from("content_sync_run_accounts").update({
        status: runAccountStatus,
        finished_at: new Date().toISOString(),
        error_code: detail.code,
        retryable: detail.retryable,
      }).eq("run_id", runId).eq("account_id", account.id).eq("lease_token", leaseToken);
      if (runFailureError) throw new Error(runFailureError.message);
      await recordSyncEvent({
        runId,
        leaseToken,
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
      if (detail.code === "reconnect_required") {
        const { error: reconnectError } = await admin.from("content_instagram_connections").update({
          status: "reconnect_required",
          last_error: detail.message,
          updated_at: new Date().toISOString(),
        }).eq("id", connection.id).eq("company_id", input.companyId).eq("workspace_id", input.workspaceId);
        if (reconnectError) throw new Error(reconnectError.message);
        break;
      }
    }
  }

  const status = errorCount === 0 ? "completed" : accountsSucceeded > 0 ? "partial" : "failed";
  const { error: finishError } = await admin.rpc("finish_content_sync", {
    target_run_id: runId,
    target_lease_token: leaseToken,
    target_connection_id: connection.id,
    target_status: status,
    target_accounts_attempted: accountsAttempted,
    target_accounts_succeeded: accountsSucceeded,
    target_publications_new: publicationsNew,
    target_publications_known: publicationsKnown,
    target_snapshots_created: snapshotsCreated,
    target_error_count: errorCount,
    target_last_error: lastError,
  });
  if (finishError) throw new Error(finishError.message);

  return { acquired: true, runId, retryAfterSeconds: 0, status, accountsSucceeded, errorCount, publicationsNew, publicationsKnown, snapshotsCreated };
}

export async function refreshCurrentContentWorkspace(requestKey: string = randomUUID(), companyLookup?: string) {
  const context = await getContentPortalContext(companyLookup);
  if (!context.canOperate) throw new Error("Tu rol puede consultar Contenido, pero no actualizar sus fuentes.");
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
    .select("id, company_id").eq("scheduled_enabled", true).or(`next_sync_at.is.null,next_sync_at.lte.${now}`).limit(10);
  if (error) throw new Error(error.message);
  const weekKey = now.slice(0, 10);
  const results = [];
  for (const workspace of workspaces ?? []) {
    try {
      results.push(await refreshContentWorkspace({
        companyId: String(workspace.company_id),
        workspaceId: String(workspace.id),
        trigger: "scheduled",
        requestKey: `scheduled:${weekKey}:${workspace.id}`,
      }));
    } catch (syncError) {
      results.push({ acquired: false, runId: null, retryAfterSeconds: 0, error: safeError(syncError).message });
    }
  }
  return results;
}
