import "server-only";

import { redirect } from "next/navigation";

import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedActor } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/authorization";
import { getContentPortalContext } from "@/lib/content-store";
import { resolveContentCompanyForActor } from "@/lib/portal-modules";
import { isClientRole } from "@/lib/ticketing";

export async function getContentPortalPageContext(companyLookup?: string) {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const company = resolveContentCompanyForActor(db.companies, actor, companyLookup);
  if (!company || !hasModuleAccess(actor, company, "content", "view")) {
    redirect(isClientRole(actor.role) ? "/portal" : "/backoffice/queue");
  }

  return getContentPortalContext(company.id);
}
