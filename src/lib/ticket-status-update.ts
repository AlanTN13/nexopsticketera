import { canUpdateTicketWorkflow } from "@/lib/authorization";
import { TICKET_STATUSES, type TicketDatabase, type TicketStatus, type UserProfile } from "@/lib/ticketing";

export const MAX_STATUS_UPDATE_TICKETS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateStatusUpdate(ids: unknown, status: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_STATUS_UPDATE_TICKETS ||
      ids.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new Error(`Seleccioná entre 1 y ${MAX_STATUS_UPDATE_TICKETS} tickets válidos.`);
  }
  if (typeof status !== "string" || !TICKET_STATUSES.includes(status as TicketStatus)) {
    throw new Error("Seleccioná un estado válido.");
  }
  return { ticketIds: [...new Set(ids as string[])], status: status as TicketStatus };
}

export function authorizeStatusUpdate(db: TicketDatabase, actor: UserProfile, ticketIds: string[]) {
  return ticketIds.map((id) => {
    const ticket = db.tickets.find((item) => item.id === id);
    const company = ticket && db.companies.find((item) => item.id === ticket.companyId);
    if (!ticket || !company || !canUpdateTicketWorkflow(actor, company)) {
      throw new Error("No tenés permisos para actualizar la selección. Actualizá el listado.");
    }
    return ticket;
  });
}
