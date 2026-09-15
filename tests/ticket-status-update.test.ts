import { describe, expect, it } from "vitest";
import { authorizeStatusUpdate, validateStatusUpdate } from "@/lib/ticket-status-update";
import { OPEN_TICKET_STATUSES, TICKET_STATUSES, statusLabels, getTicketNextStep, translateHistoryMessage } from "@/lib/ticketing";
import { buildPortalStats, filterTickets } from "@/lib/queries";
import { fixtureDb, nexopsAgent, platformAdmin, clientA, viewerA, ticketA, ticketB, companyA } from "./fixtures";

const id = "30000000-0000-0000-0000-000000000001";
describe("quick status contract", () => {
  it("validates and deduplicates selected UUIDs and the central catalog", () => {
    for (const status of TICKET_STATUSES) expect(validateStatusUpdate([id, id], status)).toEqual({ ticketIds: [id], status });
    for (const ids of [null, [], ["not-a-uuid"], [null], Array(101).fill(id)]) expect(() => validateStatusUpdate(ids, "on_hold")).toThrow();
    for (const state of [null, "", "ON HOLD", "bogus"]) expect(() => validateStatusUpdate([id], state)).toThrow();
  });
  it("uses the same company and workflow permission as detail for every selected ticket", () => {
    expect(authorizeStatusUpdate(fixtureDb, nexopsAgent, [ticketA.id])).toEqual([ticketA]);
    expect(authorizeStatusUpdate(fixtureDb, platformAdmin, [ticketA.id, ticketB.id])).toHaveLength(2);
    for (const user of [clientA, viewerA, { ...nexopsAgent, status: "disabled" as const }, { ...nexopsAgent, modulePermissions: [] }]) {
      expect(() => authorizeStatusUpdate(fixtureDb, user, [ticketA.id])).toThrow();
    }
    expect(() => authorizeStatusUpdate(fixtureDb, nexopsAgent, [ticketA.id, ticketB.id])).toThrow();
    expect(() => authorizeStatusUpdate(fixtureDb, platformAdmin, ["missing"])).toThrow();
    expect(() => authorizeStatusUpdate({ ...fixtureDb, companies: [{ ...companyA, modules: { ...companyA.modules, support: { enabled: false, settings: {} } } }] }, nexopsAgent, [ticketA.id])).toThrow();
  });
  it("treats On Hold consistently as open and filterable with readable next step and history", () => {
    const ticket = { ...ticketA, status: "on_hold" as const };
    expect(OPEN_TICKET_STATUSES).toContain("on_hold");
    expect(statusLabels.on_hold).toBe("On Hold");
    expect(filterTickets([ticket, ticketB], { status: "on_hold" })).toEqual([ticket]);
    expect(buildPortalStats([ticket]).open).toBe(1);
    expect(getTicketNextStep(ticket)).toContain("pausa");
    expect(translateHistoryMessage("Agente cambió el estado a on_hold.")).toContain("On Hold");
  });
});
