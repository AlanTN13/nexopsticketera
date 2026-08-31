import "server-only";

import { parseMailchimpCSV, parseSheetCSV } from "@/features/metrics/csv-parser";
import {
  parseMetricsClientSource,
  parseMetricsStrategySource,
  type MetricsClientSource,
} from "@/features/metrics/strategy-parser";
import { MailchimpCampaignRow, SheetRow, StrategyEntry } from "@/features/metrics/types";
import { MetricsCompanyProfile } from "@/lib/portal-modules";

type MetricsData = {
  metaRows: SheetRow[];
  mailchimpRows: MailchimpCampaignRow[];
  loadedAt: string;
  latestDataDate: string | null;
  warnings: string[];
  clientSource: MetricsClientSource | null;
  strategyEntries: StrategyEntry[];
};

const ALLOWED_SHEET_HOSTS = new Set(["docs.google.com"]);

function getSheetUrl(rawValue: string | undefined, name: string) {
  const raw = rawValue?.trim();
  if (!raw) return null;

  const url = new URL(raw);
  if (url.protocol !== "https:" || !ALLOWED_SHEET_HOSTS.has(url.hostname)) {
    throw new Error(`${name} debe ser una URL HTTPS publicada por Google Sheets.`);
  }
  return url;
}

async function fetchCsv(url: URL, label: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,text/plain;q=0.9",
      "User-Agent": "NexOps-Portal-Metrics/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${label} (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/") && !contentType.includes("csv")) {
    throw new Error(`La fuente de ${label} no devolvió CSV.`);
  }

  return response.text();
}

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

export async function loadMetricsData(profile: MetricsCompanyProfile): Promise<MetricsData> {
  const warnings: string[] = [];
  let metaRows: SheetRow[] = [];
  let mailchimpRows: MailchimpCampaignRow[] = [];
  let clientSource: MetricsClientSource | null = null;
  let strategyEntries: StrategyEntry[] = [];

  let metaUrl: URL | null = null;
  let mailchimpUrl: URL | null = null;
  let clientsUrl: URL | null = null;
  let strategyUrl: URL | null = null;
  try {
    metaUrl = getSheetUrl(
      profile.metaSheetUrl ?? process.env.PORTAL_METRICS_META_SHEET_URL,
      "La fuente de Meta Ads",
    );
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de Meta Ads es inválida.");
  }
  try {
    mailchimpUrl = getSheetUrl(
      profile.mailchimpSheetUrl ?? process.env.PORTAL_METRICS_MAILCHIMP_SHEET_URL,
      "La fuente de Emailing",
    );
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de Emailing es inválida.");
  }
  try {
    clientsUrl = getSheetUrl(profile.clientsSheetUrl, "La fuente de clientes");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de clientes es inválida.");
  }
  try {
    strategyUrl = getSheetUrl(profile.strategySheetUrl, "La fuente de estrategia");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de estrategia es inválida.");
  }

  const [clientsResult, strategyResult, metaResult, mailchimpResult] = await Promise.allSettled([
    clientsUrl ? fetchCsv(clientsUrl, "clientes y cuentas") : Promise.resolve(null),
    strategyUrl ? fetchCsv(strategyUrl, "bitácora y estrategia") : Promise.resolve(null),
    metaUrl ? fetchCsv(metaUrl, "Meta Ads") : Promise.resolve(null),
    mailchimpUrl && profile.mailchimpName
      ? fetchCsv(mailchimpUrl, "Emailing")
      : Promise.resolve(null),
  ]);

  if (clientsResult.status === "fulfilled" && clientsResult.value) {
    clientSource = parseMetricsClientSource(clientsResult.value, profile.accountName);
    if (!clientSource) warnings.push("La cuenta no aparece en la fuente de clientes.");
  } else if (clientsResult.status === "rejected") {
    warnings.push(
      clientsResult.reason instanceof Error
        ? clientsResult.reason.message
        : "No se pudo actualizar la cuenta.",
    );
  }

  if (strategyResult.status === "fulfilled" && strategyResult.value) {
    strategyEntries = parseMetricsStrategySource(
      strategyResult.value,
      profile.accountName,
      profile.accountName,
    );
  } else if (strategyResult.status === "rejected") {
    warnings.push(
      strategyResult.reason instanceof Error
        ? strategyResult.reason.message
        : "No se pudo actualizar la estrategia.",
    );
  }

  if (metaResult.status === "fulfilled" && metaResult.value) {
    metaRows = parseSheetCSV(metaResult.value).filter((row) =>
      sameAccount(row.accountName, profile.accountName),
    );
  } else if (metaResult.status === "rejected") {
    warnings.push(
      metaResult.reason instanceof Error
        ? metaResult.reason.message
        : "No se pudo actualizar Meta Ads.",
    );
  } else if (!metaUrl) {
    warnings.push("La fuente de Meta Ads todavía no está configurada en este entorno.");
  }

  if (mailchimpResult.status === "fulfilled" && mailchimpResult.value) {
    const parsed = parseMailchimpCSV(mailchimpResult.value).rows;
    mailchimpRows = parsed.filter(
      (row) =>
        sameAccount(row.accountName, profile.mailchimpName ?? profile.accountName) ||
        sameAccount(row.audience, profile.mailchimpName ?? profile.accountName),
    );
  } else if (mailchimpResult.status === "rejected") {
    warnings.push(
      mailchimpResult.reason instanceof Error
        ? mailchimpResult.reason.message
        : "No se pudo actualizar Emailing.",
    );
  }

  return {
    metaRows,
    mailchimpRows,
    loadedAt: new Date().toISOString(),
    latestDataDate: latestDate(metaRows, mailchimpRows),
    warnings,
    clientSource,
    strategyEntries,
  };
}
