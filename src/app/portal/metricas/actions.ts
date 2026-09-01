"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { refreshMetricsSources } from "@/lib/metrics-sync";
import { getMetricsProfile, resolveMetricsCompanyForActor } from "@/lib/portal-modules";
import { hasModuleAccess } from "@/lib/authorization";

export type MetricsRefreshMutationState = { error: string | null };

export async function refreshMetricsAction(companyLookup?: string): Promise<MetricsRefreshMutationState> {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) return { error: "Tu sesión venció. Volvé a iniciar sesión." };

  const company = resolveMetricsCompanyForActor(db.companies, actor, companyLookup);
  const profile = company ? getMetricsProfile(company) : null;
  if (!company || !profile || !hasModuleAccess(actor, company, "metrics", "operate")) {
    return { error: "Necesitás permiso para operar Métricas en esta empresa." };
  }

  let result;
  try {
    result = await refreshMetricsSources({
      companyId: company.id,
      profile,
      trigger: "manual",
      requestedBy: actor.id,
    });
  } catch {
    return {
      error:
        "No pudimos consultar las fuentes ahora. Conservamos la última información disponible.",
    };
  }

  revalidatePath("/portal/metricas");
  if (!result.refreshed) {
    redirect(`/portal/metricas?company=${encodeURIComponent(company.id)}&wait=${Math.max(1, result.retryAfterSeconds)}`);
  }

  redirect(`/portal/metricas?company=${encodeURIComponent(company.id)}&updated=1${result.errors.length ? "&partial=1" : ""}`);
}
