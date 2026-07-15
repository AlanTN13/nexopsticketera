import "server-only";

import { TicketDatabase, UserProfile, isClientRole, isInternalRole } from "@/lib/ticketing";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function getClientSessionActorId() {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function clearClientSession() {
  const client = await getSupabaseServerClient();
  await client.auth.signOut();
}

export async function getAuthenticatedClientActor(db: TicketDatabase) {
  const actor = await getAuthenticatedActor(db);
  if (!actor || !actor.companyId || !isClientRole(actor.role)) {
    return null;
  }

  return actor;
}

export async function getAuthenticatedActor(db: TicketDatabase) {
  const actorId = await getClientSessionActorId();
  if (!actorId) return null;

  return db.users.find((user) => user.id === actorId) ?? null;
}

export async function requireAuthenticatedActor(db: TicketDatabase) {
  const actor = await getAuthenticatedActor(db);
  if (!actor) {
    throw new Error("Tu sesión no es válida o venció. Volvé a iniciar sesión.");
  }

  return actor;
}

export async function assertAuthenticatedActorId(db: TicketDatabase, actorId: string) {
  const actor = await requireAuthenticatedActor(db);
  if (actor.id !== actorId) {
    throw new Error("La operación no coincide con la sesión autenticada.");
  }

  return actor;
}

export function getClientUsers(db: TicketDatabase): UserProfile[] {
  return db.users.filter((user) => user.companyId && isClientRole(user.role));
}

export function isInternalActor(actor: UserProfile | null) {
  return Boolean(actor && isInternalRole(actor.role));
}

export async function getAuthenticatedInternalActor(db: TicketDatabase) {
  const actor = await getAuthenticatedActor(db);
  if (!actor || !isInternalRole(actor.role)) {
    return null;
  }

  return actor;
}
