import { redirect } from "next/navigation";

import { createMetaAuthorization } from "@/lib/content-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const authorizationUrl = await createMetaAuthorization(`${origin}/api/meta/instagram/callback`);
    redirect(authorizationUrl);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No pudimos iniciar la autorización de Meta.";
    redirect(`/portal/contenido/fuentes?error=${encodeURIComponent(message)}`);
  }
}
