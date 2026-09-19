import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getSupabaseAdminClient } = vi.hoisted(() => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient }));

import { refreshMetricsSources } from "@/lib/metrics-sync";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("failed refresh after a source change", () => {
  it.each([false, true])("preserves cached data only for the same source (changed: %s)", async (changed) => {
    vi.stubEnv("PORTAL_METRICS_MAILCHIMP_SHEET_URL", "");
    const oldUrl = "https://docs.google.com/old.csv";
    const newUrl = changed ? "https://docs.google.com/new.csv" : oldUrl;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    const content = "Account name,Campaign name\nPunky,Original";
    const fetchedAt = "2026-09-18T03:05:00.000Z";
    const upsert = vi.fn(async () => ({ error: null }));
    const constraints: Array<[string, unknown]> = [];
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({ data: [{ acquired: true }], error: null })),
      from: vi.fn((table: string) => {
        const data = table === "metrics_source_snapshots"
          ? [{ source_type: "meta", source_url: oldUrl, content, status: "ready", fetched_at: fetchedAt, last_error: null }]
          : [];
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn((key: string, value: unknown) => { constraints.push([key, value]); return query; }),
          update: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          upsert,
          then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve(resolve({ data, error: null })),
        };
        return query;
      }),
    });

    await refreshMetricsSources({ companyId: "punky-id", profile: { accountName: "Punky", metaSheetUrl: newUrl }, trigger: "manual" });
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({
      company_id: "punky-id", source_url: newUrl, status: "error",
      content: changed ? null : content, fetched_at: changed ? null : fetchedAt,
    })], { onConflict: "company_id,source_type" });
    expect(constraints).toEqual([
      ["company_id", "punky-id"], ["company_id", "punky-id"], ["company_id", "punky-id"],
    ]);
  });
});
