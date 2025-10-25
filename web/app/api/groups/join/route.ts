import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const session_id = (body?.session_id ?? "").toString();
  const group_id = (body?.group_id ?? "").toString();
  const participant_id_body = (body?.participant_id ?? "").toString();
  if (!session_id || !group_id) return NextResponse.json({ error: "session_id and group_id required" }, { status: 400 });

  // Prefer cookie, but allow explicit participant_id fallback
  const cookieStore = await cookies();
  const pid = cookieStore.get(`sf_pid_${session_id}`)?.value || participant_id_body;
  if (!pid) return NextResponse.json({ error: "participant not identified" }, { status: 401 });

  // Ensure participant belongs to session
  const { data: part, error: pe } = await supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id")
    .eq("id", pid)
    .maybeSingle();
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  if (!part || part.session_id !== session_id) {
    return NextResponse.json({ error: "participant/session mismatch" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("participants")
    .update({ group_id })
    .eq("id", pid)
    .select("id, session_id, display_name, group_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ participant: data });
}
