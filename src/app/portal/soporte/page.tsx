import { redirect } from "next/navigation";

import { CreateTicketForm, LogoutClientForm } from "@/components/forms";
import { PortalTicketModal } from "@/components/portal-ticket-modal";
import { TicketFilters } from "@/components/ticket-filters";
import { TicketTable } from "@/components/tables";
import { AppShell, EmptyState, IndicatorBar, InlineNotice, NavButton, SectionCard, SidebarUserCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";
import { buildPortalStats, filterTickets, sortTickets } from "@/lib/queries";

export const dynamic = "force-dynamic";

type PortalPageProps = { searchParams: Promise<{ query?: string; status?: string; area?: string; priority?: string; error?: string; success?: string }> };

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const filters = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");

  const companyTickets = actor.companyId ? db.tickets.filter((ticket) => ticket.companyId === actor.companyId) : [];
  const tickets = sortTickets(filterTickets(companyTickets, filters));
  const stats = buildPortalStats(companyTickets);
  const hasFilters = Boolean(filters.query || (filters.status && filters.status !== "all") || (filters.area && filters.area !== "all") || (filters.priority && filters.priority !== "all"));

  return (
    <AppShell eyebrow="Portal NexOps · Soporte" title="Soporte" description="Seguí las solicitudes de tu empresa y encontrá rápido qué requiere atención." tone="light"
      navigation={buildPortalNavigation({ active: "support", metricsEnabled: Boolean(getMetricsProfile(company)), ticketCount: stats.total })}
      sidebarFooter={<SidebarUserCard name={actor.name} detail={company.name}><LogoutClientForm tone="light" /></SidebarUserCard>}
      actions={<><div className="hidden md:block"><PortalTicketModal title="Nuevo ticket" description="Contanos qué pasa y cómo afecta tu trabajo."><CreateTicketForm actor={actor} tone="light" compact /></PortalTicketModal></div><div className="md:hidden"><NavButton href="/portal/tickets/new" label="Nuevo ticket" tone="light" /></div></>}
    >
      {filters.success ? <InlineNotice tone="success">{filters.success}</InlineNotice> : null}
      {filters.error ? <InlineNotice tone="error">{filters.error}</InlineNotice> : null}
      <IndicatorBar items={[{ label: "Abiertos", value: stats.open }, { label: "En progreso", value: companyTickets.filter((ticket) => ticket.status === "in_progress").length }, { label: "Nivel crítico", value: stats.critical }, { label: "Resueltos", value: companyTickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length }]} />
      <SectionCard title="Listado de tickets" description="Estado, responsable, última actualización y próximo paso en una sola vista." tone="light">
        <TicketFilters basePath="/portal/soporte" query={filters.query} filters={[
          { name: "status", label: "Todos los estados", value: filters.status, options: [{ value: "new", label: "Nuevo" }, { value: "analysis", label: "En análisis" }, { value: "in_progress", label: "En progreso" }, { value: "waiting_for_client", label: "Esperando al cliente" }, { value: "resolved", label: "Resuelto" }, { value: "closed", label: "Cerrado" }] },
          { name: "priority", label: "Todos los niveles", value: filters.priority, options: [{ value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "critical", label: "Crítica" }] },
          { name: "area", label: "Todas las áreas", value: filters.area, options: [{ value: "automation", label: "Automatizaciones" }, { value: "custom_system", label: "Sistema personalizado" }, { value: "website", label: "Sitios web" }, { value: "ai_agent", label: "Agentes IA" }, { value: "crm", label: "CRM" }, { value: "erp", label: "ERP" }] },
        ]} />
        {tickets.length > 0 ? <TicketTable db={db} tickets={tickets} basePath="/portal" tone="light" showCompany={false} actionLabel="Abrir" clientView /> : <EmptyState title={companyTickets.length === 0 ? "Todavía no hay tickets" : "No hay resultados"} detail={hasFilters ? "Probá quitar algún filtro o buscar con otras palabras." : "Creá el primer ticket para comenzar el seguimiento."} tone="light" />}
      </SectionCard>
    </AppShell>
  );
}
