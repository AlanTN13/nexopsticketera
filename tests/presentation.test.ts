import { describe, expect, it } from "vitest";
import { getTicketNextStep, translateHistoryMessage } from "@/lib/ticketing";
import { ticketA } from "./fixtures";

describe("ticket presentation", () => {
  it("derives a readable next step from the current workflow", () => {
    expect(getTicketNextStep(ticketA)).not.toMatch(/in_progress|waiting_for_client/);
  });

  it("translates technical values in history messages", () => {
    expect(translateHistoryMessage("Status: in_progress. Priority: high"))
      .toBe("Status: En progreso. Priority: Alta");
  });
});
