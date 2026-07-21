import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("ticket creation idempotency", () => {
  it("enforces one creation key per actor in PostgreSQL", () => {
    const migration = fs.readFileSync(
      path.join(root, "supabase/migrations/20260721120000_ticket_creation_idempotency.sql"),
      "utf8",
    );

    expect(migration).toContain("add column if not exists creation_key uuid");
    expect(migration).toContain("on public.tickets (created_by_id, creation_key)");
  });

  it("uses the actor and creation key conflict as the server-side retry boundary", () => {
    const store = fs.readFileSync(path.join(root, "src/lib/app-store.ts"), "utf8");

    expect(store).toContain('onConflict: "created_by_id,creation_key"');
    expect(store).toContain('ignoreDuplicates: true');
    expect(store).toContain('.eq("creation_key", input.idempotencyKey)');
  });
});
