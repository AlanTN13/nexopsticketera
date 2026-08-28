import { describe, expect, it } from "vitest";

import { canAssignUserRole, canChangeUserRole } from "@/lib/ticketing";
import { clientA, companyA, companyB, nexopsAgent, platformAdmin } from "./fixtures";

const teamLead = { ...nexopsAgent, id: "lead", role: "team_lead" as const };

describe("privileged role assignment", () => {
  it("reserves internal role grants for active platform admins", () => {
    expect(canAssignUserRole(platformAdmin, null, "agent")).toBe(true);
    expect(canAssignUserRole(platformAdmin, null, "platform_admin")).toBe(true);
    expect(canAssignUserRole(teamLead, null, "agent")).toBe(false);
    expect(canAssignUserRole(teamLead, null, "platform_admin")).toBe(false);
  });

  it("keeps client role assignment scoped to authorized managers", () => {
    expect(canAssignUserRole(teamLead, companyA.id, "client_operator")).toBe(true);
    expect(canAssignUserRole(clientA, companyA.id, "client_viewer")).toBe(true);
    expect(canAssignUserRole(clientA, companyB.id, "client_viewer")).toBe(false);
    expect(canAssignUserRole(clientA, companyA.id, "agent")).toBe(false);
  });

  it("blocks disabled managers and self role changes", () => {
    expect(
      canAssignUserRole({ ...platformAdmin, status: "disabled" }, null, "agent"),
    ).toBe(false);
    expect(canChangeUserRole(teamLead, teamLead, "platform_admin")).toBe(false);
    expect(canChangeUserRole(teamLead, teamLead, "team_lead")).toBe(true);
  });
});
