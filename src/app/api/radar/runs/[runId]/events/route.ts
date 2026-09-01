import { verifyRadarCallbackSignature } from "@/lib/radar-engine-callback";
import { isSafeHttpsUrl, parseRadarCandidate, type RadarRunStatus } from "@/lib/radar-control-plane";
import { recordRadarEngineEvent } from "@/lib/radar-control-plane-store";
import { radarPayloadDigest } from "@/lib/radar-engine-contract";

export const runtime = "nodejs";

const RESULT_STATUSES = ["no_publication", "suggested", "review_pending", "failed"] as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.text();
  const timestamp = request.headers.get("x-radar-timestamp");
  const secret = process.env.RADAR_ENGINE_CALLBACK_SECRET ?? "";
  if (!verifyRadarCallbackSignature({
    body,
    signature: request.headers.get("x-radar-signature"),
    timestamp,
    secret,
  })) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("x-radar-delivery-id") !== `radar-${runId}` ||
      request.headers.get("idempotency-key") !== runId) {
    return Response.json({ error: "Invalid delivery" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)
    ? payload.result as Record<string, unknown>
    : null;
  const workspaceId = text(payload.workspaceId);
  const trigger = text(payload.trigger);
  const mode = text(payload.mode);
  const intent = text(payload.intent);
  const status = text(result?.status);
  const publicMessage = text(result?.publicMessage);
  const externalRunUrl = text(result?.externalRunUrl) || null;
  const candidate = result?.candidate === undefined ? undefined : parseRadarCandidate(result.candidate);
  const resultReason = text(result?.resultReason) || null;
  const requestDigest = text(payload.requestDigest);
  const resultDigest = text(payload.resultDigest);
  const deliveryId = text(payload.deliveryId);
  const rawCandidate = result?.candidate;
  const candidateShapeValid = rawCandidate === null || Boolean(rawCandidate && typeof rawCandidate === "object" &&
    !Array.isArray(rawCandidate) && hasExactKeys(rawCandidate as Record<string, unknown>, [
      "title", "topic", "sourceName", "sourceUrl", "score", "businessReasons", "draft",
    ]) && (rawCandidate as Record<string, unknown>).draft &&
    typeof (rawCandidate as Record<string, unknown>).draft === "object" &&
    !Array.isArray((rawCandidate as Record<string, unknown>).draft) &&
    hasExactKeys((rawCandidate as Record<string, unknown>).draft as Record<string, unknown>, [
      "headline", "deck", "bodyMarkdown",
    ]));

  if (!hasExactKeys(payload, ["schemaVersion", "event", "deliveryId", "requestId", "workspaceId", "trigger", "mode", "intent", "publicationGate", "requestDigest", "resultDigest", "result"]) ||
      !result || !hasExactKeys(result, ["status", "publicationGate", "publicMessage", "candidate", "resultReason", "externalRunId", "externalRunUrl"]) ||
      !candidateShapeValid || payload.schemaVersion !== 1 || payload.event !== "radar.worker.completed" || payload.requestId !== runId ||
      deliveryId !== `radar-${runId}` || payload.publicationGate !== false || result?.publicationGate !== false ||
      !/^[0-9a-f]{64}$/.test(requestDigest) || !/^[0-9a-f]{64}$/.test(resultDigest) ||
      radarPayloadDigest(result) !== resultDigest ||
      !/^[a-z0-9][a-z0-9._-]{2,80}$/.test(workspaceId) || !["manual", "scheduled"].includes(trigger) ||
      !["suggest", "review"].includes(mode) || !["opportunity_search", "manual_note"].includes(intent) ||
      (intent === "manual_note" && (mode !== "review" || trigger !== "manual")) ||
      !RESULT_STATUSES.includes(status as (typeof RESULT_STATUSES)[number]) || !publicMessage || publicMessage.length > 500 ||
      (externalRunUrl && !isSafeHttpsUrl(externalRunUrl)) ||
      (["suggested", "review_pending"].includes(status) && (!candidate || !candidate.draft)) ||
      (["no_publication", "failed"].includes(status) && !resultReason)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const recorded = await recordRadarEngineEvent({
      runId,
      workspaceId,
      triggerKind: trigger as "manual" | "scheduled",
      autonomyMode: mode as "suggest" | "review",
      requestKind: intent as "opportunity_search" | "manual_note",
      callbackUrl: `${new URL(request.url).origin}/api/radar/runs/${runId}/events`,
      deliveryId,
      requestDigest,
      resultDigest,
      status: status as RadarRunStatus,
      publicMessage,
      externalRunId: text(result?.externalRunId) || null,
      externalRunUrl,
      candidate: candidate ?? undefined,
      resultReason,
    });
    return Response.json({ ok: true, duplicate: recorded.duplicate });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Rejected" }, { status: 409 });
  }
}
