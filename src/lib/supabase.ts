import { createClient } from "@supabase/supabase-js";

let client:
  | ReturnType<typeof createClient<Record<string, never>>>
  | null = null;

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return client;
}
