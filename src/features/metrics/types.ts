export type CampaignObjective = "CONVERSACIONES" | "LEADS" | "COMPRAS";
export type ClientChannelType = "meta-ads" | "crm" | "emailing";

export interface Client {
  id: string;
  name: string;
  accountName: string; // Exact match with CSV "Account name" column
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mailchimpName?: string; // Mailchimp account name for Emailing module
  objective?: CampaignObjective; // Campaign main goal: CONVERSACIONES | LEADS | COMPRAS
  description?: string;
  targetCpa?: number;
  monthlyBudget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SheetRow {
  campaignName: string;
  adName: string;
  adsetName: string;
  amountSpent: number;
  reach: number;
  clicks: number;
  cpc: number;
  threeSecVideoPlays: number;
  day: string; // Parsed ISO date YYYY-MM-DD
  rawDay: string; // Original D/M/AAAA
  videoPlays100: number;
  videoPlays: number;
  messagingConversationsStarted: number;
  leads: number;
  purchases: number;
  purchaseValue?: number; // Valor de conversión de compras / revenue
  followsOrLikes: number; // Follows or likes (page likes / followers)
  impressions: number;
  accountName: string;
  creativeName: string;
  creativeThumbnailUrl: string;
  creativeFacebookUrl?: string; // Creative Facebook URL (link to ad or post)
}

export interface AggregatedMetrics {
  amountSpent: number;
  reach: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
  messagingConversationsStarted: number;
  costPerConversation: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  roas?: number; // purchaseValue / amountSpent (for COMPRAS)
  followsOrLikes: number;
  primaryMetricValue: number; // Value of the star metric (Conversaciones, Leads, or Compras)
  primaryMetricLabel: string; // "Conversaciones" | "Leads" | "Compras"
  costPerResult: number; // amountSpent / primaryMetricValue
  costPerResultLabel: string; // "Costo / Conversación" | "Costo / Lead" | "Costo / Compra"
  threeSecVideoPlays: number;
  videoPlays: number;
  videoPlays100: number;
  hookRate: number; // (threeSecVideoPlays / impressions) * 100
  retentionRate: number; // (videoPlays100 / videoPlays) * 100
}

export interface DailyDataPoint {
  date: string;
  formattedDate: string;
  amountSpent: number;
  primaryMetricValue: number;
  primaryMetricLabel: string;
  costPerResult: number;
  messagingConversationsStarted: number;
  costPerConversation: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
  followsOrLikes: number;
  clicks: number;
  impressions: number;
  reach: number;
  hookRate: number;
  cpc?: number;
  ctr?: number;
}

export interface CreativePerformance {
  creativeName: string;
  thumbnailUrl: string;
  creativeFacebookUrl?: string;
  amountSpent: number;
  impressions: number;
  threeSecVideoPlays: number;
  videoPlays: number;
  videoPlays100: number;
  messagingConversationsStarted: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
  roas?: number;
  followsOrLikes: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cpm: number;
  primaryMetricValue: number;
  primaryMetricLabel: string;
  costPerResult: number;
  costPerConversation: number;
  hookRate: number;
  retentionRate: number;
}

export interface CampaignBreakdown {
  campaignName: string;
  amountSpent: number;
  messagingConversationsStarted: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
  roas?: number;
  followsOrLikes: number;
  primaryMetricValue: number;
  primaryMetricLabel: string;
  costPerResult: number;
  costPerConversation: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cpm: number;
  impressions: number;
  hookRate: number;
  retentionRate: number;
}

export interface StrategyEntry {
  id: string;
  clientId: string;
  campaignName?: string; // Optional: if empty or undefined, it's for general account
  date: string;
  type: "reunion" | "ajuste" | "proximos_pasos" | "nota";
  author: string;
  title: string;
  content: string;
  link?: string; // Optional associated link/doc URL
  tags?: string[];
  createdAt: string;
}

export interface ClientStrategy {
  clientId: string;
  initialStrategy: string;
  targetAudience?: string;
  keyOffer?: string;
  entries: StrategyEntry[];
}

export interface ReportNextStep {
  action: string;
  impact: string;
  owner?: string;
}

export interface AIReportContent {
  headline: string;
  overallStatus: "EXCELENTE" | "BUENO" | "EN_OBSERVACION" | "REQUIERE_ACCION";
  keyTakeaway: string;
  periodSummary: string; // (1) Resumen del período
  highlightedMetrics: string; // (2) Métricas destacadas
  strategyAlignment: string; // (3) Lectura de resultados a la luz de la estrategia
  strategyStatus: string; // (4) Estado de la estrategia
  nextSteps: ReportNextStep[]; // (5) Próximos pasos
}

export interface Report {
  id: string;
  clientId: string;
  title: string;
  dateRange: {
    start: string;
    end: string;
    preset?: string;
  };
  metricsSnapshot: AggregatedMetrics;
  content: AIReportContent;
  createdAt: string;
  author?: string;
}

export interface DateRangeFilter {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  preset: "7d" | "14d" | "30d" | "this_month" | "last_month" | "all" | "custom";
}

export interface AppConfig {
  sheetCsvUrl: string;
  clientsSheetUrl?: string;
  strategySheetUrl?: string;
  mailchimpSheetUrl?: string;
  usersSheetUrl?: string;
  lastSync?: string;
  useMockDataIfEmpty?: boolean;
}

export interface User {
  email: string;
  name: string;
  password?: string;
  client: string; // e.g. "Onlysellers", "GLOBAL TRIP", or "Todos" / "*" / "admin"
  role?: "admin" | "client";
}

export type AppChannel = "meta-ads" | "emailing" | "crm";

export interface MailchimpCampaignRow {
  accountName: string; // Cuenta (e.g. "Onlysellers")
  sendDate: string; // Fecha_Envio (ISO or standard display date)
  rawSendDate?: string;
  campaignId: string; // Campaign_ID
  campaignName: string; // Campaña
  subject: string; // Asunto
  previewText: string; // Preview_Text
  type: string; // Tipo (regular, automated, etc.)
  listId: string; // List_ID
  audience: string; // Audiencia
  emailsSent: number; // Enviados
  emailsDelivered: number; // Entregados
  bounces: number; // Rebotes
  hardBounces: number; // Hard_Bounces
  softBounces: number; // Soft_Bounces
  syntaxErrors: number; // Syntax_Errors
  uniqueOpens: number; // Aperturas_Unicas
  totalOpens: number; // Aperturas_Totales
  openRate: number; // Open_Rate (%)
  uniqueClicks: number; // Clicks_Unicos
  totalClicks: number; // Clicks_Totales
  ctr: number; // CTR (%)
  ctor: number; // CTOR (%) - Click-to-Open Rate
  unsubscribes: number; // Bajas
  unsubscribeRate: number; // Unsubscribe_Rate (%)
  bounceRate: number; // Bounce_Rate (%)
  abuseReports: number; // Abuse_Reports
  lastOpen?: string; // Ultima_Apertura
  lastClick?: string; // Ultimo_Click
  lastUpdated?: string; // Ultima_Actualizacion
}

export interface MailchimpAggregatedMetrics {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  deliveryRate: number; // (totalDelivered / totalSent) * 100
  totalUniqueOpens: number;
  totalOpens: number;
  avgOpenRate: number; // Weighted average or simple avg
  totalUniqueClicks: number;
  totalClicks: number;
  avgCtr: number;
  avgCtor: number; // Click-to-Open Rate
  totalUnsubscribes: number;
  avgUnsubscribeRate: number;
  totalBounces: number;
  totalHardBounces: number;
  totalSoftBounces: number;
  avgBounceRate: number;
  totalAbuseReports: number;
}

