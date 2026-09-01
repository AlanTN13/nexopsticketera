import { RadarProductPage } from "@/components/radar/radar-product-page";

export const dynamic = "force-dynamic";

export default async function RadarStrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; company?: string }>;
}) {
  const { saved, company } = await searchParams;
  return <RadarProductPage view="strategy" saved={saved === "1"} companyLookup={company} />;
}
