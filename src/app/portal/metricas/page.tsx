import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { MetricsWorkspace } from "@/components/metrics/metrics-workspace";
import { MetricsStrategyTimeline } from "@/components/metrics/metrics-strategy-timeline";
import { MetricsSyncControl } from "@/components/metrics/metrics-sync-control";
import { AppShell, EmptyState, InlineNotice, SidebarUserCard } from "@/components/ui";
import { Client } from "@/features/metrics/types";
import { refreshMetricsAction } from "@/app/portal/metricas/actions";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { loadMetricsData } from "@/lib/metrics-data";
import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";

export const dynamic = "force-dynamic";

export default async function PortalMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; partial?: string; wait?: string }>;
}) {
  const { updated, partial, wait } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");

  const profile = getMetricsProfile(company);
  if (!profile) redirect("/portal");

  const data = await loadMetricsData(company.id, profile);
  const source = data.clientSource;
  const companyTickets = db.tickets.filter((ticket) => ticket.companyId === company.id);
  const client: Client = {
    id: company.id,
    name: source?.name ?? company.name,
    accountName: source?.accountName ?? profile.accountName,
    logoUrl: source?.logoUrl || profile.logoUrl || "",
    primaryColor: source?.primaryColor ?? profile.primaryColor ?? "#4330A6",
    secondaryColor: source?.secondaryColor ?? profile.secondaryColor ?? "#7C5BFF",
    textColor: source?.textColor ?? profile.textColor ?? "#FFFFFF",
    mailchimpName: source?.mailchimpName ?? profile.mailchimpName,
    objective: source?.objective ?? profile.objective ?? "CONVERSACIONES",
    description: source?.description ?? company.industry,
    targetCpa: source?.targetCpa,
    monthlyBudget: source?.monthlyBudget,
    createdAt: company.createdAt,
    updatedAt: data.loadedAt ?? company.createdAt,
  };
  const hasPerformanceData = data.metaRows.length > 0 || data.mailchimpRows.length > 0;
  const hasStrategyData = Boolean(source?.initialStrategy || data.strategyEntries.length);

  return (
    <AppShell
      eyebrow="Portal NexOps · Métricas"
      title="Métricas"
      description={`Toda la reportería de ${company.name}, clara y accesible en un solo lugar.`}
      tone="light"
      navigation={buildPortalNavigation({
        active: "metrics",
        modules: company.modules,
        ticketCount: companyTickets.length,
      })}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
    >
      <MetricsSyncControl sync={data.sync} action={refreshMetricsAction} />

      {updated === "1" ? (
        <InlineNotice tone={partial === "1" ? "info" : "success"}>
          {partial === "1"
            ? "Actualizamos las fuentes disponibles y conservamos el último dato válido de las que no respondieron."
            : "Los datos se actualizaron correctamente."}
        </InlineNotice>
      ) : null}

      {wait ? (
        <InlineNotice tone="info">
          La última consulta fue hace menos de un minuto. Podés volver a actualizar en {Math.max(1, Number.parseInt(wait, 10) || 1)} segundos.
        </InlineNotice>
      ) : null}

      {hasPerformanceData && data.warnings.length > 0 ? (
        <InlineNotice tone="info">
          Algunos indicadores se están actualizando. Volvé a consultar en unos minutos.
        </InlineNotice>
      ) : null}

      {hasPerformanceData ? (
        <MetricsWorkspace client={client} metaRows={data.metaRows} mailchimpRows={data.mailchimpRows} />
      ) : hasStrategyData ? (
        <InlineNotice tone="info">
          Clientes y bitácora ya están conectados. Para habilitar los indicadores de rendimiento falta vincular la exportación de Meta Ads.
        </InlineNotice>
      ) : (
        <EmptyState
          title="Muy pronto, todas tus métricas en un solo lugar"
          detail="Estamos terminando de preparar tu reportería personalizada. En breve vas a poder seguir el rendimiento de tus campañas y consultar tus principales resultados desde Portal NexOps."
          tone="light"
        />
      )}

      <MetricsStrategyTimeline
        companyName={client.name}
        initialStrategy={source?.initialStrategy}
        entries={data.strategyEntries}
      />

      {data.latestDataDate ? (
        <p className="text-right text-xs font-medium text-slate-500">Último dato disponible: {data.latestDataDate}</p>
      ) : null}
    </AppShell>
  );
}
