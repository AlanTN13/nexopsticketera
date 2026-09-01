import { verifyRadarCallbackSignature } from "@/lib/radar-engine-callback";
import { isRadarRunStatus, isSafeHttpsUrl, type RadarRunStatus } from "@/lib/radar-control-plane";
import { recordRadarEngineEvent } from "@/lib/radar-control-plane-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.text();
  const secret = process.env.RADAR_ENGINE_CALLBACK_SECRET ?? "";
  if (!verifyRadarCallbackSignature(body, request.headers.get("x-radar-signature"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = typeof payload.status === "string" ? payload.status : "";
  const publicMessage = typeof payload.publicMessage === "string" ? payload.publicMessage.trim() : "";
  const externalRunUrl = typeof payload.externalRunUrl === "string" ? payload.externalRunUrl : null;
  const finalUrl = typeof payload.finalUrl === "string" ? payload.finalUrl : null;
  if (!isRadarRunStatus(status) || !publicMessage || publicMessage.length > 500 ||
      (externalRunUrl && !isSafeHttpsUrl(externalRunUrl)) || (finalUrl && !isSafeHttpsUrl(finalUrl))) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  try {
    await recordRadarEngineEvent({
      runId,
      status: status as RadarRunStatus,
      publicMessage,
      externalRunId: typeof payload.externalRunId === "string" ? payload.externalRunId : null,
      externalRunUrl,
      candidate: payload.candidate,
      resultReason: typeof payload.resultReason === "string" ? payload.resultReason : null,
      finalUrl,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Rejected" }, { status: 409 });
  }
}
