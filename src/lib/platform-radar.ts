import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { buildRadarProductModel } from "@/lib/radar-product";
import { parseRadarPreferences } from "@/lib/radar-preferences";
import { discoverPlatformRadarWorkspaceId, loadRadarWorkspace } from "@/lib/radar-workspace";
import type { UserProfile } from "@/lib/ticketing";

export function getPlatformRadarWorkspaceId() {
  const value = process.env.RADAR_PLATFORM_WORKSPACE_ID?.trim() ?? "";
  return /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(value) ? value : null;
}

export function canAccessPlatformRadar(actor: UserProfile) {
  return actor.status === "active" && actor.role === "platform_admin";
}

export const getPlatformRadarContext = cache(async () => {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedInternalActor(db);
  if (!actor) redirect("/portal/login?reason=session");
  if (!canAccessPlatformRadar(actor)) redirect("/backoffice/queue?reason=radar");

  const workspaceId = getPlatformRadarWorkspaceId() ?? await discoverPlatformRadarWorkspaceId();
  const workspace = await loadRadarWorkspace(workspaceId, fetch, true);

  let configuredPreferences: unknown = {};
  try {
    configuredPreferences = JSON.parse(process.env.RADAR_PLATFORM_PREFERENCES ?? "{}");
  } catch {
    configuredPreferences = {};
  }

  return {
    actor,
    workspace,
    model: buildRadarProductModel(workspace),
    preferences: parseRadarPreferences(configuredPreferences),
  };
});
