import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260831150827_company_module_entitlements.sql",
  ),
  "utf8",
);

describe("company module migration", () => {
  it("keeps module settings separate from availability updates", () => {
    const updateClause = migration.match(
      /on conflict \(company_id, module\) do update[\s\S]*?end\n+\$\$;/,
    )?.[0];

    expect(updateClause).toContain("set enabled = excluded.enabled");
    expect(updateClause).not.toContain("settings =");
  });

  it("starts Radar disabled and preserves Global Trip metrics", () => {
    expect(migration).toContain("available.module = 'metrics' and company.slug = 'global-trip'");
    expect(migration).toContain("cross join (values ('metrics'), ('radar'))");
  });

  it("limits writes to global catalog managers", () => {
    expect(migration).toContain("private.can_manage_global_catalog()");
    expect(migration).toContain('create policy "catalog managers update company modules"');
  });
});
