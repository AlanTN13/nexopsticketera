import Papa from "papaparse";

import { parseDateToISO, parseNumeric } from "@/features/metrics/csv-parser";
import type { Client, StrategyEntry } from "@/features/metrics/types";

type RawRow = Record<string, unknown>;

export type MetricsClientSource = Pick<
  Client,
  | "name"
  | "accountName"
  | "logoUrl"
  | "primaryColor"
  | "secondaryColor"
  | "textColor"
  | "description"
  | "targetCpa"
  | "monthlyBudget"
  | "mailchimpName"
  | "objective"
> & {
  initialStrategy: string;
};

function normalizedKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function value(row: RawRow, keys: string[]) {
  const entries = Object.entries(row).map(([key, entry]) => [normalizedKey(key), entry] as const);
  for (const key of keys) {
    const match = entries.find(([candidate]) => candidate === normalizedKey(key));
    if (match) return match[1];
  }
  return undefined;
}

function text(row: RawRow, keys: string[]) {
  return String(value(row, keys) ?? "").trim();
}

function safeColor(input: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(input) ? input : fallback;
}

function safeHttpsUrl(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseBudget(input: unknown) {
  const raw = String(input ?? "").trim().replace(/[$€£\s]/g, "");
  if (/^\d{1,3}(,\d{3})+$/.test(raw)) return Number(raw.replace(/,/g, ""));
  return parseNumeric(raw);
}

function rows(csv: string) {
  return Papa.parse<RawRow>(csv.replace(/\r\n?/g, "\n"), {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  }).data;
}

export function parseMetricsClientSource(csv: string, accountName: string) {
  const expected = normalizedKey(accountName);
  const row = rows(csv).find((candidate) => {
    const account = text(candidate, ["account_name", "account name", "cuenta"]);
    const client = text(candidate, ["client_name", "client name", "cliente"]);
    return normalizedKey(account) === expected || normalizedKey(client) === expected;
  });

  if (!row) return null;

  const account = text(row, ["account_name", "account name", "cuenta"]) || accountName;
  const clientName = text(row, ["client_name", "client name", "cliente"]) || account;
  const objectiveValue = text(row, ["objective", "objetivo"]).toUpperCase();
  const objective = objectiveValue.includes("COMPRA")
    ? "COMPRAS"
    : objectiveValue.includes("LEAD")
      ? "LEADS"
      : "CONVERSACIONES";
  const targetCpa = parseNumeric(value(row, ["target_cpa", "target cpa", "cpa objetivo"]));
  const monthlyBudget = parseBudget(value(row, ["monthly_budget", "monthly budget", "presupuesto"]));

  return {
    name: clientName,
    accountName: account,
    logoUrl: safeHttpsUrl(text(row, ["logo_url", "logo url", "logo"])),
    primaryColor: safeColor(text(row, ["primary_color", "primary color"]), "#4330A6"),
    secondaryColor: safeColor(text(row, ["secondary_color", "secondary color"]), "#7C5BFF"),
    textColor: safeColor(text(row, ["accent_color", "accent color", "text_color"]), "#FFFFFF"),
    description: text(row, ["description", "descripcion", "rubro"]) || undefined,
    targetCpa: targetCpa > 0 ? targetCpa : undefined,
    monthlyBudget: monthlyBudget > 0 ? monthlyBudget : undefined,
    mailchimpName: text(row, ["mailchimp_name", "mailchimp name", "mailchimp"]) || undefined,
    objective,
    initialStrategy: text(row, ["initial_strategy", "initial strategy", "estrategia inicial"]),
  } satisfies MetricsClientSource;
}

function strategyType(title: string, content: string): StrategyEntry["type"] {
  const combined = normalizedKey(`${title} ${content}`);
  if (combined.includes("reunion") || combined.includes("llamada")) return "reunion";
  if (
    combined.includes("ajuste") ||
    combined.includes("pausa") ||
    combined.includes("campana") ||
    combined.includes("presupuesto")
  ) {
    return "ajuste";
  }
  if (combined.includes("proximospasos") || combined.includes("pendiente")) {
    return "proximos_pasos";
  }
  return "nota";
}

export function parseMetricsStrategySource(
  csv: string,
  accountName: string,
  clientId: string,
) {
  const expected = normalizedKey(accountName);

  const entries: StrategyEntry[] = [];

  rows(csv).forEach((row, index) => {
      const client = text(row, ["cliente", "client", "cuenta", "account"]);
      if (normalizedKey(client) !== expected) return;

      const title = text(row, ["titulo", "title", "hito", "asunto"]);
      const content = text(row, ["descripcion", "description", "detalle", "notas"]);
      if (!title && !content) return;

      const { iso } = parseDateToISO(text(row, ["fecha", "date", "dia"]));
      const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
      const rawLink = text(row, ["link asociado", "link", "enlace", "url"]);
      const link = safeHttpsUrl(rawLink);

      entries.push({
        id: `sheet-strategy-${clientId}-${date || "undated"}-${index + 1}`,
        clientId,
        campaignName:
          text(row, ["campaign name", "campaign_name", "campaña", "campana"]) || undefined,
        date,
        type: strategyType(title, content),
        author: text(row, ["autor", "author", "responsable"]) || "NexOps",
        title: title || "Actualización de estrategia",
        content: content || title,
        link: link || undefined,
        createdAt: new Date().toISOString(),
      });
    });

  return entries.sort((left, right) => right.date.localeCompare(left.date));
}
