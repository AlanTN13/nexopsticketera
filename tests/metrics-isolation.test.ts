import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { filterRowsForClient, parseSheetCSV } from "@/features/metrics/csv-parser";

describe("metrics tenant isolation", () => {
  it("filters rows using the server-selected account", () => {
    const rows = parseSheetCSV(
      [
        "Account name,Campaign name,Amount spent,Day,Impressions",
        "GLOBAL TRIP,Campaña A,100,29/08/2026,1000",
        "Onlysellers,Campaña B,200,29/08/2026,2000",
      ].join("\n"),
    );

    const visible = filterRowsForClient(rows, "GLOBAL TRIP");
    expect(visible).toHaveLength(1);
    expect(visible[0].campaignName).toBe("Campaña A");
  });

  it("keeps Sheet configuration server-only", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/metrics-data.ts"), "utf8");
    expect(source).not.toContain("NEXT_PUBLIC_PORTAL_METRICS");
    expect(source).not.toContain("searchParams");
    expect(source).toContain("ALLOWED_SHEET_HOSTS");
  });
});
