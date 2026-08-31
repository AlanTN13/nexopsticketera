import "server-only";

import { parseMailchimpCSV, parseSheetCSV } from "@/features/metrics/csv-parser";
import { MailchimpCampaignRow, SheetRow } from "@/features/metrics/types";
import { MetricsCompanyProfile } from "@/lib/portal-modules";

type MetricsData = {
  metaRows: SheetRow[];
  mailchimpRows: MailchimpCampaignRow[];
  loadedAt: string;
  latestDataDate: string | null;
  warnings: string[];
};

const ALLOWED_SHEET_HOSTS = new Set(["docs.google.com"]);

function getSheetUrl(name: "PORTAL_METRICS_META_SHEET_URL" | "PORTAL_METRICS_MAILCHIMP_SHEET_URL") {
  const raw = process.env[name]?.trim();
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

  let metaUrl: URL | null = null;
  let mailchimpUrl: URL | null = null;
  try {
    metaUrl = getSheetUrl("PORTAL_METRICS_META_SHEET_URL");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de Meta Ads es inválida.");
  }
  try {
    mailchimpUrl = getSheetUrl("PORTAL_METRICS_MAILCHIMP_SHEET_URL");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "La fuente de Emailing es inválida.");
  }

  if (metaUrl) {
    try {
      const csv = await fetchCsv(metaUrl, "Meta Ads");
      metaRows = parseSheetCSV(csv).filter((row) => sameAccount(row.accountName, profile.accountName));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "No se pudo actualizar Meta Ads.");
    }
  } else {
    warnings.push("La fuente de Meta Ads todavía no está configurada en este entorno.");
  }

  if (mailchimpUrl && profile.mailchimpName) {
    try {
      const csv = await fetchCsv(mailchimpUrl, "Emailing");
      const parsed = parseMailchimpCSV(csv).rows;
      mailchimpRows = parsed.filter(
        (row) =>
          sameAccount(row.accountName, profile.mailchimpName ?? profile.accountName) ||
          sameAccount(row.audience, profile.mailchimpName ?? profile.accountName),
      );
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "No se pudo actualizar Emailing.");
    }
  }

  return {
    metaRows,
    mailchimpRows,
    loadedAt: new Date().toISOString(),
    latestDataDate: latestDate(metaRows, mailchimpRows),
    warnings,
  };
}
