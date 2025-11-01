import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export type BrainSubsRow = { id: string; text: string; created_at: string; participant_id: string };

export type ActivityServerHooks = {
  aggregateResults: (activity_id: string, session_id: string) => Promise<{ submissions?: any[]; stocktake?: any }>;
  canSubmit?: (opts: { session_id: string; activity_id: string; participant_id: string; group_id: string | null }) => Promise<{ ok: boolean; error?: string }>;
  saveSubmission?: (opts: { activity_id: string; text: string; participant_id: string; group_id: string | null }) => Promise<{ submission: any } | { error: string }>;
  canRespond?: (opts: { session_id: string; activity_id: string; participant_id: string }) => Promise<{ ok: boolean; error?: string }>;
  saveResponse?: (opts: { activity_id: string; initiative_id: string; choice: string; participant_id: string }) => Promise<{ response: any } | { error: string }>;
};

async function aggregateBrainstorm(activity_id: string, session_id: string) {
  const [subsRes, votesRes, partsRes] = await Promise.all([
    supabaseAdmin.from('submissions').select('id,text,created_at,participant_id').eq('activity_id', activity_id),
    supabaseAdmin.from('votes').select('submission_id,value,voter_id').eq('activity_id', activity_id),
    supabaseAdmin.from('participants').select('id,display_name').eq('session_id', session_id),
  ]);
  if (subsRes.error) throw new Error(subsRes.error.message);
  if (votesRes.error) throw new Error(votesRes.error.message);
  if (partsRes.error) throw new Error(partsRes.error.message);
  const participants = new Map<string, string | null>((partsRes.data ?? []).map((p: any) => [String(p.id), p.display_name || null]));
  const votesBySubmission = new Map<string, { voter_id: string; voter_name: string | null; value: number }[]>();
  (votesRes.data ?? []).forEach((v: any) => {
    const sid = String(v.submission_id);
    const arr = votesBySubmission.get(sid) || [];
    const vid = String(v.voter_id);
    arr.push({ voter_id: vid, voter_name: participants.get(vid) || null, value: Number(v.value) });
    votesBySubmission.set(sid, arr);
  });
  const out = (subsRes.data ?? []).map((s: any) => {
    const sid = String(s.id);
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
      text: s.text as string,
      created_at: s.created_at,
      participant_id: String(s.participant_id),
      participant_name: participants.get(String(s.participant_id)) || null,
      n,
      avg,
      stdev,
      votes: xs,
    };
  });
  return { submissions: out };
}

async function aggregateStocktake(activity_id: string) {
  const [initsRes, respRes] = await Promise.all([
    supabaseAdmin.from('stocktake_initiatives').select('id,title').eq('activity_id', activity_id).order('title', { ascending: true }),
    supabaseAdmin.from('stocktake_responses').select('initiative_id,choice').eq('activity_id', activity_id),
  ]);
  if (initsRes.error) throw new Error(initsRes.error.message);
  if (respRes.error) throw new Error(respRes.error.message);
  const initiatives = (initsRes.data ?? []) as { id: string; title: string }[];
  const responses = (respRes.data ?? []) as { initiative_id: string; choice: 'stop'|'less'|'same'|'more'|'begin' }[];
  const order: Array<'stop'|'less'|'same'|'more'|'begin'> = ['stop','less','same','more','begin'];
  const scoreMap: Record<string, number> = { stop: -2, less: -1, same: 0, more: 1, begin: 2 };
  const byInit = new Map<string, { counts: Record<string, number>; n: number; sum: number }>();
  for (const it of initiatives) byInit.set(it.id, { counts: { stop: 0, less: 0, same: 0, more: 0, begin: 0 }, n: 0, sum: 0 });
  for (const r of responses) {
    const rec = byInit.get(r.initiative_id)!;
    rec.counts[r.choice] = (rec.counts[r.choice] || 0) + 1;
    rec.n += 1;
    rec.sum += scoreMap[r.choice] ?? 0;
  }
  const items = initiatives.map((it) => {
    const rec = byInit.get(it.id)!;
    const avg = rec.n ? rec.sum / rec.n : 0;
    return { id: it.id, title: it.title, counts: rec.counts, n: rec.n, avg };
  });
  const overallN = items.reduce((a,b)=> a + b.n, 0);
  const overallSum = items.reduce((a,b)=> a + (b.avg * b.n), 0);
  const overallAvg = overallN ? overallSum / overallN : 0;
  return { stocktake: { initiatives: items, overall: { n: overallN, avg: overallAvg }, order } };
}

async function enforceMaxSubmissions(activity_id: string, participant_id: string, group_id: string | null) {
  const { data: act } = await supabaseAdmin.from('activities').select('config').eq('id', activity_id).maybeSingle();
  const max = Number((act as any)?.config?.max_submissions || 0);
  if (max > 0) {
    const base = supabaseAdmin.from('submissions').select('id', { count: 'exact', head: true }).eq('activity_id', activity_id);
    const { count } = group_id ? await base.eq('group_id', group_id) : await base.eq('participant_id', participant_id);
    if ((count ?? 0) >= max) return { ok: false, error: `Max submissions (${max}) reached` } as const;
  }
  return { ok: true } as const;
}

const brainstormHooks: ActivityServerHooks = {
  aggregateResults: aggregateBrainstorm,
  canSubmit: async ({ activity_id, participant_id, group_id }) => {
    return enforceMaxSubmissions(activity_id, participant_id, group_id);
  },
  saveSubmission: async ({ activity_id, text, participant_id, group_id }) => {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .insert({ activity_id, text, participant_id, group_id })
      .select('id,text,created_at')
      .single();
    if (error) return { error: error.message };
    return { submission: data };
  },
};

const assignmentHooks: ActivityServerHooks = {
  aggregateResults: aggregateBrainstorm,
  canSubmit: brainstormHooks.canSubmit,
  saveSubmission: brainstormHooks.saveSubmission,
};

const stocktakeHooks: ActivityServerHooks = {
  aggregateResults: async (activity_id) => aggregateStocktake(activity_id),
  canRespond: async () => ({ ok: true }),
  saveResponse: async ({ activity_id, initiative_id, choice, participant_id }) => {
    const { data, error } = await supabaseAdmin
      .from('stocktake_responses')
      .insert({ activity_id, initiative_id, choice, participant_id })
      .select('id, activity_id, initiative_id, choice, participant_id, created_at')
      .single();
    if (error) return { error: error.message };
    return { response: data };
  },
};

export async function getActivityMeta(activity_id: string): Promise<{ session_id: string; type: 'brainstorm'|'stocktake'|'assignment' } | null> {
  const { data, error } = await supabaseAdmin.from('activities').select('session_id,type').eq('id', activity_id).maybeSingle();
  if (error || !data) return null;
  return data as any;
}

export function getServerHooks(type: string | null | undefined): ActivityServerHooks | null {
  switch (type) {
    case 'brainstorm': return brainstormHooks;
    case 'assignment': return assignmentHooks;
    case 'stocktake': return stocktakeHooks;
    default: return null;
  }
}
