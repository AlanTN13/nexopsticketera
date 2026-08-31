import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateCompanyForm, LogoutClientForm } from "@/components/forms";
import { AppModal } from "@/components/portal-ticket-modal";
import { AppShell, EmptyState, InlineNotice, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { buildBackofficeStats, getClientUsersForCompany, getTicketsForCompany } from "@/lib/queries";
import { withActor } from "@/lib/routing";

type CompaniesPageProps = {
  searchParams: Promise<{ error?: string; success?: string; created?: string }>;
};

export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const { error, success, created } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);

  if (!actor) {
    redirect("/portal/login");
  }

  const stats = buildBackofficeStats(db.tickets, db.companies);

  return (
    <AppShell
      eyebrow="Backoffice · Empresas"
      title="Empresas y cuentas cliente"
      description="Catálogo de cuentas para consultar contexto, usuarios cliente y volumen operativo sin mezclarlo con la cola diaria."
      tone="light"
      navigation={[
        { href: withActor("/backoffice/queue", actor.id), label: "Tickets" },
        { href: withActor("/backoffice/companies", actor.id), label: "Empresas", active: true, badge: db.companies.length },
        { href: withActor("/backoffice/users", actor.id), label: "Usuarios" },
        ...(actor.role === "platform_admin" ? [{ href: "/portal/radar", label: "Radar" }] : []),
      ]}
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Ver tickets" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Empresas" value={stats.companies} detail="Cuentas activas y en onboarding." tone="light" />
        <StatCard label="Tickets activos" value={stats.activeTickets} detail="Volumen operativo abierto entre cuentas." tone="light" />
        <StatCard label="Alta prioridad" value={stats.highPriority} detail="Casos high y critical en todas las empresas." tone="light" />
        <StatCard label="Esperando cliente" value={stats.waitingCustomer} detail="Casos bloqueados por respuesta externa." tone="light" />
      </div>

      {error ? (
        <div className="rounded-[20px] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? <InlineNotice tone="success">{success}</InlineNotice> : null}

      <SectionCard
        title="Directorio de empresas"
        description="Cada fila resume estado de la cuenta y carga operativa. Entrá a la empresa para ver tickets y usuarios."
        tone="light"
        actions={
          <AppModal
            key={created ?? "create-company"}
            triggerLabel="+ Dar de alta empresa"
            title="Nueva empresa"
            description="Cargá la empresa y dejá listo el primer acceso para su responsable inicial."
            maxWidthClassName="max-w-3xl"
          >
            <CreateCompanyForm actor={actor} returnPath="/backoffice/companies" tone="light" />
          </AppModal>
        }
      >
        {db.companies.length > 0 ? (
          <div className="overflow-hidden rounded-[22px] border border-[rgba(17,24,39,0.08)]">
            <div className="grid grid-cols-[minmax(0,1.7fr)_110px_110px_110px] gap-3 bg-[#f9fafb] px-4 py-3 font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
              <span>Empresa</span>
              <span>Usuarios</span>
              <span>Abiertos</span>
              <span>Críticos</span>
            </div>
            <div className="divide-y divide-[rgba(17,24,39,0.06)] bg-white">
              {db.companies.map((company) => {
                const companyTickets = getTicketsForCompany(db, company.id);
                const companyUsers = getClientUsersForCompany(db, company.id);
                const openTickets = companyTickets.filter((ticket) => ticket.status !== "closed").length;
                const criticalTickets = companyTickets.filter((ticket) => ticket.priority === "critical").length;

                return (
                  <Link
                    key={company.id}
                    href={withActor(`/backoffice/companies/${company.slug}`, actor.id)}
                    className="grid grid-cols-[minmax(0,1.7fr)_110px_110px_110px] gap-3 px-4 py-4 transition hover:bg-[#fafafa]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#111827]">{company.name}</p>
                      <p className="mt-1 truncate text-sm text-[#6b7280]">
                        {company.industry} · {company.primaryContact}
                      </p>
                    </div>
                    <div className="text-sm text-[#4b5563]">{companyUsers.length}</div>
                    <div className="text-sm text-[#4b5563]">{openTickets}</div>
                    <div className="text-sm text-[#4b5563]">{criticalTickets}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="No hay empresas cargadas" detail="Cuando exista la primera cuenta la vas a ver acá." tone="light" />
        )}
      </SectionCard>
    </AppShell>
  );
}
