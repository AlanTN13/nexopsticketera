import { executeRadarEditorial, RADAR_API_LIMITS, RadarApiError, validateRadarDuplicateMatch, type RadarApiContext, type RadarApiCheckpoint, type RadarApiResult } from "@/lib/radar-api-provider";
import { isSafeHttpsUrl } from "@/lib/radar-control-plane";

type Json = Record<string, unknown>;
export type RadarN8nState = {
  version: 1; runId: string; executionId: string; deadline: string; context: RadarApiContext;
  responses: Json[]; checkpoint?: RadarApiCheckpoint;
  request?: Json; result?: RadarApiResult; error?: string;
};
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};

/** Drops reasoning, provider errors, headers, and all undocumented provider fields. */
export function sanitizeRadarResponse(value: unknown): Json {
  const body = object(value);
  if (body.error || !Array.isArray(body.output)) return { status: "failed", output: [] };
  return {
    status: body.status, id: typeof body.id === "string" ? body.id.slice(0, 200) : undefined,
    usage: { input_tokens: object(body.usage).input_tokens, output_tokens: object(body.usage).output_tokens },
    output: body.output.filter(raw => ["message", "web_search_call"].includes(String(object(raw).type))).map(raw => {
      const item = object(raw);
      if (item.type === "web_search_call") {
        const action = object(item.action);
        return { type: item.type,
          status: ["completed", "failed", "incomplete", "in_progress", "searching"].includes(String(item.status)) ? item.status : undefined,
          action: { sources: Array.isArray(action.sources) ? action.sources : [],
            type: ["search", "open_page", "find_in_page"].includes(String(action.type)) ? action.type : undefined,
            ...(typeof action.url === "string" && action.url.length <= 2000 && isSafeHttpsUrl(action.url) ? { url: action.url } : {}) } };
      }
      return { type: item.type, content: (Array.isArray(item.content) ? item.content : []).filter(raw => object(raw).type === "output_text").map(raw => {
        const content = object(raw);
        return { type: content.type, text: content.text, annotations: Array.isArray(content.annotations) ? content.annotations : [] };
      }) };
    }),
  };
}

/** Deterministic replay never calls a provider. n8n owns the HTTP request between turns. */
export async function advanceRadarN8n(input: RadarN8nState): Promise<RadarN8nState> {
  const state = structuredClone(input);
  delete state.request; delete state.result; delete state.error;
  let cursor = 0;
  class NextRequest extends Error { constructor(public body: Json) { super("NEXT_REQUEST"); } }
  try {
    if (state.version !== 1 || state.context.model !== "gpt-5-mini" || !Array.isArray(state.responses) || state.responses.length > RADAR_API_LIMITS.callsPerRun) throw new Error("invalid");
    const result = await executeRadarEditorial({ context: state.context, signal: { throwIfAborted() {} } as AbortSignal,
      assertActive: async () => { if (!Number.isFinite(Date.parse(state.deadline)) || Date.parse(state.deadline) <= Date.now()) throw new RadarApiError("API_TIMEOUT", "Venció el plazo de la corrida."); },
      checkpoint: async checkpoint => { state.checkpoint = structuredClone(checkpoint); },
      fetchImpl: (async (_url: unknown, init: RequestInit) => {
        if (cursor < state.responses.length) return { ok: true, json: async () => state.responses[cursor++] };
        throw new NextRequest(JSON.parse(String(init.body)));
      }) as typeof fetch,
    });
    if (cursor !== state.responses.length) throw new Error("unexpected response");
    state.result = result;
  } catch (error) {
    if (error instanceof NextRequest) state.request = error.body;
    else state.error = error instanceof RadarApiError ? error.message : "Falló el contrato editorial de n8n.";
  }
  return state;
}

