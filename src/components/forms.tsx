import { ReactNode } from "react";

import {
  addCommentAction,
  createCompanyAction,
  createTicketAction,
  createUserAction,
  logoutClientAction,
  resetDemoAction,
  updateCompanyAction,
  updateTicketWorkflowAction,
} from "@/app/actions";
import {
  Company,
  COMPANY_PLANS,
  TICKET_AREAS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  USER_ROLES,
  areaLabels,
  canCreateTickets,
  canManageGlobalCatalog,
  canManageOperations,
  companyPlanLabels,
  priorityLabels,
  roleLabels,
  statusLabels,
  typeLabels,
  UserProfile,
} from "@/lib/ticketing";

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
        className={`font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.2em] ${
          tone === "light" ? "text-[#5b48c7]" : "text-[var(--brand-secondary)]"
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
    ? "w-full rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638] outline-none transition placeholder:text-[#8f93b4] focus:border-[#7c5bff] focus:bg-white"
    : "w-full rounded-[22px] border border-[var(--border)] bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
}

const COMPANY_STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Activa" },
] as const;

export function ResetDemoForm({ actorId }: { actorId: string }) {
  return (
    <form action={resetDemoAction}>
      <input type="hidden" name="actorId" value={actorId} />
      <button
        type="submit"
        className="rounded-full border border-[var(--border)] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
      >
        Reiniciar demo
      </button>
    </form>
  );
}

export function LogoutClientForm({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  return (
    <form action={logoutClientAction}>
      <button
        type="submit"
        className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
          tone === "light"
            ? "border border-[rgba(67,48,166,0.14)] bg-white/80 text-[#1b1638] hover:border-[#7c5bff] hover:bg-white"
            : "border border-[var(--border)] bg-white/[0.04] text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
        }`}
      >
        Cerrar sesión
      </button>
    </form>
  );
}

