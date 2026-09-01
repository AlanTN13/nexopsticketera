import { getAppSnapshot } from "@/lib/app-store";
import { getAuthenticatedActor } from "@/lib/auth";
import { PlatformRadarOperationPage, RadarOperationPage } from "@/components/radar/radar-operation-page";

export const dynamic = "force-dynamic";

export default async function PortalRadarOperationRoute({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company } = await searchParams;
  const db = await getAppSnapshot();
  const actor = await getAuthenticatedActor(db);
  if (actor?.role === "platform_admin" && !company) return <PlatformRadarOperationPage />;
  return <RadarOperationPage companyLookup={company} />;
}
