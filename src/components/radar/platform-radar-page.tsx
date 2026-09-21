import { getRadarAdmission } from "@/lib/radar-admission";
import { RadarProductScreen } from "@/components/radar/radar-product-page";
import type { RadarView } from "@/components/radar/radar-shell";
import { loadRadarControlPlane } from "@/lib/radar-control-plane-store";
import { mergeRadarPendingRuns } from "@/lib/radar-product";
import { getPlatformRadarContext } from "@/lib/platform-radar";

export async function PlatformRadarPage({
  view,
  opportunityFilter = "all",
}: {
  view: Exclude<RadarView, "strategy" | "operation">;
  opportunityFilter?: "all" | "pending" | "published" | "discarded";
}) {
  const context = await getPlatformRadarContext();
  const admission = await getRadarAdmission(context.workspace.workspaceId);
  const controlPlane = await loadRadarControlPlane(context.workspace.workspaceId);
  return (
    <RadarProductScreen
      view={view}
      opportunityFilter={opportunityFilter}
      context={{
        actorName: context.actor.name,
        actorId: context.actor.id,
        companyName: "NexOps · cuenta madre",
        companyId: "",
        workspaceId: context.workspace.workspaceId,
        model: { ...mergeRadarPendingRuns(context.model, controlPlane.runs), health: { state: "limited", label: admission.allowed ? "Búsqueda disponible" : "Búsqueda no disponible", detail: admission.message } },
        preferences: context.preferences,
        canManagePreferences: false,
        exitHref: "/backoffice/queue",
        exitLabel: "Volver al backoffice",
        basePath: "/backoffice/radar",
        strategyAvailable: false,
      }}
    />
  );
}
