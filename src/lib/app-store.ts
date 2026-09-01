import "server-only";

import { PostgrestError } from "@supabase/supabase-js";

import {
  canCommentOnTicket,
  canCreateCompanyTicket,
  hasModuleAccess,
  canManageAccessControl,
  canUpdateTicketWorkflow,
} from "@/lib/authorization";
import { getPublicAppUrl, sendAccountInvitationEmail, sendNotificationEmail } from "@/lib/email-service";
import {
  buildCommentNotification,
  buildStatusChangedNotification,
  buildTicketCreatedNotification,
} from "@/lib/notification-events";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { parseTicketReference, ticketDetailPath } from "@/lib/routing";
import {
  Company,
  CompanyModuleAvailability,
  CompanyModules,
  CompanyPlan,
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
  UserModulePermission,
  PortalModuleKey,
  ModuleAccessLevel,
  AccessAuditEntry,
  PORTAL_MODULES,
  UserRole,
  UserStatus,
  canAssignUserRole,
  canChangeUserRole,
  canManageGlobalCatalog,
  isClientRole,
  isRoleCompatibleWithCompany,
} from "@/lib/ticketing";
import { requireUserTitle } from "@/lib/validation";
import { validateCommentImages, validateTicketImages } from "@/lib/comment-image-validation";
import { getSafeTicketContextUrls, normalizeTicketContextUrls } from "@/lib/ticket-context-urls";
import {
  RADAR_OPPORTUNITY_BEHAVIORS,
  RADAR_PUBLICATIONS_PER_WEEK,
  RADAR_PUBLISHING_MODES,
  normalizeRadarTopics,
  parseRadarPreferences,
  type RadarOpportunityBehavior,
  type RadarPublishingMode,
} from "@/lib/radar-preferences";
import { persistRadarPreferences } from "@/lib/radar-preferences-store";

export type CreateTicketInput = {
  actorId: string;
  idempotencyKey: string;
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
  attachments: File[];
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
};

export type UpdateUserInput = {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  status: UserStatus;
};

