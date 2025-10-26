"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Activity = {
  id: string;
  title?: string;
  type: string;
  status: string;
};

type VoteEntry = {
  voter_id: string;
  voter_name: string | null;
  value: number;
};

type Sub = {
  id: string;
  text: string;
  participant_name: string | null;
  n: number;
  avg: number | null;
  stdev: number | null;
  votes: VoteEntry[];
};

export default function ResultsPanel({ sessionId }: { sessionId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);

  // which accordion panels are open
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // per-activity results
  const [data, setData] = useState<Record<string, Sub[]>>({});

  // per-activity loading states
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // per-activity error messages
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

  // load list of activities for the session
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/activities?session_id=${sessionId}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          console.error(
            "[ResultsPanel] Failed to load activities:",
            j.error
          );
          setActivities([]);
          return;
        }

        setActivities(Array.isArray(j.activities) ? j.activities : []);
      } catch (err) {
        console.error("[ResultsPanel] Crash loading activities:", err);
        setActivities([]);
      }
    })();
  }, [sessionId]);

  // helper: fetch results for a single activity
  async function fetchActivityResults(id: string) {
    // mark just this activity as loading + clear previous error
    setLoadingMap((m) => ({ ...m, [id]: true }));
    setErrorMap((m) => ({ ...m, [id]: null }));

    try {
      const r = await fetch(`/api/activities/${id}/results`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error(
          "[ResultsPanel] Failed to load results for",
          id,
          j.error
        );
        setErrorMap((m) => ({
          ...m,
          [id]: j.error || "Failed to load results",
        }));
        return;
      }

      const arr: Sub[] = Array.isArray(j.submissions)
        ? j.submissions
        : [];

      setData((d) => ({
        ...d,
        [id]: arr,
      }));
      setErrorMap((m) => ({ ...m, [id]: null }));
    } catch (err) {
      console.error("[ResultsPanel] Crash fetching results for", id, err);
      setErrorMap((m) => ({
        ...m,
        [id]: "Failed to load results",
      }));
    } finally {
      setLoadingMap((m) => ({ ...m, [id]: false }));
    }
  }

  // expand/collapse handler
  async function toggle(id: string) {
    const nextOpen = !open[id];
    setOpen((prev) => ({ ...prev, [id]: nextOpen }));

    // if we just opened and we don't have data yet, fetch it
    if (nextOpen && !data[id]) {
      fetchActivityResults(id);
    }
  }

  // polling: refresh all open activities every 5s
  useEffect(() => {
    const iv = setInterval(() => {
      const openIds = Object.entries(open)
        .filter(([, v]) => v)
        .map(([k]) => k);

      if (openIds.length === 0) return;

      openIds.forEach((id) => {
        fetchActivityResults(id);
      });
    }, 5000);

    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Card>
      <CardHeader
        title="Results"
        subtitle="Expand an activity to see its submissions and scores"
      />
      <CardBody>
        {activities.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            No activities yet.
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => {
              const isOpen = !!open[a.id];
              const rows = data[a.id] || [];
              const isLoading = !!loadingMap[a.id];
              const err = errorMap[a.id] || null;

              return (
                <div
                  key={a.id}
                  className="rounded-md border border-white/10 bg-white/5"
                >
                  <button
                    onClick={() => toggle(a.id)}
                    className="flex w-full items-center justify-between p-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`activity-${a.id}-results`}
                  >
                    <div>
                      <div className="font-medium">
                        {a.title ||
                          (a.type === "brainstorm"
                            ? "Standard"
                            : "Stocktake")}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Status: {a.status}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted)]">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      id={`activity-${a.id}-results`}
                      className="border-t border-white/10 p-3"
                    >
                      {isLoading && rows.length === 0 && !err ? (
                        <div className="h-16 rounded bg-white/10 animate-pulse" />
                      ) : err ? (
                        <div className="text-sm text-red-300">
                          {err}
                        </div>
                      ) : rows.length === 0 ? (
                        <div className="text-sm text-[var(--muted)]">
                          No submissions yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rows.map((s) => (
                            <div
                              key={s.id}
                              className="rounded-md border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium break-words">
                                  {s.text}
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                  by{" "}
                                  {s.participant_name ||
                                    "Anonymous"}
                                </div>
                              </div>

                              <div className="mt-1 text-xs text-[var(--muted)]">
                                Avg:{" "}
                                {typeof s.avg === "number"
                                  ? s.avg.toFixed(2)
                                  : "—"}{" "}
                                • Stdev:{" "}
                                {typeof s.stdev === "number"
                                  ? s.stdev.toFixed(2)
                                  : "—"}{" "}
                                • N: {s.n}
                              </div>

                              {s.votes && s.votes.length > 0 && (
                                <div className="mt-2 text-xs text-[var(--muted)]/90">
                                  Votes:{" "}
                                  {s.votes.map((v, i) => (
                                    <span
                                      key={i}
                                      className="mr-3"
                                    >
                                      {v.value}
                                      {v.voter_name
                                        ? ` by ${v.voter_name}`
                                        : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}