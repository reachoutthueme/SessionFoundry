import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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

  // participant cookie and group
  const cookieStore = await cookies();
  const pid = session_id ? cookieStore.get(`sf_pid_${session_id}`)?.value : undefined;
  const voter_id = pid || "anon";
  let group_id: string | null = null;
  if (pid) {
    const { data: p } = await supabaseAdmin
      .from("participants")
      .select("group_id")
      .eq("id", pid)
      .maybeSingle();
    group_id = p?.group_id ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("votes")
    .insert({ activity_id, submission_id, value, voter_id, group_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vote: data }, { status: 201 });
}

