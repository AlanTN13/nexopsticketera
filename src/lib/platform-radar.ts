import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedInternalActor } from "@/lib/auth";
import { canAccessPlatformRadar } from "@/lib/authorization";
import { buildRadarProductModel } from "@/lib/radar-product";
import { parseRadarPreferences } from "@/lib/radar-preferences";
import { discoverPlatformRadarWorkspaceId, loadRadarWorkspace } from "@/lib/radar-workspace";

export function getPlatformRadarWorkspaceId() {
  const configured = process.env.RADAR_PLATFORM_WORKSPACE_ID;
  if (configured === undefined || configured.trim() === "") return null;
  const value = configured.trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(value)) {
    throw new Error("RADAR_PLATFORM_WORKSPACE_ID tiene un formato inválido.");
  }
  return value;
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
