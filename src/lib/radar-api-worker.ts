import "server-only";

import { after } from "next/server";
import { executeRadarEditorial, radarApiConfiguration, RadarApiError, type RadarApiCheckpoint, type RadarApiContext } from "@/lib/radar-api-provider";
import { prepareRadarPublicationCandidate } from "@/lib/radar-publication";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadRadarResearchCorpus } from "@/lib/radar-workspace";
import type { RadarRunCandidate } from "@/lib/radar-control-plane";

export async function runRadarApiWorker(runId: string) {
  const client = getSupabaseAdminClient();
  let checkpoint: RadarApiCheckpoint = { phase: "starting", candidate: null, sources: [], usage: { calls: 0, inputTokens: 0, outputTokens: 0, webSearchCalls: 0, responseIds: [] } };
  let context: Record<string, unknown> = {};
  let ownsClaim = false;
  async function finish(status: string, candidate: RadarRunCandidate | null, reason: string) {
    const { error } = await client.rpc("finish_radar_api_run", { target_run_id: runId, requested_status: status,
      requested_candidate: candidate, requested_reason: reason, requested_usage: checkpoint.usage });
    if (error) throw new RadarApiError("PERSISTENCE_FAILED", "No se pudo guardar el resultado. Radar conserva la corrida para recuperarla al vencer el plazo.");
  }
  try {
    const config = radarApiConfiguration();
    if (!config.enabled) throw new RadarApiError("PILOT_DISABLED", "El piloto API todavía no tiene credencial y límites habilitados.");
    const { data: pending, error: pendingError } = await client.from("radar_runs").select("workspace_id,status,api_context,api_deadline_at").eq("id", runId).maybeSingle();
    if (pendingError) throw new RadarApiError("PERSISTENCE_FAILED", "No se pudo leer la corrida.");
    if (!pending || pending.status !== "dispatching" || pending.api_context?.engine !== "radar_api_v1") return;
    if (pending.workspace_id !== config.workspaceId) throw new RadarApiError("PILOT_WORKSPACE", "Este workspace no está habilitado para el piloto API.");
    const corpus = await loadRadarResearchCorpus(pending.workspace_id);
    const { data: claimed, error } = await client.rpc("reserve_radar_api_run", { target_run_id: runId,
      requested_context: { corpus, model: config.model, requestedAt: new Date().toISOString() }, pilot_max_runs: config.maxRuns });
    if (error) throw new RadarApiError("PILOT_RESERVATION", "No se pudo reservar uso del piloto: verificá el límite acumulado y la configuración.");
    if (!claimed) return;
    ownsClaim = true;
    context = claimed.api_context;
    const reservation = claimed.api_usage;
    const remaining = Date.parse(claimed.api_deadline_at) - Date.now() - 15000;
    if (remaining <= 0) throw new RadarApiError("API_TIMEOUT", "Venció el plazo de esta corrida.");
    const signal = AbortSignal.timeout(remaining);
    const assertActive = async () => {
      const { data: active, error: activeError } = await client.from("radar_runs").select("status,api_deadline_at").eq("id", runId).maybeSingle();
      if (activeError) throw new RadarApiError("PERSISTENCE_FAILED", "No se pudo confirmar el estado de la corrida.");
      if (active?.status !== "running" || Date.parse(active.api_deadline_at) <= Date.now()) throw new RadarApiError("CANCELED", "La corrida se canceló o venció; la respuesta tardía no se aplicó.");
    };
    const result = await executeRadarEditorial({ context: { preferences: context.preferences, corpus: context.corpus, requestKind: context.requestKind, requestPayload: context.requestPayload, requestedAt: context.requestedAt, model: context.model } as RadarApiContext, apiKey: process.env.OPENAI_API_KEY!, signal, assertActive,
      checkpoint: async (value) => {
        checkpoint = structuredClone(value);
        await assertActive();
        const { data, error: checkpointError } = await client.from("radar_runs").update({
          api_context: { ...context, phase: value.phase, sources: value.sources, claims: value.claims ?? [], checkedClaims: value.checkedClaims ?? [], review: value.review ?? null },
          api_usage: { ...reservation, ...value.usage }, candidate: value.candidate, updated_at: new Date().toISOString(),
        }).eq("id", runId).eq("status", "running").select("id").maybeSingle();
        if (checkpointError || !data) throw new RadarApiError("PERSISTENCE_FAILED", "No se pudo preservar el avance editorial.");
      },
    });
    let candidate = result.candidate;
    if (result.status === "review_pending" && candidate) {
      await assertActive();
      const prepared = await prepareRadarPublicationCandidate(candidate);
      candidate = { ...candidate, ...prepared };
    }
    await finish(result.status, candidate, result.reason);
  } catch (error) {
    // Fixed public messages only: no upstream payload, stack, credential or private reasoning.
    const message = error instanceof RadarApiError ? error.message : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
      ? "OpenAI o la corrida superaron el plazo del piloto. Se conserva el borrador y el uso reservado."
      : "Falló la preparación de Radar. Se conserva el avance para su recuperación.";
    try {
      if (ownsClaim) await finish("failed", checkpoint.candidate, message);
      else await client.from("radar_runs").update({ status: "failed", error_code: "API_PREPARATION_FAILED", error_message: message, result_reason: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", runId).eq("status", "dispatching");
    }
    catch { /* Expiration on the next read or cron maintenance terminates an orphaned API lease. */ }
  }
}

export function scheduleRadarApiWorker(runId: string) {
  after(async () => { await runRadarApiWorker(runId); });
}
