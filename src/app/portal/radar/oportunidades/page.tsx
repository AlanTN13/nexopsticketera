import { RadarProductPage } from "@/components/radar/radar-product-page";

export const dynamic = "force-dynamic";

type OpportunitiesPageProps = {
  searchParams: Promise<{ estado?: string; company?: string }>;
};

export default async function RadarOpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const { estado, company } = await searchParams;
  const filter = estado === "pending" || estado === "published" || estado === "discarded" ? estado : "all";
  return <RadarProductPage view="opportunities" opportunityFilter={filter} companyLookup={company} />;
}
