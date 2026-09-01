import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
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
  const client = await getSupabaseServerClient();
  const { data: moduleData, error: moduleError } = await client
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

  const { error } = await client.rpc("update_radar_preferences", {
    target_company_id: input.companyId,
    radar_topics: input.topics,
    radar_publications_per_week: input.publicationsPerWeek,
    radar_opportunity_behavior: input.opportunityBehavior,
    radar_publishing_mode: input.publishingMode,
  });

  if (error) throw new Error(error.message);

  return {
    ...currentPreferences,
    topics: input.topics,
    publicationsPerWeek: input.publicationsPerWeek,
    opportunityBehavior: input.opportunityBehavior,
    publishingMode: input.publishingMode,
  };
}
