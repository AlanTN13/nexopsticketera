import "server-only";

import { PostgrestError } from "@supabase/supabase-js";

import { LOCAL_CLIENT_PASSWORD } from "@/lib/auth";
import * as demoStore from "@/lib/demo-store";
import { demoSeed } from "@/lib/demo-seed";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase-server";
import {
  Company,
  CompanyPlan,
  TicketArea,
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
  canManageOperations,
  isClientRole,
  isInternalRole,
} from "@/lib/ticketing";

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
};

type HistoryRow = {
  id: string;
  ticket_id: string;
  actor_id: string;
  event_type: string;
  message: string;
  created_at: string;
};

function shouldUseSupabase() {
  return isSupabaseAdminConfigured();
}

function ensureActor(db: TicketDatabase, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId);
  if (!actor) {
    throw new Error("No pudimos encontrar el usuario actual.");
  }
  return actor;
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

async function getSupabaseSnapshot(): Promise<TicketDatabase> {
  const client = getSupabaseAdminClient();
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

  if ((usersResult.data ?? []).length === 0) {
    await bootstrapSupabaseFromDemoSeed();
    return getSupabaseSnapshot();
  }

  return {
    companies: (companiesResult.data ?? []).map((row) => mapCompany(row as CompanyRow)),
    users: (usersResult.data ?? []).map((row) => mapUser(row as UserRow)),
    tickets: (ticketsResult.data ?? []).map((row) => mapTicket(row as TicketRow)),
    comments: (commentsResult.data ?? []).map((row) => mapComment(row as CommentRow)),
    attachments: (attachmentsResult.data ?? []).map((row) =>
      mapAttachment(row as AttachmentRow),
    ),
    history: (historyResult.data ?? []).map((row) => mapHistory(row as HistoryRow)),
  };
}

