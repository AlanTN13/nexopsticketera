import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await getSupabaseAdminClient().rpc("expire_radar_api_runs");
  // Maintenance only until Buscar ahora has been validated; no API or legacy searches.
  return Response.json({ ok: true, skipped: "api_rollout_gate_off" });
}
