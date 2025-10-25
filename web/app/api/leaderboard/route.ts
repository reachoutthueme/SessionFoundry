import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

// GET /api/leaderboard?session_id=...
// Returns group totals across all brainstorm activities in a session.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  // Activities (brainstorm only)
  const { data: acts, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id,type")
    .eq("session_id", session_id)
    .eq("type", "brainstorm");
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  const activityIds = (acts ?? []).map(a => (a as any).id as string);
  if (activityIds.length === 0) return NextResponse.json({ leaderboard: [] });

  // Submissions with group_id
  const { data: subs, error: se } = await supabaseAdmin
    .from("submissions")
    .select("id,group_id,activity_id")
    .in("activity_id", activityIds);
  if (se) return NextResponse.json({ error: se.message }, { status: 500 });
  const byGroup = new Map<string, string[]>();
  (subs ?? []).forEach(s => {
    const gid = (s as any).group_id as string | null;
    const sid = (s as any).id as string;
    if (!gid) return;
    const arr = byGroup.get(gid) || [];
    arr.push(sid);
    byGroup.set(gid, arr);
  });

  // Votes for those activities
  const { data: votes, error: ve } = await supabaseAdmin
    .from("votes")
    .select("submission_id,value,activity_id")
    .in("activity_id", activityIds);
  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  // Sum per group
  const totals = new Map<string, number>();
  const setOfSubIds = new Set((subs ?? []).map(s => (s as any).id as string));
  (votes ?? []).forEach(v => {
    const sid = (v as any).submission_id as string;
    if (!setOfSubIds.has(sid)) return;
    // find group for this submission
    // Build reverse map lazily
  });
  const subToGroup = new Map<string, string>();
  byGroup.forEach((arr, gid) => arr.forEach(sid => subToGroup.set(sid, gid)));
  (votes ?? []).forEach(v => {
    const sid = (v as any).submission_id as string;
    const gid = subToGroup.get(sid);
    if (!gid) return;
    const val = Number((v as any).value || 0);
    totals.set(gid, (totals.get(gid) || 0) + val);
  });

  // Groups names
  const { data: groups, error: ge } = await supabaseAdmin
    .from("groups")
    .select("id,name")
    .eq("session_id", session_id);
  if (ge) return NextResponse.json({ error: ge.message }, { status: 500 });
  const gmap = new Map<string, string>((groups ?? []).map(g => [(g as any).id as string, (g as any).name as string]));

  const out = Array.from(totals.entries()).map(([group_id, total]) => ({
    group_id,
    group_name: gmap.get(group_id) || `Group ${group_id.slice(0,4)}`,
    total,
  })).sort((a,b)=> b.total - a.total);

  return NextResponse.json({ leaderboard: out });
}

