import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// GET supports activity_id or resolves latest Active/Voting brainstorm activity by session_id
export async function GET(req: Request) {
  const url = new URL(req.url);
  const activityId = url.searchParams.get("activity_id");
  const sessionId = url.searchParams.get("session_id");

  let resolvedActivity: string | null = activityId;
  if (!resolvedActivity && sessionId) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", sessionId)
      .eq("type", "brainstorm")
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    resolvedActivity = acts?.[0]?.id ?? null;
  }

  if (!resolvedActivity) return NextResponse.json({ submissions: [] });

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("id,text,created_at")
    .eq("activity_id", resolvedActivity)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

// POST accepts activity_id, or session_id (resolves latest Active/Voting brainstorm activity)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = (body?.text ?? "").toString().trim();
  let activity_id = (body?.activity_id ?? "").toString();
  let session_id = (body?.session_id ?? "").toString();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

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
  if (!activity_id) return NextResponse.json({ error: "activity_id or session_id required" }, { status: 400 });

  // Resolve session_id from activity if not provided
  if (!session_id) {
    const { data: act0 } = await supabaseAdmin
      .from("activities")
      .select("session_id")
      .eq("id", activity_id)
      .maybeSingle();
    session_id = (act0 as any)?.session_id || session_id;
  }

  // participant + group from cookie
  const cookieStore = await cookies();
  const pid = session_id ? cookieStore.get(`sf_pid_${session_id}`)?.value : undefined;
  const participant_id = pid || "anon";
  let group_id: string | null = null;
  if (pid) {
    const { data: p } = await supabaseAdmin
      .from("participants")
      .select("group_id")
      .eq("id", pid)
      .maybeSingle();
    group_id = p?.group_id ?? null;
  }

  // Enforce max submissions per activity (per group if present else per participant)
  const { data: act } = await supabaseAdmin
    .from("activities")
    .select("config")
    .eq("id", activity_id)
    .maybeSingle();
  const max = Number(act?.config?.max_submissions || 0);
  if (max > 0) {
    const base = supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activity_id);
    const { count } = group_id
      ? await base.eq("group_id", group_id)
      : await base.eq("participant_id", participant_id);
    if ((count ?? 0) >= max) {
      return NextResponse.json({ error: `Max submissions (${max}) reached` }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .insert({ activity_id, text, participant_id, group_id })
    .select("id,text,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data }, { status: 201 });
}
