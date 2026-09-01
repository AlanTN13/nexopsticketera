"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAuthenticatedActorId } from "@/lib/auth";
import { getAppSnapshot, updateRadarPreferences } from "@/lib/app-store";
import {
  RADAR_OPPORTUNITY_BEHAVIORS,
  RADAR_PUBLISHING_MODES,
  normalizeRadarTopics,
  type RadarOpportunityBehavior,
  type RadarPublishingMode,
} from "@/lib/radar-preferences";

export type RadarPreferencesMutationState = { error: string | null };

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateRadarPreferencesAction(
  formData: FormData,
): Promise<RadarPreferencesMutationState> {
  const db = await getAppSnapshot();
  const actor = await assertAuthenticatedActorId(db, getString(formData, "actorId"));
  const selectedTopics = formData.getAll("topics");
  const customTopics = getString(formData, "customTopics");
  const topics = normalizeRadarTopics([...selectedTopics, customTopics]);
  const publicationsPerWeek = Number.parseInt(getString(formData, "publicationsPerWeek"), 10);
  const opportunityBehavior = getString(formData, "opportunityBehavior") as RadarOpportunityBehavior;
  const publishingMode = getString(formData, "publishingMode") as RadarPublishingMode;

  if (!RADAR_OPPORTUNITY_BEHAVIORS.includes(opportunityBehavior)) {
    return { error: "Elegí qué debe hacer Radar con las oportunidades débiles." };
  }
  if (!RADAR_PUBLISHING_MODES.includes(publishingMode)) {
    return { error: "Elegí un modo de publicación válido." };
  }

  try {
    await updateRadarPreferences({
      actorId: actor.id,
      companyId: getString(formData, "companyId"),
      topics,
      publicationsPerWeek,
      opportunityBehavior,
      publishingMode,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No pudimos guardar la estrategia de Radar.",
    };
  }

  revalidatePath("/portal/radar");
  revalidatePath("/portal/radar/estrategia");
  redirect(`/portal/radar/estrategia?saved=1&company=${encodeURIComponent(getString(formData, "companyId"))}`);
}
