import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activity_id } = await ctx.params;

  const { data: activity, error: ae } = await supabaseAdmin
    .from('activities')
    .select('session_id,type')
    .eq('id', activity_id)
    .maybeSingle();
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  if (!activity) return NextResponse.json({ submissions: [] });

  // Stocktake results: aggregate counts per initiative
  if ((activity as any).type === 'stocktake') {
    const [initsRes, respRes] = await Promise.all([
      supabaseAdmin.from('stocktake_initiatives').select('id,title').eq('activity_id', activity_id).order('title', { ascending: true }),
      supabaseAdmin.from('stocktake_responses').select('initiative_id,choice').eq('activity_id', activity_id),
    ]);
    if (initsRes.error) return NextResponse.json({ error: initsRes.error.message }, { status: 500 });
    if (respRes.error) return NextResponse.json({ error: respRes.error.message }, { status: 500 });
    const initiatives = (initsRes.data ?? []) as { id: string; title: string }[];
    const responses = (respRes.data ?? []) as { initiative_id: string; choice: 'stop'|'less'|'same'|'more'|'begin' }[];
    const order: Array<'stop'|'less'|'same'|'more'|'begin'> = ['stop','less','same','more','begin'];
    const scoreMap: Record<string, number> = { stop: -2, less: -1, same: 0, more: 1, begin: 2 };
    const byInit = new Map<string, { counts: Record<string, number>; n: number; sum: number }>();
    for (const it of initiatives) {
      byInit.set(it.id, { counts: { stop: 0, less: 0, same: 0, more: 0, begin: 0 }, n: 0, sum: 0 });
    }
    for (const r of responses) {
      const rec = byInit.get(r.initiative_id) || { counts: { stop: 0, less: 0, same: 0, more: 0, begin: 0 }, n: 0, sum: 0 };
      rec.counts[r.choice] = (rec.counts[r.choice] || 0) + 1;
      rec.n += 1;
      rec.sum += scoreMap[r.choice] ?? 0;
      byInit.set(r.initiative_id, rec);
    }
    const items = initiatives.map(it => {
      const rec = byInit.get(it.id)!;
      const avg = rec.n ? rec.sum / rec.n : 0;
      return { id: it.id, title: it.title, counts: rec.counts, n: rec.n, avg };
    });
    const overallN = items.reduce((a,b)=> a + b.n, 0);
    const overallSum = items.reduce((a,b)=> a + (b.avg * b.n), 0);
    const overallAvg = overallN ? overallSum / overallN : 0;
    return NextResponse.json({ stocktake: { initiatives: items, overall: { n: overallN, avg: overallAvg }, order } });
  }

  // Default: brainstorm/assignment submissions with votes
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
      .eq('session_id', (activity as any).session_id)
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
