import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), config: { enabled: true, workspaceId: "pilot", maxRuns: 6 } }));
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/radar-api-provider", () => ({ radarApiConfiguration: () => mocks.config }));
import { getRadarAdmission } from "@/lib/radar-admission";

beforeEach(() => { mocks.rpc.mockReset(); mocks.config.enabled = true; mocks.config.maxRuns = 6; });
describe("read-only Radar admission", () => {
  it("exposes exhausted persistent reserve without pretending it is actual billed usage", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: false, code: "budget_exhausted", reservedUsd: 9, maxUsd: 9, remainingRuns: 0 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "budget_exhausted", reservedUsd: 9, maxUsd: 9, remainingRuns: 0, message: expect.stringContaining("No se inició") });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_radar_admission", { target_workspace_id: "pilot", pilot_max_runs: 6 });
  });
  it("admits the last authorized reservation without reserving it", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: true, code: "available", reservedUsd: 7.5, maxUsd: 9, remainingRuns: 1 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: true, remainingRuns: 1 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("passes the authenticated queued retry ID without bypassing the budget result", async () => {
    const existingQueuedRunId = "82000000-0000-0000-0000-000000000001";
    mocks.rpc.mockResolvedValue({ data: { allowed: false, code: "budget_exhausted", reservedUsd: 9, maxUsd: 9, remainingRuns: 0 } });
    expect(await getRadarAdmission("pilot", existingQueuedRunId)).toMatchObject({ allowed: false, code: "budget_exhausted" });
    expect(mocks.rpc).toHaveBeenCalledWith("get_radar_admission", { target_workspace_id: "pilot", pilot_max_runs: 6, existing_queued_run_id: existingQueuedRunId });
  });
  it("rejects a malformed retry ID before any privileged read", async () => {
    expect(await getRadarAdmission("pilot", "not-a-uuid")).toMatchObject({ allowed: false, code: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("respects a lower configured run cap", async () => {
    mocks.config.maxRuns = 3;
    mocks.rpc.mockResolvedValue({ data: { allowed: false, code: "budget_exhausted", reservedUsd: 4.5, maxUsd: 9, remainingRuns: 0 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, remainingRuns: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("get_radar_admission", { target_workspace_id: "pilot", pilot_max_runs: 3 });
  });
  it("blocks an active run even with sufficient reserve", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: false, code: "active_run", reservedUsd: 7.5, maxUsd: 9, remainingRuns: 1 } });
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "active_run" });
  });
  it("does not read the ledger for another workspace or missing configuration", async () => {
    expect(await getRadarAdmission("other-company")).toMatchObject({ allowed: false, reservedUsd: null });
    mocks.config.enabled = false;
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "disabled" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { error: { message: "internal detail" } }, { data: null },
    { data: { code: "available", allowed: true, maxUsd: 9, reservedUsd: 9, remainingRuns: 1 } },
    { data: { code: "available", allowed: false, maxUsd: 9, reservedUsd: 0, remainingRuns: 6 } },
    { data: { code: "available", allowed: true, maxUsd: 15, reservedUsd: 0, remainingRuns: 10 } },
    { data: { code: "__proto__", allowed: false, maxUsd: 9, reservedUsd: 0, remainingRuns: 6 } },
  ])("fails closed for errors or inconsistent availability %#", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "unavailable", reservedUsd: null });
  });
  it("contains connectivity errors without exposing provider/database details", async () => {
    mocks.rpc.mockRejectedValue(new Error("connection details"));
    expect(await getRadarAdmission("pilot")).toMatchObject({ allowed: false, code: "unavailable" });
  });
});
