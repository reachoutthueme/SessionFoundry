import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session_id = (url.searchParams.get("session_id") || "").toString().trim();

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // Read participant cookie directly from the request
  const pid = req.cookies.get(`sf_pid_${session_id}`)?.value;

  // If no participant cookie, don’t leak anything—just say null
  if (!pid) {
    const res = NextResponse.json({ participant: null });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id")
    .eq("id", pid)
    .eq("session_id", session_id)
    .maybeSingle();

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json({ participant: data ?? null });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}