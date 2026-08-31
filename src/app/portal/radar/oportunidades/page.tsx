import { RadarProductPage } from "@/components/radar/radar-product-page";

export const dynamic = "force-dynamic";

type OpportunitiesPageProps = {
  searchParams: Promise<{ estado?: string }>;
};

export default async function RadarOpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const { estado } = await searchParams;
  const filter = estado === "published" || estado === "discarded" ? estado : "all";
  return <RadarProductPage view="opportunities" opportunityFilter={filter} />;
}
