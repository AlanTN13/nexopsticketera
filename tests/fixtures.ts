import type { Company, TicketDatabase, TicketRecord, UserProfile } from "@/lib/ticketing";

export const companyA: Company = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Empresa A",
  slug: "empresa-a",
  plan: "starter",
  industry: "Retail",
  status: "active",
  primaryContact: "a@example.test",
  modules: {
    metrics: { enabled: false, settings: {} },
    radar: { enabled: false, settings: {} },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const companyB: Company = {
  ...companyA,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Empresa B",
  slug: "empresa-b",
  primaryContact: "b@example.test",
};

function user(input: Partial<UserProfile> & Pick<UserProfile, "id" | "role">): UserProfile {
  return {
    companyId: null,
    name: input.id,
    email: `${input.id}@example.test`,
    status: "active",
    title: "",
    avatar: "",
    ...input,
  };
}

export const clientA = user({ id: "client-a", companyId: companyA.id, role: "client_admin" });
export const viewerA = user({ id: "viewer-a", companyId: companyA.id, role: "client_viewer" });
export const clientB = user({ id: "client-b", companyId: companyB.id, role: "client_operator" });
export const nexopsAgent = user({ id: "agent", role: "agent" });
export const platformAdmin = user({ id: "admin", role: "platform_admin" });

function ticket(input: Pick<TicketRecord, "id" | "companyId" | "createdById">): TicketRecord {
  return {
    code: `NEX-${input.id}`,
    title: input.id,
    description: "",
    contextUrls: [],
    type: "issue",
    area: "website",
    priority: "medium",
    status: "new",
    assignedToId: null,
    assigneeName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

export const ticketA = ticket({ id: "1001", companyId: companyA.id, createdById: clientA.id });
export const ticketB = ticket({ id: "1002", companyId: companyB.id, createdById: clientB.id });

export const fixtureDb: TicketDatabase = {
  companies: [companyA, companyB],
  users: [clientA, viewerA, clientB, nexopsAgent, platformAdmin],
  tickets: [ticketA, ticketB],
  comments: [
    { id: "comment-a", ticketId: ticketA.id, authorId: clientA.id, visibility: "external", body: "A", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "internal-a", ticketId: ticketA.id, authorId: nexopsAgent.id, visibility: "internal", body: "Internal", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "comment-b", ticketId: ticketB.id, authorId: clientB.id, visibility: "external", body: "B", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  attachments: [],
  history: [],
};
