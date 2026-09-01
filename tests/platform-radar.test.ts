import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canAccessPlatformRadar } from "@/lib/authorization";
import { clientA, nexopsAgent, platformAdmin } from "./fixtures";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Radar de la cuenta madre", () => {
  it("keeps the platform workspace separate from client companies", () => {
    const context = read("src/lib/platform-radar.ts");
    expect(context).toContain("RADAR_PLATFORM_WORKSPACE_ID");
    expect(context).toContain("discoverPlatformRadarWorkspaceId");
    expect(read("src/lib/authorization.ts")).toContain('actor.role === "platform_admin"');
    expect(context).not.toContain("sysnexops");
    expect(context).not.toContain("resolveRadarCompanyForActor");
  });

  it("uses backoffice-only routes and never requires a company query parameter", () => {
    const page = read("src/components/radar/platform-radar-page.tsx");
    expect(page).toContain('basePath: "/backoffice/radar"');
    expect(page).toContain('companyName: "NexOps · cuenta madre"');
    expect(page).not.toContain("companyLookup");
    expect(read("src/app/backoffice/radar/page.tsx")).toContain('view="overview"');
  });

  it("keeps projected links HTTPS-only and bounds the public manifest", () => {
    const workspace = read("src/lib/radar-workspace.ts");
    expect(workspace).toContain('parsed.protocol === "https:"');
    expect(workspace).toContain("!parsed.username");
    expect(workspace).toContain(".slice(0, 250)");
  });

  it("shows the module only in the active platform administrator navigation", () => {
    const navigation = read("src/lib/backoffice-navigation.ts");
    expect(navigation).toContain("canAccessPlatformRadar(input.actor)");
    expect(navigation).toContain('href: "/backoffice/radar"');
    expect(canAccessPlatformRadar(platformAdmin)).toBe(true);
    expect(canAccessPlatformRadar({ ...platformAdmin, status: "disabled" })).toBe(false);
    expect(canAccessPlatformRadar(nexopsAgent)).toBe(false);
    expect(canAccessPlatformRadar(clientA)).toBe(false);
  });
});
