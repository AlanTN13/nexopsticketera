import "server-only";
import { radarApiConfiguration } from "@/lib/radar-api-provider";
import { isSafeHttpsUrl } from "@/lib/radar-control-plane";

/** Only dispatches to n8n. No editorial loop, OpenAI key or Next after() worker. */
export async function dispatchRadarN8n(runId: string) {
  const url = process.env.RADAR_N8N_WEBHOOK_URL?.trim() ?? "";
  if (!radarApiConfiguration().enabled || !isSafeHttpsUrl(url) || new URL(url).search || new URL(url).hash) throw new Error("El webhook privado de n8n no está configurado.");
  try {
    const response = await fetch(url, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { "content-type": "application/json", "x-radar-dispatch-secret": process.env.RADAR_N8N_DISPATCH_SECRET!, "idempotency-key": runId },
      body: JSON.stringify({ version: 1, runId }),
    });
    if (!response.ok) throw new Error("dispatch");
  } catch { throw new Error("n8n no confirmó la recepción. Revisá el estado antes de reintentar; la reserva evita duplicados."); }
}
