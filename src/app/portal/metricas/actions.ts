"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedClientActor } from "@/lib/auth";
import { getAppSnapshot } from "@/lib/app-store";
import { refreshMetricsSources } from "@/lib/metrics-sync";
import { getMetricsProfile } from "@/lib/portal-modules";

export type MetricsRefreshMutationState = { error: string | null };

export async function refreshMetricsAction(): Promise<MetricsRefreshMutationState> {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedClientActor(db);
  if (!actor) return { error: "Tu sesión venció. Volvé a iniciar sesión." };

  const company = db.companies.find((item) => item.id === actor.companyId);
  const profile = company ? getMetricsProfile(company) : null;
  if (!company || !profile) return { error: "Métricas no está habilitado para esta empresa." };

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
    redirect(`/portal/metricas?wait=${Math.max(1, result.retryAfterSeconds)}`);
  }

  redirect(`/portal/metricas?updated=1${result.errors.length ? "&partial=1" : ""}`);
}
