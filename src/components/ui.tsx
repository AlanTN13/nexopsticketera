import Image from "next/image";
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

type NavigationItem = {
  href: string;
  label: string;
  active?: boolean;
  badge?: string | number;
};

export function AppShell({
  title,
  eyebrow,
  description,
  actions,
  children,
  tone = "dark",
  navigation,
  sidebarFooter,
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "dark" | "light";
  navigation?: NavigationItem[];
  sidebarFooter?: ReactNode;
}) {
  const light = tone === "light";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        {navigation ? (
          <aside
            className={`rounded-[32px] p-4 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col ${
              light
                ? "border border-[rgba(67,48,166,0.12)] bg-white/82 shadow-[0_18px_60px_rgba(17,14,44,0.08)] backdrop-blur"
                : "border border-[var(--border)] bg-[var(--panel)]"
            }`}
          >
            <div className="rounded-[22px] px-3 py-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo-nexops.png"
                  alt="Logo NexOps"
                  width={84}
                  height={84}
                  priority
                  className="h-12 w-12 object-contain"
                />
                <div>
                  <p className={`text-sm font-bold tracking-tight ${light ? "text-[#111827]" : "text-white"}`}>
                    NexOps
                  </p>
                  <p
                    className={`font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.24em] ${
                      light ? "text-[#6d5bd0]" : "text-[var(--brand-secondary)]"
                    }`}
                  >
                    Help Center
                  </p>
                </div>
              </div>
            </div>

            <nav className="mt-6 grid gap-1.5">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-[18px] px-3 py-2.5 text-sm font-medium transition ${
                    item.active
                      ? light
                        ? "bg-[linear-gradient(135deg,#312e81,#6d5bd0)] text-white shadow-[0_12px_24px_rgba(79,70,229,0.24)]"
                        : "bg-white/[0.09] text-white"
                      : light
                        ? "text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#111827]"
                        : "text-[var(--muted)] hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className={`flex items-center gap-2 ${item.active ? "!text-white" : ""}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${item.active ? "bg-white" : light ? "bg-[#c7d2fe]" : "bg-white/30"}`} />
                    <span className={item.active ? "!text-white" : ""}>{item.label}</span>
                  </span>
                  {item.badge !== undefined ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.active
                          ? "bg-white/14 text-white"
                          : light
                            ? "bg-[#eef2ff] text-[#4330a6]"
                            : "bg-white/[0.08] text-[var(--brand-secondary)]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            {sidebarFooter ? <div className="mt-6 lg:mt-auto">{sidebarFooter}</div> : null}
          </aside>
        ) : null}

        <div className="min-w-0">
          <div
            className={`rounded-[32px] p-5 sm:p-6 ${
              light
                ? "border border-[rgba(67,48,166,0.12)] bg-white/82 shadow-[0_18px_60px_rgba(17,14,44,0.08)] backdrop-blur"
                : "border border-[var(--border)] bg-[var(--panel)]"
            }`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <p
                  className={`font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.26em] ${
                    light ? "text-[#6d5bd0]" : "text-[var(--brand-secondary)]"
                  }`}
                >
                  {eyebrow}
                </p>
                <div className="space-y-2">
                  <h1
                    className={`text-3xl font-black tracking-[-0.04em] sm:text-4xl ${
                      light ? "text-[#111827]" : "text-white"
                    }`}
                  >
                    {title}
                  </h1>
                  <p
                    className={`max-w-3xl text-sm leading-6 sm:text-[15px] ${
                      light ? "text-[#6b7280]" : "text-[var(--muted)]"
                    }`}
                  >
                    {description}
                  </p>
                </div>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SidebarUserCard({
  name,
  detail,
  children,
}: {
  name: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(17,24,39,0.08)] bg-[#fbfbfd] p-4 shadow-[0_10px_24px_rgba(17,24,39,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#111827,#4330a6)] text-sm font-bold text-white">
          {name
            .split(" ")
            .map((part) => part[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#111827]">{name}</p>
          <p className="truncate text-xs text-[#6b7280]">{detail}</p>
        </div>
      </div>
      {children ? <div className="mt-4 border-t border-[rgba(17,24,39,0.06)] pt-4">{children}</div> : null}
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
      className={`rounded-[24px] px-4 py-4 ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.05)]"
          : "border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))]"
      }`}
    >
      <p
        className={`font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.22em] ${
          tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={`text-3xl font-black tracking-[-0.05em] ${
            tone === "light" ? "text-[#111827]" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
      <p className={`mt-2 text-sm leading-6 ${tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"}`}>
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
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "dark" | "light";
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-[26px] p-5 sm:p-6 ${
        tone === "light"
          ? "border border-[rgba(17,24,39,0.08)] bg-white shadow-[0_14px_40px_rgba(17,24,39,0.06)]"
          : "border border-[var(--border)] bg-[var(--panel-strong)]"
      }`}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2
            className={`text-xl font-bold tracking-[-0.03em] ${
              tone === "light" ? "text-[#111827]" : "text-white"
            }`}
          >
            {title}
          </h2>
          {description ? (
            <p className={`max-w-3xl text-sm leading-6 ${tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"}`}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
    neutral: "border-[#e5e7eb] bg-[#f9fafb] text-[#4b5563]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.16em] ${styles}`}
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
      className={`rounded-[22px] border border-dashed px-6 py-10 text-center ${
        tone === "light"
          ? "border-[rgba(17,24,39,0.14)] bg-[#fafafa]"
          : "border-[var(--border-strong)] bg-white/[0.025]"
      }`}
    >
      <p
        className={`text-lg font-bold tracking-tight ${
          tone === "light" ? "text-[#111827]" : "text-white"
        }`}
      >
        {title}
      </p>
      <p
        className={`mx-auto mt-3 max-w-xl text-sm leading-6 ${
          tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"
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
            ? "border border-[rgba(17,24,39,0.1)] bg-white text-[#374151] hover:border-[#6d5bd0] hover:text-[#111827]"
            : "bg-[linear-gradient(135deg,#5b4ee6,#7c5bff)] text-white shadow-[0_12px_24px_rgba(124,91,255,0.24)] hover:translate-y-[-1px]"
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
      className={`font-[family-name:var(--font-montserrat)] text-[10px] uppercase tracking-[0.18em] ${
        tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"
      }`}
    >
      {formatRelativeDate(value)}
    </span>
  );
}
