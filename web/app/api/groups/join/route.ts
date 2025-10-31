import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const session_id = (body?.session_id ?? "").toString();
  const group_id = (body?.group_id ?? "").toString();
  if (!session_id || !group_id) return NextResponse.json({ error: "session_id and group_id required" }, { status: 400 });

  // Require participant cookie; do not allow overriding participant_id in body
  const participant = await getParticipantInSession(req, session_id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ensure participant belongs to session
  const { data: part, error: pe } = await supabaseAdmin
    .from("participants")
    .select("id, session_id, display_name, group_id")
    .eq("id", participant.id)
    .maybeSingle();
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  if (!part || part.session_id !== session_id) {
    return NextResponse.json({ error: "participant/session mismatch" }, { status: 400 });
  }

  const sStatus = await getSessionStatus(session_id);
  if (sStatus !== 'Active') return NextResponse.json({ error: "Session not accepting group changes" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("participants")
    .update({ group_id })
    .eq("id", participant.id)
    .select("id, session_id, display_name, group_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ participant: data });
}
