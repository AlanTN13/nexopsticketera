import { redirect } from "next/navigation";
import { CreateTicketForm } from "@/components/forms";
import { AppShell, NavButton, SectionCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { buildPortalNavigation, getMetricsProfile } from "@/lib/portal-modules";

export const dynamic = "force-dynamic";
export default async function NewTicketPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  const company = db.companies.find((item) => item.id === actor.companyId);
  if (!company) redirect("/portal/login?reason=company");
  const ticketCount = db.tickets.filter((ticket) => ticket.companyId === company.id).length;
  return <AppShell eyebrow="Portal NexOps · Soporte" title="Nuevo ticket" description="Contanos qué pasa y cómo afecta tu trabajo." tone="light" navigation={buildPortalNavigation({ active: "support", metricsEnabled: Boolean(getMetricsProfile(company)), ticketCount })} actions={<NavButton href="/portal/soporte" label="Cancelar" muted tone="light" />}><SectionCard title="Crear solicitud" tone="light"><CreateTicketForm actor={actor} tone="light" compact /></SectionCard></AppShell>;
}
