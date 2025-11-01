import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

type SessionRow = {
  id: string;
  name: string;
  status: "Draft" | "Active" | "Completed" | string;
  join_code: string;
  created_at: string;
};

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      // If your UI expects empty response instead of 401, swap to:
      // return NextResponse.json({ sessions: [], stats: { participants: 0, brainstorm: 0, stocktake: 0 } });
      return noStore(NextResponse.json({ error: "Sign in required" }, { status: 401 }));
    }

    // Optional: simple pagination from query params
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 50), 200));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    // Fetch sessions for this facilitator
    const { data: sessions, error: se } = await supabaseAdmin
      .from("sessions")
      .select("id,name,status,join_code,created_at")
      .eq("facilitator_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<SessionRow[]>();

    if (se) {
      console.error("sessions fetch error", se);
      return noStore(NextResponse.json({ error: "Failed to load sessions" }, { status: 500 }));
    }

    const sessionIds = (sessions ?? []).map((s) => s.id);
    let participants = 0;
    let brainstorm = 0;
    let stocktake = 0;

    if (sessionIds.length > 0) {
      // Count participants without fetching rows
      const { count: pCount, error: pErr } = await supabaseAdmin
        .from("participants")
        .select("id", { count: "exact", head: true })
        .in("session_id", sessionIds);
      if (pErr) {
        console.error("participants count error", pErr);
      } else if (typeof pCount === "number") {
        participants = pCount;
      }

      // Count activities by type without fetching rows
      const [{ count: bCount, error: bErr }, { count: sCount, error: sErr }] = await Promise.all([
        supabaseAdmin
          .from("activities")
          .select("id", { count: "exact", head: true })
          .in("session_id", sessionIds)
          .eq("type", "brainstorm"),
        supabaseAdmin
          .from("activities")
          .select("id", { count: "exact", head: true })
          .in("session_id", sessionIds)
          .eq("type", "stocktake"),
      ]);

      if (bErr) console.error("activities brainstorm count error", bErr);
      if (sErr) console.error("activities stocktake count error", sErr);

      brainstorm = typeof bCount === "number" ? bCount : 0;
      stocktake = typeof sCount === "number" ? sCount : 0;
    }

    // Short private cache (safe) or switch to no-store if you prefer
    const res = NextResponse.json({
      sessions: sessions ?? [],
      stats: { participants, brainstorm, stocktake },
      paging: { limit, offset, returned: sessions?.length ?? 0 },
    });
    res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res;
  } catch (e) {
    console.error("GET /api/sessions error", e);
    return noStore(NextResponse.json({ error: "Server error" }, { status: 500 }));
  }
}