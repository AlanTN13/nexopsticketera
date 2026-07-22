import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTicketNextStep, translateHistoryMessage } from "@/lib/ticketing";
import { ticketA } from "./fixtures";

describe("ticket presentation", () => {
  it("derives a readable next step from the current workflow", () => {
    expect(getTicketNextStep(ticketA)).not.toMatch(/in_progress|waiting_for_client/);
  });

  it("shows the safe assignee label and unassigned fallback in the client portal", () => {
    const page = readFileSync(join(process.cwd(), "src/app/portal/tickets/[ticketCode]/page.tsx"), "utf8");
    expect(page).toContain('label="Responsable de NexOps"');
    expect(page).toContain('ticket.assigneeName ?? "Aún no asignado"');
    expect(page).not.toContain("assignee?.email");
  });

  it("uses the batched safe assignee projection in desktop and mobile ticket lists", () => {
    const store = readFileSync(join(process.cwd(), "src/lib/app-store.ts"), "utf8");
    const table = readFileSync(join(process.cwd(), "src/components/tables.tsx"), "utf8");
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260720222153_batch_visible_ticket_assignees.sql"),
      "utf8",
    );

    expect(store).toContain('client.rpc("ticket_assignee_display_names"');
    expect(store).not.toContain('client.rpc("ticket_assignee_display_name",');
    expect(table.match(/clientView\s*\? ticket\.assigneeName/g)).toHaveLength(2);
    expect(table.match(/clientView \? "Aún no asignado" : "Sin asignar"/g)).toHaveLength(2);
    expect(migration).toContain("private.can_access_company(t.company_id)");
    expect(migration).toContain(
      "revoke all on function public.ticket_assignee_display_names(uuid[]) from public, anon",
    );
  });

  it("offers previews, removal and duplicate-submit protection for comment images", () => {
    const form = readFileSync(join(process.cwd(), "src/components/comment-form.tsx"), "utf8");
    expect(form).toContain("Adjuntar imágenes");
    expect(form).toContain("URL.createObjectURL");
    expect(form).toContain("removeFile(index)");
    expect(form).toContain("PendingSubmitButton");
    expect(form).toContain('pendingLabel="Enviando…"');
    expect(form).toContain('value={body}');
    expect(form).toContain('setBody(event.target.value)');
  });

  it("clears stale native validation when the user enters a job title", () => {
    const form = readFileSync(join(process.cwd(), "src/components/create-user-form.tsx"), "utf8");

    expect(form).toContain('event.currentTarget.setCustomValidity("");');
    expect(form).not.toContain('pattern=".*\\\\S.*"');
    expect(form).toContain("const titleIsEmpty = title.trim().length === 0");
  });

  it("translates technical values in history messages", () => {
    expect(translateHistoryMessage("Status: in_progress. Priority: high"))
      .toBe("Status: En progreso. Priority: Alta");
  });

  it("closes the company modal through the success navigation and keeps errors in place", () => {
    const action = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
    const page = readFileSync(
      join(process.cwd(), "src/app/backoffice/companies/page.tsx"),
      "utf8",
    );

    expect(action).toContain('"Empresa creada correctamente."');
    expect(action).toContain("createdCompanyId = result.company.id");
    expect(page).toContain('key={created ?? "create-company"}');
    expect(page).toContain('<InlineNotice tone="success">{success}</InlineNotice>');
  });

  it("keeps operational multiselect filters in the URL and ticket return path", () => {
    const filters = readFileSync(join(process.cwd(), "src/components/ticket-filters.tsx"), "utf8");
    const queue = readFileSync(
      join(process.cwd(), "src/app/backoffice/queue/page.tsx"),
      "utf8",
    );
    const ticket = readFileSync(
      join(process.cwd(), "src/app/backoffice/tickets/[ticketCode]/page.tsx"),
      "utf8",
    );

    expect(filters).toContain('type="checkbox"');
    expect(queue).toContain('query={filters.query} multiple filters={[');
    expect(filters).toContain("currentParams.append(filter.name, value)");
    expect(filters).toContain("remainingValues.forEach");
    expect(queue).toContain("returnPath={returnPath}");
    expect(ticket).toContain("queueReturnPath");
  });
});
