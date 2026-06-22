import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm, UpdateCompanyForm, UpdateUserForm } from "@/components/forms";
import { TicketTable, UserTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getClientUsersForCompany, getCompanyBySlugOrId, getTicketsForCompany, sortTickets } from "@/lib/queries";
import { withActor } from "@/lib/routing";

export const dynamic = "force-dynamic";

type CompanyDetailProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function BackofficeCompanyDetail({
  params,
  searchParams,
}: CompanyDetailProps) {
  const { companyId: companyLookup } = await params;
  const { error, success } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const company = getCompanyBySlugOrId(db, companyLookup);

  if (!company) {
    return (
      <AppShell
        eyebrow="Backoffice · Empresa"
        title="Empresa no encontrada"
        description="No pudimos ubicar la cuenta solicitada en el entorno actual."
        tone="light"
        navigation={[
          { href: withActor("/backoffice/queue", actor.id), label: "Tickets" },
          { href: withActor("/backoffice/companies", actor.id), label: "Empresas", active: true },
          { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
        ]}
        actions={<NavButton href={withActor("/backoffice/companies", actor.id)} label="Volver a empresas" muted tone="light" />}
      >
        <EmptyState title="Nada para mostrar" detail="La empresa puede haberse eliminado o el entorno se reinició." tone="light" />
      </AppShell>
    );
  }

  if (companyLookup !== company.slug) {
    redirect(`/backoffice/companies/${company.slug}`);
  }

  const companyTickets = sortTickets(getTicketsForCompany(db, company.id));
  const companyUsers = getClientUsersForCompany(db, company.id);
  const openTickets = companyTickets.filter((ticket) => ticket.status !== "closed");
  const criticalTickets = companyTickets.filter((ticket) => ticket.priority === "critical");

  return (
    <AppShell
      eyebrow="Backoffice · Empresa"
      title={company.name}
      description="Workspace de la cuenta con vista separada para datos, tickets y usuarios cliente."
      tone="light"
      navigation={[
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets" },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas", active: true },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
      ]}
      actions={
        <>
          <NavButton href={withActor("/backoffice/companies", actor.id)} label="Volver a empresas" muted tone="light" />
          <NavButton href={withActor(`/backoffice/queue?companyId=${company.id}`, actor.id)} label="Ver tickets" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Estado" value={company.status === "active" ? "Activa" : "Onboarding"} detail="Momento operativo actual de la cuenta." tone="light" />
        <StatCard label="Usuarios" value={companyUsers.length} detail="Miembros cliente con acceso al portal." tone="light" />
        <StatCard label="Abiertos" value={openTickets.length} detail="Solicitudes activas o esperando respuesta." tone="light" />
        <StatCard label="Críticos" value={criticalTickets.length} detail="Casos de mayor urgencia operativa." tone="light" />
      </div>

      {error ? (
        <div className="rounded-[20px] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[20px] border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard
          title="Overview"
          description="Información estructural de la cuenta. Acá vive la configuración central, no la operación diaria."
          tone="light"
        >
          <UpdateCompanyForm
            actor={actor}
            company={company}
            returnPath={`/backoffice/companies/${company.slug}`}
            tone="light"
          />
        </SectionCard>

        <SectionCard
          title="Nuevo usuario cliente"
          description="Alta rápida de miembros de esta cuenta sin salir del workspace de empresa."
          tone="light"
        >
          <CreateUserForm
            actor={actor}
            companyId={company.id}
            returnPath={`/backoffice/companies/${company.slug}`}
            clientOnly
            tone="light"
          />
        </SectionCard>
      </div>

      <SectionCard title="Tickets de la empresa" description="Cola específica de esta cuenta, sin perder consistencia con la tabla global." tone="light">
        {companyTickets.length > 0 ? (
          <TicketTable db={db} tickets={companyTickets} basePath="/backoffice" tone="light" />
        ) : (
          <EmptyState title="Esta empresa todavía no tiene tickets" detail="Cuando el cliente cree su primera incidencia o mejora, va a aparecer acá." tone="light" />
        )}
      </SectionCard>

      <SectionCard title="Usuarios cliente" description="Directorio de accesos de la cuenta. La edición detallada queda abajo de la tabla." tone="light">
        {companyUsers.length > 0 ? (
          <div className="grid gap-5">
            <UserTable users={companyUsers} tone="light" />
            <div className="grid gap-4 xl:grid-cols-2">
              {companyUsers.map((user) => (
                <div key={user.id} className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fafafa] p-4">
                  <div className="mb-4">
                    <p className="font-semibold text-[#111827]">{user.name}</p>
                    <p className="text-sm text-[#6b7280]">
                      Ajustá mail, rol, cargo o definí una nueva contraseña.
                    </p>
                  </div>
                  <UpdateUserForm
                    actor={actor}
                    user={user}
                    returnPath={`/backoffice/companies/${company.slug}`}
                    tone="light"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Todavía no hay usuarios cliente" detail="Creá el admin inicial o sumá miembros desde el panel lateral." tone="light" />
        )}
      </SectionCard>
    </AppShell>
  );
}
