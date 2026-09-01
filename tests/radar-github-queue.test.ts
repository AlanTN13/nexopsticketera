import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildRadarQueueRequest, dispatchRadarRun } from "@/lib/radar-engine-client";

const runId = "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4";
const baseInput = {
  runId,
  requestedAt: "2026-09-01T18:00:00.123456+00:00",
  workspaceId: "nexops",
  triggerKind: "manual" as const,
  autonomyMode: "review" as const,
  requestKind: "opportunity_search" as const,
  callbackUrl: `https://portal.nexopstech.com/api/radar/runs/${runId}/events`,
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Radar private GitHub queue", () => {
  beforeEach(() => {
    vi.stubEnv("RADAR_QUEUE_GITHUB_TOKEN", "private-test-token");
    vi.stubEnv("RADAR_QUEUE_GITHUB_REPOSITORY", "AlanTN13/radar-history");
    vi.stubEnv("RADAR_QUEUE_GITHUB_BASE_BRANCH", "history");
    vi.stubEnv("RADAR_ENGINE_CALLBACK_SECRET", "callback-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes timestamps and public manual URLs before enqueue", () => {
    const request = buildRadarQueueRequest({
      ...baseInput,
      requestKind: "manual_note",
      manualNote: { title: " Nota ", sourceUrl: "https://example.com", instructions: " Contexto " },
    });
    expect(request.requestedAt).toBe("2026-09-01T18:00:00.123Z");
    expect(request.manualNote).toEqual({
      title: "Nota",
      sourceUrl: "https://example.com/",
      instructions: "Contexto",
    });
    expect(request.publicationGate).toBe(false);
  });

  it("writes one request branch and PR only after proving the repository is private", async () => {
    const responses = [
      json({ private: true, visibility: "private" }),
      json([]),
      json({ object: { sha: "a".repeat(40) } }),
      json({}, 201),
      json({}, 404),
      json({}, 201),
      json({ number: 17, html_url: "https://github.com/AlanTN13/radar-history/pull/17" }, 201),
    ];
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => responses.shift() ?? json({}, 500),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchRadarRun(baseInput);
    expect(result).toMatchObject({ externalRunId: "17", reused: false });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.github.com/repos/AlanTN13/radar-history");
    const put = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
    expect(put).toBeDefined();
    const putBody = JSON.parse(String((put?.[1] as RequestInit).body)) as { content: string };
    const queued = JSON.parse(Buffer.from(putBody.content, "base64").toString("utf8")) as Record<string, unknown>;
    expect(queued).toMatchObject({ requestId: runId, workspaceId: "nexops", publicationGate: false });
    expect(JSON.stringify(queued)).not.toContain("private-test-token");
    expect(JSON.stringify(queued)).not.toContain("callback-secret");
  });

  it("recovers a branch whose request commit exists but PR creation previously failed", async () => {
    const request = buildRadarQueueRequest(baseInput);
    const responses = [
      json({ private: true, visibility: "private" }),
      json([]),
      json({ object: { sha: "b".repeat(40) } }),
      json({}, 422),
      json([]),
      json({ encoding: "base64", content: Buffer.from(JSON.stringify(request)).toString("base64") }),
      json({ number: 18, html_url: "https://github.com/AlanTN13/radar-history/pull/18" }, 201),
    ];
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => responses.shift() ?? json({}, 500),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(dispatchRadarRun(baseInput)).resolves.toMatchObject({ externalRunId: "18", reused: false });
    expect(fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "PUT")).toBe(false);
  });

  it("refuses a public repository before writing any request", async () => {
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => json({ private: false, visibility: "public" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(dispatchRadarRun(baseInput)).rejects.toThrow("cola privada");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
