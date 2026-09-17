import "server-only";

import { isSafeHttpsUrl, type RadarAutonomyMode, type RadarManualNoteRequest, type RadarRequestKind } from "@/lib/radar-control-plane";
import { radarApiConfiguration } from "@/lib/radar-api-provider";
import { dispatchRadarN8n } from "@/lib/radar-api-worker";
import { isRadarWorkerWorkspaceId } from "@/lib/radar-engine-contract";

export type RadarQueueRequest = {
  schemaVersion: 1;
  requestId: string;
  requestedAt: string;
  workspaceId: string;
  trigger: "manual" | "scheduled";
  mode: Exclude<RadarAutonomyMode, "automatic">;
  intent: RadarRequestKind;
  manualNote: RadarManualNoteRequest | null;
  callbackUrl: string;
  publicationGate: false;
};

export function radarEngineConnected() {
  return radarApiConfiguration().enabled;
}

export function buildRadarQueueRequest(input: {
  runId: string;
  requestedAt: string;
  workspaceId: string;
  triggerKind: "manual" | "scheduled";
  autonomyMode: Exclude<RadarAutonomyMode, "automatic">;
  requestKind?: RadarRequestKind;
  manualNote?: RadarManualNoteRequest | null;
  callbackUrl: string;
}): RadarQueueRequest {
  if (!/^[0-9a-f-]{36}$/i.test(input.runId) || !isRadarWorkerWorkspaceId(input.workspaceId) ||
      !Number.isFinite(Date.parse(input.requestedAt)) || !isSafeHttpsUrl(input.callbackUrl) ||
      (input.manualNote && !isSafeHttpsUrl(input.manualNote.sourceUrl)) ||
      (input.requestKind === "manual_note" && (!input.manualNote || input.autonomyMode !== "review"))) {
    throw new Error("La solicitud para la cola editorial no es válida.");
  }
  const manualNote = input.manualNote ? {
    title: input.manualNote.title?.trim() || null,
    sourceUrl: input.manualNote.sourceUrl.trim(),
    instructions: input.manualNote.instructions?.trim() || null,
  } : null;
  return {
    schemaVersion: 1,
    requestId: input.runId.toLowerCase(),
    requestedAt: new Date(input.requestedAt).toISOString(),
    workspaceId: input.workspaceId.toLowerCase(),
    trigger: input.triggerKind,
    mode: input.autonomyMode,
    intent: input.requestKind ?? "opportunity_search",
    manualNote,
    callbackUrl: input.callbackUrl.trim(),
    publicationGate: false,
  };
}

/** n8n-only dispatch: never silently falls back to the historical private queue. */
export async function dispatchRadarRun(input: Parameters<typeof buildRadarQueueRequest>[0]) {
  const config = radarApiConfiguration();
  if (!config.enabled || input.workspaceId !== config.workspaceId) throw new Error("El piloto API no está habilitado para este workspace.");
  if (input.triggerKind === "scheduled") throw new Error("La programación API espera la validación de Buscar ahora.");
  buildRadarQueueRequest(input);
  await dispatchRadarN8n(input.runId);
  return { externalRunId: `n8n:${input.runId}`, externalRunUrl: input.callbackUrl, reused: false };
}
