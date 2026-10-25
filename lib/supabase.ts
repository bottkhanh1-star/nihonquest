import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gzsvingppjnnjizevdmd.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MgxQMeMYgFj4MXCZnGQS0g_Tg5J6OGt";

/**
 * Global singleton Supabase client for client-side storage, uploads, and auth.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

