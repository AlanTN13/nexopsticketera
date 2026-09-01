import "server-only";

import {
  isRadarAutonomyMode,
  isRadarRequestKind,
  isRadarRunStatus,
  parseRadarCandidate,
  parseRadarManualNoteRequest,
  type RadarAutonomyMode,
  type RadarControlPlaneSnapshot,
  type RadarControlSettings,
  type RadarDecisionAction,
  type RadarRun,
  type RadarRunEvent,
  type RadarPublicationJob,
  type RadarRunStatus,
} from "@/lib/radar-control-plane";
import { buildRadarQueueRequest, radarEngineConnected } from "@/lib/radar-engine-client";
import { radarPayloadDigest } from "@/lib/radar-engine-contract";
import { parseRadarPreferences } from "@/lib/radar-preferences";
import { radarPublicationConnected } from "@/lib/radar-publication";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";

type UnknownRow = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function mapSettings(row: UnknownRow): RadarControlSettings | null {
  const autonomyMode = text(row.autonomy_mode);
  const workspaceId = text(row.workspace_id);
  if (!workspaceId || !autonomyMode || !isRadarAutonomyMode(autonomyMode)) return null;
  return {
    workspaceId,
    companyId: text(row.company_id),
    enabled: row.enabled === true,
    schedulerEnabled: row.scheduler_enabled === true,
    scheduleDays: Array.isArray(row.schedule_days)
      ? row.schedule_days.filter((day): day is number => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)
      : [1, 2, 3, 4, 5, 6],
    scheduleHour: typeof row.schedule_hour === "number" ? row.schedule_hour : 7,
    scheduleTimezone: text(row.schedule_timezone) ?? "America/Argentina/Buenos_Aires",
    autonomyMode,
    preferences: parseRadarPreferences(row.preferences),
    nextRunAt: text(row.next_run_at),
  };
}

function mapPublication(row: UnknownRow): RadarPublicationJob | null {
  const status = text(row.status);
  const compositionDigest = text(row.composition_digest);
  const createdAt = text(row.created_at);
  if (!status || !["reserved", "dispatched", "published", "failed"].includes(status) || !compositionDigest || !createdAt) return null;
  return {
    status: status as RadarPublicationJob["status"],
    compositionDigest,
    externalPrNumber: typeof row.external_pr_number === "number" ? row.external_pr_number : null,
    externalPrUrl: text(row.external_pr_url),
    externalWorkflowUrl: text(row.external_workflow_url),
    mergeSha: text(row.merge_sha),
    finalUrl: text(row.final_url),
    errorMessage: text(row.error_message),
    createdAt,
    completedAt: text(row.completed_at),
  };
}

function mapRun(row: UnknownRow, events: RadarRunEvent[] = [], decisions: RadarRun["decisions"] = [], publication: RadarPublicationJob | null = null): RadarRun | null {
  const id = text(row.id);
  const workspaceId = text(row.workspace_id);
  const requestedBy = text(row.requested_by);
  const autonomyMode = text(row.autonomy_mode);
  const status = text(row.status);
  const requestKind = text(row.request_kind);
  const createdAt = text(row.created_at);
  const updatedAt = text(row.updated_at);
  if (!id || !workspaceId || !requestedBy || !autonomyMode || !status || !requestKind || !createdAt || !updatedAt ||
      !isRadarAutonomyMode(autonomyMode) || !isRadarRunStatus(status) || !isRadarRequestKind(requestKind)) return null;
  return {
    id,
    workspaceId,
    companyId: text(row.company_id),
    requestedBy,
    triggerKind: row.trigger_kind === "scheduled" ? "scheduled" : "manual",
    requestKind,
    manualNote: requestKind === "manual_note" ? parseRadarManualNoteRequest(row.request_payload) : null,
    autonomyMode,
    status,
    externalRunId: text(row.external_run_id),
    externalRunUrl: text(row.external_run_url),
    candidate: parseRadarCandidate(row.candidate),
    resultReason: text(row.result_reason),
    finalUrl: text(row.final_url),
    errorMessage: text(row.error_message),
    startedAt: text(row.started_at),
    completedAt: text(row.completed_at),
    createdAt,
    updatedAt,
    events,
    decisions,
    publication,
  };
}

