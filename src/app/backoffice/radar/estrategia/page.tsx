import { PlatformRadarOperationPage, type RadarHistoryFilters } from "@/components/radar/radar-operation-page";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export default async function RadarRoute({ searchParams }: { searchParams: Promise<RadarHistoryFilters> }) {
  return <PlatformRadarOperationPage basePath="/backoffice/radar" view="configuration" filters={await searchParams} />;
}
