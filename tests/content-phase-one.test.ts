import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const migration = read("supabase/migrations/20260901001244_nexops_content_phase_1.sql");

describe("NexOps Contenido phase one", () => {
  it("keeps secrets server-only and ties every credential to its tenant connection", () => {
    expect(migration).toContain("create table public.content_meta_credentials");
    expect(migration).toContain("foreign key (connection_id, company_id)");
    expect(migration).toContain("revoke all on table public.content_meta_credentials from public, anon, authenticated");
    expect(migration).not.toMatch(/grant select on table public\.content_meta_credentials to authenticated/);
    expect(read("src/lib/meta-token-crypto.ts")).toContain('import "server-only"');
    expect(read("src/lib/meta-token-crypto.ts")).toContain("aes-256-gcm");
  });

  it("serializes runs, deduplicates request keys and tracks partial work by account", () => {
    expect(migration).toContain("unique (workspace_id, request_key)");
    expect(migration).toContain("content_sync_runs_one_active_company_idx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("create table public.content_sync_run_accounts");
    expect(migration).toContain("status in ('running', 'completed', 'partial', 'failed')");
  });

  it("preserves publication identity and only snapshots changed metrics", () => {
    expect(migration).toContain("unique (workspace_id, instagram_media_id)");
    expect(migration).toContain("metrics_hash text not null");
    const sync = read("src/lib/content-sync.ts");
    expect(sync).toContain("latest.metrics_hash !== metricsHash");
    expect(sync).toContain("first_observed_at: input.observedAt");
    expect(sync).toContain("last_observed_at: input.observedAt");
    expect(sync).toContain("?? null");
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
  });

  it("installs a protected weekly job but leaves scheduling disabled until smoke", () => {
    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.crons).toContainEqual({ path: "/api/cron/content", schedule: "15 9 * * 1" });
    expect(migration).toContain("scheduled_enabled boolean not null default false");
    expect(read("src/app/api/cron/content/route.ts")).toContain("process.env.CRON_SECRET");
    expect(read("src/lib/content-sync.ts")).toContain('.eq("scheduled_enabled", true)');
  });

  it("derives mutations from the authenticated workspace instead of browser company ids", () => {
    const actions = read("src/app/portal/contenido/actions.ts");
    const store = read("src/lib/content-store.ts");
    expect(actions).not.toContain('formData.get("companyId")');
    expect(store).toContain("getAuthenticatedActor(db)");
    expect(store).toContain("resolveContentCompanyForActor(db.companies, actor)");
  });
});
