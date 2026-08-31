import { describe, expect, it } from "vitest";

import { buildRadarProductModel } from "@/lib/radar-product";
import type { RadarWorkspace } from "@/lib/radar-workspace";

function workspace(overrides: Partial<RadarWorkspace> = {}): RadarWorkspace {
  return {
    workspaceId: "nexops",
    publications: [
      {
        id: "publication-one",
        runId: "radar-v3-publication-one",
        outcome: "PUBLICATION",
        title: "Una publicación real",
        topic: "Automatización",
        category: "IA aplicada",
        summary: "Contenido verificado.",
        sourceName: "Fuente oficial",
        sourceUrl: "https://example.org/source",
        score: 92,
        publishedAt: "2026-08-21T12:00:00.000Z",
        url: "https://www.nexopstech.com/noticias/publicacion-one",
        imageUrl: "https://www.nexopstech.com/assets/publicacion-one.png",
        reason: "Superó los controles editoriales.",
      },
    ],
    decisions: [],
    publicationsState: "ready",
    historyState: "unavailable",
    generatedAt: "2026-08-31T12:00:00.000Z",
    ...overrides,
  };
}

describe("Radar product projection", () => {
  it("builds a sellable product view from real publication data", () => {
    const model = buildRadarProductModel(workspace());

    expect(model.publications).toHaveLength(1);
    expect(model.opportunities[0]).toMatchObject({
      status: "published",
      score: 92,
      finalUrl: "https://www.nexopstech.com/noticias/publicacion-one",
    });
    expect(model.events[0].title).toBe("Publicación verificada correctamente");
    expect(model.health.state).toBe("limited");
  });

  it("includes private NO_PUBLICATION decisions without exposing validation records", () => {
    const model = buildRadarProductModel(
      workspace({
        historyState: "ready",
        decisions: [
          {
            id: "radar-v3-rejected-one",
            runId: "radar-v3-rejected-one",
            kind: "opportunity",
            outcome: "NO_PUBLICATION",
            detectedAt: "2026-08-22T12:00:00.000Z",
            title: "Oportunidad descartada",
            topic: "CRM",
            sourceName: "Fuente",
            sourceUrl: "https://example.org/rejected",
            score: 54,
            scoreBreakdown: [{ dimension: "business", label: "Relevancia comercial", score: 54 }],
            reason: "No aportaba suficiente valor comercial.",
            category: "CRM",
            territory: null,
          },
          {
            id: "radar-v3-validation-one",
            runId: "radar-v3-validation-one",
            kind: "validation",
            outcome: "NO_PUBLICATION",
            detectedAt: "2026-08-23T12:00:00.000Z",
            title: "Validación técnica",
            topic: "Validación",
            sourceName: "Fuente",
            sourceUrl: "https://example.org/validation",
            score: 10,
            scoreBreakdown: [],
            reason: "Control interno.",
            category: "Validación",
            territory: null,
          },
        ],
      }),
    );

    expect(model.rejected).toHaveLength(1);
    expect(model.opportunities.map((item) => item.title)).not.toContain("Validación técnica");
    expect(model.health.state).toBe("healthy");
  });

  it("surfaces source failures as an intervention state", () => {
    const model = buildRadarProductModel(workspace({ publicationsState: "error" }));
    expect(model.health).toMatchObject({ state: "attention", label: "Requiere atención" });
  });
});
