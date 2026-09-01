import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { radarCallbackSignature, verifyRadarCallbackSignature } from "@/lib/radar-engine-callback";
import {
  parseRadarCandidate,
  scheduleLabel,
  type RadarControlSettings,
} from "@/lib/radar-control-plane";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901131322_radar_control_plane_v1.sql"),
  "utf8",
);
const actions = readFileSync(
  join(process.cwd(), "src/app/portal/radar/operacion/actions.ts"),
  "utf8",
);
const engineClient = readFileSync(
  join(process.cwd(), "src/lib/radar-engine-client.ts"),
  "utf8",
);
const callbackRoute = readFileSync(
  join(process.cwd(), "src/app/api/radar/runs/[runId]/events/route.ts"),
  "utf8",
);

describe("Radar Control Plane V1", () => {
  it("uses durable workspace-scoped requests with idempotency and one active run", () => {
    expect(migration).toContain("create table public.radar_control_settings");
    expect(migration).toContain("create table public.radar_runs");
    expect(migration).toContain("create table public.radar_run_events");
    expect(migration).toContain("create table public.radar_run_decisions");
    expect(migration).toContain("constraint radar_runs_idempotency unique (workspace_id, idempotency_key)");
    expect(migration).toContain("create unique index radar_runs_workspace_active_uq");
    expect(migration).toContain("where run_id = run.id and idempotency_key = decision_idempotency_key");
    expect(migration).toContain("create trigger sync_radar_control_setting_after_company_module");
  });

  it("applies view, operate and admin at the database boundary", () => {
    expect(migration).toContain("private.radar_workspace_has_access(workspace_id, 'view')");
    expect(migration).toContain("private.radar_workspace_has_access(target_workspace_id, 'operate')");
    expect(migration).toContain("private.radar_workspace_has_access(target_workspace_id, 'admin')");
    expect(migration).toContain("not private.radar_workspace_has_access(run.workspace_id, 'operate')");
    expect(migration).toContain("alter table public.radar_runs enable row level security");
    expect(migration).toContain("revoke all on public.radar_runs from public, anon, authenticated");
    expect(migration).toContain("grant select on public.radar_runs to authenticated");
  });

  it("keeps commercial enablement, production scheduling and publication behind separate gates", () => {
    expect(migration).toContain("if not found or not settings.enabled");
    expect(migration).toContain("if requested_scheduler_enabled then");
    expect(migration).toContain("El scheduler productivo requiere un gate separado.");
    expect(migration).toContain("if request_mode not in ('suggest', 'review')");
    expect(migration).toContain("grant execute on function public.register_platform_radar_workspace(text) to service_role");
    expect(engineClient).toContain("publicationGate: false");
    expect(engineClient).toContain("RADAR_ENGINE_CALLBACK_SECRET");
    expect(actions).not.toContain("RADAR_PUBLICATION_GATE_ENABLED");
  });

  it("authorizes every server action before mutation and does not trust a client company id", () => {
    expect(actions.match(/requireRadarWorkspaceAccess\(workspaceId, "operate"\)/g)).toHaveLength(2);
    expect(actions).toContain('requireRadarWorkspaceAccess(workspaceId, "admin")');
    expect(actions).not.toContain('formData, "companyId"');
    expect(actions).not.toContain("getSupabaseAdminClient");
  });

  it("signs callbacks and rejects modified bodies", () => {
    const body = JSON.stringify({ status: "running" });
    const signature = radarCallbackSignature(body, "test-secret");
    expect(verifyRadarCallbackSignature(body, signature, "test-secret")).toBe(true);
    expect(verifyRadarCallbackSignature(`${body} `, signature, "test-secret")).toBe(false);
    expect(verifyRadarCallbackSignature(body, null, "test-secret")).toBe(false);
    expect(callbackRoute).toContain('request.headers.get("x-radar-signature")');
    expect(callbackRoute).toContain("isSafeHttpsUrl(externalRunUrl)");
  });

  it("projects only safe candidates", () => {
    expect(parseRadarCandidate({
      title: "Agentes con controles operativos",
      topic: "IA aplicada",
      sourceName: "Fuente oficial",
      sourceUrl: "https://example.org/research",
      score: 88,
      businessReasons: ["Alta relevancia comercial"],
    })).toMatchObject({ score: 88, sourceName: "Fuente oficial" });
    expect(parseRadarCandidate({
      title: "Intento interno",
      topic: "IA",
      sourceName: "Local",
      sourceUrl: "http://127.0.0.1/secret",
      score: 90,
      businessReasons: ["No debe salir"],
    })).toBeNull();
  });

  it("keeps the scheduler visibly paused", () => {
    const settings: RadarControlSettings = {
      workspaceId: "nexops",
      companyId: null,
      enabled: true,
      schedulerEnabled: false,
      scheduleDays: [1, 2, 3, 4, 5, 6],
      scheduleHour: 7,
      scheduleTimezone: "America/Argentina/Buenos_Aires",
      autonomyMode: "review",
      nextRunAt: null,
    };
    expect(scheduleLabel(settings)).toBe("Pausada · preparada lun a sáb · 07:00–07:59");
  });
});
