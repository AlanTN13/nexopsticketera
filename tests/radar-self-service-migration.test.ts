import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260831185643_radar_self_service_preferences.sql",
  ),
  "utf8",
);
const hardeningMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260831191039_harden_radar_preferences_writer.sql",
  ),
  "utf8",
);

describe("Radar self-service migration", () => {
  it("allows only the owning client admin or a platform admin to update preferences", () => {
    expect(migration).toContain("actor_profile.role <> 'platform_admin'");
    expect(migration).toContain("actor_profile.role <> 'client_admin'");
    expect(migration).toContain("actor_profile.company_id is distinct from target_company_id");
  });

  it("protects automatic publishing behind a real site integration", () => {
    expect(migration).toContain("radar_settings @> '{\"siteIntegrated\": true}'::jsonb");
    expect(migration).toContain("La publicación automática requiere un sitio conectado por NexOps.");
  });

  it("preserves workspace and integration settings while clients change only business preferences", () => {
    const clientUpdate = migration.match(
      /create function public\.update_radar_preferences[\s\S]*?grant execute on function public\.update_radar_preferences/,
    )?.[0];

    expect(clientUpdate).toContain("'topics'");
    expect(clientUpdate).toContain("'publicationsPerWeek'");
    expect(clientUpdate).toContain("'opportunityBehavior'");
    expect(clientUpdate).toContain("'publishingMode'");
    expect(clientUpdate).not.toContain("'workspaceId'");
    expect(clientUpdate).not.toContain("'siteIntegrated', radar_site_integrated");
  });

  it("revokes default execution before granting authenticated access", () => {
    expect(migration).toContain(
      "revoke all on function public.update_radar_preferences(uuid, text[], integer, text, text)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated");
  });

  it("removes the elevated RPC after moving writes into the server data layer", () => {
    expect(hardeningMigration).toContain(
      "drop function if exists public.update_radar_preferences(uuid, text[], integer, text, text)",
    );
  });
});
