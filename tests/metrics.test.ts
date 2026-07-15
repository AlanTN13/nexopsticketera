import { describe, expect, it } from "vitest";

import { buildBackofficeStats, buildPortalStats, filterTickets } from "@/lib/queries";
import { companyA, companyB, ticketA, ticketB } from "./fixtures";

describe("ticket metrics", () => {
  it("calculates portal and backoffice totals without crossing filters", () => {
    expect(buildPortalStats([ticketA])).toEqual({ total: 1, open: 1, critical: 0, areas: 1 });
    expect(buildBackofficeStats([ticketA, ticketB], [companyA, companyB])).toEqual({
      activeTickets: 2,
      highPriority: 0,
      waitingCustomer: 0,
      companies: 2,
    });
    expect(filterTickets([ticketA, ticketB], { companyId: companyA.id })).toEqual([ticketA]);
  });
});
