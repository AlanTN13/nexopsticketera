import { describe, expect, it } from "vitest";

import {
  normalizeRadarTopics,
  parseRadarPreferences,
} from "@/lib/radar-preferences";

describe("Radar self-service preferences", () => {
  it("projects a valid client configuration", () => {
    expect(
      parseRadarPreferences({
        topics: ["Turismo", "Automatización"],
        publicationsPerWeek: 3,
        opportunityBehavior: "suggest",
        publishingMode: "automatic",
        siteIntegrated: true,
      }),
    ).toEqual({
      topics: ["Turismo", "Automatización"],
      publicationsPerWeek: 3,
      opportunityBehavior: "suggest",
      publishingMode: "automatic",
      siteIntegrated: true,
    });
  });

  it("never enables automatic publishing without a confirmed site integration", () => {
    expect(
      parseRadarPreferences({
        publishingMode: "automatic",
        siteIntegrated: false,
      }).publishingMode,
    ).toBe("review");
  });

  it("normalizes, deduplicates, and limits custom topics", () => {
    const topics = normalizeRadarTopics([
      " Turismo, CRM ",
      "CRM",
      "IA aplicada",
      "Data",
      "Ventas",
      "Retail",
      "Logística",
      "Producto",
      "Operaciones",
    ]);

    expect(topics).toEqual([
      "Turismo",
      "CRM",
      "IA aplicada",
      "Data",
      "Ventas",
      "Retail",
      "Logística",
      "Producto",
    ]);
  });
});