export type CreateCompanyInput = {
  actorId: string;
  companyName: string;
  industry: string;
  plan: CompanyPlan;
  adminName: string;
  adminEmail: string;
  adminTitle: string;
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

export type UpdateCompanyModulesInput = {
  actorId: string;
  companyId: string;
  modules: CompanyModuleAvailability;
  radarWorkspaceId: string | null;
  radarSiteIntegrated: boolean;
};

export type UpdateUserModulePermissionsInput = {
  actorId: string;
  userId: string;
  companyId: string;
  permissions: Record<PortalModuleKey, ModuleAccessLevel>;
  reason: string | null;
};

export type UpdateInternalCompanyAccessInput = UpdateUserModulePermissionsInput & {
  assigned: boolean;
};

export type UpdateRadarPreferencesInput = {
  actorId: string;
  companyId: string;
  topics: string[];
  publicationsPerWeek: number;
  opportunityBehavior: RadarOpportunityBehavior;
  publishingMode: RadarPublishingMode;
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

type CompanyModuleRow = {
  company_id: string;
  module: PortalModuleKey;
  enabled: boolean;
  settings: unknown;
};

type UserCompanyAssignmentRow = {
  user_id: string;
  company_id: string;
};

type UserModulePermissionRow = {
  user_id: string;
  company_id: string;
  module: PortalModuleKey;
  access_level: Exclude<ModuleAccessLevel, "none">;
};

type AccessAuditRow = {
  id: string;
  actor_user_id: string;
  company_id: string | null;
  target_user_id: string | null;
  module: PortalModuleKey | null;
  action: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
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
  comment_id: string | null;
  mime_type: string | null;
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
  if (!actor || actor.status !== "active") {
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

function mapCompany(
  row: CompanyRow,
  modules: CompanyModules = emptyCompanyModules(),
): Company {
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
    modules,
    createdAt: row.created_at,
  };
}

function emptyCompanyModules(): CompanyModules {
  return {
    support: { enabled: false, settings: {} },
    metrics: { enabled: false, settings: {} },
    radar: { enabled: false, settings: {} },
    content: { enabled: false, settings: {} },
  };
}

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalSetting(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapCompanyModules(rows: CompanyModuleRow[]) {
  const byCompanyId = new Map<string, CompanyModules>();

  for (const row of rows) {
    const modules = byCompanyId.get(row.company_id) ?? emptyCompanyModules();
    const settings = objectSettings(row.settings);

    if (row.module === "support" || row.module === "content") {
      modules[row.module] = { enabled: row.enabled, settings: {} };
    } else if (row.module === "metrics") {
      const objective = settings.objective;
      modules.metrics = {
        enabled: row.enabled,
        settings: {
          accountName: optionalSetting(settings.accountName),
          mailchimpName: optionalSetting(settings.mailchimpName),
          clientsSheetUrl: optionalSetting(settings.clientsSheetUrl),
          strategySheetUrl: optionalSetting(settings.strategySheetUrl),
          metaSheetUrl: optionalSetting(settings.metaSheetUrl),
          mailchimpSheetUrl: optionalSetting(settings.mailchimpSheetUrl),
          objective:
            objective === "CONVERSACIONES" || objective === "LEADS" || objective === "COMPRAS"
              ? objective
              : undefined,
        },
      };
    } else {
      const preferences = parseRadarPreferences(settings);
      modules.radar = {
        enabled: row.enabled,
        settings: {
          workspaceId: optionalSetting(settings.workspaceId),
          ...preferences,
        },
      };
    }

    byCompanyId.set(row.company_id, modules);
  }

  return byCompanyId;
}

function mapUser(
  row: UserRow,
  assignedCompanyIds: string[] = [],
  modulePermissions: UserModulePermission[] = [],
): UserProfile {
  const status = (["active", "invited", "disabled"] as const).find(
    (candidate) => candidate === row.status,
  ) ?? "invited";

  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    status,
    title: row.title ?? "",
    avatar: row.avatar ?? avatarFromName(row.name),
    assignedCompanyIds,
    modulePermissions,
  };
}

function mapAccessAudit(row: AccessAuditRow): AccessAuditEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    companyId: row.company_id,
    targetUserId: row.target_user_id,
    module: row.module,
    action: row.action,
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function mapTicket(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    code: row.code,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    contextUrls: getSafeTicketContextUrls(row.context_urls),
    type: row.type as TicketType,
    area: row.area as TicketArea,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    createdById: row.created_by_id,
    assignedToId: row.assigned_to_id,
    assigneeName: null,
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
    commentId: row.comment_id ?? null,
    url: row.storage_path.startsWith("seed/")
      ? "#"
      : `/api/ticket-attachments/${encodeURIComponent(row.id)}`,
  };
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

  await validateTicketImages(input.attachments);

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

    const { data, error } = await client.rpc("register_ticket_attachment", {
      target_ticket_id: input.ticketId,
      attachment_storage_path: storagePath,
      attachment_file_name: file.name,
      attachment_size_bytes: file.size,
      attachment_mime_type: file.type,
    });

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
      commentId: null,
      url: `/api/ticket-attachments/${encodeURIComponent(String(data.id))}`,
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

  const [companiesResult, companyModulesResult, usersResult, assignmentsResult, permissionsResult, accessAuditResult, ticketsResult, commentsResult, attachmentsResult, historyResult] =
    await Promise.all([
      client.from("companies").select("*").order("created_at", { ascending: false }),
      client.from("company_modules").select("company_id, module, enabled, settings"),
      client.from("users").select("*").order("created_at", { ascending: false }),
      client.from("user_company_assignments").select("user_id, company_id"),
      client.from("user_module_permissions").select("user_id, company_id, module, access_level"),
      client.from("access_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      client.from("tickets").select("*").order("updated_at", { ascending: false }),
      client.from("ticket_comments").select("*").order("created_at", { ascending: true }),
      client.from("ticket_attachments").select("*").order("created_at", { ascending: true }),
      client.from("ticket_history").select("*").order("created_at", { ascending: false }),
    ]);

  assertNoError(companiesResult.error);
  assertNoError(companyModulesResult.error);
  assertNoError(usersResult.error);
  assertNoError(assignmentsResult.error);
  assertNoError(permissionsResult.error);
  assertNoError(accessAuditResult.error);
  assertNoError(ticketsResult.error);
  assertNoError(commentsResult.error);
  assertNoError(attachmentsResult.error);
  assertNoError(historyResult.error);

  const attachmentRows = (attachmentsResult.data ?? []) as AttachmentRow[];

  const tickets = (ticketsResult.data ?? []).map((row) => mapTicket(row as TicketRow));
  const modulesByCompanyId = mapCompanyModules(
    (companyModulesResult.data ?? []) as CompanyModuleRow[],
  );
  const assignmentRows = (assignmentsResult.data ?? []) as UserCompanyAssignmentRow[];
  const permissionRows = (permissionsResult.data ?? []) as UserModulePermissionRow[];
  const assignedCompaniesByUser = new Map<string, string[]>();
  const permissionsByUser = new Map<string, UserModulePermission[]>();
  for (const assignment of assignmentRows) {
    const companies = assignedCompaniesByUser.get(assignment.user_id) ?? [];
    companies.push(assignment.company_id);
    assignedCompaniesByUser.set(assignment.user_id, companies);
  }
  for (const permission of permissionRows) {
    const permissions = permissionsByUser.get(permission.user_id) ?? [];
    permissions.push({
      companyId: permission.company_id,
      module: permission.module,
      level: permission.access_level,
    });
    permissionsByUser.set(permission.user_id, permissions);
  }
  const assignedTicketIds = tickets
    .filter((ticket) => ticket.assignedToId)
    .map((ticket) => ticket.id);
  const assigneeNameByTicketId = new Map<string, string>();

  if (assignedTicketIds.length) {
    const { data, error } = await client.rpc("ticket_assignee_display_names", {
      target_ticket_ids: assignedTicketIds,
    });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (typeof row.ticket_id === "string" && typeof row.assignee_name === "string") {
        assigneeNameByTicketId.set(row.ticket_id, row.assignee_name);
      }
    }
  }

  return {
    companies: (companiesResult.data ?? []).map((row) => {
      const company = row as CompanyRow;
      return mapCompany(company, modulesByCompanyId.get(company.id));
    }),
    users: (usersResult.data ?? []).map((row) => {
      const user = row as UserRow;
      return mapUser(
        user,
        assignedCompaniesByUser.get(user.id),
        permissionsByUser.get(user.id),
      );
    }),
    tickets: tickets.map((ticket) => ({
      ...ticket,
      assigneeName: assigneeNameByTicketId.get(ticket.id) ?? null,
    })),
    comments: (commentsResult.data ?? []).map((row) => mapComment(row as CommentRow)),
    attachments: attachmentRows.map((row) => mapAttachment(row)),
    history: (historyResult.data ?? []).map((row) => mapHistory(row as HistoryRow)),
    accessAudit: (accessAuditResult.data ?? []).map((row) => mapAccessAudit(row as AccessAuditRow)),
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

async function createTicketResources(input: {
  ticketId: string;
  actorId: string;
  attachments: File[];
}) {
  await uploadTicketImages({
    ticketId: input.ticketId,
    actorId: input.actorId,
    attachments: input.attachments,
  });
}

async function createSupabaseUserProfile(input: {
  companyId: string | null;
  email: string;
  name: string;
  role: UserRole;
  title: string;
}) {
  const adminClient = getSupabaseAdminClient();
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    throw new Error("Falta configurar NEXT_PUBLIC_APP_URL para enviar invitaciones.");
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      data: {
        name: input.name,
      },
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const authUser = authData.user;
  const tokenHash = authData.properties?.hashed_token;
  if (!authUser) {
    throw new Error("Supabase no devolvió el usuario creado.");
  }
  if (!tokenHash) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    throw new Error("Supabase no devolvió un enlace de activación válido.");
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    app_metadata: { role: input.role },
    user_metadata: { name: input.name },
  });
  if (metadataError) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    throw new Error(metadataError.message);
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

  const { data, error } = await adminClient
    .from("users")
    .insert(profile)
    .select("*")
    .single();

  if (error) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    throw new Error(error.message);
  }

  const activationUrl = new URL("/auth/callback", appUrl);
  activationUrl.searchParams.set("token_hash", tokenHash);
  activationUrl.searchParams.set("type", "invite");

  try {
    await sendAccountInvitationEmail({
      to: profile.email,
      name: profile.name,
      activationUrl: activationUrl.toString(),
    });
  } catch (invitationError) {
    await adminClient.auth.admin.deleteUser(authUser.id);
    throw invitationError;
  }

  return mapUser(data as UserRow);
}

async function createTicketInSupabase(input: {
  actorId: string;
  idempotencyKey: string;
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
  const company = actor.companyId
    ? db.companies.find((item) => item.id === actor.companyId)
    : null;

  if (!company || !canCreateCompanyTicket(actor, company)) {
    throw new Error("Solo usuarios cliente pueden crear tickets en este entorno.");
  }

  const contextUrls = normalizeTicketContextUrls(input.contextUrls);
  await validateTicketImages(input.attachments);

  const client = await getSupabaseServerClient();
  const { data: ticketData, error: ticketError } = await client.rpc(
    "create_ticket_with_history",
    {
      request_creation_key: input.idempotencyKey,
      ticket_title: input.title,
      ticket_description: input.description,
      ticket_context_urls: contextUrls,
      ticket_type: input.type,
      ticket_area: input.area,
    },
  );

  assertNoError(ticketError);
  const rpcResult = assertData(
    ticketData as { ticket: TicketRow; created: boolean } | null,
    "No pudimos crear el ticket.",
  );
  const ticketRow = rpcResult.ticket;

  if (rpcResult.created) {
    await createTicketResources({
      ticketId: String(ticketRow.id),
      actorId: actor.id,
      attachments: input.attachments,
    });
  }
  const ticket = mapTicket(ticketRow);
  if (rpcResult.created) {
    const notificationContext = getNotificationContext(db, actor, ticket, "internal");
    await sendNotificationEmail(
      notificationContext ? buildTicketCreatedNotification(notificationContext) : null,
    );
  }

  return ticket;
}

async function addCommentInSupabase(input: {
  actorId: string;
  ticketId: string;
  body: string;
  visibility: "external" | "internal";
  attachments: File[];
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const ticket = db.tickets.find((item) => item.id === input.ticketId);
  const company = ticket
    ? db.companies.find((item) => item.id === ticket.companyId)
    : null;

  if (!ticket || !company) {
    throw new Error("No pudimos encontrar el ticket.");
  }

  if (!canCommentOnTicket(actor, ticket, company, input.visibility)) {
    throw new Error("Tu rol puede ver el ticket, pero no publicar comentarios.");
  }

  await validateCommentImages(input.attachments);

  const client = await getSupabaseServerClient();
  const uploadedPaths: string[] = [];
  const uploadRows: Array<{ storage_path: string; file_name: string; size_bytes: number; mime_type: string }> = [];
  for (const file of input.attachments) {
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `tickets/${ticket.id}/comments/${crypto.randomUUID()}-${safeFileName}`;
    const { error: uploadError } = await client.storage
      .from("ticket-attachments")
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      if (uploadedPaths.length) await client.storage.from("ticket-attachments").remove(uploadedPaths);
      throw new Error(`No pudimos subir ${file.name}. El mensaje no fue publicado.`);
    }
    uploadedPaths.push(storagePath);
    uploadRows.push({ storage_path: storagePath, file_name: file.name, size_bytes: file.size, mime_type: file.type });
  }

  const { data: commentId, error: commentError } = await client.rpc(
    "create_ticket_comment_with_attachments",
    {
      target_ticket_id: ticket.id,
      comment_body: input.body,
      comment_visibility: input.visibility,
      attachment_rows: uploadRows,
    },
  );
  if (commentError || typeof commentId !== "string") {
    if (uploadedPaths.length) await client.storage.from("ticket-attachments").remove(uploadedPaths);
    throw new Error(commentError?.message ?? "No pudimos publicar el mensaje.");
  }

  const audience = isClientRole(actor.role) ? "internal" : "client";
  const notificationContext = getNotificationContext(db, actor, ticket, audience);
  await sendNotificationEmail(
    notificationContext
      ? buildCommentNotification({
          ...notificationContext,
          commentId,
          body: input.body,
          visibility: input.visibility,
          attachmentCount: input.attachments.length,
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
  const company = ticket
    ? db.companies.find((item) => item.id === ticket.companyId)
    : null;

  if (!ticket || !company || !canUpdateTicketWorkflow(actor, company)) {
    throw new Error("No tenés permisos para actualizar el workflow.");
  }

  const previousStatus = ticket.status;
  const client = await getSupabaseServerClient();
  const { data: statusHistoryId, error: updateError } = await client.rpc(
    "update_ticket_workflow_with_history",
    {
      target_ticket_id: ticket.id,
      next_status: input.status,
      next_priority: input.priority,
      next_assigned_to_id: input.assignedToId,
    },
  );
  assertNoError(updateError);

  if (previousStatus !== input.status && typeof statusHistoryId === "string") {
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
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const title = requireUserTitle(input.title);

  if (!canAssignUserRole(actor, input.companyId, input.role)) {
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
  });
}

async function updateUserInSupabase(input: {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  status: UserStatus;
}) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const target = db.users.find((user) => user.id === input.userId);

  if (!target) {
    throw new Error("No pudimos encontrar el usuario a editar.");
  }

  if (!canChangeUserRole(actor, target, input.role)) {
    throw new Error("No tenés permisos para editar usuarios.");
  }

  const allowedStatuses = target.status === "invited"
    ? (["invited", "disabled"] as UserStatus[])
    : (["active", "disabled"] as UserStatus[]);
  if (!allowedStatuses.includes(input.status) || (actor.id === target.id && input.status !== target.status)) {
    throw new Error("No tenés permisos para cambiar ese estado de acceso.");
  }

  const normalizedEmail = input.email.toLowerCase();
  const duplicated = db.users.find(
    (user) => user.id !== target.id && user.email.toLowerCase() === normalizedEmail,
  );

  if (duplicated) {
    throw new Error("Ya existe otro usuario con ese email.");
  }

  assertRoleAssignment(input.role, target.companyId);

  const adminClient = getSupabaseAdminClient();
  const authPayload: {
    email: string;
    user_metadata: {
      name: string;
    };
    app_metadata: {
      role: UserRole;
    };
  } = {
    email: normalizedEmail,
    user_metadata: {
      name: input.name,
    },
    app_metadata: {
      role: input.role,
    },
  };

  const { error: authError } = await adminClient.auth.admin.updateUserById(target.id, authPayload);
  if (authError) {
    throw new Error(authError.message);
  }

  const { data, error } = await adminClient
    .from("users")
    .update({
      name: input.name,
      email: normalizedEmail,
      role: input.role,
      status: input.status,
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
    });

    const { error: permissionError } = await client.rpc("set_user_module_permissions", {
      target_user_id: adminUser.id,
      target_company_id: companyRecord.id,
      permission_updates: PORTAL_MODULES.map((module) => ({
        module,
        level: module === "support" ? "admin" : "none",
      })),
      change_reason: "Bootstrap del administrador inicial",
    });
    if (permissionError) {
      await getSupabaseAdminClient().auth.admin.deleteUser(adminUser.id);
      throw new Error(permissionError.message);
    }

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
  return mapCompany(data as CompanyRow, company.modules);
}

async function updateCompanyModulesInSupabase(input: UpdateCompanyModulesInput) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);

  if (!canManageAccessControl(actor)) {
    throw new Error("No tenés permisos para habilitar productos.");
  }

  const company = db.companies.find((item) => item.id === input.companyId);
  if (!company) {
    throw new Error("No pudimos encontrar la empresa.");
  }

  const client = await getSupabaseServerClient();
  const { error } = await client.rpc("set_company_modules", {
    target_company_id: company.id,
    module_updates: Object.entries(input.modules).map(([module, enabled]) => ({
      module,
      enabled,
    })),
    radar_workspace_id: input.radarWorkspaceId,
    radar_site_integrated: input.radarSiteIntegrated,
    change_reason: "Actualización desde Backoffice",
  });

  assertNoError(error);

  return {
    ...company,
    modules: {
      support: {
        ...company.modules.support,
        enabled: input.modules.support,
      },
      metrics: {
        ...company.modules.metrics,
        enabled: input.modules.metrics,
      },
      radar: {
        ...company.modules.radar,
        enabled: input.modules.radar,
      },
      content: {
        ...company.modules.content,
        enabled: input.modules.content,
      },
    },
  };
}

async function updateUserModulePermissionsInSupabase(
  input: UpdateUserModulePermissionsInput,
) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  if (!canManageAccessControl(actor)) {
    throw new Error("Sólo un administrador de plataforma puede cambiar accesos.");
  }

  const target = db.users.find((user) => user.id === input.userId);
  const company = db.companies.find((item) => item.id === input.companyId);
  if (!target || !company) throw new Error("No pudimos encontrar el usuario o la empresa.");

  const client = await getSupabaseServerClient();
  const { error } = await client.rpc("set_user_module_permissions", {
    target_user_id: target.id,
    target_company_id: company.id,
    permission_updates: Object.entries(input.permissions).map(([module, level]) => ({
      module,
      level,
    })),
    change_reason: input.reason,
  });
  assertNoError(error);
}

async function updateInternalCompanyAccessInSupabase(
  input: UpdateInternalCompanyAccessInput,
) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  if (!canManageAccessControl(actor)) {
    throw new Error("Sólo un administrador de plataforma puede asignar empresas.");
  }

  const target = db.users.find((user) => user.id === input.userId);
  const company = db.companies.find((item) => item.id === input.companyId);
  if (!target || !company || isClientRole(target.role)) {
    throw new Error("La asignación interna no es válida.");
  }

  const client = await getSupabaseServerClient();
  const { error } = await client.rpc("set_internal_company_access", {
    target_user_id: target.id,
    target_company_id: company.id,
    company_assigned: input.assigned,
    permission_updates: Object.entries(input.permissions).map(([module, level]) => ({
      module,
      level,
    })),
    change_reason: input.reason,
  });
  assertNoError(error);
}

