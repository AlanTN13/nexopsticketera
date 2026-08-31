import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { MetricsWorkspace } from "@/components/metrics/metrics-workspace";
import { AppShell, EmptyState, InlineNotice, SidebarUserCard } from "@/components/ui";
import { Client } from "@/features/metrics/types";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { loadMetricsData } from "@/lib/metrics-data";
import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";

export const dynamic = "force-dynamic";

export default async function PortalMetricsPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");

  const profile = getMetricsProfile(company);
  if (!profile) redirect("/portal");

  const data = await loadMetricsData(profile);
  const companyTickets = db.tickets.filter((ticket) => ticket.companyId === company.id);
  const client: Client = {
    id: company.id,
    name: company.name,
    accountName: profile.accountName,
    logoUrl: profile.logoUrl ?? "",
    primaryColor: profile.primaryColor ?? "#4330A6",
    secondaryColor: profile.secondaryColor ?? "#7C5BFF",
    textColor: profile.textColor ?? "#FFFFFF",
    mailchimpName: profile.mailchimpName,
    objective: profile.objective ?? "CONVERSACIONES",
    description: company.industry,
    createdAt: company.createdAt,
    updatedAt: data.loadedAt,
  };
  const hasData = data.metaRows.length > 0 || data.mailchimpRows.length > 0;

  return (
    <AppShell
      eyebrow="Portal NexOps · Métricas"
      title="Métricas"
      description={`Toda la reportería de ${company.name}, clara y accesible en un solo lugar.`}
      tone="light"
      navigation={buildPortalNavigation({
        active: "metrics",
        metricsEnabled: true,
        ticketCount: companyTickets.length,
      })}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
    >
      {hasData && data.warnings.length > 0 ? (
        <InlineNotice tone="info">
          Algunos indicadores se están actualizando. Volvé a consultar en unos minutos.
        </InlineNotice>
      ) : null}

      {hasData ? (
        <MetricsWorkspace client={client} metaRows={data.metaRows} mailchimpRows={data.mailchimpRows} />
      ) : (
        <EmptyState
          title="Muy pronto, todas tus métricas en un solo lugar"
          detail="Estamos terminando de preparar tu reportería personalizada. En breve vas a poder seguir el rendimiento de tus campañas y consultar tus principales resultados desde Portal NexOps."
          tone="light"
        />
      )}

      {data.latestDataDate ? (
        <p className="text-right text-xs font-medium text-slate-500">Último dato disponible: {data.latestDataDate}</p>
      ) : null}
    </AppShell>
  );
}
