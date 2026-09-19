import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientDashboard } from "@/components/metrics/client-dashboard";
import { parseSheetCSV } from "@/features/metrics/csv-parser";
import type { Client, CampaignObjective } from "@/features/metrics/types";

describe("dashboard cost per result", () => {
  it.each<[CampaignObjective, string, string]>([
    ["CONVERSACIONES", "Costo / Conversación", "50,00"],
    ["LEADS", "Costo / Lead", "500,00"],
    ["COMPRAS", "Costo / Compra", "250,00"],
  ])("uses the configured %s objective when several result types coexist", (objective, label, value) => {
    const rows = parseSheetCSV("Account name,Campaign name,Amount spent,Day,Impressions,Messaging conversations started,Leads,Purchases\nStarcred,Campaign,1000,2026-09-19,10000,20,2,4");
    const client: Client = {
      id: "punky", name: "Punky", accountName: "Starcred", objective,
      logoUrl: "", primaryColor: "#4330A6", secondaryColor: "#7C5BFF", textColor: "#FFFFFF",
      createdAt: "2026-09-19", updatedAt: "2026-09-19",
    };
    const html = renderToStaticMarkup(<ClientDashboard client={client} rows={rows} dateRangeLabel="Histórico" />);
    const heading = html.indexOf(label);
    expect(heading).toBeGreaterThan(-1);
    const displayedValue = html.slice(heading).match(/<div[^>]*title="([^"]+)"/u)?.[1];
    expect(displayedValue).toContain(value);
  });
});
