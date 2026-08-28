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

  it("delegates the actor and creation key retry boundary to the hardened RPC", () => {
    const store = fs.readFileSync(path.join(root, "src/lib/app-store.ts"), "utf8");
    const migration = fs.readFileSync(
      path.join(root, "supabase/migrations/20260828130000_data_integrity_boundary.sql"),
      "utf8",
    );

    expect(store).toContain('client.rpc(\n    "create_ticket_with_history"');
    expect(store).toContain("request_creation_key: input.idempotencyKey");
    expect(migration).toContain("on conflict (created_by_id, creation_key) do nothing");
    expect(migration).toContain("where created_by_id = actor_profile.id");
    expect(migration).toContain("and creation_key = request_creation_key");
    expect(migration).toContain("'created', inserted_ticket");
    expect(store).toContain("if (rpcResult.created)");
  });
});
