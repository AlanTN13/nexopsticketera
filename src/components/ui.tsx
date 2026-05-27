import Link from "next/link";
import { ReactNode } from "react";

import {
  TicketArea,
  TicketPriority,
  TicketStatus,
  UserRole,
  areaLabels,
  formatRelativeDate,
  priorityLabels,
  roleLabels,
  statusLabels,
} from "@/lib/ticketing";

export function AppShell({
  title,
  eyebrow,
  description,
  actions,
  children,
  tone = "dark",
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div
        className={`overflow-hidden rounded-[32px] backdrop-blur ${
          tone === "light"
            ? "border border-[rgba(67,48,166,0.16)] bg-white/72 shadow-[0_24px_70px_rgba(124,91,255,0.12)]"
            : "border border-[var(--border)] bg-[var(--panel)] shadow-[0_30px_120px_rgba(3,2,16,0.55)]"
        }`}
      >
        <div
          className={`px-5 py-4 sm:px-7 ${
            tone === "light" ? "border-b border-[rgba(67,48,166,0.14)]" : "border-b border-[var(--border)]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7c5bff,#4330a6)] text-lg font-black text-white shadow-[0_16px_40px_rgba(124,91,255,0.28)]">
                N
              </div>
              <div>
                <p
                  className={`text-base font-bold tracking-tight ${
                    tone === "light" ? "text-[#1b1638]" : "text-[var(--brand-highlight)]"
                  }`}
                >
                  NexOps
                </p>
                <p
                  className={`font-[family-name:var(--font-montserrat)] text-xs font-medium uppercase tracking-[0.3em] ${
                    tone === "light" ? "text-[#5b48c7]" : "text-[var(--brand-secondary)]"
                  }`}
                >
                  Help Center
                </p>
              </div>
            </div>
            <div
              className={`font-[family-name:var(--font-montserrat)] text-xs uppercase tracking-[0.26em] ${
                tone === "light" ? "text-[#7b74a6]" : "text-[var(--muted)]"
              }`}
            >
              Soporte y seguimiento para clientes
            </div>
          </div>
        </div>
        <div className="grid gap-6 px-5 py-7 sm:px-7 sm:py-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-4">
            <p
              className={`font-[family-name:var(--font-montserrat)] text-xs font-semibold uppercase tracking-[0.34em] sm:text-sm ${
                tone === "light" ? "text-[#5b48c7]" : "text-[var(--brand-secondary)]"
              }`}
            >
              {eyebrow}
            </p>
            <div className="space-y-3">
              <h1
                className={`max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl ${
                  tone === "light" ? "text-[#1b1638]" : "text-white"
                }`}
              >
                {title}
              </h1>
              <p
                className={`max-w-3xl text-sm leading-7 sm:text-[15px] ${
                  tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"
                }`}
              >
                {description}
              </p>
            </div>
            <div
              className={`h-px w-full max-w-xl ${
                tone === "light"
                  ? "bg-[linear-gradient(90deg,rgba(91,72,199,0.28),transparent)]"
                  : "bg-[linear-gradient(90deg,rgba(196,198,255,0.55),transparent)]"
              }`}
            />
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-8 flex flex-1 flex-col gap-8">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "dark",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`rounded-[28px] p-5 ${
        tone === "light"
          ? "border border-[rgba(91,72,199,0.12)] bg-white/78 shadow-[0_14px_30px_rgba(124,91,255,0.08)]"
          : "border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      }`}
    >
      <p
        className={`font-[family-name:var(--font-montserrat)] text-xs font-semibold uppercase tracking-[0.26em] ${
          tone === "light" ? "text-[#7b74a6]" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-4 text-3xl font-black tracking-[-0.05em] ${
          tone === "light" ? "text-[#1b1638]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className={`mt-3 text-sm leading-6 ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>
        {detail}
      </p>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  tone = "dark",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <section
      className={`rounded-[30px] p-6 backdrop-blur ${
        tone === "light"
          ? "border border-[rgba(196,198,255,0.74)] bg-white/82 shadow-[0_24px_70px_rgba(6,4,20,0.12)]"
          : "border border-[var(--border)] bg-[var(--panel-strong)] shadow-[0_18px_80px_rgba(5,3,19,0.45)]"
      }`}
    >
      <div className="mb-6 space-y-2">
        <h2
          className={`text-2xl font-black tracking-[-0.04em] ${
            tone === "light" ? "text-[#1b1638]" : "text-white"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p className={`max-w-3xl text-sm leading-6 ${tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"}`}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const styles = {
    neutral: "border-[var(--border)] bg-white/[0.06] text-[var(--muted-strong)]",
    success: "border-emerald-300/20 bg-emerald-300/10 text-[var(--success)]",
    warning: "border-amber-300/20 bg-amber-300/10 text-[var(--warning)]",
    danger: "border-rose-300/20 bg-rose-300/10 text-[var(--danger)]",
    info: "border-violet-300/25 bg-violet-300/12 text-[var(--brand-secondary)]",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.2em] ${styles}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: TicketStatus }) {
  const tone =
    status === "closed"
      ? "neutral"
      : status === "resolved"
        ? "success"
        : status === "waiting_for_client"
          ? "warning"
          : status === "new"
            ? "info"
            : "danger";
  return <Pill tone={tone}>{statusLabels[status]}</Pill>;
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
  const tone =
    priority === "critical"
      ? "danger"
      : priority === "high"
        ? "warning"
        : priority === "medium"
          ? "info"
          : "neutral";
  return <Pill tone={tone}>{priorityLabels[priority]}</Pill>;
}

export function AreaPill({ area }: { area: TicketArea }) {
  return <Pill tone="neutral">{areaLabels[area]}</Pill>;
}

export function RolePill({ role }: { role: UserRole }) {
  return <Pill tone="info">{roleLabels[role]}</Pill>;
}

export function EmptyState({
  title,
  detail,
  tone = "dark",
}: {
  title: string;
  detail: string;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`rounded-[28px] border border-dashed px-6 py-10 text-center ${
        tone === "light"
          ? "border-[rgba(91,72,199,0.18)] bg-[#faf9ff]"
          : "border-[var(--border-strong)] bg-white/[0.025]"
      }`}
    >
      <p
        className={`text-lg font-bold tracking-tight ${
          tone === "light" ? "text-[#1b1638]" : "text-white"
        }`}
      >
        {title}
      </p>
      <p
        className={`mx-auto mt-3 max-w-xl text-sm leading-6 ${
          tone === "light" ? "text-[#5a5d7f]" : "text-[var(--muted)]"
        }`}
      >
        {detail}
      </p>
    </div>
  );
}

export function NavButton({
  href,
  label,
  muted = false,
  tone = "dark",
}: {
  href: string;
  label: string;
  muted?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-4 py-2.5 text-sm font-medium transition ${
        tone === "light"
          ? muted
            ? "!border !border-[#c3b8ff] !bg-[#f3efff] !text-[#2f256f] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:!border-[#7c5bff] hover:!bg-white hover:!text-[#1b1638]"
            : "bg-[linear-gradient(135deg,#7c5bff,#5d46d6)] text-white shadow-[0_18px_40px_rgba(124,91,255,0.2)] hover:translate-y-[-1px] hover:shadow-[0_22px_45px_rgba(124,91,255,0.24)]"
          : muted
            ? "border border-[var(--border)] bg-white/[0.04] text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
            : "bg-[linear-gradient(135deg,#efeefe,#c4c6ff)] text-[#140f33] shadow-[0_18px_40px_rgba(124,91,255,0.28)] hover:translate-y-[-1px] hover:shadow-[0_22px_45px_rgba(124,91,255,0.34)]"
      }`}
    >
      {label}
    </Link>
  );
}

export function TimelineDate({
  value,
  tone = "dark",
}: {
  value: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={`font-[family-name:var(--font-montserrat)] text-[11px] uppercase tracking-[0.22em] ${
        tone === "light" ? "text-[#7b74a6]" : "text-[var(--muted)]"
      }`}
    >
      {formatRelativeDate(value)}
    </span>
  );
}
