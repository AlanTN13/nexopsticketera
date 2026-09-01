import {
  Company,
  ModuleAccessLevel,
  PortalModuleKey,
  TicketRecord,
  UserProfile,
  canManageOperations,
  isInternalRole,
} from "@/lib/ticketing";

export function canAccessCompany(actor: UserProfile, companyId: string) {
  if (actor.status !== "active") return false;
  if (actor.role === "platform_admin") return true;
  if (isInternalRole(actor.role)) {
    return actor.assignedCompanyIds?.includes(companyId) ?? false;
  }
  return actor.companyId === companyId;
}

const LEVEL_RANK: Record<ModuleAccessLevel, number> = {
  none: 0,
  view: 1,
  operate: 2,
  admin: 3,
};

export function moduleLevelSatisfies(
  actual: ModuleAccessLevel,
  required: Exclude<ModuleAccessLevel, "none">,
) {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

export function getEffectiveModuleAccess(
  actor: UserProfile,
  company: Company,
  module: PortalModuleKey,
): ModuleAccessLevel {
  if (
    actor.status !== "active" ||
    !canAccessCompany(actor, company.id) ||
    !company.modules[module].enabled
  ) {
    return "none";
  }

  if (actor.role === "platform_admin") return "admin";

  return (
    actor.modulePermissions?.find(
      (permission) =>
        permission.companyId === company.id && permission.module === module,
    )?.level ?? "none"
  );
}

export function hasModuleAccess(
  actor: UserProfile,
  company: Company,
  module: PortalModuleKey,
  required: Exclude<ModuleAccessLevel, "none">,
) {
  return moduleLevelSatisfies(
    getEffectiveModuleAccess(actor, company, module),
    required,
  );
}

export function canAccessTicket(actor: UserProfile, ticket: TicketRecord, company: Company) {
  return ticket.companyId === company.id && hasModuleAccess(actor, company, "support", "view");
}

export function canCreateCompanyTicket(actor: UserProfile, company: Company) {
  return (
    actor.companyId === company.id &&
    hasModuleAccess(actor, company, "support", "operate")
  );
}

export function canCommentOnTicket(
  actor: UserProfile,
  ticket: TicketRecord,
  company: Company,
  visibility: "external" | "internal",
) {
  if (
    !canAccessTicket(actor, ticket, company) ||
    !hasModuleAccess(actor, company, "support", "operate")
  ) {
    return false;
  }

  return visibility === "external" || isInternalRole(actor.role);
}

export function canUpdateTicketWorkflow(actor: UserProfile, company: Company) {
  return canManageOperations(actor.role) && hasModuleAccess(actor, company, "support", "operate");
}

export function canAccessBackoffice(actor: UserProfile) {
  return actor.status === "active" && isInternalRole(actor.role);
}

export function canManageAccessControl(actor: UserProfile) {
  return actor.status === "active" && actor.role === "platform_admin";
}

export function canAccessPlatformRadar(actor: UserProfile) {
  return actor.status === "active" && actor.role === "platform_admin";
}
