import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), config: { enabled: true, workspaceId: "pilot", maxRuns: 6 } }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/radar-api-provider", () => ({ radarApiConfiguration: () => mocks.config }));
import { getRadarAdmission } from "@/lib/radar-admission";
const available = { allowed: true, code: "available", spentUsd: 0.112158, heldUsd: 0, availableUsd: 4.887842, legacyReservedUsd: 9, maxUsd: 5, remainingRuns: 1 };
beforeEach(() => { mocks.rpc.mockReset(); mocks.config.enabled = true; mocks.config.maxRuns = 6; });
describe("read-only reconciled Radar admission", () => {
  it("admits against reconciled exposure while retaining historical USD9 separately", async () => {
    mocks.rpc.mockResolvedValue({ data: available });
    expect(await getRadarAdmission("pilot")).toMatchObject(available);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_radar_admission", { target_workspace_id: "pilot", pilot_max_runs: 6 });
  });
  it("blocks insufficient headroom even if run authorization remains", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...available, code: "budget_exhausted", allowed: false, spentUsd: 4, availableUsd: 1 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "budget_exhausted", remainingRuns: 1 });
  });
  it("separates the operational run limit from money", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...available, code: "run_limit", allowed: false, remainingRuns: 0 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "run_limit", availableUsd: 4.887842 });
  });
  it("passes only an authenticated queued retry ID to the privileged read", async () => {
    const existingQueuedRunId = "82000000-0000-0000-0000-000000000001";
    mocks.rpc.mockResolvedValue({ data: available });
    expect(await getRadarAdmission("pilot", existingQueuedRunId)).toMatchObject({ allowed: true });
    expect(mocks.rpc).toHaveBeenCalledWith("get_radar_admission", { target_workspace_id: "pilot", pilot_max_runs: 6, existing_queued_run_id: existingQueuedRunId });
  });
  it("rejects a malformed retry ID before reading", async () => {
    expect(await getRadarAdmission("pilot", "not-a-uuid")).toMatchObject({ allowed: false, code: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("blocks active work with available money", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...available, allowed: false, code: "active_run", heldUsd: 1.5, availableUsd: 3.387842 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "active_run" });
  });
  it("does not read another workspace", async () => {
    expect(await getRadarAdmission("other-company")).toMatchObject({ allowed: false, spentUsd: null });
    mocks.config.enabled = false;
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "disabled" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { error: { message: "internal detail" } }, { data: null },
    { data: { ...available, availableUsd: 1 } },
    { data: { ...available, spentUsd: -1 } },
    { data: { ...available, heldUsd: NaN } },
    { data: { ...available, maxUsd: 9 } },
    { data: { ...available, allowed: false } },
    { data: { ...available, remainingRuns: 2 } },
    { data: { ...available, code: "__proto__" } },
  ])("fails closed for inconsistent monetary evidence %#", async result => {
    mocks.rpc.mockResolvedValue(result);
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "unavailable", spentUsd: null });
  });
  it("contains connectivity details", async () => {
    mocks.rpc.mockRejectedValue(new Error("connection details"));
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "unavailable" });
  });
});
