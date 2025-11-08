import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";
import { VoteBulkCreate } from "@/contracts";
import { rateLimit } from "@/server/rateLimit";

// POST body: { session_id?: string, activity_id?: string, items: { submission_id: string, value: number }[] }
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = VoteBulkCreate.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  let activity_id = (parsed.data as any).activity_id as string | undefined;
  const session_id = (parsed.data as any).session_id as string | undefined;
  const items = (parsed.data as any).items as { submission_id: string; value: number }[];

  if (!activity_id && session_id) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", session_id)
      .eq("type", "brainstorm")
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    activity_id = acts?.[0]?.id ?? "";
  }
  if (!activity_id) return NextResponse.json({ error: "activity_id required" }, { status: 400 });

  const participant = await getParticipantInSession(req, session_id || "");
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const voter_id = participant.id;

  const sStatus = await getSessionStatus(session_id || "");
  if (sStatus !== 'Active') return NextResponse.json({ error: "Session not accepting votes" }, { status: 403 });

  // Prevent re-voting: if this voter already has any votes for this activity, block
  const { count: existingCount, error: existingErr } = await supabaseAdmin
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activity_id)
    .eq("voter_id", voter_id);
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if ((existingCount ?? 0) > 0) {
    return NextResponse.json({ error: "Votes already submitted for this activity" }, { status: 409 });
  }

  const rl = rateLimit(`votes:bulk:${voter_id}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many vote submissions. Please try again later." }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
  }

  const rows = items
    .filter(x => x && x.submission_id && Number.isFinite(Number(x.value)))
    .map(x => ({ activity_id, submission_id: x.submission_id, value: Number(x.value), voter_id }));
  if (rows.length === 0) return NextResponse.json({ error: "no valid items" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("votes")
    .upsert(rows, { onConflict: 'activity_id,submission_id,voter_id' })
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ votes: data });
}
