import { refreshAllMetricsCompanies } from "@/lib/metrics-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = await refreshAllMetricsCompanies();
  const failed = results.filter((result) => "error" in result || "missing" in result).length;

  return Response.json({
    ok: failed === 0,
    companies: results.length,
    refreshed: results.filter((result) => result.refreshed).length,
    failed,
  });
}
