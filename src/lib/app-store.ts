import "server-only";

import { PostgrestError } from "@supabase/supabase-js";

import { canCommentOnTicket, canCreateCompanyTicket, canUpdateTicketWorkflow } from "@/lib/authorization";
import { getPublicAppUrl, sendNotificationEmail } from "@/lib/email-service";
import {
  buildCommentNotification,
  buildStatusChangedNotification,
  buildTicketCreatedNotification,
} from "@/lib/notification-events";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { parseTicketReference, ticketDetailPath } from "@/lib/routing";
import {
  Company,
  CompanyPlan,
  MAX_TICKET_CONTEXT_URLS,
  MAX_TICKET_IMAGES,
  TicketArea,
  TicketAttachment,
  TicketComment,
  TicketDatabase,
  TicketHistoryEntry,
  TicketPriority,
  TicketRecord,
  TicketStatus,
  TicketType,
  UserProfile,
  UserRole,
  canManageGlobalCatalog,
  isClientRole,
  isRoleCompatibleWithCompany,
} from "@/lib/ticketing";
import { requireUserTitle } from "@/lib/validation";

export type CreateTicketInput = {
  actorId: string;
  title: string;
  description: string;
  contextUrls: string[];
  attachments: File[];
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
};

export type AddCommentInput = {
  actorId: string;
  ticketId: string;
  body: string;
  visibility: "external" | "internal";
};

export type UpdateTicketWorkflowInput = {
  actorId: string;
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToId: string | null;
};

export type CreateUserInput = {
  actorId: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password: string;
};

export type UpdateUserInput = {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password?: string;
};

export type CreateCompanyInput = {
  actorId: string;
  companyName: string;
  industry: string;
  plan: CompanyPlan;
  adminName: string;
  adminEmail: string;
  adminTitle: string;
  adminPassword: string;
};

export type UpdateCompanyInput = {
  actorId: string;
  companyId: string;
  name: string;
  slug: string;
  industry: string;
  plan: CompanyPlan;
  status: "active" | "onboarding";
  primaryContact: string;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  industry: string | null;
  status: string;
  primary_contact: string | null;
  created_at: string;
};

type UserRow = {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  title: string | null;
  avatar: string | null;
};

type TicketRow = {
  id: string;
  code: string;
  company_id: string;
  title: string;
  description: string;
  context_urls: string[] | null;
  type: string;
  area: string;
  priority: string;
  status: string;
  created_by_id: string;
  assigned_to_id: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  visibility: string;
  body: string;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  ticket_id: string;
  file_name: string;
  size_bytes: number;
  kind: "brief" | "screenshot" | "log";
  storage_path: string;
  created_at?: string;
};

type HistoryRow = {
  id: string;
  ticket_id: string;
  actor_id: string;
  event_type: string;
  message: string;
  created_at: string;
};

function ensureActor(db: TicketDatabase, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) {
    throw new Error("No pudimos encontrar el usuario actual.");
  }
  return actor;
}

function getNotificationContext(
  db: TicketDatabase,
  actor: UserProfile,
  ticket: TicketRecord,
  audience: "client" | "internal",
) {
  const company = db.companies.find((item) => item.id === ticket.companyId);
  const creator = db.users.find((user) => user.id === ticket.createdById);
  const appUrl = getPublicAppUrl();
  if (!company || !creator || !appUrl) return null;

  const basePath = audience === "internal" ? "/backoffice" : "/portal";
  return {
    ticket,
    actor,
    company,
    creator,
    ticketUrl: `${appUrl}${ticketDetailPath(basePath, ticket)}`,
  };
}

