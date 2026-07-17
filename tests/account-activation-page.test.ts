import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientSessionActorId, redirect } = vi.hoisted(() => ({
  getClientSessionActorId: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getClientSessionActorId,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/components/account-activation-form", () => ({
  AccountActivationForm: () => null,
}));

import AccountActivationPage from "@/app/portal/activar-cuenta/page";

describe("account activation page", () => {
  beforeEach(() => {
    getClientSessionActorId.mockReset();
    redirect.mockReset();
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  it("redirects to login without a valid session", async () => {
    getClientSessionActorId.mockResolvedValue(null);

    await expect(AccountActivationPage()).rejects.toThrow("redirect:/portal/login?reason=invite");
  });

  it("renders the protected form with a valid session", async () => {
    getClientSessionActorId.mockResolvedValue("user-1");

    await expect(AccountActivationPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
