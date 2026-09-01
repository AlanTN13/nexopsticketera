import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm, UpdateCompanyForm, UpdateCompanyModulesForm, UpdateUserForm } from "@/components/forms";
import { AccessMatrixForm } from "@/components/access-matrix-form";
import { TicketTable, UserTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getClientUsersForCompany, getCompanyBySlugOrId, getTicketsForCompany, sortTickets } from "@/lib/queries";
import { withActor } from "@/lib/routing";
import { hasModuleAccess } from "@/lib/authorization";

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

      <SectionCard
        title="Productos del Portal"
        description="Habilitá únicamente las herramientas contratadas o acordadas. La disponibilidad comercial y el permiso personal se validan por separado."
        tone="light"
      >
        <UpdateCompanyModulesForm
          actor={actor}
          company={company}
          returnPath={`/backoffice/companies/${company.slug}`}
        />
        {hasModuleAccess(actor, company, "metrics", "view") ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
            <NavButton href={`/portal/metricas?company=${company.slug}`} label="Abrir Métricas" muted tone="light" />
            {hasModuleAccess(actor, company, "radar", "view") && company.modules.radar.settings.workspaceId ? (
              <NavButton href={`/portal/radar?company=${company.slug}`} label="Abrir Radar" muted tone="light" />
            ) : null}
          </div>
        ) : hasModuleAccess(actor, company, "radar", "view") && company.modules.radar.settings.workspaceId ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <NavButton href={`/portal/radar?company=${company.slug}`} label="Abrir Radar" muted tone="light" />
          </div>
        ) : null}
      </SectionCard>

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
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <AccessMatrixForm
                      actor={actor}
                      user={user}
                      company={company}
                      returnPath={`/backoffice/companies/${company.slug}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="Todavía no hay usuarios cliente" detail="Creá el admin inicial o sumá miembros desde el panel lateral." tone="light" />
        )}
      </SectionCard>

      <SectionCard title="Auditoría de accesos" description="Últimos cambios de módulos y permisos de esta empresa." tone="light">
        {(db.accessAudit ?? []).filter((entry) => entry.companyId === company.id).length ? (
          <div className="grid gap-2">
            {(db.accessAudit ?? []).filter((entry) => entry.companyId === company.id).slice(0, 20).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">{entry.action}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {entry.module ? `Módulo ${entry.module} · ` : ""}{entry.targetUserId ? `Usuario ${entry.targetUserId} · ` : ""}{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
                </p>
                {entry.reason ? <p className="mt-1 text-xs text-slate-600">Motivo: {entry.reason}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin cambios auditados" detail="Los próximos cambios de módulos, empresas y niveles aparecerán acá." tone="light" />
        )}
      </SectionCard>
    </AppShell>
  );
}
