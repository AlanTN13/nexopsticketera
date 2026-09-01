import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isRadarWorkerWorkspaceId, radarPayloadDigest } from "@/lib/radar-engine-contract";
import { radarScheduleDate, radarScheduledIdempotencyKey } from "@/lib/radar-scheduler";

describe("Radar bridge shared contract", () => {
  it("accepts exactly the worker workspace identifier boundary", () => {
    expect(isRadarWorkerWorkspaceId("nexops")).toBe(true);
    expect(isRadarWorkerWorkspaceId("a_b-1")).toBe(true);
    expect(isRadarWorkerWorkspaceId(`a${"b".repeat(63)}`)).toBe(true);
    expect(isRadarWorkerWorkspaceId("workspace.with.dot")).toBe(false);
    expect(isRadarWorkerWorkspaceId("a")).toBe(false);
    expect(isRadarWorkerWorkspaceId(`a${"b".repeat(64)}`)).toBe(false);
    expect(isRadarWorkerWorkspaceId("NexOps")).toBe(false);
  });

  it("matches the worker canonical digest vectors", () => {
    const request = {
      schemaVersion: 1,
      requestId: "c40b81b7-6ac4-4da1-92e8-86a7a50f9dc4",
      requestedAt: "2026-09-01T18:00:00.000Z",
      workspaceId: "nexops",
      trigger: "manual",
      mode: "review",
      intent: "opportunity_search",
      manualNote: null,
      callbackUrl: "https://portal.nexopstech.com",
      publicationGate: false,
    };
    const result = {
      status: "failed",
      publicationGate: false,
      publicMessage: "La corrida no pudo completarse.",
      candidate: null,
      resultReason: "Falló la investigación temporal.",
      externalRunId: null,
      externalRunUrl: null,
    };
    expect(radarPayloadDigest(request)).toBe("485b139c08079f03dd7407ae3dfc7ec0dffd14f2c61fb15cf5bf183ecdb4543a");
    expect(radarPayloadDigest(result)).toBe("3e56b166ebae52c0456ffed7a5ea77bb5ae77d74bde210f8c19c8ca47a2d7b9b");
  });

  it("uses one deterministic daily idempotency key in Argentina", () => {
    const date = radarScheduleDate(new Date("2026-09-05T10:00:00.000Z"));
    expect(date).toBe("2026-09-05");
    expect(radarScheduledIdempotencyKey("nexops", date)).toBe(radarScheduledIdempotencyKey("nexops", date));
    expect(radarScheduledIdempotencyKey("nexops", date)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the cron gated and fixed to Monday-Saturday at 07:00 ART", () => {
    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };
    const route = readFileSync(join(process.cwd(), "src/app/api/cron/radar/route.ts"), "utf8");
    const action = readFileSync(join(process.cwd(), "src/app/portal/radar/operacion/actions.ts"), "utf8");
    expect(vercel.crons).toContainEqual({ path: "/api/cron/radar", schedule: "0 10 * * 1-6" });
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain('process.env.RADAR_SCHEDULER_ENABLED !== "true"');
    expect(route).toContain('triggerKind: "scheduled"');
    expect(route).toContain('autonomyMode: "review"');
    expect(action).toContain('scheduleHour !== 7 || scheduleDays.join(",") !== "1,2,3,4,5,6"');
  });
});
