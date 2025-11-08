"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getActivityDisplayName } from "@/lib/activities/registry";
import { getResultsRenderer } from "@/lib/activities/components";
import { IconResults } from "@/components/ui/Icons";

type Activity = { id: string; title?: string; type: string; status: string };

export default function ResultsPanel({ sessionId }: { sessionId: string }) {
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

  return (
    <Card>
      <CardHeader
        title={
          <>
            <IconResults className="text-[var(--brand)]" />
            <span>Results</span>
          </>
        }
        subtitle="Expand an activity to see its submissions and scores"
      />
      <CardBody>
        {activities.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No activities yet.</div>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => {
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
                      <div className="font-medium">{a.title || getActivityDisplayName(a.type)}</div>
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
                          {/* Loading / error / empty states */}
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
                            // Actual content rendering via registry
                            (() => {
                              const rr = getResultsRenderer(a.type);
                              if (!rr) return null;
                              if (rr.kind === "stocktake" && !Array.isArray(payload)) {
                                const Comp: any = rr.Component;
                                return <Comp stocktake={payload} />;
                              }
                              const Comp: any = rr.Component;
                              return <Comp subs={payload as any[]} />;
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

