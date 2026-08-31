import { describe, expect, it } from "vitest";

import { buildPortalNavigation, getMetricsProfile, getRadarWorkspaceId } from "@/lib/portal-modules";
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
    modules: {
      metrics: { enabled: true, settings: {} },
      radar: { enabled: false, settings: {} },
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("portal module configuration", () => {
  it("enables metrics only when the company entitlement is active", () => {
    expect(getMetricsProfile(company())?.accountName).toBe("GLOBAL TRIP");
    expect(
      getMetricsProfile(
        company({
          modules: {
            metrics: { enabled: false, settings: {} },
            radar: { enabled: false, settings: {} },
          },
        }),
      ),
    ).toBeNull();
  });

  it("uses the company name as the default reportería account", () => {
    const profile = getMetricsProfile(
      company({ name: "Nueva Empresa", slug: "nueva-empresa" }),
      "",
    );
    expect(profile?.accountName).toBe("Nueva Empresa");
  });

  it("prefers company-specific reportería settings over legacy defaults", () => {
    const profile = getMetricsProfile(
      company({
        modules: {
          metrics: {
            enabled: true,
            settings: { accountName: "GT Ads", objective: "LEADS" },
          },
          radar: { enabled: false, settings: {} },
        },
      }),
    );

    expect(profile?.accountName).toBe("GT Ads");
    expect(profile?.objective).toBe("LEADS");
  });

  it("renders navigation from the company entitlements", () => {
    const navigation = buildPortalNavigation({
      active: "home",
      modules: {
        metrics: { enabled: false, settings: {} },
        radar: { enabled: true, settings: {} },
      },
      ticketCount: 2,
    });
    expect(navigation.map((item) => item.label)).toEqual(["Inicio", "Soporte", "Radar"]);
  });

  it("does not render optional products when both are disabled", () => {
    const navigation = buildPortalNavigation({
      active: "home",
      modules: {
        metrics: { enabled: false, settings: {} },
        radar: { enabled: false, settings: {} },
      },
      ticketCount: 2,
    });
    expect(navigation.map((item) => item.label)).toEqual(["Inicio", "Soporte"]);
  });

  it("requires a company-specific workspace before Radar can load data", () => {
    expect(
      getRadarWorkspaceId(
        company({
          modules: {
            metrics: { enabled: false, settings: {} },
            radar: { enabled: true, settings: {} },
          },
        }),
      ),
    ).toBeNull();

    expect(
      getRadarWorkspaceId(
        company({
          modules: {
            metrics: { enabled: false, settings: {} },
            radar: { enabled: true, settings: { workspaceId: "radar-global-trip" } },
          },
        }),
      ),
    ).toBe("radar-global-trip");
  });
});
