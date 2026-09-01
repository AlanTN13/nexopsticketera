import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getAuthenticatedActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import {
  META_ADAPTER_VERSION,
  META_REQUIRED_SCOPES,
  MetaGraphError,
  ManagedInstagramAccount,
  buildMetaOAuthUrl,
  debugMetaToken,
  isMetaConfigured,
} from "@/lib/meta-instagram";
import { decryptMetaSecret, encryptMetaSecret } from "@/lib/meta-token-crypto";
import { resolveContentCompanyForActor } from "@/lib/portal-modules";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { hasModuleAccess } from "@/lib/authorization";
import type { Company, ModuleAccessLevel, UserProfile } from "@/lib/ticketing";

export type ContentAccountKind = "competitor" | "reference";

export type ContentPortalContext = {
  actor: UserProfile;
  company: Company;
  workspace: { id: string; slug: string; scheduledEnabled: boolean; nextSyncAt: string | null };
  connection: null | {
    id: string;
    status: string;
    enabled: boolean;
    instagramUsername: string | null;
    facebookPageName: string | null;
    authorizedScopes: string[];
    selectionOptions: Array<{ pageId: string; pageName: string; instagramUserId: string; instagramUsername?: string }>;
    tokenExpiresAt: string | null;
    lastValidatedAt: string | null;
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    lastError: string | null;
  };
  accounts: Array<{
    id: string;
    kind: "own" | ContentAccountKind;
    username: string;
    displayName: string | null;
    active: boolean;
    availabilityStatus: string;
    note: string | null;
    lastAccessAt: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
  runs: Array<{
    id: string;
    trigger: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    accountsAttempted: number;
    accountsSucceeded: number;
    publicationsNew: number;
    publicationsKnown: number;
    snapshotsCreated: number;
    errorCount: number;
    lastError: string | null;
  }>;
  latestSnapshots: Array<{
    id: string;
    accountId: string;
    observedAt: string;
    followersCount: number | null;
    followsCount: number | null;
    mediaCount: number | null;
  }>;
  recentMedia: Array<{
    id: string;
    accountId: string;
    caption: string | null;
    mediaType: string | null;
    permalink: string | null;
    publishedAt: string | null;
    firstObservedAt: string;
    lastObservedAt: string;
    metrics: null | {
      observedAt: string;
      likeCount: number | null;
      commentsCount: number | null;
      reach: number | null;
      views: number | null;
      saved: number | null;
      shares: number | null;
      totalInteractions: number | null;
    };
  }>;
  runAccounts: Array<{ runId: string; accountId: string; status: string; errorCode: string | null; retryable: boolean }>;
  events: Array<{ runId: string; accountId: string | null; level: string; code: string; message: string; occurredAt: string }>;
  canOperate: boolean;
  canManage: boolean;
  metaConfigured: boolean;
};

function assertAdminResult(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function authenticatedContentScope(
  requiredLevel: Exclude<ModuleAccessLevel, "none"> = "view",
  companyLookup?: string,
) {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) throw new Error("Tu sesión no es válida o venció.");
  const company = resolveContentCompanyForActor(db.companies, actor, companyLookup);
  if (!company || !hasModuleAccess(actor, company, "content", requiredLevel)) {
    throw new Error("Contenido no está habilitado para este workspace.");
  }

  const admin = getSupabaseAdminClient();
  const { data: workspace, error } = await admin
    .from("content_workspaces")
    .select("id, company_id, scheduled_enabled, next_sync_at")
    .eq("company_id", company.id)
    .single();
  assertAdminResult(error);
  if (!workspace) throw new Error("No pudimos encontrar el workspace de Contenido.");
  return { db, actor, company, workspace, admin };
}

export async function getContentPortalContext(companyLookup?: string): Promise<ContentPortalContext> {
  const { actor, company, workspace, admin } = await authenticatedContentScope("view", companyLookup);
  const [connectionResult, accountsResult, runsResult, snapshotsResult, mediaResult, metricsResult, runAccountsResult, eventsResult] = await Promise.all([
    admin.from("content_instagram_connections").select("*").eq("workspace_id", workspace.id).maybeSingle(),
    admin.from("content_instagram_accounts").select("*").eq("workspace_id", workspace.id).is("retired_at", null).order("account_kind").order("username"),
    admin.from("content_sync_runs").select("*").eq("workspace_id", workspace.id).order("started_at", { ascending: false }).limit(25),
    admin.from("content_account_snapshots").select("id, account_id, observed_at, followers_count, follows_count, media_count").eq("workspace_id", workspace.id).order("observed_at", { ascending: false }).limit(50),
    admin.from("content_instagram_media").select("id, account_id, caption, media_type, permalink, published_at, first_observed_at, last_observed_at").eq("workspace_id", workspace.id).order("published_at", { ascending: false, nullsFirst: false }).limit(50),
    admin.from("content_media_metric_snapshots").select("media_id, observed_at, like_count, comments_count, reach, views, saved, shares, total_interactions").eq("workspace_id", workspace.id).order("observed_at", { ascending: false }).limit(100),
    admin.from("content_sync_run_accounts").select("run_id, account_id, status, error_code, retryable").eq("workspace_id", workspace.id).order("started_at", { ascending: false }).limit(100),
    admin.from("content_sync_events").select("run_id, account_id, level, code, message, occurred_at").eq("workspace_id", workspace.id).order("occurred_at", { ascending: false }).limit(100),
  ]);
  [connectionResult, accountsResult, runsResult, snapshotsResult, mediaResult, metricsResult, runAccountsResult, eventsResult].forEach((result) => assertAdminResult(result.error));

  const connection = connectionResult.data;
  const canOperate = hasModuleAccess(actor, company, "content", "operate");
  const canManage = hasModuleAccess(actor, company, "content", "admin");
  let selectionOptions: Array<{ pageId: string; pageName: string; instagramUserId: string; instagramUsername?: string }> = [];
  if (connection?.status === "selection_required" && canManage) {
    const { data: pendingCredential, error: pendingError } = await admin
      .from("content_meta_credentials")
      .select("pending_selection_ciphertext, pending_expires_at")
      .eq("connection_id", connection.id)
      .eq("company_id", company.id)
      .gt("pending_expires_at", new Date().toISOString())
      .maybeSingle();
    assertAdminResult(pendingError);
    if (pendingCredential?.pending_selection_ciphertext) {
      const pending = JSON.parse(decryptMetaSecret(String(pendingCredential.pending_selection_ciphertext))) as PendingMetaSelection;
      selectionOptions = pending.accounts.map(({ pageId, pageName, instagramUserId, instagramUsername }) => ({ pageId, pageName, instagramUserId, instagramUsername }));
    }
  }
  type MetricRow = {
    media_id: string; observed_at: string; like_count: number | null;
    comments_count: number | null; reach: number | null; views: number | null;
    saved: number | null; shares: number | null; total_interactions: number | null;
  };
  const latestMetrics = new Map<string, MetricRow>();
  for (const metric of metricsResult.data ?? []) if (!latestMetrics.has(String(metric.media_id))) latestMetrics.set(String(metric.media_id), metric as MetricRow);
  return {
    actor,
    company,
    workspace: {
      id: String(workspace.id),
      slug: company.slug,
      scheduledEnabled: Boolean(workspace.scheduled_enabled),
      nextSyncAt: workspace.next_sync_at ? String(workspace.next_sync_at) : null,
    },
    connection: connection ? {
      id: String(connection.id),
      status: String(connection.status),
      enabled: Boolean(connection.enabled),
      instagramUsername: connection.instagram_username ? String(connection.instagram_username) : null,
      facebookPageName: connection.facebook_page_name ? String(connection.facebook_page_name) : null,
      authorizedScopes: Array.isArray(connection.authorized_scopes) ? connection.authorized_scopes.map(String) : [],
      selectionOptions,
      tokenExpiresAt: connection.token_expires_at ? String(connection.token_expires_at) : null,
      lastValidatedAt: connection.last_validated_at ? String(connection.last_validated_at) : null,
      lastSyncAt: connection.last_sync_at ? String(connection.last_sync_at) : null,
      nextSyncAt: connection.next_sync_at ? String(connection.next_sync_at) : null,
      lastError: connection.last_error ? String(connection.last_error) : null,
    } : null,
    accounts: (accountsResult.data ?? []).map((account) => ({
      id: String(account.id),
      kind: account.account_kind as "own" | ContentAccountKind,
      username: String(account.username),
      displayName: account.display_name ? String(account.display_name) : null,
      active: Boolean(account.active),
      availabilityStatus: String(account.availability_status),
      note: account.note ? String(account.note) : null,
      lastAccessAt: account.last_access_at ? String(account.last_access_at) : null,
      lastSyncAt: account.last_sync_at ? String(account.last_sync_at) : null,
      lastError: account.last_error ? String(account.last_error) : null,
    })),
    runs: (runsResult.data ?? []).map((run) => ({
      id: String(run.id),
      trigger: String(run.trigger),
      status: String(run.status),
      startedAt: String(run.started_at),
      finishedAt: run.finished_at ? String(run.finished_at) : null,
      accountsAttempted: Number(run.accounts_attempted),
      accountsSucceeded: Number(run.accounts_succeeded),
      publicationsNew: Number(run.publications_new),
      publicationsKnown: Number(run.publications_known),
      snapshotsCreated: Number(run.snapshots_created),
      errorCount: Number(run.error_count),
      lastError: run.last_error ? String(run.last_error) : null,
    })),
    latestSnapshots: (snapshotsResult.data ?? []).map((snapshot) => ({
      id: String(snapshot.id),
      accountId: String(snapshot.account_id),
      observedAt: String(snapshot.observed_at),
      followersCount: snapshot.followers_count === null ? null : Number(snapshot.followers_count),
      followsCount: snapshot.follows_count === null ? null : Number(snapshot.follows_count),
      mediaCount: snapshot.media_count === null ? null : Number(snapshot.media_count),
    })),
    recentMedia: (mediaResult.data ?? []).map((media) => {
      const metric = latestMetrics.get(String(media.id));
      return {
      id: String(media.id),
      accountId: String(media.account_id),
      caption: media.caption ? String(media.caption) : null,
      mediaType: media.media_type ? String(media.media_type) : null,
      permalink: media.permalink ? String(media.permalink) : null,
      publishedAt: media.published_at ? String(media.published_at) : null,
      firstObservedAt: String(media.first_observed_at),
      lastObservedAt: String(media.last_observed_at),
      metrics: metric ? {
        observedAt: String(metric.observed_at),
        likeCount: metric.like_count === null ? null : Number(metric.like_count),
        commentsCount: metric.comments_count === null ? null : Number(metric.comments_count),
        reach: metric.reach === null ? null : Number(metric.reach),
        views: metric.views === null ? null : Number(metric.views),
        saved: metric.saved === null ? null : Number(metric.saved),
        shares: metric.shares === null ? null : Number(metric.shares),
        totalInteractions: metric.total_interactions === null ? null : Number(metric.total_interactions),
      } : null,
    }; }),
    runAccounts: (runAccountsResult.data ?? []).map((row) => ({ runId: String(row.run_id), accountId: String(row.account_id), status: String(row.status), errorCode: row.error_code ? String(row.error_code) : null, retryable: Boolean(row.retryable) })),
    events: (eventsResult.data ?? []).map((row) => ({ runId: String(row.run_id), accountId: row.account_id ? String(row.account_id) : null, level: String(row.level), code: String(row.code), message: String(row.message), occurredAt: String(row.occurred_at) })),
    canOperate,
    canManage,
    metaConfigured: isMetaConfigured(),
  };
}

function normalizeInstagramUsername(value: string) {
  const username = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    throw new Error("Ingresá un usuario de Instagram válido, sin URL.");
  }
  return username;
}

