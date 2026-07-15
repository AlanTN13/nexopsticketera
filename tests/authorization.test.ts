import { describe, expect, it } from "vitest";

import {
  canAccessBackoffice,
  canAccessTicket,
  canCommentOnTicket,
  canCreateCompanyTicket,
  canUpdateTicketWorkflow,
} from "@/lib/authorization";
import { getTicketById, getVisibleComments, getVisibleTickets } from "@/lib/queries";
import { clientA, clientB, fixtureDb, nexopsAgent, ticketA, ticketB, viewerA } from "./fixtures";

describe("tenant isolation and roles", () => {
  it("keeps Empresa A and Empresa B isolated, including direct IDs", () => {
    expect(getVisibleTickets(fixtureDb, clientA)).toEqual([ticketA]);
    expect(getVisibleTickets(fixtureDb, clientB)).toEqual([ticketB]);
    expect(getTicketById(fixtureDb, clientA, ticketB.id)).toBeNull();
    expect(canAccessTicket(clientA, ticketB)).toBe(false);
  });

  it("prevents Empresa B from reading comments from Empresa A", () => {
    expect(getVisibleComments(fixtureDb, clientB, ticketA.id)).toEqual([]);
    expect(getVisibleComments(fixtureDb, clientA, ticketA.id).map((item) => item.id)).toEqual([
      "comment-a",
    ]);
    expect(getVisibleComments(fixtureDb, nexopsAgent, ticketA.id)).toHaveLength(2);
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
