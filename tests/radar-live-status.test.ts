import { describe, expect, it } from "vitest";

import { getRadarLiveView } from "@/lib/radar-live-status";

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
