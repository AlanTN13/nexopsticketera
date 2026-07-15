import {
  TicketRecord,
  UserProfile,
  canCommentOnTickets,
  canCreateTickets,
  canManageOperations,
  isInternalRole,
} from "@/lib/ticketing";

export function canAccessCompany(actor: UserProfile, companyId: string) {
  return isInternalRole(actor.role) || actor.companyId === companyId;
}

export function canAccessTicket(actor: UserProfile, ticket: TicketRecord) {
  return canAccessCompany(actor, ticket.companyId);
}

export function canCreateCompanyTicket(actor: UserProfile, companyId: string) {
  return actor.companyId === companyId && canCreateTickets(actor.role);
}

export function canCommentOnTicket(
  actor: UserProfile,
  ticket: TicketRecord,
  visibility: "external" | "internal",
) {
  if (!canAccessTicket(actor, ticket) || !canCommentOnTickets(actor.role)) {
    return false;
  }

  return visibility === "external" || isInternalRole(actor.role);
}

export function canUpdateTicketWorkflow(actor: UserProfile) {
  return canManageOperations(actor.role);
}

export function canAccessBackoffice(actor: UserProfile) {
  return isInternalRole(actor.role);
}
