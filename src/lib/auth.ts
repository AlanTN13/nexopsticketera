import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getBackendMode } from "@/lib/backend";
import { TicketDatabase, UserProfile, isClientRole, isInternalRole } from "@/lib/ticketing";

export const CLIENT_SESSION_COOKIE = "nexops_session";
export const LEGACY_CLIENT_SESSION_COOKIE = "nexops_client_actor";
export const LOCAL_CLIENT_PASSWORD = "NexOps2026!";

type SessionPayload = {
  actorId: string;
  exp: number;
  mode: "demo" | "supabase";
};

function getSessionSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_CLIENT_PASSWORD;
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function encodeSessionPayload(payload: SessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signSessionPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSessionPayload(value: string | undefined | null): SessionPayload | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;

    if (!payload.actorId || !payload.exp || !payload.mode) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getClientSessionActorId() {
  const cookieStore = await cookies();
  const payload = decodeSessionPayload(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);

  if (!payload) {
    return null;
  }

  if (payload.mode !== getBackendMode()) {
    return null;
  }

  return payload.actorId;
}

export async function setClientSession(actorId: string) {
  const cookieStore = await cookies();
  const value = encodeSessionPayload({
    actorId,
    exp: Date.now() + 1000 * 60 * 60 * 12,
    mode: getBackendMode(),
  });

  cookieStore.set(CLIENT_SESSION_COOKIE, value, {
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
  cookieStore.delete(LEGACY_CLIENT_SESSION_COOKIE);
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

export async function assertAuthenticatedActorId(
  db: TicketDatabase,
  actorId: string,
) {
  const actor = await requireAuthenticatedActor(db);
  if (actor.id !== actorId) {
    throw new Error("La operación no coincide con la sesión autenticada.");
  }

  return actor;
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

export async function getAuthenticatedInternalActor(db: TicketDatabase) {
  const actor = await getAuthenticatedActor(db);
  if (!actor || !isInternalRole(actor.role)) {
    return null;
  }

  return actor;
}
