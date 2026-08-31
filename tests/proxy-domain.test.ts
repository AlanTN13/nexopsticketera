import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSupabaseSession } = vi.hoisted(() => ({
  updateSupabaseSession: vi.fn(),
}));

vi.mock("@/lib/supabase-proxy", () => ({
  updateSupabaseSession,
}));

import { proxy } from "@/proxy";

describe("portal canonical domain", () => {
  beforeEach(() => {
    updateSupabaseSession.mockReset();
    vi.stubEnv("PORTAL_CANONICAL_REDIRECT_ENABLED", "false");
  });

  it("redirects the legacy support domain while preserving path and query", async () => {
    vi.stubEnv("PORTAL_CANONICAL_REDIRECT_ENABLED", "true");
    const response = await proxy(
      new NextRequest("https://soporte.nexopstech.com/portal/metricas?periodo=30d"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://portal.nexopstech.com/portal/metricas?periodo=30d",
    );
    expect(updateSupabaseSession).not.toHaveBeenCalled();
  });

  it("keeps the legacy domain working until the canonical redirect is enabled", async () => {
    const expected = new Response(null, { status: 204 });
    updateSupabaseSession.mockResolvedValue(expected);
    const request = new NextRequest("https://soporte.nexopstech.com/portal");

    await expect(proxy(request)).resolves.toBe(expected);
    expect(updateSupabaseSession).toHaveBeenCalledWith(request);
  });

  it("keeps the canonical portal domain in the normal session flow", async () => {
    const expected = new Response(null, { status: 204 });
    updateSupabaseSession.mockResolvedValue(expected);
    const request = new NextRequest("https://portal.nexopstech.com/portal");

    await expect(proxy(request)).resolves.toBe(expected);
    expect(updateSupabaseSession).toHaveBeenCalledWith(request);
  });
});
