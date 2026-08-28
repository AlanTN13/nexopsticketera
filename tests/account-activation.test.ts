import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient, redirect } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

import { activateAccountAction } from "@/app/portal/activar-cuenta/actions";

function activationForm(password: string, confirmation: string) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("confirmation", confirmation);
  return formData;
}

describe("account activation", () => {
  beforeEach(() => {
    getSupabaseServerClient.mockReset();
    redirect.mockReset();
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  it("rejects passwords that are too short or do not match", async () => {
    await expect(activateAccountAction({ error: null }, activationForm("short", "short"))).resolves.toEqual({
      error: "La contraseña debe tener al menos 12 caracteres.",
    });
    await expect(activateAccountAction({ error: null }, activationForm("Segura-2026!", "Segura-2027!"))).resolves.toEqual({
      error: "Las contraseñas no coinciden.",
    });
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("redirects to login when the activation session is missing", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("missing") }),
      },
    });

    await expect(activateAccountAction({ error: null }, activationForm("Segura-2026!", "Segura-2026!"))).rejects.toThrow(
      "redirect:/portal/login?reason=invite",
    );
  });

  it("updates the authenticated user's password and redirects to the portal", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser,
      },
      rpc,
    });

    await expect(activateAccountAction({ error: null }, activationForm("Segura-2026!", "Segura-2026!"))).rejects.toThrow(
      "redirect:/portal?success=Cuenta%20activada%20correctamente.",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "Segura-2026!" });
    expect(rpc).toHaveBeenCalledWith("activate_current_user_profile");
  });

  it("keeps the activation form and returns a generic error when Supabase rejects the password update", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: new Error("rejected") }),
      },
    });

    await expect(activateAccountAction({ error: null }, activationForm("Segura-2026!", "Segura-2026!"))).resolves.toEqual({
      error: "No pudimos guardar esa contraseña. Probá con otra más segura.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the form when the password changed but profile activation fails", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ error: new Error("profile disabled") }),
    });

    await expect(
      activateAccountAction(
        { error: null },
        activationForm("Segura-2026!", "Segura-2026!"),
      ),
    ).resolves.toEqual({
      error: "La contraseña se guardó, pero no pudimos activar la cuenta. Intentá nuevamente.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
