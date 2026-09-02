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
        model: mergeRadarPendingRuns(context.model, controlPlane.runs),
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
