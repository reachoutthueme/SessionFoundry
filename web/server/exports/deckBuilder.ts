type SessionInfo = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  created_at: string;
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

type ParticipantRow = { id: string; display_name: string | null };
type SubmissionRow = { id: string; activity_id: string; text: string; participant_id: string | null; created_at: string };
type VoteRow = { submission_id: string; value: number };

export function mdEscape(v: string): string {
  if (!v) return "";
  return v.replace(/[|*_`\\]/g, (m) => `\\${m}`);
}

export function sanitizeForFilename(s: string): string {
  return (s || "").replace(/[\\\/:*?"<>|]+/g, "_").slice(0, 80).trim() || "export";
}

export function maskJoinCode(code: string): string {
  const c = (code || "").toString();
  if (c.length <= 2) return "**";
  const tail = c.slice(-2);
  return `${"*".repeat(Math.max(2, c.length - 2))}${tail}`;
}

export function buildDeckMarkdown(
  session: SessionInfo,
  activities: ActivityRow[],
  participants: ParticipantRow[],
  submissions: SubmissionRow[],
  votes: VoteRow[]
): string {
  // participant lookup
  const participantsById = new Map<string, string>();
  participants.forEach((p) => {
    participantsById.set(p.id, p.display_name || "");
  });

  // votes by submission
  const votesBySubmission = new Map<string, { value: number }[]>();
  votes.forEach((v) => {
    const sid = v.submission_id;
    const arr = votesBySubmission.get(sid) || [];
    arr.push({ value: Number(v.value || 0) });
    votesBySubmission.set(sid, arr);
  });

  type SubmissionSummary = {
    id: string;
    text: string;
    participant_id: string | null;
    participant_name: string;
    n: number;
    total: number;
    avg: number;
  };
  const byActivity = new Map<string, SubmissionSummary[]>();

  submissions.forEach((s) => {
    const sid = s.id;
    const activityId = s.activity_id;
    const scoreList = votesBySubmission.get(sid) || [];
    const n = scoreList.length;
    const total = scoreList.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
    const avg = n ? total / n : 0;
    const participant_name = s.participant_id ? participantsById.get(s.participant_id) || "" : "";
    const summaryRow: SubmissionSummary = { id: sid, text: s.text, participant_id: s.participant_id, participant_name, n, total, avg };
    const arr = byActivity.get(activityId) || [];
    arr.push(summaryRow);
    byActivity.set(activityId, arr);
  });

  const s = session;
  const lines: string[] = [];
  const maskedJoin = maskJoinCode(s.join_code);

  lines.push(`# ${mdEscape(s.name || "Session")}`);
  lines.push("");
  lines.push(`- **Session ID:** ${mdEscape(s.id)}`);
  lines.push(`- **Status:** ${mdEscape(s.status || "")}`);
  lines.push(`- **Join code:** ${mdEscape(maskedJoin)}`);
  lines.push(`- **Created:** ${new Date(s.created_at).toISOString()}`);
  lines.push(`- **Exported:** ${new Date().toISOString()}`);
  lines.push(`- **Participants:** ${participants.length}`);
  lines.push(`- **Activities:** ${activities.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Activities Overview");
  lines.push("");

  activities.forEach((A) => {
    const title = A.title || (A.type === "brainstorm" ? "Standard" : A.type === "stocktake" ? "Process stocktake" : "Assignment");
    lines.push(`- ${mdEscape(title)} — ${A.type} — ${A.status}`);
  });

  for (const A of activities) {
    const title = A.title || (A.type === "brainstorm" ? "Standard" : A.type === "stocktake" ? "Process stocktake" : "Assignment");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${mdEscape(title)}`);
    lines.push(`**Type:** ${A.type}  `);
    lines.push(`**Status:** ${A.status}`);

    if (A.instructions) {
      lines.push("");
      lines.push(`_Instructions:_ ${mdEscape(A.instructions)}`);
    }
    if (A.description) {
      lines.push("");
      lines.push(mdEscape(A.description));
    }

    if (A.type === "brainstorm") {
      const rowsForActivity = (byActivity.get(A.id) || []).sort((x, y) => y.total - x.total);
      if (rowsForActivity.length === 0) {
        lines.push("");
        lines.push("_No submissions._");
      } else {
        lines.push("");
        lines.push("| # | Submission | By | Votes | Avg | Total |");
        lines.push("|---:|---|---|---:|---:|---:|");
        rowsForActivity.forEach((r, idx) => {
          const by = r.participant_name || (r.participant_id ? `#${String(r.participant_id).slice(0, 6)}` : "") || "—";
          lines.push(`| ${idx + 1} | ${mdEscape(r.text)} | ${mdEscape(by)} | ${r.n} | ${r.n ? r.avg.toFixed(2) : ""} | ${r.total} |`);
        });
      }
    } else if (A.type === "stocktake") {
      lines.push("");
      lines.push("_(Stocktake activity summary)_");
    } else {
      lines.push("");
      lines.push("_(Assignment activity)_");
    }
  }

  return lines.join("\n") + "\n";
}

