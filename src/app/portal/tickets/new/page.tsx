import { redirect } from "next/navigation";
import { CreateTicketForm } from "@/components/forms";
import { AppShell, NavButton, SectionCard } from "@/components/ui";
import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";

export const dynamic = "force-dynamic";
export default async function NewTicketPage() {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  return <AppShell eyebrow="Portal cliente" title="Nuevo ticket" description="Contanos qué pasa y cómo afecta tu trabajo." tone="light" navigation={[{ href: "/portal", label: "Tickets", active: true }]} actions={<NavButton href="/portal" label="Cancelar" muted tone="light" />}><SectionCard title="Crear solicitud" tone="light"><CreateTicketForm actor={actor} tone="light" compact /></SectionCard></AppShell>;
}
