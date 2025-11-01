import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getParticipantInSession } from "@/app/api/_util/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") || "").trim();
    if (!session_id) {
      const res = NextResponse.json({ error: "session_id required" }, { status: 400 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    // Must be a participant in this session
    const participant = await getParticipantInSession(req, session_id);
    if (!participant) {
      const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, session_id, display_name, group_id, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (error) {
      const res = NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    const res = NextResponse.json({ participants: data ?? [] });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    const res = NextResponse.json({ error: "Server error" }, { status: 500 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
}

