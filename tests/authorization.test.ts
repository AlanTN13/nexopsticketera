import { describe, expect, it } from "vitest";

import {
  canAccessBackoffice,
  canAccessTicket,
  canCommentOnTicket,
  canCreateCompanyTicket,
  canUpdateTicketWorkflow,
} from "@/lib/authorization";
import { getTicketById, getTicketByReference, getVisibleCommentAttachments, getVisibleComments, getVisibleTickets } from "@/lib/queries";
import { clientA, clientB, fixtureDb, nexopsAgent, ticketA, ticketB, viewerA } from "./fixtures";

describe("tenant isolation and roles", () => {
  it("keeps Empresa A and Empresa B isolated, including direct IDs", () => {
    expect(getVisibleTickets(fixtureDb, clientA)).toEqual([ticketA]);
    expect(getVisibleTickets(fixtureDb, clientB)).toEqual([ticketB]);
    expect(getTicketById(fixtureDb, clientA, ticketB.id)).toBeNull();
    expect(canAccessTicket(clientA, ticketB)).toBe(false);
  });

  it("resolves visible tickets by code without using the code as authorization", () => {
    expect(getTicketByReference(fixtureDb, clientA, "nex-1001")).toEqual(ticketA);
    expect(getTicketByReference(fixtureDb, clientA, "NEX-1001")).toEqual(ticketA);
    expect(getTicketByReference(fixtureDb, clientA, "nex-1002")).toBeNull();
    expect(getTicketByReference(fixtureDb, clientA, "ticket-invalido")).toBeNull();
    expect(getTicketByReference(fixtureDb, nexopsAgent, "nex-1002")).toEqual(ticketB);
  });

  it("keeps legacy UUID references compatible after authorization", () => {
    const legacyTicket = { ...ticketA, id: "e008aa4e-3b90-416b-adbe-43ff023275da" };
    const legacyDb = { ...fixtureDb, tickets: [legacyTicket, ticketB] };

    expect(getTicketByReference(legacyDb, clientA, legacyTicket.id)).toEqual(legacyTicket);
    expect(getTicketByReference(legacyDb, clientB, legacyTicket.id)).toBeNull();
  });

  it("prevents Empresa B from reading comments from Empresa A", () => {
    expect(getVisibleComments(fixtureDb, clientB, ticketA.id)).toEqual([]);
    expect(getVisibleComments(fixtureDb, clientA, ticketA.id).map((item) => item.id)).toEqual([
      "comment-a",
    ]);
    expect(getVisibleComments(fixtureDb, nexopsAgent, ticketA.id)).toHaveLength(2);
  });

  it("inherits attachment visibility from the parent comment", () => {
    const db = { ...fixtureDb, attachments: [
      { id: "external-image", ticketId: ticketA.id, commentId: "comment-a", name: "externa.png", sizeLabel: "1 KB", kind: "screenshot" as const, url: "signed-external" },
      { id: "internal-image", ticketId: ticketA.id, commentId: "internal-a", name: "interna.png", sizeLabel: "1 KB", kind: "screenshot" as const, url: "signed-internal" },
    ] };
    expect(getVisibleCommentAttachments(db, clientA, ticketA.id).map((item) => item.id)).toEqual(["external-image"]);
    expect(getVisibleCommentAttachments(db, nexopsAgent, ticketA.id).map((item) => item.id)).toEqual(["external-image", "internal-image"]);
    expect(getVisibleCommentAttachments(db, clientB, ticketA.id)).toEqual([]);
  });

  it("keeps the persisted assignee display scoped to a visible ticket", () => {
    const assigned = { ...ticketA, assignedToId: nexopsAgent.id, assigneeName: "Agente NexOps" };
    const db = { ...fixtureDb, tickets: [assigned, ticketB] };
    expect(getTicketById(db, clientA, ticketA.id)?.assigneeName).toBe("Agente NexOps");
    expect(getTicketById(db, clientB, ticketA.id)).toBeNull();
    expect(ticketB.assigneeName).toBeNull();
  });

  it("enforces ticket creation, comments, workflow and backoffice roles", () => {
    expect(canCreateCompanyTicket(clientA, ticketA.companyId)).toBe(true);
    expect(canCreateCompanyTicket(viewerA, ticketA.companyId)).toBe(false);
    expect(canCommentOnTicket(viewerA, ticketA, "external")).toBe(false);
    expect(canCommentOnTicket(clientA, ticketA, "internal")).toBe(false);
    expect(canCommentOnTicket(nexopsAgent, ticketA, "internal")).toBe(true);
    expect(canUpdateTicketWorkflow(clientA)).toBe(false);
    expect(canUpdateTicketWorkflow(nexopsAgent)).toBe(true);
    expect(canAccessBackoffice(clientA)).toBe(false);
    expect(canAccessBackoffice(nexopsAgent)).toBe(true);
  });
});
