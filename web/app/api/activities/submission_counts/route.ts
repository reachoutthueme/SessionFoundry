import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// GET /api/activities/submission_counts?session_id=...
// Returns per-activity submission counts by group, plus max_submissions
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  if (!session_id) return NextResponse.json({ counts: {} });

  const { data: activities, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id,config")
    .eq("session_id", session_id);
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  const actIds = (activities ?? []).map(a => (a as any).id as string);
  if (actIds.length === 0) return NextResponse.json({ counts: {} });

  // Try to fetch with group_id if it exists; fall back to without
  let subs: any[] | null = null;
  {
    const r1 = await supabaseAdmin
      .from("submissions")
      .select("id,activity_id,participant_id,group_id")
      .in("activity_id", actIds);
    if (r1.error) {
      const r2 = await supabaseAdmin
        .from("submissions")
        .select("id,activity_id,participant_id")
        .in("activity_id", actIds);
      if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 });
      subs = r2.data as any[];
    } else {
      subs = r1.data as any[];
    }
  }

  // Map participant -> group for this session
  const { data: parts, error: pe } = await supabaseAdmin
    .from("participants")
    .select("id,group_id")
    .eq("session_id", session_id);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  const p2g = new Map<string, string | null>((parts ?? []).map(p => [String((p as any).id), ((p as any).group_id as string | null) ?? null]));

  type ByGroup = Record<string, number>;
  const counts: Record<string, { max: number; byGroup: ByGroup; total: number }> = {};
  const maxByAct = new Map<string, number>();
  (activities ?? []).forEach(a => {
    const id = (a as any).id as string;
    const max = Number((a as any).config?.max_submissions || 0);
    maxByAct.set(id, max);
    counts[id] = { max, byGroup: {}, total: 0 };
  });

  (subs ?? []).forEach(s => {
    const aid = (s as any).activity_id as string;
    const pid = (s as any).participant_id as string | null;
    const gidDirect = (s as any).group_id as (string | null | undefined);
    const gid = (gidDirect ?? (pid ? p2g.get(pid) : null)) || "__ungrouped";
    const entry = counts[aid];
    if (!entry) return;
    entry.total += 1;
    entry.byGroup[gid] = (entry.byGroup[gid] || 0) + 1;
  });

  return NextResponse.json({ counts });
}
