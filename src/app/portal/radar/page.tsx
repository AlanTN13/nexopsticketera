import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { AppShell, EmptyState, SidebarUserCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalNavigation } from "@/lib/portal-modules";

export const dynamic = "force-dynamic";

export default async function PortalRadarPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");
  if (!company.modules.radar.enabled) redirect("/portal");

  const ticketCount = db.tickets.filter((ticket) => ticket.companyId === company.id).length;

  return (
    <AppShell
      eyebrow="Portal NexOps · Radar"
      title="Radar"
      description={`La estrategia de contenidos de ${company.name}, organizada en un solo lugar.`}
      tone="light"
      navigation={buildPortalNavigation({
        active: "radar",
        modules: company.modules,
        ticketCount,
      })}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
    >
      <EmptyState
        title="Estamos preparando tu Radar"
        detail="En breve vas a poder planificar contenidos, ordenar el calendario y seguir cada iniciativa junto al equipo de NexOps desde este mismo espacio."
        tone="light"
      />
    </AppShell>
  );
}
