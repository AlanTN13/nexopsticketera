import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const schedule = vi.hoisted(() => vi.fn());
vi.mock("@/lib/radar-api-worker", () => ({ dispatchRadarN8n: schedule }));
import { buildRadarQueueRequest, dispatchRadarRun, radarEngineConnected } from "@/lib/radar-engine-client";
const runId = "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4";
const baseInput = { runId, requestedAt: "2026-09-01T18:00:00.123456+00:00", workspaceId: "nexops", triggerKind: "manual" as const, autonomyMode: "review" as const, requestKind: "opportunity_search" as const, callbackUrl: `https://portal.nexopstech.com/api/radar/runs/${runId}/events` };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("Radar API replaces queue while preserving historical request contract", () => {
  beforeEach(() => { vi.stubEnv("RADAR_API_ENABLED", "true"); vi.stubEnv("RADAR_API_PILOT_WORKSPACE_ID", "nexops"); vi.stubEnv("RADAR_API_PILOT_MAX_RUNS", "3"); vi.stubEnv("RADAR_OPENAI_MODEL", "gpt-5-mini"); vi.stubEnv("RADAR_N8N_WEBHOOK_URL", "https://automation.example/webhook/radar"); vi.stubEnv("RADAR_N8N_DISPATCH_SECRET", "d".repeat(32)); vi.stubEnv("RADAR_N8N_CALLBACK_SECRET", "c".repeat(32)); });
  it("preserves manual URL and canonical timestamp for historical callbacks", () => {
    const request = buildRadarQueueRequest({ ...baseInput, requestKind: "manual_note", manualNote: { title: " Nota ", sourceUrl: "https://example.com", instructions: " Contexto " } });
    expect(request.requestedAt).toBe("2026-09-01T18:00:00.123Z"); expect(request.manualNote).toEqual({ title: "Nota", sourceUrl: "https://example.com", instructions: "Contexto" }); expect(request.publicationGate).toBe(false);
  });
  it("dispatches n8n work without any GitHub queue mutation", async () => {
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    expect(await dispatchRadarRun(baseInput)).toMatchObject({ externalRunId: `n8n:${runId}` }); expect(schedule).toHaveBeenCalledWith(runId); expect(network).not.toHaveBeenCalled();
  });
  it("never uses old queue credentials as silent fallback", async () => {
    vi.stubEnv("RADAR_N8N_WEBHOOK_URL", ""); vi.stubEnv("RADAR_QUEUE_GITHUB_TOKEN", "test-old-key"); vi.stubEnv("RADAR_ENGINE_CALLBACK_SECRET", "a".repeat(32));
    expect(radarEngineConnected()).toBe(false); await expect(dispatchRadarRun(baseInput)).rejects.toThrow("no está habilitado"); expect(schedule).not.toHaveBeenCalled();
  });
  it("rejects a different workspace before starting work", async () => { await expect(dispatchRadarRun({ ...baseInput, workspaceId: "another" })).rejects.toThrow(); expect(schedule).not.toHaveBeenCalled(); });
  it("keeps productive cron gated", async () => { await expect(dispatchRadarRun({ ...baseInput, triggerKind: "scheduled" })).rejects.toThrow("validación de Buscar ahora"); expect(schedule).not.toHaveBeenCalled(); });
  it("validates unsafe historical manual input", () => { expect(() => buildRadarQueueRequest({ ...baseInput, requestKind: "manual_note", manualNote: { sourceUrl: "http://localhost", title: null, instructions: null } })).toThrow(); });
});
