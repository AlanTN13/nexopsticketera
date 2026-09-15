import { ticketListReturnPath } from "@/lib/routing";
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


describe("ticket list return path", () => {
  it("preserves filters for the general queue and the ticket's company", () => {
    expect(ticketListReturnPath("/backoffice/queue?status=on_hold")).toBe("/backoffice/queue?status=on_hold");
    expect(ticketListReturnPath("/backoffice/companies/empresa-a?query=Dos&status=on_hold", "empresa-a"))
      .toBe("/backoffice/companies/empresa-a?query=Dos&status=on_hold");
  });
  it("rejects external destinations and unrelated companies", () => {
    for (const path of ["https://example.test", "//example.test", "/backoffice/queue-other", "/backoffice/companies/empresa-b"]) {
      expect(ticketListReturnPath(path, "empresa-a")).toBe("/backoffice/queue");
    }
  });
});
