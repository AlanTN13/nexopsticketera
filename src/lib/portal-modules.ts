import { Company, CompanyModules, UserProfile, isClientRole } from "@/lib/ticketing";

export type PortalModule = "home" | "support" | "metrics" | "radar";

export type MetricsCompanyProfile = {
  enabled?: boolean;
  accountName: string;
  mailchimpName?: string;
  objective?: "CONVERSACIONES" | "LEADS" | "COMPRAS";
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  clientsSheetUrl?: string;
  strategySheetUrl?: string;
  metaSheetUrl?: string;
  mailchimpSheetUrl?: string;
};

type PortalNavigationItem = {
  href: string;
  label: string;
  active?: boolean;
  badge?: number;
};

const DEFAULT_METRICS_PROFILES: Record<string, MetricsCompanyProfile> = {
  "global-trip": {
    enabled: true,
    accountName: "GLOBAL TRIP",
    objective: "CONVERSACIONES",
    logoUrl: "https://globaltriplog.com/logogt.png",
    primaryColor: "#152A4F",
    secondaryColor: "#2B6BB1",
    textColor: "#FFFFFF",
  },
  globaltrip: {
    enabled: true,
    accountName: "GLOBAL TRIP",
    objective: "CONVERSACIONES",
    logoUrl: "https://globaltriplog.com/logogt.png",
    primaryColor: "#152A4F",
    secondaryColor: "#2B6BB1",
    textColor: "#FFFFFF",
  },
  "nexops-tech": {
    enabled: true,
    accountName: "Nexops Tech",
    objective: "CONVERSACIONES",
    logoUrl: "https://www.nexopstech.com/assets/logo-nexops-DoSNtBy3.svg",
    primaryColor: "#6366F1",
    secondaryColor: "#4338CA",
    textColor: "#FFFFFF",
  },
  kahuna: {
    enabled: true,
    accountName: "Kahuna",
    objective: "CONVERSACIONES",
    primaryColor: "#10A33E",
    secondaryColor: "#4338CA",
    textColor: "#FFFFFF",
  },
  onlysellers: {
    enabled: true,
    accountName: "Onlysellers",
    mailchimpName: "Onlysellers",
    objective: "CONVERSACIONES",
    primaryColor: "#FE9901",
    secondaryColor: "#22303E",
    textColor: "#FFFFFF",
  },
};

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getConfiguredProfiles(rawConfig = process.env.PORTAL_METRICS_COMPANY_CONFIG) {
  if (!rawConfig) return {};

  try {
    const parsed = JSON.parse(rawConfig) as Record<string, MetricsCompanyProfile>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [normalizeKey(key), value]),
    );
  } catch {
    return {};
  }
}

export function getMetricsProfile(
  company: Company,
  rawConfig = process.env.PORTAL_METRICS_COMPANY_CONFIG,
) {
  if (!company.modules.metrics.enabled) return null;

  const configured = getConfiguredProfiles(rawConfig);
  const slugKey = normalizeKey(company.slug);
  const nameKey = normalizeKey(company.name);
  const profile =
    configured[slugKey] ??
    configured[nameKey] ??
    DEFAULT_METRICS_PROFILES[slugKey] ??
    DEFAULT_METRICS_PROFILES[nameKey] ?? {
      enabled: true,
      accountName: company.name,
      objective: "CONVERSACIONES" as const,
      primaryColor: "#4330A6",
      secondaryColor: "#7C5BFF",
      textColor: "#FFFFFF",
    };

  const settings = company.modules.metrics.settings;

  return {
    ...profile,
    enabled: true,
    accountName: settings.accountName ?? profile.accountName,
    mailchimpName: settings.mailchimpName ?? profile.mailchimpName,
    objective: settings.objective ?? profile.objective,
    clientsSheetUrl: settings.clientsSheetUrl ?? profile.clientsSheetUrl,
    strategySheetUrl: settings.strategySheetUrl ?? profile.strategySheetUrl,
    metaSheetUrl: settings.metaSheetUrl ?? profile.metaSheetUrl,
    mailchimpSheetUrl: settings.mailchimpSheetUrl ?? profile.mailchimpSheetUrl,
  };
}

export function getRadarWorkspaceId(company: Company) {
  if (!company.modules.radar.enabled) return null;
  return company.modules.radar.settings.workspaceId ?? null;
}

export function resolveRadarCompanyForActor(
  companies: Company[],
  actor: UserProfile,
  internalWorkspaceId = "nexops",
) {
  if (actor.role === "platform_admin") {
    return (
      companies.find((company) => getRadarWorkspaceId(company) === internalWorkspaceId) ?? null
    );
  }

  if (!actor.companyId || !isClientRole(actor.role)) return null;
  return companies.find((company) => company.id === actor.companyId) ?? null;
}

export function buildPortalNavigation({
  active,
  modules,
  ticketCount,
}: {
  active: PortalModule | null;
  modules: CompanyModules;
  ticketCount?: number;
}): PortalNavigationItem[] {
  return [
    { href: "/portal", label: "Inicio", active: active === "home" },
    {
      href: "/portal/soporte",
      label: "Soporte",
      active: active === "support",
      badge: ticketCount,
    },
    ...(modules.metrics.enabled
      ? [{ href: "/portal/metricas", label: "Métricas", active: active === "metrics" }]
      : []),
    ...(modules.radar.enabled
      ? [{ href: "/portal/radar", label: "Radar", active: active === "radar" }]
      : []),
  ];
}
