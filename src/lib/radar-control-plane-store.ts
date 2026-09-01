import "server-only";

import {
  isRadarAutonomyMode,
  isRadarRunStatus,
  parseRadarCandidate,
  type RadarAutonomyMode,
  type RadarControlPlaneSnapshot,
  type RadarControlSettings,
  type RadarDecisionAction,
  type RadarRun,
  type RadarRunEvent,
  type RadarRunStatus,
} from "@/lib/radar-control-plane";
import { radarEngineConnected } from "@/lib/radar-engine-client";
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
    nextRunAt: text(row.next_run_at),
  };
}

function mapRun(row: UnknownRow, events: RadarRunEvent[] = [], decisions: RadarRun["decisions"] = []): RadarRun | null {
  const id = text(row.id);
  const workspaceId = text(row.workspace_id);
  const requestedBy = text(row.requested_by);
  const autonomyMode = text(row.autonomy_mode);
  const status = text(row.status);
  const createdAt = text(row.created_at);
  const updatedAt = text(row.updated_at);
  if (!id || !workspaceId || !requestedBy || !autonomyMode || !status || !createdAt || !updatedAt ||
      !isRadarAutonomyMode(autonomyMode) || !isRadarRunStatus(status)) return null;
  return {
    id,
    workspaceId,
    companyId: text(row.company_id),
    requestedBy,
    triggerKind: row.trigger_kind === "scheduled" ? "scheduled" : "manual",
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
    return { availability: "not_configured", settings: null, runs: [], engineConnected: false };
  }
  if (settingsResult.error || runsResult.error) {
    return { availability: "unavailable", settings: null, runs: [], engineConnected: false };
  }

  const settings = settingsResult.data ? mapSettings(settingsResult.data as UnknownRow) : null;
  const runRows = (runsResult.data ?? []) as UnknownRow[];
  const runIds = runRows.map((row) => text(row.id)).filter((id): id is string => Boolean(id));
  const [eventsResult, decisionsResult] = runIds.length
    ? await Promise.all([
        client.from("radar_run_events").select("*").in("run_id", runIds).order("created_at", { ascending: true }),
        client.from("radar_run_decisions").select("*").in("run_id", runIds).order("created_at", { ascending: true }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

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

  return {
    availability: settings ? "ready" : "not_configured",
    settings,
    runs: runRows.map((row) => {
      const runId = text(row.id) ?? "";
      return mapRun(row, eventsByRun.get(runId), decisionsByRun.get(runId));
    }).filter((run): run is RadarRun => Boolean(run)),
    engineConnected: radarEngineConnected(),
  };
}

export async function createRadarRun(input: {
  workspaceId: string;
  idempotencyKey: string;
  mode: Exclude<RadarAutonomyMode, "automatic">;
}) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("request_radar_run", {
    target_workspace_id: input.workspaceId,
    request_idempotency_key: input.idempotencyKey,
    request_mode: input.mode,
  });
  if (error) throw new Error(error.message);
  const run = data ? mapRun(data as UnknownRow) : null;
  if (!run) throw new Error("Radar no devolvió una solicitud válida.");
  return run;
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

export async function markRadarDispatch(runId: string, state: "dispatching" | "failed", message?: string) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("radar_runs").update({
    status: state,
    error_code: state === "failed" ? "ENGINE_DISPATCH_FAILED" : null,
    error_message: state === "failed" ? message?.slice(0, 500) ?? "No se pudo contactar al motor." : null,
    completed_at: state === "failed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", runId).in("status", ["queued", "dispatching"]);
  if (error) throw new Error(error.message);
  await client.from("radar_run_events").insert({
    run_id: runId,
    event_type: state === "failed" ? "dispatch_failed" : "dispatch_started",
    public_message: state === "failed" ? "No pudimos iniciar la búsqueda. NexOps ya tiene el detalle técnico." : "Solicitud enviada al motor de Radar.",
  });
}

const ALLOWED_TRANSITIONS: Record<RadarRunStatus, RadarRunStatus[]> = {
  queued: ["dispatching", "failed", "canceled"],
  dispatching: ["running", "failed", "canceled"],
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
  status: RadarRunStatus;
  publicMessage: string;
  externalRunId?: string | null;
  externalRunUrl?: string | null;
  candidate?: unknown;
  resultReason?: string | null;
  finalUrl?: string | null;
}) {
  const client = getSupabaseAdminClient();
  const { data: row, error: readError } = await client.from("radar_runs").select("status").eq("id", input.runId).maybeSingle();
  if (readError || !row || !isRadarRunStatus(String(row.status))) throw new Error("Corrida de Radar inexistente.");
  const currentStatus = String(row.status) as RadarRunStatus;
  if (currentStatus !== input.status && !ALLOWED_TRANSITIONS[currentStatus].includes(input.status)) {
    throw new Error(`Transición de Radar inválida: ${currentStatus} → ${input.status}.`);
  }
  const candidate = input.candidate === undefined ? undefined : parseRadarCandidate(input.candidate);
  if (input.candidate !== undefined && !candidate) throw new Error("El candidato del motor no es seguro.");
  const terminal = ["no_publication", "suggested", "published", "failed", "canceled", "rejected"].includes(input.status);
  const { error: updateError } = await client.from("radar_runs").update({
    status: input.status,
    external_run_id: input.externalRunId?.slice(0, 120) ?? undefined,
    external_run_url: input.externalRunUrl ?? undefined,
    candidate,
    result_reason: input.resultReason?.slice(0, 1200) ?? undefined,
    final_url: input.finalUrl ?? undefined,
    started_at: input.status === "running" ? new Date().toISOString() : undefined,
    completed_at: terminal ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", input.runId);
  if (updateError) throw new Error(updateError.message);
  const { error: eventError } = await client.from("radar_run_events").insert({
    run_id: input.runId,
    event_type: `engine_${input.status}`,
    public_message: input.publicMessage.slice(0, 500),
  });
  if (eventError) throw new Error(eventError.message);
}
