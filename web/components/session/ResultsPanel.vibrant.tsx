"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getActivityDisplayName } from "@/lib/activities/registry";
import { getResultsRenderer } from "@/lib/activities/components";
import { IconResults } from "@/components/ui/Icons";

type Activity = { id: string; title?: string; type: string; status: string };

export default function ResultsPanel({
  sessionId,
  activityId,
}: {
  sessionId: string;
  activityId?: string | null;
}) {
  const [viewMode, setViewMode] = useState<"present" | "analyze">("analyze");
  const [activities, setActivities] = useState<Activity[]>([]);

  // accordion open state per activity
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // data per activity:
  //  - for brainstorm/assignment: Sub[]
  //  - for stocktake: StocktakeOut
  const [data, setData] = useState<Record<string, any>>({});

  // loading state per activity
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // error per activity
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

  // initial load of activities in this session
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(`/api/activities?session_id=${sessionId}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          console.error("[ResultsPanel] Failed to load activities:", j.error);
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

  // helper: fetch results for a single activity id
  async function fetchActivityResults(id: string) {
    // set loading + clear error for this activity only
    setLoadingMap((m) => ({ ...m, [id]: true }));
    setErrorMap((m) => ({ ...m, [id]: null }));

    try {
      const r = await apiFetch(`/api/activities/${id}/results`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error("[ResultsPanel] Failed to load results for", id, j.error);
        setErrorMap((m) => ({
          ...m,
          [id]: j.error || "Failed to load results",
        }));
        return;
      }

      // The API returns:
      //   { stocktake: StocktakeOut }  OR  { submissions: Sub[] }
      const payload = j.stocktake ?? j.submissions ?? [];
      setData((d) => ({ ...d, [id]: payload }));
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

  // open/close an activity panel
  async function toggle(id: string) {
    const nextOpen = !open[id];
    setOpen((o) => ({ ...o, [id]: nextOpen }));

    // if we just opened it and we don't already have data, load it
    if (nextOpen && !data[id]) {
      fetchActivityResults(id);
    }
  }

  // When a specific activity is selected externally, auto-open and load it
  useEffect(() => {
    if (!activityId) return;
    const exists = activities.some((a) => a.id === activityId);
    if (!exists) return;

    setOpen((o) => (o[activityId] ? o : { ...o, [activityId]: true }));

    if (!data[activityId]) {
      fetchActivityResults(activityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, activities]);

  // poll every 5s for all currently-open activities (live voting etc.)
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

  const visibleActivities = useMemo(() => {
    if (activityId) {
      return activities.filter((a) => a.id === activityId);
    }
    const current =
      activities.find(
        (a) => a.status === "Active" || a.status === "Voting"
      ) || null;
    return current ? [current] : activities;
  }, [activities, activityId]);

  return (
    <Card>
      <CardHeader
        title={
          <>
            <IconResults className="text-[var(--brand)]" />
            <span>Results</span>
          </>
        }
        subtitle={
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">
              {visibleActivities.length === 1
                ? viewMode === "analyze"
                  ? "Live submissions and metrics for the current activity"
                  : "Clean view for presenting live results"
                : "Expand an activity to see its submissions and scores"}
            </span>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode("present")}
                className={`px-2 py-0.5 rounded-full ${
                  viewMode === "present"
                    ? "bg-[var(--brand)] text-[var(--btn-on-brand)]"
                    : "text-[var(--muted)] hover:bg-white/5"
                }`}
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => setViewMode("analyze")}
                className={`px-2 py-0.5 rounded-full ${
                  viewMode === "analyze"
                    ? "bg-[var(--brand)] text-[var(--btn-on-brand)]"
                    : "text-[var(--muted)] hover:bg-white/5"
                }`}
              >
                Analyze
              </button>
            </div>
          </div>
        }
      />
      <CardBody>
        {visibleActivities.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No activities yet.</div>
        ) : visibleActivities.length === 1 ? (
          (() => {
            const a = visibleActivities[0];
            const payload = data[a.id];
            const isLoading = !!loadingMap[a.id];
            const error = errorMap[a.id] || null;

            if (isLoading && !payload && !error) {
              return (
                <div className="h-24 rounded bg-white/10 animate-pulse" />
              );
            }

            if (error) {
              return (
                <div className="text-sm text-red-300">{error}</div>
              );
            }

            if (
              !payload ||
              (Array.isArray(payload) && payload.length === 0)
            ) {
              return (
                <div className="text-sm text-[var(--muted)]">
                  No submissions yet.
                </div>
              );
            }

            const rr = getResultsRenderer(a.type);
            if (!rr) return null;

            let content: React.ReactNode = null;
            if (rr.kind === "stocktake" && !Array.isArray(payload)) {
              const Comp: any = rr.Component;
              content = <Comp stocktake={payload} mode={viewMode} />;
            } else {
              const Comp: any = rr.Component;
              const hideTable =
                rr.kind === "subs" &&
                viewMode === "analyze" &&
                Array.isArray(payload);
              content = (
                <Comp
                  subs={payload as any[]}
                  mode={viewMode}
                  hideTable={hideTable}
                />
              );
            }

            if (viewMode === "analyze" && Array.isArray(payload)) {
              const count = payload.length;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="truncate max-w-[60%]">
                      {a.title || getActivityDisplayName(a.type)}
                    </span>
                    <span>{count} submission{count === 1 ? "" : "s"}</span>
                  </div>
                  {content}
                </div>
              );
            }

            return content;
          })()
        ) : (
          <div className="space-y-2">
            {visibleActivities.map((a) => {
              const isOpen = !!open[a.id];
              const payload = data[a.id];
              const isLoading = !!loadingMap[a.id];
              const error = errorMap[a.id] || null;
              const panelId = `results-${a.id}`;

              return (
                <div
                  key={a.id}
                  className="rounded-md border border-white/10 bg-white/5"
                >
                  <button
                    onClick={() => toggle(a.id)}
                    className="w-full text-left p-3 flex items-center justify-between"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <div>
                      <div className="font-medium">
                        {a.title || getActivityDisplayName(a.type)}
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
                      id={panelId}
                      className="p-3 border-t border-white/10"
                    >
                      {isLoading && !payload && !error ? (
                        <div className="h-16 rounded bg-white/10 animate-pulse" />
                      ) : error ? (
                        <div className="text-sm text-red-300">{error}</div>
                      ) : !payload ||
                        (Array.isArray(payload) && payload.length === 0) ? (
                        <div className="text-sm text-[var(--muted)]">
                          No submissions yet.
                        </div>
                      ) : (
                        (() => {
                          const rr = getResultsRenderer(a.type);
                          if (!rr) return null;
                          if (rr.kind === "stocktake" && !Array.isArray(payload)) {
                            const Comp: any = rr.Component;
                            return <Comp stocktake={payload} mode={viewMode} />;
                          }
                          const Comp: any = rr.Component;
                          return <Comp subs={payload as any[]} mode={viewMode} />;
                        })()
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

