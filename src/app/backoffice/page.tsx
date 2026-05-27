import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateCompanyForm, LogoutClientForm } from "@/components/forms";
import { AppShell, NavButton, SectionCard, StatCard } from "@/components/ui";
import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { buildBackofficeStats, getClientUsersForCompany, getTicketsForCompany } from "@/lib/queries";
import { withActor } from "@/lib/routing";
import { companyPlanLabels } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

type BackofficeHomeProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function BackofficeHome({ searchParams }: BackofficeHomeProps) {
  const { error } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) {
    redirect("/portal/login");
  }
  const stats = buildBackofficeStats(db.tickets, db.companies);

  return (
    <AppShell
      eyebrow="Backoffice NexOps"
      title="Empresas cliente y operación compartida"
      description="NexOps administra cuentas, usuarios cliente y tickets desde la empresa como unidad principal."
      tone="light"
      actions={
        <>
          <NavButton href={withActor("/backoffice/queue", actor.id)} label="Cola global" muted tone="light" />
          <NavButton href={withActor("/backoffice/users", actor.id)} label="Equipo NexOps" muted tone="light" />
          <LogoutClientForm tone="light" />
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Empresas" value={stats.companies} detail="Cuentas activas y en onboarding." tone="light" />
        <StatCard label="Tickets activos" value={stats.activeTickets} detail="Todo lo que sigue en operación o pendiente." tone="light" />
        <StatCard label="Alta prioridad" value={stats.highPriority} detail="Casos high + critical visibles para NexOps." tone="light" />
        <StatCard label="Esperando cliente" value={stats.waitingCustomer} detail="Tickets bloqueados hasta respuesta del cliente." tone="light" />
      </div>

      {error ? (
        <div className="rounded-[24px] border border-rose-300/40 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Empresas cliente"
          description="Cada cuenta concentra tickets compartidos, usuarios cliente y contexto operativo."
          tone="light"
        >
          <div className="grid gap-4">
            {db.companies.map((company) => {
              const companyTickets = getTicketsForCompany(db, company.id);
              const companyUsers = getClientUsersForCompany(db, company.id);
              const openTickets = companyTickets.filter((ticket) => ticket.status !== "closed").length;
              const criticalTickets = companyTickets.filter((ticket) => ticket.priority === "critical").length;

              return (
                <Link
                  key={company.id}
                  href={withActor(`/backoffice/companies/${company.id}`, actor.id)}
                  className="rounded-[28px] border border-[rgba(91,72,199,0.12)] bg-white/78 p-5 transition hover:border-[#7c5bff] hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold tracking-tight text-[#1b1638]">{company.name}</p>
                      <p className="text-sm text-[#5a5d7f]">{company.industry}</p>
                    </div>
                    <span className="rounded-full border border-[rgba(91,72,199,0.12)] bg-[#f7f5ff] px-3 py-1 font-[family-name:var(--font-montserrat)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b48c7]">
                      {companyPlanLabels[company.plan]}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <CompanyMetric label="Estado" value={company.status} />
                    <CompanyMetric label="Usuarios" value={String(companyUsers.length)} />
                    <CompanyMetric label="Abiertos" value={String(openTickets)} />
                    <CompanyMetric label="Críticos" value={String(criticalTickets)} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#5a5d7f]">
                    Contacto principal: {company.primaryContact}
                  </p>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Alta de empresa"
          description="Primero se crea la empresa y su admin inicial; después ese admin suma al resto del equipo cliente."
          tone="light"
        >
          <CreateCompanyForm actor={actor} returnPath="/backoffice" tone="light" />
        </SectionCard>
      </div>
    </AppShell>
  );
}

function CompanyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(91,72,199,0.12)] bg-[#faf9ff] px-4 py-3">
      <p className="font-[family-name:var(--font-montserrat)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b74a6]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#1b1638]">{value}</p>
    </div>
  );
}