export async function addContentObservedAccount(input: { kind: ContentAccountKind; username: string; note?: string; companyLookup?: string }) {
  const { actor, company, workspace, admin } = await authenticatedContentScope("admin", input.companyLookup);
  const username = normalizeInstagramUsername(input.username);
  const { error } = await admin.from("content_instagram_accounts").insert({
    workspace_id: workspace.id,
    company_id: company.id,
    account_kind: input.kind,
    username,
    note: input.note?.trim() || null,
    created_by: actor.id,
  });
  if (error?.code === "23505") throw new Error("Esa cuenta ya está agregada al workspace.");
  assertAdminResult(error);
}

export async function setContentAccountActive(accountId: string, active: boolean, companyLookup?: string) {
  const { company, workspace, admin } = await authenticatedContentScope("admin", companyLookup);
  const { data, error } = await admin
    .from("content_instagram_accounts")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("company_id", company.id)
    .eq("workspace_id", workspace.id)
    .neq("account_kind", "own")
    .select("id")
    .maybeSingle();
  assertAdminResult(error);
  if (!data) throw new Error("No pudimos encontrar la cuenta observada.");
}

export async function retireContentAccount(accountId: string, companyLookup?: string) {
  const { company, workspace, admin } = await authenticatedContentScope("admin", companyLookup);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("content_instagram_accounts")
    .update({ active: false, retired_at: now, updated_at: now })
    .eq("id", accountId)
    .eq("company_id", company.id)
    .eq("workspace_id", workspace.id)
    .neq("account_kind", "own")
    .select("id")
    .maybeSingle();
  assertAdminResult(error);
  if (!data) throw new Error("No pudimos encontrar la cuenta observada.");
}

