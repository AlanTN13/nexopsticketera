import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseAdminConfigured() {
  return Boolean(isSupabaseConfigured() && SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado.");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function getSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para operaciones administrativas.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
