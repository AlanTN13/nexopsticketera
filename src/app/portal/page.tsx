import { redirect } from "next/navigation";

import { CreateTicketForm, LogoutClientForm } from "@/components/forms";
import { PortalTicketModal } from "@/components/portal-ticket-modal";
import { TicketTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, SidebarUserCard, StatCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalStats, filterTickets, sortTickets } from "@/lib/queries";

export const dynamic = "force-dynamic";

type PortalPageProps = {
  searchParams: Promise<{
    status?: string;
    area?: string;
    priority?: string;
  }>;
};

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { status, area, priority } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const companyTickets = actor.companyId
    ? db.tickets.filter((ticket) => ticket.companyId === actor.companyId)
    : [];
  const tickets = sortTickets(
    filterTickets(companyTickets, { status, area, priority }),
  );
  const stats = buildPortalStats(companyTickets);
  const inProgress = companyTickets.filter((ticket) => ticket.status === "in_progress").length;
  const resolved = companyTickets.filter(
    (ticket) => ticket.status === "resolved" || ticket.status === "closed",
  ).length;

  return (
    <AppShell
      eyebrow="Portal cliente"
      title="Tickets"
      description="Gestioná y seguí las solicitudes de tu empresa desde una vista más clara y operativa."
      tone="light"
      navigation={[
        { href: "/portal", label: "Tickets", active: true, badge: stats.total },
        { href: "/portal/users", label: "Usuarios" },
      ]}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail="Cliente">
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
      actions={
        <PortalTicketModal
          title="Nuevo ticket"
          description="Creá una incidencia o mejora sin salir del flujo principal de seguimiento."
        >
          <CreateTicketForm actor={actor} tone="light" compact />
        </PortalTicketModal>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Abiertos" value={stats.open} detail="Requieren respuesta." tone="light" />
        <StatCard label="En progreso" value={inProgress} detail="En tratamiento." tone="light" />
        <StatCard label="Críticos" value={stats.critical} detail="Alta prioridad." tone="light" />
        <StatCard label="Resueltos" value={resolved} detail="Cerrados o resueltos." tone="light" />
      </div>

      <SectionCard
        title="Listado"
        description="La tabla es el centro del flujo. Filtrá y abrí cada ticket para ver estado, historial y conversación."
        tone="light"
        actions={<NavButton href="/portal" label="Limpiar filtros" muted tone="light" />}
      >
        <form className="mb-5 grid gap-3 xl:grid-cols-[repeat(3,minmax(0,180px))_auto]">
          <select
            name="status"
            defaultValue={status ?? "all"}
            className="rounded-[16px] border border-[rgba(17,24,39,0.1)] bg-white px-3 py-2.5 text-sm text-[#111827]"
          >
            <option value="all">Estado</option>
            <option value="new">Nuevo</option>
            <option value="analysis">En análisis</option>
            <option value="in_progress">En progreso</option>
            <option value="waiting_for_client">Esperando cliente</option>
            <option value="resolved">Resuelto</option>
            <option value="closed">Cerrado</option>
          </select>
          <select
            name="priority"
            defaultValue={priority ?? "all"}
            className="rounded-[16px] border border-[rgba(17,24,39,0.1)] bg-white px-3 py-2.5 text-sm text-[#111827]"
          >
            <option value="all">Prioridad</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
          <select
            name="area"
            defaultValue={area ?? "all"}
            className="rounded-[16px] border border-[rgba(17,24,39,0.1)] bg-white px-3 py-2.5 text-sm text-[#111827]"
          >
            <option value="all">Área</option>
            <option value="automation">Automatizaciones</option>
            <option value="custom_system">Sistema custom</option>
            <option value="website">Sitios web</option>
            <option value="ai_agent">Agentes IA</option>
            <option value="crm">CRM</option>
            <option value="erp">ERP</option>
          </select>
          <button type="submit" className="rounded-[16px] bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black">
            Aplicar filtros
          </button>
        </form>

        {tickets.length > 0 ? (
          <TicketTable db={db} tickets={tickets} basePath="/portal" tone="light" showCompany={false} actionLabel="Abrir" />
        ) : (
          <EmptyState title="Todavía no hay tickets para estos filtros" detail="Cuando cargues el primero, lo vas a poder seguir desde esta misma vista." tone="light" />
        )}
      </SectionCard>
    </AppShell>
  );
}
