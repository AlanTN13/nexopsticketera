import { verifyRadarCallbackSignature } from "@/lib/radar-engine-callback";
import { isSafeHttpsUrl } from "@/lib/radar-control-plane";
import { recordRadarPublicationResult } from "@/lib/radar-control-plane-store";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.text();
  if (!verifyRadarCallbackSignature({
    body,
    signature: request.headers.get("x-radar-signature"),
    timestamp: request.headers.get("x-radar-timestamp"),
    secret: process.env.RADAR_PUBLICATION_CALLBACK_SECRET ?? "",
  })) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deliveryId = `radar-publication-${runId}`;
  if (request.headers.get("x-radar-delivery-id") !== deliveryId || request.headers.get("idempotency-key") !== deliveryId) {
    return Response.json({ error: "Invalid delivery" }, { status: 400 });
  }
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(body) as Record<string, unknown>; }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const status = text(payload.status);
  const compositionDigest = text(payload.compositionDigest);
  const workflowUrl = text(payload.workflowUrl) || null;
  const mergeSha = text(payload.mergeSha) || null;
  const finalUrl = text(payload.finalUrl) || null;
  const errorMessage = text(payload.errorMessage) || null;
  if (!exactKeys(payload, ["schemaVersion", "event", "requestId", "compositionDigest", "status", "workflowUrl", "mergeSha", "finalUrl", "errorMessage"]) ||
      payload.schemaVersion !== 1 || payload.event !== "radar.publication.completed" || payload.requestId !== runId ||
      !/^[0-9a-f]{64}$/.test(compositionDigest) || !["published", "failed"].includes(status) ||
      (workflowUrl && !isSafeHttpsUrl(workflowUrl)) ||
      (status === "published" && (!mergeSha || !/^[0-9a-f]{40}$/.test(mergeSha) || !finalUrl?.startsWith("https://www.nexopstech.com/noticias/"))) ||
      (status === "failed" && !errorMessage)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  try {
    const result = await recordRadarPublicationResult({
      runId,
      compositionDigest,
      deliveryId,
      status: status as "published" | "failed",
      workflowUrl,
      mergeSha,
      finalUrl,
      errorMessage,
    });
    return Response.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Rejected" }, { status: 409 });
  }
}
