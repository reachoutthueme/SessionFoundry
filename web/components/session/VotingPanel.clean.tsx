"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Sub = { id: string; text: string };

type LeaderboardRow = {
  id: string;
  text: string;
  total: number;
  n: number;
};

export default function VotingPanel({
  sessionId,
  activityId,
}: {
  sessionId: string;
  activityId?: string;
}) {
  const toast = useToast();

  // submissions to vote on
  const [subs, setSubs] = useState<Sub[]>([]);
  // user’s slider values, keyed by submission id
  const [values, setValues] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // which activity we're actually voting in (if not explicitly passed)
  const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(
    null
  );

  // leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // INITIAL LOAD:
  // - fetch submissions (what you're voting on)
  // - fetch activities to find the budget + fallback activityId
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const subsUrl = activityId
          ? `/api/submissions?activity_id=${activityId}`
          : `/api/submissions?session_id=${sessionId}`;

        const [rSubs, rActs] = await Promise.all([
          fetch(subsUrl, { cache: "no-store" }),
          fetch(`/api/activities?session_id=${sessionId}`, {
            cache: "no-store",
          }),
        ]);

        // submissions
        const jSubs = await rSubs.json().catch(() => ({}));
        if (!rSubs.ok) {
          console.error("[VotingPanel] load submissions error:", jSubs.error);
          toast(jSubs.error || "Failed to load items for voting", "error");
          setSubs([]);
          setValues({});
          setLoading(false);
          return;
        }
        const list: Sub[] = Array.isArray(jSubs.submissions)
          ? jSubs.submissions.map((x: any) => ({
              id: String(x.id),
              text: String(x.text ?? ""),
            }))
          : [];
        setSubs(list);

        // zero-init all sliders
        const initVals: Record<string, number> = {};
        list.forEach((s) => {
          initVals[s.id] = 0;
        });
        setValues(initVals);

        // activities (for budget etc.)
        const jActs = await rActs.json().catch(() => ({}));
        if (!rActs.ok) {
          console.error("[VotingPanel] load activities error:", jActs.error);
          toast(jActs.error || "Failed to load voting settings", "error");
          setBudget(0);
          setResolvedActivityId(activityId || null);
          setLoading(false);
          return;
        }

        const actList: any[] = Array.isArray(jActs.activities)
          ? jActs.activities
          : [];
        const act =
          actList.find((a) => a.id === activityId) ||
          actList[0] ||
          null;

        const cfgBudget = Number(act?.config?.points_budget ?? 0);

        setBudget(Number.isFinite(cfgBudget) ? cfgBudget : 0);
        setResolvedActivityId(activityId || (act ? String(act.id) : null));
      } catch (err) {
        console.error("[VotingPanel] initial load crash:", err);
        toast("Failed to load voting data", "error");
        setSubs([]);
        setValues({});
        setBudget(0);
        setResolvedActivityId(activityId || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, activityId, toast]);

  // sum of all assigned points/scores by the user
  const total = useMemo(() => {
    return Object.values(values).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [values]);

  // how many points left to spend, if we're in points-budget mode
  const remaining = budget > 0 ? Math.max(0, budget - total) : 0;

  // keep slider updates legal
  function updateValue(id: string, nextRaw: number) {
    // Hard cap per-slider:
    // - If budget mode: you can't give more than the total budget to one item
    // - If rating mode: 0-10
    const hardCap = budget > 0 ? budget : 10;
    let next = Math.round(
      Math.max(0, Math.min(hardCap, Number(nextRaw) || 0))
    );

    const prevForThis = values[id] ?? 0;
    const sumWithoutThis = total - prevForThis;

    if (budget > 0) {
      // In budget mode, don't let the new value push you past the budget.
      const allowedForThis = Math.max(0, budget - sumWithoutThis);
      next = Math.min(next, allowedForThis);
    }

    setValues((v) => ({ ...v, [id]: next }));
  }

  async function submitAll() {
    // basic validation
    if (budget > 0 && (total <= 0 || total > budget)) {
      toast(
        `Use up to ${budget} points (currently ${total})`,
        "error"
      );
      return;
    }

    setSubmitting(true);

    try {
      const items = Object.entries(values).map(
        ([submission_id, value]) => ({
          submission_id,
          value,
        })
      );

      // POST votes
      const r = await fetch("/api/votes/bulk", {
        method: "POST",
        credentials: "include", // make sure participant cookie is sent
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activityId
            ? { activity_id: activityId, items }
            : { session_id: sessionId, items }
        ),
      });

      const text = await r.text();
      let j: any = {};
      try {
        j = text ? JSON.parse(text) : {};
      } catch {
        /* non-JSON is fine */
      }

      if (!r.ok) {
        console.error("[VotingPanel] submit error:", j.error || text);
        toast(j.error || "Failed to submit votes", "error");
        setSubmitting(false);
        return;
      }

      // success path
      toast("Votes submitted", "success");
      setSubmitted(true);
      setShowLeaderboard(true);

      // Load initial leaderboard snapshot
      if (resolvedActivityId) {
        try {
          const res = await fetch(
            `/api/activities/${resolvedActivityId}/results`,
            { cache: "no-store" }
          );
          const data = await res.json();
          const lb = extractLeaderboard(data);
          setLeaderboard(lb);
        } catch (err) {
          console.error(
            "[VotingPanel] initial leaderboard load error:",
            err
          );
        }
      }
    } catch (err) {
      console.error("[VotingPanel] submitAll crash:", err);
      toast("Failed to submit votes", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // helper to build leaderboard array from /results payload
  function extractLeaderboard(raw: any): LeaderboardRow[] {
    const rows = Array.isArray(raw?.submissions)
      ? (raw.submissions as any[])
      : [];

    return rows
      .map((s) => {
        const votes = Array.isArray(s.votes) ? s.votes : [];
        const totalPoints = votes.reduce(
          (acc: number, v: any) => acc + Number(v.value || 0),
          0
        );
        const nVotes =
          typeof s.n === "number"
            ? s.n
            : votes.length;

        return {
          id: String(s.id),
          text: String(s.text ?? ""),
          total: totalPoints,
          n: nVotes,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  // poll leaderboard while it's visible
  useEffect(() => {
    if (!showLeaderboard || !resolvedActivityId) return;

    let stop = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/activities/${resolvedActivityId}/results`,
          { cache: "no-store" }
        );
        const data = await res.json();
        const lb = extractLeaderboard(data);
        if (!stop) {
          setLeaderboard(lb);
        }
      } catch (err) {
        console.error("[VotingPanel] leaderboard poll error:", err);
      }
    }

    const iv = setInterval(poll, 5000);
    poll(); // prime immediately

    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [showLeaderboard, resolvedActivityId]);

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
                    ? "bg-green-500/10 text-[var(--text)] border border-green-400/30"
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
                      if (!submitted) {
                        updateValue(s.id, Number(e.target.value));
                      }
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
                type="button"
                className="text-xs text-[var(--muted)] hover:underline"
                onClick={() =>
                  setShowLeaderboard((s) => !s)
                }
              >
                {showLeaderboard
                  ? "Hide leaderboard"
                  : "View leaderboard"}
              </button>

              {!submitted && (
                <Button
                  onClick={submitAll}
                  disabled={
                    submitting ||
                    (budget > 0 && total <= 0)
                  }
                >
                  {submitting
                    ? "Submitting…"
                    : "Submit all votes"}
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
                          {leaderboard.map(
                            (row, idx) => (
                              <tr
                                key={row.id}
                                className="border-t border-white/10"
                              >
                                <td className="py-3 px-4 w-10">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4">
                                  {row.text}
                                </td>
                                <td className="py-3 px-4 font-semibold">
                                  {row.total}
                                </td>
                                <td className="py-3 px-4">
                                  {row.n}
                                </td>
                              </tr>
                            )
                          )}
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