import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("metrics visible dashboard", () => {
  it("keeps the workspace visible before the performance source is connected", () => {
    const page = read("src/app/portal/metricas/page.tsx");

    expect(page).toContain("<MetricsWorkspace");
    expect(page).toContain("metaAdsEnabled={profile.metaAdsEnabled !== false}");
    expect(page).toContain("kommoEmbedUrl={profile.kommoEmbedUrl}");
    expect(page).not.toContain("hasPerformanceData ? (\n        <MetricsWorkspace");
    expect(page).not.toContain("Muy pronto, todas tus métricas en un solo lugar");
  });

  it("opens the first enabled channel and keeps the Meta no-data product shell", () => {
    const workspace = read("src/components/metrics/metrics-workspace.tsx");
    const channels = read("src/lib/metrics-channels.ts");
    const dashboard = read("src/components/metrics/client-dashboard.tsx");

    expect(workspace).toContain("getInitialMetricsChannel");
    expect(channels).toContain('if (metaAdsEnabled) return "meta"');
    expect(channels).toContain('if (kommoEnabled) return "kommo"');
    expect(dashboard).not.toContain("Dashboard preparado para");
    expect(dashboard).not.toContain("Fuente pendiente");
    expect(dashboard).toContain("Evolución de rendimiento");
    expect(dashboard).toContain('{ title: "Campañas"');
    expect(dashboard).toContain('{ title: "Creatividades"');
  });

  it("applies one shared date range to Meta Ads and Emailing", () => {
    const workspace = read("src/components/metrics/metrics-workspace.tsx");
    const filter = read("src/components/metrics/metrics-date-filter.tsx");
    const dateRange = read("src/features/metrics/date-range.ts");

    expect(workspace).toContain("<MetricsDateFilter value={dateRange} onChange={setDateRange} />");
    expect(workspace).toContain("filterByDateRange(metaRows, dateRange, (row) => row.day)");
    expect(workspace).toContain("filterByDateRange(clientMailchimpRows, dateRange, (row) => row.sendDate)");
    expect(dateRange).toContain("Últimos 7 días");
    expect(dateRange).toContain("Mes anterior");
    expect(filter).toContain('type="date"');
  });
});
