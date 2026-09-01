import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("metrics daily snapshots", () => {
  it("keeps snapshots server-only and protected by RLS", () => {
    const migration = read("supabase/migrations/20260831203428_metrics_daily_snapshots.sql");

    expect(migration).toContain("create table public.metrics_source_snapshots");
    expect(migration).toContain("alter table public.metrics_source_snapshots enable row level security");
    expect(migration).toContain(
      "revoke all on table public.metrics_source_snapshots from public, anon, authenticated",
    );
    expect(migration).toContain("to service_role");
  });

  it("enforces the cooldown and serializes concurrent refreshes in Postgres", () => {
    const migration = read("supabase/migrations/20260831203428_metrics_daily_snapshots.sql");

    expect(migration).toContain("for update");
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("claim_metrics_refresh");
  });

  it("preserves the last valid source when a refresh fails", () => {
    const sync = read("src/lib/metrics-sync.ts");

    expect(sync).toContain("Promise.allSettled");
    expect(sync).toContain("content: current?.content ?? null");
    expect(sync).toContain("fetched_at: current?.fetchedAt ?? null");
  });

  it("schedules the daily refresh for 00:05 Argentina and protects the endpoint", () => {
    const vercel = JSON.parse(read("vercel.json"));
    const route = read("src/app/api/cron/metrics/route.ts");

    expect(vercel.crons).toContainEqual({
      path: "/api/cron/metrics",
      schedule: "5 3 * * *",
    });
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("Bearer ${secret}");
  });

  it("offers a client refresh without exposing company identifiers", () => {
    const action = read("src/app/portal/metricas/actions.ts");
    const control = read("src/components/metrics/metrics-sync-control.tsx");

    expect(action).toContain("getAuthenticatedActor(db)");
    expect(action).toContain("resolveMetricsCompanyForActor(db.companies, actor, companyLookup)");
    expect(action).toContain("companyId: company.id");
    expect(action).not.toContain('formData.get("companyId")');
    expect(control).toContain("Actualizar datos");
    expect(control).toContain("una vez por minuto");
  });
});
