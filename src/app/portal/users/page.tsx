import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm } from "@/components/forms";
import { UserTable } from "@/components/tables";
import { AppShell, EmptyState, NavButton, SectionCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
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
    redirect("/login");
  }

  const users = getUsersForCompany(db, actor.companyId);
  const canManage = canAccessCompanyUsers(actor, actor.companyId);

  return (
    <AppShell
      eyebrow="Miembros de tu empresa"
      title="Usuarios de tu empresa"
      description="Los tickets se comparten a nivel empresa. Desde acá podés ver quiénes forman parte de la cuenta y, si sos admin, sumar nuevos accesos."
      actions={
        <>
          <NavButton href="/portal" label="Volver al portal" muted />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Miembros con acceso" description="Listado visible solo para la empresa del usuario autenticado.">
          {users.length > 0 ? (
            <UserTable users={users} />
          ) : (
            <EmptyState
              title="No hay usuarios cargados"
              detail="Invitá personas desde el formulario lateral."
            />
          )}
        </SectionCard>

        <SectionCard title="Invitar usuario" description="Disponible para quienes administran accesos dentro de la empresa.">
          {canManage ? (
            <CreateUserForm
              actor={actor}
              companyId={actor.companyId}
              returnPath="/portal/users"
              clientOnly
            />
          ) : (
            <EmptyState
              title="Sin permisos de administración"
              detail="El rol actual puede consultar la lista, pero no invitar ni editar usuarios."
            />
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
