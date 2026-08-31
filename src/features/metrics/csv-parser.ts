import Papa from "papaparse";

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AggregatedMetrics,
  CampaignBreakdown,
  CampaignObjective,
  Client,
  CreativePerformance,
  DailyDataPoint,
  MailchimpAggregatedMetrics,
  MailchimpCampaignRow,
  SheetRow,
} from "@/features/metrics/types";

export function normalizeCSVLineBreaks(csvString: string): string {
  if (!csvString) return "";
  return csvString.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Normalizes date string into ISO YYYY-MM-DD
 * Handles "D/M/AAAA", "DD/MM/YYYY", "YYYY-MM-DD", "M/D/YYYY", etc.
 */
export function parseDateToISO(rawDateStr: any): { iso: string; raw: string } {
  if (!rawDateStr) return { iso: "", raw: "" };
  const raw = String(rawDateStr).trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { iso: raw, raw };
  }

  // Handle D/M/AAAA or DD/MM/YYYY or D/M/YY
  const slashParts = raw.split(/[\/\-\.]/);
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10);
    let year = parseInt(slashParts[2], 10);

    // If month is > 12, it might be M/D/YYYY swapped, but user specified D/M/AAAA
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { iso, raw };
    }
  }

  // Fallback to Date parser
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const iso = parsed.toISOString().split("T")[0];
    return { iso, raw };
  }

  return { iso: raw, raw };
}

/**
 * Normalizes number fields (strips currency symbols, handles comma vs dot decimals)
 */
export function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/[$\€\£\s]/g, "");
  if (!str) return 0;

  // Handle comma as decimal if only comma is present and no dot e.g. "12,50"
  let cleanStr = str;
  if (str.includes(",") && !str.includes(".")) {
    cleanStr = str.replace(",", ".");
  } else if (str.includes(",") && str.includes(".")) {
    // e.g. "1,250.50"
    cleanStr = str.replace(/,/g, "");
  }

  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Finds column value using flexible key matching
 */
function getColumnValue(row: Record<string, any>, possibleKeys: string[]): any {
  const normalizedRowKeys = Object.keys(row).reduce((acc, key) => {
    acc[key.toLowerCase().trim()] = row[key];
    return acc;
  }, {} as Record<string, any>);

  for (const key of possibleKeys) {
    const normalizedKey = key.toLowerCase().trim();
    if (normalizedRowKeys[normalizedKey] !== undefined) {
      return normalizedRowKeys[normalizedKey];
    }
  }
  return undefined;
}

/**
 * Parses raw CSV string into structured SheetRow array
 */
