import "server-only";

import { PostgrestError } from "@supabase/supabase-js";

import { LOCAL_CLIENT_PASSWORD } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/backend";
import * as demoStore from "@/lib/demo-store";
import { demoSeed } from "@/lib/demo-seed";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase-server";
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
  canManageOperations,
  canCommentOnTickets,
  isClientRole,
  isInternalRole,
  isRoleCompatibleWithCompany,
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

  const client = getSupabaseAdminClient();
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

  const client = getSupabaseAdminClient();
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
  const client = getSupabaseAdminClient();
  const { error } = await client.from("ticket_history").insert({
    ticket_id: input.ticketId,
    actor_id: input.actorId,
    event_type: "created",
    message: input.message,
  });

  assertNoError(error);
}

async function cleanupTicketCreation(ticketId: string) {
  const client = getSupabaseAdminClient();
  const { data: attachments, error: attachmentsError } = await client
    .from("ticket_attachments")
    .select("storage_path")
    .eq("ticket_id", ticketId);

  if (!attachmentsError) {
    const storagePaths = (attachments ?? [])
      .map((item) => String(item.storage_path ?? ""))
      .filter(Boolean);

    if (storagePaths.length > 0) {
      await client.storage.from("ticket-attachments").remove(storagePaths);
    }
  }

  await client.from("tickets").delete().eq("id", ticketId);
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

async function bootstrapSupabaseFromDemoSeed() {
  const client = getSupabaseAdminClient();
  const companyIdMap = new Map<string, string>();
  const userIdMap = new Map<string, string>();
  const existingCompaniesResult = await client
    .from("companies")
    .select("id, slug");
  assertNoError(existingCompaniesResult.error);
  const existingCompanies = new Map(
    (existingCompaniesResult.data ?? []).map((company) => [String(company.slug), String(company.id)]),
  );

  const {
    data: authUsersData,
    error: authUsersError,
  } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authUsersError) {
    throw new Error(authUsersError.message);
  }
  const existingAuthUsers = new Map(
    (authUsersData.users ?? []).map((user) => [user.email?.toLowerCase() ?? "", user]),
  );

  const existingProfilesResult = await client
    .from("users")
    .select("id, email");
  assertNoError(existingProfilesResult.error);
  const existingProfiles = new Map(
    (existingProfilesResult.data ?? []).map((user) => [String(user.email).toLowerCase(), String(user.id)]),
  );

  for (const company of demoSeed.companies) {
    const existingCompanyId = existingCompanies.get(company.slug);
    if (existingCompanyId) {
      companyIdMap.set(company.id, existingCompanyId);
      continue;
    }

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
      .select("id, slug")
      .single();

    assertNoError(error);
    const createdCompany = assertData(data, "No pudimos crear la empresa base.");
    companyIdMap.set(company.id, createdCompany.id);
    existingCompanies.set(createdCompany.slug, createdCompany.id);
  }

  for (const user of demoSeed.users) {
    const normalizedEmail = user.email.toLowerCase();
    let authUser = existingAuthUsers.get(normalizedEmail) ?? null;

    if (!authUser) {
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

      authUser = authData.user;
      if (!authUser) {
        throw new Error("Supabase no devolvió el usuario del seed.");
      }

      existingAuthUsers.set(normalizedEmail, authUser);
    }

    const existingProfileId = existingProfiles.get(normalizedEmail);
    if (existingProfileId && existingProfileId !== authUser.id) {
      throw new Error(`El perfil ${user.email} quedó asociado a un auth user distinto.`);
    }

    if (!existingProfileId) {
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
        throw new Error(profileError.message);
      }

      existingProfiles.set(normalizedEmail, authUser.id);
    }

    userIdMap.set(user.id, authUser.id);
  }

  const existingTicketsResult = await client
    .from("tickets")
    .select("id, code");
  assertNoError(existingTicketsResult.error);
  const existingTickets = new Map(
    (existingTicketsResult.data ?? []).map((ticket) => [String(ticket.code), String(ticket.id)]),
  );

  for (const ticket of demoSeed.tickets) {
    if (existingTickets.has(ticket.code)) {
      continue;
    }

    const { error } = await client.from("tickets").insert({
      code: ticket.code,
      company_id: companyIdMap.get(ticket.companyId),
      title: ticket.title,
      description: ticket.description,
      context_urls: ticket.contextUrls,
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

  const existingCommentsResult = await client
    .from("ticket_comments")
    .select("ticket_id, author_id, body, created_at");
  assertNoError(existingCommentsResult.error);
  const existingComments = new Set(
    (existingCommentsResult.data ?? []).map((comment) =>
      [
        String(comment.ticket_id),
        String(comment.author_id),
        String(comment.body),
        String(comment.created_at),
      ].join("::"),
    ),
  );

  if (demoSeed.comments.length > 0) {
    const missingComments = demoSeed.comments
      .map((comment) => ({
        ticket_id: ticketIdMap.get(comment.ticketId),
        author_id: userIdMap.get(comment.authorId),
        visibility: comment.visibility,
        body: comment.body,
        created_at: comment.createdAt,
      }))
      .filter((comment) => {
        const key = [
          comment.ticket_id,
          comment.author_id,
          comment.body,
          comment.created_at,
        ].join("::");
        return !existingComments.has(key);
      });

    if (missingComments.length > 0) {
      const { error } = await client.from("ticket_comments").insert(missingComments);
      assertNoError(error);
    }
  }

  const existingAttachmentsResult = await client
    .from("ticket_attachments")
    .select("ticket_id, file_name, storage_path");
  assertNoError(existingAttachmentsResult.error);
  const existingAttachments = new Set(
    (existingAttachmentsResult.data ?? []).map((attachment) =>
      [
        String(attachment.ticket_id),
        String(attachment.file_name),
        String(attachment.storage_path),
      ].join("::"),
    ),
  );

  if (demoSeed.attachments.length > 0) {
    const missingAttachments = demoSeed.attachments
      .map((attachment) => ({
        ticket_id: ticketIdMap.get(attachment.ticketId),
        uploaded_by_id: userIdMap.get(
          demoSeed.tickets.find((ticket) => ticket.id === attachment.ticketId)?.createdById ?? "",
        ),
        storage_path: attachment.url === "#" ? `seed/${attachment.name}` : attachment.url,
        file_name: attachment.name,
        size_bytes: 0,
        kind: attachment.kind,
      }))
      .filter((attachment) => attachment.ticket_id && attachment.uploaded_by_id)
      .filter((attachment) => {
        const key = [
          attachment.ticket_id,
          attachment.file_name,
          attachment.storage_path,
        ].join("::");
        return !existingAttachments.has(key);
      });

    if (missingAttachments.length > 0) {
      const { error } = await client.from("ticket_attachments").insert(missingAttachments);
      assertNoError(error);
    }
  }

  const existingHistoryResult = await client
    .from("ticket_history")
    .select("ticket_id, actor_id, event_type, message, created_at");
  assertNoError(existingHistoryResult.error);
  const existingHistory = new Set(
    (existingHistoryResult.data ?? []).map((entry) =>
      [
        String(entry.ticket_id),
        String(entry.actor_id),
        String(entry.event_type),
        String(entry.message),
        String(entry.created_at),
      ].join("::"),
    ),
  );

  if (demoSeed.history.length > 0) {
    const missingHistory = demoSeed.history
      .map((entry) => ({
        ticket_id: ticketIdMap.get(entry.ticketId),
        actor_id: userIdMap.get(entry.actorId),
        event_type: entry.type,
        message: entry.message,
        created_at: entry.createdAt,
      }))
      .filter((entry) => {
        const key = [
          entry.ticket_id,
          entry.actor_id,
          entry.event_type,
          entry.message,
          entry.created_at,
        ].join("::");
        return !existingHistory.has(key);
      });

    if (missingHistory.length > 0) {
      const { error } = await client.from("ticket_history").insert(missingHistory);
      assertNoError(error);
    }
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
  password: string;
}) {
  const client = getSupabaseAdminClient();
  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
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
    await client.auth.admin.deleteUser(authUser.id);
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

  if (!actor.companyId || !isClientRole(actor.role)) {
    throw new Error("Solo usuarios cliente pueden crear tickets en este entorno.");
  }

  assertContextUrls(input.contextUrls);

  const client = getSupabaseAdminClient();
  const code = await getNextTicketCode();
  const payload = {
    code,
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

  try {
    await createTicketResources({
      ticketId: String(ticketData.id),
      actorId: actor.id,
      actorName: actor.name,
      ticketCode: String(ticketData.code),
      contextUrls: input.contextUrls,
      attachments: input.attachments,
    });
  } catch (error) {
    await cleanupTicketCreation(String(ticketData.id));
    throw error;
  }

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

  if (!canCommentOnTickets(actor.role)) {
    throw new Error("Tu rol puede ver el ticket, pero no publicar comentarios.");
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
  password: string;
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

  assertRoleAssignment(input.role, input.companyId);

  return createSupabaseUserProfile({
    companyId: input.companyId,
    email: input.email,
    name: input.name,
    role: input.role,
    title: input.title,
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

  const client = getSupabaseAdminClient();
  const authPayload: {
    email: string;
    email_confirm: true;
    password?: string;
    user_metadata: {
      name: string;
      role: UserRole;
    };
  } = {
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
    },
  };

  if (input.password) {
    authPayload.password = input.password;
  }

  const { error: authError } = await client.auth.admin.updateUserById(target.id, authPayload);
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

  const client = getSupabaseAdminClient();
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
  if (!isSupabaseBackend()) {
    return demoStore.getAppSnapshot();
  }

  return getSupabaseSnapshot();
}

export async function resetDemoDb() {
  if (isSupabaseBackend()) {
    throw new Error("El modo demo no puede reiniciarse cuando Supabase es el backend principal.");
  }

  return demoStore.resetDemoDb();
}

export async function createTicket(input: Parameters<typeof demoStore.createTicket>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.createTicket(input);
  }

  return createTicketInSupabase(input);
}

export async function addComment(input: Parameters<typeof demoStore.addComment>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.addComment(input);
  }

  return addCommentInSupabase(input);
}

export async function updateTicketWorkflow(
  input: Parameters<typeof demoStore.updateTicketWorkflow>[0],
) {
  if (!isSupabaseBackend()) {
    return demoStore.updateTicketWorkflow(input);
  }

  return updateTicketWorkflowInSupabase(input);
}

export async function createUser(input: Parameters<typeof demoStore.createUser>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.createUser(input);
  }

  return createUserInSupabase(input);
}

export async function updateUser(input: Parameters<typeof demoStore.updateUser>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.updateUser(input);
  }

  return updateUserInSupabase(input);
}

export async function createCompany(input: Parameters<typeof demoStore.createCompany>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.createCompany(input);
  }

  return createCompanyInSupabase(input);
}

export async function updateCompany(input: Parameters<typeof demoStore.updateCompany>[0]) {
  if (!isSupabaseBackend()) {
    return demoStore.updateCompany(input);
  }

  return updateCompanyInSupabase(input);
}
