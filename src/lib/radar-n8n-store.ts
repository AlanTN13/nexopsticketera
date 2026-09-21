import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadRadarResearchCorpus } from "@/lib/radar-workspace";
import { radarApiConfiguration } from "@/lib/radar-api-provider";
import { advanceRadarN8n, decideRadarN8n, editorialGates, RADAR_SCORE_BANDS, sanitizeRadarResponse, type RadarN8nState, type RadarGates } from "@/lib/radar-n8n-editorial";
import { radarPayloadDigest } from "@/lib/radar-engine-contract";
import { prepareRadarPublicationCandidate, buildRadarPublicationPackage } from "@/lib/radar-publication";
import { validateArticle } from "@/lib/radar-site-contract/news-contract.mjs";
import { validateEditorialCover } from "@/lib/radar-site-contract/news-image-policy.mjs";
import type { RadarRun, RadarRunCandidate } from "@/lib/radar-control-plane";

export function authenticateRadarN8n(value: string | null) {
  const secret = process.env.RADAR_N8N_CALLBACK_SECRET?.trim() ?? "";
  if (secret.length < 32 || !value) return false;
  const expected = Buffer.from(secret); const received = Buffer.from(value.trim());
  return expected.length === received.length && timingSafeEqual(expected, received);
}
const emptyUsage = { calls: 0, inputTokens: 0, outputTokens: 0, webSearchCalls: 0, responseIds: [] };
const fail = () => new Error("Corrida n8n ausente, duplicada, cancelada o vencida.");

