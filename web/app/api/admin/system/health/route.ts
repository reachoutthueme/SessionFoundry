import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  // Admin auth via access token cookie
  if (!isSupabaseAdminConfigured()) {
    return noStore(NextResponse.json({ error: "Admin backend not configured" }, { status: 500 }));
  }
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  if (!isAdminUser({ id: data.user.id, email: data.user.email ?? null })) {
    return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  try {
    // Quick DB connectivity checks
    const checks: Record<string, boolean> = {};
    const tables = ["sessions", "activities", "submissions"] as const;
    await Promise.all(
      tables.map(async (t) => {
        const { error: e } = await supabaseAdmin.from(t as any).select("id", { head: true, count: "exact" }).limit(1);
        checks[t] = !e;
      })
    );

    // Totals (best-effort). Avoid heavy scans by using count: exact with no filter
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

    return noStore(
      NextResponse.json({
        db_checks: checks,
        totals,
        env,
        ts: new Date().toISOString(),
      })
    );
  } catch (e: any) {
    return noStore(NextResponse.json({ error: e?.message || "Health check failed" }, { status: 500 }));
  }
}
