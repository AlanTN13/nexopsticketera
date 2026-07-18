import {
  Company,
  TicketRecord,
  TicketStatus,
  UserProfile,
  areaLabels,
  isClientRole,
  priorityLabels,
  statusLabels,
} from "@/lib/ticketing";

export const NEXOPS_NOTIFICATION_EMAIL = "info@nexopstech.com";

export type NotificationEmail = {
  to: string;
  subject: string;
  preheader: string;
  heading: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  contentLabel?: string;
  content?: string;
  ticketUrl: string;
  idempotencyKey: string;
};

type TicketContext = {
  ticket: TicketRecord;
  actor: UserProfile;
  company: Company;
  creator: UserProfile;
  ticketUrl: string;
};

export function buildTicketCreatedNotification(
  context: TicketContext,
): NotificationEmail | null {
  if (!isClientRole(context.actor.role)) return null;
  if (sameEmail(context.actor.email, NEXOPS_NOTIFICATION_EMAIL)) return null;

  return {
    to: NEXOPS_NOTIFICATION_EMAIL,
    subject: `[NexOps] Nuevo ticket ${context.ticket.code}: ${context.ticket.title}`,
    preheader: `${context.company.name} creó el ticket ${context.ticket.code}.`,
    heading: "Nuevo ticket recibido",
    intro: "Un cliente creó una nueva solicitud en la Ticketera NexOps.",
    details: [
      { label: "Empresa", value: context.company.name },
      { label: "Usuario", value: context.actor.name },
      { label: "Ticket", value: context.ticket.code },
      { label: "Título", value: context.ticket.title },
      { label: "Prioridad", value: priorityLabels[context.ticket.priority] },
      { label: "Área", value: areaLabels[context.ticket.area] },
    ],
    contentLabel: "Descripción inicial",
    content: context.ticket.description,
    ticketUrl: context.ticketUrl,
    idempotencyKey: `ticket-created/${context.ticket.id}`,
  };
}

export function buildCommentNotification(
  context: TicketContext & { commentId: string; body: string; visibility: "external" | "internal" },
): NotificationEmail | null {
  if (context.visibility === "internal") return null;

  if (isClientRole(context.actor.role)) {
    if (sameEmail(context.actor.email, NEXOPS_NOTIFICATION_EMAIL)) return null;
    return {
      to: NEXOPS_NOTIFICATION_EMAIL,
      subject: `[NexOps] Nuevo mensaje en ${context.ticket.code}`,
      preheader: `${context.actor.name} respondió el ticket ${context.ticket.code}.`,
      heading: "Nuevo mensaje del cliente",
      intro: "Un cliente publicó un mensaje externo en la Ticketera NexOps.",
      details: [
        { label: "Respondió", value: context.actor.name },
        { label: "Empresa", value: context.company.name },
        { label: "Ticket", value: context.ticket.code },
        { label: "Título", value: context.ticket.title },
      ],
      contentLabel: "Mensaje",
      content: context.body,
      ticketUrl: context.ticketUrl,
      idempotencyKey: `client-comment/${context.commentId}`,
    };
  }

  if (!validEmail(context.creator.email) || sameEmail(context.actor.email, context.creator.email)) {
    return null;
  }

  return {
    to: context.creator.email,
    subject: `NexOps respondió tu ticket ${context.ticket.code}`,
    preheader: `${context.actor.name} respondió tu ticket ${context.ticket.code}.`,
    heading: "Nueva respuesta de NexOps",
    intro: "El equipo de NexOps publicó una respuesta en tu ticket.",
    details: [
      { label: "Ticket", value: context.ticket.code },
      { label: "Título", value: context.ticket.title },
      { label: "Respondió", value: context.actor.name },
    ],
    contentLabel: "Respuesta",
    content: context.body,
    ticketUrl: context.ticketUrl,
    idempotencyKey: `nexops-comment/${context.commentId}`,
  };
}

export function buildStatusChangedNotification(
  context: TicketContext & { previousStatus: TicketStatus; newStatus: TicketStatus },
): NotificationEmail | null {
  if (context.previousStatus === context.newStatus) return null;
  if (!validEmail(context.creator.email) || sameEmail(context.actor.email, context.creator.email)) {
    return null;
  }

  return {
    to: context.creator.email,
    subject: `Tu ticket ${context.ticket.code} cambió a ${statusLabels[context.newStatus]}`,
    preheader: `${context.ticket.code}: ${statusLabels[context.previousStatus]} → ${statusLabels[context.newStatus]}.`,
    heading: "Estado del ticket actualizado",
    intro: "NexOps actualizó el estado de tu solicitud.",
    details: [
      { label: "Ticket", value: context.ticket.code },
      { label: "Título", value: context.ticket.title },
      { label: "Estado anterior", value: statusLabels[context.previousStatus] },
      { label: "Estado nuevo", value: statusLabels[context.newStatus] },
    ],
    ticketUrl: context.ticketUrl,
    idempotencyKey: `ticket-status/${context.ticket.id}/${context.previousStatus}/${context.newStatus}`,
  };
}

export async function persistThenNotify<T>(
  persist: () => Promise<T>,
  notify: (result: T) => Promise<unknown>,
): Promise<T> {
  const result = await persist();
  try {
    await notify(result);
  } catch {
    // Notification delivery is deliberately best-effort; the persisted mutation wins.
  }
  return result;
}

export function validEmail(value: string | null | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function sameEmail(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}
