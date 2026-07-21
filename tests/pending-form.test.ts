import { describe, expect, it, vi } from "vitest";

import { createSubmissionGuard } from "@/components/pending-form";

describe("submission guard", () => {
  it("executes only the first submission while it is pending", async () => {
    const guard = createSubmissionGuard();
    let release!: () => void;
    const pendingAction = new Promise<void>((resolve) => {
      release = resolve;
    });
    const action = vi.fn(() => pendingAction);

    const first = guard(action);
    const second = guard(action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(await second).toBeUndefined();

    release();
    await first;
  });

  it("allows retrying after an error", async () => {
    const guard = createSubmissionGuard();
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce("ok");

    await expect(guard(action)).rejects.toThrow("network error");
    await expect(guard(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(2);
  });
});
