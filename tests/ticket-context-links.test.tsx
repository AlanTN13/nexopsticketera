import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketContextLinks } from "@/components/ticket-context-links";
import { getSafeTicketContextUrls, normalizeTicketContextUrls } from "@/lib/ticket-context-urls";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("ticket context links", () => {
  it("traces submitted links through the action, RPC payload and ticket mapping", () => {
    const action = read("src/app/actions.ts");
    const store = read("src/lib/app-store.ts");

    expect(action).toContain("contextUrls: getContextUrls(formData)");
    expect(store).toContain("ticket_context_urls: contextUrls");
    expect(store).toContain("contextUrls: getSafeTicketContextUrls(row.context_urls)");
  });

  it("renders the same safe ticket links in the client portal and Service Desk", () => {
    const portal = read("src/app/portal/tickets/[ticketCode]/page.tsx");
    const backoffice = read("src/app/backoffice/tickets/[ticketCode]/page.tsx");

    expect(portal).toContain("<TicketContextLinks urls={ticket.contextUrls} />");
    expect(backoffice).toContain("<TicketContextLinks urls={ticket.contextUrls} />");
    expect(portal).toContain("Enlaces aportados");
    expect(backoffice).toContain("Enlaces aportados por el cliente");
  });

  it("accepts only trimmed HTTP(S) URLs and preserves the three-link limit", () => {
    expect(normalizeTicketContextUrls([" https://cliente.example/incidente/42 "])).toEqual([
      "https://cliente.example/incidente/42",
    ]);
    expect(normalizeTicketContextUrls([
      "https://cliente.example/incidente/42",
      "https://cliente.example/incidente/42",
    ])).toHaveLength(1);
    expect(() => normalizeTicketContextUrls(["javascript:alert(1)"])).toThrow(/http:\/\/ o https:\/\//);
    expect(() => normalizeTicketContextUrls([
      "https://a.example",
      "https://b.example",
      "https://c.example",
      "https://d.example",
    ])).toThrow(/hasta 3 links/);
  });

  it("does not render unsafe legacy values as clickable links", () => {
    const urls = getSafeTicketContextUrls([
      "https://cliente.example/caso",
      "javascript:alert(document.cookie)",
      "data:text/html,contenido-interno",
    ]);
    const html = renderToStaticMarkup(<TicketContextLinks urls={urls} />);

    expect(html).toContain('href="https://cliente.example/caso"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
  });
});
