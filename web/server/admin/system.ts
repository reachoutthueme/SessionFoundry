import "server-only";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";

export type SystemHealth = {
  db_checks: Record<string, boolean>;
  totals: Record<string, number>;
  env: Record<string, boolean>;
  ts: string;
};

export async function getSystemHealth(): Promise<SystemHealth> {
  if (!isSupabaseAdminConfigured()) {
    return {
      db_checks: {},
      totals: {},
      env: {
        SUPABASE_URL: !!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
        ADMIN_USER_ID: !!process.env.ADMIN_USER_ID,
      },
      ts: new Date().toISOString(),
    };
  }

  const checks: Record<string, boolean> = {};
  const tables = ["sessions", "activities", "submissions"] as const;
  await Promise.all(
    tables.map(async (t) => {
      const { error: e } = await supabaseAdmin.from(t as any).select("id", { head: true, count: "exact" }).limit(1);
      checks[t] = !e;
    })
  );

  const totals: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await supabaseAdmin.from(t as any).select("id", { head: true, count: "exact" });
    totals[t] = Number(count || 0);
  }

  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
    ADMIN_USER_ID: !!process.env.ADMIN_USER_ID,
  };

  return { db_checks: checks, totals, env, ts: new Date().toISOString() };
}

