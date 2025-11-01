import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession } from "@/app/api/_util/auth";

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session_id = (url.searchParams.get("session_id") || "").trim();

  // basic validation
  if (!session_id || !isUUID(session_id)) {
    return NextResponse.json(
      { error: "Valid session_id (UUID) required" },
      { status: 400 }
    );
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    const res = NextResponse.json({ error: "Sign in required" }, { status: 401 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // authZ (cloak on miss)
  const owns = await userOwnsSession(user.id, session_id);
  if (!owns) {
    const res = NextResponse.json({ error: "Not found" }, { status: 404 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // pagination params
  const limitParam = url.searchParams.get("limit");
  const sinceParam = url.searchParams.get("since"); // ISO 8601 optional
  let limit = Number(limitParam ?? 100);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 500) limit = 500;

  // base query
  let query = supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id, created_at")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true })
    .limit(limit);

  // incremental fetch support: ?since=2025-01-01T00:00:00.000Z
  if (sinceParam) {
    const since = new Date(sinceParam);
    if (!isNaN(since.getTime())) {
      // Supabase uses .gt on columns for keyset-ish pagination
      query = query.gt("created_at", since.toISOString());
    }
  }

  const { data, error } = await query;

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json({
    participants: data ?? [],
    page: {
      limit,
      since: sinceParam || null,
      count: (data ?? []).length,
    },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}