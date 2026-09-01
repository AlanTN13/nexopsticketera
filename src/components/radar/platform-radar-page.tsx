import { RadarProductScreen } from "@/components/radar/radar-product-page";
import type { RadarView } from "@/components/radar/radar-shell";
import { getPlatformRadarContext } from "@/lib/platform-radar";

export async function PlatformRadarPage({
  view,
  opportunityFilter = "all",
}: {
  view: Exclude<RadarView, "strategy">;
  opportunityFilter?: "all" | "published" | "discarded";
}) {
  const context = await getPlatformRadarContext();
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
        model: context.model,
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
