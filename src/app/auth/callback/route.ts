import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function redirectToInvitationError(request: NextRequest) {
  const redirectUrl = new URL("/portal/login", request.url);
  redirectUrl.searchParams.set("reason", "invite");

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectToRecoveryError(request: NextRequest) {
  const redirectUrl = new URL("/portal/login", request.url);
  redirectUrl.searchParams.set("reason", "recovery");

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectWithoutCaching(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash || type) {
    if (!tokenHash || type !== "invite") {
      return redirectToInvitationError(request);
    }

    try {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "invite",
      });

      if (error) {
        return redirectToInvitationError(request);
      }
    } catch {
      return redirectToInvitationError(request);
    }

    return redirectWithoutCaching(new URL("/portal/activar-cuenta", request.url));
  }

  if (code || next) {
    if (!code || next !== "/portal/restablecer-acceso") {
      return redirectToRecoveryError(request);
    }

    try {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return redirectToRecoveryError(request);
      }
    } catch {
      return redirectToRecoveryError(request);
    }

    return redirectWithoutCaching(new URL(next, request.url));
  }

  return redirectToInvitationError(request);
}
