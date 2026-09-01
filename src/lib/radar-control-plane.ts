import type { RadarPreferences } from "@/lib/radar-preferences";

export const RADAR_AUTONOMY_MODES = ["suggest", "review", "automatic"] as const;
export const RADAR_RUN_STATUSES = [
  "queued",
  "dispatching",
  "running",
  "no_publication",
  "suggested",
  "review_pending",
  "postponed",
  "rejected",
  "approved",
  "validating",
  "publishing",
  "published",
  "failed",
  "canceled",
] as const;

export type RadarAutonomyMode = (typeof RADAR_AUTONOMY_MODES)[number];
export type RadarRunStatus = (typeof RADAR_RUN_STATUSES)[number];
export type RadarDecisionAction = "approve" | "discard" | "postpone";
export type RadarRequestKind = "opportunity_search" | "manual_note";

export type RadarManualNoteRequest = {
  title: string | null;
  sourceUrl: string;
  instructions: string | null;
};

export type RadarControlSettings = {
  workspaceId: string;
  companyId: string | null;
  enabled: boolean;
  schedulerEnabled: boolean;
  scheduleDays: number[];
  scheduleHour: number;
  scheduleTimezone: string;
  autonomyMode: RadarAutonomyMode;
  preferences: RadarPreferences;
  nextRunAt: string | null;
};

export type RadarRunCandidate = {
  title: string;
  topic: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
  businessReasons: string[];
  draft: {
    headline: string;
    deck: string;
    bodyMarkdown: string;
  } | null;
};

export type RadarRunEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type RadarRunDecision = {
  id: string;
  decision: RadarDecisionAction;
  reason: string | null;
  createdAt: string;
};

export type RadarRun = {
  id: string;
  workspaceId: string;
  companyId: string | null;
  requestedBy: string;
  triggerKind: "manual" | "scheduled";
  requestKind: RadarRequestKind;
  manualNote: RadarManualNoteRequest | null;
  autonomyMode: RadarAutonomyMode;
  status: RadarRunStatus;
  externalRunId: string | null;
  externalRunUrl: string | null;
  candidate: RadarRunCandidate | null;
  resultReason: string | null;
  finalUrl: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: RadarRunEvent[];
  decisions: RadarRunDecision[];
};

export type RadarControlPlaneSnapshot = {
  availability: "ready" | "not_configured" | "unavailable";
  settings: RadarControlSettings | null;
  runs: RadarRun[];
  engineConnected: boolean;
};

export const RADAR_STATUS_COPY: Record<RadarRunStatus, string> = {
  queued: "Solicitud recibida",
  dispatching: "En cola editorial",
  running: "Trabajador editorial en curso",
  no_publication: "Sin oportunidad suficiente",
  suggested: "Sugerencia lista",
  review_pending: "Esperando revisión",
  postponed: "Postergada",
  rejected: "Descartada",
  approved: "Aprobada · publicación pausada",
  validating: "Validando",
  publishing: "Publicando",
  published: "Publicada",
  failed: "Requiere atención",
  canceled: "Cancelada",
};

export function isRadarAutonomyMode(value: string): value is RadarAutonomyMode {
  return RADAR_AUTONOMY_MODES.includes(value as RadarAutonomyMode);
}

export function isRadarRunStatus(value: string): value is RadarRunStatus {
  return RADAR_RUN_STATUSES.includes(value as RadarRunStatus);
}

export function isRadarRequestKind(value: string): value is RadarRequestKind {
  return value === "opportunity_search" || value === "manual_note";
}

