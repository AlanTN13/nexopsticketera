import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, getSupabaseServerClient } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("Supabase Auth callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    getSupabaseServerClient.mockReset();
    getSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession },
    });
  });

  it("exchanges a valid code and redirects to the client portal", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?code=valid-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a generic invitation error when the code is absent or rejected", async () => {
    const absentCode = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback"));

    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(absentCode.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/login?reason=invite");

    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    const rejectedCode = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?code=expired-code"));

    expect(rejectedCode.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/login?reason=invite");
  });
});
