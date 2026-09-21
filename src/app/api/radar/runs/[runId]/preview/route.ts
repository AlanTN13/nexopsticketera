import { requireRadarWorkspaceAccess } from "@/lib/radar-control-plane-auth";
import { getRadarRunForPublication } from "@/lib/radar-control-plane-store";
import { buildRadarPublicationPackage, type RadarPublicationComposition } from "@/lib/radar-publication";
import { issueRadarPreviewToken, radarPreviewWebUrl } from "@/lib/radar-preview";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origen no válido." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 100_000) return Response.json({ error: "Paquete demasiado grande." }, { status: 413 });
  try {
    const { runId } = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(runId)) return Response.json({ error: "Nota no válida." }, { status: 400 });
    const body = await request.text();
    if (body.length > 100_000) return Response.json({ error: "Paquete demasiado grande." }, { status: 413 });
    const { workspaceId, composition } = JSON.parse(body) as { workspaceId: string; composition: RadarPublicationComposition };
    const { actor } = await requireRadarWorkspaceAccess(workspaceId, "admin");
    const run = await getRadarRunForPublication(runId);
    if (run.workspaceId !== workspaceId) return Response.json({ error: "Nota no disponible." }, { status: 403 });
    const webUrl = radarPreviewWebUrl();
    const bundle = await buildRadarPublicationPackage(run, composition);
    const token = issueRadarPreviewToken({ runId, workspaceId, actorId: actor.id, compositionDigest: bundle.compositionDigest });
    return Response.json({ ...bundle, token, webUrl }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo preparar la vista previa." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
