import { redirect } from "next/navigation";

type CompaniesPageProps = {
  searchParams: Promise<{ actor?: string }>;
};

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const { actor } = await searchParams;
  redirect(actor ? `/backoffice?actor=${encodeURIComponent(actor)}` : "/backoffice");
}
