import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const migration = read("supabase/migrations/20260901115425_nexops_content_phase_1_v2.sql");

describe("NexOps Contenido phase one", () => {
  it("keeps secrets server-only and ties every credential to its tenant connection", () => {
    expect(migration).toContain("create table public.content_meta_credentials");
    expect(migration).toContain("foreign key (connection_id, company_id, workspace_id)");
    expect(migration).toMatch(/revoke all on table[\s\S]*public\.content_meta_credentials[\s\S]*from public, anon, authenticated/);
    expect(migration).not.toMatch(/grant select on table public\.content_meta_credentials to authenticated/);
    expect(read("src/lib/meta-token-crypto.ts")).toContain('import "server-only"');
    expect(read("src/lib/meta-token-crypto.ts")).toContain("aes-256-gcm");
  });

  it("serializes runs, deduplicates request keys and tracks partial work by account", () => {
    expect(migration).toContain("unique (workspace_id, request_key)");
    expect(migration).toContain("content_sync_one_running_idx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("lease_token uuid not null");
    expect(migration).toContain("fence_content_run_accounts");
    expect(migration).toContain("private.content_lease_active");
    expect(migration).toContain("create table public.content_sync_run_accounts");
    expect(migration).toContain("status in ('running','completed','partial','failed')");
  });

  it("preserves publication identity and only snapshots changed metrics", () => {
    expect(migration).toContain("unique (workspace_id, instagram_media_id)");
    expect(migration).toContain("metrics_hash text not null");
    expect(migration).toContain("latest_hash is distinct from target_metrics_hash");
    expect(migration).toContain("on conflict(workspace_id,instagram_media_id) do nothing");
    expect(migration).toContain("check (reach is null or reach >= 0)");
    expect(read("src/lib/content-sync.ts")).toContain("target_metrics_hash: metricsHash");
  });

  it("enforces watchlist capacity transactionally and never ships a scraping fallback", () => {
    expect(migration).toContain("when new.account_kind = 'competitor' then 5 else 3");
    expect(migration).toContain("content_watchlist_capacity");
    const adapter = read("src/lib/meta-instagram.ts");
    expect(adapter).toContain("business_discovery.username");
    expect(adapter).not.toMatch(/cheerio|puppeteer|playwright|scrap/i);
  });

  it("uses exact official read-only scopes and a one-time actor-bound OAuth state", () => {
    const adapter = read("src/lib/meta-instagram.ts");
    for (const scope of ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights"]) {
      expect(adapter).toContain(`"${scope}"`);
    }
    expect(adapter).not.toMatch(/instagram_content_publish|pages_manage_posts|ads_management/);
    expect(migration).toContain("actor_id uuid not null");
    expect(migration).toContain("used_at timestamptz");
    expect(read("src/lib/content-store.ts")).toContain('.eq("actor_id", actor.id)');
    expect(read("src/lib/content-store.ts")).toContain('.is("used_at", null)');
    expect(adapter).toContain('url.searchParams.set("config_id", loginConfigId)');
    expect(adapter).toContain("META_OAUTH_REDIRECT_URI");
  });

  it("installs a protected weekly job but leaves scheduling disabled until smoke", () => {
    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.crons).toContainEqual({ path: "/api/cron/content", schedule: "15 9 * * 1" });
    expect(migration).toContain("scheduled_enabled boolean not null default false");
    expect(read("src/app/api/cron/content/route.ts")).toContain("process.env.CRON_SECRET");
    expect(read("src/lib/content-sync.ts")).toContain('.eq("scheduled_enabled", true)');
  });

  it("resolves explicit workspaces through module authorization instead of trusting browser ids", () => {
    const actions = read("src/app/portal/contenido/actions.ts");
    const store = read("src/lib/content-store.ts");
    expect(actions).not.toContain('formData.get("companyId")');
    expect(store).toContain("getAuthenticatedActor(db)");
    expect(store).toContain("resolveContentCompanyForActor(db.companies, actor, companyLookup)");
    expect(store).toContain('hasModuleAccess(actor, company, "content", requiredLevel)');
    expect(migration).toMatch(/private\.has_module_access\(company_id,\s*'content',\s*'view'\)/);
  });

  it("keeps raw payloads out of authenticated grants and pending selection encrypted with TTL", () => {
    expect(migration).toContain("pending_selection_ciphertext text");
    expect(migration).toContain("pending_expires_at timestamptz");
    expect(migration).toContain("now()+interval '15 minutes'");
    expect(migration).not.toMatch(/grant select on table public\.content_(account_snapshots|instagram_media|media_metric_snapshots) to authenticated/);
    expect(migration).toContain("media_count, created_at) on public.content_account_snapshots");
  });

  it("finalizes connection and credentials transactionally and exposes pause controls", () => {
    expect(migration).toContain("create or replace function public.finalize_content_meta_connection");
    expect(migration).toContain("create or replace function public.set_content_connector_state");
    expect(read("src/lib/content-store.ts")).toContain('admin.rpc("finalize_content_meta_connection"');
    expect(read("src/app/portal/contenido/fuentes/page.tsx")).toContain("setContentConnectorEnabledAction");
  });
});
