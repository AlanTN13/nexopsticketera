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

  it("isolates conversation images and exposes only the assignee display name", () => {
    const migration = read("supabase/migrations/20260720120000_comment_attachments_and_safe_assignee.sql");
    expect(migration).toContain("foreign key (comment_id, ticket_id)");
    expect(migration).toContain("c.visibility = 'external' or private.is_internal_user()");
    expect(migration).toContain("c.author_id = (select auth.uid())");
    expect(migration).toContain("c.ticket_id = ticket_attachments.ticket_id");
    expect(migration).toContain("owner_id = (select auth.uid())::text");
    expect(migration).toContain("revoke all on function public.ticket_assignee_display_name(uuid) from public, anon");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("create_ticket_comment_with_attachments");
    expect(read("src/lib/app-store.ts")).toContain('client.rpc(\n    "create_ticket_comment_with_attachments"');
    expect(read("src/lib/app-store.ts")).toContain("remove(uploadedPaths)");
    expect(migration).not.toMatch(/service_role/i);
  });

  it("enforces active profiles and platform-admin-only internal role grants", () => {
    const migration = read(
      "supabase/migrations/20260828120000_harden_active_users_and_role_assignment.sql",
    );

    expect(migration).toContain("alter type public.user_status add value if not exists 'disabled'");
    expect(migration).toContain("and status = 'active'");
    expect(migration).toContain("actor.role = 'platform_admin'");
    expect(migration).toContain("existing.role = target_role and existing.status = target_status");
    expect(migration).toContain('create policy "active users read visible profiles"');
    expect(migration).toContain("create or replace function public.activate_current_user_profile()");
    expect(migration).toContain(
      "revoke all on function public.activate_current_user_profile() from public, anon, authenticated",
    );
  });
});
