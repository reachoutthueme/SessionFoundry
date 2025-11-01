import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getParticipantInSession } from "@/app/api/_util/auth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const activity_id = String(id || "").trim();
    if (!activity_id) return NextResponse.json({ error: "activity id required" }, { status: 400 });

    // Load activity to discover session_id
    const { data: act, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id, session_id, type")
      .eq("id", activity_id)
      .maybeSingle();
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    if (!act) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const session_id = String((act as any).session_id);

    // Ensure caller is a participant in this session (no facilitator auth required)
    const part = await getParticipantInSession(req as any, session_id);
    if (!part) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // All groups in session (for zero rows)
    const { data: groups, error: ge } = await supabaseAdmin
      .from("groups")
      .select("id,name")
      .eq("session_id", session_id);
    if (ge) return NextResponse.json({ error: ge.message }, { status: 500 });
    const groupsArr = (groups ?? []).map((g: any) => ({ id: String(g.id), name: String(g.name || "") }));

    // Submissions for this activity
    const { data: subs, error: se } = await supabaseAdmin
      .from("submissions")
      .select("id, group_id, participant_id")
      .eq("activity_id", activity_id);
    if (se) return NextResponse.json({ error: se.message }, { status: 500 });
    type SubmissionRow = { id: string; group_id: string | null; participant_id: string | null };
    const subsArr: SubmissionRow[] = (subs ?? []).map((s: any) => ({ id: String(s.id), group_id: s.group_id ? String(s.group_id) : null, participant_id: s.participant_id ? String(s.participant_id) : null }));

    // Fill missing group via participants table
    const missingPartIds = Array.from(new Set(subsArr.filter(s => !s.group_id && s.participant_id).map(s => s.participant_id as string)));
    let p2g = new Map<string, string | null>();
    if (missingPartIds.length > 0) {
      const { data: parts, error: pe } = await supabaseAdmin
        .from("participants")
        .select("id, group_id")
        .eq("session_id", session_id)
        .in("id", missingPartIds);
      if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
      p2g = new Map((parts ?? []).map((p: any) => [String(p.id), p.group_id ? String(p.group_id) : null]));
    }

    const subToGroup = new Map<string, string>();
    for (const s of subsArr) {
      const gid = s.group_id ?? (s.participant_id ? p2g.get(s.participant_id) ?? null : null);
      if (gid) subToGroup.set(s.id, gid);
    }

    // Votes for this activity
    const { data: votes, error: ve } = await supabaseAdmin
      .from("votes")
      .select("submission_id, value")
      .eq("activity_id", activity_id);
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

    const totals = new Map<string, number>();
    const voteCounts = new Map<string, number>();
    const submissionCounts = new Map<string, number>();

    for (const s of subsArr) {
      const gid = subToGroup.get(s.id);
      if (!gid) continue;
      submissionCounts.set(gid, (submissionCounts.get(gid) || 0) + 1);
    }
    for (const v of votes ?? []) {
      const gid = subToGroup.get((v as any).submission_id as string);
      if (!gid) continue;
      const val = Number((v as any).value ?? 0);
      totals.set(gid, (totals.get(gid) || 0) + (Number.isFinite(val) ? val : 0));
      voteCounts.set(gid, (voteCounts.get(gid) || 0) + 1);
    }

    const out = groupsArr.map((g) => ({
      group_id: g.id,
      group_name: g.name || `Group ${g.id.slice(0,4)}`,
      total: totals.get(g.id) || 0,
      vote_count: voteCounts.get(g.id) || 0,
      submission_count: submissionCounts.get(g.id) || 0,
    })).sort((a,b) => b.total - a.total);

    const res = NextResponse.json({ leaderboard: out });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

