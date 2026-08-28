import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient, redirect } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ getSupabaseServerClient }));
vi.mock("next/navigation", () => ({ redirect }));

import { resetPasswordAction } from "@/app/portal/restablecer-acceso/actions";

function passwordForm(password: string, confirmation: string) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("confirmation", confirmation);
  return formData;
}

describe("password reset", () => {
  beforeEach(() => {
    getSupabaseServerClient.mockReset();
    redirect.mockReset();
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  it("reuses the account password validation before calling Supabase", async () => {
    await expect(
      resetPasswordAction({ error: null }, passwordForm("short", "short")),
    ).resolves.toEqual({ error: "La contraseña debe tener al menos 12 caracteres." });
    await expect(
      resetPasswordAction({ error: null }, passwordForm("Segura-2026!", "Segura-2027!")),
    ).resolves.toEqual({ error: "Las contraseñas no coinciden." });

    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("requires the authenticated session created by the recovery callback", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("missing") }),
      },
    });

    await expect(
      resetPasswordAction({ error: null }, passwordForm("Segura-2026!", "Segura-2026!")),
    ).rejects.toThrow("redirect:/portal/login?reason=recovery");
  });

  it("updates the authenticated password and keeps the recovery session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser,
      },
    });

    await expect(
      resetPasswordAction({ error: null }, passwordForm("Segura-2026!", "Segura-2026!")),
    ).rejects.toThrow(
      "redirect:/portal?success=Contrase%C3%B1a%20actualizada%20correctamente.",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "Segura-2026!" });
  });

  it("returns a generic error when Supabase rejects the new password", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: new Error("weak password") }),
      },
    });

    await expect(
      resetPasswordAction({ error: null }, passwordForm("Segura-2026!", "Segura-2026!")),
    ).resolves.toEqual({
      error: "No pudimos guardar esa contraseña. Probá con otra más segura.",
    });
  });
});
