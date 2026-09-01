import "server-only";

import type { RadarAutonomyMode, RadarManualNoteRequest, RadarRequestKind } from "@/lib/radar-control-plane";

const DEFAULT_REPOSITORY = "AlanTN13/webneoxps";
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function radarEngineConnected() {
  return Boolean(
    process.env.RADAR_ENGINE_GITHUB_TOKEN?.trim() &&
    process.env.RADAR_ENGINE_CALLBACK_SECRET?.trim(),
  );
}

export async function dispatchRadarRun(input: {
  runId: string;
  workspaceId: string;
  autonomyMode: Exclude<RadarAutonomyMode, "automatic">;
  requestKind?: RadarRequestKind;
  manualNote?: RadarManualNoteRequest | null;
  callbackUrl: string;
}) {
  const token = process.env.RADAR_ENGINE_GITHUB_TOKEN?.trim();
  const repository = (process.env.RADAR_ENGINE_GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY).trim();
  if (!token) throw new Error("La conexión server-side con el motor todavía no está configurada.");
  if (!REPOSITORY.test(repository)) throw new Error("El repositorio del motor no es válido.");

  const response = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "NexOps-Portal-Radar-Control-Plane",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "radar_control_plane_run",
      client_payload: {
        schemaVersion: 1,
        requestId: input.runId,
        workspaceId: input.workspaceId,
        mode: input.autonomyMode,
        intent: input.requestKind ?? "opportunity_search",
        manualNote: input.manualNote ?? null,
        callbackUrl: input.callbackUrl,
        publicationGate: false,
      },
    }),
  });
  if (!response.ok) throw new Error(`El motor rechazó la solicitud (${response.status}).`);
  return { repository, eventType: "radar_control_plane_run" };
}
