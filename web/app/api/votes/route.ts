import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const submission_id = (body?.submission_id ?? "").toString();
  const value = Number(body?.value);
  let activity_id = (body?.activity_id ?? "").toString();
  const session_id = (body?.session_id ?? "").toString();

  if (!submission_id || Number.isNaN(value)) {
    return NextResponse.json({ error: "submission_id and numeric value required" }, { status: 400 });
  }
  if (value < 1 || value > 10) {
    return NextResponse.json({ error: "value must be 1-10" }, { status: 400 });
  }

  if (!activity_id && session_id) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", session_id)
      .eq("type", "brainstorm")
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    activity_id = acts?.[0]?.id ?? "";
  }

  if (!activity_id) {
    return NextResponse.json({ error: "activity_id or session_id required" }, { status: 400 });
  }

  // participant from cookie (required) and group
  const participant = await getParticipantInSession(req, session_id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const voter_id = participant.id;
  let group_id: string | null = participant.group_id ?? null;

  // session must be Active for voting
  const sStatus = await getSessionStatus(session_id);
  if (sStatus !== 'Active') return NextResponse.json({ error: "Session not accepting votes" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("votes")
    .insert({ activity_id, submission_id, value, voter_id, group_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vote: data }, { status: 201 });
}

