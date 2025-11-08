type Activity = { id: string; title?: string | null; type?: string | null };
type Submission = { id: string; activity_id: string; text: string; participant_id: string | null };
type Vote = { submission_id: string; value: number };
type Participant = { id: string; display_name?: string | null };

export function csvEscape(v: string) {
  const s = String(v ?? "");
  const needs = /[",\n]/.test(s);
  const doubled = s.replace(/"/g, '""');
  return needs ? `"${doubled}"` : doubled;
}

export function buildResultsCsv(
  activities: Activity[],
  submissions: Submission[],
  votes: Vote[],
  participants: Participant[]
): string {
  const amap = new Map<string, string>();
  activities.forEach((a) => {
    const title = a.title || a.type || "";
    amap.set(String(a.id), title || "");
  });

  const pmap = new Map<string, string>();
  participants.forEach((p) => {
    pmap.set(String(p.id), (p.display_name as string) || "");
  });

  const votesBySub = new Map<string, { value: number }[]>();
  votes.forEach((v) => {
    const sid = String(v.submission_id);
    const arr = votesBySub.get(sid) || [];
    arr.push({ value: Number((v as any).value || 0) });
    votesBySub.set(sid, arr);
  });

  const headers = ["activity_title","submission_text","participant_name","n","avg","stdev","total"];
  const lines: string[] = [headers.join(",")];

  submissions.forEach((s) => {
    const sid = String(s.id);
    const activity_id = String(s.activity_id);
    const text = String((s as any).text || "");
    const pid = (s as any).participant_id ? String((s as any).participant_id) : null;
    const name = pid ? (pmap.get(pid) || "") : "";

    const arr = votesBySub.get(sid) || [];
    const n = arr.length;
    const total = arr.reduce((acc: number, v: any) => acc + Number(v?.value || 0), 0);
    const avg = n ? total / n : 0;
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

  return lines.join("\n") + "\n";
}

