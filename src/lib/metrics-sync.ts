import "server-only";

import type { PortalModuleSettings } from "@/lib/ticketing";
import { getMetricsProfile, type MetricsCompanyProfile } from "@/lib/portal-modules";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const METRICS_SOURCE_TYPES = ["clients", "strategy", "meta", "mailchimp"] as const;
export type MetricsSourceType = (typeof METRICS_SOURCE_TYPES)[number];
export type MetricsRefreshTrigger = "manual" | "scheduled" | "bootstrap";

export type MetricsSourceSnapshot = {
  sourceType: MetricsSourceType;
  sourceUrl: string;
  content: string | null;
  status: "ready" | "error";
  fetchedAt: string | null;
  lastError: string | null;
};

export type MetricsSyncState = {
  status: "idle" | "running" | "ready" | "error";
  lastTrigger: MetricsRefreshTrigger | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

type SourceDefinition = {
  sourceType: MetricsSourceType;
  url: URL;
  label: string;
};

type SourceSnapshotRow = {
  source_type: MetricsSourceType;
  source_url: string;
  content: string | null;
  status: "ready" | "error";
  fetched_at: string | null;
  last_error: string | null;
};

type SyncStateRow = {
  status: MetricsSyncState["status"];
  last_trigger: MetricsRefreshTrigger | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

const ALLOWED_SHEET_HOSTS = new Set(["docs.google.com"]);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message.slice(0, 1000) : fallback;
}

function getSheetUrl(rawValue: string | undefined, name: string) {
  const raw = rawValue?.trim();
  if (!raw) return null;

  const url = new URL(raw);
  if (url.protocol !== "https:" || !ALLOWED_SHEET_HOSTS.has(url.hostname)) {
    throw new Error(`${name} debe ser una URL HTTPS publicada por Google Sheets.`);
  }
  return url;
}

export function getConfiguredMetricsSources(profile: MetricsCompanyProfile): SourceDefinition[] {
  const candidates: Array<[MetricsSourceType, string | undefined, string]> = [
    ["clients", profile.clientsSheetUrl, "clientes y cuentas"],
    ["strategy", profile.strategySheetUrl, "bitácora y estrategia"],
    ["meta", profile.metaSheetUrl ?? process.env.PORTAL_METRICS_META_SHEET_URL, "Meta Ads"],
    [
      "mailchimp",
      profile.mailchimpSheetUrl ?? process.env.PORTAL_METRICS_MAILCHIMP_SHEET_URL,
      "Emailing",
    ],
  ];

  return candidates.flatMap(([sourceType, rawUrl, label]) => {
    const url = getSheetUrl(rawUrl, `La fuente de ${label}`);
    return url ? [{ sourceType, url, label }] : [];
  });
}

async function fetchCsv(source: SourceDefinition) {
  const response = await fetch(source.url, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain;q=0.9",
      "User-Agent": "NexOps-Portal-Metrics/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${source.label} (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/") && !contentType.includes("csv")) {
    throw new Error(`La fuente de ${source.label} no devolvió CSV.`);
  }

  return response.text();
}

function mapSnapshot(row: SourceSnapshotRow): MetricsSourceSnapshot {
  return {
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    content: row.content,
    status: row.status,
    fetchedAt: row.fetched_at,
    lastError: row.last_error,
  };
}

function mapSyncState(row: SyncStateRow | null): MetricsSyncState | null {
  return row
    ? {
        status: row.status,
        lastTrigger: row.last_trigger,
        lastAttemptAt: row.last_attempt_at,
        lastSuccessAt: row.last_success_at,
        lastError: row.last_error,
      }
    : null;
}

