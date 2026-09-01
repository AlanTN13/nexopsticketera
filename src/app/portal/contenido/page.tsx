import { redirect } from "next/navigation";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  redirect(`/portal/contenido/fuentes${params.company ? `?company=${encodeURIComponent(params.company)}` : ""}`);
}
