import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp, getSupabaseServerClient } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("Supabase Auth callback", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    getSupabaseServerClient.mockReset();
    getSupabaseServerClient.mockResolvedValue({
      auth: { verifyOtp },
    });
  });

  it("verifies a valid invitation token and redirects to the client portal", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?token_hash=valid-token&type=invite"));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-token",
      type: "invite",
    });
    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a generic invitation error when the token is absent", async () => {
    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?type=invite"));

    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/login?reason=invite");
  });

  it("returns a generic invitation error for a non-invitation type", async () => {
    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?token_hash=valid-token&type=email"));

    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/login?reason=invite");
  });

  it("returns a generic invitation error when the token is rejected or expired", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });

    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?token_hash=expired-token&type=invite"));

    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/login?reason=invite");
  });
});
