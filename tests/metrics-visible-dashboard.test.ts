import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("metrics visible dashboard", () => {
  it("keeps the workspace visible before the performance source is connected", () => {
    const page = read("src/app/portal/metricas/page.tsx");

    expect(page).toContain(
      '<MetricsWorkspace client={client} metaRows={data.metaRows} mailchimpRows={data.mailchimpRows} />',
    );
    expect(page).not.toContain("hasPerformanceData ? (\n        <MetricsWorkspace");
    expect(page).not.toContain("Muy pronto, todas tus métricas en un solo lugar");
  });

  it("opens Meta Ads by default and presents a complete no-data product shell", () => {
    const workspace = read("src/components/metrics/metrics-workspace.tsx");
    const dashboard = read("src/components/metrics/client-dashboard.tsx");

    expect(workspace).toContain('useState<Channel>("meta")');
    expect(dashboard).toContain("Dashboard preparado para");
    expect(dashboard).toContain("Fuente pendiente");
    expect(dashboard).toContain("Evolución de rendimiento");
    expect(dashboard).toContain('{ title: "Campañas"');
    expect(dashboard).toContain('{ title: "Creatividades"');
  });
});
