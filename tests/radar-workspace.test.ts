import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadRadarWorkspace, projectRadarDecision } from "@/lib/radar-workspace";

afterEach(() => {
  vi.unstubAllEnvs();
});

function publicationManifest() {
  return {
    schemaVersion: 1,
    workspace: "nexops",
    generatedAt: "2026-08-31T15:30:16.641Z",
    publications: [
      {
        id: "publication-radar-real",
        runId: "radar-v2-weekday-2026-08-21",
        outcome: "PUBLICATION",
        title: "Radar productivo",
        topic: "Radar dentro del Portal",
        category: "IA aplicada",
        summary: "Una publicación real y validada para el módulo.",
        sourceName: "Fuente oficial",
        sourceUrl: "https://example.org/source",
        score: 92,
        publishedAt: "2026-08-21T00:00:00.000Z",
        url: "https://www.nexopstech.com/noticias/radar-real",
        reason: "Superó el criterio editorial.",
      },
    ],
  };
}

describe("Radar workspace data access", () => {
  it("does not query data for an unsupported workspace", async () => {
    const fetchMock = vi.fn();

    const workspace = await loadRadarWorkspace("another-company", fetchMock as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(workspace.publicationsState).toBe("unavailable");
    expect(workspace.historyState).toBe("unavailable");
    expect(workspace.publications).toEqual([]);
  });

  it("loads the allowlisted public projection without requiring a private token", async () => {
    vi.stubEnv("RADAR_PUBLICATIONS_URL", "https://radar.example/publications.json");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(publicationManifest()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const workspace = await loadRadarWorkspace("nexops", fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(workspace.publicationsState).toBe("ready");
    expect(workspace.historyState).toBe("unavailable");
    expect(workspace.publications).toHaveLength(1);
    expect(workspace.publications[0]).toMatchObject({
      title: "Radar productivo",
      score: 92,
      outcome: "PUBLICATION",
    });
    expect(JSON.stringify(workspace)).not.toMatch(/token|secret|prompt/i);
  });

  it("rejects malformed or secret-bearing private history records", () => {
    const baseRecord = {
      schemaVersion: 1,
      engineRunId: "radar-v3-2026-08-31",
      outcome: "NO_PUBLICATION",
      timestamp: "2026-08-31T12:00:00.000Z",
      candidate: {
        title: "Nueva oportunidad",
        topic: "Automatización comercial",
        source: { name: "Fuente", url: "https://example.org/report" },
      },
      score: { total: 68, breakdown: [{ criterion: "business", score: 70 }] },
      rejectionReason: "No alcanza el umbral editorial.",
      editorialMetadata: { category: "Automatización", territory: "Argentina" },
    };

    expect(projectRadarDecision(baseRecord)).toMatchObject({
      outcome: "NO_PUBLICATION",
      score: 68,
      kind: "opportunity",
    });
    expect(
      projectRadarDecision({
        ...baseRecord,
        rejectionReason: "token=ghp_abcdefghijklmnopqrstuvwxyz123456",
      }),
    ).toBeNull();
    expect(projectRadarDecision({ ...baseRecord, candidate: {} })).toBeNull();
  });
});
