import { refreshScheduledContentWorkspaces } from "@/lib/content-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await refreshScheduledContentWorkspaces();
  const failed = results.filter((result) => "error" in result).length;
  return Response.json({ ok: failed === 0, workspaces: results.length, failed, results });
}
