import Link from "next/link";

import { AreaPill, PriorityPill, RolePill, StatusPill, TimelineDate } from "@/components/ui";
import { getCompany, getUser } from "@/lib/queries";
import { TicketDatabase, TicketRecord, UserProfile } from "@/lib/ticketing";

export function TicketTable({
  db,
  tickets,
  actor,
  basePath,
  tone = "dark",
}: {
  db: TicketDatabase;
  tickets: TicketRecord[];
  actor: UserProfile;
  basePath: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`overflow-hidden rounded-[28px] ${
        tone === "light"
          ? "border border-[rgba(91,72,199,0.12)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(91,72,199,0.08)]" : "divide-y divide-[var(--border)]"}`}>
        <thead className={tone === "light" ? "bg-[#f7f5ff] text-[#5a5d7f]" : "bg-white/[0.05] text-[var(--muted-strong)]"}>
          <tr>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Ticket</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Empresa</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Área</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Estado</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Prioridad</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Asignado</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Última actividad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {tickets.map((ticket) => {
            const company = getCompany(db, ticket.companyId);
            const assignee = getUser(db, ticket.assignedToId);
            return (
              <tr
                key={ticket.id}
                className={
                  tone === "light"
                    ? "bg-transparent text-[#1b1638] transition hover:bg-[#faf9ff]"
                    : "bg-transparent text-slate-100 transition hover:bg-white/[0.03]"
                }
              >
                <td className="px-4 py-4 align-top">
                  <Link
                    href={`${basePath}/tickets/${ticket.id}?actor=${actor.id}`}
                    className="block transition hover:text-[var(--brand-secondary)]"
                  >
                    <p className="font-semibold">{ticket.code}</p>
                    <p className={`mt-1 max-w-sm text-sm ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>{ticket.title}</p>
                  </Link>
                </td>
                <td className={`px-4 py-4 align-top ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>{company?.name ?? "NexOps"}</td>
                <td className="px-4 py-4 align-top">
                  <AreaPill area={ticket.area} />
                </td>
                <td className="px-4 py-4 align-top">
                  <StatusPill status={ticket.status} />
                </td>
                <td className="px-4 py-4 align-top">
                  <PriorityPill priority={ticket.priority} />
                </td>
                <td className={`px-4 py-4 align-top ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>
                  {assignee ? assignee.name : "Sin asignar"}
                </td>
                <td className="px-4 py-4 align-top">
                  <TimelineDate value={ticket.updatedAt} tone={tone} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      className={`overflow-hidden rounded-[28px] ${
        tone === "light"
          ? "border border-[rgba(91,72,199,0.12)] bg-white"
          : "border border-[var(--border)] bg-white/[0.02]"
      }`}
    >
      <table className={`min-w-full text-left text-sm ${tone === "light" ? "divide-y divide-[rgba(91,72,199,0.08)]" : "divide-y divide-[var(--border)]"}`}>
        <thead className={tone === "light" ? "bg-[#f7f5ff] text-[#5a5d7f]" : "bg-white/[0.05] text-[var(--muted-strong)]"}>
          <tr>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Usuario</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Rol</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Estado</th>
            <th className="px-4 py-3 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em]">Cargo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {users.map((user) => (
            <tr
              key={user.id}
              className={
                tone === "light"
                  ? "bg-transparent text-[#1b1638] transition hover:bg-[#faf9ff]"
                  : "bg-transparent text-slate-100 transition hover:bg-white/[0.03]"
              }
            >
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold ${
                    tone === "light"
                      ? "bg-[linear-gradient(145deg,rgba(124,91,255,0.16),rgba(67,48,166,0.1))] text-[#5b48c7]"
                      : "bg-[linear-gradient(145deg,rgba(124,91,255,0.22),rgba(67,48,166,0.16))] text-[var(--brand-secondary)]"
                  }`}>
                    {user.avatar}
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className={tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}>{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <RolePill role={user.role} />
              </td>
              <td className={`px-4 py-4 ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>{user.status}</td>
              <td className={`px-4 py-4 ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>{user.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