async function updateRadarPreferencesInSupabase(input: UpdateRadarPreferencesInput) {
  const db = await getSupabaseSnapshot();
  const actor = ensureActor(db, input.actorId);
  const company = db.companies.find((item) => item.id === input.companyId);

  if (!company || !company.modules.radar.enabled) {
    throw new Error("Radar no está habilitado para esta empresa.");
  }
  if (!hasModuleAccess(actor, company, "radar", "admin")) {
    throw new Error("Tu rol puede revisar la estrategia, pero no modificarla.");
  }

  const topics = normalizeRadarTopics(input.topics);
  if (!topics.length) {
    throw new Error("Elegí al menos una temática para Radar.");
  }
  if (
    !RADAR_PUBLICATIONS_PER_WEEK.includes(
      input.publicationsPerWeek as (typeof RADAR_PUBLICATIONS_PER_WEEK)[number],
    )
  ) {
    throw new Error("La frecuencia semanal no es válida.");
  }
  if (!RADAR_OPPORTUNITY_BEHAVIORS.includes(input.opportunityBehavior)) {
    throw new Error("La decisión sobre oportunidades no es válida.");
  }
  if (!RADAR_PUBLISHING_MODES.includes(input.publishingMode)) {
    throw new Error("El modo de publicación no es válido.");
  }

  return persistRadarPreferences({
    actor,
    companyId: company.id,
    topics,
    publicationsPerWeek: input.publicationsPerWeek,
    opportunityBehavior: input.opportunityBehavior,
    publishingMode: input.publishingMode,
  });
}

export async function getAppSnapshot() {
  return getSupabaseSnapshot();
}

export async function getVisibleTicketReference(reference: string) {
  return getVisibleTicketReferenceFromSupabase(reference);
}

export async function getEligibleSupportAssigneeIds(companyId: string) {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("support_assignee_ids", {
    target_company_id: companyId,
  });
  assertNoError(error);
  const rows = (data ?? []) as Array<{ user_id: string | null }>;
  return new Set(
    rows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string"),
  );
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

export async function updateCompanyModules(input: UpdateCompanyModulesInput) {
  return updateCompanyModulesInSupabase(input);
}

export async function updateUserModulePermissions(input: UpdateUserModulePermissionsInput) {
  return updateUserModulePermissionsInSupabase(input);
}

export async function updateInternalCompanyAccess(input: UpdateInternalCompanyAccessInput) {
  return updateInternalCompanyAccessInSupabase(input);
}

export async function updateRadarPreferences(input: UpdateRadarPreferencesInput) {
  return updateRadarPreferencesInSupabase(input);
}
