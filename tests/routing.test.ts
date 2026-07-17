import { describe, expect, it } from "vitest";
import { parseTicketReference, ticketDetailPath } from "@/lib/routing";

describe("ticket routes", () => {
  it("builds lowercase canonical URLs from readable ticket codes", () => {
    expect(ticketDetailPath("/portal", { code: "NEX-1001" })).toBe("/portal/tickets/nex-1001");
    expect(ticketDetailPath("/backoffice", { code: "NEX-1001" })).toBe("/backoffice/tickets/nex-1001");
  });

  it("normalizes codes and accepts UUIDs only when well formed", () => {
    expect(parseTicketReference("NEX-1001")).toEqual({ kind: "code", value: "NEX-1001" });
    expect(parseTicketReference("e008aa4e-3b90-416b-adbe-43ff023275da")).toEqual({
      kind: "id",
      value: "e008aa4e-3b90-416b-adbe-43ff023275da",
    });
    expect(parseTicketReference("ticket-invalido")).toBeNull();
  });
});
