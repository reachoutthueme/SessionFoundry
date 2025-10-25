import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: session_id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== 'pro') return NextResponse.json({ error: "Pro plan required for exports" }, { status: 402 });
  // Ensure ownership
  const { data: sess, error: se0 } = await supabaseAdmin.from('sessions').select('id,facilitator_user_id').eq('id', session_id).maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // load activities
  const { data: acts, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id,title,type,order_index,status")
    .eq("session_id", session_id)
    .order("order_index", { ascending: true });
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  const brainstormIds = (acts ?? []).filter(a => (a as any).type === 'brainstorm').map(a => (a as any).id as string);
  if (brainstormIds.length === 0) {
    return makeCsvResponse("activity_title,submission_text,participant_name,n,avg,stdev,total\n", session_id, "results");
  }

  // submissions
  const { data: subs, error: se } = await supabaseAdmin
    .from("submissions")
    .select("id,activity_id,text,participant_id,created_at")
    .in("activity_id", brainstormIds);
  if (se) return NextResponse.json({ error: se.message }, { status: 500 });

  // votes
  const { data: votes, error: ve } = await supabaseAdmin
    .from("votes")
    .select("submission_id,activity_id,value,voter_id")
    .in("activity_id", brainstormIds);
  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  // participants map
  const { data: parts, error: pe } = await supabaseAdmin
    .from("participants")
    .select("id,display_name")
    .eq("session_id", session_id);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  const pmap = new Map<string, string>();
  (parts ?? []).forEach(p => pmap.set((p as any).id, (p as any).display_name || ""));

  const amap = new Map<string, string>();
  (acts ?? []).forEach(a => amap.set((a as any).id, (a as any).title || (a as any).type));

  // aggregate per submission
  const bySub = new Map<string, any[]>();
  (votes ?? []).forEach(v => {
    const sid = (v as any).submission_id as string;
    const arr = bySub.get(sid) || [];
    arr.push(v);
    bySub.set(sid, arr);
  });

  const headers = ["activity_title","submission_text","participant_name","n","avg","stdev","total"];
  const lines: string[] = [headers.join(",")];
  (subs ?? []).forEach(s => {
    const sid = (s as any).id as string;
    const activity_id = (s as any).activity_id as string;
    const text = csvEscape(((s as any).text as string) || "");
    const pid = (s as any).participant_id as string | null;
    const name = pid ? (pmap.get(pid) || '') : '';
    const votesArr = bySub.get(sid) || [];
    const n = votesArr.length;
    const total = votesArr.reduce((acc, v) => acc + Number((v as any).value || 0), 0);
    const avg = n ? (total / n) : 0;
    const stdev = n ? Math.sqrt(votesArr.reduce((acc, v) => acc + Math.pow(Number((v as any).value || 0) - avg, 2), 0) / n) : 0;
    const row = [
      csvEscape(amap.get(activity_id) || ''),
      text,
      csvEscape(name || (pid ? `#${pid.slice(0,6)}` : '')),
      String(n),
      n ? avg.toFixed(2) : '',
      n ? stdev.toFixed(2) : '',
      String(total),
    ].join(",");
    lines.push(row);
  });

  return makeCsvResponse(lines.join("\n") + "\n", session_id, "results");
}

function makeCsvResponse(csv: string, session_id: string, name: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}_${session_id}.csv"`,
    },
  });
}

function csvEscape(v: string) {
  const needs = /[",\n]/.test(v);
  const s = v.replace(/"/g, '""');
  return needs ? `"${s}"` : s;
}
