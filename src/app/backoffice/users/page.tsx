import { redirect } from "next/navigation";

import { CreateUserForm, LogoutClientForm } from "@/components/forms";
import { AccessMatrixForm } from "@/components/access-matrix-form";
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

      <SectionCard
        title="Empresas y módulos por integrante"
        description="Asigná primero la empresa y después el nivel por módulo. Un permiso sin empresa o con el producto deshabilitado nunca es efectivo."
        tone="light"
      >
        <div className="grid gap-5">
          {internalUsers.filter((user) => user.role !== "platform_admin").map((user) => (
            <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4">
                <p className="font-semibold text-slate-950">{user.name}</p>
                <p className="text-sm text-slate-600">{user.title} · {user.email}</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {db.companies.map((company) => (
                  <div key={company.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-950">{company.name}</p>
                    <AccessMatrixForm
                      actor={actor}
                      user={user}
                      company={company}
                      internalAssignment
                      returnPath="/backoffice/users"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
