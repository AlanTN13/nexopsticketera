export const RADAR_TOPIC_OPTIONS = [
  "IA aplicada",
  "Automatización",
  "CRM & Ventas",
  "Data & Analytics",
  "Ciberseguridad",
  "Experiencia de cliente",
  "Negocios digitales",
  "Productividad",
] as const;

export const RADAR_PUBLICATIONS_PER_WEEK = [1, 2, 3, 4, 5] as const;
export const RADAR_OPPORTUNITY_BEHAVIORS = ["discard", "suggest"] as const;
export const RADAR_PUBLISHING_MODES = ["review", "automatic"] as const;

export type RadarOpportunityBehavior = (typeof RADAR_OPPORTUNITY_BEHAVIORS)[number];
export type RadarPublishingMode = (typeof RADAR_PUBLISHING_MODES)[number];

export type RadarPreferences = {
  topics: string[];
  publicationsPerWeek: number;
  opportunityBehavior: RadarOpportunityBehavior;
  publishingMode: RadarPublishingMode;
  siteIntegrated: boolean;
};

export const DEFAULT_RADAR_TOPICS = [
  "IA aplicada",
  "Automatización",
  "CRM & Ventas",
  "Data & Analytics",
];

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeRadarTopics(values: unknown[]) {
  const topics = values
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => value.length >= 2 && value.length <= 50 && !/[\u0000-\u001f\u007f]/.test(value));

  return [...new Set(topics)].slice(0, 8);
}

export function parseRadarPreferences(value: unknown): RadarPreferences {
  const settings = objectSettings(value);
  const topics = Array.isArray(settings.topics)
    ? normalizeRadarTopics(settings.topics)
    : DEFAULT_RADAR_TOPICS;
  const siteIntegrated = settings.siteIntegrated === true;
  const publicationsPerWeek =
    typeof settings.publicationsPerWeek === "number" &&
    RADAR_PUBLICATIONS_PER_WEEK.includes(
      settings.publicationsPerWeek as (typeof RADAR_PUBLICATIONS_PER_WEEK)[number],
    )
      ? settings.publicationsPerWeek
      : 4;
  const opportunityBehavior = RADAR_OPPORTUNITY_BEHAVIORS.includes(
    settings.opportunityBehavior as RadarOpportunityBehavior,
  )
    ? (settings.opportunityBehavior as RadarOpportunityBehavior)
    : "discard";
  const requestedPublishingMode = RADAR_PUBLISHING_MODES.includes(
    settings.publishingMode as RadarPublishingMode,
  )
    ? (settings.publishingMode as RadarPublishingMode)
    : siteIntegrated
      ? "automatic"
      : "review";

  return {
    topics: topics.length ? topics : DEFAULT_RADAR_TOPICS,
    publicationsPerWeek,
    opportunityBehavior,
    publishingMode:
      requestedPublishingMode === "automatic" && !siteIntegrated
        ? "review"
        : requestedPublishingMode,
    siteIntegrated,
  };
}

export function canManageRadarPreferences(role: string) {
  return role === "client_admin" || role === "platform_admin";
}
