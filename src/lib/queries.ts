import {
  Company,
  TicketComment,
  TicketDatabase,
  TicketHistoryEntry,
  TicketRecord,
  TicketStatus,
  UserProfile,
  areaLabels,
  canManageGlobalCatalog,
  canManageOperations,
  isInternalRole,
  isClientRole,
} from "@/lib/ticketing";
import { parseTicketReference } from "@/lib/routing";
import { hasModuleAccess } from "@/lib/authorization";

export function getVisibleTickets(db: TicketDatabase, actor: UserProfile) {
  return db.tickets.filter((ticket) => {
    const company = db.companies.find((item) => item.id === ticket.companyId);
    return company ? hasModuleAccess(actor, company, "support", "view") : false;
  });
}

export function getVisibleComments(
  db: TicketDatabase,
  actor: UserProfile,
  ticketId: string,
) {
  if (!getTicketById(db, actor, ticketId)) {
    return [];
  }

  return db.comments
    .filter((comment) => {
      if (comment.ticketId !== ticketId) return false;
      if (comment.visibility === "external") return true;
      return canManageOperations(actor.role);
    })
    .sort((left, right) => {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
}

export function getVisibleCommentAttachments(db: TicketDatabase, actor: UserProfile, ticketId: string) {
  const visibleCommentIds = new Set(getVisibleComments(db, actor, ticketId).map((comment) => comment.id));
  return db.attachments.filter((attachment) =>
    attachment.ticketId === ticketId
    && attachment.commentId !== null
    && visibleCommentIds.has(attachment.commentId),
  );
}

export function getTicketHistory(db: TicketDatabase, ticketId: string) {
  return db.history.filter((entry) => entry.ticketId === ticketId);
}

export function getTicketById(db: TicketDatabase, actor: UserProfile, ticketId: string) {
  return getVisibleTickets(db, actor).find((ticket) => ticket.id === ticketId) ?? null;
}

export function getTicketByReference(
  db: TicketDatabase,
  actor: UserProfile,
  reference: string,
) {
  const parsedReference = parseTicketReference(reference);
  if (!parsedReference) return null;

  return getVisibleTickets(db, actor).find((ticket) => {
    if (parsedReference.kind === "id") {
      return ticket.id.toLocaleLowerCase("en-US") === parsedReference.value;
    }

    return ticket.code.toLocaleUpperCase("en-US") === parsedReference.value;
  }) ?? null;
}

export function getCompany(db: TicketDatabase, companyId: string | null) {
  return db.companies.find((company) => company.id === companyId) ?? null;
}

export function getCompanyBySlug(db: TicketDatabase, companySlug: string | null) {
  return db.companies.find((company) => company.slug === companySlug) ?? null;
}

export function getCompanyBySlugOrId(db: TicketDatabase, companyLookup: string | null) {
  return (
    getCompanyBySlug(db, companyLookup) ??
    getCompany(db, companyLookup)
  );
}

export function getUser(db: TicketDatabase, userId: string | null) {
  return db.users.find((user) => user.id === userId) ?? null;
}

export function getUsersForCompany(db: TicketDatabase, companyId: string | null) {
  if (!companyId) return [];
  return db.users.filter((user) => user.companyId === companyId);
}

export function getClientUsersForCompany(db: TicketDatabase, companyId: string | null) {
  if (!companyId) return [];
  return db.users.filter((user) => user.companyId === companyId && isClientRole(user.role));
}

export function getInternalUsers(db: TicketDatabase) {
  return db.users.filter((user) => !isClientRole(user.role));
}

export function getInternalDirectoryUsers(db: TicketDatabase) {
  return db.users.filter((user) => isInternalRole(user.role));
}

export function getTicketsForCompany(db: TicketDatabase, companyId: string | null) {
  if (!companyId) return [];
  return db.tickets.filter((ticket) => ticket.companyId === companyId);
}

export function buildPortalStats(tickets: TicketRecord[]) {
  const openStatuses: TicketStatus[] = ["new", "analysis", "in_progress", "waiting_for_client"];
  return {
    total: tickets.length,
    open: tickets.filter((ticket) => openStatuses.includes(ticket.status)).length,
    critical: tickets.filter((ticket) => ticket.priority === "critical").length,
    areas: new Set(tickets.map((ticket) => areaLabels[ticket.area])).size,
  };
}

export function buildBackofficeStats(tickets: TicketRecord[], companies: Company[]) {
  return {
    activeTickets: tickets.filter((ticket) => ticket.status !== "closed").length,
    highPriority: tickets.filter(
      (ticket) => ticket.priority === "high" || ticket.priority === "critical",
    ).length,
    waitingCustomer: tickets.filter((ticket) => ticket.status === "waiting_for_client").length,
    companies: companies.length,
  };
}

export function filterTickets(
  tickets: TicketRecord[],
  filters: {
    status?: string | string[];
    area?: string | string[];
    priority?: string | string[];
    companyId?: string | string[];
    assignedToId?: string | string[];
    query?: string;
  },
) {
  const selected = (value?: string | string[]) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.filter((item) => item && item !== "all");
  };

  const statuses = selected(filters.status);
  const areas = selected(filters.area);
  const priorities = selected(filters.priority);
  const companyIds = selected(filters.companyId);
  const assigneeIds = selected(filters.assignedToId);

  return tickets.filter((ticket) => {
    if (filters.query) {
      const query = filters.query.trim().toLocaleLowerCase("es");
      const searchable = `${ticket.code} ${ticket.title}`.toLocaleLowerCase("es");
      if (query && !searchable.includes(query)) {
        return false;
      }
    }
    if (statuses.length && !statuses.includes(ticket.status)) {
      return false;
    }
    if (areas.length && !areas.includes(ticket.area)) {
      return false;
    }
    if (priorities.length && !priorities.includes(ticket.priority)) {
      return false;
    }
    if (companyIds.length && !companyIds.includes(ticket.companyId)) {
      return false;
    }
    if (assigneeIds.length && !assigneeIds.includes(ticket.assignedToId ?? "unassigned")) {
      return false;
    }
    return true;
  });
}

export function sortTickets(tickets: TicketRecord[]) {
  return [...tickets].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function buildTicketTimeline(
  comments: TicketComment[],
  history: TicketHistoryEntry[],
) {
  return [...comments, ...history].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function canAccessCompanyUsers(actor: UserProfile, companyId: string | null) {
  if (!companyId) return canManageGlobalCatalog(actor.role);
  return canManageGlobalCatalog(actor.role) || (actor.role === "client_admin" && actor.companyId === companyId);
}
