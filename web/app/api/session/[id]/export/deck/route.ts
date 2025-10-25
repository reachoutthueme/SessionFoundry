import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getUserFromRequest } from "@/app/api/_util/auth";

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
  type: string;
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

// For aggregated vote info
type VoteEntry = { value: number };

// For aggregated submission summary per activity
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
  ctx: { params: Promise<{ id: string }> }
) {
  // params is a Promise in this Next.js version, so we await it
  const { id: session_id } = await ctx.params;

  // auth / plan check
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (user.plan !== "pro") {
    return NextResponse.json({ error: "Pro plan required for exports" }, { status: 402 });
  }

  // verify facilitator owns this session
  const { data: sessCheck, error: se0 } = await supabaseAdmin
    .from("sessions")
    .select("id,facilitator_user_id")
    .eq("id", session_id)
    .maybeSingle<Pick<SessionRow, "id" | "facilitator_user_id">>();

  if (se0) {
    return NextResponse.json({ error: se0.message }, { status: 500 });
  }
  if (!sessCheck || sessCheck.facilitator_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // pull core data in parallel
  const [sessionRes, actsRes, partsRes] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id,name,status,join_code,created_at")
      .eq("id", session_id)
      .maybeSingle<SessionRow>(),

    supabaseAdmin
      .from("activities")
      .select(
        "id,session_id,type,title,instructions,description,config,order_index,status,starts_at,ends_at,created_at"
      )
      .eq("session_id", session_id)
      .order("order_index", { ascending: true })
      .returns<ActivityRow[]>(),

    supabaseAdmin
      .from("participants")
      .select("id,display_name")
      .eq("session_id", session_id)
      .returns<ParticipantRow[]>(),
  ]);

  if (sessionRes.error) {
    return NextResponse.json({ error: sessionRes.error.message }, { status: 500 });
  }
  if (actsRes.error) {
    return NextResponse.json({ error: actsRes.error.message }, { status: 500 });
  }
  if (partsRes.error) {
    return NextResponse.json({ error: partsRes.error.message }, { status: 500 });
  }

  const activities: ActivityRow[] = actsRes.data ?? [];
  const participantsRows: ParticipantRow[] = partsRes.data ?? [];
  const sessionData: SessionRow | null = sessionRes.data ?? null;

  // get submissions + votes for all activities in this session
  const actIds = activities.map((a) => a.id);

  // fallback if no activities -> empty arrays
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

  if (subsRes.error) {
    return NextResponse.json({ error: subsRes.error.message }, { status: 500 });
  }
  if (votesRes.error) {
    return NextResponse.json({ error: votesRes.error.message }, { status: 500 });
  }

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
    const existing = votesBySubmission.get(sid) || [];
    existing.push({ value: Number(v.value || 0) });
    votesBySubmission.set(sid, existing);
  });

  // group submissions by activity, with stats
  const byActivity = new Map<string, SubmissionSummary[]>();

  submissions.forEach((s: SubmissionRow) => {
    const sid = s.id;
    const activityId = s.activity_id;
    const scoreList = votesBySubmission.get(sid) || [];

    const n = scoreList.length;
    const total = scoreList.reduce(
      (acc: number, curr: VoteEntry) => acc + Number(curr.value || 0),
      0
    );
    const avg = n ? total / n : 0;

    const participant_name =
      s.participant_id ? participantsById.get(s.participant_id) || "" : "";

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

  // build markdown export
  const s = sessionData;
  const lines: string[] = [];

  lines.push(`# ${mdEscape(s?.name || "Session")}`);
  lines.push("");
  lines.push(`- Session ID: ${s?.id ?? ""}`);
  lines.push(`- Status: ${s?.status ?? ""}`);
  lines.push(`- Join code: ${s?.join_code ?? ""}`);
  lines.push(`- Exported: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Activities Overview");

  activities.forEach((A) => {
    const title =
      A.title ||
      (A.type === "brainstorm" ? "Standard" : "Stocktake");
    lines.push(
      `- ${mdEscape(title)} — ${A.type} — ${A.status}`
    );
  });

  lines.push("");

  for (const A of activities) {
    const title =
      A.title ||
      (A.type === "brainstorm" ? "Standard" : "Stocktake");

    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${mdEscape(title)}`);
    lines.push(`Type: ${A.type}  `);
    lines.push(`Status: ${A.status}`);

    if (A.instructions) {
      lines.push("");
      lines.push(`_Instructions:_ ${mdEscape(A.instructions)}`);
    }

    if (A.description) {
      lines.push("");
      lines.push(mdEscape(A.description));
    }

    if (A.type === "brainstorm") {
      // sort submissions for this activity by total score desc
      const rowsForActivity: SubmissionSummary[] = (byActivity.get(A.id) || []).sort(
        (x, y) => y.total - x.total
      );

      if (rowsForActivity.length === 0) {
        lines.push("");
        lines.push("No submissions.");
        continue;
      }

      lines.push("");
      lines.push("| # | Submission | By | Votes | Avg | Total |");
      lines.push("|---:|---|---|---:|---:|---:|");

      rowsForActivity.forEach((r, idx) => {
        const by =
          r.participant_name ||
          (r.participant_id
            ? `#${(r.participant_id as string).slice(0, 6)}`
            : "") ||
          "—";

        lines.push(
          `| ${idx + 1} | ${mdEscape(r.text)} | ${mdEscape(by)} | ${r.n} | ${
            r.n ? r.avg.toFixed(2) : ""
          } | ${r.total} |`
        );
      });
    } else {
      // e.g. stocktake or other activity types
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

// escape pipes/markdown control chars so table formatting doesn't break
function mdEscape(v: string): string {
  if (!v) return "";
  return v.replace(/[|*_`\\]/g, (m) => `\\${m}`);
}
