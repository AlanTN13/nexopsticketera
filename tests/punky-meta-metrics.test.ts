import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { parseMetricsSnapshots } from "@/lib/metrics-data";
import { getConfiguredMetricsSources } from "@/lib/metrics-sync";
import type { MetricsSourceSnapshot } from "@/lib/metrics-sync";
import { getMetaSourceNotice } from "@/lib/metrics-source-status";
import { buildPortalNavigation, getMetricsProfile, getVisibleCompanyModules, resolveMetricsCompanyForActor } from "@/lib/portal-modules";
import { hasModuleAccess } from "@/lib/authorization";
import type { Company, UserProfile } from "@/lib/ticketing";

const sourceUrl = "https://docs.google.com/spreadsheets/d/test-meta/export?format=csv";
const company: Company = {
  id: "punky-id", name: "Punky", slug: "punky", plan: "starter", industry: "",
  status: "onboarding", primaryContact: "", createdAt: "2026-09-19",
  modules: {
    support: { enabled: true, settings: {} },
    metrics: { enabled: true, settings: { metaAdsEnabled: true } },
    radar: { enabled: false, settings: {} }, content: { enabled: false, settings: {} },
  },
};
const actor: UserProfile = {
  id: "punky-user", companyId: company.id, name: "Cliente", email: "punky@example.test",
  role: "client_admin", status: "active", title: "", avatar: "",
  modulePermissions: [
    { companyId: company.id, module: "support", level: "admin" },
    { companyId: company.id, module: "metrics", level: "view" },
  ],
};
const profile = { accountName: "Punky", metaAdsEnabled: true, metaSheetUrl: sourceUrl };
const content = [
  "Account name,Campaign name,Amount spent,Day,Impressions",
  "Punky,Campaña propia,100,2026-09-19,1000",
  "GLOBAL TRIP,Campaña ajena,200,2026-09-19,2000",
  "Starcred,Punky campaña en otra cuenta,300,2026-09-19,3000",
  "Punky Otro,Nombre parecido,400,2026-09-19,4000",
  ",Sin cuenta,500,2026-09-19,5000",
].join("\n");
const snapshot: MetricsSourceSnapshot = {
  sourceType: "meta", sourceUrl, content, status: "ready",
  fetchedAt: "2026-09-19T03:05:00.000Z", lastError: null,
};

afterEach(() => vi.unstubAllEnvs());

