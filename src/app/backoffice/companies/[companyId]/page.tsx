import { CreateUserForm } from "@/components/forms";
import { TicketTable, UserTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getActor, getClientUsersForCompany, getCompany, getTicketsForCompany, sortTickets } from "@/lib/queries";
import { withActor } from "@/lib/routing";
import { companyPlanLabels } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

type CompanyDetailProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ actor?: string }>;
};

export default async function BackofficeCompanyDetail({
  params,
  searchParams,
}: CompanyDetailProps) {
  const [{ companyId }, { actor: actorId }] = await Promise.all([params, searchParams]);
  const db = await getAppSnapshot();
  const actor = getActor(db, actorId);
  const company = getCompany(db, companyId);

  if (!company) {
    return (
      <AppShell
        eyebrow="Backoffice · Empresa"
        title="Empresa no encontrada"
        description="No pudimos ubicar la cuenta solicitada en el entorno actual."
        tone="light"
        actions={<NavButton href={withActor("/backoffice", actor.id)} label="Volver a empresas" muted tone="light" />}
      >
        <EmptyState title="Nada para mostrar" detail="La empresa puede haberse eliminado o el entorno se reinició." tone="light" />
      </AppShell>
    );
  }

  const companyTickets = sortTickets(getTicketsForCompany(db, company.id));
  const companyUsers = getClientUsersForCompany(db, company.id);
  const openTickets = companyTickets.filter((ticket) => ticket.status !== "closed");
  const criticalTickets = companyTickets.filter((ticket) => ticket.priority === "critical");

  return (
    <AppShell
      eyebrow="Backoffice · Empresa"
      title={company.name}
      description="Vista consolidada de la cuenta: tickets compartidos, usuarios cliente y contexto operativo."
      tone="light"
      actions={
        <>
          <NavButton href={withActor("/backoffice", actor.id)} label="Volver a empresas" muted tone="light" />
          <NavButton href={withActor(`/backoffice/queue?companyId=${company.id}`, actor.id)} label="Ver cola de la cuenta" muted tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Plan" value={companyPlanLabels[company.plan]} detail="Nivel comercial actual de la cuenta." tone="light" />
        <StatCard label="Usuarios cliente" value={companyUsers.length} detail="Miembros con acceso al portal de la empresa." tone="light" />
        <StatCard label="Tickets abiertos" value={openTickets.length} detail="Solicitudes activas o esperando respuesta." tone="light" />
        <StatCard label="Tickets críticos" value={criticalTickets.length} detail="Casos de mayor urgencia operativa." tone="light" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
        <SectionCard
          title="Ficha de la empresa"
          description="Datos centrales de la cuenta para que NexOps opere con mejor contexto."
          tone="light"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard label="Slug" value={company.slug} />
            <DetailCard label="Estado" value={company.status} />
            <DetailCard label="Industria" value={company.industry} />
            <DetailCard label="Contacto principal" value={company.primaryContact} />
          </div>
        </SectionCard>

        <SectionCard
          title="Sumar usuario cliente"
          description="Alta de miembros para esta empresa. Todos verán los tickets compartidos de la cuenta según su rol."
          tone="light"
        >
          <CreateUserForm
            actor={actor}
            companyId={company.id}
            returnPath={`/backoffice/companies/${company.id}`}
            clientOnly
            tone="light"
          />
        </SectionCard>
      </div>

      <div className="grid gap-8">
        <SectionCard
          title="Usuarios de la empresa"
          description="Miembros cliente asociados a esta cuenta. El rol define acciones, no lectura base de tickets."
          tone="light"
        >
          {companyUsers.length > 0 ? (
            <UserTable users={companyUsers} tone="light" />
          ) : (
            <EmptyState
              title="Todavía no hay usuarios cliente"
              detail="Creá el admin inicial o sumá miembros desde el panel lateral."
              tone="light"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Tickets de la empresa"
          description="Todos los tickets compartidos por esta cuenta, visibles para los usuarios cliente de la empresa."
          tone="light"
        >
          {companyTickets.length > 0 ? (
            <TicketTable db={db} tickets={companyTickets} actor={actor} basePath="/backoffice" tone="light" />
          ) : (
            <EmptyState
              title="Esta empresa todavía no tiene tickets"
              detail="Cuando el cliente cree su primera incidencia o mejora, va a aparecer acá."
              tone="light"
            />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] p-5">
      <p className="font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b74a6]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-[#1b1638]">{value}</p>
    </div>
  );
}
