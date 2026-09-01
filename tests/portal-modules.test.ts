import { describe, expect, it } from "vitest";

import {
  buildPortalNavigation,
  getMetricsProfile,
  getRadarWorkspaceId,
  resolveContentCompanyForActor,
  resolveMetricsCompanyForActor,
  resolveRadarCompanyForActor,
} from "@/lib/portal-modules";
import { Company, UserProfile } from "@/lib/ticketing";

const baseModules = {
  support: { enabled: true, settings: {} },
  content: { enabled: false, settings: {} },
} as const;

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
      ...baseModules,
      metrics: { enabled: true, settings: {} },
      radar: { enabled: false, settings: {} },
      content: { enabled: false, settings: {} },
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
            ...baseModules,
            metrics: { enabled: false, settings: {} },
            radar: { enabled: false, settings: {} },
            content: { enabled: false, settings: {} },
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

  it("resolves Metrics for an internal user only inside an assigned company", () => {
    const companyA = company({ id: "company-a", slug: "company-a" });
    const companyB = company({ id: "company-b", slug: "company-b" });
    const agent: UserProfile = {
      id: "metrics-agent",
      companyId: null,
      name: "Metrics Agent",
      email: "metrics-agent@example.test",
      role: "agent",
      status: "active",
      title: "",
      avatar: "",
      assignedCompanyIds: [companyA.id],
      modulePermissions: [{ companyId: companyA.id, module: "metrics", level: "view" }],
    };

    expect(resolveMetricsCompanyForActor([companyA, companyB], agent, companyA.id)).toBe(companyA);
    expect(resolveMetricsCompanyForActor([companyA, companyB], agent, companyB.id)).toBeNull();
  });

  it("prefers company-specific reportería settings over legacy defaults", () => {
    const profile = getMetricsProfile(
      company({
        modules: {
          ...baseModules,
          metrics: {
            enabled: true,
            settings: { accountName: "GT Ads", objective: "LEADS" },
          },
          radar: { enabled: false, settings: {} },
          content: { enabled: false, settings: {} },
        },
      }),
    );

    expect(profile?.accountName).toBe("GT Ads");
    expect(profile?.objective).toBe("LEADS");
  });

  it("keeps each company's Sheet sources in its server-side module settings", () => {
    const profile = getMetricsProfile(
      company({
        modules: {
          ...baseModules,
          metrics: {
            enabled: true,
            settings: {
              clientsSheetUrl: "https://docs.google.com/clients.csv",
              strategySheetUrl: "https://docs.google.com/strategy.csv",
            },
          },
          radar: { enabled: false, settings: {} },
          content: { enabled: false, settings: {} },
        },
      }),
    );

    expect(profile?.clientsSheetUrl).toBe("https://docs.google.com/clients.csv");
    expect(profile?.strategySheetUrl).toBe("https://docs.google.com/strategy.csv");
  });

  it("renders navigation from the company entitlements", () => {
    const navigation = buildPortalNavigation({
      active: "home",
      modules: {
        ...baseModules,
        metrics: { enabled: false, settings: {} },
        radar: { enabled: true, settings: {} },
        content: { enabled: false, settings: {} },
      },
      ticketCount: 2,
    });
    expect(navigation.map((item) => item.label)).toEqual(["Inicio", "Soporte", "Radar"]);
  });

  it("does not render optional products when both are disabled", () => {
    const navigation = buildPortalNavigation({
      active: "home",
      modules: {
        ...baseModules,
        metrics: { enabled: false, settings: {} },
        radar: { enabled: false, settings: {} },
        content: { enabled: false, settings: {} },
      },
      ticketCount: 2,
    });
    expect(navigation.map((item) => item.label)).toEqual(["Inicio", "Soporte"]);
  });

  it("renders Contenido only when its entitlement is active", () => {
    const modules = {
      support: { enabled: true, settings: {} },
      metrics: { enabled: false, settings: {} },
      radar: { enabled: false, settings: {} },
      content: { enabled: true, settings: {} },
    };
    expect(buildPortalNavigation({ active: "content", modules }).map((item) => item.label)).toEqual([
      "Inicio", "Soporte", "Contenido",
    ]);
  });

  it("requires a company-specific workspace before Radar can load data", () => {
    expect(
      getRadarWorkspaceId(
        company({
          modules: {
            ...baseModules,
            metrics: { enabled: false, settings: {} },
            radar: { enabled: true, settings: {} },
            content: { enabled: false, settings: {} },
          },
        }),
      ),
    ).toBeNull();

    expect(
      getRadarWorkspaceId(
        company({
          modules: {
            ...baseModules,
            metrics: { enabled: false, settings: {} },
            radar: { enabled: true, settings: { workspaceId: "radar-global-trip" } },
            content: { enabled: false, settings: {} },
          },
        }),
      ),
    ).toBe("radar-global-trip");
  });

  it("requires an explicit company when an internal user opens Radar", () => {
    const nexops = company({
      id: "nexops",
      name: "Sysnexops",
      modules: {
        ...baseModules,
        metrics: { enabled: false, settings: {} },
        radar: { enabled: true, settings: { workspaceId: "nexops" } },
        content: { enabled: false, settings: {} },
      },
    });
    const admin: UserProfile = {
      id: "info",
      companyId: null,
      name: "NexOps Tech",
      email: "info@nexopstech.com",
      role: "platform_admin",
      status: "active",
      title: "",
      avatar: "",
    };

    expect(resolveRadarCompanyForActor([company(), nexops], admin)).toBeNull();
    expect(resolveRadarCompanyForActor([company(), nexops], admin, "nexops")).toBe(nexops);
    expect(admin.companyId).toBeNull();
  });

  it("does not expose the NexOps Radar to other internal roles", () => {
    const nexops = company({
      modules: {
        ...baseModules,
        metrics: { enabled: false, settings: {} },
        radar: { enabled: true, settings: { workspaceId: "nexops" } },
        content: { enabled: false, settings: {} },
      },
    });
    const agent: UserProfile = {
      id: "agent",
      companyId: null,
      name: "Agente",
      email: "agent@nexopstech.com",
      role: "agent",
      status: "active",
      title: "",
      avatar: "",
    };

    expect(resolveRadarCompanyForActor([nexops], agent)).toBeNull();
  });

  it("requires an explicit assigned company for internal Contenido access", () => {
    const nexops = company({
      id: "nexops",
      modules: {
        support: { enabled: true, settings: {} },
        metrics: { enabled: false, settings: {} },
        radar: { enabled: false, settings: {} },
        content: { enabled: true, settings: {} },
      },
    });
    const base: UserProfile = {
      id: "internal", companyId: null, name: "NexOps", email: "info@nexopstech.com",
      role: "platform_admin", status: "active", title: "", avatar: "",
    };
    expect(resolveContentCompanyForActor([nexops], base)).toBeNull();
    expect(resolveContentCompanyForActor([nexops], base, nexops.id)).toBe(nexops);

    const agent: UserProfile = {
      ...base,
      id: "content-agent",
      role: "agent",
      assignedCompanyIds: [nexops.id],
      modulePermissions: [{ companyId: nexops.id, module: "content", level: "view" }],
    };
    expect(resolveContentCompanyForActor([nexops], agent, nexops.id)).toBe(nexops);
    expect(resolveContentCompanyForActor([nexops], { ...agent, modulePermissions: [] }, nexops.id)).toBeNull();
  });
});
