import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  canManageRadarPreferences,
  parseRadarPreferences,
  type RadarOpportunityBehavior,
  type RadarPublishingMode,
} from "@/lib/radar-preferences";
import type { UserProfile } from "@/lib/ticketing";

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function persistRadarPreferences(input: {
  actor: UserProfile;
  companyId: string;
  topics: string[];
  publicationsPerWeek: number;
  opportunityBehavior: RadarOpportunityBehavior;
  publishingMode: RadarPublishingMode;
}) {
  if (
    !canManageRadarPreferences(input.actor.role) ||
    (input.actor.role !== "platform_admin" && input.actor.companyId !== input.companyId)
  ) {
    throw new Error("Tu rol puede revisar la estrategia, pero no modificarla.");
  }

  const adminClient = getSupabaseAdminClient();
  const { data: moduleData, error: moduleError } = await adminClient
    .from("company_modules")
    .select("enabled, settings")
    .eq("company_id", input.companyId)
    .eq("module", "radar")
    .single();

  if (moduleError) throw new Error(moduleError.message);
  if (!moduleData?.enabled) {
    throw new Error("Radar no está habilitado para esta empresa.");
  }

  const currentSettings = objectSettings(moduleData.settings);
  const currentPreferences = parseRadarPreferences(currentSettings);
  if (input.publishingMode === "automatic" && !currentPreferences.siteIntegrated) {
    throw new Error("La publicación automática requiere que NexOps conecte el sitio.");
  }

  const { error } = await adminClient
    .from("company_modules")
    .update({
      settings: {
        ...currentSettings,
        topics: input.topics,
        publicationsPerWeek: input.publicationsPerWeek,
        opportunityBehavior: input.opportunityBehavior,
        publishingMode: input.publishingMode,
      },
    })
    .eq("company_id", input.companyId)
    .eq("module", "radar")
    .eq("enabled", true)
    .select("company_id")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...currentPreferences,
    topics: input.topics,
    publicationsPerWeek: input.publicationsPerWeek,
    opportunityBehavior: input.opportunityBehavior,
    publishingMode: input.publishingMode,
  };
}
