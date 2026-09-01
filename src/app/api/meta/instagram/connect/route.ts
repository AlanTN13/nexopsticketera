import { redirect } from "next/navigation";

import { createMetaAuthorization } from "@/lib/content-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const companyLookup = new URL(request.url).searchParams.get("company") ?? undefined;
  try {
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
    if (!redirectUri) throw new Error("META_OAUTH_REDIRECT_URI todavía no está configurado.");
    const authorizationUrl = await createMetaAuthorization(redirectUri, companyLookup);
    redirect(authorizationUrl);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No pudimos iniciar la autorización de Meta.";
    const company = companyLookup ? `&company=${encodeURIComponent(companyLookup)}` : "";
    redirect(`/portal/contenido/fuentes?error=${encodeURIComponent(message)}${company}`);
  }
}
