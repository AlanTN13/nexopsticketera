import "server-only";

import { cookies } from "next/headers";

import { TicketDatabase, UserProfile, isClientRole, isInternalRole } from "@/lib/ticketing";

export const CLIENT_SESSION_COOKIE = "nexops_client_actor";
export const LOCAL_CLIENT_PASSWORD = "NexOps2026!";

export async function getClientSessionActorId() {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_SESSION_COOKIE)?.value ?? null;
}

export async function setClientSession(actorId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_SESSION_COOKIE, actorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearClientSession() {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_SESSION_COOKIE);
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

export function getClientUsers(db: TicketDatabase): UserProfile[] {
  return db.users.filter((user) => user.companyId && isClientRole(user.role));
}

export function findClientUserByEmail(db: TicketDatabase, email: string) {
  return (
    db.users.find(
      (user) =>
        user.companyId &&
        isClientRole(user.role) &&
        user.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

export function findUserByEmail(db: TicketDatabase, email: string) {
  return (
    db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export function isInternalActor(actor: UserProfile | null) {
  return Boolean(actor && isInternalRole(actor.role));
}
