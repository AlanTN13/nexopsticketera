import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260831170000_radar_workspace_configuration.sql",
  ),
  "utf8",
);

describe("Radar workspace migration", () => {
  it("requires a workspace before Radar can be enabled", () => {
    expect(migration).toContain("if radar_enabled and normalized_workspace_id is null");
    expect(migration).toContain("Asigná un workspace antes de habilitar Radar.");
    expect(migration).toContain("jsonb_build_object('workspaceId', normalized_workspace_id)");
  });

  it("keeps the configuration RPC protected by catalog permissions", () => {
    expect(migration).toContain("private.can_manage_global_catalog()");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("revoke all on function");
    expect(migration).toContain("to authenticated");
  });
});
