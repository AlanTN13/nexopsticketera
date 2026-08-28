import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp, getSupabaseServerClient } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("Supabase Auth callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    getSupabaseServerClient.mockReset();
    getSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession, verifyOtp },
    });
  });

  it("exchanges a PKCE recovery code and only redirects to the allowed reset page", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest(
      "https://soporte.nexopstech.com/auth/callback?code=valid-code&next=%2Fportal%2Frestablecer-acceso",
    ));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe(
      "https://soporte.nexopstech.com/portal/restablecer-acceso",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects a missing code, an external destination, or an expired recovery code", async () => {
    let response = await GET(new NextRequest(
      "https://soporte.nexopstech.com/auth/callback?next=%2Fportal%2Frestablecer-acceso",
    ));
    expect(response.headers.get("location")).toBe(
      "https://soporte.nexopstech.com/portal/login?reason=recovery",
    );
    expect(getSupabaseServerClient).not.toHaveBeenCalled();

    response = await GET(new NextRequest(
      "https://soporte.nexopstech.com/auth/callback?code=valid-code&next=https%3A%2F%2Fevil.example",
    ));
    expect(response.headers.get("location")).toBe(
      "https://soporte.nexopstech.com/portal/login?reason=recovery",
    );
    expect(getSupabaseServerClient).not.toHaveBeenCalled();

    exchangeCodeForSession.mockResolvedValue({ error: new Error("expired") });
    response = await GET(new NextRequest(
      "https://soporte.nexopstech.com/auth/callback?code=expired-code&next=%2Fportal%2Frestablecer-acceso",
    ));
    expect(response.headers.get("location")).toBe(
      "https://soporte.nexopstech.com/portal/login?reason=recovery",
    );
  });

  it("verifies a valid invitation token and redirects to account activation", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://sdnexops.vercel.app/auth/callback?token_hash=valid-token&type=invite"));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-token",
      type: "invite",
    });
    expect(response.headers.get("location")).toBe("https://sdnexops.vercel.app/portal/activar-cuenta");
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
