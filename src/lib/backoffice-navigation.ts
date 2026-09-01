import { canAccessPlatformRadar } from "@/lib/platform-radar";
import { withActor } from "@/lib/routing";
import type { UserProfile } from "@/lib/ticketing";

type BackofficeSection = "tickets" | "companies" | "users" | "radar";

export function buildBackofficeNavigation(input: {
  actor: UserProfile;
  active: BackofficeSection;
  ticketCount?: number;
  companyCount?: number;
  userCount?: number;
  ticketsHref?: string;
}) {
  return [
    { href: input.ticketsHref ?? withActor("/backoffice/queue", input.actor.id), label: "Tickets", active: input.active === "tickets", badge: input.ticketCount },
    { href: withActor("/backoffice/companies", input.actor.id), label: "Empresas", active: input.active === "companies", badge: input.companyCount },
    { href: withActor("/backoffice/users", input.actor.id), label: "Usuarios", active: input.active === "users", badge: input.userCount },
    ...(canAccessPlatformRadar(input.actor)
      ? [{ href: "/backoffice/radar", label: "Radar", active: input.active === "radar" }]
      : []),
  ];
}
