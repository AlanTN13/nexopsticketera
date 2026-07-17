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
      error: "La contraseña debe tener al menos 8 caracteres.",
    });
    await expect(activateAccountAction({ error: null }, activationForm("correcta1", "correcta2"))).resolves.toEqual({
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

    await expect(activateAccountAction({ error: null }, activationForm("correcta1", "correcta1"))).rejects.toThrow(
      "redirect:/portal/login?reason=invite",
    );
  });

  it("updates the authenticated user's password and redirects to the portal", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser,
      },
    });

    await expect(activateAccountAction({ error: null }, activationForm("correcta1", "correcta1"))).rejects.toThrow(
      "redirect:/portal?success=Cuenta%20activada%20correctamente.",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "correcta1" });
  });

  it("redirects to login when Supabase rejects the password update", async () => {
    getSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: new Error("rejected") }),
      },
    });

    await expect(activateAccountAction({ error: null }, activationForm("correcta1", "correcta1"))).rejects.toThrow(
      "redirect:/portal/login?reason=invite",
    );
  });
});
