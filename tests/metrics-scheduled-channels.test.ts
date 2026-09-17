import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getSupabaseAdminClient } = vi.hoisted(() => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient }));

import { refreshAllMetricsCompanies } from "@/lib/metrics-sync";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("scheduled metrics channel configuration", () => {
  it.each([false, true, undefined])("respects the stored Meta Ads setting %s", async (metaAdsEnabled) => {
    const mailUrl = "https://docs.google.com/spreadsheets/d/test-mail/export?format=csv";
    const metaUrl = "https://docs.google.com/spreadsheets/d/test-meta/export?format=csv";
    vi.stubEnv("PORTAL_METRICS_META_SHEET_URL", metaUrl);
    vi.stubEnv("PORTAL_METRICS_COMPANY_CONFIG", "");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("Cuenta,Fecha_Envio\nOnlysellers,2026-08-27", {
      headers: { "content-type": "text/csv" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const upsert = vi.fn<(rows: Array<{ source_type: string }>) => Promise<{ error: null }>>(
      async () => ({ error: null }),
    );
    const client = {
      rpc: vi.fn(async () => ({ data: [{ acquired: true }], error: null })),
      from: vi.fn((table: string) => {
        const data = table === "company_modules"
          ? [{ company_id: "onlysellers-id", settings: { metaAdsEnabled, mailchimpSheetUrl: mailUrl } }]
          : table === "companies"
            ? [{ id: "onlysellers-id", name: "Onlysellers", slug: "onlysellers" }]
            : [];
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: vi.fn(() => query),
          update: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          upsert,
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data, error: null })),
        };
        return query;
      }),
    };
    getSupabaseAdminClient.mockReturnValue(client);

    expect(await refreshAllMetricsCompanies()).toEqual([
      { companyId: "onlysellers-id", refreshed: true, retryAfterSeconds: 0, errors: [] },
    ]);
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toEqual(metaAdsEnabled === false ? [mailUrl] : [metaUrl, mailUrl]);
    expect(upsert.mock.calls[0][0].map((row: { source_type: string }) => row.source_type))
      .toEqual(metaAdsEnabled === false ? ["mailchimp"] : ["meta", "mailchimp"]);
  });
});