export function parseSheetCSV(csvString: string): SheetRow[] {
  const normalized = normalizeCSVLineBreaks(csvString);
  const results = Papa.parse(normalized, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const parsedRows: SheetRow[] = [];

  for (const rawRow of results.data as Record<string, any>[]) {
    if (!rawRow || Object.keys(rawRow).length === 0) continue;

    const accountName = String(
      getColumnValue(rawRow, ["account name", "account_name", "nombre de la cuenta", "cuenta"]) || ""
    ).trim();

    if (!accountName) continue; // Row without account name is not valid data row

    const campaignName = String(
      getColumnValue(rawRow, [
        "campaign name",
        "campaign_name",
        "campaña",
        "nombre de la campaña",
        "si es qu",
      ]) || "Campaña Principal"
    ).trim();

    const adName = String(
      getColumnValue(rawRow, ["ad name", "ad_name", "anuncio", "nombre del anuncio"]) || "Anuncio"
    ).trim();

    const adsetName = String(
      getColumnValue(rawRow, ["adset name", "adset_name", "conjunto de anuncios", "ad set name"]) || "Conjunto General"
    ).trim();

    const amountSpent = parseNumeric(
      getColumnValue(rawRow, ["amount spent", "amount_spent", "importe gastado", "inversion", "spend"])
    );

    const reach = parseNumeric(getColumnValue(rawRow, ["reach", "alcance"]));
    const clicks = parseNumeric(getColumnValue(rawRow, ["clicks (all)", "clicks", "clics (todos)", "clics"]));
    const cpc = parseNumeric(getColumnValue(rawRow, ["cpc (all)", "cpc", "cpc (todos)"]));
    const threeSecVideoPlays = parseNumeric(
      getColumnValue(rawRow, [
        "3-second video plays",
        "3_second_video_plays",
        "reproducciones de video de 3 segundos",
        "3 second video plays",
      ])
    );

    const rawDayVal = getColumnValue(rawRow, ["day", "dia", "date", "fecha"]);
    const { iso: day, raw: rawDay } = parseDateToISO(rawDayVal);

    const videoPlays100 = parseNumeric(
      getColumnValue(rawRow, [
        "video plays at 100%",
        "video_plays_at_100%",
        "video plays 100%",
        "reproducciones de video continuas al 100%",
      ])
    );

    const videoPlays = parseNumeric(
      getColumnValue(rawRow, [
        "video plays",
        "video_plays",
        "reproducciones de video",
        "video continuous plays",
      ])
    );

    const messagingConversationsStarted = parseNumeric(
      getColumnValue(rawRow, [
        "messaging conversations started",
        "messaging_conversations_started",
        "conversaciones de mensajeria iniciadas",
        "mensajes iniciados",
        "conversations started",
      ])
    );

    const leads = parseNumeric(getColumnValue(rawRow, ["leads", "clientes potenciales", "clientes potenciales generados"]));
    const purchases = parseNumeric(getColumnValue(rawRow, ["purchases", "compras", "compras en el sitio web"]));
    const purchaseValue = parseNumeric(
      getColumnValue(rawRow, [
        "purchases conversion value",
        "purchases_conversion_value",
        "valor de conversión de compras",
        "valor de conversiones de compras",
        "valor de compras",
        "purchase conversion value",
        "purchase value",
        "purchase_value",
        "total purchase conversion value",
        "revenue",
        "ingresos",
        "ingresos por compras",
        "valor compras",
        "valor_compras",
      ])
    );
    const impressions = parseNumeric(getColumnValue(rawRow, ["impressions", "impresiones"]));

    const followsOrLikes = parseNumeric(
      getColumnValue(rawRow, [
        "follows or likes",
        "follows_or_likes",
        "follows/likes",
        "follows",
        "likes",
        "page likes",
        "page follows",
        "page_likes",
        "page_follows",
        "me gusta de la pagina",
        "me gusta de la página",
        "seguidores",
        "seguidores o me gusta",
        "me gusta o seguidores",
        "likes or follows",
        "seguidores de la página",
        "seguidores de la pagina",
      ])
    );

    const creativeName = String(
      getColumnValue(rawRow, ["creative name", "creative_name", "nombre del creativo", "creativo"]) || adName
    ).trim();

    const creativeThumbnailUrl = String(
      getColumnValue(rawRow, [
        "creative thumbnail url",
        "creative_thumbnail_url",
        "thumbnail url",
        "url de miniatura",
        "imagen",
      ]) || ""
    ).trim();

    const creativeFacebookUrl = String(
      getColumnValue(rawRow, [
        "creative facebook url",
        "creative_facebook_url",
        "creative facebook link",
        "facebook url",
        "facebook_url",
        "facebook link",
        "creative url",
        "creative_url",
        "url del creativo",
        "url de facebook",
        "url facebook",
        "link del anuncio",
        "ad url",
        "post url",
        "url",
      ]) || ""
    ).trim();

    parsedRows.push({
      campaignName,
      adName,
      adsetName,
      amountSpent,
      reach,
      clicks,
      cpc,
      threeSecVideoPlays,
      day,
      rawDay,
      videoPlays100,
      videoPlays,
      messagingConversationsStarted,
      leads,
      purchases,
      purchaseValue: purchaseValue > 0 ? purchaseValue : undefined,
      followsOrLikes,
      impressions,
      accountName,
      creativeName,
      creativeThumbnailUrl,
      creativeFacebookUrl: creativeFacebookUrl || undefined,
    });
  }

  return parsedRows;
}

/**
 * Helper to get objective labels
 */
export function getObjectiveLabels(objective: CampaignObjective = "CONVERSACIONES") {
  switch (objective) {
    case "LEADS":
      return {
        primaryMetricLabel: "Leads",
        primaryMetricSingular: "Lead",
        costPerResultLabel: "Costo / Lead",
        rateLabel: "tasa clics a leads",
      };
    case "COMPRAS":
      return {
        primaryMetricLabel: "Compras",
        primaryMetricSingular: "Compra",
        costPerResultLabel: "Costo / Compra",
        rateLabel: "tasa clics a compras",
      };
    case "CONVERSACIONES":
    default:
      return {
        primaryMetricLabel: "Conversaciones",
        primaryMetricSingular: "Conversación",
        costPerResultLabel: "Costo / Conversación",
        rateLabel: "tasa clics a msgs",
      };
  }
}

/**
 * Filters rows for a specific client accountName and optional date range
 */
export function filterRowsForClient(
  rows: SheetRow[],
  accountName: string,
  startDate?: string,
  endDate?: string
): SheetRow[] {
  const normalizedAccount = accountName.trim().toLowerCase();

  return rows.filter((row) => {
    if (row.accountName.trim().toLowerCase() !== normalizedAccount) {
      return false;
    }

    if (startDate && row.day && row.day < startDate) {
      return false;
    }

    if (endDate && row.day && row.day > endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Aggregates all metrics from a filtered list of rows with respect to client campaign objective
 */
export function calculateAggregatedMetrics(
  rows: SheetRow[],
  objective: CampaignObjective = "CONVERSACIONES"
): AggregatedMetrics {
  let amountSpent = 0;
  let reach = 0;
  let impressions = 0;
  let clicks = 0;
  let messagingConversationsStarted = 0;
  let leads = 0;
  let purchases = 0;
  let purchaseValue = 0;
  let followsOrLikes = 0;
  let threeSecVideoPlays = 0;
  let videoPlays = 0;
  let videoPlays100 = 0;

  for (const row of rows) {
    amountSpent += row.amountSpent;
    reach += row.reach;
    impressions += row.impressions;
    clicks += row.clicks;
    messagingConversationsStarted += row.messagingConversationsStarted;
    leads += row.leads;
    purchases += row.purchases;
    if (row.purchaseValue) {
      purchaseValue += row.purchaseValue;
    }
    followsOrLikes += row.followsOrLikes || 0;
    threeSecVideoPlays += row.threeSecVideoPlays;
    videoPlays += row.videoPlays;
    videoPlays100 += row.videoPlays100;
  }

  amountSpent = Math.round(amountSpent * 100) / 100;
  purchaseValue = Math.round(purchaseValue * 100) / 100;

  // Primary Star Metric calculation based on objective
  let primaryMetricValue = messagingConversationsStarted;
  if (objective === "LEADS") {
    primaryMetricValue = leads;
  } else if (objective === "COMPRAS") {
    primaryMetricValue = purchases;
  }

  const { primaryMetricLabel, costPerResultLabel } = getObjectiveLabels(objective);

  const costPerResult =
    primaryMetricValue > 0
      ? Math.round((amountSpent / primaryMetricValue) * 100) / 100
      : 0;

  const costPerConversation =
    messagingConversationsStarted > 0
      ? Math.round((amountSpent / messagingConversationsStarted) * 100) / 100
      : 0;

  // ROAS calculation for COMPRAS only (if purchaseValue is present and > 0)
  let roas: number | undefined = undefined;
  if (objective === "COMPRAS" && purchaseValue > 0 && amountSpent > 0) {
    roas = Math.round((purchaseValue / amountSpent) * 100) / 100;
  }

  const cpc = clicks > 0 ? Math.round((amountSpent / clicks) * 100) / 100 : 0;
  const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

  const hookRate =
    impressions > 0
      ? Math.round((threeSecVideoPlays / impressions) * 10000) / 100
      : 0;

  const retentionRate =
    videoPlays > 0
      ? Math.round((videoPlays100 / videoPlays) * 10000) / 100
      : 0;

  return {
    amountSpent,
    reach,
    impressions,
    clicks,
    cpc,
    ctr,
    messagingConversationsStarted,
    costPerConversation,
    leads,
    purchases,
    purchaseValue,
    roas,
    followsOrLikes,
    primaryMetricValue,
    primaryMetricLabel,
    costPerResult,
    costPerResultLabel,
    threeSecVideoPlays,
    videoPlays,
    videoPlays100,
    hookRate,
    retentionRate,
  };
}

/**
 * Groups rows by day for timeseries charts adapted to the client objective
 */
export function aggregateByDay(
  rows: SheetRow[],
  objective: CampaignObjective = "CONVERSACIONES"
): DailyDataPoint[] {
  const dayMap: Record<string, {
    amountSpent: number;
    messagingConversationsStarted: number;
    leads: number;
    purchases: number;
    purchaseValue: number;
    followsOrLikes: number;
    clicks: number;
    impressions: number;
    reach: number;
    threeSecVideoPlays: number;
  }> = {};

  for (const row of rows) {
    const d = row.day || "Sin fecha";
    if (!dayMap[d]) {
      dayMap[d] = {
        amountSpent: 0,
        messagingConversationsStarted: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
        followsOrLikes: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
        threeSecVideoPlays: 0,
      };
    }
    dayMap[d].amountSpent += row.amountSpent;
    dayMap[d].messagingConversationsStarted += row.messagingConversationsStarted;
    dayMap[d].leads += row.leads;
    dayMap[d].purchases += row.purchases;
    if (row.purchaseValue) {
      dayMap[d].purchaseValue += row.purchaseValue;
    }
    dayMap[d].followsOrLikes += row.followsOrLikes || 0;
    dayMap[d].clicks += row.clicks;
    dayMap[d].impressions += row.impressions;
    dayMap[d].reach += row.reach;
    dayMap[d].threeSecVideoPlays += row.threeSecVideoPlays;
  }

  // Sort chronologically
  const sortedDays = Object.keys(dayMap).sort();
  const { primaryMetricLabel } = getObjectiveLabels(objective);

  return sortedDays.map((d) => {
    const item = dayMap[d];
    const amountSpent = Math.round(item.amountSpent * 100) / 100;

    let primaryMetricValue = item.messagingConversationsStarted;
    if (objective === "LEADS") {
      primaryMetricValue = item.leads;
    } else if (objective === "COMPRAS") {
      primaryMetricValue = item.purchases;
    }

    const costPerResult =
      primaryMetricValue > 0
        ? Math.round((amountSpent / primaryMetricValue) * 100) / 100
        : 0;

    const cpa =
      item.messagingConversationsStarted > 0
        ? Math.round((amountSpent / item.messagingConversationsStarted) * 100) / 100
        : 0;

    const hookRate =
      item.impressions > 0
        ? Math.round((item.threeSecVideoPlays / item.impressions) * 10000) / 100
        : 0;

    // Format display date: "15 Feb"
    let formattedDate = d;
    if (d.includes("-")) {
      const [, m, dayNum] = d.split("-");
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const mIdx = parseInt(m, 10) - 1;
      formattedDate = `${parseInt(dayNum, 10)} ${monthNames[mIdx] || m}`;
    }

    const cpc = item.clicks > 0 ? Math.round((amountSpent / item.clicks) * 100) / 100 : 0;
    const ctr = item.impressions > 0 ? Math.round((item.clicks / item.impressions) * 10000) / 100 : 0;

    return {
      date: d,
      formattedDate,
      amountSpent,
      primaryMetricValue,
      primaryMetricLabel,
      costPerResult,
      messagingConversationsStarted: item.messagingConversationsStarted,
      costPerConversation: cpa,
      leads: item.leads,
      purchases: item.purchases,
      purchaseValue: item.purchaseValue > 0 ? item.purchaseValue : undefined,
      followsOrLikes: item.followsOrLikes,
      clicks: item.clicks,
      impressions: item.impressions,
      reach: item.reach,
      hookRate,
      cpc,
      ctr,
    };
  });
}

/**
 * Aggregates performance by creative for Hook Rate, Retention, and star metric rankings
 * Ordered by volume of the client's star metric
 */
export function aggregateByCreative(
  rows: SheetRow[],
  objective: CampaignObjective = "CONVERSACIONES"
): CreativePerformance[] {
  const map: Record<string, {
    thumbnailUrl: string;
    creativeFacebookUrl?: string;
    amountSpent: number;
    impressions: number;
    clicks: number;
    threeSecVideoPlays: number;
    videoPlays: number;
    videoPlays100: number;
    messagingConversationsStarted: number;
    leads: number;
    purchases: number;
    purchaseValue: number;
    followsOrLikes: number;
  }> = {};

  for (const row of rows) {
    const key = row.creativeName || row.adName || "Creativo General";
    if (!map[key]) {
      map[key] = {
        thumbnailUrl: row.creativeThumbnailUrl || "",
        creativeFacebookUrl: row.creativeFacebookUrl || undefined,
        amountSpent: 0,
        impressions: 0,
        clicks: 0,
        threeSecVideoPlays: 0,
        videoPlays: 0,
        videoPlays100: 0,
        messagingConversationsStarted: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
        followsOrLikes: 0,
      };
    }
    if (!map[key].thumbnailUrl && row.creativeThumbnailUrl) {
      map[key].thumbnailUrl = row.creativeThumbnailUrl;
    }
    if (!map[key].creativeFacebookUrl && row.creativeFacebookUrl) {
      map[key].creativeFacebookUrl = row.creativeFacebookUrl;
    }
    map[key].amountSpent += row.amountSpent;
    map[key].impressions += row.impressions;
    map[key].clicks += row.clicks || 0;
    map[key].threeSecVideoPlays += row.threeSecVideoPlays;
    map[key].videoPlays += row.videoPlays;
    map[key].videoPlays100 += row.videoPlays100;
    map[key].messagingConversationsStarted += row.messagingConversationsStarted;
    map[key].leads += row.leads;
    map[key].purchases += row.purchases;
    if (row.purchaseValue) {
      map[key].purchaseValue += row.purchaseValue;
    }
    map[key].followsOrLikes += row.followsOrLikes || 0;
  }

  const { primaryMetricLabel } = getObjectiveLabels(objective);

  return Object.keys(map).map((creativeName) => {
    const item = map[creativeName];
    const amountSpent = Math.round(item.amountSpent * 100) / 100;

    let primaryMetricValue = item.messagingConversationsStarted;
    if (objective === "LEADS") {
      primaryMetricValue = item.leads;
    } else if (objective === "COMPRAS") {
      primaryMetricValue = item.purchases;
    }

    const costPerResult =
      primaryMetricValue > 0
        ? Math.round((amountSpent / primaryMetricValue) * 100) / 100
        : 0;

    const costPerConversation =
      item.messagingConversationsStarted > 0
        ? Math.round((amountSpent / item.messagingConversationsStarted) * 100) / 100
        : 0;

    let roas: number | undefined = undefined;
    if (objective === "COMPRAS" && item.purchaseValue > 0 && amountSpent > 0) {
      roas = Math.round((item.purchaseValue / amountSpent) * 100) / 100;
    }

    const hookRate =
      item.impressions > 0
        ? Math.round((item.threeSecVideoPlays / item.impressions) * 10000) / 100
        : 0;

    const retentionRate =
      item.videoPlays > 0
        ? Math.round((item.videoPlays100 / item.videoPlays) * 10000) / 100
        : 0;

    const cpc = item.clicks > 0 ? Math.round((amountSpent / item.clicks) * 100) / 100 : 0;
    const ctr = item.impressions > 0 ? Math.round((item.clicks / item.impressions) * 10000) / 100 : 0;
    const cpm = item.impressions > 0 ? Math.round(((amountSpent / item.impressions) * 1000) * 100) / 100 : 0;

    return {
      creativeName,
      thumbnailUrl: item.thumbnailUrl,
      creativeFacebookUrl: item.creativeFacebookUrl,
      amountSpent,
      impressions: item.impressions,
      threeSecVideoPlays: item.threeSecVideoPlays,
      videoPlays: item.videoPlays,
      videoPlays100: item.videoPlays100,
      messagingConversationsStarted: item.messagingConversationsStarted,
      leads: item.leads,
      purchases: item.purchases,
      purchaseValue: item.purchaseValue > 0 ? item.purchaseValue : undefined,
      roas,
      followsOrLikes: item.followsOrLikes,
      clicks: item.clicks,
      cpc,
      ctr,
      cpm,
      primaryMetricValue,
      primaryMetricLabel,
      costPerResult,
      costPerConversation,
      hookRate,
      retentionRate,
    };
  }).sort((a, b) => b.primaryMetricValue - a.primaryMetricValue);
}

/**
 * Aggregates performance by Campaign
 */
export function aggregateByCampaign(
  rows: SheetRow[],
  objective: CampaignObjective = "CONVERSACIONES"
): CampaignBreakdown[] {
  const map: Record<string, {
    amountSpent: number;
    messagingConversationsStarted: number;
    leads: number;
    purchases: number;
    purchaseValue: number;
    followsOrLikes: number;
    clicks: number;
    impressions: number;
    threeSecVideoPlays: number;
    videoPlays: number;
    videoPlays100: number;
  }> = {};

  for (const row of rows) {
    const key = row.campaignName || "Campaña Principal";
    if (!map[key]) {
      map[key] = {
        amountSpent: 0,
        messagingConversationsStarted: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
        followsOrLikes: 0,
        clicks: 0,
        impressions: 0,
        threeSecVideoPlays: 0,
        videoPlays: 0,
        videoPlays100: 0,
      };
    }
    map[key].amountSpent += row.amountSpent;
    map[key].messagingConversationsStarted += row.messagingConversationsStarted;
    map[key].leads += row.leads;
    map[key].purchases += row.purchases;
    if (row.purchaseValue) {
      map[key].purchaseValue += row.purchaseValue;
    }
    map[key].followsOrLikes += row.followsOrLikes || 0;
    map[key].clicks += row.clicks;
    map[key].impressions += row.impressions;
    map[key].threeSecVideoPlays += row.threeSecVideoPlays;
    map[key].videoPlays += row.videoPlays;
    map[key].videoPlays100 += row.videoPlays100;
  }

  const { primaryMetricLabel } = getObjectiveLabels(objective);

  return Object.keys(map).map((campaignName) => {
    const item = map[campaignName];
    const amountSpent = Math.round(item.amountSpent * 100) / 100;

    let primaryMetricValue = item.messagingConversationsStarted;
    if (objective === "LEADS") {
      primaryMetricValue = item.leads;
    } else if (objective === "COMPRAS") {
      primaryMetricValue = item.purchases;
    }

    const costPerResult =
      primaryMetricValue > 0
        ? Math.round((amountSpent / primaryMetricValue) * 100) / 100
        : 0;

    const costPerConversation =
      item.messagingConversationsStarted > 0
        ? Math.round((amountSpent / item.messagingConversationsStarted) * 100) / 100
        : 0;

    let roas: number | undefined = undefined;
    if (objective === "COMPRAS" && item.purchaseValue > 0 && amountSpent > 0) {
      roas = Math.round((item.purchaseValue / amountSpent) * 100) / 100;
    }

    const cpc = item.clicks > 0 ? Math.round((amountSpent / item.clicks) * 100) / 100 : 0;
    const ctr = item.impressions > 0 ? Math.round((item.clicks / item.impressions) * 10000) / 100 : 0;
    const cpm = item.impressions > 0 ? Math.round(((amountSpent / item.impressions) * 1000) * 100) / 100 : 0;
    const hookRate =
      item.impressions > 0
        ? Math.round((item.threeSecVideoPlays / item.impressions) * 10000) / 100
        : 0;
    const retentionRate =
      item.videoPlays > 0
        ? Math.round((item.videoPlays100 / item.videoPlays) * 10000) / 100
        : 0;

    return {
      campaignName,
      amountSpent,
      messagingConversationsStarted: item.messagingConversationsStarted,
      leads: item.leads,
      purchases: item.purchases,
      purchaseValue: item.purchaseValue > 0 ? item.purchaseValue : undefined,
      roas,
      followsOrLikes: item.followsOrLikes,
      primaryMetricValue,
      primaryMetricLabel,
      costPerResult,
      costPerConversation,
      clicks: item.clicks,
      cpc,
      ctr,
      cpm,
      impressions: item.impressions,
      hookRate,
      retentionRate,
    };
  }).sort((a, b) => b.amountSpent - a.amountSpent);
}

/**
 * Filter rows by date range
 */
export function filterRowsByDateRange(
  rows: SheetRow[],
  startDate?: string,
  endDate?: string
): SheetRow[] {
  if (!startDate && !endDate) return rows;

  return rows.filter((row) => {
    if (!row.day) return true;
    if (startDate && row.day < startDate) return false;
    if (endDate && row.day > endDate) return false;
    return true;
  });
}

/**
 * Parses raw CSV string of Mailchimp / Emailing table
 */
export function parseMailchimpCSV(csvString: string): {
  rows: MailchimpCampaignRow[];
  totalParsed: number;
} {
  const normalized = normalizeCSVLineBreaks(csvString);
  const results = Papa.parse(normalized, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (!results.data || results.data.length === 0) {
    return { rows: [], totalParsed: 0 };
  }

  const parsedRows: MailchimpCampaignRow[] = [];

  for (const rawRow of results.data as Record<string, any>[]) {
    if (!rawRow || Object.keys(rawRow).length === 0) continue;

    const rawAccount = String(
      getColumnValue(rawRow, [
        "cuenta",
        "account",
        "account_name",
        "client",
        "cliente",
        "mailchimp_name",
        "nombre_cuenta",
      ]) || ""
    ).trim();

    const rawDate = String(
      getColumnValue(rawRow, [
        "fecha_envio",
        "fecha envio",
        "fecha",
        "send_date",
        "send date",
        "sent_at",
        "date",
      ]) || ""
    ).trim();

    const campaignId = String(
      getColumnValue(rawRow, [
        "campaign_id",
        "campaign id",
        "id_campaña",
        "id_campana",
        "id",
      ]) || ""
    ).trim();

    const campaignName = String(
      getColumnValue(rawRow, [
        "campaña",
        "campana",
        "campaign",
        "campaign_name",
        "campaign name",
        "nombre_campaña",
      ]) || ""
    ).trim();

    const subject = String(
      getColumnValue(rawRow, [
        "asunto",
        "subject",
        "asunto_email",
        "email_subject",
        "titulo",
      ]) || ""
    ).trim();

    const previewText = String(
      getColumnValue(rawRow, [
        "preview_text",
        "preview text",
        "preview",
        "texto_preliminar",
        "preheader",
      ]) || ""
    ).trim();

    const type = String(
      getColumnValue(rawRow, [
        "tipo",
        "type",
        "campaign_type",
      ]) || "regular"
    ).trim();

    const listId = String(
      getColumnValue(rawRow, [
        "list_id",
        "list id",
        "lista_id",
        "audience_id",
      ]) || ""
    ).trim();

    const audience = String(
      getColumnValue(rawRow, [
        "audiencia",
        "audience",
        "list_name",
        "lista",
      ]) || ""
    ).trim();

    // Numbers & Metrics
    const emailsSent = parseNumeric(
      getColumnValue(rawRow, ["enviados", "emails_sent", "sent", "total_sent"])
    );
    const emailsDelivered = parseNumeric(
      getColumnValue(rawRow, ["entregados", "delivered", "emails_delivered", "successful_deliveries"])
    );
    const bounces = parseNumeric(
      getColumnValue(rawRow, ["rebotes", "bounces", "total_bounces"])
    );
    const hardBounces = parseNumeric(
      getColumnValue(rawRow, ["hard_bounces", "hard bounces", "rebotes_duros"])
    );
    const softBounces = parseNumeric(
      getColumnValue(rawRow, ["soft_bounces", "soft bounces", "rebotes_blandos"])
    );
    const syntaxErrors = parseNumeric(
      getColumnValue(rawRow, ["syntax_errors", "syntax errors", "errores_sintaxis"])
    );
    const uniqueOpens = parseNumeric(
      getColumnValue(rawRow, ["aperturas_unicas", "unique_opens", "unique opens", "aperturas unicas"])
    );
    const totalOpens = parseNumeric(
      getColumnValue(rawRow, ["aperturas_totales", "total_opens", "total opens", "aperturas totales", "opens"])
    );
    const rawOpenRate = parseNumeric(
      getColumnValue(rawRow, ["open_rate", "open rate", "tasa_apertura", "tasa apertura"])
    );
    const uniqueClicks = parseNumeric(
      getColumnValue(rawRow, ["clicks_unicos", "unique_clicks", "unique clicks", "clics unicos", "clics_unicos"])
    );
    const totalClicks = parseNumeric(
      getColumnValue(rawRow, ["clicks_totales", "total_clicks", "total clicks", "clics totales", "clics_totales", "clicks"])
    );
    const rawCtr = parseNumeric(
      getColumnValue(rawRow, ["ctr", "click_rate", "click rate", "tasa_clic"])
    );
    const rawCtor = parseNumeric(
      getColumnValue(rawRow, ["ctor", "click_to_open_rate", "click to open rate", "tasa_apertura_clic"])
    );
    const unsubscribes = parseNumeric(
      getColumnValue(rawRow, ["bajas", "unsubscribes", "unsub", "desuscripciones"])
    );
    const rawUnsubscribeRate = parseNumeric(
      getColumnValue(rawRow, ["unsubscribe_rate", "unsubscribe rate", "tasa_bajas", "tasa_desuscripcion"])
    );
    const rawBounceRate = parseNumeric(
      getColumnValue(rawRow, ["bounce_rate", "bounce rate", "tasa_rebote"])
    );
    const abuseReports = parseNumeric(
      getColumnValue(rawRow, ["abuse_reports", "abuse reports", "quejas", "reportes_abuso", "spam"])
    );

    const lastOpen = String(
      getColumnValue(rawRow, ["ultima_apertura", "last_open", "last open"]) || ""
    ).trim();

    const lastClick = String(
      getColumnValue(rawRow, ["ultimo_click", "last_click", "last click", "ultimo_clic"]) || ""
    ).trim();

    const lastUpdated = String(
      getColumnValue(rawRow, ["ultima_actualizacion", "last_update", "last updated", "updated_at"]) || ""
    ).trim();

    if (!rawAccount && !subject && !campaignName && emailsSent === 0) {
      continue; // Skip blank rows
    }

    // Normalize Date to ISO
    let parsedIsoDate = "";
    if (rawDate) {
      // Check if format is DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
      const dateParts = rawDate.split(" ")[0].split(/[-/]/);
      if (dateParts.length === 3) {
        if (dateParts[0].length === 4) {
          // YYYY-MM-DD
          parsedIsoDate = `${dateParts[0]}-${dateParts[1].padStart(2, "0")}-${dateParts[2].padStart(2, "0")}`;
        } else {
          // DD/MM/YYYY
          parsedIsoDate = `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`;
        }
      }
    }

    // Calculated / Fallback rates if percentage was missing
    const calculatedOpenRate = rawOpenRate > 0
      ? rawOpenRate
      : (emailsDelivered > 0 ? Math.round((uniqueOpens / emailsDelivered) * 10000) / 100 : 0);

    const calculatedCtr = rawCtr > 0
      ? rawCtr
      : (emailsDelivered > 0 ? Math.round((uniqueClicks / emailsDelivered) * 10000) / 100 : 0);

    const calculatedCtor = rawCtor > 0
      ? rawCtor
      : (uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 10000) / 100 : 0);

    const calculatedBounceRate = rawBounceRate > 0
      ? rawBounceRate
      : (emailsSent > 0 ? Math.round((bounces / emailsSent) * 10000) / 100 : 0);

    const calculatedUnsubRate = rawUnsubscribeRate > 0
      ? rawUnsubscribeRate
      : (emailsDelivered > 0 ? Math.round((unsubscribes / emailsDelivered) * 10000) / 100 : 0);

    parsedRows.push({
      accountName: rawAccount,
      sendDate: parsedIsoDate || rawDate,
      rawSendDate: rawDate,
      campaignId: campaignId || `camp-${Math.random().toString(36).substring(2, 9)}`,
      campaignName: campaignName || subject || "Campaña sin nombre",
      subject: subject || campaignName || "Sin asunto",
      previewText,
      type: type || "regular",
      listId,
      audience,
      emailsSent,
      emailsDelivered: emailsDelivered || (emailsSent - bounces),
      bounces,
      hardBounces,
      softBounces,
      syntaxErrors,
      uniqueOpens,
      totalOpens: totalOpens || uniqueOpens,
      openRate: calculatedOpenRate,
      uniqueClicks,
      totalClicks: totalClicks || uniqueClicks,
      ctr: calculatedCtr,
      ctor: calculatedCtor,
      unsubscribes,
      unsubscribeRate: calculatedUnsubRate,
      bounceRate: calculatedBounceRate,
      abuseReports,
      lastOpen: lastOpen || undefined,
      lastClick: lastClick || undefined,
      lastUpdated: lastUpdated || undefined,
    });
  }

  // Sort by date descending
  parsedRows.sort((a, b) => {
    const timeA = new Date(a.sendDate).getTime() || 0;
    const timeB = new Date(b.sendDate).getTime() || 0;
    return timeB - timeA;
  });

  return {
    rows: parsedRows,
    totalParsed: parsedRows.length,
  };
}

/**
 * Filters Mailchimp rows for a specific client matching account name or mailchimpName
 */
export function filterMailchimpRowsForClient(
  rows: MailchimpCampaignRow[],
  client: Client
): MailchimpCampaignRow[] {
  if (!rows || rows.length === 0 || !client) return [];

  const targets = [
    client.mailchimpName?.trim().toLowerCase(),
    client.accountName.trim().toLowerCase(),
    client.name.trim().toLowerCase(),
  ].filter(Boolean) as string[];

  return rows.filter((r) => {
    const rAcc = (r.accountName || "").trim().toLowerCase();
    const rAud = (r.audience || "").trim().toLowerCase();
    return targets.some((t) => rAcc === t || rAcc.includes(t) || t.includes(rAcc) || rAud.includes(t));
  });
}

/**
 * Aggregates summary KPIs for Mailchimp campaigns
 */
export function calculateMailchimpMetrics(
  rows: MailchimpCampaignRow[]
): MailchimpAggregatedMetrics {
  if (!rows || rows.length === 0) {
    return {
      totalCampaigns: 0,
      totalSent: 0,
      totalDelivered: 0,
      deliveryRate: 0,
      totalUniqueOpens: 0,
      totalOpens: 0,
      avgOpenRate: 0,
      totalUniqueClicks: 0,
      totalClicks: 0,
      avgCtr: 0,
      avgCtor: 0,
      totalUnsubscribes: 0,
      avgUnsubscribeRate: 0,
      totalBounces: 0,
      totalHardBounces: 0,
      totalSoftBounces: 0,
      avgBounceRate: 0,
      totalAbuseReports: 0,
    };
  }

  let totalSent = 0;
  let totalDelivered = 0;
  let totalUniqueOpens = 0;
  let totalOpens = 0;
  let totalUniqueClicks = 0;
  let totalClicks = 0;
  let totalUnsubscribes = 0;
  let totalBounces = 0;
  let totalHardBounces = 0;
  let totalSoftBounces = 0;
  let totalAbuseReports = 0;

  for (const r of rows) {
    totalSent += r.emailsSent || 0;
    totalDelivered += r.emailsDelivered || 0;
    totalUniqueOpens += r.uniqueOpens || 0;
    totalOpens += r.totalOpens || 0;
    totalUniqueClicks += r.uniqueClicks || 0;
    totalClicks += r.totalClicks || 0;
    totalUnsubscribes += r.unsubscribes || 0;
    totalBounces += r.bounces || 0;
    totalHardBounces += r.hardBounces || 0;
    totalSoftBounces += r.softBounces || 0;
    totalAbuseReports += r.abuseReports || 0;
  }

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0;
  const avgOpenRate = totalDelivered > 0 ? Math.round((totalUniqueOpens / totalDelivered) * 10000) / 100 : 0;
  const avgCtr = totalDelivered > 0 ? Math.round((totalUniqueClicks / totalDelivered) * 10000) / 100 : 0;
  const avgCtor = totalUniqueOpens > 0 ? Math.round((totalUniqueClicks / totalUniqueOpens) * 10000) / 100 : 0;
  const avgUnsubscribeRate = totalDelivered > 0 ? Math.round((totalUnsubscribes / totalDelivered) * 10000) / 100 : 0;
  const avgBounceRate = totalSent > 0 ? Math.round((totalBounces / totalSent) * 10000) / 100 : 0;

  return {
    totalCampaigns: rows.length,
    totalSent,
    totalDelivered,
    deliveryRate,
    totalUniqueOpens,
    totalOpens,
    avgOpenRate,
    totalUniqueClicks,
    totalClicks,
    avgCtr,
    avgCtor,
    totalUnsubscribes,
    avgUnsubscribeRate,
    totalBounces,
    totalHardBounces,
    totalSoftBounces,
    avgBounceRate,
    totalAbuseReports,
  };
}
