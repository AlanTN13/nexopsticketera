import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  META_COLLECTION_LIMITS,
  MetaGraphError,
  compatibleInstagramMediaInsightMetrics,
  fetchInstagramMediaInsights,
  fetchObservedInstagramProfile,
  fetchOwnInstagramProfile,
  listManagedInstagramAccounts,
} from "@/lib/meta-instagram";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("official Meta Instagram adapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.META_APP_ID = "meta-app";
    process.env.META_APP_SECRET = "meta-secret";
    process.env.META_GRAPH_VERSION = "v24.0";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("paginates managed Pages with a documented upper bound", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        data: [{
          id: "page-1",
          name: "One",
          access_token: "page-token-1",
          tasks: ["ANALYZE"],
          instagram_business_account: { id: "ig-1", username: "one" },
        }],
        paging: { cursors: { after: "cursor-2" } },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{
          id: "page-2",
          name: "Two",
          access_token: "page-token-2",
          instagram_business_account: { id: "ig-2", username: "two" },
        }],
      }));

    const accounts = await listManagedInstagramAccounts("user-token");

    expect(accounts.map((account) => account.instagramUserId)).toEqual(["ig-1", "ig-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(secondUrl.searchParams.get("after")).toBe("cursor-2");
    expect(secondUrl.searchParams.get("limit")).toBe(String(META_COLLECTION_LIMITS.managedAccountPageSize));
  });

  it("collects own media by cursor but stops at the declared account window", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "ig-1", username: "nexops" }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: "media-1", media_type: "IMAGE" }],
        paging: { cursors: { after: "media-cursor-2" } },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: "media-2", media_type: "VIDEO" }],
        paging: { cursors: { after: "media-cursor-3" } },
      }));

    const profile = await fetchOwnInstagramProfile("ig-1", "page-token");

    expect(profile.media?.data?.map((media) => media.id)).toEqual(["media-1", "media-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1 + META_COLLECTION_LIMITS.mediaPagesPerAccount);
    const lastUrl = new URL(String(fetchMock.mock.calls[2][0]));
    expect(lastUrl.searchParams.get("after")).toBe("media-cursor-2");
  });

  it("walks the bounded nested Business Discovery media cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        business_discovery: {
          id: "observed-1",
          username: "observed",
          media: {
            data: [{ id: "observed-media-1", media_type: "IMAGE" }],
            paging: { cursors: { after: "observed-cursor-2" } },
          },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        business_discovery: {
          id: "observed-1",
          username: "observed",
          media: { data: [{ id: "observed-media-2", media_type: "VIDEO" }] },
        },
      }));

    const profile = await fetchObservedInstagramProfile("ig-own", "observed", "page-token");

    expect(profile.media?.data?.map((media) => media.id)).toEqual(["observed-media-1", "observed-media-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondFields = new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("fields");
    expect(secondFields).toContain("media.limit(50).after(observed-cursor-2)");
  });

  it("selects metrics by media type and isolates an unsupported metric", async () => {
    expect(compatibleInstagramMediaInsightMetrics({ media_type: "IMAGE", media_product_type: "FEED" }))
      .toEqual(["reach", "saved", "shares", "total_interactions"]);
    expect(compatibleInstagramMediaInsightMetrics({ media_type: "VIDEO", media_product_type: "REELS" }))
      .toContain("views");

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: "reach", values: [{ value: 10 }] }] }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 100, message: "Unsupported metric" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: "shares", total_value: { value: 3 } }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: "total_interactions", values: [{ value: 12 }] }] }));

    const metrics = await fetchInstagramMediaInsights("media-1", "page-token", {
      media_type: "IMAGE",
      media_product_type: "FEED",
    });

    expect(metrics).toEqual({ reach: 10, saved: null, shares: 3, total_interactions: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const requested = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("metric"));
    expect(requested).toEqual(["reach", "saved", "shares", "total_interactions"]);
  });

  it.each([190, 102])("classifies Meta token error %s as reconnect_required", async (metaCode) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      error: { code: metaCode, message: "Token is no longer valid", fbtrace_id: "trace-token" },
    }, 400));

    const error = await fetchOwnInstagramProfile("ig-1", "expired-token").catch((caught) => caught);

    expect(error).toBeInstanceOf(MetaGraphError);
    expect(error).toMatchObject({
      code: "reconnect_required",
      retryable: false,
      requestId: "trace-token",
      metadata: { metaCode },
    });
  });

  it.each([
    { metaCode: 100, subcode: undefined, expected: "unsupported" },
    { metaCode: 100, subcode: 33, expected: "not_found" },
    { metaCode: 803, subcode: undefined, expected: "not_found" },
  ])("classifies Business Discovery failures as $expected", async ({ metaCode, subcode, expected }) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      error: { code: metaCode, error_subcode: subcode, message: "Discovery target unavailable" },
    }, 400));

    const error = await fetchObservedInstagramProfile("ig-own", "target", "page-token").catch((caught) => caught);

    expect(error).toBeInstanceOf(MetaGraphError);
    expect(error).toMatchObject({ code: expected, retryable: false });
  });

  it("exposes retry-after, usage and backoff metadata for Meta rate limits", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      error: { code: 613, message: "Calls to this API have exceeded the rate limit", fbtrace_id: "trace-rate" },
    }, 400, {
      "retry-after": "45",
      "x-app-usage": JSON.stringify({ call_count: 98 }),
      "x-business-use-case-usage": JSON.stringify([{ type: "instagram", call_count: 99 }]),
    }));

    const error = await fetchOwnInstagramProfile("ig-1", "page-token").catch((caught) => caught);

    expect(error).toBeInstanceOf(MetaGraphError);
    expect(error).toMatchObject({
      code: "meta_613",
      retryable: true,
      requestId: "trace-rate",
      metadata: {
        metaCode: 613,
        retryAfterSeconds: 45,
        recommendedBackoffMs: 45_000,
        appUsage: { call_count: 98 },
      },
    });
  });

  it("assigns bounded default backoff metadata to Meta rate-limit code 32", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 32, message: "Page request limit reached" } }, 400));

    const error = await fetchOwnInstagramProfile("ig-1", "page-token").catch((caught) => caught);

    expect(error).toMatchObject({
      code: "meta_32",
      retryable: true,
      metadata: { metaCode: 32, recommendedBackoffMs: 60_000 },
    });
  });
});
