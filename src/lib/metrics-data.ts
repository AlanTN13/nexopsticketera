import "server-only";

import { parseMailchimpCSV, parseSheetCSV } from "@/features/metrics/csv-parser";
import {
  parseMetricsClientSource,
  parseMetricsStrategySource,
  type MetricsClientSource,
} from "@/features/metrics/strategy-parser";
import type { MailchimpCampaignRow, SheetRow, StrategyEntry } from "@/features/metrics/types";
import { getMetaSheetSourceUrl, getMetricsSnapshot } from "@/lib/metrics-sync";
import type { MetaSourceStatus } from "@/lib/metrics-source-status";
import type { MetricsSourceSnapshot, MetricsSyncState } from "@/lib/metrics-sync";
import type { MetricsCompanyProfile } from "@/lib/portal-modules";

export type MetricsData = {
  metaRows: SheetRow[];
  metaStatus: MetaSourceStatus;
  mailchimpRows: MailchimpCampaignRow[];
  loadedAt: string | null;
  latestDataDate: string | null;
  warnings: string[];
  clientSource: MetricsClientSource | null;
  strategyEntries: StrategyEntry[];
  sync: MetricsSyncState | null;
};

function sameAccount(value: string, expected: string) {
  return value.trim().toLocaleLowerCase("es") === expected.trim().toLocaleLowerCase("es");
}

function latestDate(metaRows: SheetRow[], mailchimpRows: MailchimpCampaignRow[]) {
  const values = [
    ...metaRows.map((row) => row.day),
    ...mailchimpRows.map((row) => row.sendDate),
  ].filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  return values.sort().at(-1) ?? null;
}

function latestSnapshotDate(snapshots: MetricsSourceSnapshot[]) {
  return snapshots
    .map((snapshot) => snapshot.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function snapshotByType(snapshots: MetricsSourceSnapshot[]) {
  return new Map(snapshots.map((snapshot) => [snapshot.sourceType, snapshot]));
}

function addSnapshotWarning(
  warnings: string[],
  snapshot: MetricsSourceSnapshot | undefined,
  fallback: string,
) {
  if (snapshot?.status === "error") {
    warnings.push(snapshot.lastError ?? fallback);
  }
}

export function parseMetricsSnapshots(
  profile: MetricsCompanyProfile,
  snapshots: MetricsSourceSnapshot[],
  sync: MetricsSyncState | null,
): MetricsData {
  const warnings: string[] = [];
  const byType = snapshotByType(snapshots);
  const clients = byType.get("clients");
  const strategy = byType.get("strategy");
  const metaSourceUrl = getMetaSheetSourceUrl(profile);
  const savedMeta = byType.get("meta");
  // Ignore snapshots from a removed/replaced source, even before the next sync.
  const meta = metaSourceUrl && savedMeta?.sourceUrl === metaSourceUrl ? savedMeta : undefined;
  const mailchimp = byType.get("mailchimp");

  const clientSource = clients?.content
    ? parseMetricsClientSource(clients.content, profile.accountName)
    : null;
  if (clients?.content && !clientSource) {
    warnings.push("La cuenta no aparece en la fuente de clientes.");
  }

  const strategyEntries = strategy?.content
    ? parseMetricsStrategySource(strategy.content, profile.accountName, profile.accountName)
    : [];
  const metaRows = profile.metaAdsEnabled !== false && meta?.content
    ? parseSheetCSV(meta.content).filter((row) => sameAccount(row.accountName, profile.accountName))
    : [];
  const metaStatus: MetaSourceStatus = profile.metaAdsEnabled === false
    ? "disabled"
    : !metaSourceUrl
      ? "unconfigured"
      : meta?.status === "error"
        ? metaRows.length ? "stale" : "error"
        : !meta || meta.content === null
          ? "pending"
          : metaRows.length ? "ready" : "empty";
  const mailchimpRows = mailchimp?.content
    ? parseMailchimpCSV(mailchimp.content).rows.filter(
        (row) =>
          sameAccount(row.accountName, profile.mailchimpName ?? profile.accountName) ||
          sameAccount(row.audience, profile.mailchimpName ?? profile.accountName),
      )
    : [];

  addSnapshotWarning(warnings, clients, "No se pudo actualizar la cuenta.");
  addSnapshotWarning(warnings, strategy, "No se pudo actualizar la estrategia.");
  if (profile.metaAdsEnabled !== false) {
    addSnapshotWarning(warnings, meta, "No se pudo actualizar Meta Ads.");
  }
  addSnapshotWarning(warnings, mailchimp, "No se pudo actualizar Emailing.");

  if (
    profile.metaAdsEnabled !== false &&
    !metaSourceUrl
  ) {
    warnings.push("La fuente de Meta Ads todavía no está configurada en este entorno.");
  }

  return {
    metaRows,
    metaStatus,
    mailchimpRows,
    loadedAt: sync?.lastSuccessAt ?? latestSnapshotDate(snapshots),
    latestDataDate: latestDate(metaRows, mailchimpRows),
    warnings: [...new Set(warnings)],
    clientSource,
    strategyEntries,
    sync,
  };
}

export async function loadMetricsData(
  companyId: string,
  profile: MetricsCompanyProfile,
): Promise<MetricsData> {
  const { snapshots, sync } = await getMetricsSnapshot(companyId);
  return parseMetricsSnapshots(profile, snapshots, sync);
}
