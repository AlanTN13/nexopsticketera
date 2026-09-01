import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { MetricsWorkspace } from "@/components/metrics/metrics-workspace";
import { MetricsStrategyTimeline } from "@/components/metrics/metrics-strategy-timeline";
import { MetricsSyncControl } from "@/components/metrics/metrics-sync-control";
import { AppShell, InlineNotice, SidebarUserCard } from "@/components/ui";
import { Client } from "@/features/metrics/types";
import { refreshMetricsAction } from "@/app/portal/metricas/actions";
import { getAuthenticatedActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { loadMetricsData } from "@/lib/metrics-data";
import { buildPortalNavigation, getMetricsProfile, resolveMetricsCompanyForActor } from "@/lib/portal-modules";
import { getVisibleCompanyModules } from "@/lib/portal-modules";
import { hasModuleAccess } from "@/lib/authorization";
import { isClientRole } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

export default async function PortalMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; partial?: string; wait?: string; company?: string }>;
}) {
  const { updated, partial, wait, company: companyLookup } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = resolveMetricsCompanyForActor(db.companies, actor, companyLookup);
  if (!company) redirect(isClientRole(actor.role) ? "/portal" : "/backoffice/queue");

  const profile = getMetricsProfile(company);
  if (!profile || !hasModuleAccess(actor, company, "metrics", "view")) redirect(isClientRole(actor.role) ? "/portal" : "/backoffice/queue");

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

  return (
    <AppShell
      eyebrow="Portal NexOps · Métricas"
      title="Métricas"
      description={`Toda la reportería de ${company.name}, clara y accesible en un solo lugar.`}
      tone="light"
      navigation={isClientRole(actor.role) ? buildPortalNavigation({
          active: "metrics",
          modules: getVisibleCompanyModules(actor, company),
          ticketCount: companyTickets.length,
        }) : [
          { href: "/backoffice/queue", label: "Tickets" },
          { href: "/backoffice/companies", label: "Empresas" },
          { href: "/backoffice/users", label: "Usuarios" },
          { href: `/portal/metricas?company=${company.slug}`, label: "Métricas", active: true },
        ]}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
    >
      {hasModuleAccess(actor, company, "metrics", "operate") ? (
        <MetricsSyncControl sync={data.sync} action={refreshMetricsAction.bind(null, company.id)} />
      ) : (
        <InlineNotice tone="info">Tu nivel permite consultar Métricas, pero no actualizar sus fuentes.</InlineNotice>
      )}

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

      {!hasPerformanceData ? (
        <InlineNotice tone="info">
          El dashboard ya está habilitado. Los indicadores se completan cuando quede vinculada la exportación de Meta Ads.
        </InlineNotice>
      ) : null}

      <MetricsWorkspace
        client={client}
        metaRows={data.metaRows}
        mailchimpRows={data.mailchimpRows}
        kommoEmbedUrl={profile.kommoEmbedUrl}
      />

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
