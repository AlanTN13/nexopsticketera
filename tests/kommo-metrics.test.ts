import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseKommoEmbedUrl, requireKommoEmbedUrl } from "@/lib/metrics-embed";
import { getMetricsProfile, resolveMetricsCompanyForActor } from "@/lib/portal-modules";
import type { Company, UserProfile } from "@/lib/ticketing";

const REPORT_URL =
  "https://datastudio.google.com/embed/reporting/00000000-0000-4000-8000-000000000000/page/TestPage";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

function company(id: string, kommoEmbedUrl?: string): Company {
  return {
    id,
    name: `Empresa ${id}`,
    slug: `empresa-${id}`,
    plan: "growth",
    industry: "Servicios",
    status: "active",
    primaryContact: "contacto@example.test",
    modules: {
      support: { enabled: true, settings: {} },
      metrics: { enabled: true, settings: { kommoEmbedUrl } },
      radar: { enabled: false, settings: {} },
      content: { enabled: false, settings: {} },
    },
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("Kommo metrics embed", () => {
  it("accepts only approved HTTPS embed URLs", () => {
    expect(parseKommoEmbedUrl(REPORT_URL)).toBe(REPORT_URL);
    expect(
      parseKommoEmbedUrl(
        "https://lookerstudio.google.com/embed/reporting/report-123/page/Page_1",
      ),
    ).toBe("https://lookerstudio.google.com/embed/reporting/report-123/page/Page_1");

    const rejected = [
      "http://datastudio.google.com/embed/reporting/report/page/page",
      "javascript:alert(1)",
      "<iframe src=\"https://datastudio.google.com\"></iframe>",
      "https://evil.example/embed/reporting/report/page/page",
      "https://sub.datastudio.google.com/embed/reporting/report/page/page",
      "https://datastudio.google.com/reporting/report/page/page/edit",
      "https://datastudio.google.com/embed/u/0/reporting/report/page/page",
      "https://datastudio.google.com/embed/reporting/report/page/page?edit=true",
    ];

    rejected.forEach((value) => expect(parseKommoEmbedUrl(value)).toBeUndefined());
    expect(() => requireKommoEmbedUrl(rejected[0])).toThrow("URL HTTPS de embed válida");
  });

  it("keeps the URL scoped to the configured company and ignores direct tenant lookup", () => {
    const companyA = company("a", REPORT_URL);
    const companyB = company("b");
    const actor: UserProfile = {
      id: "viewer-b",
      companyId: companyB.id,
      name: "Viewer B",
      email: "viewer-b@example.test",
      role: "client_viewer",
      status: "active",
      title: "",
      avatar: "",
      modulePermissions: [
        { companyId: companyB.id, module: "metrics", level: "view" },
      ],
    };

    expect(getMetricsProfile(companyA)?.kommoEmbedUrl).toBe(REPORT_URL);
    expect(getMetricsProfile(companyB)?.kommoEmbedUrl).toBeUndefined();
    expect(resolveMetricsCompanyForActor([companyA, companyB], actor, companyA.id)).toBe(
      companyB,
    );
  });

  it("renders Kommo only when configured and keeps Portal filters/actions separate", () => {
    const workspace = read("src/components/metrics/metrics-workspace.tsx");
    const embed = read("src/components/metrics/kommo-embed.tsx");
    const sync = read("src/components/metrics/metrics-sync-control.tsx");

    expect(workspace).toContain("{kommoEmbedUrl ? (");
    expect(workspace).toContain('onClick={() => setChannel("kommo")}');
    expect(workspace).toContain('channel !== "kommo" ? (');
    expect(workspace).toContain("Kommo no está disponible para esta empresa");
    expect(embed).toContain("Reporte de Kommo no configurado");
    expect(embed).toContain("loading=\"lazy\"");
    expect(embed).toContain("allowFullScreen");
    expect(embed).toContain("allow-storage-access-by-user-activation");
    expect(embed).toContain("w-full max-w-full");
    expect(sync).toContain("Actualizar datos de Meta y Emailing");
    expect(sync).toContain("Kommo usa los controles y datos de su reporte externo");
  });

  it("allows only the two report hosts in frame-src", () => {
    const config = read("next.config.ts");
    const csp = config.match(/"frame-src[^\n]+/)?.[0] ?? "";

    expect(csp).toContain("https://datastudio.google.com");
    expect(csp).toContain("https://lookerstudio.google.com");
    expect(csp).not.toMatch(/frame-src https:(?:\s|\")/);
    expect(csp).not.toContain("*");
  });

  it("keeps Backoffice and database writes platform-admin-only with equivalent validation", () => {
    const form = read("src/components/forms.tsx");
    const store = read("src/lib/app-store.ts");
    const migration = read(
      "supabase/migrations/20260901231851_kommo_metrics_embed.sql",
    );

    expect(form).toContain("Reporte embebido de Kommo");
    expect(form).toContain("if (!canManageAccessControl(actor))");
    expect(store).toContain("requireKommoEmbedUrl(input.kommoEmbedUrl)");
    expect(migration).toContain("private.can_manage_access_control()");
    expect(migration).toContain("private.is_valid_kommo_embed_url");
    expect(migration).toContain("settings - 'kommoEmbedUrl'");
    expect(migration).toContain("settings || jsonb_build_object('kommoEmbedUrl'");
  });
});
