import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: session_id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== 'pro') return NextResponse.json({ error: "Pro plan required for exports" }, { status: 402 });
  const { data: sess, error: se0 } = await supabaseAdmin.from('sessions').select('id,facilitator_user_id').eq('id', session_id).maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [sessionRes, actsRes, partsRes] = await Promise.all([
    supabaseAdmin.from('sessions').select('id,name,status,join_code,created_at').eq('id', session_id).maybeSingle(),
    supabaseAdmin.from('activities').select('id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at').eq('session_id', session_id).order('order_index', { ascending: true }),
    supabaseAdmin.from('participants').select('id,display_name').eq('session_id', session_id),
  ]);
  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 500 });
  if (actsRes.error) return NextResponse.json({ error: actsRes.error.message }, { status: 500 });
  if (partsRes.error) return NextResponse.json({ error: partsRes.error.message }, { status: 500 });

  const actIds = (actsRes.data ?? []).map(a => (a as any).id as string);
  const [subsRes, votesRes] = await Promise.all([
    actIds.length ? supabaseAdmin.from('submissions').select('id,activity_id,text,participant_id,created_at').in('activity_id', actIds) : Promise.resolve({ data: [], error: null } as any),
    actIds.length ? supabaseAdmin.from('votes').select('id,activity_id,submission_id,voter_id,value,created_at').in('activity_id', actIds) : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (subsRes.error) return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  if (votesRes.error) return NextResponse.json({ error: votesRes.error.message }, { status: 500 });

  const participants = new Map<string, string>();
  (partsRes.data ?? []).forEach(p => participants.set((p as any).id, (p as any).display_name || ""));

  const votesBySubmission = new Map<string, { value: number }[]>();
  (votesRes.data ?? []).forEach(v => {
    const sid = (v as any).submission_id as string;
    const arr = votesBySubmission.get(sid) || [];
    arr.push({ value: Number((v as any).value || 0) });
    votesBySubmission.set(sid, arr);
  });

  const byActivity = new Map<string, any[]>();
  (subsRes.data ?? []).forEach(s => {
    const a = (s as any).activity_id as string;
    const arr = byActivity.get(a) || [];
    const sid = (s as any).id as string;
    const xs = votesBySubmission.get(sid) || [];
    const n = xs.length;
    const total = xs.reduce((acc, v) => acc + Number(v.value || 0), 0);
    const avg = n ? total / n : 0;
    arr.push({
      id: sid,
      text: (s as any).text as string,
      participant_id: (s as any).participant_id as string | null,
      participant_name: (s as any).participant_id ? (participants.get((s as any).participant_id as string) || '') : '',
      n, total, avg,
    });
    byActivity.set(a, arr);
  });

  const s = sessionRes.data as any;
  const lines: string[] = [];
  lines.push(`# ${mdEscape(s?.name || 'Session')}`);
  lines.push("");
  lines.push(`- Session ID: ${s?.id}`);
  lines.push(`- Status: ${s?.status}`);
  lines.push(`- Join code: ${s?.join_code}`);
  lines.push(`- Exported: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Activities Overview");
  (actsRes.data ?? []).forEach(a => {
    const A = a as any;
    lines.push(`- ${mdEscape(A.title || (A.type==='brainstorm' ? 'Standard' : 'Stocktake'))} — ${A.type} — ${A.status}`);
  });
  lines.push("");

  for (const a of (actsRes.data ?? [])) {
    const A = a as any;
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${mdEscape(A.title || (A.type==='brainstorm' ? 'Standard' : 'Stocktake'))}`);
    lines.push(`Type: ${A.type}  `);
    lines.push(`Status: ${A.status}`);
    if (A.instructions) { lines.push(""); lines.push(`_Instructions:_ ${mdEscape(A.instructions)}`); }
    if (A.description)  { lines.push(""); lines.push(`${mdEscape(A.description)}`); }

    if (A.type === 'brainstorm') {
      const rows = (byActivity.get(A.id) || []).sort((x: any, y: any) => y.total - x.total);
      if (rows.length === 0) { lines.push(""); lines.push("No submissions."); continue; }
      lines.push("");
      lines.push("| # | Submission | By | Votes | Avg | Total |");
      lines.push("|---:|---|---|---:|---:|---:|");
      rows.forEach((r: any, idx: number) => {
        const by = r.participant_name || (r.participant_id ? `#${(r.participant_id as string).slice(0,6)}` : '') || '—';
        lines.push(`| ${idx+1} | ${mdEscape(r.text)} | ${mdEscape(by)} | ${r.n} | ${r.n ? r.avg.toFixed(2) : ''} | ${r.total} |`);
      });
    } else {
      lines.push("");
      lines.push("_(Stocktake activity summary)_");
    }
  }

  const md = lines.join("\n") + "\n";
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="deck_${session_id}.md"`,
    },
  });
}

function mdEscape(v: string): string {
  if (!v) return '';
  return v.replace(/[|*_`\\]/g, (m) => `\\${m}`);
}