async function bootstrapSupabaseFromDemoSeed() {
  const client = getSupabaseAdminClient();
  const companyIdMap = new Map<string, string>();
  const userIdMap = new Map<string, string>();

  for (const company of demoSeed.companies) {
    const { data, error } = await client
      .from("companies")
      .insert({
        name: company.name,
        slug: company.slug,
        plan: company.plan,
        industry: company.industry,
        status: company.status,
        primary_contact: company.primaryContact,
        created_at: company.createdAt,
      })
      .select("id")
      .single();

    assertNoError(error);
    companyIdMap.set(company.id, assertData(data, "No pudimos crear la empresa base.").id);
  }

  for (const user of demoSeed.users) {
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: user.email,
      password: LOCAL_CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: user.role,
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const authUser = authData.user;
    if (!authUser) {
      throw new Error("Supabase no devolvió el usuario del seed.");
    }

    const { error: profileError } = await client.from("users").insert({
      id: authUser.id,
      company_id: user.companyId ? companyIdMap.get(user.companyId) ?? null : null,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      title: user.title,
      avatar: user.avatar,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await client.auth.admin.deleteUser(authUser.id);
      throw new Error(profileError.message);
    }

    userIdMap.set(user.id, authUser.id);
  }

  for (const ticket of demoSeed.tickets) {
    const { error } = await client.from("tickets").insert({
      code: ticket.code,
      company_id: companyIdMap.get(ticket.companyId),
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      area: ticket.area,
      priority: ticket.priority,
      status: ticket.status,
      created_by_id: userIdMap.get(ticket.createdById),
      assigned_to_id: ticket.assignedToId ? userIdMap.get(ticket.assignedToId) ?? null : null,
      created_at: ticket.createdAt,
      updated_at: ticket.updatedAt,
    });

    assertNoError(error);
  }

  const { data: ticketsData, error: ticketsFetchError } = await client
    .from("tickets")
    .select("id, code");
  assertNoError(ticketsFetchError);

  const ticketIdMap = new Map<string, string>();
  for (const seedTicket of demoSeed.tickets) {
    const match = (ticketsData ?? []).find((ticket) => ticket.code === seedTicket.code);
    if (match) {
      ticketIdMap.set(seedTicket.id, match.id);
    }
  }

  if (demoSeed.comments.length > 0) {
    const { error } = await client.from("ticket_comments").insert(
      demoSeed.comments.map((comment) => ({
        ticket_id: ticketIdMap.get(comment.ticketId),
        author_id: userIdMap.get(comment.authorId),
        visibility: comment.visibility,
        body: comment.body,
        created_at: comment.createdAt,
      })),
    );

    assertNoError(error);
  }

  if (demoSeed.history.length > 0) {
    const { error } = await client.from("ticket_history").insert(
      demoSeed.history.map((entry) => ({
        ticket_id: ticketIdMap.get(entry.ticketId),
        actor_id: userIdMap.get(entry.actorId),
        event_type: entry.type,
        message: entry.message,
        created_at: entry.createdAt,
      })),
    );

    assertNoError(error);
  }
}

async function getNextTicketCode() {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("tickets")
    .select("code")
    .like("code", "NEX-%");

  assertNoError(error);

  const nextNumber =
    (data ?? []).reduce((max, ticket) => {
      const value = Number(String(ticket.code ?? "").split("-")[1] ?? 0);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 1000) + 1;

  return `NEX-${nextNumber}`;
}

async function createSupabaseUserProfile(input: {
  companyId: string | null;
  email: string;
  name: string;
  role: UserRole;
  title: string;
}) {
  const client = getSupabaseAdminClient();
  const tempPassword = `NexOps!${crypto.randomUUID()}`;
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: input.name,
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
    status: "invited",
    title: input.title,
    avatar: avatarFromName(input.name),
  };

  const { data, error } = await client
    .from("users")
    .insert(profile)
    .select("*")
    .single();

  if (error) {
    await client.auth.admin.deleteUser(authUser.id);
    throw new Error(error.message);
  }

  return mapUser(data as UserRow);
}

async function createTicketInSupabase(input: {
  actorId: string;
  title: string;
  description: string;
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  if (!actor.companyId || !isClientRole(actor.role)) {
    throw new Error("Solo usuarios cliente pueden crear tickets en este entorno.");
  }

  const client = getSupabaseAdminClient();
  const code = await getNextTicketCode();
  const payload = {
    code,
    company_id: actor.companyId,
    title: input.title,
    description: input.description,
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

  const { error: historyError } = await client.from("ticket_history").insert({
    ticket_id: ticketData.id,
    actor_id: actor.id,
    event_type: "created",
    message: `${actor.name} creó el ticket ${ticketData.code}.`,
  });

  assertNoError(historyError);

  return mapTicket(ticketData as TicketRow);
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

  const belongsToCompany = actor.companyId === ticket.companyId;
  const internalActor = !isClientRole(actor.role);

  if (!internalActor && !belongsToCompany) {
    throw new Error("No tenés permisos para comentar este ticket.");
  }

  if (isClientRole(actor.role) && input.visibility === "internal") {
    throw new Error("Los clientes no pueden enviar notas internas.");
  }

  const client = getSupabaseAdminClient();
  const { error: commentError } = await client.from("ticket_comments").insert({
    ticket_id: ticket.id,
    author_id: actor.id,
    body: input.body,
    visibility: input.visibility,
  });
  assertNoError(commentError);

  const { error: ticketError } = await client
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticket.id);
  assertNoError(ticketError);

  const { error: historyError } = await client.from("ticket_history").insert({
    ticket_id: ticket.id,
    actor_id: actor.id,
    event_type: "commented",
    message: `${actor.name} agregó un comentario ${
      input.visibility === "internal" ? "interno" : "externo"
    }.`,
  });
  assertNoError(historyError);
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

  if (!ticket || !canManageOperations(actor.role)) {
    throw new Error("No tenés permisos para actualizar el workflow.");
  }

  const previousStatus = ticket.status;
  const previousPriority = ticket.priority;
  const previousAssignee = ticket.assignedToId;

  const client = getSupabaseAdminClient();
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

  if (historyRows.length > 0) {
    const { error: historyError } = await client.from("ticket_history").insert(historyRows);
    assertNoError(historyError);
  }
}

async function createUserInSupabase(input: {
  actorId: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  title: string;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  const sameCompany = actor.companyId === input.companyId;
  const canManageClientSide = actor.role === "client_admin" && sameCompany;
  const canManagePlatform = canManageGlobalCatalog(actor.role);

  if (!canManageClientSide && !canManagePlatform) {
    throw new Error("No tenés permisos para gestionar usuarios.");
  }

  if (isClientRole(input.role) && !input.companyId) {
    throw new Error("Los usuarios cliente deben pertenecer a una empresa.");
  }

  if (isInternalRole(input.role) && input.companyId) {
    throw new Error("Los usuarios internos no deben quedar asociados a una empresa cliente.");
  }

  return createSupabaseUserProfile({
    companyId: input.companyId,
    email: input.email,
    name: input.name,
    role: input.role,
    title: input.title,
  });
}

async function createCompanyInSupabase(input: {
  actorId: string;
  companyName: string;
  industry: string;
  plan: CompanyPlan;
  adminName: string;
  adminEmail: string;
  adminTitle: string;
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
    !input.adminTitle
  ) {
    throw new Error("Empresa, industria y admin inicial son obligatorios.");
  }

  const client = getSupabaseAdminClient();
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
    });

    return { company: mapCompany(companyRecord as CompanyRow), adminUser };
  } catch (error) {
    await client.from("companies").delete().eq("id", companyRecord.id);
    throw error;
  }
}

export async function getAppSnapshot() {
  if (!shouldUseSupabase()) {
    return demoStore.getAppSnapshot();
  }

  return getSupabaseSnapshot();
}

export async function resetDemoDb() {
  return demoStore.resetDemoDb();
}

export async function createTicket(input: Parameters<typeof demoStore.createTicket>[0]) {
  if (!shouldUseSupabase()) {
    return demoStore.createTicket(input);
  }

  return createTicketInSupabase(input);
}

export async function addComment(input: Parameters<typeof demoStore.addComment>[0]) {
  if (!shouldUseSupabase()) {
    return demoStore.addComment(input);
  }

  return addCommentInSupabase(input);
}

export async function updateTicketWorkflow(
  input: Parameters<typeof demoStore.updateTicketWorkflow>[0],
) {
  if (!shouldUseSupabase()) {
    return demoStore.updateTicketWorkflow(input);
  }

  return updateTicketWorkflowInSupabase(input);
}

export async function createUser(input: Parameters<typeof demoStore.createUser>[0]) {
  if (!shouldUseSupabase()) {
    return demoStore.createUser(input);
  }

  return createUserInSupabase(input);
}

export async function createCompany(input: Parameters<typeof demoStore.createCompany>[0]) {
  if (!shouldUseSupabase()) {
    return demoStore.createCompany(input);
  }

  return createCompanyInSupabase(input);
}
