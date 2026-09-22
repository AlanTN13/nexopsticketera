import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const m = vi.hoisted(() => ({ access: vi.fn(), admission: vi.fn(), find: vi.fn(), create: vi.fn(), reserve: vi.fn(), dispatch: vi.fn(), accept: vi.fn(), decide: vi.fn(), run: vi.fn(), schedule: vi.fn(), prefs: vi.fn(), build: vi.fn() }));
vi.mock("@/lib/radar-admission", () => ({ getRadarAdmission: m.admission }));
vi.mock("@/lib/radar-control-plane-auth", () => ({ requireRadarWorkspaceAccess: m.access }));
vi.mock("@/lib/public-app-url", () => ({ getPublicAppUrl: () => "https://portal.example.com" }));
vi.mock("@/lib/radar-engine-client", () => ({ radarEngineConnected: () => true, dispatchRadarRun: m.dispatch }));
vi.mock("@/lib/radar-control-plane-store", () => ({ findRadarRequest: m.find, createRadarRun: m.create, reserveRadarDispatch: m.reserve, acceptRadarDispatch: m.accept, failRadarDispatch: vi.fn(), decideRadarRun: m.decide, getRadarRunForPublication: m.run, updateRadarPreferences: m.prefs, updateRadarSchedule: m.schedule }));
vi.mock("@/lib/radar-publication", () => ({ buildRadarPublicationPackage: m.build }));
import { issueRadarPreviewToken } from "@/lib/radar-preview";
import { createManualRadarNoteAction, requestRadarRunAction, decideRadarRunAction, updateRadarScheduleAction, updateRadarPreferencesAction } from "@/app/portal/radar/operacion/actions";
const id = "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4";
function form(extra: Record<string, string> = {}) { const f = new FormData(); for (const [k,v] of Object.entries({ workspaceId: "nexops", idempotencyKey: id, mode: "review", sourceUrl: "https://example.com/source", ...extra })) f.set(k,v); return f; }
beforeEach(() => { vi.resetAllMocks(); m.access.mockResolvedValue({ actor: { id: "actor" } }); m.find.mockResolvedValue(null); m.build.mockResolvedValue({ compositionDigest: "a".repeat(64) }); m.admission.mockResolvedValue({ allowed: false, code: "budget_exhausted", message: "Presupuesto agotado. Búsqueda no iniciada." }); });
describe("Radar Phase A admission", () => {
  it.each([requestRadarRunAction, createManualRadarNoteAction])("blocks before creating or dispatching a budget-exhausted request", async action => {
    expect((await action(form())).error).toContain("Presupuesto agotado");
    expect(m.create).not.toHaveBeenCalled(); expect(m.reserve).not.toHaveBeenCalled(); expect(m.dispatch).not.toHaveBeenCalled();
    expect(m.access.mock.invocationCallOrder[0]).toBeLessThan(m.admission.mock.invocationCallOrder[0]);
  });
  it.each([requestRadarRunAction, createManualRadarNoteAction])("denies unauthorized workspace before privileged admission reads", async action => {
    m.access.mockRejectedValue(new Error("No tenés permiso"));
    expect((await action(form())).error).toContain("permiso"); expect(m.admission).not.toHaveBeenCalled(); expect(m.find).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it.each([requestRadarRunAction, createManualRadarNoteAction])("returns an existing idempotent request without new admission or dispatch", async action => {
    m.find.mockResolvedValue({ id, status: "running" });
    expect((await action(form())).success).toContain("ya estaba registrada"); expect(m.admission).not.toHaveBeenCalled(); expect(m.dispatch).not.toHaveBeenCalled();
    expect(m.find).toHaveBeenCalledWith("nexops", id);
  });
  it("fails closed when the availability cannot be checked", async () => {
    m.admission.mockResolvedValue({ allowed: false, message: "Disponibilidad no verificada" });
    expect((await requestRadarRunAction(form())).error).toContain("no verificada"); expect(m.create).not.toHaveBeenCalled();
  });
  it("an allowed manual source remains preparing, with exactly one dispatch", async () => {
    m.admission.mockResolvedValue({ allowed: true }); m.create.mockResolvedValue({ id, createdAt: "2026-09-21", triggerKind: "manual" }); m.reserve.mockResolvedValue(true); m.dispatch.mockResolvedValue({ externalRunId: "e1" });
    const result = await createManualRadarNoteAction(form()); expect(result.error).toBeNull(); expect(result.success).toContain("todavía no comenzó"); expect(m.dispatch).toHaveBeenCalledTimes(1);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ requestKind: "manual_note", mode: "review" }));
  });
  it("rejects a decision for another company even with a forged workspace form", async () => {
    m.run.mockResolvedValue({ workspaceId: "other" });
    expect((await decideRadarRunAction(form({ runId: id, decision: "approve" }))).error).toContain("no pertenece"); expect(m.decide).not.toHaveBeenCalled();
  });
  it("recovers its own queued request through admission without bypassing the last guard", async () => {
    m.find.mockResolvedValue({ id, status: "queued" }); m.admission.mockResolvedValue({ allowed: true }); m.create.mockResolvedValue({ id, triggerKind: "manual" }); m.reserve.mockResolvedValue(false);
    expect((await requestRadarRunAction(form())).success).toContain("ya estaba registrada"); expect(m.admission).toHaveBeenCalledWith("nexops", id); expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("rejects approval without a signed preview and rejects ineligible candidates even with a high score", async () => {
    m.run.mockResolvedValue({ id, workspaceId: "nexops", status: "review_pending", eligibility: "ELIGIBLE", candidate: { score: 99, composition: { title: "Persisted" }, qa: { verdict: "PASS" } } });
    expect((await decideRadarRunAction(form({ runId: id, decision: "approve" }))).error).toContain("vista previa"); expect(m.decide).not.toHaveBeenCalled();
    m.run.mockResolvedValue({ id, workspaceId: "nexops", status: "review_pending", eligibility: "INELIGIBLE", candidate: { score: 99, composition: { title: "Persisted" }, qa: { verdict: "PASS" } } });
    expect((await decideRadarRunAction(form({ runId: id, decision: "approve" }))).error).toContain("elegibilidad"); expect(m.decide).not.toHaveBeenCalled();
  });
  it("accepts the authorized operator's signed exact-preview approval without publication", async () => {
    vi.stubEnv("RADAR_PREVIEW_SECRET", "test-preview-signing-".repeat(3));
    m.run.mockResolvedValue({ id, workspaceId: "nexops", status: "review_pending", eligibility: "ELIGIBLE", persistedCandidate: { raw: "unchanged DB JSON" }, candidate: { score: 82, composition: { title: "Persisted" }, qa: { verdict: "PASS" } } });
    const digest = "a".repeat(64); const token = issueRadarPreviewToken({ runId: id, workspaceId: "nexops", actorId: "actor", compositionDigest: digest });
    const result = await decideRadarRunAction(form({ runId: id, decision: "approve", compositionDigest: digest, previewToken: token }));
    expect(result.error).toBeNull(); expect(m.decide).toHaveBeenCalledWith(expect.objectContaining({ actorId: "actor", decision: "approve", expectedCandidate: { raw: "unchanged DB JSON" } })); expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("rejects an older package token when the persisted candidate changed", async () => {
    vi.stubEnv("RADAR_PREVIEW_SECRET", "test-preview-signing-".repeat(3));
    const token = issueRadarPreviewToken({ runId: id, workspaceId: "nexops", actorId: "actor", compositionDigest: "b".repeat(64) });
    m.run.mockResolvedValue({ id, workspaceId: "nexops", status: "review_pending", eligibility: "ELIGIBLE", candidate: { score: 82, composition: { title: "Persisted B" }, qa: { verdict: "PASS" } } });
    expect((await decideRadarRunAction(form({ runId: id, decision: "approve", compositionDigest: "b".repeat(64), previewToken: token }))).error).toContain("cambió"); expect(m.decide).not.toHaveBeenCalled();
    expect(m.build).toHaveBeenCalledWith(expect.anything(), { title: "Persisted B" });
  });
  it("does not enable scheduling through a direct server action", async () => {
    const f = form({ schedulerEnabled: "true", autonomyMode: "review", scheduleHour: "7" }); for (let d=1;d<=6;d++) f.append("scheduleDays",String(d));
    expect((await updateRadarScheduleAction(f)).error).toContain("no está habilitada"); expect(m.schedule).not.toHaveBeenCalled();
  });
  it("does not enable autopublication through a direct server action", async () => {
    const f = form({ publishingMode: "automatic", publicationsPerWeek: "2", opportunityBehavior: "suggest" }); f.append("topics", "IA aplicada");
    expect((await updateRadarPreferencesAction(f)).error).toContain("no está habilitada"); expect(m.prefs).not.toHaveBeenCalled();
  });
});