function stateHash(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createMetaAuthorization(redirectUri: string, companyLookup?: string) {
  const { actor, company, workspace, admin } = await authenticatedContentScope("admin", companyLookup);
  if (!isMetaConfigured()) throw new Error("La aplicación oficial de Meta todavía no está configurada.");
  const state = randomBytes(32).toString("base64url");
  const { error } = await admin.from("content_meta_oauth_states").insert({
    state_hash: stateHash(state),
    workspace_id: workspace.id,
    company_id: company.id,
    actor_id: actor.id,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  assertAdminResult(error);
  return buildMetaOAuthUrl({ state, redirectUri });
}

export async function consumeMetaAuthorizationState(state: string) {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) throw new Error("Tu sesión no es válida o venció.");
  const admin = getSupabaseAdminClient();
  const hash = stateHash(state);
  const { data, error } = await admin
    .from("content_meta_oauth_states")
    .select("*")
    .eq("state_hash", hash)
    .eq("actor_id", actor.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  assertAdminResult(error);
  if (!data) throw new Error("La autorización de Meta venció o ya fue utilizada.");
  const company = resolveContentCompanyForActor(db.companies, actor, String(data.company_id));
  if (!company || !hasModuleAccess(actor, company, "content", "admin")) {
    throw new Error("Ya no tenés permiso para completar esta conexión.");
  }
  const { data: workspace, error: workspaceError } = await admin.from("content_workspaces")
    .select("id, company_id, scheduled_enabled, next_sync_at")
    .eq("id", data.workspace_id).eq("company_id", company.id).single();
  assertAdminResult(workspaceError);
  const { data: consumed, error: consumeError } = await admin
    .from("content_meta_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state_hash", hash)
    .is("used_at", null)
    .select("state_hash")
    .maybeSingle();
  assertAdminResult(consumeError);
  if (!consumed) throw new Error("La autorización de Meta ya fue utilizada.");
  return { db, actor, company, workspace, admin };
}

type PendingMetaSelection = { accounts: ManagedInstagramAccount[]; userExpiresAt: string | null };

async function validateSelectedMetaAccount(account: ManagedInstagramAccount) {
  if (!account.tasks.includes("ANALYZE")) {
    throw new Error("La Página elegida no otorgó la tarea ANALYZE requerida para leer Insights.");
  }
  const debug = await debugMetaToken(account.pageAccessToken);
  if (!debug.data.is_valid) throw new Error("Meta devolvió una credencial inválida. Volvé a conectar la cuenta.");
  const scopes = debug.data.scopes ?? [];
  const missing = META_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
  if (missing.length) {
    throw new Error(`La autorización de Meta no incluyó todos los permisos requeridos: ${missing.join(", ")}.`);
  }
  return { scopes, expiresAt: debug.data.expires_at ? new Date(debug.data.expires_at * 1000).toISOString() : null };
}

export async function saveMetaAuthorizationResult(input: {
  accounts: ManagedInstagramAccount[];
  userExpiresAt: string | null;
  companyLookup?: string;
}) {
  const scope = await authenticatedContentScope("admin", input.companyLookup);
  const { actor, company, workspace, admin } = scope;
  if (!input.accounts.length) {
    throw new Error("No encontramos una cuenta profesional de Instagram vinculada a una Página de Facebook administrada por este usuario.");
  }

  const { data: connection, error } = await admin.from("content_instagram_connections").upsert({
    workspace_id: workspace.id,
    company_id: company.id,
    status: input.accounts.length === 1 ? "authorization_required" : "selection_required",
    graph_version: process.env.META_GRAPH_VERSION,
    connected_by: actor.id,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id" }).select("id").single();
  assertAdminResult(error);
  if (!connection) throw new Error("No pudimos guardar la conexión de Meta.");

  if (input.accounts.length === 1) {
    await finalizeMetaConnection(scope, String(connection.id), input.accounts[0]);
    return "connected" as const;
  }

  const pending: PendingMetaSelection = { accounts: input.accounts, userExpiresAt: input.userExpiresAt };
  const { error: credentialError } = await admin.rpc("set_content_pending_selection", {
    target_connection_id: connection.id,
    target_company_id: company.id,
    target_workspace_id: workspace.id,
    target_actor_id: actor.id,
    target_pending_ciphertext: encryptMetaSecret(JSON.stringify(pending)),
    target_graph_version: process.env.META_GRAPH_VERSION,
  });
  assertAdminResult(credentialError);
  return "selection_required" as const;
}

async function finalizeMetaConnection(
  scope: Awaited<ReturnType<typeof authenticatedContentScope>>,
  connectionId: string,
  account: ManagedInstagramAccount,
) {
  const { actor, company, workspace, admin } = scope;
  const validation = await validateSelectedMetaAccount(account);
  const username = normalizeInstagramUsername(account.instagramUsername ?? account.instagramUserId);
  const { error: finalizeError } = await admin.rpc("finalize_content_meta_connection", {
    target_connection_id: connectionId,
    target_company_id: company.id,
    target_workspace_id: workspace.id,
    target_actor_id: actor.id,
    target_page_id: account.pageId,
    target_page_name: account.pageName,
    target_instagram_user_id: account.instagramUserId,
    target_instagram_username: username,
    target_scopes: validation.scopes,
    target_token_expires_at: validation.expiresAt,
    target_token_ciphertext: encryptMetaSecret(account.pageAccessToken),
    target_graph_version: process.env.META_GRAPH_VERSION,
  });
  assertAdminResult(finalizeError);
}

export async function selectMetaInstagramAccount(instagramUserId: string, companyLookup?: string) {
  const scope = await authenticatedContentScope("admin", companyLookup);
  const { company, workspace, admin } = scope;
  const { data: connection, error } = await admin.from("content_instagram_connections")
    .select("id").eq("workspace_id", workspace.id).eq("company_id", company.id).eq("status", "selection_required").maybeSingle();
  assertAdminResult(error);
  if (!connection) throw new Error("No hay una selección de Meta pendiente.");
  const { data: credential, error: credentialError } = await admin.from("content_meta_credentials")
    .select("pending_selection_ciphertext, pending_expires_at").eq("connection_id", connection.id)
    .eq("company_id", company.id).gt("pending_expires_at", new Date().toISOString()).maybeSingle();
  assertAdminResult(credentialError);
  if (!credential?.pending_selection_ciphertext) throw new Error("La selección pendiente de Meta venció.");
  const pending = JSON.parse(decryptMetaSecret(String(credential.pending_selection_ciphertext))) as PendingMetaSelection;
  const selected = pending.accounts.find((account) => account.instagramUserId === instagramUserId);
  if (!selected) throw new Error("La cuenta elegida no pertenece a esta autorización.");
  await finalizeMetaConnection(scope, String(connection.id), selected);
}

export async function setContentConnectorEnabled(enabled: boolean, companyLookup?: string) {
  const { actor, company, workspace, admin } = await authenticatedContentScope("admin", companyLookup);
  const { error } = await admin.rpc("set_content_connector_state", {
    target_company_id: company.id,
    target_workspace_id: workspace.id,
    target_actor_id: actor.id,
    target_enabled: enabled,
  });
  assertAdminResult(error);
}

export async function getContentSyncCredential(workspaceId: string, companyId: string) {
  const admin = getSupabaseAdminClient();
  const { data: connection, error } = await admin.from("content_instagram_connections")
    .select("*").eq("workspace_id", workspaceId).eq("company_id", companyId).eq("status", "connected").eq("enabled", true).maybeSingle();
  assertAdminResult(error);
  if (!connection) throw new Error("La cuenta oficial de Instagram todavía no está conectada.");
  const { data: credential, error: credentialError } = await admin.from("content_meta_credentials")
    .select("token_ciphertext").eq("connection_id", connection.id).eq("company_id", companyId).single();
  assertAdminResult(credentialError);
  if (!credential?.token_ciphertext) throw new Error("La credencial de Meta no está disponible. Volvé a conectar la cuenta.");
  const token = decryptMetaSecret(String(credential.token_ciphertext));
  const reconnect = async (message: string) => {
    await admin.from("content_instagram_connections").update({
      status: "reconnect_required",
      last_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("company_id", companyId).eq("workspace_id", workspaceId);
    throw new Error(message);
  };
  if (connection.token_expires_at && new Date(String(connection.token_expires_at)).getTime() <= Date.now()) {
    return reconnect("La autorización de Meta venció. Volvé a conectar la cuenta oficial.");
  }
  try {
    const validation = await debugMetaToken(token);
    const scopes = validation.data.scopes ?? [];
    const missingScopes = META_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
    if (!validation.data.is_valid || missingScopes.length) {
      return reconnect("La autorización de Meta perdió vigencia o permisos. Volvé a conectar la cuenta oficial.");
    }
  } catch (error) {
    if (error instanceof MetaGraphError && error.code === "reconnect_required") {
      return reconnect("Meta revocó la autorización. Volvé a conectar la cuenta oficial.");
    }
    throw error;
  }
  return { connection, token, admin, adapterVersion: META_ADAPTER_VERSION };
}
