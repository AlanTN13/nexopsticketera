import { redirect } from "next/navigation";

import { CreateUserForm } from "@/components/forms";
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
      eyebrow="Backoffice · Equipo NexOps"
      title="Usuarios internos y operación de NexOps"
      description="Directorio del equipo interno. Los usuarios cliente se gestionan dentro de cada empresa."
      tone="light"
      actions={
        <>
          <NavButton href={withActor("/backoffice", actor.id)} label="Empresas" muted tone="light" />
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Cola global" muted tone="light" />
        </>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Equipo interno" description="Personas NexOps que operan soporte, delivery y administración de plataforma." tone="light">
          <UserTable users={internalUsers} tone="light" />
        </SectionCard>
        <SectionCard title="Nuevo usuario interno" description="Alta manual de usuarios NexOps dentro del entorno demo." tone="light">
          <CreateUserForm actor={actor} companyId={null} returnPath="/backoffice/users" tone="light" />
        </SectionCard>
      </div>
    </AppShell>
  );
}
