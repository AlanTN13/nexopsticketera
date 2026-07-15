import "server-only";

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { demoSeed } from "@/lib/demo-seed";
import {
  canCommentOnTickets,
  MAX_TICKET_CONTEXT_URLS,
  MAX_TICKET_IMAGES,
  Company,
  CompanyPlan,
  TicketArea,
  TicketAttachment,
  TicketComment,
  TicketDatabase,
  TicketPriority,
  TicketRecord,
  TicketStatus,
  TicketType,
  UserProfile,
  UserRole,
  canManageGlobalCatalog,
  canManageOperations,
  isClientRole,
  isRoleCompatibleWithCompany,
} from "@/lib/ticketing";

const DB_PATH = path.join(tmpdir(), "nexops-ticketing-demo.json");

async function ensureDbFile() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(demoSeed, null, 2), "utf8");
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeDb(data: TicketDatabase): TicketDatabase {
  return {
    ...data,
    tickets: data.tickets.map((ticket) => ({
      ...ticket,
      contextUrls: Array.isArray(ticket.contextUrls) ? ticket.contextUrls : [],
    })),
  };
}

async function writeDb(data: TicketDatabase) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function assertRoleAssignment(role: UserRole, companyId: string | null) {
  if (!isRoleCompatibleWithCompany(role, companyId)) {
    if (companyId) {
      throw new Error("Los usuarios cliente deben conservar un rol cliente.");
    }

    throw new Error("Los usuarios internos no deben quedar asociados a una empresa cliente.");
  }
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function readDemoDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return normalizeDb(JSON.parse(raw) as TicketDatabase);
}

export async function resetDemoDb() {
  await writeDb(deepClone(demoSeed));
}

export async function getAppSnapshot() {
  const db = await readDemoDb();
  return db;
}

