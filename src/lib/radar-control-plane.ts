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

export type RadarControlSettings = {
  workspaceId: string;
  companyId: string | null;
  enabled: boolean;
  schedulerEnabled: boolean;
  scheduleDays: number[];
  scheduleHour: number;
  scheduleTimezone: string;
  autonomyMode: RadarAutonomyMode;
  nextRunAt: string | null;
};

export type RadarRunCandidate = {
  title: string;
  topic: string;
  sourceName: string;
  sourceUrl: string;
  score: number;
  businessReasons: string[];
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
  dispatching: "Enviando al motor",
  running: "Buscando oportunidades",
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

export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const privateHost = hostname === "localhost" || hostname.endsWith(".local") ||
      /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || hostname === "::1";
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
  if (!title || !topic || !sourceName || !sourceUrl || !isSafeHttpsUrl(sourceUrl) ||
      typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100 || !reasons.length) {
    return null;
  }
  return { title, topic, sourceName, sourceUrl, score, businessReasons: reasons };
}

export function scheduleLabel(settings: RadarControlSettings) {
  if (!settings.schedulerEnabled) return "Programación pausada";
  return `${settings.scheduleDays.length} días por semana · ${String(settings.scheduleHour).padStart(2, "0")}:00`;
}
