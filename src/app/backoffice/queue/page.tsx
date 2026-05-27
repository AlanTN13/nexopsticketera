import { redirect } from "next/navigation";

import { TicketTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { buildBackofficeStats, filterTickets, getInternalUsers, sortTickets } from "@/lib/queries";
import { withActor } from "@/lib/routing";

export const dynamic = "force-dynamic";

type BackofficeQueueProps = {
  searchParams: Promise<{
    actor?: string;
    status?: string;
    area?: string;
    priority?: string;
    companyId?: string;
    assignedToId?: string;
  }>;
};

export default async function BackofficeQueuePage({ searchParams }: BackofficeQueueProps) {
  const { status, area, priority, companyId, assignedToId } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) {
    redirect("/portal/login");
  }
  const tickets = sortTickets(
    filterTickets(db.tickets, { status, area, priority, companyId, assignedToId }),
  );
  const stats = buildBackofficeStats(db.tickets, db.companies);
  const internalUsers = getInternalUsers(db);

  return (
    <AppShell
      eyebrow="Backoffice · Cola global"
      title="Cola operativa multiempresa"
      description="Vista transversal para priorizar, asignar y seguir tickets de todas las cuentas cliente."
      tone="light"
      actions={
        <>
          <NavButton href={withActor("/backoffice", actor.id)} label="Empresas" muted tone="light" />
          <NavButton href={withActor("/backoffice/users", actor.id)} label="Equipo NexOps" muted tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Tickets activos" value={stats.activeTickets} detail="Todo lo que sigue en operación o pendiente." tone="light" />
        <StatCard label="Alta prioridad" value={stats.highPriority} detail="Tickets high + critical en la cola." tone="light" />
        <StatCard label="Esperando cliente" value={stats.waitingCustomer} detail="Items bloqueados hasta respuesta externa." tone="light" />
        <StatCard label="Empresas" value={stats.companies} detail="Cuentas activas gestionadas por NexOps." tone="light" />
      </div>

      <SectionCard title="Cola operativa" description="Filtros por estado, área, empresa, prioridad y asignación para ordenar la ejecución del equipo." tone="light">
        <form className="mb-5 grid gap-4 lg:grid-cols-6">
          <select name="status" defaultValue={status ?? "all"} className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638]">
            <option value="all">Todos los estados</option>
            <option value="new">Nuevo</option>
            <option value="analysis">En análisis</option>
            <option value="in_progress">En progreso</option>
            <option value="waiting_for_client">Esperando cliente</option>
            <option value="resolved">Resuelto</option>
            <option value="closed">Cerrado</option>
          </select>
          <select name="area" defaultValue={area ?? "all"} className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638]">
            <option value="all">Todas las áreas</option>
            <option value="automation">Automatizaciones</option>
            <option value="custom_system">Sistema custom</option>
            <option value="website">Sitios web</option>
            <option value="ai_agent">Agentes IA</option>
            <option value="crm">CRM</option>
            <option value="erp">ERP</option>
          </select>
          <select name="priority" defaultValue={priority ?? "all"} className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638]">
            <option value="all">Todas las prioridades</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
          <select name="companyId" defaultValue={companyId ?? "all"} className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638]">
            <option value="all">Todas las empresas</option>
            {db.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <select name="assignedToId" defaultValue={assignedToId ?? "all"} className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-white px-4 py-3 text-sm text-[#1b1638]">
            <option value="all">Todos los asignados</option>
            <option value="unassigned">Sin asignar</option>
            {internalUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-[20px] border border-[rgba(91,72,199,0.14)] bg-[#1b1638] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#120f2c]">
            Aplicar filtros
          </button>
        </form>

        {tickets.length > 0 ? (
          <TicketTable db={db} tickets={tickets} basePath="/backoffice" tone="light" />
        ) : (
          <EmptyState
            title="No hay tickets con estos filtros"
            detail="Cambiá la combinación o revisá la cola completa."
            tone="light"
          />
        )}
      </SectionCard>
    </AppShell>
  );
}
