import { describe, expect, it } from "vitest";

import { REQUIRED_USER_TITLE_MESSAGE, requireUserTitle } from "@/lib/validation";

describe("user title validation", () => {
  it("rejects an empty title or whitespace-only input", () => {
    expect(() => requireUserTitle("")).toThrow(REQUIRED_USER_TITLE_MESSAGE);
    expect(() => requireUserTitle("   ")).toThrow(REQUIRED_USER_TITLE_MESSAGE);
  });

  it("normalizes a valid title", () => {
    expect(requireUserTitle("  Responsable de Operaciones  ")).toBe("Responsable de Operaciones");
  });
});
