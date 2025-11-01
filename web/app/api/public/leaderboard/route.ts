import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getParticipantInSession } from "@/app/api/_util/auth";

// Public (participant-safe) leaderboard
// GET /api/public/leaderboard?session_id=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const session_id = (url.searchParams.get("session_id") || "").trim();
    if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    // Gate by participant cookie belonging to this session
    const part = await getParticipantInSession(req, session_id);
    if (!part) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Groups (include zero-score groups)
    const { data: groups, error: ge } = await supabaseAdmin
      .from("groups")
      .select("id, name")
      .eq("session_id", session_id);
    if (ge) return NextResponse.json({ error: ge.message }, { status: 500 });
    const groupsArr = (groups ?? []).map((g: any) => ({ id: String(g.id), name: String(g.name || "") }));

    // Brainstorm activities only
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id, type")
      .eq("session_id", session_id)
      .eq("type", "brainstorm");
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    const activityIds: string[] = (acts ?? []).map((a: any) => String(a.id));

    if (activityIds.length === 0) {
      const zeroOut = groupsArr.map((g) => ({ group_id: g.id, group_name: g.name || `Group ${g.id.slice(0,4)}`, total: 0, vote_count: 0, submission_count: 0 }));
      const res = NextResponse.json({ leaderboard: zeroOut });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    // Submissions for those activities
    const { data: subs, error: se } = await supabaseAdmin
      .from("submissions")
      .select("id, activity_id, group_id, participant_id")
      .in("activity_id", activityIds);
    if (se) return NextResponse.json({ error: se.message }, { status: 500 });
    type SubmissionRow = { id: string; activity_id: string; group_id: string | null; participant_id: string | null };
    const subsArr: SubmissionRow[] = (subs ?? []).map((s: any) => ({ id: String(s.id), activity_id: String(s.activity_id), group_id: s.group_id ? String(s.group_id) : null, participant_id: s.participant_id ? String(s.participant_id) : null }));

    // Derive group for submissions missing it via participants table
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

    // Votes
    const { data: votes, error: ve } = await supabaseAdmin
      .from("votes")
      .select("submission_id, value, activity_id")
      .in("activity_id", activityIds);
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });
    type VoteRow = { submission_id: string; value: number; activity_id: string };
    const votesArr: VoteRow[] = (votes ?? []).map((v: any) => ({ submission_id: String(v.submission_id), value: Number(v.value ?? 0), activity_id: String(v.activity_id) }));

    // Aggregate
    const totals = new Map<string, number>();
    const voteCounts = new Map<string, number>();
    const submissionCounts = new Map<string, number>();
    for (const s of subsArr) {
      const gid = subToGroup.get(s.id);
      if (!gid) continue;
      submissionCounts.set(gid, (submissionCounts.get(gid) || 0) + 1);
    }
    for (const v of votesArr) {
      const gid = subToGroup.get(v.submission_id);
      if (!gid) continue;
      totals.set(gid, (totals.get(gid) || 0) + (Number.isFinite(v.value) ? v.value : 0));
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

