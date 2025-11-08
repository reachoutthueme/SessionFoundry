import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

// GET /api/sessions/recent?limit=6
// Returns the user's recently viewed/edited sessions. If the
// recent_sessions table is unavailable, gracefully falls back
// to latest created sessions ordered by created_at desc.
export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ sessions: [] });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 6), 1), 20);

  // Try reading from recent_sessions (if present)
  try {
    // Join with sessions to fetch display fields
    const { data, error } = await supabaseAdmin
      .from("recent_sessions")
      .select(
        "session_id,last_viewed_at, sessions!inner (id,name,status,join_code,created_at)"
      )
      .eq("user_id", user.id)
      .order("last_viewed_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const sessions = (data ?? []).map((r: any) => ({
      id: String(r.sessions.id),
      name: String(r.sessions.name || "Untitled"),
      status: String(r.sessions.status || "Inactive"),
      join_code: String(r.sessions.join_code || ""),
      created_at: String(r.sessions.created_at || new Date().toISOString()),
      last_viewed_at: String(r.last_viewed_at || r.sessions.created_at),
    }));

    // Enrich counts with two aggregate queries instead of per-session head counts
    const sessionIds = sessions.map((s) => s.id);
    let bySessionParticipants = new Map<string, number>();
    let bySessionActivities = new Map<string, number>();

    if (sessionIds.length > 0) {
      try {
        // Note: This selects rows and aggregates in memory. For very large tables,
        // prefer a Postgres view or RPC to return grouped counts instead.
        const [partsRes, actsRes] = await Promise.all([
          supabaseAdmin
            .from("participants")
            .select("session_id")
            .in("session_id", sessionIds),
          supabaseAdmin
            .from("activities")
            .select("session_id")
            .in("session_id", sessionIds),
        ]);

        if (!partsRes.error && Array.isArray(partsRes.data)) {
          partsRes.data.forEach((row: any) => {
            const sid = String(row.session_id || "");
            if (!sid) return;
            bySessionParticipants.set(sid, (bySessionParticipants.get(sid) || 0) + 1);
          });
        }
        if (!actsRes.error && Array.isArray(actsRes.data)) {
          actsRes.data.forEach((row: any) => {
            const sid = String(row.session_id || "");
            if (!sid) return;
            bySessionActivities.set(sid, (bySessionActivities.get(sid) || 0) + 1);
          });
        }
      } catch {
        // ignore aggregation errors; keep zeros
      }
    }

    const withCounts = sessions.map((s) => ({
      ...s,
      participants: bySessionParticipants.get(s.id) || 0,
      activities: bySessionActivities.get(s.id) || 0,
    }));

    const res = NextResponse.json({ sessions: withCounts });
    res.headers.set("Cache-Control", "private, max-age=10, s-maxage=0");
    res.headers.set("X-Recent-Mode", "server");
    return res;
  } catch (e) {
    // Fall back to the latest sessions if recent_sessions isn't available
    try {
      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("id,name,status,join_code,created_at")
        .eq("facilitator_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const sessions = (data ?? []).map((s: any) => ({
        id: String(s.id),
        name: String(s.name || "Untitled"),
        status: String(s.status || "Inactive"),
        join_code: String(s.join_code || ""),
        created_at: String(s.created_at || new Date().toISOString()),
        last_viewed_at: String(s.created_at || new Date().toISOString()),
      }));

      const res = NextResponse.json({ sessions });
      res.headers.set("Cache-Control", "private, max-age=10, s-maxage=0");
      res.headers.set("X-Recent-Mode", "fallback_latest");
      return res;
    } catch (e2) {
      // Last resort: empty
      const res = NextResponse.json({ sessions: [] });
      res.headers.set("X-Recent-Mode", "disabled");
      return res;
    }
  }
}
