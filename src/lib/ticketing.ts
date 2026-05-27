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

export type TicketType = (typeof TICKET_TYPES)[number];
export type CompanyPlan = (typeof COMPANY_PLANS)[number];
export type TicketArea = (typeof TICKET_AREAS)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export type Company = {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  industry: string;
  status: "active" | "onboarding";
  primaryContact: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "invited";
  title: string;
  avatar: string;
};

export type TicketAttachment = {
  id: string;
  ticketId: string;
  name: string;
  sizeLabel: string;
  kind: "brief" | "screenshot" | "log";
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
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
  status: TicketStatus;
  createdById: string;
  assignedToId: string | null;
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
  issue: "Issue",
  improvement: "Mejora",
};

export const areaLabels: Record<TicketArea, string> = {
  automation: "Automatizaciones",
  custom_system: "Sistema custom",
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
  waiting_for_client: "Esperando cliente",
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

export function canCreateTickets(role: UserRole) {
  return role === "client_admin" || role === "client_operator";
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

export function formatRelativeDate(dateString: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}
