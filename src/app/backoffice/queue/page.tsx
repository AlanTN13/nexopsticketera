import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { TicketFilters } from "@/components/ticket-filters";
import { TicketTable } from "@/components/tables";
import { AppShell, EmptyState, IndicatorBar, NavButton, SectionCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { buildBackofficeStats, filterTickets, getInternalUsers, sortTickets } from "@/lib/queries";
import { withActor } from "@/lib/routing";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ query?: string; status?: string; area?: string; priority?: string; companyId?: string; assignedToId?: string }> };

export default async function BackofficeQueuePage({ searchParams }: Props) {
  const filters = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  const tickets = sortTickets(filterTickets(db.tickets, filters));
  const stats = buildBackofficeStats(db.tickets, db.companies);
  const internalUsers = getInternalUsers(db);

  return <AppShell eyebrow="Backoffice · Tickets" title="Cola operativa" description="Priorizá y gestioná la atención de todas las empresas desde una vista compacta." tone="light"
    navigation={[{ href: withActor("/backoffice/queue", actor.id), label: "Tickets", active: true, badge: stats.activeTickets }, { href: withActor("/backoffice/companies", actor.id), label: "Empresas", badge: db.companies.length }, { href: withActor("/backoffice/users", actor.id), label: "Usuarios" }]}
    actions={<><NavButton href={withActor("/backoffice/companies", actor.id)} label="Ver empresas" muted tone="light" /><LogoutClientForm tone="light" /></>}
  >
    <IndicatorBar items={[{ label: "Activos", value: stats.activeTickets }, { label: "Alta o crítica", value: stats.highPriority }, { label: "Esperando cliente", value: stats.waitingCustomer }, { label: "Empresas", value: stats.companies }]} />
    <SectionCard title="Tickets" description="Buscá, filtrá y abrí cualquier fila para gestionar el caso." tone="light">
      <TicketFilters basePath="/backoffice/queue" query={filters.query} filters={[
        { name: "status", label: "Todos los estados", value: filters.status, options: [{ value: "new", label: "Nuevo" }, { value: "analysis", label: "En análisis" }, { value: "in_progress", label: "En progreso" }, { value: "waiting_for_client", label: "Esperando al cliente" }, { value: "resolved", label: "Resuelto" }, { value: "closed", label: "Cerrado" }] },
        { name: "area", label: "Todas las áreas", value: filters.area, options: [{ value: "automation", label: "Automatizaciones" }, { value: "custom_system", label: "Sistema personalizado" }, { value: "website", label: "Sitios web" }, { value: "ai_agent", label: "Agentes IA" }, { value: "crm", label: "CRM" }, { value: "erp", label: "ERP" }] },
        { name: "priority", label: "Todas las prioridades", value: filters.priority, options: [{ value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "critical", label: "Crítica" }] },
        { name: "companyId", label: "Todas las empresas", value: filters.companyId, options: db.companies.map((company) => ({ value: company.id, label: company.name })) },
        { name: "assignedToId", label: "Todos los responsables", value: filters.assignedToId, options: [{ value: "unassigned", label: "Sin asignar" }, ...internalUsers.map((user) => ({ value: user.id, label: user.name }))] },
      ]} />
      {tickets.length ? <TicketTable db={db} tickets={tickets} basePath="/backoffice" tone="light" actionLabel="Gestionar" /> : <EmptyState title="No hay resultados" detail="Probá quitar algún filtro o buscar con otras palabras." tone="light" />}
    </SectionCard>
  </AppShell>;
}
