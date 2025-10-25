// app/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// Accept either SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (for flexibility)
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Supabase admin client not configured. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local and restart dev server."
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
