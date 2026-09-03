import { describe, expect, it } from "vitest";

import { getRadarLiveView, isRadarRunStalled, RADAR_STALL_TIMEOUT_MS } from "@/lib/radar-live-status";

describe("Radar live operation status", () => {
  it("shows the real queue stage after the worker accepted the mission", () => {
    const view = getRadarLiveView("dispatching", "opportunity_search", [
      "request_created",
      "dispatch_started",
      "queue_accepted",
    ]);

    expect(view.mode).toBe("working");
    expect(view.phaseLabel).toBe("Misión en cola editorial");
    expect(view.stages.map((stage) => stage.state)).toEqual(["done", "done", "active", "waiting"]);
  });

  it("stops presenting research as active when the note is ready to review", () => {
    const view = getRadarLiveView("review_pending", "opportunity_search", ["queue_accepted"]);

    expect(view.mode).toBe("action");
    expect(view.actionLabel).toBe("Revisar propuesta");
    expect(view.stages.every((stage) => stage.state === "done")).toBe(true);
  });

  it("explains manual source reading without claiming an open search", () => {
    const view = getRadarLiveView("running", "manual_note", ["queue_accepted"]);

    expect(view.title).toContain("leyendo tu fuente");
    expect(view.stages[2].role).toContain("fuente indicada");
  });
});

describe("isRadarRunStalled", () => {
  const now = Date.parse("2026-09-03T21:00:00.000Z");

  it("detecta una misión operativa sin señales durante el límite", () => {
    expect(isRadarRunStalled("dispatching", new Date(now - RADAR_STALL_TIMEOUT_MS).toISOString(), now)).toBe(true);
  });

  it("no marca resultados listos ni misiones todavía dentro del tiempo normal", () => {
    expect(isRadarRunStalled("dispatching", new Date(now - RADAR_STALL_TIMEOUT_MS + 1).toISOString(), now)).toBe(false);
    expect(isRadarRunStalled("review_pending", new Date(now - RADAR_STALL_TIMEOUT_MS * 3).toISOString(), now)).toBe(false);
  });
});
