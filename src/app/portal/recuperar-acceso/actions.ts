"use server";

import { validEmail } from "@/lib/notification-events";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type PasswordRecoveryRequestState = {
  error: string | null;
  submitted: boolean;
};

function getEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

export async function requestPasswordRecoveryAction(
  _previousState: PasswordRecoveryRequestState,
  formData: FormData,
): Promise<PasswordRecoveryRequestState> {
  const email = getEmail(formData);
  if (email.length > 254 || !validEmail(email)) {
    return { error: "Ingresá un email válido.", submitted: false };
  }

  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return {
      error: "La recuperación no está disponible en este momento. Contactá a NexOps.",
      submitted: false,
    };
  }

  const callbackUrl = new URL("/auth/callback", appUrl);
  callbackUrl.searchParams.set("next", "/portal/restablecer-acceso");

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl.toString(),
    });

    if (error) {
      return {
        error: "No pudimos iniciar la recuperación. Esperá unos minutos e intentá nuevamente.",
        submitted: false,
      };
    }
  } catch {
    return {
      error: "No pudimos iniciar la recuperación. Esperá unos minutos e intentá nuevamente.",
      submitted: false,
    };
  }

  return { error: null, submitted: true };
}
