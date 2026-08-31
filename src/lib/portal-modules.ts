import { Company } from "@/lib/ticketing";

export type PortalModule = "home" | "support" | "metrics";

export type MetricsCompanyProfile = {
  enabled: boolean;
  accountName: string;
  mailchimpName?: string;
  objective?: "CONVERSACIONES" | "LEADS" | "COMPRAS";
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
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
  const configured = getConfiguredProfiles(rawConfig);
  const slugKey = normalizeKey(company.slug);
  const nameKey = normalizeKey(company.name);
  const profile =
    configured[slugKey] ??
    configured[nameKey] ??
    DEFAULT_METRICS_PROFILES[slugKey] ??
    DEFAULT_METRICS_PROFILES[nameKey] ??
    null;

  return profile?.enabled ? profile : null;
}

export function buildPortalNavigation({
  active,
  metricsEnabled,
  ticketCount,
}: {
  active: PortalModule | null;
  metricsEnabled: boolean;
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
    ...(metricsEnabled
      ? [{ href: "/portal/metricas", label: "Métricas", active: active === "metrics" }]
      : []),
  ];
}
