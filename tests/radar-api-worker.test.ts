import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const mocks = vi.hoisted(() => ({ client: {} as Record<string, unknown>, editorial: vi.fn(), prepare: vi.fn(), corpus: vi.fn(), enabled: true }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: () => mocks.client }));
vi.mock("@/lib/radar-workspace", () => ({ loadRadarResearchCorpus: mocks.corpus }));
vi.mock("@/lib/radar-publication", () => ({ prepareRadarPublicationCandidate: mocks.prepare }));
vi.mock("@/lib/radar-api-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/radar-api-provider")>("@/lib/radar-api-provider");
  return { ...actual, executeRadarEditorial: mocks.editorial, radarApiConfiguration: () => ({ enabled: mocks.enabled, workspaceId: "pilot", maxRuns: 3, model: "gpt-5-mini" }) };
});
import { runRadarApiWorker } from "@/lib/radar-api-worker";
let row: Record<string, unknown>;
let finished: Record<string, unknown>[];
let reserve: () => unknown;
const candidate = { title: "Borrador conservado", draft: { bodyMarkdown: "texto" } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled = true; finished = [];
  row = { id: "run1", workspace_id: "pilot", status: "dispatching", api_deadline_at: new Date(Date.now() + 240000).toISOString(), api_context: { engine: "radar_api_v1" } };
  reserve = () => { row.status = "running"; row.api_context = { engine: "radar_api_v1", corpus: [], preferences: { topics: ["CRM"] }, requestKind: "manual_note", requestPayload: { sourceUrl: "https://example.com" }, model: "gpt-5-mini" }; return { data: { ...row, api_usage: { reserved: true, reservedUsd: 1.5, pilotReservedUsd: 1.5, pilotReservation: 1 } }, error: null }; };
  mocks.client = {
    from: () => {
      let patch: Record<string, unknown> | undefined; const predicates: Array<[string, unknown]> = [];
      const execute = () => { const matches = predicates.every(([key,value]) => row[key] === value); if (patch && matches) Object.assign(row, patch); return { data: matches ? { ...row } : null, error: null }; };
      const query = { select: () => query, update: (value: Record<string, unknown>) => { patch = value; return query; }, eq: (key: string, value: unknown) => { predicates.push([key, value]); return query; }, maybeSingle: async () => execute(), then: (resolve: (value: unknown) => void) => resolve(execute()) }; return query;
    },
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "reserve_radar_api_run") return reserve();
      if (name === "finish_radar_api_run") { finished.push(args); if (row.status === "running") { row.status = args.requested_status; row.candidate = args.requested_candidate; } return { data: row.status === args.requested_status, error: null }; }
      throw new Error(`Unexpected RPC ${name}`);
    }),
  };
  mocks.corpus.mockResolvedValue([]); mocks.prepare.mockResolvedValue({ composition: { title: "test" }, cover: { pngBase64: "png", sha256: "hash" } });
});
describe("Radar worker durable boundaries", () => {
  it("preserves snapshot and reserved dollars while checkpointing then builds final cover", async () => {
    mocks.editorial.mockImplementation(async input => {
      await input.checkpoint({ phase: "draft_ready", candidate, sources: [], usage: { calls: 2, inputTokens: 10, outputTokens: 20, webSearchCalls: 2, responseIds: [] } });
      return { status: "review_pending", candidate, reason: "PASS" };
    });
    await runRadarApiWorker("run1");
    expect(row.api_usage).toMatchObject({ reservedUsd: 1.5, pilotReservation: 1, calls: 2 });
    expect(finished[0].requested_candidate).toMatchObject({ ...candidate, cover: { pngBase64: "png" } });
    expect(mocks.editorial.mock.calls[0][0].context.preferences).toEqual({ topics: ["CRM"] });
  });
  it("duplicate reservation consumes no API", async () => {
    reserve = () => ({ data: null, error: null }); await runRadarApiWorker("run1"); expect(mocks.editorial).not.toHaveBeenCalled(); expect(finished).toHaveLength(0);
  });
  it("a non-owner failure cannot fail a concurrent owner's running draft", async () => {
    reserve = () => { row.status = "running"; row.candidate = candidate; return { data: null, error: { message: "transport interrupted" } }; };
    await runRadarApiWorker("run1"); expect(row.status).toBe("running"); expect(row.candidate).toEqual(candidate); expect(finished).toHaveLength(0); expect(mocks.editorial).not.toHaveBeenCalled();
  });
  it("corpus failure before claim terminates dispatching without consuming API", async () => {
    mocks.corpus.mockRejectedValue(new Error("unavailable")); await runRadarApiWorker("run1"); expect(row.status).toBe("failed"); expect(mocks.editorial).not.toHaveBeenCalled();
  });
  it("provider error preserves the last checkpointed candidate", async () => {
    mocks.editorial.mockImplementation(async input => { await input.checkpoint({ phase: "draft_ready", candidate, sources: [], usage: { calls: 2 } }); throw new Error("provider error body must not surface"); });
    await runRadarApiWorker("run1"); expect(finished[0].requested_candidate).toEqual(candidate); expect(finished[0].requested_reason).not.toContain("provider error body");
  });
  it("canceled run cannot regain a candidate from a late writer", async () => {
    mocks.editorial.mockImplementation(async input => { row.status = "canceled"; await input.assertActive(); return { status: "review_pending", candidate, reason: "late" }; });
    await runRadarApiWorker("run1"); expect(row.status).toBe("canceled"); expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
