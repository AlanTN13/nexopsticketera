import Link from "next/link";
import { Database, History, Instagram, PlugZap, UsersRound } from "lucide-react";

import { LogoutClientForm } from "@/components/forms";
import { AppShell, SidebarUserCard } from "@/components/ui";
import type { ContentPortalContext } from "@/lib/content-store";
import { buildPortalNavigation } from "@/lib/portal-modules";

export type ContentView = "sources" | "accounts" | "data" | "history";

const tabs = [
  { id: "sources", href: "/portal/contenido/fuentes", label: "Conexión", icon: PlugZap },
  { id: "accounts", href: "/portal/contenido/cuentas", label: "Cuentas", icon: UsersRound },
  { id: "data", href: "/portal/contenido/datos", label: "Datos", icon: Database },
  { id: "history", href: "/portal/contenido/historial", label: "Historial", icon: History },
] as const;

export function ContentShell({
  context,
  active,
  title,
  description,
  children,
}: {
  context: ContentPortalContext;
  active: ContentView;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      eyebrow={`NexOps Contenido · ${context.company.name}`}
      title={title}
      description={description}
      tone="light"
      navigation={buildPortalNavigation({ active: "content", modules: context.company.modules })}
      sidebarFooter={
        <SidebarUserCard name={context.actor.name} detail={context.company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
          <Instagram size={14} /> Fase 1 · Datos oficiales
        </span>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-[linear-gradient(135deg,#111827,#312e81)] p-2 shadow-sm">
        <nav className="flex min-w-max gap-1" aria-label="Navegación de Contenido">
          {tabs.map(({ id, href, label, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              aria-current={id === active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${
                id === active ? "bg-white text-indigo-950 shadow-sm" : "text-indigo-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={15} /> {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </AppShell>
  );
}

export function ContentStatus({ status }: { status: string }) {
  const display = {
    connected: ["Conectada", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    selection_required: ["Requiere selección", "border-amber-200 bg-amber-50 text-amber-800"],
    authorization_required: ["Requiere autorización", "border-slate-200 bg-slate-50 text-slate-700"],
    reconnect_required: ["Requiere reconexión", "border-rose-200 bg-rose-50 text-rose-700"],
    paused: ["Pausada", "border-slate-200 bg-slate-50 text-slate-700"],
    error: ["Con inconvenientes", "border-rose-200 bg-rose-50 text-rose-700"],
    completed: ["Completa", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    partial: ["Parcial", "border-amber-200 bg-amber-50 text-amber-800"],
    failed: ["Fallida", "border-rose-200 bg-rose-50 text-rose-700"],
    running: ["En curso", "border-sky-200 bg-sky-50 text-sky-700"],
    available: ["Disponible", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    pending: ["Pendiente", "border-slate-200 bg-slate-50 text-slate-700"],
    unsupported: ["No compatible", "border-amber-200 bg-amber-50 text-amber-800"],
    not_found: ["No encontrada", "border-rose-200 bg-rose-50 text-rose-700"],
  }[status] ?? [status, "border-slate-200 bg-slate-50 text-slate-700"];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${display[1]}`}>{display[0]}</span>;
}
