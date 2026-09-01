import { describe, expect, it } from "vitest";

import {
  canAccessBackoffice,
  canAccessTicket,
  canCommentOnTicket,
  canCreateCompanyTicket,
  canUpdateTicketWorkflow,
  getEffectiveModuleAccess,
  hasModuleAccess,
  moduleLevelSatisfies,
} from "@/lib/authorization";
import { getTicketById, getTicketByReference, getVisibleCommentAttachments, getVisibleComments, getVisibleTickets } from "@/lib/queries";
import { clientA, clientB, companyA, companyB, fixtureDb, nexopsAgent, platformAdmin, ticketA, ticketB, viewerA } from "./fixtures";

describe("tenant isolation and roles", () => {
  it("keeps Empresa A and Empresa B isolated, including direct IDs", () => {
    expect(getVisibleTickets(fixtureDb, clientA)).toEqual([ticketA]);
    expect(getVisibleTickets(fixtureDb, clientB)).toEqual([ticketB]);
    expect(getTicketById(fixtureDb, clientA, ticketB.id)).toBeNull();
    expect(canAccessTicket(clientA, ticketB, companyB)).toBe(false);
  });

  it("resolves visible tickets by code without using the code as authorization", () => {
    expect(getTicketByReference(fixtureDb, clientA, "nex-1001")).toEqual(ticketA);
    expect(getTicketByReference(fixtureDb, clientA, "NEX-1001")).toEqual(ticketA);
    expect(getTicketByReference(fixtureDb, clientA, "nex-1002")).toBeNull();
    expect(getTicketByReference(fixtureDb, clientA, "ticket-invalido")).toBeNull();
    expect(getTicketByReference(fixtureDb, nexopsAgent, "nex-1002")).toBeNull();
    expect(getTicketByReference(fixtureDb, platformAdmin, "nex-1002")).toEqual(ticketB);
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
    const promotedViewer = {
      ...viewerA,
      modulePermissions: [{ companyId: companyA.id, module: "support" as const, level: "operate" as const }],
    };
    expect(canCreateCompanyTicket(clientA, companyA)).toBe(true);
    expect(canCreateCompanyTicket(viewerA, companyA)).toBe(false);
    expect(canCreateCompanyTicket(promotedViewer, companyA)).toBe(true);
    expect(canCommentOnTicket(viewerA, ticketA, companyA, "external")).toBe(false);
    expect(canCommentOnTicket(promotedViewer, ticketA, companyA, "external")).toBe(true);
    expect(canCommentOnTicket(promotedViewer, ticketA, companyA, "internal")).toBe(false);
    expect(canCommentOnTicket(clientA, ticketA, companyA, "internal")).toBe(false);
    expect(canCommentOnTicket(nexopsAgent, ticketA, companyA, "internal")).toBe(true);
    expect(canUpdateTicketWorkflow(clientA, companyA)).toBe(false);
    expect(canUpdateTicketWorkflow(nexopsAgent, companyA)).toBe(true);
    expect(canAccessBackoffice(clientA)).toBe(false);
    expect(canAccessBackoffice(nexopsAgent)).toBe(true);
  });

  it("enforces the complete level hierarchy", () => {
    const levels = ["none", "view", "operate", "admin"] as const;
    const required = ["view", "operate", "admin"] as const;
    const expected = {
      none: [false, false, false],
      view: [true, false, false],
      operate: [true, true, false],
      admin: [true, true, true],
    } as const;

    for (const level of levels) {
      required.forEach((minimum, index) => {
        expect(moduleLevelSatisfies(level, minimum)).toBe(expected[level][index]);
      });
    }
  });

  it("requires active user, tenant, enabled module and explicit permission", () => {
    expect(getEffectiveModuleAccess(clientA, companyA, "support")).toBe("admin");
    expect(getEffectiveModuleAccess(clientA, companyB, "support")).toBe("none");
    expect(getEffectiveModuleAccess(nexopsAgent, companyA, "support")).toBe("operate");
    expect(getEffectiveModuleAccess(nexopsAgent, companyB, "support")).toBe("none");
    expect(getEffectiveModuleAccess(platformAdmin, companyA, "support")).toBe("admin");
    expect(
      getEffectiveModuleAccess(platformAdmin, { ...companyA, modules: { ...companyA.modules, support: { enabled: false, settings: {} } } }, "support"),
    ).toBe("none");
    expect(hasModuleAccess({ ...clientA, status: "disabled" }, companyA, "support", "view")).toBe(false);
  });
});