export async function createTicket(input: {
  actorId: string;
  title: string;
  description: string;
  contextUrls: string[];
  attachments: File[];
  type: TicketType;
  area: TicketArea;
  priority: TicketPriority;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);

  if (!actor || !actor.companyId || !isClientRole(actor.role)) {
    throw new Error("Solo usuarios cliente pueden crear tickets en este entorno.");
  }

  if (input.contextUrls.length > MAX_TICKET_CONTEXT_URLS) {
    throw new Error(`Solo podés adjuntar hasta ${MAX_TICKET_CONTEXT_URLS} links por ticket.`);
  }

  if (input.attachments.length > MAX_TICKET_IMAGES) {
    throw new Error(`Solo podés adjuntar hasta ${MAX_TICKET_IMAGES} imágenes por ticket.`);
  }

  const nextNumber =
    db.tickets.reduce((max, ticket) => {
      const value = Number(ticket.code.split("-")[1] ?? 0);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 1000) + 1;

  const timestamp = new Date().toISOString();
  const id = `ticket-${crypto.randomUUID()}`;
  const ticket: TicketRecord = {
    id,
    code: `NEX-${nextNumber}`,
    companyId: actor.companyId,
    title: input.title,
    description: input.description,
    contextUrls: input.contextUrls,
    type: input.type,
    area: input.area,
    priority: input.priority,
    status: "new",
    createdById: actor.id,
    assignedToId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.tickets.unshift(ticket);

  const attachmentRecords = await Promise.all(
    input.attachments.map(async (file): Promise<TicketAttachment> => ({
      id: `attachment-${crypto.randomUUID()}`,
      ticketId: ticket.id,
      name: file.name,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      kind: "screenshot",
      url: await fileToDataUrl(file),
    })),
  );

  if (attachmentRecords.length > 0) {
    db.attachments.push(...attachmentRecords);
  }

  db.history.unshift({
    id: `history-${crypto.randomUUID()}`,
    ticketId: ticket.id,
    actorId: actor.id,
    type: "created",
    message: `${actor.name} creó el ticket ${ticket.code}.`,
    createdAt: timestamp,
  });
  await writeDb(db);
  return ticket;
}

export async function addComment(input: {
  actorId: string;
  ticketId: string;
  body: string;
  visibility: "external" | "internal";
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);
  const ticket = db.tickets.find((item) => item.id === input.ticketId);

  if (!actor || !ticket) {
    throw new Error("No pudimos encontrar el usuario o el ticket.");
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

  const timestamp = new Date().toISOString();
  const comment: TicketComment = {
    id: `comment-${crypto.randomUUID()}`,
    ticketId: ticket.id,
    authorId: actor.id,
    body: input.body,
    visibility: input.visibility,
    createdAt: timestamp,
  };

  db.comments.push(comment);
  db.history.unshift({
    id: `history-${crypto.randomUUID()}`,
    ticketId: ticket.id,
    actorId: actor.id,
    type: "commented",
    message: `${actor.name} agregó un comentario ${
      input.visibility === "internal" ? "interno" : "externo"
    }.`,
    createdAt: timestamp,
  });
  ticket.updatedAt = timestamp;
  await writeDb(db);
}

export async function updateTicketWorkflow(input: {
  actorId: string;
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToId: string | null;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);
  const ticket = db.tickets.find((item) => item.id === input.ticketId);

  if (!actor || !ticket || !canManageOperations(actor.role)) {
    throw new Error("No tenés permisos para actualizar el workflow.");
  }

  const timestamp = new Date().toISOString();
  const previousStatus = ticket.status;
  const previousPriority = ticket.priority;
  const previousAssignee = ticket.assignedToId;

  ticket.status = input.status;
  ticket.priority = input.priority;
  ticket.assignedToId = input.assignedToId;
  ticket.updatedAt = timestamp;

  if (previousStatus !== input.status) {
    db.history.unshift({
      id: `history-${crypto.randomUUID()}`,
      ticketId: ticket.id,
      actorId: actor.id,
      type: "status_changed",
      message: `${actor.name} cambió el estado a ${input.status}.`,
      createdAt: timestamp,
    });
  }

  if (previousPriority !== input.priority) {
    db.history.unshift({
      id: `history-${crypto.randomUUID()}`,
      ticketId: ticket.id,
      actorId: actor.id,
      type: "priority_changed",
      message: `${actor.name} cambió la prioridad a ${input.priority}.`,
      createdAt: timestamp,
    });
  }

  if (previousAssignee !== input.assignedToId) {
    const assignee = db.users.find((user) => user.id === input.assignedToId);
    db.history.unshift({
      id: `history-${crypto.randomUUID()}`,
      ticketId: ticket.id,
      actorId: actor.id,
      type: "assigned",
      message: assignee
        ? `${actor.name} asignó el ticket a ${assignee.name}.`
        : `${actor.name} dejó el ticket sin asignar.`,
      createdAt: timestamp,
    });
  }

  await writeDb(db);
}

export async function createUser(input: {
  actorId: string;
  companyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password: string;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);

  if (!actor) {
    throw new Error("Actor inválido.");
  }

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

  if (input.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const user: UserProfile = {
    id: `user-${crypto.randomUUID()}`,
    companyId: input.companyId,
    name: input.name,
    email: input.email,
    role: input.role,
    status: "active",
    title: input.title,
    avatar: input.name
      .split(" ")
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };

  db.users.unshift(user);
  await writeDb(db);
  return user;
}

export async function updateUser(input: {
  actorId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  password?: string;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);
  const target = db.users.find((user) => user.id === input.userId);

  if (!actor || !target) {
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

  target.name = input.name;
  target.email = normalizedEmail;
  target.role = input.role;
  target.title = input.title;
  target.status = "active";
  target.avatar = input.name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  await writeDb(db);
  return target;
}

export async function createCompany(input: {
  actorId: string;
  companyName: string;
  industry: string;
  plan: CompanyPlan;
  adminName: string;
  adminEmail: string;
  adminTitle: string;
  adminPassword: string;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);

  if (!actor || !canManageGlobalCatalog(actor.role)) {
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

  if (input.adminPassword.length < 8) {
    throw new Error("La contraseña del admin debe tener al menos 8 caracteres.");
  }

  const timestamp = new Date().toISOString();
  const baseSlug = slugify(input.companyName) || "empresa";
  const existingSlugs = new Set(db.companies.map((company) => company.slug));
  let slug = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const company: Company = {
    id: `company-${crypto.randomUUID()}`,
    name: input.companyName,
    slug,
    plan: input.plan,
    industry: input.industry,
    status: "onboarding",
    primaryContact: input.adminEmail,
    createdAt: timestamp,
  };

  const adminUser: UserProfile = {
    id: `user-${crypto.randomUUID()}`,
    companyId: company.id,
    name: input.adminName,
    email: input.adminEmail,
    role: "client_admin",
    status: "active",
    title: input.adminTitle,
    avatar: input.adminName
      .split(" ")
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };

  db.companies.unshift(company);
  db.users.unshift(adminUser);
  await writeDb(db);
  return { company, adminUser };
}

export async function updateCompany(input: {
  actorId: string;
  companyId: string;
  name: string;
  slug: string;
  industry: string;
  plan: CompanyPlan;
  status: "active" | "onboarding";
  primaryContact: string;
}) {
  const db = await readDemoDb();
  const actor = db.users.find((user) => user.id === input.actorId);
  const company = db.companies.find((item) => item.id === input.companyId);

  if (!actor || !canManageGlobalCatalog(actor.role)) {
    throw new Error("No tenés permisos para editar empresas.");
  }

  if (!company) {
    throw new Error("No pudimos encontrar la empresa.");
  }

  if (
    !input.name ||
    !input.slug ||
    !input.industry ||
    !input.primaryContact
  ) {
    throw new Error("Nombre, slug, industria y contacto principal son obligatorios.");
  }

  const normalizedSlug = slugify(input.slug) || slugify(input.name) || "empresa";
  const duplicated = db.companies.find(
    (item) => item.id !== company.id && item.slug === normalizedSlug,
  );

  if (duplicated) {
    throw new Error("Ya existe otra empresa con ese slug.");
  }

  company.name = input.name;
  company.slug = normalizedSlug;
  company.industry = input.industry;
  company.plan = input.plan;
  company.status = input.status;
  company.primaryContact = input.primaryContact.toLowerCase();

  await writeDb(db);
  return company;
}
