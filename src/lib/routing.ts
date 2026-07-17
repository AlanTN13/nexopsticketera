import type { TicketRecord } from "@/lib/ticketing";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_CODE_PATTERN = /^nex-[0-9]+$/i;

export function withActor(path: string, actorId: string) {
  void actorId;
  return path;
}

export function ticketDetailPath(basePath: string, ticket: Pick<TicketRecord, "code">) {
  return `${basePath}/tickets/${ticket.code.toLocaleLowerCase("en-US")}`;
}

export function parseTicketReference(reference: string) {
  const normalized = reference.trim().toLocaleLowerCase("en-US");
  if (UUID_PATTERN.test(normalized)) return { kind: "id" as const, value: normalized };
  if (TICKET_CODE_PATTERN.test(normalized)) return { kind: "code" as const, value: normalized.toLocaleUpperCase("en-US") };
  return null;
}
