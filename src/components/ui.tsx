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
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 py-3 sm:px-4 lg:px-5 lg:py-4">
      {navigation ? (
        <details className="group mb-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-semibold text-slate-900 marker:hidden">
            <Brand compact />
            <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 group-open:bg-slate-50">
              Menú
            </span>
          </summary>
          <div className="border-t border-slate-100 px-1 pb-1 pt-2">
            <NavigationLinks navigation={navigation} light={light} mobile />
            {sidebarFooter ? <div className="mt-2">{sidebarFooter}</div> : null}
          </div>
        </details>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        {navigation ? (
          <aside
            className={`hidden rounded-xl p-3 lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col ${
              light
                ? "border border-slate-200 bg-white shadow-sm"
                : "border border-[var(--border)] bg-[var(--panel)]"
            }`}
          >
            <div className="px-2 py-2"><Brand /></div>
            <NavigationLinks navigation={navigation} light={light} />

            {sidebarFooter ? <div className="mt-4 lg:mt-auto">{sidebarFooter}</div> : null}
          </aside>
        ) : null}

        <div className="min-w-0">
          <div
            className={`rounded-xl p-4 sm:px-5 sm:py-4 ${
              light
                ? "border border-slate-200 bg-white shadow-sm"
                : "border border-[var(--border)] bg-[var(--panel)]"
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    light ? "text-[#6d5bd0]" : "text-[var(--brand-secondary)]"
                  }`}
                >
                  {eyebrow}
                </p>
                <div className="mt-1">
                  <h1
                    className={`text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl ${
                      light ? "text-[#111827]" : "text-white"
                    }`}
                  >
                    {title}
                  </h1>
                  <p
                    className={`mt-1 max-w-3xl text-sm leading-5 ${
                      light ? "text-[#596273]" : "text-[var(--muted)]"
                    }`}
                  >
                    {description}
                  </p>
                </div>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </div>

          <div className="mt-3 grid gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logo-nexops.png"
        alt="Logo NexOps"
        width={56}
        height={56}
        priority
        className={`${compact ? "h-8 w-8" : "h-9 w-9"} object-contain`}
      />
      <div>
        <p className="text-sm font-bold tracking-tight text-slate-950">NexOps</p>
        <p className="text-[11px] font-medium text-[#5b48c7]">Portal clientes</p>
      </div>
    </div>
  );
}

function NavigationLinks({
  navigation,
  light,
  mobile = false,
}: {
  navigation: NavigationItem[];
  light: boolean;
  mobile?: boolean;
}) {
  return (
    <nav className={`${mobile ? "mt-0" : "mt-4"} grid gap-1`} aria-label="Navegación principal">
      {navigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
            item.active
              ? "bg-[#4330a6] font-semibold !text-white hover:bg-[#37258f] hover:!text-white [&_svg]:text-white"
              : light
                ? "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                : "font-medium text-[var(--muted)] hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <span className="flex items-center gap-2">
            {item.active ? <span aria-hidden className="h-4 w-1 rounded-full bg-white" /> : null}
            {item.label}
          </span>
          {item.badge !== undefined ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.active ? "bg-white text-[#312e81]" : "bg-violet-50 text-violet-800"}`}>
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          {name
            .split(" ")
            .map((part) => part[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#111827]">{name}</p>
          <p className="truncate text-xs text-[#596273]">{detail}</p>
        </div>
      </div>
      {children ? <div className="mt-3 border-t border-slate-200 pt-3">{children}</div> : null}
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
      className={`rounded-xl px-3 py-3 ${
        tone === "light"
          ? "border border-slate-200 bg-white"
          : "border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))]"
      }`}
    >
      <p
        className={`text-xs font-medium ${
          tone === "light" ? "text-[#6b7280]" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p
          className={`text-2xl font-bold tracking-[-0.04em] ${
            tone === "light" ? "text-[#111827]" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
      <p className={`mt-1 text-xs leading-5 ${tone === "light" ? "text-[#596273]" : "text-[var(--muted)]"}`}>
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
      className={`rounded-xl p-4 ${
        tone === "light"
          ? "border border-slate-200 bg-white shadow-sm"
          : "border border-[var(--border)] bg-[var(--panel-strong)]"
      }`}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            className={`text-lg font-bold tracking-[-0.02em] ${
              tone === "light" ? "text-[#111827]" : "text-white"
            }`}
          >
            {title}
          </h2>
          {description ? (
            <p className={`max-w-3xl text-sm leading-5 ${tone === "light" ? "text-[#596273]" : "text-[var(--muted)]"}`}>
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}
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
      className={`rounded-xl border border-dashed px-5 py-6 text-center ${
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
          tone === "light" ? "text-[#596273]" : "text-[var(--muted)]"
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
      className={`inline-flex min-h-10 items-center rounded-lg px-3.5 py-2 text-sm font-medium transition ${
        tone === "light"
          ? muted
            ? "border border-[rgba(17,24,39,0.1)] bg-white text-[#374151] hover:border-[#6d5bd0] hover:text-[#111827]"
            : "bg-[#5b48c7] text-white hover:bg-[#4936ad]"
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
      className={`text-xs ${
        tone === "light" ? "text-[#596273]" : "text-[var(--muted)]"
      }`}
    >
      {formatRelativeDate(value)}
    </span>
  );
}

export function IndicatorBar({
  items,
}: {
  items: Array<{ label: string; value: string | number; detail?: string }>;
}) {
  return (
    <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600">{item.label}</p>
            {item.detail ? <p className="truncate text-xs text-slate-500">{item.detail}</p> : null}
          </div>
          <p className="text-xl font-bold tracking-tight text-slate-950">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

export function InlineNotice({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }[tone];

  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse px-3 py-3 sm:px-4 lg:px-5 lg:py-4" aria-label="Cargando contenido">
      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="hidden min-h-[520px] rounded-xl bg-slate-200 lg:block" />
        <div className="grid gap-3">
          <div className="h-28 rounded-xl bg-slate-200" />
          <div className="h-16 rounded-xl bg-slate-200" />
          <div className="h-80 rounded-xl bg-slate-200" />
        </div>
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