describe("Punky Meta Ads onboarding and tenant isolation", () => {
  it("maps Punky to Starcred through company config without changing another tenant", () => {
    const config = JSON.stringify({ punky: { accountName: "Starcred", metaSheetUrl: sourceUrl } });
    const mapped = getMetricsProfile(company, config)!;
    expect(mapped.accountName).toBe("Starcred");
    const mixed = { ...snapshot, content: `${content}\nStarcred Otro,Similar account,600,2026-09-19,6000` };
    const data = parseMetricsSnapshots(mapped, [mixed], null);
    expect(data.metaRows.map(row => row.accountName)).toEqual(["Starcred"]);
    expect(data.metaStatus).toBe("ready");
    const other = { ...company, id: "other-id", name: "Global Trip", slug: "global-trip" };
    expect(getMetricsProfile(other, config)).toEqual(getMetricsProfile(other, ""));
  });

  it("uses the existing profile and navigation without granting access by company name", () => {
    expect(getMetricsProfile(company, "")).toMatchObject({ accountName: "Punky", metaAdsEnabled: true });
    const navigation = buildPortalNavigation({ active: "metrics", modules: getVisibleCompanyModules(actor, company) });
    expect(navigation.map((item) => item.href)).toEqual(["/portal", "/portal/soporte", "/portal/metricas"]);
    expect(hasModuleAccess(actor, company, "metrics", "operate")).toBe(false);
    expect(resolveMetricsCompanyForActor([company], { ...actor, modulePermissions: [] })).toBeNull();
    expect(resolveMetricsCompanyForActor([company], { ...actor, status: "invited" })).toBeNull();
    expect(resolveMetricsCompanyForActor([company], { ...actor, status: "disabled" })).toBeNull();
    const disabled = { ...company, modules: { ...company.modules, metrics: { enabled: false, settings: {} } } };
    expect(getMetricsProfile(disabled, "")).toBeNull();
    expect(resolveMetricsCompanyForActor([disabled], actor)).toBeNull();
  });

  it("ignores a forged company parameter for clients and resolves only their own company", () => {
    const other = { ...company, id: "other-id", name: "Otra", slug: "otra" };
    expect(resolveMetricsCompanyForActor([company, other], actor, other.id)).toBe(company);
    expect(resolveMetricsCompanyForActor([company, other], actor, other.slug)).toBe(company);
    expect(resolveMetricsCompanyForActor([company], { ...actor, companyId: other.id }, company.id)).toBeNull();
  });

  it("filters mixed snapshots on the server by exact account, never campaign text", () => {
    const data = parseMetricsSnapshots({ ...profile, accountName: "  PUNKY " }, [snapshot], null);
    expect(data.metaRows.map((row) => row.campaignName)).toEqual(["Campaña propia"]);
    expect(data.metaStatus).toBe("ready");
    expect(JSON.stringify(data.metaRows)).not.toContain("Starcred");
    expect(parseMetricsSnapshots({ ...profile, accountName: "" }, [snapshot], null).metaRows).toEqual([]);
    expect(parseMetricsSnapshots({ ...profile, metaAdsEnabled: false }, [snapshot], null)).toMatchObject({ metaRows: [], metaStatus: "disabled" });
  });

  it("honors the company source before the environment source", () => {
    vi.stubEnv("PORTAL_METRICS_MAILCHIMP_SHEET_URL", "");
    vi.stubEnv("PORTAL_METRICS_META_SHEET_URL", "https://docs.google.com/global.csv");
    expect(getConfiguredMetricsSources(profile).find((source) => source.sourceType === "meta")?.url.toString()).toBe(sourceUrl);
    expect(getConfiguredMetricsSources({ accountName: "Punky" }).find((source) => source.sourceType === "meta")?.url.toString()).toBe("https://docs.google.com/global.csv");
    expect(getConfiguredMetricsSources({ ...profile, metaAdsEnabled: false })).toEqual([]);
    expect(parseMetricsSnapshots(
      { ...profile, metaSheetUrl: " https://docs.google.com/mi fuente.csv " },
      [{ ...snapshot, sourceUrl: "https://docs.google.com/mi%20fuente.csv" }], null,
    ).metaStatus).toBe("ready");
  });

  it("distinguishes a missing source, first sync, errors, and a source without this account", () => {
    vi.stubEnv("PORTAL_METRICS_META_SHEET_URL", "");
    vi.stubEnv("PORTAL_METRICS_MAILCHIMP_SHEET_URL", "");
    expect(parseMetricsSnapshots({ accountName: "Punky" }, [], null).metaStatus).toBe("unconfigured");
    expect(parseMetricsSnapshots(profile, [], null).metaStatus).toBe("pending");
    expect(parseMetricsSnapshots(profile, [{ ...snapshot, status: "error", content: null }], null).metaStatus).toBe("error");
    expect(parseMetricsSnapshots(profile, [{ ...snapshot, status: "error" }], null).metaStatus).toBe("stale");
    expect(parseMetricsSnapshots(profile, [{ ...snapshot, content: content.replace("Punky,Campaña propia", "Otra,Campaña propia") }], null)).toMatchObject({ metaRows: [], metaStatus: "empty" });
    expect(parseMetricsSnapshots(profile, [{ ...snapshot, content: "" }], null).metaStatus).toBe("empty");
  });

  it("does not deliver cached Meta rows after removing or changing the source", () => {
    vi.stubEnv("PORTAL_METRICS_META_SHEET_URL", "");
    expect(parseMetricsSnapshots({ accountName: "Punky" }, [snapshot], null)).toMatchObject({ metaRows: [], metaStatus: "unconfigured" });
    expect(parseMetricsSnapshots({ ...profile, metaSheetUrl: "https://docs.google.com/replacement.csv" }, [snapshot], null)).toMatchObject({ metaRows: [], metaStatus: "pending" });
  });

  it("shows useful pending states without exposing source URLs or another account", () => {
    expect(getMetaSourceNotice("disabled")).toBeNull();
    expect(getMetaSourceNotice("ready")).toBeNull();
    for (const state of ["unconfigured", "pending", "empty", "error", "stale"] as const) {
      expect(getMetaSourceNotice(state)).toBeTruthy();
      expect(getMetaSourceNotice(state)).not.toMatch(/https:|Starcred|GLOBAL TRIP/);
    }
  });
});
