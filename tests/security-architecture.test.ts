import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("security architecture", () => {
  it("uses Supabase SSR cookies and has no custom HMAC/demo runtime", () => {
    expect(read("src/lib/supabase-server.ts")).toContain("createServerClient");
    expect(read("src/lib/auth.ts")).toContain("auth.getUser()");
    expect(read("src/lib/auth.ts")).not.toMatch(/createHmac|LOCAL_CLIENT_PASSWORD|nexops_session/);
    expect(read("src/lib/app-store.ts")).not.toMatch(/demoStore|demoSeed|bootstrapSupabase/);
  });

  it("limits service role to the server-only administrative client", () => {
    const serverClient = read("src/lib/supabase-server.ts");
    expect(serverClient).toContain('import "server-only"');
    expect(serverClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(read("src/lib/app-store.ts").match(/getSupabaseAdminClient\(\)/g)).toHaveLength(2);
  });

  it("hardens RLS, grants, private functions and Storage", () => {
    const migration = read("supabase/migrations/20260715174647_harden_ticketing_v1.sql");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("revoke all on all tables in schema public from anon");
    expect(migration).toContain('create policy "ticket attachment upload"');
    expect(migration).toContain("ticket_code_seq");
  });
});
