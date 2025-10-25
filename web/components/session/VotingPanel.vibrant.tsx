"use client";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { IconTrophy, IconVote } from "@/components/ui/Icons";

type Sub = { id: string; text: string };

export default function VotingPanel({ sessionId, activityId }: { sessionId: string; activityId?: string }) {
  const toast = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ id: string; text: string; total: number; n: number }[] | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const url = activityId
        ? `/api/submissions?activity_id=${activityId}`
        : `/api/submissions?session_id=${sessionId}`;
      const [rSubs, rActs] = await Promise.all([
        fetch(url, { cache: "no-store" }),
        fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" })
      ]);
      const j = await rSubs.json();
      const ja = await rActs.json();
      const list: Sub[] = (j.submissions ?? []).map((x: any) => ({ id: x.id, text: x.text }));
      setSubs(list);
      const v: Record<string, number> = {};
      list.forEach(s => v[s.id] = 0);
      setValues(v);
      const act = (ja.activities ?? []).find((a: any) => a.id === activityId) || (ja.activities ?? [])[0] || null;
      setBudget(Number(act?.config?.points_budget ?? 0));
      setResolvedActivityId(activityId || act?.id || null);
      setLoading(false);
    })();
  }, [sessionId, activityId]);

  const total = useMemo(() => Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0), [values]);
  const remaining = budget > 0 ? Math.max(0, budget - total) : 0;

  function updateValue(id: string, next: number) {
    const cap = budget > 0 ? budget : 10;
    next = Math.max(0, Math.min(cap, Math.round(next)));
    const prev = values[id] ?? 0;
    const currentSumExcluding = total - prev;
    if (budget > 0) {
      const allowed = Math.max(0, budget - currentSumExcluding);
      const clamped = Math.min(next, allowed);
      setValues(v => ({ ...v, [id]: clamped }));
    } else {
      setValues(v => ({ ...v, [id]: next }));
    }
  }

  async function submitAll() {
    if (budget > 0 && (total <= 0 || total > budget)) {
      toast(`Use up to ${budget} points (currently ${total})`, "error");
      return;
    }
    setSubmitting(true);
    const items = Object.entries(values).map(([submission_id, value]) => ({ submission_id, value }));
    const r = await fetch("/api/votes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activityId ? { activity_id: activityId, items } : { session_id: sessionId, items }),
    });
    const t = await r.text();
    let j: any = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
    setSubmitting(false);
    if (!r.ok) return toast(j.error || "Failed to submit votes", "error");
    toast("Votes submitted", "success");
    setSubmitted(true);
    setShowLeaderboard(true);
    if (resolvedActivityId) {
      try {
        const res = await fetch(`/api/activities/${resolvedActivityId}/results`, { cache: "no-store" });
        const data = await res.json();
        const rows = Array.isArray(data?.submissions) ? (data.submissions as any[]) : [];
        const lb = rows.map((s) => ({
          id: s.id as string,
          text: (s.text as string) ?? "",
          total: Array.isArray(s.votes) ? (s.votes as any[]).reduce((acc, v) => acc + Number(v.value || 0), 0) : 0,
          n: Number(s.n ?? (Array.isArray(s.votes) ? (s.votes as any[]).length : 0)),
        })).sort((a, b) => b.total - a.total);
        setLeaderboard(lb);
      } catch {}
    }
  }

  useEffect(() => {
    if (!showLeaderboard || !resolvedActivityId) return;
    let stop = false;
    async function fetchResults() {
      try {
        const res = await fetch(`/api/activities/${resolvedActivityId}/results`, { cache: "no-store" });
        const data = await res.json();
        const rows = Array.isArray(data?.submissions) ? (data.submissions as any[]) : [];
        const lb = rows.map((s) => ({
          id: s.id as string,
          text: (s.text as string) ?? "",
          total: Array.isArray(s.votes) ? (s.votes as any[]).reduce((acc, v) => acc + Number(v.value || 0), 0) : 0,
          n: Number(s.n ?? (Array.isArray(s.votes) ? (s.votes as any[]).length : 0)),
        })).sort((a, b) => b.total - a.total);
        if (!stop) setLeaderboard(lb);
      } catch {}
    }
    const iv = setInterval(fetchResults, 5000);
    fetchResults();
    return () => { stop = true; clearInterval(iv); };
  }, [showLeaderboard, resolvedActivityId]);

  return (
    <Card>
      <CardHeader title={<><IconVote className="text-[var(--brand)]" /><span>Voting</span></>} subtitle={budget>0?`Distribute ${budget} points across items`:'Rate each item (0–10)'} />
      <CardBody className="space-y-4">
        {loading ? (
          <>
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </>
        ) : subs.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No items to vote on yet.</div>
        ) : (
          <>
            {budget > 0 && (
              <div className={`p-2 rounded-md text-xs mb-2 ${remaining===0?"bg-green-500/10 text-[var(--text)] border border-green-400/30":"bg-white/5 text-[var(--muted)] border border-white/10"}`}>
                Points remaining: {remaining} / {budget}
              </div>
            )}
            {subs.map((s) => (
              <div key={s.id} className="p-3 rounded-md bg-white/5 border border-white/10">
                <div className="mb-2">{s.text}</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={budget > 0 ? budget : 10}
                    value={values[s.id] ?? 0}
                    onChange={(e) => { if (!submitted) updateValue(s.id, Number(e.target.value)); }}
                    disabled={submitted}
                    className="w-64"
                  />
                  <span className="w-8 text-center">{values[s.id] ?? 0}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-3">
              <button className="text-xs text-[var(--muted)] hover:underline" onClick={() => setShowLeaderboard(s => !s)}>
                {showLeaderboard ? 'Hide leaderboard' : 'View leaderboard'}
              </button>
              {!submitted && (
                <Button onClick={submitAll} disabled={submitting || (budget>0 && total<=0)}>
                  {submitting ? 'Submitting…' : 'Submit all votes'}
                </Button>
              )}
            </div>
            {submitted && (
              <div className="mt-2 text-sm text-[var(--muted)]">Thank you for voting.</div>
            )}

            {showLeaderboard && leaderboard && leaderboard.length > 0 && (
              <div className="mt-6">
                <Card>
                  <CardHeader title={<><IconTrophy className="text-[var(--brand)]" /><span>Leaderboard</span></>} subtitle="Ranked by total points" />
                  <CardBody className="p-0">
                    <table className="w-full text-sm">
                      <thead className="text-left text-[var(--muted)]">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-4">Total</th>
                          <th className="py-3 px-4">Votes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((r, idx) => (
                          <tr key={r.id} className="border-t border-white/10">
                            <td className="py-3 px-4 w-10">{idx+1}</td>
                            <td className="py-3 px-4">{r.text}</td>
                            <td className="py-3 px-4 font-semibold">{r.total}</td>
                            <td className="py-3 px-4">{r.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
