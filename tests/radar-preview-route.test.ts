import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), run: vi.fn(), build: vi.fn() }));
vi.mock("@/lib/radar-control-plane-auth", () => ({ requireRadarWorkspaceAccess: mocks.access }));
vi.mock("@/lib/radar-control-plane-store", () => ({ getRadarRunForPublication: mocks.run }));
vi.mock("@/lib/radar-publication", () => ({ buildRadarPublicationPackage: mocks.build }));
import { POST } from "@/app/api/radar/runs/[runId]/preview/route";
import { verifyRadarPreviewToken } from "@/lib/radar-preview";

const runId = "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4";
const origin = "https://portal.example.com";
const context = { params: Promise.resolve({ runId }) };
function request(source = origin) { return new Request(`${origin}/api/radar/runs/${runId}/preview`, { method: "POST", headers: { origin: source }, body: JSON.stringify({ workspaceId: "nexops", composition: {} }) }); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RADAR_PREVIEW_SECRET", "unit-test-preview-secret-".repeat(3));
  vi.stubEnv("RADAR_WEB_PREVIEW_URL", "https://preview.example.com/radar/preview");
  mocks.access.mockResolvedValue({ actor: { id: "actor" } });
  mocks.run.mockResolvedValue({ id: runId, workspaceId: "nexops" });
  mocks.build.mockResolvedValue({ article: { title: "Preview" }, cover: { pngBase64: "png", sha256: "b".repeat(64) }, compositionDigest: "a".repeat(64) });
});
describe("private Radar preview issuance", () => {
  it("rejects cross-origin without reaching workspace or database", async () => {
    expect((await POST(request("https://evil.test"), context)).status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("requires operate authorization before reading the run", async () => {
    mocks.access.mockRejectedValue(new Error("No permission"));
    expect((await POST(request(), context)).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("rejects another workspace's run before rendering", async () => {
    mocks.run.mockResolvedValue({ workspaceId: "other" });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.build).not.toHaveBeenCalled();
  });
  it("returns a private exact-package token without dispatching or publishing", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.access).toHaveBeenCalledWith("nexops", "operate");
    const payload = await response.json();
    expect(verifyRadarPreviewToken({ runId, workspaceId: "nexops", actorId: "actor", compositionDigest: payload.compositionDigest, token: payload.token })).toBe(true);
    expect(payload.webUrl).toBe("https://preview.example.com/radar/preview");
  });
  it("fails closed when preview signing is not configured", async () => {
    vi.stubEnv("RADAR_PREVIEW_SECRET", ""); vi.stubEnv("RADAR_PUBLICATION_CALLBACK_SECRET", "");
    expect((await POST(request(), context)).status).toBe(400);
  });
});
