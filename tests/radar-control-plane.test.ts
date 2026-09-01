import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { radarCallbackSignature, verifyRadarCallbackSignature } from "@/lib/radar-engine-callback";
import {
  parseRadarCandidate,
  parseRadarManualNoteRequest,
  scheduleLabel,
  type RadarControlSettings,
} from "@/lib/radar-control-plane";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901131322_radar_control_plane_v1.sql"),
  "utf8",
);
const bridgeMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901180902_radar_github_queue_bridge.sql"),
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
const operationPage = readFileSync(
  join(process.cwd(), "src/components/radar/radar-operation-page.tsx"),
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
    expect(migration).toContain("request_kind text not null default 'opportunity_search'");
    expect(migration).toContain("request_payload jsonb not null default '{}'::jsonb");
    expect(migration).toContain("where run_id = run.id and idempotency_key = decision_idempotency_key");
    expect(migration).toContain("create trigger sync_radar_control_setting_after_company_module");
  });

  it("applies view, operate and admin at the database boundary", () => {
    expect(migration).toContain("private.radar_workspace_has_access(workspace_id, 'view')");
    expect(migration).toContain("private.radar_workspace_has_access(target_workspace_id, 'operate')");
    expect(migration).toContain("private.radar_workspace_has_access(target_workspace_id, 'admin')");
    expect(migration).toContain("update_radar_control_preferences");
    expect(migration).toContain("not private.radar_workspace_has_access(run.workspace_id, 'operate')");
    expect(migration).toContain("alter table public.radar_runs enable row level security");
    expect(migration).toContain("revoke all on public.radar_runs from public, anon, authenticated");
    expect(migration).toContain("grant select on public.radar_runs to authenticated");
  });

  it("keeps commercial enablement and publication separate while scheduling only review", () => {
    expect(migration).toContain("if not found or not settings.enabled");
    expect(bridgeMigration).toContain("requested_schedule_days <> array[1, 2, 3, 4, 5, 6]::smallint[]");
    expect(bridgeMigration).toContain("requested_schedule_hour <> 7");
    expect(bridgeMigration).toContain("scheduler_enabled = requested_scheduler_enabled");
    expect(migration).toContain("if request_mode not in ('suggest', 'review')");
    expect(migration).toContain("grant execute on function public.register_platform_radar_workspace(text) to service_role");
    expect(engineClient).toContain("publicationGate: false");
    expect(engineClient).toContain("AlanTN13/radar-history");
    expect(engineClient).toContain("queue/requests/");
    expect(engineClient).toContain('metadata.private !== true');
    expect(engineClient).toContain("RADAR_ENGINE_CALLBACK_SECRET");
    expect(actions).not.toContain("RADAR_PUBLICATION_GATE_ENABLED");
    expect(operationPage).not.toContain("Listo para operar");
    expect(operationPage).toContain("Panel activo · trabajador editorial pendiente");
  });

  it("authorizes every server action before mutation and does not trust a client company id", () => {
    expect(actions.match(/requireRadarWorkspaceAccess\(workspaceId, "operate"\)/g)).toHaveLength(3);
    expect(actions.match(/requireRadarWorkspaceAccess\(workspaceId, "admin"\)/g)).toHaveLength(2);
    expect(actions).not.toContain('formData, "companyId"');
    expect(actions).not.toContain("getSupabaseAdminClient");
  });

  it("signs callbacks and rejects modified bodies", () => {
    const body = JSON.stringify({ status: "running" });
    const timestamp = "1788267600";
    const now = 1_788_267_600_000;
    const secret = "test-secret-that-is-at-least-32-bytes";
    const signature = radarCallbackSignature(body, secret, timestamp);
    expect(verifyRadarCallbackSignature({ body, signature, timestamp, secret, now })).toBe(true);
    expect(verifyRadarCallbackSignature({ body: `${body} `, signature, timestamp, secret, now })).toBe(false);
    expect(verifyRadarCallbackSignature({ body, signature, timestamp, secret, now: now + 301_000 })).toBe(false);
    expect(verifyRadarCallbackSignature({ body, signature: null, timestamp, secret, now })).toBe(false);
    expect(verifyRadarCallbackSignature({ body, signature, timestamp, secret: "x".repeat(31), now })).toBe(false);
    expect(callbackRoute).toContain('request.headers.get("x-radar-signature")');
    expect(callbackRoute).toContain('request.headers.get("x-radar-timestamp")');
    expect(callbackRoute).toContain('request.headers.get("x-radar-delivery-id")');
    expect(callbackRoute).toContain("radarPayloadDigest(result) !== resultDigest");
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
      draft: {
        headline: "Un titular",
        deck: "Una bajada",
        bodyMarkdown: "## Texto\n\nContenido seguro.",
      },
    })).toMatchObject({ score: 88, sourceName: "Fuente oficial", draft: { headline: "Un titular" } });
    expect(parseRadarCandidate({
      title: "Intento de imagen",
      topic: "IA aplicada",
      sourceName: "Fuente oficial",
      sourceUrl: "https://example.org/research",
      score: 88,
      businessReasons: ["No debe pasar"],
      draft: { headline: "Titular", deck: "Bajada", bodyMarkdown: "![portada](https://example.org/image.png)" },
    })).toBeNull();
    expect(parseRadarCandidate({
      title: "Intento interno",
      topic: "IA",
      sourceName: "Local",
      sourceUrl: "http://127.0.0.1/secret",
      score: 90,
      businessReasons: ["No debe salir"],
    })).toBeNull();
  });

  it("accepts only public HTTPS sources for manual notes", () => {
    expect(parseRadarManualNoteRequest({
      title: "Nota urgente",
      sourceUrl: "https://example.org/news",
      instructions: "Enfocar en operaciones.",
    })).toMatchObject({ title: "Nota urgente" });
    expect(parseRadarManualNoteRequest({ sourceUrl: "http://localhost/private" })).toBeNull();
    for (const unsafe of [
      "https://169.254.169.254/latest/meta-data",
      "https://0.0.0.0/internal",
      "https://[fc00::1]/private",
      "https://[fe80::1]/private",
    ]) expect(parseRadarManualNoteRequest({ sourceUrl: unsafe })).toBeNull();
    expect(engineClient).toContain('intent: input.requestKind ?? "opportunity_search"');
    expect(engineClient).toContain("manualNote,");
    expect(engineClient).toContain("requestedAt: new Date(input.requestedAt).toISOString()");
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
      preferences: {
        topics: ["IA aplicada"],
        publicationsPerWeek: 4,
        opportunityBehavior: "suggest",
        publishingMode: "review",
        siteIntegrated: false,
      },
      nextRunAt: null,
    };
    expect(scheduleLabel(settings)).toBe("Pausada · preparada lun a sáb · 07:00–07:59");
  });
});
