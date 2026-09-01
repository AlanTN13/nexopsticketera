import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedActor } from "@/lib/auth";
import { getRadarWorkspaceId, resolveRadarCompanyForActor } from "@/lib/portal-modules";
import { buildRadarProductModel } from "@/lib/radar-product";
import { loadRadarWorkspace } from "@/lib/radar-workspace";
import { isInternalRole } from "@/lib/ticketing";
import { parseRadarPreferences } from "@/lib/radar-preferences";
import { hasModuleAccess } from "@/lib/authorization";

export const getRadarProductContext = cache(async (companyLookup?: string) => {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) redirect("/portal/login?reason=session");

  const internalActor = isInternalRole(actor.role);
  const company = resolveRadarCompanyForActor(db.companies, actor, companyLookup);
  if (!company) {
    redirect(internalActor ? "/backoffice/queue" : "/portal/login?reason=company");
  }
  if (!company.modules.radar.enabled) {
    redirect(internalActor ? "/backoffice/queue" : "/portal");
  }

  const workspaceId = getRadarWorkspaceId(company);
  if (!workspaceId) {
    redirect(internalActor ? "/backoffice/companies" : "/portal");
  }

  const workspace = await loadRadarWorkspace(workspaceId);

  return {
    actor,
    company,
    internalActor,
    workspace,
    model: buildRadarProductModel(workspace),
    preferences: parseRadarPreferences(company.modules.radar.settings),
    canManagePreferences: hasModuleAccess(actor, company, "radar", "admin"),
    exitHref: internalActor ? `/backoffice/companies/${company.slug}` : "/portal",
    exitLabel: internalActor ? "Volver al backoffice" : "Volver al Portal",
  };
});
