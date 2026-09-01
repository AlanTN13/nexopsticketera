import { RadarProductPage } from "@/components/radar/radar-product-page";

export const dynamic = "force-dynamic";

export default async function RadarPublishedPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { company } = await searchParams;
  return <RadarProductPage view="published" companyLookup={company} />;
}
