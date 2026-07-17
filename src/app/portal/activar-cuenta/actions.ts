"use server";

import { redirect } from "next/navigation";

import { getPasswordValidationError } from "@/lib/account-activation";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type AccountActivationState = {
  error: string | null;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function activateAccountAction(
  _previousState: AccountActivationState,
  formData: FormData,
): Promise<AccountActivationState> {
  const password = getString(formData, "password");
  const confirmation = getString(formData, "confirmation");
  const validationError = getPasswordValidationError(password, confirmation);

  if (validationError) {
    return { error: validationError };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !data.user) {
    redirect("/portal/login?reason=invite");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      error: "No pudimos guardar esa contraseña. Probá con otra más segura.",
    };
  }

  redirect("/portal?success=Cuenta%20activada%20correctamente.");
}
