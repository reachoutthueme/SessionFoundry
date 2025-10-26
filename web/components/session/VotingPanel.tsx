"use client";

import { useEffect, useState } from "react";
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
  // slider values keyed by submission id
  const [values, setValues] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);

  // total budget for this activity (0 means rating mode instead of allocation mode)
  const [budget, setBudget] = useState<number>(0);

  // is submitAll currently in-flight?
  const [submitting, setSubmitting] = useState(false);

  // resolved activity id (in case caller only gave sessionId)
  const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(
    null
  );

  // leaderboard after submission
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // helper to derive leaderboard from /results response
  function extractLeaderboard(raw: any): LeaderboardRow[] {
    const rows = Array.isArray(raw?.submissions)
      ? (raw.submissions as any[])
      : [];

    return rows
      .map((s: any) => {
        const votesArr = Array.isArray(s.votes) ? s.votes : [];
        const totalPoints = votesArr.reduce(
          (acc: number, v: any) => acc + Number(v.value || 0),
          0
        );
        const nVotes =
          typeof s.n === "number"
            ? s.n
            : votesArr.length;

        return {
          id: String(s.id),
          text: String(s.text ?? ""),
          total: totalPoints,
          n: nVotes,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  // initial load
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

        const jSubs = await rSubs.json().catch(() => ({}));
        const jActs = await rActs.json().catch(() => ({}));

        if (!rSubs.ok) {
          console.error("[VotingPanel] load submissions error:", jSubs.error);
          toast(jSubs.error || "Failed to load items for voting", "error");
          setSubs([]);
          setValues({});
          setBudget(0);
          setResolvedActivityId(activityId || null);
          setLoading(false);
          return;
        }

        // map submissions into {id,text}
        const list: Sub[] = Array.isArray(jSubs.submissions)
          ? jSubs.submissions.map((x: any) => ({
              id: String(x.id),
              text: String(x.text ?? ""),
            }))
          : [];
        setSubs(list);

        // init all sliders to 0
        const zeroVals: Record<string, number> = {};
        list.forEach((s) => {
          zeroVals[s.id] = 0;
        });
        setValues(zeroVals);

        // choose an activity, read points_budget
        const acts: any[] = Array.isArray(jActs.activities)
          ? jActs.activities
          : [];
        const chosenAct =
          acts.find((a) => a.id === activityId) ||
          acts[0] ||
          null;

        const cfgBudget = Number(chosenAct?.config?.points_budget ?? 0);
        setBudget(Number.isFinite(cfgBudget) ? cfgBudget : 0);
        setResolvedActivityId(activityId || (chosenAct ? String(chosenAct.id) : null));
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

  // total points allocated by the user
  const total = Object.values(values).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0
  );

  // if we're in budget mode, what's left
  const remaining = budget > 0 ? Math.max(0, budget - total) : 0;

  // update slider for a single item while enforcing rules
  function updateValue(id: string, rawNext: number) {
    // per-slider ceiling:
    //   - budget mode: can't exceed total budget anyway
    //   - rating mode: 0–10
    const cap = budget > 0 ? budget : 10;
    let next = Math.round(
      Math.max(0, Math.min(cap, Number(rawNext) || 0))
    );

    const prevForThis = values[id] ?? 0;
    const sumWithoutThis = total - prevForThis;

    if (budget > 0) {
      // enforce global budget: don't allow this change to push us past total
      const allowedForThis = Math.max(0, budget - sumWithoutThis);
      next = Math.min(next, allowedForThis);
    }

    setValues((old) => ({ ...old, [id]: next }));
  }

  async function submitAll() {
    // simple validation
    if (budget > 0 && (total <= 0 || total > budget)) {
      toast(`Use up to ${budget} points (currently ${total})`, "error");
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

      const payload = activityId
        ? { activity_id: activityId, items }
        : { session_id: sessionId, items };

      const r = await fetch("/api/votes/bulk", {
        method: "POST",
        credentials: "include", // send participant cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const textResp = await r.text();
      let j: any = {};
      try {
        j = textResp ? JSON.parse(textResp) : {};
      } catch {
        // ignore non-JSON error bodies
      }

      if (!r.ok) {
        console.error("[VotingPanel] submit error:", j.error || textResp);
        toast(j.error || "Failed to submit votes", "error");
        setSubmitting(false);
        return;
      }

      toast("Votes submitted", "success");
      setSubmitted(true);
      setShowLeaderboard(true);

      // build first leaderboard snapshot
      if (resolvedActivityId) {
        try {
          const res = await fetch(
            `/api/activities/${resolvedActivityId}/results`,
            { cache: "no-store" }
          );
          const data = await res.json();
          setLeaderboard(extractLeaderboard(data));
        } catch (err) {
          console.error(
            "[VotingPanel] leaderboard initial fetch error:",
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
                onClick={() => setShowLeaderboard((s) => !s)}
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
                    (budget > 0 && (total <= 0 || total > budget))
                  }
                >
                  {submitting ? "Submitting…" : "Submit all votes"}
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
                          {leaderboard.map((row, idx) => (
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