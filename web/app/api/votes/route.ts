import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getParticipantInSession, getSessionStatus } from "@/app/api/_util/auth";
import { VoteCreate } from "@/contracts";
import { rateLimit } from "@/server/rateLimit";

export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = VoteCreate.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { submission_id, value } = parsed.data as { submission_id: string; value: number };
  let activity_id = (parsed.data as any).activity_id as string | undefined;
  const session_id = (parsed.data as any).session_id as string | undefined;

  if (!activity_id && session_id) {
    const { data: acts, error: ae } = await supabaseAdmin
      .from("activities")
      .select("id,type,status,created_at")
      .eq("session_id", session_id)
      .in("type", ["brainstorm","assignment"] as any)
      .in("status", ["Active", "Voting"] as any)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
    activity_id = acts?.[0]?.id ?? "";
  }

  if (!activity_id) {
    return NextResponse.json({ error: "activity_id or session_id required" }, { status: 400 });
  }

  // participant from cookie (required) and group
  const participant = await getParticipantInSession(req, session_id || "");
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const voter_id = participant.id;
  let group_id: string | null = participant.group_id ?? null;

  // session must be Active for voting
  const sStatus = await getSessionStatus(session_id || "");
  if (sStatus !== 'Active') return NextResponse.json({ error: "Session not accepting votes" }, { status: 403 });

  // ensure activity allows voting and is in Voting status
  const cfgRes = await supabaseAdmin.from('activities').select('config,status').eq('id', activity_id).maybeSingle();
  const votingEnabled = !!(cfgRes.data as any)?.config?.voting_enabled;
  if (!votingEnabled) return NextResponse.json({ error: 'Voting disabled for this activity' }, { status: 400 });
  const aStatus = (cfgRes.data as any)?.status as string | undefined;
  if (aStatus !== 'Voting') return NextResponse.json({ error: 'Activity not in voting stage' }, { status: 403 });

  const rl = rateLimit(`votes:create:${voter_id}`, { limit: 200, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many votes submitted. Please try again later." }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
  }

  const { data, error } = await supabaseAdmin
    .from("votes")
    .insert({ activity_id, submission_id, value, voter_id, group_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vote: data }, { status: 201 });
}
