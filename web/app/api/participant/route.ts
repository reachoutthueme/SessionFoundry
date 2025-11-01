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

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") || "").toString().trim();
    if (!session_id) {
      const res = NextResponse.json({ error: "session_id required" }, { status: 400 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      const res = NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const body = await req.json().catch(() => ({} as any));
    const rawName = String(body?.display_name ?? "").trim();
    const display_name = rawName ? (rawName.length <= 64 ? rawName : rawName.slice(0, 64)) : null;

    // Read participant cookie bound to this session
    const pid = req.cookies.get(`sf_pid_${session_id}`)?.value;
    if (!pid) {
      const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .update({ display_name })
      .eq("id", pid)
      .eq("session_id", session_id)
      .select("id, session_id, display_name, group_id")
      .maybeSingle();

    if (error || !data) {
      const res = NextResponse.json({ error: error?.message || "Failed to update" }, { status: 500 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const res = NextResponse.json({ participant: data });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    const res = NextResponse.json({ error: "Server error" }, { status: 500 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
}
