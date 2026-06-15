import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * True only when real Supabase credentials are configured. The public Tragon
 * Bots pages (Lab, Hatchery, Leaderboard) work fully without auth, so we fall
 * back to a harmless placeholder URL to keep `createClient` from throwing at
 * build/runtime when env vars are absent.
 */
export const isSupabaseConfigured = supabaseUrl !== "" && supabaseAnonKey !== "";

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
