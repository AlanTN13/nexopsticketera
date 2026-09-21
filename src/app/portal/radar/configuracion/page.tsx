import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedActor } from "@/lib/auth";
import { PlatformRadarOperationPage, RadarOperationPage, type RadarHistoryFilters } from "@/components/radar/radar-operation-page";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export default async function RadarRoute({ searchParams }: { searchParams: Promise<RadarHistoryFilters & { company?: string }> }) {
  const { company, ...filters } = await searchParams;
  const actor = await getAuthenticatedActor(await getAppSnapshot());
  if (actor?.role === "platform_admin" && !company) return <PlatformRadarOperationPage view="configuration" filters={filters} />;
  return <RadarOperationPage companyLookup={company} view="configuration" filters={filters} />;
}
