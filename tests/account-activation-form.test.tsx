import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { useActionState } = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState,
}));

vi.mock("@/app/portal/activar-cuenta/actions", () => ({
  activateAccountAction: vi.fn(),
}));

import { AccountActivationForm } from "@/components/account-activation-form";

describe("account activation form", () => {
  it("shows the generic password update error without leaving the form", () => {
    useActionState.mockReturnValue([
      { error: "No pudimos guardar esa contraseña. Probá con otra más segura." },
      vi.fn(),
      false,
    ]);

    const html = renderToStaticMarkup(<AccountActivationForm />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos guardar esa contraseña. Probá con otra más segura.");
  });
});
