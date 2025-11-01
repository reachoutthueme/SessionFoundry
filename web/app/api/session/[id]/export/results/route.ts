import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session_id = params.id;

  // Auth + plan
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.plan !== "pro") {
    return NextResponse.json({ error: "Pro plan required for exports" }, { status: 403 });
  }

  // Ownership check
  const { data: sess, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,facilitator_user_id,name")
    .eq("id", session_id)
    .maybeSingle();

  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess || (sess as any).facilitator_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load activities (brainstorm only for results CSV)
  const { data: acts, error: ae } = await supabaseAdmin
    .from("activities")
    .select("id,title,type,order_index,status,created_at")
    .eq("session_id", session_id)
    .eq("type", "brainstorm")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

  const brainstormIds = (acts ?? []).map((a: any) => String(a.id));
  if (brainstormIds.length === 0) {
    return makeCsvResponse("activity_title,submission_text,participant_name,n,avg,stdev,total\n", session_id, sess?.name, "results");
  }

  // Submissions
  const { data: subs, error: se } = await supabaseAdmin
    .from("submissions")
    .select("id,activity_id,text,participant_id,created_at")
    .in("activity_id", brainstormIds);

  if (se) return NextResponse.json({ error: se.message }, { status: 500 });

  // Votes
  const { data: votes, error: ve } = await supabaseAdmin
    .from("votes")
    .select("submission_id,activity_id,value,voter_id")
    .in("activity_id", brainstormIds);

  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  // Participants map (for names)
  const { data: parts, error: pe } = await supabaseAdmin
    .from("participants")
    .select("id,display_name")
    .eq("session_id", session_id);

  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const pmap = new Map<string, string>();
  (parts ?? []).forEach((p: any) => {
    pmap.set(String(p.id), (p.display_name as string) || "");
  });

  const amap = new Map<string, string>();
  (acts ?? []).forEach((a: any) => {
    const title = (a.title as string) || (a.type as string);
    amap.set(String(a.id), title);
  });

  // Aggregate votes per submission
  const votesBySub = new Map<string, any[]>();
  (votes ?? []).forEach((v: any) => {
    const sid = String(v.submission_id);
    const arr = votesBySub.get(sid) || [];
    arr.push(v);
    votesBySub.set(sid, arr);
  });

  const headers = ["activity_title","submission_text","participant_name","n","avg","stdev","total"];
  const lines: string[] = [headers.join(",")];

  (subs ?? []).forEach((s: any) => {
    const sid = String(s.id);
    const activity_id = String(s.activity_id);
    const text = String(s.text || "");
    const pid = s.participant_id ? String(s.participant_id) : null;
    const name = pid ? (pmap.get(pid) || "") : "";

    const arr = votesBySub.get(sid) || [];
    const n = arr.length;
    const total = arr.reduce((acc: number, v: any) => acc + Number(v?.value || 0), 0);
    const avg = n ? total / n : 0;

    // stdev (population). If you prefer sample, divide by (n-1) when n>1.
    const variance = n
      ? arr.reduce((acc: number, v: any) => {
          const val = Number(v?.value || 0);
          return acc + Math.pow(val - avg, 2);
        }, 0) / n
      : 0;
    const stdev = Math.sqrt(variance);

    const row = [
      csvEscape(amap.get(activity_id) || ""),
      csvEscape(text),
      csvEscape(name || (pid ? `#${pid.slice(0, 6)}` : "")),
      String(n),
      n ? avg.toFixed(2) : "",
      n ? stdev.toFixed(2) : "",
      String(total),
    ].join(",");

    lines.push(row);
  });

  return makeCsvResponse(lines.join("\n") + "\n", session_id, (sess as any)?.name, "results");
}

function makeCsvResponse(csv: string, session_id: string, sessionName?: string, kind?: string) {
  const filename = `${sanitizeForFilename(kind || "results")}_${sanitizeForFilename(sessionName || "session")}_${sanitizeForFilename(session_id)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(v: string) {
  const s = String(v ?? "");
  const needs = /[",\n]/.test(s);
  const doubled = s.replace(/"/g, '""');
  return needs ? `"${doubled}"` : doubled;
}

function sanitizeForFilename(s: string) {
  return (s || "").replace(/[\\\/:*?"<>|]+/g, "_").slice(0, 80).trim() || "export";
}