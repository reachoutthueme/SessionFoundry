import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/app/lib/supabaseAdmin";
import { isAdminUser } from "@/server/policies";

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  // Auth via access token cookie
  if (!isSupabaseAdminConfigured()) {
    return noStore(NextResponse.json({ error: "Admin backend not configured" }, { status: 500 }));
  }
  const store = await cookies();
  const token = store.get("sf_at")?.value || "";
  if (!token) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  const user = { id: data.user.id, email: data.user.email ?? null };
  if (!isAdminUser(user)) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();

  // Helpers for count-only queries
  async function count(from: string, table: string, filters: (q: any) => any = (q) => q) {
    let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true }).gte("created_at", from);
    q = filters(q);
    const { count: c } = await q;
    return Number(c || 0);
  }

  try {
    const [sessions7, sessions28, completed28, participants28, submissions28] = await Promise.all([
      count(d7, "sessions"),
      count(d28, "sessions"),
      count(d28, "sessions", (q) => q.eq("status", "Completed")),
      count(d28, "participants"),
      count(d28, "submissions"),
    ]);

    const completionRate28 = sessions28 > 0 ? completed28 / sessions28 : 0;
    const avgParticipantsPerSession28 = sessions28 > 0 ? participants28 / sessions28 : 0;
    const avgSubmissionsPerSession28 = sessions28 > 0 ? submissions28 / sessions28 : 0;

    // Basic DB health check: quick head query
    const { error: healthErr } = await supabaseAdmin
      .from("sessions")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    return noStore(
      NextResponse.json({
        kpis: {
          sessions_last_7d: sessions7,
          sessions_last_28d: sessions28,
          completion_rate_28d: completionRate28,
          avg_participants_per_session_28d: avgParticipantsPerSession28,
          avg_submissions_per_session_28d: avgSubmissionsPerSession28,
        },
        health: {
          db_ok: !healthErr,
          env: {
            supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabase_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          },
        },
      })
    );
  } catch (e: any) {
    return noStore(NextResponse.json({ error: e?.message || "Failed to load metrics" }, { status: 500 }));
  }
}
