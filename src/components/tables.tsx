import Link from "next/link";

import { AreaPill, PriorityPill, RolePill, StatusPill, TimelineDate } from "@/components/ui";
import { getCompany, getUser } from "@/lib/queries";
import { TicketDatabase, TicketRecord, UserProfile } from "@/lib/ticketing";

export function TicketTable({
  db,
  tickets,
  basePath,
  tone = "dark",
  showCompany = true,
  actionLabel = "Gestionar",
}: {
  db: TicketDatabase;
  tickets: TicketRecord[];
  basePath: string;
  tone?: "dark" | "light";
  showCompany?: boolean;
  actionLabel?: string;
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
      className={`overflow-hidden rounded-[22px] ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <div className="overflow-x-auto">
        <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(17,24,39,0.06)]" : "divide-y divide-[var(--border)]"}`}>
          <thead className={headClass}>
            <tr>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Ticket</th>
              {showCompany ? (
                <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Empresa</th>
              ) : null}
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Estado</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Prioridad</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Área</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Asignado</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Actualizado</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {tickets.map((ticket) => {
              const company = getCompany(db, ticket.companyId);
              const assignee = getUser(db, ticket.assignedToId);
              const detailHref = `${basePath}/tickets/${ticket.id}`;

              return (
                <tr key={ticket.id} className={rowClass}>
                  <td className="px-4 py-3 align-top">
                    <Link href={detailHref} className="block transition hover:text-[#4330a6]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{ticket.code}</span>
                      </div>
                      <p className={`mt-1 max-w-[340px] leading-5 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                        {ticket.title}
                      </p>
                    </Link>
                  </td>
                  {showCompany ? (
                    <td className={`px-4 py-3 align-top ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                      {company?.name ?? "NexOps"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 align-top">
                    <StatusPill status={ticket.status} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <PriorityPill priority={ticket.priority} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <AreaPill area={ticket.area} />
                  </td>
                  <td className={`px-4 py-3 align-top ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>
                    {assignee ? assignee.name : "Sin asignar"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <TimelineDate value={ticket.updatedAt} tone={tone} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={detailHref}
                      className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
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
      className={`overflow-hidden rounded-[22px] ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <div className="overflow-x-auto">
        <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(17,24,39,0.06)]" : "divide-y divide-[var(--border)]"}`}>
          <thead className={tone === "light" ? "bg-[#f9fafb] text-[#6b7280]" : "bg-white/[0.05] text-[var(--muted-strong)]"}>
            <tr>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Usuario</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Rol</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Estado</th>
              <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em]">Cargo</th>
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
                <td className={`px-4 py-3 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>{user.status}</td>
                <td className={`px-4 py-3 ${tone === "light" ? "text-[#4b5563]" : "text-[var(--muted)]"}`}>{user.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