function missingControlPlane(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || /radar_control_settings|radar_runs/i.test(error?.message ?? "");
}

export async function loadRadarControlPlane(workspaceId: string): Promise<RadarControlPlaneSnapshot> {
  const client = await getSupabaseServerClient();
  const [settingsResult, runsResult] = await Promise.all([
    client.from("radar_control_settings").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    client.from("radar_runs").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(30),
  ]);

  if (missingControlPlane(settingsResult.error) || missingControlPlane(runsResult.error)) {
    return { availability: "not_configured", settings: null, runs: [], engineConnected: false, publicationConnected: false };
  }
  if (settingsResult.error || runsResult.error) {
    return { availability: "unavailable", settings: null, runs: [], engineConnected: false, publicationConnected: false };
  }

  const settings = settingsResult.data ? mapSettings(settingsResult.data as UnknownRow) : null;
  const runRows = (runsResult.data ?? []) as UnknownRow[];
  const runIds = runRows.map((row) => text(row.id)).filter((id): id is string => Boolean(id));
  const [eventsResult, decisionsResult, publicationsResult] = runIds.length
    ? await Promise.all([
        client.from("radar_run_events").select("*").in("run_id", runIds).order("created_at", { ascending: true }),
        client.from("radar_run_decisions").select("*").in("run_id", runIds).order("created_at", { ascending: true }),
        client.from("radar_publication_jobs").select("*").in("run_id", runIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const eventsByRun = new Map<string, RadarRunEvent[]>();
  for (const row of (eventsResult.data ?? []) as UnknownRow[]) {
    const runId = text(row.run_id);
    const id = text(row.id);
    const type = text(row.event_type);
    const message = text(row.public_message);
    const createdAt = text(row.created_at);
    if (!runId || !id || !type || !message || !createdAt) continue;
    eventsByRun.set(runId, [...(eventsByRun.get(runId) ?? []), { id, type, message, createdAt }]);
  }
  const decisionsByRun = new Map<string, RadarRun["decisions"]>();
  for (const row of (decisionsResult.data ?? []) as UnknownRow[]) {
    const runId = text(row.run_id);
    const id = text(row.id);
    const decision = text(row.decision);
    const createdAt = text(row.created_at);
    if (!runId || !id || !createdAt || !["approve", "discard", "postpone"].includes(decision ?? "")) continue;
    decisionsByRun.set(runId, [...(decisionsByRun.get(runId) ?? []), {
      id,
      decision: decision as RadarDecisionAction,
      reason: text(row.reason),
      createdAt,
    }]);
  }
  const publicationsByRun = new Map<string, RadarPublicationJob>();
  for (const row of (publicationsResult.data ?? []) as UnknownRow[]) {
    const runId = text(row.run_id);
    const publication = mapPublication(row);
    if (runId && publication) publicationsByRun.set(runId, publication);
  }

  return {
    availability: settings ? "ready" : "not_configured",
    settings,
    runs: runRows.map((row) => {
      const runId = text(row.id) ?? "";
      return mapRun(row, eventsByRun.get(runId), decisionsByRun.get(runId), publicationsByRun.get(runId) ?? null);
    }).filter((run): run is RadarRun => Boolean(run)),
    engineConnected: radarEngineConnected(),
    publicationConnected: radarPublicationConnected(),
  };
}

export async function createRadarRun(input: {
  workspaceId: string;
  idempotencyKey: string;
  mode: Exclude<RadarAutonomyMode, "automatic">;
  requestKind?: "opportunity_search" | "manual_note";
  requestPayload?: Record<string, unknown>;
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("request_radar_run", {
    target_workspace_id: input.workspaceId,
    request_idempotency_key: input.idempotencyKey,
    request_mode: input.mode,
    request_kind: input.requestKind ?? "opportunity_search",
    request_payload: input.requestPayload ?? {},
  });
  if (error) throw new Error(error.message);
  const run = data ? mapRun(data as UnknownRow) : null;
  if (!run) throw new Error("Radar no devolvió una solicitud válida.");
  return run;
}

export async function updateRadarPreferences(input: {
  workspaceId: string;
  topics: string[];
  publicationsPerWeek: number;
  opportunityBehavior: "discard" | "suggest";
  publishingMode: "review" | "automatic";
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("update_radar_control_preferences", {
    target_workspace_id: input.workspaceId,
    requested_topics: input.topics,
    requested_publications_per_week: input.publicationsPerWeek,
    requested_opportunity_behavior: input.opportunityBehavior,
    requested_publishing_mode: input.publishingMode,
  });
  if (error) throw new Error(error.message);
  const settings = data ? mapSettings(data as UnknownRow) : null;
  if (!settings) throw new Error("Radar no devolvió una configuración válida.");
  return settings;
}

export async function updateRadarSchedule(input: {
  workspaceId: string;
  schedulerEnabled: boolean;
  scheduleDays: number[];
  scheduleHour: number;
  scheduleTimezone: string;
  autonomyMode: RadarAutonomyMode;
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("update_radar_control_schedule", {
    target_workspace_id: input.workspaceId,
    requested_scheduler_enabled: input.schedulerEnabled,
    requested_schedule_days: input.scheduleDays,
    requested_schedule_hour: input.scheduleHour,
    requested_timezone: input.scheduleTimezone,
    requested_autonomy_mode: input.autonomyMode,
  });
  if (error) throw new Error(error.message);
  const settings = data ? mapSettings(data as UnknownRow) : null;
  if (!settings) throw new Error("Radar no devolvió una programación válida.");
  return settings;
}

export async function decideRadarRun(input: {
  runId: string;
  idempotencyKey: string;
  decision: RadarDecisionAction;
  reason: string | null;
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("decide_radar_run", {
    target_run_id: input.runId,
    decision_idempotency_key: input.idempotencyKey,
    requested_decision: input.decision,
    decision_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  const run = data ? mapRun(data as UnknownRow) : null;
  if (!run) throw new Error("Radar no devolvió una decisión válida.");
  return run;
}

export async function getRadarRunForPublication(runId: string) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.from("radar_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw new Error(error.message);
  const run = data ? mapRun(data as UnknownRow) : null;
  if (!run) throw new Error("Corrida de Radar inexistente.");
  return run;
}

export async function reserveRadarPublication(input: {
  runId: string;
  idempotencyKey: string;
  compositionDigest: string;
  composition: Record<string, unknown>;
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("request_manual_radar_publication", {
    target_run_id: input.runId,
    publication_idempotency_key: input.idempotencyKey,
    requested_composition_digest: input.compositionDigest,
    requested_composition: input.composition,
  });
  if (error) throw new Error(error.message);
  const job = data ? mapPublication(data as UnknownRow) : null;
  if (!job) throw new Error("Radar no devolvió una reserva de publicación válida.");
  return job;
}

export async function acceptRadarPublicationDispatch(input: {
  runId: string;
  compositionDigest: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
}) {
  const client = getSupabaseAdminClient();
  const { error } = await client.rpc("record_radar_publication_dispatch", {
    target_run_id: input.runId,
    requested_composition_digest: input.compositionDigest,
    requested_pr_number: input.pullRequestNumber,
    requested_pr_url: input.pullRequestUrl,
  });
  if (error) throw new Error(error.message);
}

export async function failRadarPublicationDispatch(runId: string, message: string) {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client.from("radar_publication_jobs").update({
    status: "failed",
    error_message: message.slice(0, 500),
    completed_at: now,
    updated_at: now,
  }).eq("run_id", runId).eq("status", "reserved");
  if (error) throw new Error(error.message);
  const { error: runError } = await client.from("radar_runs").update({
    status: "failed",
    error_code: "PUBLICATION_DISPATCH_FAILED",
    error_message: message.slice(0, 500),
    completed_at: now,
    updated_at: now,
  }).eq("id", runId).eq("status", "validating");
  if (runError) throw new Error(runError.message);
  await client.from("radar_run_events").insert({
    run_id: runId,
    event_type: "manual_publication_dispatch_failed",
    public_message: "La publicación se detuvo antes de ingresar a webneoxps.",
  });
}

export async function recordRadarPublicationResult(input: {
  runId: string;
  compositionDigest: string;
  deliveryId: string;
  status: "published" | "failed";
  workflowUrl: string | null;
  mergeSha: string | null;
  finalUrl: string | null;
  errorMessage: string | null;
}) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("record_radar_publication_result", {
    target_run_id: input.runId,
    requested_composition_digest: input.compositionDigest,
    requested_delivery_id: input.deliveryId,
    requested_status: input.status,
    requested_workflow_url: input.workflowUrl,
    requested_merge_sha: input.mergeSha,
    requested_final_url: input.finalUrl,
    requested_error_message: input.errorMessage,
  });
  if (error) throw new Error(error.message);
  return { duplicate: data === true };
}

export async function reserveRadarDispatch(runId: string) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("radar_runs").update({
    status: "dispatching",
    error_code: null,
    error_message: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", runId).eq("status", "queued").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  const { error: eventError } = await client.from("radar_run_events").insert({
    run_id: runId,
    event_type: "dispatch_started",
    public_message: "Solicitud reservada para la cola editorial privada.",
  });
  if (eventError) throw new Error(eventError.message);
  return true;
}

export async function acceptRadarDispatch(input: { runId: string; externalRunId: string; externalRunUrl: string }) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("radar_runs").update({
    external_run_id: input.externalRunId.slice(0, 120),
    external_run_url: input.externalRunUrl,
    updated_at: new Date().toISOString(),
  }).eq("id", input.runId).eq("status", "dispatching");
  if (error) throw new Error(error.message);
  const { error: eventError } = await client.from("radar_run_events").insert({
    run_id: input.runId,
    event_type: "queue_accepted",
    public_message: "Solicitud ingresada en la cola editorial privada.",
  });
  if (eventError) throw new Error(eventError.message);
}

export async function failRadarDispatch(runId: string, message?: string) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("radar_runs").update({
    status: "failed",
    error_code: "QUEUE_DISPATCH_FAILED",
    error_message: message?.slice(0, 500) ?? "No se pudo contactar la cola editorial.",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", runId).eq("status", "dispatching");
  if (error) throw new Error(error.message);
  const { error: eventError } = await client.from("radar_run_events").insert({
    run_id: runId,
    event_type: "dispatch_failed",
    public_message: "No pudimos ingresar la solicitud en la cola. NexOps ya tiene el detalle técnico.",
  });
  if (eventError) throw new Error(eventError.message);
}

export async function createScheduledRadarRun(input: {
  workspaceId: string;
  idempotencyKey: string;
}) {
  const client = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await client.from("radar_runs")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return mapRun(existing as UnknownRow);

  const { data: settings, error: settingsError } = await client.from("radar_control_settings")
    .select("workspace_id,company_id,enabled,scheduler_enabled")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (settingsError || !settings || settings.enabled !== true || settings.scheduler_enabled !== true) {
    throw new Error("El scheduler de Radar está pausado.");
  }
  const { data: actor, error: actorError } = await client.from("users")
    .select("id")
    .eq("role", "platform_admin")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (actorError || !actor) throw new Error("Radar no encontró un responsable interno activo.");

  const { data, error } = await client.from("radar_runs").insert({
    workspace_id: settings.workspace_id,
    company_id: settings.company_id,
    requested_by: actor.id,
    idempotency_key: input.idempotencyKey,
    trigger_kind: "scheduled",
    request_kind: "opportunity_search",
    request_payload: {},
    autonomy_mode: "review",
    status: "queued",
  }).select("*").single();
  if (error) throw new Error(error.message);
  const { error: eventError } = await client.from("radar_run_events").insert({
    run_id: data.id,
    event_type: "scheduled_request_created",
    public_message: "Corrida programada creada por el Portal en modo revisión.",
  });
  if (eventError) throw new Error(eventError.message);
  const run = mapRun(data as UnknownRow);
  if (!run) throw new Error("Radar no devolvió una corrida programada válida.");
  return run;
}

const ALLOWED_TRANSITIONS: Record<RadarRunStatus, RadarRunStatus[]> = {
  queued: ["dispatching", "failed", "canceled"],
  dispatching: ["running", "no_publication", "suggested", "review_pending", "failed", "canceled"],
  running: ["no_publication", "suggested", "review_pending", "failed", "canceled"],
  no_publication: [],
  suggested: [],
  review_pending: ["postponed", "rejected", "approved", "failed", "canceled"],
  postponed: ["review_pending", "canceled"],
  rejected: [],
  approved: ["validating", "failed", "canceled"],
  validating: ["publishing", "failed", "canceled"],
  publishing: ["published", "failed", "canceled"],
  published: [],
  failed: [],
  canceled: [],
};

export async function recordRadarEngineEvent(input: {
  runId: string;
  workspaceId: string;
  triggerKind: "manual" | "scheduled";
  autonomyMode: Exclude<RadarAutonomyMode, "automatic">;
  requestKind: "opportunity_search" | "manual_note";
  callbackUrl: string;
  deliveryId: string;
  requestDigest: string;
  resultDigest: string;
  status: RadarRunStatus;
  publicMessage: string;
  externalRunId?: string | null;
  externalRunUrl?: string | null;
  candidate?: unknown;
  resultReason?: string | null;
}) {
  const client = getSupabaseAdminClient();
  const { data: row, error: readError } = await client.from("radar_runs")
    .select("status,workspace_id,trigger_kind,autonomy_mode,request_kind,request_payload,created_at")
    .eq("id", input.runId)
    .maybeSingle();
  if (readError || !row || !isRadarRunStatus(String(row.status))) throw new Error("Corrida de Radar inexistente.");
  if (row.workspace_id !== input.workspaceId || row.trigger_kind !== input.triggerKind ||
      row.autonomy_mode !== input.autonomyMode || row.request_kind !== input.requestKind) {
    throw new Error("El callback no corresponde a esta corrida de Radar.");
  }
  const request = buildRadarQueueRequest({
    runId: input.runId,
    requestedAt: String(row.created_at),
    workspaceId: input.workspaceId,
    triggerKind: input.triggerKind,
    autonomyMode: input.autonomyMode,
    requestKind: input.requestKind,
    manualNote: input.requestKind === "manual_note" ? parseRadarManualNoteRequest(row.request_payload) : null,
    callbackUrl: input.callbackUrl,
  });
  if (radarPayloadDigest(request) !== input.requestDigest) {
    throw new Error("El callback no corresponde al contenido original de la solicitud.");
  }
  const currentStatus = String(row.status) as RadarRunStatus;
  if (currentStatus !== input.status && !ALLOWED_TRANSITIONS[currentStatus].includes(input.status)) {
    throw new Error(`Transición de Radar inválida: ${currentStatus} → ${input.status}.`);
  }
  const candidate = input.candidate === undefined ? undefined : parseRadarCandidate(input.candidate);
  if (input.candidate !== undefined && !candidate) throw new Error("El candidato del motor no es seguro.");
  const { data: duplicate, error } = await client.rpc("record_radar_worker_result", {
    target_run_id: input.runId,
    expected_status: currentStatus,
    requested_status: input.status,
    requested_public_message: input.publicMessage.slice(0, 500),
    requested_candidate: candidate ?? null,
    requested_result_reason: input.resultReason?.slice(0, 1200) ?? null,
    requested_external_run_id: input.externalRunId?.slice(0, 120) ?? null,
    requested_external_run_url: input.externalRunUrl ?? null,
    requested_delivery_id: input.deliveryId,
    requested_request_digest: input.requestDigest,
    requested_result_digest: input.resultDigest,
  });
  if (error) throw new Error(error.message);
  return { duplicate: duplicate === true };
}
