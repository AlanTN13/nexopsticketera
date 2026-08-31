import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  History,
  LayoutDashboard,
  Lightbulb,
  RadioTower,
  Settings2,
} from "lucide-react";

import { LogoutClientForm } from "@/components/forms";
import type { RadarProductHealth } from "@/lib/radar-product";

export type RadarView = "overview" | "opportunities" | "published" | "history" | "strategy";

const NAVIGATION = [
  { view: "overview" as const, label: "Centro de control", href: "/portal/radar", icon: LayoutDashboard },
  { view: "opportunities" as const, label: "Oportunidades", href: "/portal/radar/oportunidades", icon: Lightbulb },
  { view: "published" as const, label: "Publicadas", href: "/portal/radar/publicadas", icon: BookOpenCheck },
  { view: "history" as const, label: "Historial", href: "/portal/radar/historial", icon: History },
  { view: "strategy" as const, label: "Estrategia", href: "/portal/radar/estrategia", icon: Settings2 },
];

function RadarMark() {
  return (
    <span className="relative grid size-11 place-items-center overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-400/10 shadow-[0_0_40px_rgba(139,92,246,0.2)]">
      <span className="absolute size-9 rounded-full border border-violet-300/25" />
      <span className="absolute size-6 rounded-full border border-violet-300/35" />
      <span className="absolute h-px w-9 rotate-45 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
      <RadioTower className="relative z-10 text-violet-200" size={17} aria-hidden="true" />
    </span>
  );
}

function HealthIndicator({ health }: { health: RadarProductHealth }) {
  const presentation = {
    healthy: { dot: "bg-emerald-400", text: "text-emerald-200", border: "border-emerald-400/20 bg-emerald-400/10" },
    limited: { dot: "bg-amber-300", text: "text-amber-100", border: "border-amber-300/20 bg-amber-300/10" },
    attention: { dot: "bg-rose-400", text: "text-rose-100", border: "border-rose-400/20 bg-rose-400/10" },
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
  children,
}: {
  active: RadarView;
  actorName: string;
  companyName: string;
  workspaceId: string;
  health: RadarProductHealth;
  exitHref: string;
  exitLabel: string;
  children: React.ReactNode;
}) {
  const initials = actorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="radar-product relative min-h-screen bg-[#06101d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.2),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.1),transparent_28%),linear-gradient(180deg,#07111f_0%,#081522_48%,#050c16_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1680px] xl:grid-cols-[286px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/8 bg-[#07111f]/80 px-5 py-6 backdrop-blur-xl xl:flex xl:flex-col">
          <div className="flex items-center gap-3 px-2">
            <RadarMark />
            <div>
              <p className="font-[family-name:var(--font-montserrat)] text-sm font-bold tracking-tight text-white">Radar</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">by NexOps</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace activo</p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{companyName}</p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{workspaceId}</p>
          </div>

          <nav aria-label="Navegación de Radar" className="mt-6 grid gap-1.5">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const selected = item.view === active;
              return (
                <Link
                  key={item.view}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition ${
                    selected
                      ? "border border-violet-300/20 bg-violet-400/12 text-white shadow-[inset_3px_0_0_#a78bfa]"
                      : "border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3 border-t border-white/8 pt-5">
            <HealthIndicator health={health} />
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-xs font-bold text-white">
                {initials || "NX"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{actorName}</p>
                <p className="truncate text-xs text-slate-500">{companyName}</p>
              </div>
            </div>
            <LogoutClientForm />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/85 backdrop-blur-xl">
            <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <span className="xl:hidden"><RadarMark /></span>
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-montserrat)] text-sm font-bold text-white xl:text-base">Radar by NexOps</p>
                  <p className="truncate text-xs text-slate-500">Inteligencia editorial autónoma · {companyName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex"><HealthIndicator health={health} /></span>
                <Link href={exitHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                  <ArrowLeft size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">{exitLabel}</span>
                  <span className="sm:hidden">Volver</span>
                </Link>
              </div>
            </div>
            <nav aria-label="Secciones de Radar" className="flex gap-1 overflow-x-auto px-4 pb-3 sm:px-6 xl:hidden">
              {NAVIGATION.map((item) => {
                const Icon = item.icon;
                const selected = item.view === active;
                return (
                  <Link key={item.view} href={item.href} aria-current={selected ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${selected ? "bg-violet-500/20 text-violet-100" : "text-slate-500"}`}>
                    <Icon size={14} aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
