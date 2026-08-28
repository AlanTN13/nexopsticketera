import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicAppUrl, getSupabaseServerClient, resetPasswordForEmail } = vi.hoisted(() => ({
  getPublicAppUrl: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/public-app-url", () => ({ getPublicAppUrl }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient }));

import { requestPasswordRecoveryAction } from "@/app/portal/recuperar-acceso/actions";

function recoveryForm(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("password recovery request", () => {
  beforeEach(() => {
    getPublicAppUrl.mockReset();
    getSupabaseServerClient.mockReset();
    resetPasswordForEmail.mockReset();
    getPublicAppUrl.mockReturnValue("https://soporte.nexopstech.com");
    getSupabaseServerClient.mockResolvedValue({ auth: { resetPasswordForEmail } });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("validates the email before calling Supabase", async () => {
    await expect(
      requestPasswordRecoveryAction(
        { error: null, submitted: false },
        recoveryForm("email-invalido"),
      ),
    ).resolves.toEqual({ error: "Ingresá un email válido.", submitted: false });

    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("requests a PKCE recovery link through the configured public callback", async () => {
    await expect(
      requestPasswordRecoveryAction(
        { error: null, submitted: false },
        recoveryForm("  Usuario@Empresa.com "),
      ),
    ).resolves.toEqual({ error: null, submitted: true });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("usuario@empresa.com", {
      redirectTo:
        "https://soporte.nexopstech.com/auth/callback?next=%2Fportal%2Frestablecer-acceso",
    });
  });

  it("returns a generic availability error when configuration or Supabase fails", async () => {
    getPublicAppUrl.mockReturnValueOnce(null);
    await expect(
      requestPasswordRecoveryAction(
        { error: null, submitted: false },
        recoveryForm("usuario@empresa.com"),
      ),
    ).resolves.toEqual({
      error: "La recuperación no está disponible en este momento. Contactá a NexOps.",
      submitted: false,
    });

    resetPasswordForEmail.mockResolvedValueOnce({ error: new Error("rate limited") });
    await expect(
      requestPasswordRecoveryAction(
        { error: null, submitted: false },
        recoveryForm("usuario@empresa.com"),
      ),
    ).resolves.toEqual({
      error: "No pudimos iniciar la recuperación. Esperá unos minutos e intentá nuevamente.",
      submitted: false,
    });
  });
});
