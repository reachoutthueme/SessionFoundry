import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";
import { canExportSession } from "@/server/policies";
import { rateLimit } from "@/server/rateLimit";
import { buildDeckMarkdown, sanitizeForFilename } from "@/server/exports/deckBuilder";

// --- Types for rows coming back from Supabase --- //
type SessionRow = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  created_at: string;
  facilitator_user_id?: string;
};

type ActivityRow = {
  id: string;
  session_id: string;
  type: "brainstorm" | "stocktake" | "assignment" | string;
  title: string | null;
  instructions: string | null;
  description: string | null;
  config: unknown;
  order_index: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type ParticipantRow = {
  id: string;
  display_name: string | null;
};

type SubmissionRow = {
  id: string;
  activity_id: string;
  text: string;
  participant_id: string | null;
  created_at: string;
};

type VoteRow = {
  id: string;
  activity_id: string;
  submission_id: string;
  voter_id: string | null;
  value: number;
  created_at: string;
};

type VoteEntry = { value: number };

type SubmissionSummary = {
  id: string;
  text: string;
  participant_id: string | null;
  participant_name: string;
  n: number;      // number of votes
  total: number;  // sum of votes
  avg: number;    // average score
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: session_id } = await params;

  // authZ + plan
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const can = await canExportSession(user, session_id);
  if (!can) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // edge rate-limit by user
  const rl = rateLimit(`export:deck:${user.id}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many export requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) },
    });
  }

  // load session basics for export header
  const { data: sessCheck, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,name,status,join_code,created_at")
    .eq("id", session_id)
    .maybeSingle<Pick<SessionRow, "id" | "name" | "status" | "join_code" | "created_at">>();
  if (se0) return NextResponse.json({ error: se0.message }, { status: 500 });
  if (!sessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // pull core data in parallel
  const [actsRes, partsRes] = await Promise.all([
    supabaseAdmin
      .from("activities")
      .select(
        "id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at"
      )
      .eq("session_id", session_id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<ActivityRow[]>(),

    supabaseAdmin
      .from("participants")
      .select("id,display_name")
      .eq("session_id", session_id)
      .returns<ParticipantRow[]>(),
  ]);

  if (actsRes.error) {
    return NextResponse.json({ error: actsRes.error.message }, { status: 500 });
  }
  if (partsRes.error) {
    return NextResponse.json({ error: partsRes.error.message }, { status: 500 });
  }

  const activities: ActivityRow[] = actsRes.data ?? [];
  const participantsRows: ParticipantRow[] = partsRes.data ?? [];

  // get submissions + votes for all activities in this session
  const actIds = activities.map((a) => a.id);

  const [subsRes, votesRes] = await Promise.all([
    actIds.length
      ? supabaseAdmin
          .from("submissions")
          .select("id,activity_id,text,participant_id,created_at")
          .in("activity_id", actIds)
          .returns<SubmissionRow[]>()
      : Promise.resolve({ data: [] as SubmissionRow[], error: null }),

    actIds.length
      ? supabaseAdmin
          .from("votes")
          .select("id,activity_id,submission_id,voter_id,value,created_at")
          .in("activity_id", actIds)
          .returns<VoteRow[]>()
      : Promise.resolve({ data: [] as VoteRow[], error: null }),
  ]);

  if (subsRes.error) return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  if (votesRes.error) return NextResponse.json({ error: votesRes.error.message }, { status: 500 });

  const submissions: SubmissionRow[] = subsRes.data ?? [];
  const votes: VoteRow[] = votesRes.data ?? [];

  // build participant lookup
  const participantsById = new Map<string, string>();
  participantsRows.forEach((p) => {
    participantsById.set(p.id, p.display_name || "");
  });

  // aggregate votes per submission
  const votesBySubmission = new Map<string, VoteEntry[]>();
  votes.forEach((v: VoteRow) => {
    const sid = v.submission_id;
    const arr = votesBySubmission.get(sid) || [];
    arr.push({ value: Number(v.value || 0) });
    votesBySubmission.set(sid, arr);
  });

  // group submissions by activity, with stats
  const byActivity = new Map<string, SubmissionSummary[]>();

  submissions.forEach((s: SubmissionRow) => {
    const sid = s.id;
    const activityId = s.activity_id;
    const scoreList = votesBySubmission.get(sid) || [];

    const n = scoreList.length;
    const total = scoreList.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
    const avg = n ? total / n : 0;

    const participant_name = s.participant_id
      ? participantsById.get(s.participant_id) || ""
      : "";

    const summaryRow: SubmissionSummary = {
      id: sid,
      text: s.text,
      participant_id: s.participant_id,
      participant_name,
      n,
      total,
      avg,
    };

    const arr = byActivity.get(activityId) || [];
    arr.push(summaryRow);
    byActivity.set(activityId, arr);
  });

  const md = buildDeckMarkdown(sessCheck as any, activities as any, participantsRows as any, submissions as any, votes as any);

  const filename = `deck_${sanitizeForFilename(s.name || "session")}_${sanitizeForFilename(s.id)}.md`;

  const res = new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });

  return res;
}

// helpers moved to server/exports/deckBuilder
