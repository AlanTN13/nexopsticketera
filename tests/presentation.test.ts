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

  it("offers previews, removal and duplicate-submit protection for comment images", () => {
    const form = readFileSync(join(process.cwd(), "src/components/comment-form.tsx"), "utf8");
    expect(form).toContain("Adjuntar imágenes");
    expect(form).toContain("URL.createObjectURL");
    expect(form).toContain("removeFile(index)");
    expect(form).toContain("disabled={pending}");
    expect(form).toContain("Subiendo y publicando…");
    expect(form).toContain('value={body}');
    expect(form).toContain('setBody(event.target.value)');
  });

  it("translates technical values in history messages", () => {
    expect(translateHistoryMessage("Status: in_progress. Priority: high"))
      .toBe("Status: En progreso. Priority: Alta");
  });
});
