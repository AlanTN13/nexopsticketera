import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { dispatchRadarN8n } from "@/lib/radar-api-worker";
const network = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", network); network.mockResolvedValue(new Response(null,{status:202}));
  vi.stubEnv("RADAR_API_ENABLED","true"); vi.stubEnv("RADAR_API_PILOT_WORKSPACE_ID","pilot"); vi.stubEnv("RADAR_API_PILOT_MAX_RUNS","3");
  vi.stubEnv("RADAR_N8N_WEBHOOK_URL","https://automation.example/webhook/radar");
  vi.stubEnv("RADAR_N8N_DISPATCH_SECRET","d".repeat(32)); vi.stubEnv("RADAR_N8N_CALLBACK_SECRET","c".repeat(32));
});
afterEach(() => {vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("n8n dispatch replaces in-process worker",()=>{
  it("only sends run identity to authenticated private webhook",async()=>{
    await dispatchRadarN8n("run-id");
    const [url,init]=network.mock.calls[0]; expect(url).toBe("https://automation.example/webhook/radar");
    expect(JSON.parse(init.body)).toEqual({version:1,runId:"run-id"});expect(init.redirect).toBe("error");
    expect(init.headers["x-radar-dispatch-secret"]).toBe("d".repeat(32));
    expect(init.body).not.toContain("OPENAI");
  });
  it.each(["http://localhost/test","https://127.0.0.1/test","https://automation.example/?secret=x"])("rejects unsafe dispatch %s",async url=>{
    vi.stubEnv("RADAR_N8N_WEBHOOK_URL",url);await expect(dispatchRadarN8n("run-id")).rejects.toThrow();expect(network).not.toHaveBeenCalled();
  });
  it("does not log upstream errors or retry an uncertain dispatch",async()=>{
    network.mockRejectedValue(new Error("private secret upstream"));await expect(dispatchRadarN8n("run-id")).rejects.toThrow("n8n no confirmó");expect(network).toHaveBeenCalledTimes(1);
  });
});