// Existing bands: webneoxps/docs/content-engine-v1.md. Explicit configuration wins.
export const RADAR_SCORE_BANDS = { review: 70, automatic: 85 } as const;
export const RADAR_SCORE_CRITERIA = ["businessImpact", "novelty", "evidenceQuality", "actionability", "timeliness"] as const;
export const RADAR_CRITICAL_GATES = ["sources", "facts", "novelty", "clientClaims", "content", "cover", "siteValidation", "budget", "consistency"] as const;
export type RadarGates = Record<(typeof RADAR_CRITICAL_GATES)[number], boolean>;
export type RadarEditorialDecision = { outcome: "AUTO_PUBLISH" | "READY_FOR_REVIEW" | "REJECT" | "NO_PUBLICATION" | "FAILED"; eligibility: "ELIGIBLE" | "INELIGIBLE"; score: number | null; reason: string; failedGates: string[] };

function lastReview(state: RadarN8nState): Json {
  try {
    const messages = (state.responses.at(-1)?.output as Json[] ?? []).filter(item => item.type === "message");
    return JSON.parse(messages.flatMap(item => (item.content as Json[]).map(part => part.text)).join("\n"));
  } catch { return {}; }
}
export function decideRadarN8n(state: RadarN8nState, gates: RadarGates, bands: { review: number; automatic: number } = RADAR_SCORE_BANDS): RadarEditorialDecision {
  const fail = (outcome: RadarEditorialDecision["outcome"], reason: string, failedGates: string[] = []): RadarEditorialDecision => ({ outcome, eligibility: "INELIGIBLE", score: null, reason, failedGates });
  if (state.error) return fail("FAILED", state.error, ["consistency"]);
  if (state.result?.status === "no_publication") return fail("NO_PUBLICATION", state.result.reason);
  if (state.result?.status !== "review_pending" || state.result.candidate?.qa?.verdict !== "PASS") return fail("REJECT", state.result?.reason ?? "QA no aprobado.", state.result?.candidate?.qa && ["PASS", "FIX", "REJECT"].includes(String(lastReview(state).verdict)) ? Object.entries(editorialGates(state)).filter(([, passed]) => !passed).map(([key]) => key) : []);
  const failed = RADAR_CRITICAL_GATES.filter(key => gates[key] !== true);
  if (failed.length) return fail("REJECT", "La pieza incumple normas críticas.", failed);
  if (!Number.isInteger(bands.review) || !Number.isInteger(bands.automatic) || bands.review < 0 || bands.review >= bands.automatic || bands.automatic > 100) return fail("FAILED", "Bandas editoriales inválidas.", ["consistency"]);
  const rubric = object(lastReview(state).rubric);
  const consulted = new Set(state.result.sources.map(source => source.url));
  // No free base points; level 4 requires independent consulted hosts. 95+ needs four exceptional criteria.
  const points = [0, 8, 14, 17, 20];
  let score = 0;
  for (const criterion of RADAR_SCORE_CRITERIA) {
    const item = object(rubric[criterion]);
    const level = item.level;
    const urls = Array.isArray(item.sourceUrls) ? [...new Set(item.sourceUrls)] : [];
    const proven = typeof item.evidence === "string" && item.evidence.trim().length >= 20 && urls.length > 0 && urls.every(url => typeof url === "string" && isSafeHttpsUrl(url) && consulted.has(url));
    if (proven && Number.isInteger(level) && Number(level) >= 0 && Number(level) <= 4) {
      const independent = new Set((urls as string[]).map(url => new URL(url).hostname.replace(/^www\./, ""))).size >= 2;
      score += points[Number(level) === 4 && !independent ? 3 : Number(level)];
    }
  }
  if (score < bands.review) return fail("REJECT", "La evidencia no alcanza la banda editorial de oportunidad.");
  return { outcome: score >= bands.automatic ? "AUTO_PUBLISH" : "READY_FOR_REVIEW", eligibility: "ELIGIBLE", score, reason: state.result.reason, failedGates: [] };
}

export function editorialGates(state: RadarN8nState): Pick<RadarGates, "sources" | "facts" | "novelty" | "clientClaims" | "content"> {
  const report = object(lastReview(state).criticalGates);
  const review = lastReview(state);
  const invalidDuplicate = report.novelty === false && !validateRadarDuplicateMatch(review.duplicateMatch, state.context.corpus);
  return { sources: report.sources === true, facts: report.facts === true, novelty: report.novelty === true || invalidDuplicate, clientClaims: report.clientClaims === true, content: report.content === true };
}
