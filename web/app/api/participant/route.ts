import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });
  const cookieStore = await cookies();
  const pid = cookieStore.get(`sf_pid_${session_id}`)?.value;
  if (!pid) return NextResponse.json({ participant: null });
  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id")
    .eq("id", pid)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ participant: data });
}
