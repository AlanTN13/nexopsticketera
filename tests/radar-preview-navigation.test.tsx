import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} data-client-navigation="true" /> }));
import RadarEntryLink from "@/components/radar/radar-entry-link";
import nextConfig from "../next.config";

describe("Radar preview document isolation", () => {
  it("enters Radar through a new document, preserving tenant and history links", () => {
    for (const href of ["/portal/radar?company=acme", "/backoffice/radar", "/backoffice/radar/historial?run=existing"]) {
      const html = renderToStaticMarkup(<RadarEntryLink href={href}>Radar</RadarEntryLink>);
      expect(html).toContain(`href="${href}"`);
      expect(html).not.toContain("data-client-navigation");
    }
    for (const href of ["/backoffice/queue", "/portal/metricas", "/portal/radar-other", "https://example.com/radar"]) {
      expect(renderToStaticMarkup(<RadarEntryLink href={href}>Other</RadarEntryLink>)).toContain("data-client-navigation");
    }
  });
  it("keeps global document isolation and scopes popup support to the two Radar UI trees", async () => {
    const rules = await nextConfig.headers!();
    const coop = (rule: typeof rules[number]) => rule.headers.find(header => header.key === "Cross-Origin-Opener-Policy")?.value;
    expect(coop(rules.find(rule => rule.source === "/(.*)")!)).toBe("same-origin");
    expect(rules.filter(rule => coop(rule) === "same-origin-allow-popups").map(rule => rule.source)).toEqual(["/portal/radar/:path*", "/backoffice/radar/:path*"]);
  });
});
