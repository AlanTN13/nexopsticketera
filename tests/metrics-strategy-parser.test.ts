import { describe, expect, it } from "vitest";

import {
  parseMetricsClientSource,
  parseMetricsStrategySource,
} from "@/features/metrics/strategy-parser";

describe("metrics strategy sources", () => {
  it("loads the client profile selected by account", () => {
    const source = parseMetricsClientSource(
      [
        "client_name,account_name,logo_url,primary_color,secondary_color,accent_color,target_cpa,monthly_budget,description,initial_strategy",
        'Global Trip,GLOBAL TRIP,https://globaltriplog.com/logo.png,#152A4F,#2B6BB1,#FFFFFF,3.5,"$300,000",Comercio Exterior,Generar conversaciones calificadas',
        "Otra,OTRA,,#000000,#111111,#FFFFFF,1,100,Retail,Otra estrategia",
      ].join("\n"),
      "GLOBAL TRIP",
    );

    expect(source).toMatchObject({
      name: "Global Trip",
      accountName: "GLOBAL TRIP",
      targetCpa: 3.5,
      monthlyBudget: 300000,
      initialStrategy: "Generar conversaciones calificadas",
    });
  });

  it("isolates and orders strategy entries for the selected account", () => {
    const entries = parseMetricsStrategySource(
      [
        "Fecha,Cliente,Campaign name,Titulo,Descripcion,Link asociado",
        "01/08/2026,GLOBAL TRIP,Campaña A,Definición inicial,Plan base,",
        "13/08/2026,GLOBAL TRIP,Campaña A,Pausar campaña,Vacaciones,https://example.com/doc",
        "14/08/2026,OTRA,Campaña X,No visible,No corresponde,",
      ].join("\n"),
      "GLOBAL TRIP",
      "company-global-trip",
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      date: "2026-08-13",
      type: "ajuste",
      title: "Pausar campaña",
      link: "https://example.com/doc",
    });
    expect(entries.every((entry) => entry.clientId === "company-global-trip")).toBe(true);
  });
});
