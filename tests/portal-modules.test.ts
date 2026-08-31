import { describe, expect, it } from "vitest";

import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";
import { Company } from "@/lib/ticketing";

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-a",
    name: "GlobalTrip",
    slug: "globaltrip",
    plan: "growth",
    industry: "Turismo",
    status: "active",
    primaryContact: "Alan",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("portal module configuration", () => {
  it("enables metrics only for configured companies", () => {
    expect(getMetricsProfile(company())?.accountName).toBe("GLOBAL TRIP");
    expect(getMetricsProfile(company({ name: "Sin reportería", slug: "sin-reporteria" }))).toBeNull();
  });

  it("allows a server-side override to disable a known company", () => {
    const profile = getMetricsProfile(
      company(),
      JSON.stringify({ globaltrip: { enabled: false, accountName: "GLOBAL TRIP" } }),
    );
    expect(profile).toBeNull();
  });

  it("does not render the metrics navigation entry when the module is disabled", () => {
    const navigation = buildPortalNavigation({ active: "home", metricsEnabled: false, ticketCount: 2 });
    expect(navigation.map((item) => item.label)).toEqual(["Inicio", "Soporte"]);
  });
});
