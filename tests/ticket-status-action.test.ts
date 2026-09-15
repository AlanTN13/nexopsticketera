import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  revalidate: vi.fn(), snapshot: vi.fn(), actor: vi.fn(), update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth", () => ({ requireAuthenticatedActor: mocks.actor }));
vi.mock("@/lib/app-store", () => ({ getAppSnapshot: mocks.snapshot, updateTicketStatuses: mocks.update }));
import { updateTicketStatusesAction } from "@/app/ticket-status-actions";
const id = "30000000-0000-0000-0000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.snapshot.mockResolvedValue({});
  mocks.actor.mockResolvedValue({ id: "session-user" });
  mocks.update.mockResolvedValue({ changed: 1, total: 1 });
});
describe("quick status server action", () => {
  it("gets identity from the authenticated session and refreshes both surfaces", async () => {
    const result = await updateTicketStatusesAction([id], "on_hold");
    expect(mocks.update).toHaveBeenCalledWith({ actorId: "session-user", ticketIds: [id], status: "on_hold" });
    expect(result.error).toBeNull();
    expect(result.message).toContain("1 de 1");
    expect(mocks.revalidate.mock.calls).toEqual([["/backoffice", "layout"], ["/portal", "layout"]]);
  });
  it("rejects invalid payload before reading or writing data", async () => {
    expect((await updateTicketStatusesAction([id], "invalid")).error).toBeTruthy();
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("returns session expiry as an inline error without mutation", async () => {
    mocks.actor.mockRejectedValue(new Error("Tu sesión venció."));
    expect((await updateTicketStatusesAction([id], "closed")).error).toBe("Tu sesión venció.");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not claim success when a permission/RPC failure occurs", async () => {
    mocks.update.mockRejectedValue(new Error("No autorizado"));
    expect(await updateTicketStatusesAction([id], "closed")).toEqual({ error: "No autorizado", message: null });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