export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)?.slice(1).map(Number);
    const privateIpv4 = Boolean(ipv4 && (
      ipv4.some((part) => part > 255) ||
      ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 ||
      (ipv4[0] === 100 && ipv4[1] >= 64 && ipv4[1] <= 127) ||
      (ipv4[0] === 169 && ipv4[1] === 254) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
      (ipv4[0] === 192 && [0, 2, 168].includes(ipv4[1])) ||
      (ipv4[0] === 198 && [18, 19, 51].includes(ipv4[1])) ||
      (ipv4[0] === 203 && ipv4[1] === 0 && ipv4[2] === 113) ||
      ipv4[0] >= 224
    ));
    const firstIpv6Group = hostname.split(":", 1)[0];
    const privateIpv6 = hostname.includes(":") && (
      hostname === "::" || hostname === "::1" || hostname.startsWith("::ffff:") ||
      /^f[cd][0-9a-f]{2}$/i.test(firstIpv6Group) || /^fe[89ab][0-9a-f]$/i.test(firstIpv6Group)
    );
    const privateHost = hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") || privateIpv4 || privateIpv6;
    return url.protocol === "https:" && !url.username && !url.password && !privateHost;
  } catch {
    return false;
  }
}

export function parseRadarCandidate(value: unknown): RadarRunCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const text = (entry: unknown, maximum: number) =>
    typeof entry === "string" && entry.trim().length > 0 && entry.trim().length <= maximum
      ? entry.trim()
      : null;
  const title = text(candidate.title, 300);
  const topic = text(candidate.topic, 300);
  const sourceName = text(candidate.sourceName, 200);
  const sourceUrl = text(candidate.sourceUrl, 2_000);
  const score = candidate.score;
  const reasons = Array.isArray(candidate.businessReasons)
    ? candidate.businessReasons.map((reason) => text(reason, 300)).filter((reason): reason is string => Boolean(reason)).slice(0, 8)
    : [];
  let draft: RadarRunCandidate["draft"] = null;
  if (candidate.draft !== undefined && candidate.draft !== null) {
    if (!candidate.draft || typeof candidate.draft !== "object" || Array.isArray(candidate.draft)) return null;
    const rawDraft = candidate.draft as Record<string, unknown>;
    const headline = text(rawDraft.headline, 300);
    const deck = text(rawDraft.deck, 500);
    const bodyMarkdown = text(rawDraft.bodyMarkdown, 20_000);
    const containsImage = bodyMarkdown ? /!\[[^\]]*\]\s*(?:\([^)]*\)|\[[^\]]*\])|<(?:img|picture|source)\b|data:image\//i.test(bodyMarkdown) : false;
    if (!headline || !deck || !bodyMarkdown || /\0/.test(bodyMarkdown) || containsImage) return null;
    draft = { headline, deck, bodyMarkdown };
  }
  if (!title || !topic || !sourceName || !sourceUrl || !isSafeHttpsUrl(sourceUrl) ||
      typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100 || !reasons.length) {
    return null;
  }
  return { title, topic, sourceName, sourceUrl, score, businessReasons: reasons, draft };
}

export function parseRadarManualNoteRequest(value: unknown): RadarManualNoteRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  const sourceUrl = typeof request.sourceUrl === "string" ? request.sourceUrl.trim() : "";
  const optionalText = (entry: unknown, maximum: number) => {
    if (entry === null || entry === undefined || entry === "") return null;
    return typeof entry === "string" && entry.trim().length <= maximum ? entry.trim() : null;
  };
  const title = optionalText(request.title, 300);
  const instructions = optionalText(request.instructions, 1_000);
  if (!sourceUrl || sourceUrl.length > 2_000 || !isSafeHttpsUrl(sourceUrl)) return null;
  return { title, sourceUrl, instructions };
}

export function scheduleLabel(settings: RadarControlSettings) {
  const dayLabel = settings.scheduleDays.join(",") === "1,2,3,4,5,6"
    ? "Lun a sáb"
    : `${settings.scheduleDays.length} días por semana`;
  const hour = String(settings.scheduleHour).padStart(2, "0");
  const window = `${dayLabel} · ${hour}:00–${hour}:59`;
  return settings.schedulerEnabled ? window : `Pausada · preparada ${window.toLowerCase()}`;
}
