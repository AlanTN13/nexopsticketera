import "server-only";

import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedActor } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/authorization";
import { getPlatformRadarWorkspaceId } from "@/lib/platform-radar";
import { getRadarWorkspaceId } from "@/lib/portal-modules";
import { discoverPlatformRadarWorkspaceId } from "@/lib/radar-workspace";
import type { ModuleAccessLevel } from "@/lib/ticketing";

export async function requireRadarWorkspaceAccess(
  workspaceId: string,
  required: Exclude<ModuleAccessLevel, "none">,
) {
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (!actor) throw new Error("Tu sesión no es válida o venció.");

  if (actor.role === "platform_admin") {
    const platformWorkspaceId = getPlatformRadarWorkspaceId() ?? await discoverPlatformRadarWorkspaceId();
    if (workspaceId === platformWorkspaceId) return { actor, company: null };
  }

  const company = db.companies.find(
    (item) => getRadarWorkspaceId(item) === workspaceId && hasModuleAccess(actor, item, "radar", required),
  );
  if (!company) throw new Error("No tenés permiso para operar este workspace de Radar.");
  return { actor, company };
}