export async function handleRadarN8n(runId: string, operation: string, payload: Record<string, unknown>) {
  const client = getSupabaseAdminClient();
  const config = radarApiConfiguration();
  if (!config.enabled) throw fail();
  const { data: row, error } = await client.from("radar_runs").select("*").eq("id", runId).maybeSingle();
  if (error || !row || row.workspace_id !== config.workspaceId || row.api_context?.engine !== "radar_api_v1") throw fail();
  const executionId = String(payload.executionId ?? "");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(executionId)) throw fail();
  if (operation === "claim") {
    if (row.status !== "dispatching") throw fail();
    const corpus = await loadRadarResearchCorpus(row.workspace_id);
    const { data: claimed, error: claimError } = await client.rpc("reserve_radar_api_run", { target_run_id: runId,
      requested_context: { corpus, model: config.model, requestedAt: new Date().toISOString(), n8nExecutionId: executionId, n8nRevision: 0, n8nIssuedCall: 0 }, pilot_max_runs: config.maxRuns });
    if (claimError || !claimed) throw fail();
    return { version: 1, runId, executionId, deadline: claimed.api_deadline_at,
      context: { preferences: claimed.api_context.preferences, corpus, model: config.model, requestedAt: claimed.api_context.requestedAt, requestKind: claimed.request_kind, requestPayload: claimed.request_payload }, responses: [] } satisfies RadarN8nState;
  }
  if (row.api_context.n8nExecutionId !== executionId) throw fail();
  if (operation === "finish" && row.api_context.n8nReceipt) return row.api_context.n8nReceipt;
  if (row.status !== "running" || Date.parse(row.api_deadline_at) <= Date.now()) throw fail();
  const saved: RadarN8nState = row.api_context.n8nState ?? {
    version: 1, runId, executionId, deadline: row.api_deadline_at,
    context: { preferences: row.api_context.preferences, corpus: row.api_context.corpus, model: row.api_context.model, requestedAt: row.api_context.requestedAt, requestKind: row.request_kind, requestPayload: row.request_payload }, responses: [],
  };
  const incoming = payload.state as RadarN8nState | undefined;
  if (!incoming || incoming.runId !== runId || !Array.isArray(incoming.responses)) throw fail();
  const responses = incoming.responses.map(sanitizeRadarResponse);
  if (responses.length < saved.responses.length || responses.length > saved.responses.length + 1 || responses.length > 4 ||
      radarPayloadDigest(responses.slice(0, saved.responses.length)) !== radarPayloadDigest(saved.responses)) throw fail();
  if (responses.length > saved.responses.length && row.api_context.n8nIssuedCall !== responses.length) throw fail();
  const state = await advanceRadarN8n({ ...saved, responses });
  const context = { ...row.api_context, n8nState: state, n8nRevision: Number(row.api_context.n8nRevision) + 1,
    phase: state.checkpoint?.phase, sources: state.checkpoint?.sources ?? [], claims: state.checkpoint?.claims ?? [], checkedClaims: state.checkpoint?.checkedClaims ?? [] };
  async function persist(extra: Record<string, unknown> = {}) {
    const { data, error: saveError } = await client.from("radar_runs").update({ api_context: context,
      api_usage: { ...row.api_usage, ...(state.checkpoint?.usage ?? emptyUsage) }, candidate: state.checkpoint?.candidate ?? null,
      updated_at: new Date().toISOString(), ...extra,
    }).eq("id", runId).eq("status", "running").eq("api_context->>n8nExecutionId", executionId)
      .eq("api_context->>n8nRevision", String(row.api_context.n8nRevision)).gt("api_deadline_at", new Date().toISOString()).select("id").maybeSingle();
    if (saveError || !data) throw fail();
  }
  if (operation === "checkpoint") {
    if (!state.request || Number(row.api_context.n8nIssuedCall) >= responses.length + 1) throw fail();
    context.n8nIssuedCall = responses.length + 1;
    await persist();
    return state;
  }
  if (!["prepare", "finish"].includes(operation) || state.request) throw fail();
  let candidate: RadarRunCandidate | null = state.result?.candidate ?? state.checkpoint?.candidate ?? null;
  const gates: RadarGates = { ...editorialGates(state), cover: false, siteValidation: false,
    budget: row.api_usage?.reserved === true && row.api_usage.pilotReservedUsd <= 5 && (state.checkpoint?.usage.calls ?? 0) <= 4 && (state.checkpoint?.usage.estimatedUsd ?? 0) <= row.api_usage.reservedUsd,
    consistency: !state.error && responses.length <= 4 };
  if (state.result?.status === "review_pending" && candidate) {
    try {
      candidate = { ...candidate, ...await prepareRadarPublicationCandidate(candidate) };
      const run = { id: runId, workspaceId: row.workspace_id, createdAt: row.created_at, candidate, status: "review_pending" } as RadarRun;
      const bundle = await buildRadarPublicationPackage(run, candidate.composition!);
      gates.cover = validateEditorialCover(bundle.article).length === 0;
      gates.siteValidation = validateArticle(bundle.article).errors.length === 0;
    } catch { gates.cover = false; gates.siteValidation = false; }
  }
  const bands = { review: Number(process.env.RADAR_REVIEW_THRESHOLD ?? RADAR_SCORE_BANDS.review), automatic: Number(process.env.RADAR_AUTO_PUBLISH_THRESHOLD ?? RADAR_SCORE_BANDS.automatic) };
  if (operation === "prepare") return { state, gates, bands };
  const decision = decideRadarN8n(state, gates, bands);
  if (radarPayloadDigest(payload.decision) !== radarPayloadDigest(decision)) throw fail();
  if (candidate) candidate = { ...candidate, score: decision.score ?? 0 };
  // Controlled pilot records AUTO_PUBLISH eligibility; it never fabricates manual approval or enables the publisher.
  const status = ({ AUTO_PUBLISH: "review_pending", READY_FOR_REVIEW: "review_pending", REJECT: "rejected", NO_PUBLICATION: "no_publication", FAILED: "failed" } as const)[decision.outcome];
  Object.assign(context, { decision, gates, bands, controlledPublication: true });
  const { data: finished, error: finishError } = await client.rpc("finish_radar_n8n_run", { target_run_id: runId, requested_execution_id: executionId, expected_revision: row.api_context.n8nRevision, requested_context: context, requested_status: status, requested_candidate: candidate,
    requested_reason: decision.outcome === "AUTO_PUBLISH" ? "Elegible para AUTO_PUBLISH en piloto controlado; publicación productiva apagada." : decision.reason,
    requested_usage: state.checkpoint?.usage ?? emptyUsage });
  if (finishError || !finished) throw fail();
  return finished;
}
