import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/20260828130000_data_integrity_boundary.sql");
const revocations = read("supabase/migrations/20260828140000_revoke_direct_data_writes.sql");

describe("data integrity boundary", () => {
  it("removes direct authenticated writes that could forge workflow and history", () => {
    expect(revocations).toContain("revoke insert, update on public.tickets from authenticated");
    expect(revocations).toContain("revoke insert on public.ticket_comments from authenticated");
    expect(revocations).toContain("revoke insert on public.ticket_attachments from authenticated");
    expect(revocations).toContain("revoke insert on public.ticket_history from authenticated");
    expect(revocations).toContain("revoke insert, update on public.users from authenticated");
    expect(revocations).toContain("additive DB -> application deploy -> destructive grants cutover");
  });

  it("derives ticket ownership and initial workflow inside a restricted RPC", () => {
    expect(migration).toContain("create or replace function public.create_ticket_with_history");
    expect(migration).toContain("where id = (select auth.uid())");
    expect(migration).toContain("actor_profile.company_id");
    expect(migration).toContain("'medium', 'new', actor_profile.id, null, request_creation_key");
    expect(migration).toContain("role not in ('client_admin', 'client_operator')");
    expect(migration).toMatch(/revoke all on function public\.create_ticket_with_history[\s\S]+from public, anon/);
  });

  it("updates workflow and its audit history atomically and rejects client assignees", () => {
    expect(migration).toContain("create or replace function public.update_ticket_workflow_with_history");
    expect(migration).toContain("role in ('agent', 'team_lead', 'platform_admin')");
    expect(migration).toContain("company_id is null");
    expect(migration).toContain("for update");
    expect(migration).toContain("status_history_id := gen_random_uuid()");

    const store = read("src/lib/app-store.ts");
    expect(store).toContain('client.rpc(\n    "update_ticket_workflow_with_history"');
    expect(store).not.toMatch(/\.from\("ticket_history"\)\s*\.insert/);
  });

  it("enforces image limits in both Storage and attachment metadata", () => {
    expect(migration).toContain("file_size_limit = 10485760");
    expect(migration).toContain("allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]");
    expect(migration).toContain("size_bytes between 1 and 10485760");
    expect(migration).toContain("create or replace function public.register_ticket_attachment");
    expect(migration).toContain("owner_id = actor_profile.id::text");

    const store = read("src/lib/app-store.ts");
    expect(store).toContain("await validateTicketImages(input.attachments)");
    expect(store).toContain('client.rpc("register_ticket_attachment"');
  });

  it("keeps privileged profile writes behind explicit server authorization", () => {
    const store = read("src/lib/app-store.ts");
    expect(store).toContain("if (!canAssignUserRole(actor, input.companyId, input.role))");
    expect(store).toContain("if (!canChangeUserRole(actor, target, input.role))");
    expect(store).toContain("const adminClient = getSupabaseAdminClient()");
    expect(store).toContain('adminClient\n    .from("users")');
    expect(store).toContain('type: "invite"');
    expect(store).toContain("sendAccountInvitationEmail");
    expect(store).toContain('["active", "invited", "disabled"] as const');
    expect(store).toContain('status: "invited"');
    expect(store).toContain("status: input.status");
    expect(store).not.toContain("email_confirm: true");
  });
});
