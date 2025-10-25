import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ participants: [] });
  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id, created_at")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ participants: data ?? [] });
}

