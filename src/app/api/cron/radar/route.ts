import { dispatchRadarRun, radarEngineConnected } from "@/lib/radar-engine-client";
import {
  acceptRadarDispatch,
  createScheduledRadarRun,
  failRadarDispatch,
  reserveRadarDispatch,
} from "@/lib/radar-control-plane-store";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { getPlatformRadarWorkspaceId } from "@/lib/platform-radar";
import { radarScheduleDate, radarScheduledIdempotencyKey } from "@/lib/radar-scheduler";
import { discoverPlatformRadarWorkspaceId } from "@/lib/radar-workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (process.env.RADAR_SCHEDULER_ENABLED !== "true") {
    return Response.json({ ok: true, skipped: "scheduler_gate_off" });
  }
  if (!radarEngineConnected()) {
    return Response.json({ ok: false, error: "worker_not_configured" }, { status: 503 });
  }

  const workspaceId = getPlatformRadarWorkspaceId() ?? await discoverPlatformRadarWorkspaceId();
  const origin = getPublicAppUrl();
  if (!origin) return Response.json({ ok: false, error: "portal_origin_missing" }, { status: 503 });
  const date = radarScheduleDate();
  const run = await createScheduledRadarRun({
    workspaceId,
    idempotencyKey: radarScheduledIdempotencyKey(workspaceId, date),
  });
  if (!run) return Response.json({ ok: false, error: "invalid_scheduled_run" }, { status: 500 });
  const reserved = await reserveRadarDispatch(run.id);
  if (!reserved) return Response.json({ ok: true, duplicate: true, runId: run.id });

  try {
    const queued = await dispatchRadarRun({
      runId: run.id,
      requestedAt: run.createdAt,
      workspaceId,
      triggerKind: "scheduled",
      autonomyMode: "review",
      requestKind: "opportunity_search",
      callbackUrl: `${origin}/api/radar/runs/${run.id}/events`,
    });
    await acceptRadarDispatch({
      runId: run.id,
      externalRunId: queued.externalRunId,
      externalRunUrl: queued.externalRunUrl,
    });
    return Response.json({ ok: true, duplicate: queued.reused, runId: run.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo contactar la cola editorial.";
    await failRadarDispatch(run.id, message);
    return Response.json({ ok: false, error: "queue_dispatch_failed" }, { status: 502 });
  }
}
