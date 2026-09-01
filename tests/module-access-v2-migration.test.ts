import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901002826_company_module_access_v2.sql"),
  "utf8",
);

describe("module access V2 migration", () => {
  it("creates the normalized access model and keeps settings", () => {
    expect(migration).toContain("create table public.portal_modules");
    expect(migration).toContain("create table public.user_company_assignments");
    expect(migration).toContain("create table public.user_module_permissions");
    expect(migration).toContain("create table public.access_audit_log");
    expect(migration).toContain("foreign key (company_id, module)");
    expect(migration).toContain("check (access_level in ('view', 'operate', 'admin'))");
    expect(migration).not.toMatch(/set settings = '\{\}'/);
  });

  it("backfills support without inventing internal metrics or radar access", () => {
    expect(migration).toContain("module.key = 'support'");
    expect(migration).toContain("case internal_user.role when 'team_lead' then 'admin' else 'operate' end");
    const internalBackfill = migration.match(
      /insert into public\.user_module_permissions[\s\S]*?from public\.user_company_assignments[\s\S]*?on conflict \(user_id, company_id, module\) do nothing;/,
    )?.[0] ?? "";
    expect(internalBackfill).toContain("'support'");
    expect(internalBackfill).not.toContain("'metrics'");
    expect(internalBackfill).not.toContain("'radar'");
  });

  it("separates tenant access from module levels across RLS and Storage", () => {
    expect(migration).toContain("create or replace function private.can_access_company");
    expect(migration).toContain("create or replace function private.has_module_access");
    expect(migration).toContain("private.has_module_access(company_id, 'support', 'view')");
    expect(migration).toContain("private.has_module_access(company_id, 'support', 'operate')");
    expect(migration).toContain("on storage.objects for select to authenticated");
    expect(migration).toContain("on storage.objects for insert to authenticated");
    expect(migration).toContain("attachment.comment_id is null");
    expect(migration).toContain("comment.visibility = 'external'");
    expect(migration).toContain("owner_id = (select auth.uid())::text");
  });

  it("keeps the control plane platform-admin-only and blocks direct writes", () => {
    expect(migration).toContain("create or replace function private.can_manage_access_control");
    expect(migration).toContain("Sólo un administrador de plataforma puede cambiar accesos");
    expect(migration).toContain("revoke all on public.user_company_assignments from public, anon, authenticated");
    expect(migration).toContain("revoke all on public.user_module_permissions from public, anon, authenticated");
    expect(migration).not.toContain("grant insert on public.user_module_permissions to authenticated");
    expect(migration).toContain("create function public.update_radar_preferences");
    expect(migration).toContain("private.has_module_access(target_company_id, 'radar', 'admin')");
    expect(migration).toContain("not private.has_module_access(actor_profile.company_id, 'support', 'operate')");
    expect(migration).not.toContain("grant execute on function private.user_has_module_access(uuid, uuid, text, text) to authenticated");
    expect(migration).toMatch(
      /create or replace function public\.support_assignee_ids[\s\S]*?where private\.is_internal_user\(\)/,
    );
  });

  it("keeps the deployed V1 entitlement RPCs as V2-authorized rollout adapters", () => {
    expect(migration).toMatch(
      /create or replace function public\.update_company_module_availability[\s\S]*?perform public\.set_company_modules/,
    );
    expect(migration).toMatch(
      /create or replace function public\.update_company_module_configuration[\s\S]*?perform public\.set_company_modules/,
    );
    expect(migration).toContain("Adaptador de compatibilidad V1");
    expect(migration).toContain(
      "revoke all on function public.update_company_module_configuration(uuid, boolean, boolean, text, boolean)",
    );
  });

  it("binds profile and company management to the internal assignment", () => {
    expect(migration).toContain("create or replace function private.can_manage_profile");
    expect(migration).toContain("private.can_access_company(target_company_id)");
    expect(migration).toContain('create policy "assigned catalog managers update companies"');
    expect(migration).toContain('create policy "platform admins delete companies"');
  });

  it("audits access changes with the authenticated actor and immutable table grants", () => {
    expect(migration).toContain("create or replace function private.audit_access_control_write");
    expect(migration).toContain("actor_id uuid := (select auth.uid())");
    expect(migration).toContain("current_setting('nexops.access_reason', true)");
    expect(migration).toContain("revoke all on public.access_audit_log from public, anon, authenticated");
    expect(migration).toContain("grant select on public.access_audit_log to authenticated");
    expect(migration).not.toContain("grant insert on public.access_audit_log");
    expect(migration).toContain("revoke all on public.access_audit_log from service_role");
    expect(migration).toContain("create trigger reject_access_audit_mutation");
  });
});
