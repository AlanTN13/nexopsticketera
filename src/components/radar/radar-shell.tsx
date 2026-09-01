import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  History,
  ListChecks,
  LayoutDashboard,
  Lightbulb,
  RadioTower,
  Settings2,
} from "lucide-react";

import { LogoutClientForm } from "@/components/forms";
import type { RadarProductHealth } from "@/lib/radar-product";

export type RadarView = "overview" | "operation" | "opportunities" | "published" | "history" | "strategy";

const NAVIGATION = [
  { view: "overview" as const, label: "Centro de control", href: "/portal/radar", icon: LayoutDashboard },
  { view: "operation" as const, label: "Operación", href: "/portal/radar/operacion", icon: ListChecks },
  { view: "opportunities" as const, label: "Oportunidades", href: "/portal/radar/oportunidades", icon: Lightbulb },
  { view: "published" as const, label: "Publicadas", href: "/portal/radar/publicadas", icon: BookOpenCheck },
  { view: "history" as const, label: "Historial", href: "/portal/radar/historial", icon: History },
  { view: "strategy" as const, label: "Estrategia", href: "/portal/radar/estrategia", icon: Settings2 },
];

function withRadarCompany(href: string, companyLookup?: string) {
  if (!companyLookup) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}company=${encodeURIComponent(companyLookup)}`;
}

function RadarMark() {
  return (
    <span className="grid size-10 place-items-center rounded-xl bg-[#4f35b5] text-white shadow-sm">
      <RadioTower size={17} aria-hidden="true" />
    </span>
  );
}

function HealthIndicator({ health }: { health: RadarProductHealth }) {
  const presentation = {
    healthy: { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200 bg-emerald-50" },
    limited: { dot: "bg-sky-500", text: "text-slate-600", border: "border-slate-200 bg-white" },
    attention: { dot: "bg-rose-500", text: "text-rose-700", border: "border-rose-200 bg-rose-50" },
  }[health.state];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${presentation.border} ${presentation.text}`}>
      <span className={`size-1.5 rounded-full ${presentation.dot}`} />
      {health.label}
    </span>
  );
}

export function RadarShell({
  active,
  actorName,
  companyName,
  workspaceId,
  health,
  exitHref,
  exitLabel,
  companyLookup,
  basePath = "/portal/radar",
  strategyAvailable = true,
  children,
}: {
  active: RadarView;
  actorName: string;
  companyName: string;
  workspaceId: string;
  health: RadarProductHealth;
  exitHref: string;
  exitLabel: string;
  companyLookup?: string;
  basePath?: string;
  strategyAvailable?: boolean;
  children: React.ReactNode;
}) {
  const initials = actorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="radar-product min-h-screen bg-white text-slate-900">
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] xl:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-slate-50 px-5 py-6 xl:flex xl:flex-col">
          <div className="flex items-center gap-3 px-2">
            <RadarMark />
            <div>
              <p className="font-[family-name:var(--font-montserrat)] text-sm font-bold tracking-tight text-slate-950">Radar</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6749c7]">by NexOps</p>
            </div>
          </div>

          <div className="mt-8 border-y border-slate-200 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cuenta</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-900">{companyName}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{workspaceId}</p>
          </div>

          <nav aria-label="Navegación de Radar" className="mt-6 grid gap-1.5">
            {NAVIGATION.filter((item) => strategyAvailable || item.view !== "strategy").map((item) => {
              const Icon = item.icon;
              const selected = item.view === active;
              return (
                <Link
                  key={item.view}
                  href={withRadarCompany(item.href.replace("/portal/radar", basePath), companyLookup)}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition ${
                    selected
                      ? "bg-[#eeeafe] font-semibold text-[#43299c]"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3 border-t border-slate-200 pt-5">
            <HealthIndicator health={health} />
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4f35b5] text-xs font-bold text-white">
                {initials || "NX"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{actorName}</p>
                <p className="truncate text-xs text-slate-500">{companyName}</p>
              </div>
            </div>
            <LogoutClientForm tone="light" />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <span className="xl:hidden"><RadarMark /></span>
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-montserrat)] text-sm font-bold text-slate-950 xl:text-base">Radar by NexOps</p>
                  <p className="truncate text-xs text-slate-500">{companyName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex"><HealthIndicator health={health} /></span>
                <Link href={exitHref} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950">
                  <ArrowLeft size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">{exitLabel}</span>
                  <span className="sm:hidden">Volver</span>
                </Link>
              </div>
            </div>
            <nav aria-label="Secciones de Radar" className="flex gap-1 overflow-x-auto px-4 pb-3 sm:px-6 xl:hidden">
              {NAVIGATION.filter((item) => strategyAvailable || item.view !== "strategy").map((item) => {
                const Icon = item.icon;
                const selected = item.view === active;
                return (
                  <Link key={item.view} href={withRadarCompany(item.href.replace("/portal/radar", basePath), companyLookup)} aria-current={selected ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${selected ? "bg-[#eeeafe] text-[#43299c]" : "text-slate-500"}`}>
                    <Icon size={14} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
