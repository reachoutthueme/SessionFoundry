import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activity_id = url.searchParams.get("activity_id");
  const session_id = url.searchParams.get("session_id");
  if (!activity_id || !session_id) return NextResponse.json({ error: "activity_id and session_id required" }, { status: 400 });
  const participant = await getParticipantInSession(req, session_id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("stocktake_responses")
    .select("initiative_id, choice")
    .eq("activity_id", activity_id)
    .eq("participant_id", participant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ responses: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const activity_id = (body?.activity_id ?? "").toString();
  const initiative_id = (body?.initiative_id ?? "").toString();
  const choice = (body?.choice ?? "").toString();
  const session_id = (body?.session_id ?? "").toString();
  if (!activity_id || !initiative_id || !choice) return NextResponse.json({ error: "activity_id, initiative_id, choice required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });
  const participant = await getParticipantInSession(req, session_id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const participant_id = participant.id;

  const sStatus = await getSessionStatus(session_id);
  if (sStatus !== 'Active') return NextResponse.json({ error: "Session not accepting responses" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("stocktake_responses")
    .insert({ activity_id, initiative_id, choice, participant_id })
    .select("id, activity_id, initiative_id, choice, participant_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data }, { status: 201 });
}