export function CreateTicketForm({
  actor,
  tone = "dark",
}: {
  actor: UserProfile;
  tone?: "dark" | "light";
}) {
  if (!canCreateTickets(actor.role)) {
    return (
      <div
        className={`rounded-[28px] border border-dashed p-5 text-sm leading-6 ${
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
    <form action={createTicketAction} className="grid gap-5">
      <input type="hidden" name="actorId" value={actor.id} />
      <Field label="Tipo de solicitud" name="type" tone={tone}>
        <div className="grid gap-3 sm:grid-cols-2">
          {TICKET_TYPES.map((type, index) => (
            <label
              key={type}
              className={`flex cursor-pointer items-start gap-3 rounded-[20px] border p-4 transition ${
                tone === "light"
                  ? "border-[rgba(91,72,199,0.14)] bg-[#faf9ff] hover:border-[#7c5bff]"
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
                <p className={tone === "light" ? "mt-1 text-sm text-[#5a5d7f]" : "mt-1 text-sm text-[var(--muted)]"}>
                  {type === "issue"
                    ? "Algo dejó de funcionar o funciona distinto a lo esperado."
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
          rows={5}
          className={textInputClasses(tone)}
          placeholder="Contanos qué pasa, a quién afecta y cómo se reproduce."
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Área" name="area" tone={tone}>
          <select id="area" name="area" className={textInputClasses(tone)} defaultValue="automation">
            {TICKET_AREAS.map((area) => (
              <option key={area} value={area}>
                {areaLabels[area]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad" name="priority" tone={tone}>
          <select
            id="priority"
            name="priority"
            className={textInputClasses(tone)}
            defaultValue="medium"
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button
        type="submit"
        className="rounded-[22px] bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] px-5 py-3 text-sm font-semibold text-[#120d31] transition hover:translate-y-[-1px] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
      >
        Enviar ticket
      </button>
    </form>
  );
}

export function AddCommentForm({
  actor,
  ticketId,
  returnPath,
  allowInternal,
  tone = "dark",
}: {
  actor: UserProfile;
  ticketId: string;
  returnPath: string;
  allowInternal: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <form action={addCommentAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Nuevo comentario" name="body" tone={tone}>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          className={textInputClasses(tone)}
          placeholder="Sumá contexto, respuesta o próximos pasos."
        />
      </Field>
      {allowInternal ? (
        <Field label="Visibilidad" name="visibility" tone={tone}>
          <select
            id="visibility"
            name="visibility"
            className={textInputClasses(tone)}
            defaultValue="external"
          >
            <option value="external">Externo</option>
            <option value="internal">Interno</option>
          </select>
        </Field>
      ) : (
        <input type="hidden" name="visibility" value="external" />
      )}
      <button
        type="submit"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      >
        Publicar comentario
      </button>
    </form>
  );
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
    <form action={updateTicketWorkflowAction} className="grid gap-4">
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
      <button
        type="submit"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      >
        Guardar workflow
      </button>
    </form>
  );
}

export function CreateUserForm({
  actor,
  companyId,
  returnPath,
  clientOnly = false,
  tone = "dark",
}: {
  actor: UserProfile;
  companyId: string | null;
  returnPath: string;
  clientOnly?: boolean;
  tone?: "dark" | "light";
}) {
  const roles = clientOnly
    ? USER_ROLES.filter((role) => role.startsWith("client_"))
    : companyId
      ? USER_ROLES
      : USER_ROLES.filter((role) => !role.startsWith("client_"));

  return (
    <form action={createUserAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="companyId" value={companyId ?? "internal"} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Nombre" name="name" tone={tone}>
        <input id="name" name="name" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Email" name="email" tone={tone}>
        <input id="email" name="email" type="email" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Cargo" name="title" tone={tone}>
        <input id="title" name="title" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Contraseña inicial" name="password" tone={tone}>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className={textInputClasses(tone)}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>
      <Field label="Rol" name="role" tone={tone}>
        <select id="role" name="role" className={textInputClasses(tone)} defaultValue={roles[0]}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="submit"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      >
        Invitar usuario
      </button>
    </form>
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
    <form action={createCompanyAction} className="grid gap-4">
      <input type="hidden" name="actorId" value={actor.id} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <Field label="Empresa" name="companyName" tone={tone}>
        <input id="companyName" name="companyName" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Industria" name="industry" tone={tone}>
        <input id="industry" name="industry" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Plan" name="plan" tone={tone}>
        <select id="plan" name="plan" className={textInputClasses(tone)} defaultValue="growth">
          {COMPANY_PLANS.map((plan) => (
            <option key={plan} value={plan}>
              {companyPlanLabels[plan]}
            </option>
          ))}
        </select>
      </Field>
      <div className="h-px bg-[linear-gradient(90deg,rgba(196,198,255,0.4),transparent)]" />
      <Field label="Admin inicial" name="adminName" tone={tone}>
        <input id="adminName" name="adminName" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Email admin" name="adminEmail" tone={tone}>
        <input id="adminEmail" name="adminEmail" type="email" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Cargo admin" name="adminTitle" tone={tone}>
        <input id="adminTitle" name="adminTitle" required className={textInputClasses(tone)} />
      </Field>
      <Field label="Contraseña admin" name="adminPassword" tone={tone}>
        <input
          id="adminPassword"
          name="adminPassword"
          type="password"
          minLength={8}
          required
          className={textInputClasses(tone)}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>
      <button
        type="submit"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      >
        Crear empresa y admin
      </button>
    </form>
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
    <form action={updateCompanyAction} className="grid gap-4">
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
        <Field label="Plan" name="plan" tone={tone}>
          <select
            id="plan"
            name="plan"
            className={textInputClasses(tone)}
            defaultValue={company.plan}
          >
            {COMPANY_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {companyPlanLabels[plan]}
              </option>
            ))}
          </select>
        </Field>
      </div>
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
      <button
        type="submit"
        className={`rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:translate-y-[-1px] ${
          tone === "light"
            ? "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#120d31] hover:shadow-[0_18px_40px_rgba(124,91,255,0.24)]"
        }`}
      >
        Guardar cambios
      </button>
    </form>
  );
}