function avatarFromName(name: string) {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatBytes(size: number) {
  if (size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[unitIndex]}`;
}

function mapCompany(row: CompanyRow): Company {
  const plan = (["starter", "growth", "enterprise"].includes(row.plan)
    ? row.plan
    : "starter") as CompanyPlan;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan,
    industry: row.industry ?? "",
    status: row.status === "onboarding" ? "onboarding" : "active",
    primaryContact: row.primary_contact ?? "",
    createdAt: row.created_at,
  };
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    status: row.status === "active" ? "active" : "invited",
    title: row.title ?? "",
    avatar: row.avatar ?? avatarFromName(row.name),
  };
}

function mapTicket(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    code: row.code,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    contextUrls: Array.isArray(row.context_urls) ? row.context_urls : [],
    type: row.type as TicketType,
    area: row.area as TicketArea,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    createdById: row.created_by_id,
    assignedToId: row.assigned_to_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComment(row: CommentRow): TicketComment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    visibility: row.visibility === "internal" ? "internal" : "external",
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapHistory(row: HistoryRow): TicketHistoryEntry {
  const supportedTypes = new Set([
    "created",
    "status_changed",
    "priority_changed",
    "assigned",
    "commented",
  ]);

  return {
    id: row.id,
    ticketId: row.ticket_id,
    actorId: row.actor_id,
    type: supportedTypes.has(row.event_type) ? (row.event_type as TicketHistoryEntry["type"]) : "commented",
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    name: row.file_name,
    sizeLabel: formatBytes(row.size_bytes),
    kind: row.kind,
    url: row.storage_path,
  };
}

async function getSignedAttachmentUrl(storagePath: string) {
  if (!storagePath || storagePath.startsWith("seed/")) {
    return "#";
  }

  const client = await getSupabaseServerClient();
  const { data, error } = await client.storage
    .from("ticket-attachments")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    return "#";
  }

  return data.signedUrl;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const baseName = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const extension = dotIndex > 0 ? trimmed.slice(dotIndex).toLowerCase() : "";

  const safeBaseName =
    slugify(baseName).replace(/(^-|-$)/g, "") || "archivo";

  return `${safeBaseName}${extension}`;
}

async function uploadTicketImages(input: {
  ticketId: string;
  actorId: string;
  attachments: File[];
}): Promise<TicketAttachment[]> {
  if (input.attachments.length === 0) {
    return [];
  }

  if (input.attachments.length > MAX_TICKET_IMAGES) {
    throw new Error(`Solo podés adjuntar hasta ${MAX_TICKET_IMAGES} imágenes por ticket.`);
  }

  const client = await getSupabaseServerClient();
  const createdAttachments: TicketAttachment[] = [];

  for (const file of input.attachments) {
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `tickets/${input.ticketId}/${crypto.randomUUID()}-${safeFileName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await client.storage
      .from("ticket-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await client
      .from("ticket_attachments")
      .insert({
        ticket_id: input.ticketId,
        uploaded_by_id: input.actorId,
        storage_path: storagePath,
        file_name: file.name,
        size_bytes: file.size,
        kind: "screenshot",
      })
      .select("*")
      .single();

    if (error) {
      await client.storage.from("ticket-attachments").remove([storagePath]);
      throw new Error(error.message);
    }

    createdAttachments.push({
      id: String(data.id),
      ticketId: String(data.ticket_id),
      name: String(data.file_name),
      sizeLabel: formatBytes(Number(data.size_bytes ?? 0)),
      kind: "screenshot",
      url: await getSignedAttachmentUrl(String(data.storage_path)),
    });
  }

  return createdAttachments;
}

function assertNoError(error: PostgrestError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function assertData<T>(data: T | null, message: string): T {
  if (data === null) {
    throw new Error(message);
  }

  return data;
}

function assertRoleAssignment(role: UserRole, companyId: string | null) {
  if (!isRoleCompatibleWithCompany(role, companyId)) {
    if (companyId) {
      throw new Error("Los usuarios cliente deben conservar un rol cliente.");
    }

    throw new Error("Los usuarios internos no deben quedar asociados a una empresa cliente.");
  }
}

async function getSupabaseSnapshot(): Promise<TicketDatabase> {
  const client = await getSupabaseServerClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    return {
      companies: [],
      users: [],
      tickets: [],
      comments: [],
      attachments: [],
      history: [],
    };
  }

  const [companiesResult, usersResult, ticketsResult, commentsResult, attachmentsResult, historyResult] =
    await Promise.all([
      client.from("companies").select("*").order("created_at", { ascending: false }),
      client.from("users").select("*").order("created_at", { ascending: false }),
      client.from("tickets").select("*").order("updated_at", { ascending: false }),
      client.from("ticket_comments").select("*").order("created_at", { ascending: true }),
      client.from("ticket_attachments").select("*").order("created_at", { ascending: true }),
      client.from("ticket_history").select("*").order("created_at", { ascending: false }),
    ]);

  assertNoError(companiesResult.error);
  assertNoError(usersResult.error);
  assertNoError(ticketsResult.error);
  assertNoError(commentsResult.error);
  assertNoError(attachmentsResult.error);
  assertNoError(historyResult.error);

  const attachmentRows = (attachmentsResult.data ?? []) as AttachmentRow[];
  const signedAttachmentUrls = await Promise.all(
    attachmentRows.map((row) => getSignedAttachmentUrl(row.storage_path)),
  );

  return {
    companies: (companiesResult.data ?? []).map((row) => mapCompany(row as CompanyRow)),
    users: (usersResult.data ?? []).map((row) => mapUser(row as UserRow)),
    tickets: (ticketsResult.data ?? []).map((row) => mapTicket(row as TicketRow)),
    comments: (commentsResult.data ?? []).map((row) => mapComment(row as CommentRow)),
    attachments: attachmentRows.map((row, index) => ({
      ...mapAttachment(row),
      url: signedAttachmentUrls[index] ?? "#",
    })),
    history: (historyResult.data ?? []).map((row) => mapHistory(row as HistoryRow)),
  };
}

async function getVisibleTicketReferenceFromSupabase(reference: string) {
  const parsedReference = parseTicketReference(reference);
  if (!parsedReference) return null;

  const client = await getSupabaseServerClient();
  const query = client.from("tickets").select("id, code");
  const { data, error } = await (parsedReference.kind === "id"
    ? query.eq("id", parsedReference.value)
    : query.eq("code", parsedReference.value)
  ).maybeSingle();

  assertNoError(error);
  if (!data) return null;
  return { id: String(data.id), code: String(data.code) };
}

function assertContextUrls(contextUrls: string[]) {
  if (contextUrls.length > MAX_TICKET_CONTEXT_URLS) {
    throw new Error(`Solo podés adjuntar hasta ${MAX_TICKET_CONTEXT_URLS} links por ticket.`);
  }

  for (const item of contextUrls) {
    if (!item) {
      continue;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(item);
    } catch {
      throw new Error("Uno de los links asociados al ticket no es una URL válida.");
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Los links del ticket deben comenzar con http:// o https://.");
    }
  }
}

async function createTicketHistoryEntry(input: {
  ticketId: string;
  actorId: string;
  message: string;
}) {
  const client = await getSupabaseServerClient();
  const { error } = await client.from("ticket_history").insert({
    ticket_id: input.ticketId,
    actor_id: input.actorId,
    event_type: "created",
    message: input.message,
  });

  assertNoError(error);
}

async function createTicketResources(input: {
  ticketId: string;
  actorId: string;
  actorName: string;
  ticketCode: string;
  contextUrls: string[];
  attachments: File[];
}) {
  assertContextUrls(input.contextUrls);

  const uploadedAttachments = await uploadTicketImages({
    ticketId: input.ticketId,
    actorId: input.actorId,
    attachments: input.attachments,
  });

  const resourceNotes = [];
  if (input.contextUrls.length > 0) {
    resourceNotes.push(
      `${input.contextUrls.length} link${input.contextUrls.length === 1 ? "" : "s"} de contexto`,
    );
  }
  if (uploadedAttachments.length > 0) {
    resourceNotes.push(
      `${uploadedAttachments.length} imagen${uploadedAttachments.length === 1 ? "" : "es"} adjunta${uploadedAttachments.length === 1 ? "" : "s"}`,
    );
  }

  const baseMessage = `${input.actorName} creó el ticket ${input.ticketCode}`;
  const resourceMessage =
    resourceNotes.length > 0 ? ` y sumó ${resourceNotes.join(" y ")}` : "";

  await createTicketHistoryEntry({
    ticketId: input.ticketId,
    actorId: input.actorId,
    message: `${baseMessage}${resourceMessage}.`,
  });
}

async function createSupabaseUserProfile(input: {
  companyId: string | null;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  password: string;
}) {
  const client = await getSupabaseServerClient();
  const adminClient = getSupabaseAdminClient();
  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
    },
    app_metadata: {
      role: input.role,
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const authUser = authData.user;
  if (!authUser) {
    throw new Error("Supabase no devolvió el usuario creado.");
  }

  const profile = {
    id: authUser.id,
    company_id: input.companyId,
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role,
    status: "active",
    title: input.title,
    avatar: avatarFromName(input.name),
  };

  const { data, error } = await client
    .from("users")
    .insert(profile)
    .select("*")
    .single();

  if (error) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    throw new Error(error.message);
  }

  return mapUser(data as UserRow);
}

async function createTicketInSupabase(input: {
  actorId: string;
  title: string;
  description: string;
  contextUrls: string[];
  attachments: File[];
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  if (!actor.companyId || !canCreateCompanyTicket(actor, actor.companyId)) {
    throw new Error("Solo usuarios cliente pueden crear tickets en este entorno.");
  }

  assertContextUrls(input.contextUrls);

  const client = await getSupabaseServerClient();
  const payload = {
    company_id: actor.companyId,
    title: input.title,
    description: input.description,
    context_urls: input.contextUrls,
    type: input.type,
    area: input.area,
    priority: input.priority,
    status: "new",
    created_by_id: actor.id,
    assigned_to_id: null,
  };

  const { data: ticketData, error: ticketError } = await client
    .from("tickets")
    .insert(payload)
    .select("*")
    .single();

  assertNoError(ticketError);

  await createTicketResources({
    ticketId: String(ticketData.id),
    actorId: actor.id,
    actorName: actor.name,
    ticketCode: String(ticketData.code),
    contextUrls: input.contextUrls,
    attachments: input.attachments,
  });
  const ticket = mapTicket(ticketData as TicketRow);
  const notificationContext = getNotificationContext(db, actor, ticket, "internal");
  await sendNotificationEmail(
    notificationContext ? buildTicketCreatedNotification(notificationContext) : null,
  );

  return ticket;
}

async function addCommentInSupabase(input: {
  actorId: string;
  ticketId: string;
  body: string;
  visibility: "external" | "internal";
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const ticket = db.tickets.find((item) => item.id === input.ticketId);

  if (!ticket) {
    throw new Error("No pudimos encontrar el ticket.");
  }

  if (!canCommentOnTicket(actor, ticket, input.visibility)) {
    throw new Error("Tu rol puede ver el ticket, pero no publicar comentarios.");
  }

  const client = await getSupabaseServerClient();
  const { data: commentData, error: commentError } = await client
    .from("ticket_comments")
    .insert({
      ticket_id: ticket.id,
      author_id: actor.id,
      body: input.body,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  assertNoError(commentError);
  const commentRecord = assertData(commentData, "No pudimos recuperar el comentario creado.");

  const { error: historyError } = await client.from("ticket_history").insert({
    ticket_id: ticket.id,
    actor_id: actor.id,
    event_type: "commented",
    message: `${actor.name} agregó un comentario ${
      input.visibility === "internal" ? "interno" : "externo"
    }.`,
  });
  assertNoError(historyError);

  const audience = isClientRole(actor.role) ? "internal" : "client";
  const notificationContext = getNotificationContext(db, actor, ticket, audience);
  await sendNotificationEmail(
    notificationContext
      ? buildCommentNotification({
          ...notificationContext,
          commentId: String(commentRecord.id),
          body: input.body,
          visibility: input.visibility,
        })
      : null,
  );
}

async function updateTicketWorkflowInSupabase(input: {
  actorId: string;
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToId: string | null;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const ticket = db.tickets.find((item) => item.id === input.ticketId);

  if (!ticket || !canUpdateTicketWorkflow(actor)) {
    throw new Error("No tenés permisos para actualizar el workflow.");
  }

  const previousStatus = ticket.status;
  const previousPriority = ticket.priority;
  const previousAssignee = ticket.assignedToId;

  const client = await getSupabaseServerClient();
  const { error: updateError } = await client
    .from("tickets")
    .update({
      status: input.status,
      priority: input.priority,
      assigned_to_id: input.assignedToId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);
  assertNoError(updateError);

  const historyRows: Array<{
    ticket_id: string;
    actor_id: string;
    event_type: string;
    message: string;
  }> = [];

  if (previousStatus !== input.status) {
    historyRows.push({
      ticket_id: ticket.id,
      actor_id: actor.id,
      event_type: "status_changed",
      message: `${actor.name} cambió el estado a ${input.status}.`,
    });
  }

  if (previousPriority !== input.priority) {
    historyRows.push({
      ticket_id: ticket.id,
      actor_id: actor.id,
      event_type: "priority_changed",
      message: `${actor.name} cambió la prioridad a ${input.priority}.`,
    });
  }

  if (previousAssignee !== input.assignedToId) {
    const assignee = db.users.find((user) => user.id === input.assignedToId);
    historyRows.push({
      ticket_id: ticket.id,
      actor_id: actor.id,
      event_type: "assigned",
      message: assignee
        ? `${actor.name} asignó el ticket a ${assignee.name}.`
        : `${actor.name} dejó el ticket sin asignar.`,
    });
  }

  let statusHistoryId: string | null = null;
  if (historyRows.length > 0) {
    const { data: historyData, error: historyError } = await client
      .from("ticket_history")
      .insert(historyRows)
      .select("id,event_type");
    assertNoError(historyError);
    const historyRecords = assertData(
      historyData,
      "No pudimos recuperar el historial del workflow.",
    );
    const statusHistory = historyRecords.find(
      (entry) => String(entry.event_type) === "status_changed",
    );
    statusHistoryId = statusHistory ? String(statusHistory.id) : null;
  }

  if (previousStatus !== input.status && statusHistoryId) {
    const notificationContext = getNotificationContext(db, actor, ticket, "client");
    await sendNotificationEmail(
      notificationContext
        ? buildStatusChangedNotification({
            ...notificationContext,
            statusHistoryId,
            previousStatus,
            newStatus: input.status,
          })
        : null,
    );
  }
}

async function createUserInSupabase(input: {
  actorId: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password: string;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const title = requireUserTitle(input.title);

  const sameCompany = actor.companyId === input.companyId;
  const canManageClientSide = actor.role === "client_admin" && sameCompany;
  const canManagePlatform = canManageGlobalCatalog(actor.role);

  if (!canManageClientSide && !canManagePlatform) {
    throw new Error("No tenés permisos para gestionar usuarios.");
  }

  if (isClientRole(input.role) && !input.companyId) {
    throw new Error("Los usuarios cliente deben pertenecer a una empresa.");
  }

  assertRoleAssignment(input.role, input.companyId);

  return createSupabaseUserProfile({
    companyId: input.companyId,
    email: input.email,
    name: input.name,
    role: input.role,
    title,
    password: input.password,
  });
}

async function updateUserInSupabase(input: {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password?: string;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const target = db.users.find((user) => user.id === input.userId);

  if (!target) {
    throw new Error("No pudimos encontrar el usuario a editar.");
  }

  const sameCompany = actor.companyId === target.companyId;
  const canManageClientSide = actor.role === "client_admin" && sameCompany;
  const canManagePlatform = canManageGlobalCatalog(actor.role);

  if (!canManageClientSide && !canManagePlatform) {
    throw new Error("No tenés permisos para editar usuarios.");
  }

  if (input.password && input.password.length < 8) {
    throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  }

  const normalizedEmail = input.email.toLowerCase();
  const duplicated = db.users.find(
    (user) => user.id !== target.id && user.email.toLowerCase() === normalizedEmail,
  );

  if (duplicated) {
    throw new Error("Ya existe otro usuario con ese email.");
  }

  assertRoleAssignment(input.role, target.companyId);

  const client = await getSupabaseServerClient();
  const adminClient = getSupabaseAdminClient();
  const authPayload: {
    email: string;
    email_confirm: true;
    password?: string;
    user_metadata: {
      name: string;
    };
    app_metadata: {
      role: UserRole;
    };
  } = {
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: {
      name: input.name,
    },
    app_metadata: {
      role: input.role,
    },
  };

  if (input.password) {
    authPayload.password = input.password;
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(target.id, authPayload);
  if (authError) {
    throw new Error(authError.message);
  }

  const { data, error } = await client
    .from("users")
    .update({
      name: input.name,
      email: normalizedEmail,
      role: input.role,
      status: "active",
      title: input.title,
      avatar: avatarFromName(input.name),
    })
    .eq("id", target.id)
    .select("*")
    .single();

  assertNoError(error);
  return mapUser(data as UserRow);
}

async function createCompanyInSupabase(input: {
  actorId: string;
  companyName: string;
  industry: string;
  plan: CompanyPlan;
  adminName: string;
  adminEmail: string;
  adminTitle: string;
  adminPassword: string;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  if (!canManageGlobalCatalog(actor.role)) {
    throw new Error("No tenés permisos para crear empresas.");
  }

  if (
    !input.companyName ||
    !input.industry ||
    !input.adminName ||
    !input.adminEmail ||
    !input.adminTitle ||
    !input.adminPassword
  ) {
    throw new Error("Empresa, industria y admin inicial son obligatorios.");
  }

  const client = await getSupabaseServerClient();
  const baseSlug = slugify(input.companyName) || "empresa";
  const existingSlugs = new Set(db.companies.map((company) => company.slug));
  let slug = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: companyData, error: companyError } = await client
    .from("companies")
    .insert({
      name: input.companyName,
      slug,
      plan: input.plan,
      industry: input.industry,
      status: "onboarding",
      primary_contact: input.adminEmail.toLowerCase(),
    })
    .select("*")
    .single();

  assertNoError(companyError);
  const companyRecord = assertData(companyData, "No pudimos crear la empresa.");

  try {
    const adminUser = await createSupabaseUserProfile({
      companyId: companyRecord.id,
      email: input.adminEmail,
      name: input.adminName,
      role: "client_admin",
      title: input.adminTitle,
      password: input.adminPassword,
    });

    return { company: mapCompany(companyRecord as CompanyRow), adminUser };
  } catch (error) {
    await client.from("companies").delete().eq("id", companyRecord.id);
    throw error;
  }
}

async function updateCompanyInSupabase(input: {
  actorId: string;
  companyId: string;
  name: string;
  slug: string;
  industry: string;
  plan: CompanyPlan;
  status: "active" | "onboarding";
  primaryContact: string;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  if (!canManageGlobalCatalog(actor.role)) {
    throw new Error("No tenés permisos para editar empresas.");
  }

  const company = db.companies.find((item) => item.id === input.companyId);
  if (!company) {
    throw new Error("No pudimos encontrar la empresa.");
  }

  if (!input.name || !input.slug || !input.industry || !input.primaryContact) {
    throw new Error("Nombre, slug, industria y contacto principal son obligatorios.");
  }

  const normalizedSlug = slugify(input.slug) || slugify(input.name) || "empresa";
  const duplicated = db.companies.find(
    (item) => item.id !== company.id && item.slug === normalizedSlug,
  );

  if (duplicated) {
    throw new Error("Ya existe otra empresa con ese slug.");
  }

  const client = await getSupabaseServerClient();
  const { data, error } = await client
    .from("companies")
    .update({
      name: input.name,
      slug: normalizedSlug,
      industry: input.industry,
      plan: input.plan,
      status: input.status,
      primary_contact: input.primaryContact.toLowerCase(),
    })
    .eq("id", input.companyId)
    .select("*")
    .single();

  assertNoError(error);
  return mapCompany(data as CompanyRow);
}

export async function getAppSnapshot() {
  return getSupabaseSnapshot();
}

export async function getVisibleTicketReference(reference: string) {
  return getVisibleTicketReferenceFromSupabase(reference);
}

export async function createTicket(input: CreateTicketInput) {
  return createTicketInSupabase(input);
}

export async function addComment(input: AddCommentInput) {
  return addCommentInSupabase(input);
}

export async function updateTicketWorkflow(input: UpdateTicketWorkflowInput) {
  return updateTicketWorkflowInSupabase(input);
}

export async function createUser(input: CreateUserInput) {
  return createUserInSupabase(input);
}

export async function updateUser(input: UpdateUserInput) {
  return updateUserInSupabase(input);
}

export async function createCompany(input: CreateCompanyInput) {
  return createCompanyInSupabase(input);
}

export async function updateCompany(input: UpdateCompanyInput) {
  return updateCompanyInSupabase(input);
}
