import { redirect } from "next/navigation";

import { consumeMetaAuthorizationState, saveMetaAuthorizationResult } from "@/lib/content-store";
import { exchangeMetaCode, listManagedInstagramAccounts } from "@/lib/meta-instagram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");
  if (denied || !state || !code) {
    redirect("/portal/contenido/fuentes?error=Meta%20no%20complet%C3%B3%20la%20autorizaci%C3%B3n");
  }

  try {
    await consumeMetaAuthorizationState(state);
    const token = await exchangeMetaCode(code, `${url.origin}/api/meta/instagram/callback`);
    const accounts = await listManagedInstagramAccounts(token.access_token);
    const result = await saveMetaAuthorizationResult({
      accounts,
      userExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    });
    redirect(result === "connected"
      ? "/portal/contenido/fuentes?success=Cuenta%20oficial%20conectada"
      : "/portal/contenido/fuentes?success=Eleg%C3%AD%20la%20cuenta%20profesional%20que%20quer%C3%A9s%20usar");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No pudimos completar la autorización de Meta.";
    redirect(`/portal/contenido/fuentes?error=${encodeURIComponent(message)}`);
  }
}
