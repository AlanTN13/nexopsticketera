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

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirectToInvitationError(request);
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectToInvitationError(request);
    }
  } catch {
    return redirectToInvitationError(request);
  }

  const redirectUrl = new URL("/portal", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
