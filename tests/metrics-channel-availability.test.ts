import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getInitialMetricsChannel } from "@/lib/metrics-channels";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("metrics channel availability", () => {
  it("opens Kommo directly when Meta and Emailing are unavailable", () => {
    expect(
      getInitialMetricsChannel({
        metaAdsEnabled: false,
        emailingEnabled: false,
        kommoEnabled: true,
      }),
    ).toBe("kommo");
  });

  it("keeps Meta as the default for existing companies", () => {
    expect(
      getInitialMetricsChannel({
        metaAdsEnabled: true,
        emailingEnabled: true,
        kommoEnabled: true,
      }),
    ).toBe("meta");
  });

  it("persists the setting only through the protected modules RPC", () => {
    const form = read("src/components/forms.tsx");
    const store = read("src/lib/app-store.ts");
    const migration = read(
      "supabase/migrations/20260902000310_hide_meta_channel_setting.sql",
    );

    expect(form).toContain("Mostrar canal Meta Ads");
    expect(form).toContain('name="metaAdsEnabled"');
    expect(store).toContain("metaAdsEnabled: input.metaAdsEnabled");
    expect(migration).toContain("private.can_manage_access_control()");
    expect(migration).toContain("item ? 'metaAdsEnabled'");
    expect(migration).toContain("settings -> 'metaAdsEnabled' is distinct from");
  });

  it("removes Meta copy from the target views when the channel is disabled", () => {
    const home = read("src/app/portal/page.tsx");
    const metrics = read("src/app/portal/metricas/page.tsx");
    const workspace = read("src/components/metrics/metrics-workspace.tsx");

    expect(home).toContain("metricsProfile.metaAdsEnabled !== false");
    expect(metrics).toContain("!hasPerformanceData && profile.metaAdsEnabled !== false");
    expect(metrics).toContain("{hasManagedSources ? (");
    expect(metrics).toContain("key={company.id}");
    expect(workspace).toContain("{metaAdsEnabled ? (");
  });
});
