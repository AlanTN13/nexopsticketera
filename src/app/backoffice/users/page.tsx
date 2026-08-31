import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm } from "@/components/forms";
import { UserTable } from "@/components/tables";
import { AppShell, NavButton, SectionCard } from "@/components/ui";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { getInternalDirectoryUsers } from "@/lib/queries";
import { withActor } from "@/lib/routing";

export const dynamic = "force-dynamic";

export default async function BackofficeUsersPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const internalUsers = getInternalDirectoryUsers(db);

  return (
    <AppShell
      eyebrow="Backoffice · Usuarios"
      title="Equipo interno"
      description="Directorio operativo de NexOps. Los usuarios cliente se gestionan dentro de cada empresa para no mezclar contextos."
      tone="light"
      navigation={[
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets" },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas" },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios", active: true, badge: internalUsers.length },
        ...(actor.role === "platform_admin" ? [{ href: "/portal/radar", label: "Radar" }] : []),
      ]}
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Ver tickets" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="Directorio NexOps" description="Usuarios que pueden operar tickets, liderar cuentas o administrar plataforma." tone="light">
          <UserTable users={internalUsers} tone="light" />
        </SectionCard>
        <SectionCard title="Nuevo usuario interno" description="Alta manual de accesos internos manteniendo la lógica actual del producto." tone="light">
          <CreateUserForm actor={actor} companyId={null} returnPath="/backoffice/users" tone="light" />
        </SectionCard>
      </div>
    </AppShell>
  );
}
