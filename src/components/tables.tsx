import Link from "next/link";

import { AreaPill, PriorityPill, RolePill, StatusPill, TimelineDate } from "@/components/ui";
import { getCompany, getUser } from "@/lib/queries";
import { ticketDetailPath } from "@/lib/routing";
import { TicketDatabase, TicketRecord, UserProfile, getTicketNextStep } from "@/lib/ticketing";

export function TicketTable({
  db,
  tickets,
  basePath,
  tone = "dark",
  showCompany = true,
  actionLabel = "Gestionar",
  clientView = false,
}: {
  db: TicketDatabase;
  tickets: TicketRecord[];
  basePath: string;
  tone?: "dark" | "light";
  showCompany?: boolean;
  actionLabel?: string;
  clientView?: boolean;
}) {
  const headClass =
    tone === "light"
      ? "bg-[#f9fafb] text-[#6b7280]"
      : "bg-white/[0.05] text-[var(--muted-strong)]";
  const rowClass =
    tone === "light"
      ? "bg-transparent text-[#111827] transition hover:bg-[#fafafa]"
      : "bg-transparent text-slate-100 transition hover:bg-white/[0.03]";

  return (
    <div
      className={`overflow-hidden rounded-xl ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <div className="hidden overflow-x-auto md:block">
        <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(17,24,39,0.06)]" : "divide-y divide-[var(--border)]"}`}>
          <thead className={headClass}>
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold">Ticket</th>
              {showCompany ? (
                <th className="px-3 py-2.5 text-xs font-semibold">Empresa</th>
              ) : null}
              <th className="px-3 py-2.5 text-xs font-semibold">Estado</th>
              <th className="px-3 py-2.5 text-xs font-semibold">{clientView ? "Nivel de atención" : "Prioridad"}</th>
              <th className="hidden px-3 py-2.5 text-xs font-semibold xl:table-cell">Área</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Responsable</th>
              <th className="hidden px-3 py-2.5 text-xs font-semibold lg:table-cell">Próximo paso</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Actualizado</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {tickets.map((ticket) => {
              const company = getCompany(db, ticket.companyId);
              const assignee = getUser(db, ticket.assignedToId);
              const detailHref = ticketDetailPath(basePath, ticket);

              return (
                <tr key={ticket.id} className={`${rowClass} relative group`}>
                  <td className="px-3 py-2.5 align-top">
                    <Link href={detailHref} aria-label={`Abrir ${ticket.code}: ${ticket.title}`} className="block transition after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-violet-600 group-hover:text-[#4330a6]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{ticket.code}</span>
                      </div>
                      <p className={`mt-0.5 max-w-[300px] text-xs leading-4 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                        {ticket.title}
                      </p>
                    </Link>
                  </td>
                  {showCompany ? (
                    <td className={`px-3 py-2.5 align-top ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                      {company?.name ?? "NexOps"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 align-top">
                    <StatusPill status={ticket.status} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <PriorityPill priority={ticket.priority} />
                  </td>
                  <td className="hidden px-3 py-2.5 align-top xl:table-cell">
                    <AreaPill area={ticket.area} />
                  </td>
                  <td className={`px-3 py-2.5 align-top ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                    {assignee ? assignee.name : "Sin asignar"}
                  </td>
                  <td className="hidden max-w-[220px] px-3 py-2.5 align-top text-xs leading-4 text-slate-600 lg:table-cell">
                    {getTicketNextStep(ticket)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <TimelineDate value={ticket.updatedAt} tone={tone} />
                  </td>
                  <td className="relative z-10 px-3 py-2.5 align-top">
                    <Link
                      href={detailHref}
                      className={`inline-flex rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        tone === "light"
                          ? "border border-[rgba(17,24,39,0.1)] bg-white text-[#111827] hover:border-[#111827]"
                          : "border border-[var(--border)] bg-white/[0.06] text-[var(--brand-secondary)]"
                      }`}
                    >
                      {actionLabel}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-200 md:hidden">
        {tickets.map((ticket) => {
          const company = getCompany(db, ticket.companyId);
          const assignee = getUser(db, ticket.assignedToId);
          const detailHref = ticketDetailPath(basePath, ticket);
          return (
            <article key={ticket.id} className="relative grid gap-2 px-3 py-3 transition hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={detailHref} aria-label={`Abrir ${ticket.code}: ${ticket.title}`} className="font-semibold text-slate-950 after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-violet-600">
                    {ticket.code}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-slate-700">{ticket.title}</p>
                </div>
                <StatusPill status={ticket.status} />
              </div>
              {showCompany ? <p className="truncate text-xs text-slate-600">{company?.name ?? "NexOps"}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <PriorityPill priority={ticket.priority} />
                <AreaPill area={ticket.area} />
                <span className="text-xs text-slate-600">{assignee?.name ?? "Sin asignar"}</span>
              </div>
              <p className="text-xs leading-4 text-slate-600"><span className="font-semibold">Próximo:</span> {getTicketNextStep(ticket)}</p>
              <div className="flex items-center justify-between gap-3">
                <TimelineDate value={ticket.updatedAt} tone={tone} />
                <Link href={detailHref} className="relative z-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900">{actionLabel}</Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function UserTable({
  users,
  tone = "dark",
}: {
  users: UserProfile[];
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <div className="overflow-x-auto">
        <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(17,24,39,0.06)]" : "divide-y divide-[var(--border)]"}`}>
          <thead className={tone === "light" ? "bg-[#f9fafb] text-[#6b7280]" : "bg-white/[0.05] text-[var(--muted-strong)]"}>
            <tr>
              <th className="px-3 py-2.5 text-xs font-semibold">Usuario</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Rol</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Estado</th>
              <th className="px-3 py-2.5 text-xs font-semibold">Cargo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {users.map((user) => (
              <tr
                key={user.id}
                className={
                  tone === "light"
                    ? "bg-transparent text-[#111827] transition hover:bg-[#fafafa]"
                    : "bg-transparent text-slate-100 transition hover:bg-white/[0.03]"
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-semibold ${
                        tone === "light"
                          ? "bg-[#eef2ff] text-[#4330a6]"
                          : "bg-[linear-gradient(145deg,rgba(124,91,255,0.22),rgba(67,48,166,0.16))] text-[var(--brand-secondary)]"
                      }`}
                    >
                      {user.avatar}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className={tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"}>{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RolePill role={user.role} />
                </td>
                <td className={`px-4 py-3 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>{user.status === "active" ? "Activo" : "Invitado"}</td>
                <td className={`px-4 py-3 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>{user.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
