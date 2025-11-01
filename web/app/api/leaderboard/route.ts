import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession } from "@/app/api/_util/auth";

// GET /api/leaderboard?session_id=...
// Returns group totals across all *brainstorm* activities in a session.
// Includes groups with zero points.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id")?.toString().trim();

  // Basic validation
  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }
  // (Optional) UUID sanity—comment out if your IDs are not UUIDs
  if (!/^[0-9a-fA-F-]{16,}$/.test(session_id)) {
    return NextResponse.json({ error: "invalid session_id" }, { status: 400 });
  }

  // AuthZ: facilitator must own the session
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsSession(user.id, session_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch groups (we’ll include zero-score groups)
  const { data: groups, error: ge } = await supabaseAdmin
    .from("groups")
    .select("id, name")
    .eq("session_id", session_id);
  if (ge) return NextResponse.json({ error: ge.message }, { status: 500 });

  // If no groups exist, short-circuit
  const groupsArr = (groups ?? []).map(g => ({ id: String((g as any).id), name: String((g as any).name || "") }));
  if (groupsArr.length === 0) {
    const res = NextResponse.json({ leaderboard: [] });
    res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res;
  }

  // Brainstorm activities only
  const { data: acts, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id, type")
    .eq("session_id", session_id)
    .eq("type", "brainstorm");
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

  const activityIds: string[] = (acts ?? []).map(a => String((a as any).id));
  if (activityIds.length === 0) {
    // No brainstorm activities: return all groups with zeros
    const zeroOut = groupsArr.map(g => ({
      group_id: g.id,
      group_name: g.name || `Group ${g.id.slice(0, 4)}`,
      total: 0,
      vote_count: 0,
      submission_count: 0,
    }));
    const res = NextResponse.json({ leaderboard: zeroOut });
    res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res;
  }

  // Submissions for those activities. We try to get group_id; if null we will derive via participants.
  const { data: subs, error: se } = await supabaseAdmin
    .from("submissions")
    .select("id, activity_id, group_id, participant_id")
    .in("activity_id", activityIds);
  if (se) return NextResponse.json({ error: se.message }, { status: 500 });

  type SubmissionRow = {
    id: string;
    activity_id: string;
    group_id: string | null;
    participant_id: string | null;
  };
  const subsArr: SubmissionRow[] = (subs ?? []).map((s: any) => ({
    id: String(s.id),
    activity_id: String(s.activity_id),
    group_id: s.group_id ? String(s.group_id) : null,
    participant_id: s.participant_id ? String(s.participant_id) : null,
  }));

  // For submissions missing group_id, derive from participants
  const missingGroupParticipantIds = Array.from(
    new Set(
      subsArr
        .filter(s => !s.group_id && s.participant_id)
        .map(s => s.participant_id as string)
    )
  );

  let p2g = new Map<string, string | null>();
  if (missingGroupParticipantIds.length > 0) {
    const { data: parts, error: pe } = await supabaseAdmin
      .from("participants")
      .select("id, group_id")
      .eq("session_id", session_id)
      .in("id", missingGroupParticipantIds);
    if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
    p2g = new Map<string, string | null>(
      (parts ?? []).map((p: any) => [String(p.id), p.group_id ? String(p.group_id) : null])
    );
  }

  // Build submission -> group map (with fallback via participants)
  const subToGroup = new Map<string, string>();
  for (const s of subsArr) {
    const gid = s.group_id ?? (s.participant_id ? p2g.get(s.participant_id) ?? null : null);
    if (gid) subToGroup.set(s.id, gid);
  }

  // Votes for those activities
  const { data: votes, error: ve } = await supabaseAdmin
    .from("votes")
    .select("submission_id, value, activity_id")
    .in("activity_id", activityIds);
  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  type VoteRow = { submission_id: string; value: number; activity_id: string };
  const votesArr: VoteRow[] = (votes ?? []).map((v: any) => ({
    submission_id: String(v.submission_id),
    value: Number(v.value ?? 0),
    activity_id: String(v.activity_id),
  }));

  // Aggregate per group
  const totals = new Map<string, number>();
  const voteCounts = new Map<string, number>();
  const submissionCounts = new Map<string, number>();

  // Count submissions per group (even if no votes)
  for (const s of subsArr) {
    const gid = subToGroup.get(s.id);
    if (!gid) continue;
    submissionCounts.set(gid, (submissionCounts.get(gid) || 0) + 1);
  }

  // Sum votes & count votes per group
  for (const v of votesArr) {
    const gid = subToGroup.get(v.submission_id);
    if (!gid) continue;
    totals.set(gid, (totals.get(gid) || 0) + (Number.isFinite(v.value) ? v.value : 0));
    voteCounts.set(gid, (voteCounts.get(gid) || 0) + 1);
  }

  // Build output including zero-score groups
  const gname = new Map<string, string>(groupsArr.map(g => [g.id, g.name]));
  const out = groupsArr.map(g => ({
    group_id: g.id,
    group_name: g.name || `Group ${g.id.slice(0, 4)}`,
    total: totals.get(g.id) || 0,
    vote_count: voteCounts.get(g.id) || 0,
    submission_count: submissionCounts.get(g.id) || 0,
  })).sort((a, b) => b.total - a.total);

  const res = NextResponse.json({ leaderboard: out });
  res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
  return res;
}