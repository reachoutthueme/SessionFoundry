import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const activity_id = url.searchParams.get("activity_id");
  const session_id = url.searchParams.get("session_id");
  if (!activity_id || !session_id) return NextResponse.json({ responses: [] });
  const cookieStore = await cookies();
  const pid = cookieStore.get(`sf_pid_${session_id}`)?.value;
  if (!pid) return NextResponse.json({ responses: [] });
  const { data, error } = await supabaseAdmin
    .from("stocktake_responses")
    .select("initiative_id, choice")
    .eq("activity_id", activity_id)
    .eq("participant_id", pid);
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

  const cookieStore = await cookies();
  const pid = session_id ? cookieStore.get(`sf_pid_${session_id}`)?.value : undefined;
  const participant_id = pid || "anon";

  const { data, error } = await supabaseAdmin
    .from("stocktake_responses")
    .insert({ activity_id, initiative_id, choice, participant_id })
    .select("id, activity_id, initiative_id, choice, participant_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data }, { status: 201 });
}
