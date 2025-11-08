import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { canExportSession } from "@/server/policies";
import { rateLimit } from "@/server/rateLimit";
import { buildResultsCsv } from "@/server/exports/resultsCsvBuilder";
import { sanitizeForFilename } from "@/server/exports/deckBuilder";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: session_id } = await params;

  // AuthZ + plan + rate limit
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const can = await canExportSession(user, session_id);
  if (!can) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rl = rateLimit(`export:results:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many export requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) },
    });
  }

  // Load session name for filename
  const { data: sess, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,name")
    .eq("id", session_id)
    .maybeSingle();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sess) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const csv = buildResultsCsv((acts ?? []) as any, (subs ?? []) as any, (votes ?? []) as any, (parts ?? []) as any);
  return makeCsvResponse(csv, session_id, (sess as any)?.name, "results");
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

// sanitizeForFilename imported from deckBuilder
