import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activity_id } = await ctx.params;

  const { data: activity, error: ae } = await supabaseAdmin
    .from('activities')
    .select('session_id')
    .eq('id', activity_id)
    .maybeSingle();
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  if (!activity) return NextResponse.json({ submissions: [] });

  const [subsRes, votesRes, partsRes] = await Promise.all([
    supabaseAdmin
      .from('submissions')
      .select('id,text,created_at,participant_id')
      .eq('activity_id', activity_id),
    supabaseAdmin
      .from('votes')
      .select('submission_id,value,voter_id')
      .eq('activity_id', activity_id),
    supabaseAdmin
      .from('participants')
      .select('id,display_name')
      .eq('session_id', activity.session_id)
  ]);

  if (subsRes.error) return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  if (votesRes.error) return NextResponse.json({ error: votesRes.error.message }, { status: 500 });
  if (partsRes.error) return NextResponse.json({ error: partsRes.error.message }, { status: 500 });

  const participants = new Map<string, string | null>((partsRes.data ?? []).map(p => [p.id as string, (p as any).display_name as string | null]));
  const votesBySubmission = new Map<string, { voter_id: string; voter_name: string | null; value: number }[]>();
  (votesRes.data ?? []).forEach(v => {
    const sid = (v as any).submission_id as string;
    const arr = votesBySubmission.get(sid) || [];
    const vid = (v as any).voter_id as string;
    arr.push({ voter_id: vid, voter_name: participants.get(vid) || null, value: Number((v as any).value) });
    votesBySubmission.set(sid, arr);
  });

  const out = (subsRes.data ?? []).map(s => {
    const sid = (s as any).id as string;
    const xs = votesBySubmission.get(sid) || [];
    const n = xs.length;
    const avg = n ? xs.reduce((a, b) => a + b.value, 0) / n : null;
    let stdev: number | null = null;
    if (n) {
      const mean = avg as number;
      const variance = xs.reduce((a, b) => a + Math.pow(b.value - mean, 2), 0) / n;
      stdev = Math.sqrt(variance);
    }
    return {
      id: sid,
      text: (s as any).text as string,
      created_at: (s as any).created_at,
      participant_id: (s as any).participant_id as string,
      participant_name: participants.get((s as any).participant_id as string) || null,
      n,
      avg,
      stdev,
      votes: xs,
    };
  });

  return NextResponse.json({ submissions: out });
}
