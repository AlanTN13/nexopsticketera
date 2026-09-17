import { authenticateRadarN8n, handleRadarN8n } from "@/lib/radar-n8n-store";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!authenticateRadarN8n(request.headers.get("x-radar-callback-secret"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { runId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return Response.json({ error: "Invalid run" }, { status: 400 });
  // Bound the stream before JSON parsing, even if Content-Length is absent or forged.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Missing body" }, { status: 400 });
  let bytes = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1000000) { await reader.cancel(); return Response.json({ error: "Too large" }, { status: 413 }); } chunks.push(part.value); }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await handleRadarN8n(runId, String(payload.operation), payload);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ error: "Radar rejected the transition; inspect run status." }, { status: 409 }); }
}
