import { isSupabaseConfigured } from "@/lib/supabase";
import { isSupabaseAdminConfigured } from "@/lib/supabase-server";

export type BackendMode = "demo" | "supabase";

let warnedAboutPartialSupabaseConfig = false;

export function getBackendMode(): BackendMode {
  if (isSupabaseAdminConfigured()) {
    return "supabase";
  }

  if (isSupabaseConfigured() && !warnedAboutPartialSupabaseConfig) {
    warnedAboutPartialSupabaseConfig = true;
    console.warn(
      "Supabase public credentials are configured but SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to demo mode to avoid a hybrid backend.",
    );
  }

  return "demo";
}

export function isSupabaseBackend() {
  return getBackendMode() === "supabase";
}

export function isDemoBackend() {
  return getBackendMode() === "demo";
}
