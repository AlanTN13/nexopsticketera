import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { shouldCloseFromBackdropPointer } from "@/components/portal-ticket-modal";

describe("portal ticket modal backdrop", () => {
  it("closes only when the pointer starts and ends outside the dialog", () => {
    expect(shouldCloseFromBackdropPointer(true, true)).toBe(true);
    expect(shouldCloseFromBackdropPointer(false, true)).toBe(false);
    expect(shouldCloseFromBackdropPointer(true, false)).toBe(false);
    expect(shouldCloseFromBackdropPointer(false, false)).toBe(false);
  });

  it("tracks the full pointer gesture instead of closing from a bubbled click", () => {
    const modal = readFileSync(
      join(process.cwd(), "src/components/portal-ticket-modal.tsx"),
      "utf8",
    );

    expect(modal).toContain("onPointerDown={handleBackdropPointerDown}");
    expect(modal).toContain("onPointerUp={handleBackdropPointerUp}");
    expect(modal.match(/onClick=\{\(\) => setOpen\(false\)\}/g)).toHaveLength(1);
  });
});
