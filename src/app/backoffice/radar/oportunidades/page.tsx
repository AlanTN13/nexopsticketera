import { PlatformRadarPage } from "@/components/radar/platform-radar-page";

export const dynamic = "force-dynamic";

export default async function BackofficeRadarOpportunitiesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const filter = estado === "published" || estado === "discarded" ? estado : "all";
  return <PlatformRadarPage view="opportunities" opportunityFilter={filter} />;
}
