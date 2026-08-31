import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm } from "@/components/forms";
import { UserTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard, SidebarUserCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalNavigation } from "@/lib/portal-modules";
import { canAccessCompanyUsers, getUsersForCompany } from "@/lib/queries";

export const dynamic = "force-dynamic";

type PortalUsersProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalUsersPage({ searchParams }: PortalUsersProps) {
  await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);

  if (!actor) {
    redirect("/portal/login");
  }
  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");

  const users = getUsersForCompany(db, actor.companyId);
  const ticketCount = db.tickets.filter((ticket) => ticket.companyId === company.id).length;
  const canManage = canAccessCompanyUsers(actor, actor.companyId);

  return (
    <AppShell
      eyebrow="Portal cliente · Usuarios"
      title="Usuarios de tu empresa"
      description="El acceso se sigue gestionando por empresa, pero ahora en una pantalla más clara y separada del seguimiento de tickets."
      tone="light"
      navigation={buildPortalNavigation({ active: null, modules: company.modules, ticketCount })}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={company.name}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
      actions={
        <NavButton href="/portal" label="Volver al inicio" muted tone="light" />
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="Miembros con acceso" description="Listado visible solo para la empresa del usuario autenticado." tone="light">
          {users.length > 0 ? (
            <UserTable users={users} tone="light" />
          ) : (
            <EmptyState title="No hay usuarios cargados" detail="Invitá personas desde el panel lateral." tone="light" />
          )}
        </SectionCard>

        <SectionCard title="Invitar usuario" description="Disponible para quienes administran accesos dentro de la empresa." tone="light">
          {canManage ? (
            <CreateUserForm
              actor={actor}
              companyId={actor.companyId}
              returnPath="/portal/users"
              clientOnly
              tone="light"
            />
          ) : (
            <EmptyState title="Sin permisos de administración" detail="El rol actual puede consultar la lista, pero no invitar ni editar usuarios." tone="light" />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
