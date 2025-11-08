// app/lib/supabaseAdmin.ts (safe, lazy-ish init)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Accept either SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (for flexibility)
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
if (url && serviceKey) {
  try {
    client = createClient(url, serviceKey, { auth: { persistSession: false } });
  } catch {
    client = null;
  }
}

export const supabaseAdmin = client as unknown as SupabaseClient;
export function isSupabaseAdminConfigured(): boolean {
  return !!client;
}