export async function getMetricsSnapshot(companyId: string) {
  const client = getSupabaseAdminClient();
  const [snapshotsResult, syncResult] = await Promise.all([
    client
      .from("metrics_source_snapshots")
      .select("source_type, source_url, content, status, fetched_at, last_error")
      .eq("company_id", companyId),
    client
      .from("metrics_sync_state")
      .select("status, last_trigger, last_attempt_at, last_success_at, last_error")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (snapshotsResult.error) throw new Error(snapshotsResult.error.message);
  if (syncResult.error) throw new Error(syncResult.error.message);

  return {
    snapshots: ((snapshotsResult.data ?? []) as SourceSnapshotRow[]).map(mapSnapshot),
    sync: mapSyncState(syncResult.data as SyncStateRow | null),
  };
}

async function markRefreshFailed(companyId: string, error: unknown) {
  const client = getSupabaseAdminClient();
  await client
    .from("metrics_sync_state")
    .update({
      status: "error",
      refresh_started_at: null,
      last_error: errorMessage(error, "No se pudieron actualizar las métricas."),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);
}

export async function refreshMetricsSources(input: {
  companyId: string;
  profile: MetricsCompanyProfile;
  trigger: MetricsRefreshTrigger;
  requestedBy?: string | null;
}) {
  const client = getSupabaseAdminClient();
  const { data: claimData, error: claimError } = await client.rpc("claim_metrics_refresh", {
    target_company_id: input.companyId,
    target_trigger: input.trigger,
    target_requested_by: input.requestedBy ?? null,
  });

  if (claimError) throw new Error(claimError.message);
  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  if (!claim?.acquired) {
    return {
      refreshed: false,
      retryAfterSeconds: Number(claim?.retry_after_seconds ?? 60),
      errors: [] as string[],
    };
  }

  try {
    const sources = getConfiguredMetricsSources(input.profile);
    if (!sources.length) {
      throw new Error("Esta empresa todavía no tiene fuentes de métricas configuradas.");
    }

    const { snapshots: currentSnapshots } = await getMetricsSnapshot(input.companyId);
    const currentByType = new Map(currentSnapshots.map((snapshot) => [snapshot.sourceType, snapshot]));
    const results = await Promise.allSettled(sources.map(fetchCsv));
    const now = new Date().toISOString();
    const errors: string[] = [];
    let successfulSources = 0;

    const rows = results.map((result, index) => {
      const source = sources[index];
      const current = currentByType.get(source.sourceType);
      if (result.status === "fulfilled") {
        successfulSources += 1;
        return {
          company_id: input.companyId,
          source_type: source.sourceType,
          source_url: source.url.toString(),
          content: result.value,
          status: "ready",
          fetched_at: now,
          last_error: null,
          updated_at: now,
        };
      }

      const message = errorMessage(result.reason, `No se pudo actualizar ${source.label}.`);
      errors.push(message);
      return {
        company_id: input.companyId,
        source_type: source.sourceType,
        source_url: source.url.toString(),
        content: current?.content ?? null,
        status: "error",
        fetched_at: current?.fetchedAt ?? null,
        last_error: message,
        updated_at: now,
      };
    });

    const { error: snapshotError } = await client
      .from("metrics_source_snapshots")
      .upsert(rows, { onConflict: "company_id,source_type" });
    if (snapshotError) throw new Error(snapshotError.message);

    const stateUpdate: Record<string, unknown> = {
      status: successfulSources > 0 ? "ready" : "error",
      refresh_started_at: null,
      last_error: errors.length ? errors.join(" ").slice(0, 1000) : null,
      updated_at: now,
    };
    if (successfulSources > 0) stateUpdate.last_success_at = now;

    const { error: stateError } = await client
      .from("metrics_sync_state")
      .update(stateUpdate)
      .eq("company_id", input.companyId);
    if (stateError) throw new Error(stateError.message);

    return { refreshed: true, retryAfterSeconds: 0, errors };
  } catch (error) {
    await markRefreshFailed(input.companyId, error);
    throw error;
  }
}

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metricsSettings(value: unknown): PortalModuleSettings["metrics"] {
  const settings = objectSettings(value);
  const objective = settings.objective;
  return {
    accountName: optionalString(settings.accountName),
    mailchimpName: optionalString(settings.mailchimpName),
    clientsSheetUrl: optionalString(settings.clientsSheetUrl),
    strategySheetUrl: optionalString(settings.strategySheetUrl),
    metaSheetUrl: optionalString(settings.metaSheetUrl),
    mailchimpSheetUrl: optionalString(settings.mailchimpSheetUrl),
    objective:
      objective === "CONVERSACIONES" || objective === "LEADS" || objective === "COMPRAS"
        ? objective
        : undefined,
  };
}

export async function refreshAllMetricsCompanies() {
  const client = getSupabaseAdminClient();
  const { data: modules, error: modulesError } = await client
    .from("company_modules")
    .select("company_id, settings")
    .eq("module", "metrics")
    .eq("enabled", true);
  if (modulesError) throw new Error(modulesError.message);

  const companyIds = (modules ?? []).map((module) => String(module.company_id));
  if (!companyIds.length) return [];

  const { data: companies, error: companiesError } = await client
    .from("companies")
    .select("id, name, slug")
    .in("id", companyIds);
  if (companiesError) throw new Error(companiesError.message);

  const companyById = new Map((companies ?? []).map((company) => [String(company.id), company]));
  return Promise.all(
    (modules ?? []).map(async (module) => {
      const company = companyById.get(String(module.company_id));
      if (!company) return { companyId: String(module.company_id), refreshed: false, missing: true };
      const profile = getMetricsProfile({
        id: String(company.id),
        name: String(company.name),
        slug: String(company.slug),
        plan: "starter",
        industry: "",
        status: "active",
        primaryContact: "",
        createdAt: "",
        modules: {
          support: { enabled: false, settings: {} },
          metrics: { enabled: true, settings: metricsSettings(module.settings) },
          radar: { enabled: false, settings: {} },
          content: { enabled: false, settings: {} },
        },
      });
      if (!profile) return { companyId: String(company.id), refreshed: false, missing: true };

      try {
        const result = await refreshMetricsSources({
          companyId: String(company.id),
          profile,
          trigger: "scheduled",
        });
        return { companyId: String(company.id), ...result };
      } catch (error) {
        return {
          companyId: String(company.id),
          refreshed: false,
          error: errorMessage(error, "No se pudieron actualizar las métricas."),
        };
      }
    }),
  );
}
