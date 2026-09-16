import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyA, companyB, fixtureDb, nexopsAgent, ticketA, ticketB } from "./fixtures";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/app-store", () => ({ getAppSnapshot: mocks.snapshot }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedInternalActor: mocks.actor }));
vi.mock("@/app/ticket-status-actions", () => ({ updateTicketStatusesAction: vi.fn() }));
vi.mock("@/components/forms", () => ({
  CreateUserForm: () => null, LogoutClientForm: () => null, UpdateCompanyForm: () => null,
  UpdateCompanyModulesForm: () => null, UpdateUserForm: () => null,
}));
vi.mock("@/components/access-matrix-form", () => ({ AccessMatrixForm: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  usePathname: () => "/backoffice/companies/empresa-a",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
import CompanyPage from "@/app/backoffice/companies/[companyId]/page";

const held = { ...ticketA, id: "1003", code: "NEX-1003", title: "Pausa", status: "on_hold" as const, priority: "high" as const };
type Filters = Awaited<Parameters<typeof CompanyPage>[0]["searchParams"]>;
async function render(filters: Filters = {}, company = companyA.slug) {
  return renderToStaticMarkup(await CompanyPage({ params: Promise.resolve({ companyId: company }), searchParams: Promise.resolve(filters) }));
}
beforeEach(() => {
  mocks.snapshot.mockResolvedValue({ ...fixtureDb, tickets: [ticketA, held, ticketB] });
  mocks.actor.mockResolvedValue(nexopsAgent);
});

describe("tickets inside the company profile", () => {
  it("renders shared multi-value filters and editable tickets only for the current company", async () => {
    const html = await render();
    expect(/<input(?=[^>]*type="checkbox")(?=[^>]*name="status")/.test(html)).toBe(true);
    expect(/<input(?=[^>]*type="checkbox")(?=[^>]*name="assignedToId")/.test(html)).toBe(true);
    expect(html).toContain('aria-label="Seleccionar NEX-1001"');
    expect(html).toContain('aria-label="Estado de NEX-1003"');
    expect(html).toContain("On Hold");
    expect(html).not.toContain('aria-label="Seleccionar NEX-1002"');
    expect(html).not.toContain('aria-label="Estado de NEX-1002"');
  });
  it("combines repeated filters with OR within a field and AND across fields", async () => {
    const html = await render({ status: ["new", "on_hold"], priority: ["high", "critical"], area: ["website", "crm"] });
    expect(html).toContain('aria-label="Seleccionar NEX-1003"');
    expect(html).not.toContain('aria-label="Seleccionar NEX-1001"');
    expect(html).toContain('checked="" value="on_hold"');
    expect(html).toContain('checked="" value="new"');
  });
  it("preserves every selected value in detail return links", async () => {
    const html = await render({ status: ["new", "on_hold"], priority: ["medium", "high"], assignedToId: ["unassigned", "agent"] });
    const expected = "/backoffice/companies/empresa-a?status=new&status=on_hold&priority=medium&priority=high&assignedToId=unassigned&assignedToId=agent";
    expect(html).toContain(`returnTo=${encodeURIComponent(expected)}`);
  });
  it("preserves repeated values when canonicalizing a company ID to its slug", async () => {
    await expect(render({ status: ["new", "on_hold"] }, companyA.id))
      .rejects.toThrow("REDIRECT:/backoffice/companies/empresa-a?status=new&status=on_hold");
  });
  it("hides editing controls when the internal actor has only view permission", async () => {
    mocks.actor.mockResolvedValue({ ...nexopsAgent, modulePermissions: [{ companyId: companyA.id, module: "support", level: "view" }] });
    const html = await render();
    expect(html).not.toContain('aria-label="Seleccionar NEX-1001"');
    expect(html).not.toContain('aria-label="Estado de NEX-1001"');
    expect(html).toContain("On Hold");
  });
  it("keeps another company out of the profile even with a forged company filter", async () => {
    const html = await render({ companyId: companyB.id } as Filters);
    expect(html).not.toContain('aria-label="Seleccionar NEX-1002"');
    expect(html).not.toContain('aria-label="Estado de NEX-1002"');
  });
});
