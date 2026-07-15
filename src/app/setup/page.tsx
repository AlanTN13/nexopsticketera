import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutClientForm } from "@/components/forms";
import { AppShell, NavButton, SectionCard, SidebarUserCard, StatCard } from "@/components/ui";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildBackofficeStats, getInternalDirectoryUsers } from "@/lib/queries";
import { withActor } from "@/lib/routing";
import { SUPABASE_URL } from "@/lib/supabase";
import { roleLabels } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

const INTERNAL_ROLE_DETAILS = [
  {
    role: "agent",
    summary: "Opera tickets, cambia estado, prioridad, asignación y responde casos.",
  },
  {
    role: "team_lead",
    summary: "Gestiona operación multiempresa y catálogo global del backoffice.",
  },
  {
    role: "platform_admin",
    summary: "Administra el sistema completo, usuarios internos y configuración crítica.",
  },
] as const;

const CLIENT_ROLE_DETAILS = [
  {
    role: "client_admin",
    summary: "Puede crear tickets y administrar usuarios de su empresa.",
  },
  {
    role: "client_operator",
    summary: "Puede crear y comentar tickets, pero no gestiona el directorio de usuarios.",
  },
  {
    role: "client_viewer",
    summary: "Solo consulta tickets y seguimiento sin mutaciones operativas.",
  },
] as const;

export default async function SetupPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const stats = buildBackofficeStats(db.tickets, db.companies);
  const internalUsers = getInternalDirectoryUsers(db);
  const clientUsers = db.users.filter((user) => user.companyId);
  const assignedTickets = db.tickets.filter((ticket) => ticket.assignedToId).length;
  const unresolvedTickets = db.tickets.filter((ticket) => ticket.status !== "closed" && ticket.status !== "resolved").length;

  return (
    <AppShell
      eyebrow="Backoffice · Configuración"
      title="Configuración y operación"
      description="Resumen ejecutivo del entorno actual: cómo está corriendo la ticketera, quién la opera y a qué áreas conviene entrar para seguir gestionando."
      tone="light"
      navigation={[
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets", badge: stats.activeTickets },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas", badge: db.companies.length },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
      ]}
      sidebarFooter={
        <SidebarUserCard name={actor.name} detail={roleLabels[actor.role]}>
          <LogoutClientForm tone="light" />
        </SidebarUserCard>
      }
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Ver tickets" muted tone="light" />
          <NavButton href={withActor("/backoffice/users", actor.id)} label="Gestionar usuarios" tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Backend activo"
          value="Supabase"
          detail="Persistencia real obligatoria. No existe fallback local."
          tone="light"
        />
        <StatCard
          label="Empresas"
          value={db.companies.length}
          detail="Cuentas visibles en la operación."
          tone="light"
        />
        <StatCard
          label="Usuarios internos"
          value={internalUsers.length}
          detail="Equipo NexOps con acceso al backoffice."
          tone="light"
        />
        <StatCard
          label="Tickets asignados"
          value={assignedTickets}
          detail="Casos con responsable definido."
          tone="light"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <SectionCard
          title="Estado del entorno"
          description="Resumen del backend Supabase obligatorio y de cómo está distribuida la operación."
          tone="light"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
              <p className="font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Fuente principal
              </p>
              <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#111827]">
                Supabase como backend único
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                La app opera con Auth, Postgres, RLS y Storage. Sin configuración válida falla de forma explícita.
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
              <p className="font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Salud operativa
              </p>
              <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#111827]">
                {unresolvedTickets} tickets requieren seguimiento
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                {stats.waitingCustomer} esperan respuesta del cliente y {stats.highPriority} están en alta prioridad.
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
              <p className="font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Acceso actual
              </p>
              <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#111827]">
                {actor.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">
                Ingresaste como {roleLabels[actor.role].toLowerCase()} y podés administrar esta sección.
              </p>
            </div>
            <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
              <p className="font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                Conexión detectada
              </p>
              <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#111827]">
                Proyecto enlazado
              </p>
              <p className="mt-2 break-all text-sm leading-6 text-[#6b7280]">
                {SUPABASE_URL}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Atajos útiles"
          description="Entradas rápidas a las áreas donde realmente se trabaja todos los días."
          tone="light"
        >
          <div className="grid gap-3">
            {[
              {
                href: withActor("/backoffice/queue", actor.id),
                title: "Cola operativa",
                detail: "Entrá a priorizar, asignar y responder tickets.",
              },
              {
                href: withActor("/backoffice/companies", actor.id),
                title: "Empresas",
                detail: "Revisá cuentas cliente, volumen operativo y admins.",
              },
              {
                href: withActor("/backoffice/users", actor.id),
                title: "Usuarios",
                detail: "Gestioná directorio interno y accesos por rol.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] px-4 py-4 transition hover:border-[#7c5bff] hover:bg-white"
              >
                <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#6b7280]">{item.detail}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Roles internos"
          description="Permisos del equipo NexOps dentro del backoffice."
          tone="light"
        >
          <div className="grid gap-3">
            {INTERNAL_ROLE_DETAILS.map((item) => (
              <div
                key={item.role}
                className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-white px-4 py-4"
              >
                <p className="text-sm font-semibold text-[#111827]">{roleLabels[item.role]}</p>
                <p className="mt-1 text-sm leading-6 text-[#6b7280]">{item.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Roles cliente"
          description="Qué puede hacer cada perfil dentro del portal cliente."
          tone="light"
        >
          <div className="grid gap-3">
            {CLIENT_ROLE_DETAILS.map((item) => (
              <div
                key={item.role}
                className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-white px-4 py-4"
              >
                <p className="text-sm font-semibold text-[#111827]">{roleLabels[item.role]}</p>
                <p className="mt-1 text-sm leading-6 text-[#6b7280]">{item.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Cobertura actual"
        description="Foto rápida de la operación visible en este entorno, sin meternos en detalles técnicos de migración."
        tone="light"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
            <p className="text-2xl font-black tracking-[-0.04em] text-[#111827]">{stats.activeTickets}</p>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              tickets activos entre todas las empresas.
            </p>
          </div>
          <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
            <p className="text-2xl font-black tracking-[-0.04em] text-[#111827]">{clientUsers.length}</p>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              usuarios cliente visibles en el directorio.
            </p>
          </div>
          <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[#fcfcff] p-4">
            <p className="text-2xl font-black tracking-[-0.04em] text-[#111827]">{stats.companies}</p>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              empresas con contexto operativo cargado.
            </p>
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}
