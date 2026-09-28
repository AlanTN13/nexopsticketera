import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketInitialAttachments } from "@/components/ticket-initial-attachments";
import type { TicketAttachment } from "@/lib/ticketing";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const attachment: TicketAttachment = {
  id: "att-1",
  ticketId: "ticket-1",
  name: "evidencia.png",
  sizeLabel: "120 KB",
  kind: "screenshot",
  commentId: null,
  url: "/api/ticket-attachments/att-1",
};

describe("ticket initial attachments", () => {
  it("renders initial attachments as visible image previews", () => {
    const html = renderToStaticMarkup(
      <TicketInitialAttachments attachments={[attachment]} />,
    );

    expect(html).toContain("Adjuntos iniciales (1)");
    expect(html).toContain('href="/api/ticket-attachments/att-1"');
    expect(html).toContain('src="/api/ticket-attachments/att-1"');
    expect(html).toContain('alt="evidencia.png"');
  });

  it("renders nothing when the ticket has no initial attachments", () => {
    expect(renderToStaticMarkup(<TicketInitialAttachments attachments={[]} />)).toBe("");
  });

  it("uses the same initial-attachment block in Portal and Backoffice", () => {
    const portal = read("src/app/portal/tickets/[ticketCode]/page.tsx");
    const backoffice = read("src/app/backoffice/tickets/[ticketCode]/page.tsx");

    expect(portal).toContain(
      "<TicketInitialAttachments attachments={initialAttachments} />",
    );
    expect(backoffice).toContain(
      "<TicketInitialAttachments attachments={initialAttachments} />",
    );
    expect(portal).toContain(
      "item.ticketId === ticket.id && item.commentId === null",
    );
    expect(backoffice).toContain(
      "item.ticketId === ticket.id && item.commentId === null",
    );
  });
});
