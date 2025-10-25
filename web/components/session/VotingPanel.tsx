"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Sub = { id: string; text: string };

export default function VotingPanel({
  sessionId,
  activityId,
}: {
  sessionId: string;
  activityId?: string;
}) {
  const toast = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // how many points a participant is allowed to spend total on this activity
  const [budget, setBudget] = useState<number>(0);

  // are we currently sending the vote submission request?
  const [submitting, setSubmitting] = useState(false);

  // which activity are we actually voting on (resolved if not provided explicitly)
  const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(
    null
  );

  // leaderboard is built after submission
  const [leaderboard, setLeaderboard] = useState<
    { id: string; text: string; total: number; n: number }[] | null
  >(null);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // initial load: fetch submissions + activity config
  useEffect(() => {
    (async () => {
      setLoading(true);

      const url = activityId
        ? `/api/submissions?activity_id=${activityId}`
        : `/api/submissions?session_id=${sessionId}`;

      const [rSubs, rActs] = await Promise.all([
        fetch(url, { cache: "no-store" }),
        fetch(`/api/activities?session_id=${sessionId}`, {
          cache: "no-store",
        }),
      ]);

      const jSubs = await rSubs.json();
      const jActs = await rActs.json();

      // Map submissions into { id, text }
      const list: Sub[] = (jSubs.submissions ?? []).map((x: any) => ({
        id: x.id as string,
        text: x.text as string,
      }));
      setSubs(list);

      // Initialize all slider values to 0
      const v: Record<string, number> = {};
      list.forEach((s) => {
        v[s.id] = 0;
      });
      setValues(v);

      // Figure out which activity config applies (points budget etc.)
      const act =
        (jActs.activities ?? []).find((a: any) => a.id === activityId) ||
        (jActs.activities ?? [])[0] ||
        null;

      setBudget(Number(act?.config?.points_budget ?? 0));
      setResolvedActivityId(activityId || act?.id || null);

      setLoading(false);
    })();
  }, [sessionId, activityId]);

  // Sum of all allocated points
  const total = Object.values(values).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );

  // Remaining points if it's a budget (allocation) style vote
  const remaining = budget > 0 ? Math.max(0, budget - total) : 0;

  function updateValue(id: string, next: number) {
    // Cap per-slider at either full budget (if budget voting)
    // or 10 (if rating style).
    const cap = budget > 0 ? budget : 10;
    next = Math.max(0, Math.min(cap, Math.round(next)));

    const prev = values[id] ?? 0;
    const currentSumExcluding = total - prev;

    if (budget > 0) {
      // You can't exceed the total budget across all sliders
      const allowed = Math.max(0, budget - currentSumExcluding);
      const clamped = Math.min(next, allowed);
      setValues((v) => ({ ...v, [id]: clamped }));
    } else {
      // Rating mode (0–10 per item, independent)
      setValues((v) => ({ ...v, [id]: next }));
    }
  }

  async function submitAll() {
    // Basic validation
    if (budget > 0 && (total <= 0 || total > budget)) {
      toast(`Use up to ${budget} points (currently ${total})`, "error");
      return;
    }

    setSubmitting(true);

    // Build vote payload
    const items = Object.entries(values).map(
      ([submission_id, value]: [string, number]) => ({
        submission_id,
        value,
      })
    );

    const body = activityId
      ? { activity_id: activityId, items }
      : { session_id: sessionId, items };

    const r = await fetch("/api/votes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const textResponse = await r.text();
    let j: any = {};
    try {
      j = textResponse ? JSON.parse(textResponse) : {};
    } catch {
      // ignore parse error, we'll just use text
    }

    setSubmitting(false);

    if (!r.ok) {
      toast(j.error || "Failed to submit votes", "error");
      return;
    }

    // success
    toast("Votes submitted", "success");
    setSubmitted(true);
    setShowLeaderboard(true);

    // fetch leaderboard from results endpoint
    if (resolvedActivityId) {
      try {
        const res = await fetch(
          `/api/activities/${resolvedActivityId}/results`,
          {
            cache: "no-store",
          }
        );
        const data = await res.json();

        const rows = Array.isArray(data?.submissions)
          ? (data.submissions as any[])
          : [];

        const lb = rows
          .map((s: any) => ({
            id: s.id as string,
            text: (s.text as string) ?? "",
            total: Array.isArray(s.votes)
              ? (s.votes as any[]).reduce(
                  (acc, v) => acc + Number(v.value || 0),
                  0
                )
              : 0,
            n: Number(
              s.n ??
                (Array.isArray(s.votes)
                  ? (s.votes as any[]).length
                  : 0)
            ),
          }))
          .sort((a, b) => b.total - a.total);

        setLeaderboard(lb);
      } catch {
        // ignore leaderboard fetch errors - not critical to UX
      }
    }
  }

  return (
    <Card>
      <CardHeader
        title="Voting"
        subtitle={
          budget > 0
            ? `Distribute ${budget} points across items`
            : "Rate each item (0–10)"
        }
      />
      <CardBody className="space-y-4">
        {loading ? (
          <>
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </>
        ) : subs.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No items to vote on yet.
          </div>
        ) : (
          <>
            {budget > 0 && (
              <div
                className={`p-2 rounded-md text-xs mb-2 ${
                  remaining === 0
                    ? "bg-green-500/10 text-green-200 border border-green-400/30"
                    : "bg-white/5 text-[var(--muted)] border border-white/10"
                }`}
              >
                Points remaining: {remaining} / {budget}
              </div>
            )}

            {subs.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-md bg-white/5 border border-white/10"
              >
                <div className="mb-2">{s.text}</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={budget > 0 ? budget : 10}
                    value={values[s.id] ?? 0}
                    onChange={(e) => {
                      if (!submitted)
                        updateValue(s.id, Number(e.target.value));
                    }}
                    disabled={submitted}
                    className="w-64"
                  />
                  <span className="w-8 text-center">
                    {values[s.id] ?? 0}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex justify-between mt-3">
              <button
                className="text-xs text-[var(--muted)] hover:underline"
                onClick={() => setShowLeaderboard((s) => !s)}
              >
                {showLeaderboard ? "Hide leaderboard" : "View leaderboard"}
              </button>

              {!submitted && (
                <Button
                  onClick={submitAll}
                  disabled={
                    submitting ||
                    (budget > 0 && (total <= 0 || total > budget))
                  }
                >
                  {submitting ? "Submitting..." : "Submit all votes"}
                </Button>
              )}
            </div>

            {submitted && (
              <div className="mt-2 text-sm text-[var(--muted)]">
                Thank you for voting.
              </div>
            )}

            {showLeaderboard &&
              leaderboard &&
              leaderboard.length > 0 && (
                <div className="mt-6">
                  <Card>
                    <CardHeader
                      title="Leaderboard"
                      subtitle="Ranked by total points"
                    />
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
                            <tr
                              key={r.id}
                              className="border-t border-white/10"
                            >
                              <td className="py-3 px-4 w-10">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">{r.text}</td>
                              <td className="py-3 px-4 font-semibold">
                                {r.total}
                              </td>
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