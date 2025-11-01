// app/api/activities/submission_counts/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getUserFromRequest, userOwnsSession } from "@/app/api/_util/auth";

// Types used locally to keep TS happy when Supabase returns arrays/objects
type JoinedParticipantObj = { id: string; group_id: string | null } | null;
type JoinedParticipantArr = { id: string; group_id: string | null }[]; // occasionally Supabase may nest arrays
type JoinedParticipant = JoinedParticipantObj | JoinedParticipantArr | null;

type JoinedSubmission = {
  id: string;
  activity_id: string;
  participant_id: string | null;
  group_id: string | null;
  // Supabase nested relation can come back as object OR array depending on query shape/version
  participant: JoinedParticipant;
};

function pickParticipantGroup(p: JoinedParticipant): string | null {
  if (!p) return null;
  if (Array.isArray(p)) return (p[0]?.group_id ?? null) as string | null;
  return (p?.group_id ?? null) as string | null;
}

// GET /api/activities/submission_counts?session_id=...
// Returns: { counts: { [activity_id]: { max: number, byGroup: Record<string,number>, total: number } } }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ counts: {} });

  // Auth + ownership
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const owns = await userOwnsSession(user.id, session_id);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Activities for this session (we need their ids and max_submissions from config)
  const { data: activities, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id, config")
    .eq("session_id", session_id);

  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

  const actIds = (activities ?? []).map((a: any) => a.id as string);
  if (actIds.length === 0) return NextResponse.json({ counts: {} });

  // Prepare counts structure
  type ByGroup = Record<string, number>;
  const counts: Record<
    string,
    { max: number; byGroup: ByGroup; total: number }
  > = {};

  for (const a of activities ?? []) {
    const id = (a as any).id as string;
    const max = Number((a as any).config?.max_submissions || 0);
    counts[id] = { max, byGroup: {}, total: 0 };
  }

  // Try a join on participants to get group_id directly.
  // If join fails, fallback to separate map (participant -> group_id).
  const sj = await supabaseAdmin
    .from("submissions")
    .select(
      "id,activity_id,participant_id,group_id,participant:participants(id,group_id)"
    )
    .in("activity_id", actIds);

  if (!sj.error && sj.data) {
    // Happy path: joined rows available
    const subsJoined = sj.data as unknown as JoinedSubmission[];

    for (const s of subsJoined) {
      const aid = s.activity_id;
      const entry = counts[aid];
      if (!entry) continue;

      // Prefer submission.group_id; fallback to participant.group_id; else "__ungrouped"
      const gid =
        s.group_id ??
        pickParticipantGroup(s.participant) ??
        "__ungrouped";

      const key = gid || "__ungrouped";
      entry.total += 1;
      entry.byGroup[key] = (entry.byGroup[key] || 0) + 1;
    }

    const res = NextResponse.json({ counts });
    res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    return res;
  }

  // Fallback path: no join; fetch submissions and a participant->group map
  const rSubs = await supabaseAdmin
    .from("submissions")
    .select("id,activity_id,participant_id,group_id")
    .in("activity_id", actIds);

  if (rSubs.error) {
    return NextResponse.json({ error: rSubs.error.message }, { status: 500 });
  }

  const subs = (rSubs.data ?? []) as {
    id: string;
    activity_id: string;
    participant_id: string | null;
    group_id: string | null;
  }[];

  // Map participant -> group_id for the session
  const partsRes = await supabaseAdmin
    .from("participants")
    .select("id, group_id")
    .eq("session_id", session_id);

  if (partsRes.error) {
    return NextResponse.json({ error: partsRes.error.message }, { status: 500 });
  }

  const p2g = new Map<string, string | null>(
    (partsRes.data ?? []).map((p: any) => [String(p.id), (p.group_id as string | null) ?? null])
  );

  for (const s of subs) {
    const aid = s.activity_id;
    const entry = counts[aid];
    if (!entry) continue;

    const gid =
      s.group_id ??
      (s.participant_id ? p2g.get(s.participant_id) ?? null : null) ??
      "__ungrouped";

    const key = gid || "__ungrouped";
    entry.total += 1;
    entry.byGroup[key] = (entry.byGroup[key] || 0) + 1;
  }

  const res = NextResponse.json({ counts });
  res.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
  return res;
}