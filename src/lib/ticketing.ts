export const TICKET_TYPES = ["issue", "improvement"] as const;
export const COMPANY_PLANS = ["starter", "growth", "enterprise"] as const;
export const TICKET_AREAS = [
  "automation",
  "custom_system",
  "website",
  "ai_agent",
  "crm",
  "erp",
] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TICKET_STATUSES = [
  "new",
  "analysis",
  "in_progress",
  "waiting_for_client",
  "resolved",
  "closed",
] as const;
export const USER_ROLES = [
  "client_admin",
  "client_operator",
  "client_viewer",
  "agent",
  "team_lead",
  "platform_admin",
] as const;
export const USER_STATUSES = ["active", "invited", "disabled"] as const;
export const OPTIONAL_PORTAL_MODULES = ["metrics", "radar"] as const;
export const MAX_TICKET_IMAGES = 3;
export const MAX_COMMENT_IMAGES = 3;
export const MAX_COMMENT_IMAGE_BYTES = 10 * 1024 * 1024;
export const COMMENT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TICKET_CONTEXT_URLS = 3;

export type TicketType = (typeof TICKET_TYPES)[number];
export type CompanyPlan = (typeof COMPANY_PLANS)[number];
export type TicketArea = (typeof TICKET_AREAS)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type OptionalPortalModule = (typeof OPTIONAL_PORTAL_MODULES)[number];

export type PortalModuleSettings = {
  metrics: {
    accountName?: string;
    mailchimpName?: string;
    objective?: "CONVERSACIONES" | "LEADS" | "COMPRAS";
    clientsSheetUrl?: string;
    strategySheetUrl?: string;
    metaSheetUrl?: string;
    mailchimpSheetUrl?: string;
  };
  radar: {
    workspaceId?: string;
    topics?: string[];
    publicationsPerWeek?: number;
    opportunityBehavior?: "discard" | "suggest";
    publishingMode?: "review" | "automatic";
    siteIntegrated?: boolean;
  };
};

export type CompanyModuleEntitlement<Module extends OptionalPortalModule> = {
  enabled: boolean;
  settings: PortalModuleSettings[Module];
};

export type CompanyModules = {
  [Module in OptionalPortalModule]: CompanyModuleEntitlement<Module>;
};

export type CompanyModuleAvailability = Record<OptionalPortalModule, boolean>;

export type Company = {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  industry: string;
  status: "active" | "onboarding";
  primaryContact: string;
  modules: CompanyModules;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  title: string;
  avatar: string;
};

export type TicketAttachment = {
  id: string;
  ticketId: string;
  name: string;
  sizeLabel: string;
  kind: "brief" | "screenshot" | "log";
  commentId: string | null;
  url: string;
};

export type TicketComment = {
  id: string;
  ticketId: string;
  authorId: string;
  visibility: "external" | "internal";
  body: string;
  createdAt: string;
};

export type TicketHistoryEntry = {
  id: string;
  ticketId: string;
  actorId: string;
  type: "created" | "status_changed" | "priority_changed" | "assigned" | "commented";
  message: string;
  createdAt: string;
};

export type TicketRecord = {
  id: string;
  code: string;
  companyId: string;
  title: string;
  description: string;
  contextUrls: string[];
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
  status: TicketStatus;
  createdById: string;
  assignedToId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketDatabase = {
  companies: Company[];
  users: UserProfile[];
  tickets: TicketRecord[];
  comments: TicketComment[];
  attachments: TicketAttachment[];
  history: TicketHistoryEntry[];
};

export const typeLabels: Record<TicketType, string> = {
  issue: "Problema",
  improvement: "Mejora",
};

export const areaLabels: Record<TicketArea, string> = {
  automation: "Automatizaciones",
  custom_system: "Sistema personalizado",
  website: "Sitios web",
  ai_agent: "Agentes IA",
  crm: "CRM",
  erp: "ERP",
};

export const companyPlanLabels: Record<CompanyPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export const statusLabels: Record<TicketStatus, string> = {
  new: "Nuevo",
  analysis: "En análisis",
  in_progress: "En progreso",
  waiting_for_client: "Esperando al cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const roleLabels: Record<UserRole, string> = {
  client_admin: "Cliente admin",
  client_operator: "Cliente operador",
  client_viewer: "Cliente lector",
  agent: "Agente",
  team_lead: "Líder",
  platform_admin: "Admin plataforma",
};

export function isClientRole(role: UserRole) {
  return role.startsWith("client_");
}

export function isInternalRole(role: UserRole) {
  return !isClientRole(role);
}

export function isActiveUser(user: UserProfile | null): user is UserProfile {
  return user?.status === "active";
}

export function canAssignUserRole(
  actor: UserProfile,
  targetCompanyId: string | null,
  role: UserRole,
) {
  if (!isActiveUser(actor) || !isRoleCompatibleWithCompany(role, targetCompanyId)) {
    return false;
  }

  if (targetCompanyId === null) {
    return actor.role === "platform_admin";
  }

  return (
    actor.role === "platform_admin" ||
    actor.role === "team_lead" ||
    (actor.role === "client_admin" && actor.companyId === targetCompanyId)
  );
}

export function canChangeUserRole(
  actor: UserProfile,
  target: UserProfile,
  role: UserRole,
) {
  if (actor.id === target.id) {
    return role === target.role;
  }

  return canAssignUserRole(actor, target.companyId, role);
}

export function canCreateTickets(role: UserRole) {
  return role === "client_admin" || role === "client_operator";
}

export function canCommentOnTickets(role: UserRole) {
  return canCreateTickets(role) || isInternalRole(role);
}

export function canManageCompanyUsers(role: UserRole) {
  return role === "client_admin" || role === "platform_admin";
}

export function canManageOperations(role: UserRole) {
  return role === "agent" || role === "team_lead" || role === "platform_admin";
}

export function canManageGlobalCatalog(role: UserRole) {
  return role === "team_lead" || role === "platform_admin";
}

export function isRoleCompatibleWithCompany(role: UserRole, companyId: string | null) {
  return companyId ? isClientRole(role) : isInternalRole(role);
}

export function formatRelativeDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

export function getTicketNextStep(ticket: TicketRecord) {
  switch (ticket.status) {
    case "new":
      return "NexOps debe revisar y clasificar la solicitud.";
    case "analysis":
      return "NexOps está definiendo el abordaje.";
    case "in_progress":
      return ticket.assignedToId
        ? "NexOps continúa con la resolución."
        : "NexOps debe asignar un responsable.";
    case "waiting_for_client":
      return "El cliente debe responder o aportar información.";
    case "resolved":
      return "El cliente debe confirmar si quedó resuelto.";
    case "closed":
      return "Sin acciones pendientes.";
  }
}

export function translateHistoryMessage(message: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bin_progress\b/g, "En progreso"],
    [/\bwaiting_for_client\b/g, "Esperando al cliente"],
    [/\banalysis\b/g, "En análisis"],
    [/\bresolved\b/g, "Resuelto"],
    [/\bclosed\b/g, "Cerrado"],
    [/\bnew\b/g, "Nuevo"],
    [/\bcritical\b/g, "Crítica"],
    [/\bhigh\b/g, "Alta"],
    [/\bmedium\b/g, "Media"],
    [/\blow\b/g, "Baja"],
  ];

  return replacements.reduce(
    (translated, [pattern, label]) => translated.replace(pattern, label),
    message,
  );
}
