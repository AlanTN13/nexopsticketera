import { Company, CompanyModules, UserProfile, isClientRole } from "@/lib/ticketing";
import { hasModuleAccess } from "@/lib/authorization";

export type PortalModule = "home" | "support" | "metrics" | "radar" | "content";

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

export function resolveContentCompanyForActor(
  companies: Company[],
  actor: UserProfile,
  companyLookup?: string,
) {
  const company = isClientRole(actor.role)
    ? companies.find((item) => item.id === actor.companyId)
    : companyLookup
      ? companies.find((item) => item.id === companyLookup || item.slug === companyLookup)
      : undefined;
  if (!company || !hasModuleAccess(actor, company, "content", "view")) return null;
  return company;
}

export function resolveMetricsCompanyForActor(
  companies: Company[],
  actor: UserProfile,
  companyLookup?: string,
) {
  const company = isClientRole(actor.role)
    ? companies.find((item) => item.id === actor.companyId)
    : companyLookup
      ? companies.find((item) => item.id === companyLookup || item.slug === companyLookup)
      : companies.find((item) => hasModuleAccess(actor, item, "metrics", "view"));
  if (!company || !hasModuleAccess(actor, company, "metrics", "view")) return null;
  return company;
}

export function resolveRadarCompanyForActor(
  companies: Company[],
  actor: UserProfile,
  companyLookup?: string,
) {
  const company = isClientRole(actor.role)
    ? companies.find((item) => item.id === actor.companyId)
    : companyLookup
      ? companies.find((item) => item.id === companyLookup || item.slug === companyLookup)
      : undefined;
  if (!company || !hasModuleAccess(actor, company, "radar", "view")) return null;
  return company;
}

export function getVisibleCompanyModules(actor: UserProfile, company: Company): CompanyModules {
  return {
    support: {
      ...company.modules.support,
      enabled: hasModuleAccess(actor, company, "support", "view"),
    },
    metrics: {
      ...company.modules.metrics,
      enabled: hasModuleAccess(actor, company, "metrics", "view"),
    },
    radar: {
      ...company.modules.radar,
      enabled: hasModuleAccess(actor, company, "radar", "view"),
    },
    content: {
      ...company.modules.content,
      enabled: hasModuleAccess(actor, company, "content", "view"),
    },
  };
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
    ...(modules.support.enabled
      ? [{
          href: "/portal/soporte",
          label: "Soporte",
          active: active === "support",
          badge: ticketCount,
        }]
      : []),
    ...(modules.metrics.enabled
      ? [{ href: "/portal/metricas", label: "Métricas", active: active === "metrics" }]
      : []),
    ...(modules.radar.enabled
      ? [{ href: "/portal/radar", label: "Radar", active: active === "radar" }]
      : []),
    ...(modules.content.enabled
      ? [{ href: "/portal/contenido/fuentes", label: "Contenido", active: active === "content" }]
      : []),
  ];
}
