import { ReactNode } from "react";

import {
  createCompanyAction,
  createTicketAction,
  logoutClientAction,
  updateCompanyAction,
  updateCompanyModulesAction,
  updateTicketWorkflowAction,
  updateUserAction,
} from "@/app/actions";
import { TicketEvidenceFields } from "@/components/ticket-evidence-fields";
import { CommentForm } from "@/components/comment-form";
import { PendingForm, PendingSubmitButton } from "@/components/pending-form";
import {
  Company,
  TICKET_AREAS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  USER_ROLES,
  areaLabels,
  canCreateTickets,
  canManageGlobalCatalog,
  canManageOperations,
  priorityLabels,
  roleLabels,
  statusLabels,
  typeLabels,
  UserProfile,
} from "@/lib/ticketing";

export { CreateUserForm } from "@/components/create-user-form";

function Field({
  label,
  name,
  children,
  tone = "dark",
}: {
  label: string;
  name: string;
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <label
      className={`grid gap-2 text-sm ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}
      htmlFor={name}
    >
      <span
        className={`text-xs font-semibold ${
          tone === "light" ? "text-slate-700" : "text-[var(--brand-secondary)]"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function textInputClasses(tone: "dark" | "light" = "dark") {
  return tone === "light"
    ? "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
    : "min-h-10 w-full rounded-lg border border-[var(--border)] bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
}

const COMPANY_STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Activa" },
] as const;

export function LogoutClientForm({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  return (
    <PendingForm action={logoutClientAction}>
      <PendingSubmitButton
        idleLabel="Cerrar sesión"
        pendingLabel="Cerrando…"
        className={`min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition ${
          tone === "light"
            ? "border border-[rgba(67,48,166,0.14)] bg-white/80 text-[#1b1638] hover:border-[#7c5bff] hover:bg-white"
            : "border border-[var(--border)] bg-white/[0.04] text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
        }`}
      />
    </PendingForm>
  );
}

export function CreateTicketForm({
  actor,
  tone = "dark",
  compact = false,
}: {
  actor: UserProfile;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  if (!canCreateTickets(actor.role)) {
    return (
      <div
        className={`rounded-xl border border-dashed p-4 text-sm leading-6 ${
          tone === "light"
            ? "border-[rgba(91,72,199,0.2)] bg-[#f5f3ff] text-[#5a5d7f]"
            : "border-[var(--border-strong)] bg-white/[0.03] text-[var(--muted)]"
        }`}
      >
        Este rol puede revisar tickets, pero no crear nuevos.
      </div>
    );
  }

  return (
    <PendingForm action={createTicketAction} className={`grid ${compact ? "gap-3.5" : "gap-4"}`}>
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <input type="hidden" name="actorId" value={actor.id} />
      <Field label="Tipo de solicitud" name="type" tone={tone}>
        <div className={`grid gap-2 ${compact ? "md:grid-cols-2" : "sm:grid-cols-2"}`}>
          {TICKET_TYPES.map((type, index) => (
            <label
              key={type}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${
                tone === "light"
                  ? "border-slate-200 bg-white hover:border-violet-500"
                  : "border-[var(--border)] bg-white/[0.04] hover:border-[var(--border-strong)]"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={type}
                defaultChecked={index === 0}
                className="mt-1 h-4 w-4 accent-[#7c5bff]"
              />
              <div>
                <p className={tone === "light" ? "font-semibold text-[#1b1638]" : "font-semibold text-white"}>
                  {typeLabels[type]}
                </p>
                <p className={tone === "light" ? "mt-0.5 text-xs leading-4 text-slate-600" : "mt-0.5 text-xs leading-4 text-[var(--muted)]"}>
                  {type === "issue"
                    ? compact
                      ? "Algo dejó de funcionar."
                      : "Algo dejó de funcionar o funciona distinto a lo esperado."
                    : compact
                      ? "Querés un ajuste puntual."
                      : "Querés pedir un ajuste o una mejora sobre algo existente."}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Título" name="title" tone={tone}>
        <input
          id="title"
          name="title"
          required
          className={textInputClasses(tone)}
          placeholder="Ej. Error en sincronización de leads"
        />
      </Field>
      <Field label="Descripción" name="description" tone={tone}>
        <textarea
          id="description"
          name="description"
          required
          rows={compact ? 3 : 4}
          className={textInputClasses(tone)}
          placeholder="Contanos qué pasa, a quién afecta y cómo se reproduce."
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Área" name="area" tone={tone}>
          <select id="area" name="area" className={textInputClasses(tone)} defaultValue="automation">
            {TICKET_AREAS.map((area) => (
              <option key={area} value={area}>
                {areaLabels[area]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Impacto" name="impact" tone={tone}>
          <select id="impact" name="impact" className={textInputClasses(tone)} defaultValue="individual">
            <option value="individual">Individual · afecta a una persona</option>
            <option value="partial">Parcial · afecta a un equipo o proceso</option>
            <option value="general">General · afecta toda la operación</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Urgencia informada" name="urgency" tone={tone}>
          <select id="urgency" name="urgency" className={textInputClasses(tone)} defaultValue="can_wait">
            <option value="can_wait">Puede esperar</option>
            <option value="today">Necesito resolverlo hoy</option>
            <option value="immediate">Necesito atención inmediata</option>
          </select>
        </Field>
        <Field label="¿Podés seguir trabajando?" name="workContinuity" tone={tone}>
          <select id="workContinuity" name="workContinuity" className={textInputClasses(tone)} defaultValue="normal">
            <option value="normal">Sí, normalmente</option>
            <option value="workaround">Sí, con una alternativa</option>
            <option value="blocked">No, el trabajo está detenido</option>
          </select>
        </Field>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
        NexOps evaluará el contexto y asignará el nivel de atención. El cliente no define la prioridad operativa.
      </p>

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-slate-800">
          Agregar archivos, imágenes o enlaces
        </summary>
        <div className="border-t border-slate-200 p-3">
          <TicketEvidenceFields inputClassName={textInputClasses(tone)} tone={tone} />
        </div>
      </details>
      <PendingSubmitButton
        idleLabel="Crear ticket"
        pendingLabel="Creando…"
        className="min-h-11 rounded-lg bg-[#5b48c7] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4936ad]"
      />
    </PendingForm>
  );
}

export function AddCommentForm({
  actor,
  ticketId,
  returnPath,
  visibility = "external",
  label = "Nuevo mensaje",
  submitLabel = "Responder al cliente",
  tone = "dark",
}: {
  actor: UserProfile;
  ticketId: string;
  returnPath: string;
  visibility?: "external" | "internal";
  label?: string;
  submitLabel?: string;
  tone?: "dark" | "light";
}) {
  return <CommentForm actorId={actor.id} ticketId={ticketId} returnPath={returnPath} visibility={visibility} label={label} submitLabel={submitLabel} tone={tone} />;
}

export function TicketWorkflowForm({
  actor,
  ticketId,
  assignedToId,
  status,
  priority,
  internalAgents,
  returnPath,
  tone = "dark",
}: {
  actor: UserProfile;
  ticketId: string;
  assignedToId: string | null;
  status: string;
  priority: string;
  internalAgents: UserProfile[];
  returnPath: string;
  tone?: "dark" | "light";
}) {
  if (!canManageOperations(actor.role)) {
    return (
      <div
        className={`rounded-[28px] border border-dashed p-5 text-sm leading-6 ${
          tone === "light"
            ? "border-[rgba(91,72,199,0.2)] bg-[#f5f3ff] text-[#5a5d7f]"
            : "border-[var(--border-strong)] bg-white/[0.03] text-[var(--muted)]"
        }`}
      >
        Este rol puede ver el detalle, pero no actualizar el workflow del ticket.
      </div>
    );
  }

  return (
    <PendingForm action={updateTicketWorkflowAction} className="grid gap-3">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Estado" name="status" tone={tone}>
        <select id="status" name="status" className={textInputClasses(tone)} defaultValue={status}>
          {TICKET_STATUSES.map((item) => (
            <option key={item} value={item}>
              {statusLabels[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Prioridad" name="priority" tone={tone}>
        <select id="priority" name="priority" className={textInputClasses(tone)} defaultValue={priority}>
          {TICKET_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {priorityLabels[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Asignado a" name="assignedToId" tone={tone}>
        <select
          id="assignedToId"
          name="assignedToId"
          className={textInputClasses(tone)}
          defaultValue={assignedToId ?? "unassigned"}
        >
          <option value="unassigned">Sin asignar</option>
          {internalAgents.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </Field>
      <PendingSubmitButton
        idleLabel="Guardar cambios"
        pendingLabel="Guardando…"
        className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
          tone === "light"
            ? "bg-[#5b48c7] text-white hover:bg-[#4936ad]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      />
    </PendingForm>
  );
}

export function CreateCompanyForm({
  actor,
  returnPath,
  tone = "dark",
}: {
  actor: UserProfile;
  returnPath: string;
  tone?: "dark" | "light";
}) {
  if (!canManageGlobalCatalog(actor.role)) {
    return (
      <div
        className={`rounded-[28px] border border-dashed p-5 text-sm leading-6 ${
          tone === "light"
            ? "border-[rgba(91,72,199,0.2)] bg-[#f5f3ff] text-[#5a5d7f]"
            : "border-[var(--border-strong)] bg-white/[0.03] text-[var(--muted)]"
        }`}
      >
        Este rol puede operar tickets, pero no crear nuevas empresas cliente.
      </div>
    );
  }

  return (
    <PendingForm action={createCompanyAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Nombre de la empresa" name="companyName" tone={tone}>
        <input
          id="companyName"
          name="companyName"
          required
          className={textInputClasses(tone)}
          placeholder="Ej. NexMart Retail"
        />
      </Field>
      <Field label="Industria" name="industry" tone={tone}>
        <input
          id="industry"
          name="industry"
          required
          className={textInputClasses(tone)}
          placeholder="Ej. Retail omnicanal"
        />
      </Field>
      <input type="hidden" name="plan" value="growth" />
      <div className="h-px bg-[linear-gradient(90deg,rgba(196,198,255,0.4),transparent)]" />
      <Field label="Responsable inicial" name="adminName" tone={tone}>
        <input
          id="adminName"
          name="adminName"
          required
          className={textInputClasses(tone)}
          placeholder="Nombre y apellido"
        />
      </Field>
      <Field label="Email de acceso" name="adminEmail" tone={tone}>
        <input
          id="adminEmail"
          name="adminEmail"
          type="email"
          required
          className={textInputClasses(tone)}
          placeholder="nombre@empresa.com"
        />
      </Field>
      <Field label="Rol o cargo" name="adminTitle" tone={tone}>
        <input
          id="adminTitle"
          name="adminTitle"
          required
          className={textInputClasses(tone)}
          placeholder="Ej. Operaciones, Marketing, IT"
        />
      </Field>
      <p className={`text-xs leading-5 ${tone === "light" ? "text-slate-600" : "text-[var(--muted)]"}`}>
        El responsable recibirá un enlace temporal para elegir su propia contraseña.
      </p>
      <PendingSubmitButton
        idleLabel="Crear empresa"
        pendingLabel="Creando…"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      />
    </PendingForm>
  );
}

export function UpdateCompanyForm({
  actor,
  company,
  returnPath,
  tone = "dark",
}: {
  actor: UserProfile;
  company: Company;
  returnPath: string;
  tone?: "dark" | "light";
}) {
  if (!canManageGlobalCatalog(actor.role)) {
    return (
      <div
        className={`rounded-[28px] border border-dashed p-5 text-sm leading-6 ${
          tone === "light"
            ? "border-[rgba(91,72,199,0.2)] bg-[#f5f3ff] text-[#5a5d7f]"
            : "border-[var(--border-strong)] bg-white/[0.03] text-[var(--muted)]"
        }`}
      >
        Este rol puede revisar la cuenta, pero no editar la ficha de la empresa.
      </div>
    );
  }

  return (
    <PendingForm action={updateCompanyAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Empresa" name="name" tone={tone}>
        <input
          id="name"
          name="name"
          required
          defaultValue={company.name}
          className={textInputClasses(tone)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Slug" name="slug" tone={tone}>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={company.slug}
            className={textInputClasses(tone)}
          />
        </Field>
        <Field label="Estado" name="status" tone={tone}>
          <select
            id="status"
            name="status"
            className={textInputClasses(tone)}
            defaultValue={company.status}
          >
            {COMPANY_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Industria" name="industry" tone={tone}>
          <input
            id="industry"
            name="industry"
            required
            defaultValue={company.industry}
            className={textInputClasses(tone)}
          />
        </Field>
      </div>
      <input type="hidden" name="plan" value={company.plan} />
      <Field label="Contacto principal" name="primaryContact" tone={tone}>
        <input
          id="primaryContact"
          name="primaryContact"
          type="email"
          required
          defaultValue={company.primaryContact}
          className={textInputClasses(tone)}
        />
      </Field>
      <PendingSubmitButton
        idleLabel="Guardar cambios"
        pendingLabel="Guardando…"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      />
    </PendingForm>
  );
}

export function UpdateCompanyModulesForm({
  actor,
  company,
  returnPath,
}: {
  actor: UserProfile;
  company: Company;
  returnPath: string;
}) {
  if (!canManageGlobalCatalog(actor.role)) {
    return (
      <div className="rounded-[20px] border border-dashed border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-[#5a5d7f]">
        Este rol puede revisar los productos de la cuenta, pero no cambiar su disponibilidad.
      </div>
    );
  }

  const modules = [
    {
      name: "metricsEnabled",
      title: "Métricas",
      description: "Reportería de campañas, KPIs y evolución de resultados.",
      enabled: company.modules.metrics.enabled,
    },
    {
      name: "radarEnabled",
      title: "Radar",
      description: "Planificación y gestión integral del contenido de la empresa.",
      enabled: company.modules.radar.enabled,
    },
  ] as const;

  return (
    <PendingForm action={updateCompanyModulesAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="returnPath" value={returnPath} />

      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((module) => (
          <label
            key={module.name}
            className="flex cursor-pointer items-start gap-3 rounded-[18px] border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:bg-violet-50/40"
          >
            <input
              type="checkbox"
              name={module.name}
              defaultChecked={module.enabled}
              className="mt-1 size-4 accent-violet-700"
            />
            <span className="grid gap-1">
              <span className="text-sm font-semibold text-slate-950">{module.title}</span>
              <span className="text-xs leading-5 text-slate-600">{module.description}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
                {module.enabled ? "Habilitado" : "No disponible"}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-600">
        El cambio define qué productos aparecen en el Portal de esta empresa y también protege el acceso directo a cada ruta.
      </p>

      <PendingSubmitButton
        idleLabel="Guardar productos"
        pendingLabel="Guardando…"
        className="rounded-[22px] bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] px-5 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
      />
    </PendingForm>
  );
}

export function UpdateUserForm({
  actor,
  user,
  returnPath,
  tone = "dark",
}: {
  actor: UserProfile;
  user: UserProfile;
  returnPath: string;
  tone?: "dark" | "light";
}) {
  const roles = user.companyId
    ? USER_ROLES.filter((role) => role.startsWith("client_"))
    : USER_ROLES.filter((role) => !role.startsWith("client_"));

  return (
    <PendingForm action={updateUserAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Nombre" name={`name-${user.id}`} tone={tone}>
        <input
          id={`name-${user.id}`}
          name="name"
          required
          defaultValue={user.name}
          className={textInputClasses(tone)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email" name={`email-${user.id}`} tone={tone}>
          <input
            id={`email-${user.id}`}
            name="email"
            type="email"
            required
            defaultValue={user.email}
            className={textInputClasses(tone)}
          />
        </Field>
        <Field label="Rol" name={`role-${user.id}`} tone={tone}>
          <select
            id={`role-${user.id}`}
            name="role"
            className={textInputClasses(tone)}
            defaultValue={user.role}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4">
        <Field label="Cargo" name={`title-${user.id}`} tone={tone}>
          <input
            id={`title-${user.id}`}
            name="title"
            required
            defaultValue={user.title}
            className={textInputClasses(tone)}
          />
        </Field>
      </div>
      <Field label="Estado de acceso" name={`status-${user.id}`} tone={tone}>
        <select
          id={`status-${user.id}`}
          name="status"
          className={textInputClasses(tone)}
          defaultValue={user.status}
        >
          {(user.status === "invited" ? ["invited", "disabled"] : ["active", "disabled"]).map((status) => (
            <option key={status} value={status}>
              {status === "active" ? "Activo" : status === "invited" ? "Invitación pendiente" : "Deshabilitado"}
            </option>
          ))}
        </select>
      </Field>
      <PendingSubmitButton
        idleLabel="Guardar usuario"
        pendingLabel="Guardando…"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      />
    </PendingForm>
  );
}
