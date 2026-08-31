"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAuthenticatedActorId, clearClientSession, isInternalActor } from "@/lib/auth";
import { addComment, createCompany, createTicket, createUser, getAppSnapshot, updateCompany, updateCompanyModules, updateTicketWorkflow, updateUser } from "@/lib/app-store";
import { COMPANY_PLANS, MAX_COMMENT_IMAGES, MAX_TICKET_CONTEXT_URLS, MAX_TICKET_IMAGES, TICKET_AREAS, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES, USER_ROLES, USER_STATUSES } from "@/lib/ticketing";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ticketDetailPath } from "@/lib/routing";
import { requireUserTitle } from "@/lib/validation";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function assertInSet<T extends readonly string[]>(value: string, allowed: T): T[number] {
  if (!allowed.includes(value)) {
    throw new Error(`Valor inválido para ${value}.`);
  }
  return value as T[number];
}

function getOptionalString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getContextUrls(formData: FormData) {
  const urls = Array.from({ length: MAX_TICKET_CONTEXT_URLS }, (_, index) =>
    getOptionalString(formData, `contextUrl${index + 1}`),
  ).filter(Boolean);

  return Array.from(new Set(urls));
}

function getTicketImageFiles(formData: FormData) {
  const files = Array.from({ length: MAX_TICKET_IMAGES }, (_, index) =>
    formData.get(`attachment${index + 1}`),
  ).filter((value): value is File => value instanceof File && value.size > 0);

  return files;
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

function buildSuccessRedirect(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}success=${encodeURIComponent(message)}`;
}

export type LoginClientState = {
  error: string | null;
};

export type MutationState = {
  error: string | null;
};

export async function loginClientAction(
  _prevState: LoginClientState,
  formData: FormData,
): Promise<LoginClientState> {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  if (!password) {
    return { error: "Ingresá tu contraseña para continuar." };
  }

  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "Credenciales inválidas. Revisá tu email y contraseña." };
  }

  const db = await getAppSnapshot();
  const actor = db.users.find((user) => user.id === data.user.id) ?? null;
  if (!actor || actor.status !== "active") {
    await client.auth.signOut();
    return { error: "La cuenta no está habilitada para ingresar. Contactá a NexOps." };
  }

  redirect(isInternalActor(actor) ? routeWithActor("/backoffice", actor.id) : "/portal");
}

export async function logoutClientAction() {
  await clearClientSession();
  redirect("/portal/login");
}

export async function createTicketAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const impactLabels: Record<string, string> = {
    individual: "Individual — afecta a una persona",
    partial: "Parcial — afecta a un equipo o proceso",
    general: "General — afecta a toda la empresa u operación crítica",
  };
  const urgencyLabels: Record<string, string> = {
    can_wait: "Puede esperar",
    today: "Necesito resolverlo hoy",
    immediate: "Necesito atención inmediata",
  };
  const continuityLabels: Record<string, string> = {
    normal: "Sí, normalmente",
    workaround: "Sí, con una alternativa",
    blocked: "No, el trabajo está detenido",
  };
  const impact = getString(formData, "impact");
  const urgency = getString(formData, "urgency");
  const workContinuity = getString(formData, "workContinuity");
  const idempotencyKey = getString(formData, "idempotencyKey");

  if (!title || !description) {
    throw new Error("Título y descripción son obligatorios.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new Error("No pudimos validar este envío. Recargá la página e intentá nuevamente.");
  }

  let ticket;
  try {
    ticket = await createTicket({
      actorId: actor.id,
      idempotencyKey,
      title,
      description: `${description}\n\nContexto informado por el cliente\nImpacto: ${impactLabels[impact] ?? "No informado"}\nUrgencia: ${urgencyLabels[urgency] ?? "No informada"}\n¿Puede seguir trabajando?: ${continuityLabels[workContinuity] ?? "No informado"}`,
      contextUrls: getContextUrls(formData),
      attachments: getTicketImageFiles(formData),
      type: assertInSet(getString(formData, "type"), TICKET_TYPES),
      area: assertInSet(getString(formData, "area"), TICKET_AREAS),
      priority: "medium",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos crear el ticket." };
  }

  revalidatePath("/portal");
  revalidatePath("/portal/soporte");
  redirect(buildSuccessRedirect(ticketDetailPath("/portal", ticket), "Ticket creado correctamente."));
}

export type AddCommentState = { error: string | null };

export async function addCommentAction(_previousState: AddCommentState, formData: FormData): Promise<AddCommentState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const ticketId = getString(formData, "ticketId");
  const body = getString(formData, "body");

  if (!body) return { error: "El comentario no puede estar vacío." };

  const attachments = formData
    .getAll("commentImages")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_COMMENT_IMAGES + 1);

  try {
    await addComment({
      actorId: actor.id,
      ticketId,
      body,
      visibility: getString(formData, "visibility") === "internal" ? "internal" : "external",
      attachments,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos publicar el mensaje." };
  }

  const returnPath = getString(formData, "returnPath");
  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actor.id));
}

export async function updateTicketWorkflowAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const ticketId = getString(formData, "ticketId");
  const assignedToId = getString(formData, "assignedToId");
  const returnPath = getString(formData, "returnPath");

  try {
    await updateTicketWorkflow({
      actorId: actor.id,
      ticketId,
      status: assertInSet(getString(formData, "status"), TICKET_STATUSES),
      priority: assertInSet(getString(formData, "priority"), TICKET_PRIORITIES),
      assignedToId: assignedToId === "unassigned" ? null : assignedToId,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos guardar la gestión." };
  }

  revalidatePath(returnPath);
  redirect(buildPostActionRedirect(returnPath, actor.id));
}

export type CreateUserState = {
  error: string | null;
};

export async function createUserAction(
  _previousState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const companyIdValue = getString(formData, "companyId");
  const returnPath = getString(formData, "returnPath");

  try {
    const title = requireUserTitle(getString(formData, "title"));

    await createUser({
      actorId: actor.id,
      companyId: companyIdValue === "internal" ? null : companyIdValue,
      name: getString(formData, "name"),
      email: getString(formData, "email"),
      title,
      role: assertInSet(getString(formData, "role"), USER_ROLES),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No pudimos crear el usuario. Revisá los datos e intentá de nuevo.";

    return { error: message };
  }

  revalidatePath(returnPath);
  redirect(buildSuccessRedirect(buildPostActionRedirect(returnPath, actor.id), "Usuario creado correctamente."));
}

export async function createCompanyAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const returnPath = getString(formData, "returnPath");

  let createdCompanyId = "";

  try {
    const result = await createCompany({
      actorId: actor.id,
      companyName: getString(formData, "companyName"),
      industry: getString(formData, "industry"),
      plan: assertInSet(getString(formData, "plan"), COMPANY_PLANS),
      adminName: getString(formData, "adminName"),
      adminEmail: getString(formData, "adminEmail"),
      adminTitle: getString(formData, "adminTitle"),
    });
    createdCompanyId = result.company.id;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No pudimos crear la empresa. Revisá los datos e intentá de nuevo.";

    return { error: message };
  }

  revalidatePath("/backoffice");
  revalidatePath(returnPath);
  const successPath = buildSuccessRedirect(
      buildPostActionRedirect(returnPath, actor.id),
      "Empresa creada correctamente.",
    );
  redirect(`${successPath}&created=${encodeURIComponent(createdCompanyId)}`);
}

export async function updateCompanyAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const companyId = getString(formData, "companyId");
  const returnPath = getString(formData, "returnPath") || `/backoffice/companies/${companyId}`;
  let nextPath = returnPath;

  try {
    const company = await updateCompany({
      actorId: actor.id,
      companyId,
      name: getString(formData, "name"),
      slug: getString(formData, "slug"),
      industry: getString(formData, "industry"),
      plan: assertInSet(getString(formData, "plan"), COMPANY_PLANS),
      status: getString(formData, "status") === "active" ? "active" : "onboarding",
      primaryContact: getString(formData, "primaryContact"),
    });

    nextPath = `/backoffice/companies/${company.slug}`;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No pudimos actualizar la empresa. Revisá los datos e intentá de nuevo.";

    return { error: message };
  }

  revalidatePath("/backoffice");
  revalidatePath(returnPath);
  revalidatePath(nextPath);
  redirect(buildSuccessRedirect(buildPostActionRedirect(nextPath, actor.id), "Empresa actualizada correctamente."));
}

export async function updateCompanyModulesAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const companyId = getString(formData, "companyId");
  const returnPath = getString(formData, "returnPath") || `/backoffice/companies/${companyId}`;

  try {
    await updateCompanyModules({
      actorId: actor.id,
      companyId,
      modules: {
        metrics: formData.has("metricsEnabled"),
        radar: formData.has("radarEnabled"),
      },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No pudimos actualizar los productos de la empresa.",
    };
  }

  revalidatePath("/portal");
  revalidatePath("/portal/metricas");
  revalidatePath("/portal/radar");
  revalidatePath(returnPath);
  redirect(
    buildSuccessRedirect(
      buildPostActionRedirect(returnPath, actor.id),
      "Productos habilitados actualizados.",
    ),
  );
}

export async function updateUserAction(formData: FormData): Promise<MutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const userId = getString(formData, "userId");
  const returnPath = getString(formData, "returnPath");

  try {
    await updateUser({
      actorId: actor.id,
      userId,
      name: getString(formData, "name"),
      email: getString(formData, "email"),
      title: getString(formData, "title"),
      role: assertInSet(getString(formData, "role"), USER_ROLES),
      status: assertInSet(getString(formData, "status"), USER_STATUSES),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No pudimos actualizar el usuario. Revisá los datos e intentá de nuevo.";

    return { error: message };
  }

  revalidatePath("/backoffice");
  revalidatePath(returnPath);
  redirect(buildSuccessRedirect(buildPostActionRedirect(returnPath, actor.id), "Usuario actualizado correctamente."));
}
