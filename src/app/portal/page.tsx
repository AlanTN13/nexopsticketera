import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { PortalHomeCard } from "@/components/portal-home-card";
import { AppShell, IndicatorBar, NavButton, SidebarUserCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";
import { buildPortalStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

type PortalHomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalHome({ searchParams }: PortalHomeProps) {
  const filters = await searchParams;
  const legacyFilters = ["query", "status", "area", "priority"].filter((key) => filters[key]);
  if (legacyFilters.length > 0) {
    const params = new URLSearchParams();
    for (const key of legacyFilters) {
      const value = filters[key];
      if (typeof value === "string") params.set(key, value);
    }
    redirect(`/portal/soporte?${params.toString()}`);
  }

  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");

  const tickets = db.tickets.filter((ticket) => ticket.companyId === company.id);
  const stats = buildPortalStats(tickets);
  const metricsProfile = getMetricsProfile(company);
  const resolved = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length;

  return (
    <AppShell
      eyebrow="Portal NexOps"
      title={`Hola, ${actor.name.split(" ")[0]}`}
      description={`Todo lo que NexOps gestiona con ${company.name}, desde un único lugar.`}
      tone="light"
      navigation={buildPortalNavigation({
        active: "home",
        metricsEnabled: Boolean(metricsProfile),
        ticketCount: tickets.length,
      })}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
      actions={<NavButton href="/portal/users" label="Gestionar accesos" muted tone="light" />}
    >
      <IndicatorBar
        items={[
          { label: "Tickets abiertos", value: stats.open },
          { label: "En progreso", value: tickets.filter((ticket) => ticket.status === "in_progress").length },
          { label: "Esperando respuesta", value: tickets.filter((ticket) => ticket.status === "waiting_for_client").length },
          { label: "Resueltos", value: resolved },
        ]}
      />

      <div className={`grid gap-4 ${metricsProfile ? "lg:grid-cols-2" : "max-w-3xl"}`}>
        <PortalHomeCard
          href="/portal/soporte"
          eyebrow="Soporte"
          title="Solicitudes y seguimiento"
          description="Creá tickets, conversá con el equipo y seguí el estado de cada necesidad sin depender de mensajes dispersos."
          meta={`${tickets.length} ticket${tickets.length === 1 ? "" : "s"} en tu empresa`}
        >
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{stats.open} abiertos</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{resolved} resueltos</span>
          </div>
        </PortalHomeCard>

        {metricsProfile ? (
          <PortalHomeCard
            href="/portal/metricas"
            eyebrow="Métricas"
            title="Resultados de marketing"
            description="Consultá KPIs, campañas y evolución del trabajo de marketing con la reportería preparada para tu empresa."
            meta="Fuente: reportería NexOps"
          >
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-800">Meta Ads</span>
              {metricsProfile.mailchimpName ? (
                <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-800">Emailing</span>
              ) : null}
            </div>
          </PortalHomeCard>
        ) : null}
      </div>
    </AppShell>
  );
}
