"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { LOCAL_CLIENT_PASSWORD, clearClientSession, findUserByEmail, isInternalActor, setClientSession } from "@/lib/auth";
import { addComment, createCompany, createTicket, createUser, getAppSnapshot, resetDemoDb, updateTicketWorkflow } from "@/lib/app-store";
import { COMPANY_PLANS, TICKET_AREAS, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES, USER_ROLES } from "@/lib/ticketing";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function assertInSet<T extends readonly string[]>(value: string, allowed: T): T[number] {
  if (!allowed.includes(value)) {
    throw new Error(`Valor inválido para ${value}.`);
  }
  return value as T[number];
}

function routeWithActor(path: string, actorId: string) {
  void actorId;
  return path;
}

function buildPostActionRedirect(path: string, actorId: string) {
  if (
    path === "/" ||
    path === "/login" ||
    path === "/portal/login" ||
    path.startsWith("/portal") ||
    path.startsWith("/backoffice") ||
    path.startsWith("/setup")
  ) {
    return path;
  }

  return routeWithActor(path, actorId);
}

function buildErrorRedirect(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export type LoginClientState = {
  error: string | null;
};

export async function resetDemoAction(formData: FormData) {
  getString(formData, "actorId");
  await resetDemoDb();
  redirect("/portal/login");
}

export async function loginClientAction(
  _prevState: LoginClientState,
  formData: FormData,
): Promise<LoginClientState> {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const db = await getAppSnapshot();
  const actor = findUserByEmail(db, email);

  if (!actor) {
    return { error: "No encontramos un usuario con ese email." };
  }

  if (!password) {
    return { error: "Ingresá tu contraseña para continuar." };
  }

  if (isSupabaseConfigured()) {
    const client = getSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "Credenciales inválidas. Revisá tu email y contraseña." };
    }
  } else if (password !== LOCAL_CLIENT_PASSWORD) {
    return { error: "Credenciales inválidas. Revisá tu email y contraseña." };
  }

  await setClientSession(actor.id);
  redirect(isInternalActor(actor) ? routeWithActor("/backoffice", actor.id) : "/portal");
}

export async function logoutClientAction() {
  await clearClientSession();
  redirect("/portal/login");
}

export async function createTicketAction(formData: FormData) {
  const actorId = getString(formData, "actorId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");

  if (!title || !description) {
    throw new Error("Título y descripción son obligatorios.");
  }

  await createTicket({
    actorId,
    title,
    description,
    type: assertInSet(getString(formData, "type"), TICKET_TYPES),
    area: assertInSet(getString(formData, "area"), TICKET_AREAS),
    priority: assertInSet(getString(formData, "priority"), TICKET_PRIORITIES),
  });

  revalidatePath("/portal");
  redirect("/portal");
}

export async function addCommentAction(formData: FormData) {
  const actorId = getString(formData, "actorId");
  const ticketId = getString(formData, "ticketId");
  const body = getString(formData, "body");

  if (!body) {
    throw new Error("El comentario no puede estar vacío.");
  }

  await addComment({
    actorId,
    ticketId,
    body,
    visibility: getString(formData, "visibility") === "internal" ? "internal" : "external",
  });

  const returnPath = getString(formData, "returnPath");
  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actorId));
}

export async function updateTicketWorkflowAction(formData: FormData) {
  const actorId = getString(formData, "actorId");
  const ticketId = getString(formData, "ticketId");
  const assignedToId = getString(formData, "assignedToId");
  const returnPath = getString(formData, "returnPath");

  await updateTicketWorkflow({
    actorId,
    ticketId,
    status: assertInSet(getString(formData, "status"), TICKET_STATUSES),
    priority: assertInSet(getString(formData, "priority"), TICKET_PRIORITIES),
    assignedToId: assignedToId === "unassigned" ? null : assignedToId,
  });

  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actorId));
}

export async function createUserAction(formData: FormData) {
  const actorId = getString(formData, "actorId");
  const companyIdValue = getString(formData, "companyId");
  const returnPath = getString(formData, "returnPath");

  await createUser({
    actorId,
    companyId: companyIdValue === "internal" ? null : companyIdValue,
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    title: getString(formData, "title"),
    role: assertInSet(getString(formData, "role"), USER_ROLES),
  });

  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actorId));
}

export async function createCompanyAction(formData: FormData) {
  const actorId = getString(formData, "actorId");
  const returnPath = getString(formData, "returnPath");

  try {
    await createCompany({
      actorId,
      companyName: getString(formData, "companyName"),
      industry: getString(formData, "industry"),
      plan: assertInSet(getString(formData, "plan"), COMPANY_PLANS),
      adminName: getString(formData, "adminName"),
      adminEmail: getString(formData, "adminEmail"),
      adminTitle: getString(formData, "adminTitle"),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No pudimos crear la empresa. Revisá los datos e intentá de nuevo.";

    redirect(buildErrorRedirect(returnPath || "/backoffice", message));
  }

  revalidatePath("/backoffice");
  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actorId));
}
