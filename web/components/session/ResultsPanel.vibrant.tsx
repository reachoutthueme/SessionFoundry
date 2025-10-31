"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { IconResults } from "@/components/ui/Icons";

type Activity = { id: string; title?: string; type: string; status: string };

type Vote = { voter_id: string; voter_name: string | null; value: number };

type Sub = {
  id: string;
  text: string;
  participant_name: string | null;
  n: number;
  avg: number | null;
  stdev: number | null;
  votes: Vote[];
};

type StocktakeOut = {
  initiatives: {
    id: string;
    title: string;
    counts: Record<"stop" | "less" | "same" | "more" | "begin", number>;
    n: number;
    avg: number;
  }[];
  overall: { n: number; avg: number };
  order: Array<"stop" | "less" | "same" | "more" | "begin">;
};

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
        const r = await fetch(`/api/activities?session_id=${sessionId}`, {
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
      const r = await fetch(`/api/activities/${id}/results`, {
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
                      <div className="font-medium">
                        {a.title ||
                          (a.type === "brainstorm"
                            ? "Standard activity"
                            : a.type === "stocktake"
                            ? "Process stocktake"
                            : "Assignment")}
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
                        // Actual content rendering
                        <>
                          {a.type === "stocktake" && !Array.isArray(payload) ? (
                            <StocktakeBlock stocktake={payload as StocktakeOut} />
                          ) : (
                            <BrainstormBlock subs={payload as Sub[]} />
                          )}
                        </>
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

/* ---------- STOCKTAKE VIEW ---------- */

function StocktakeBlock({ stocktake }: { stocktake: StocktakeOut }) {
  const s = stocktake;

  const labelFor: Record<string, string> = {
    stop: "Stop",
    less: "Do less",
    same: "Stay the same",
    more: "Increase",
    begin: "Begin / Highly increase",
  };

  return (
    <div className="space-y-3">
      {/* overall summary */}
      <div className="flex items-center gap-3 text-xs text-[var(--muted)] flex-wrap">
        <span>Overall Avg:</span>
        <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">
          {s.overall.avg.toFixed(2)}
        </span>
        <span>Responses:</span>
        <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">
          {s.overall.n}
        </span>
      </div>

      {/* each initiative */}
      <div className="space-y-2">
        {s.initiatives.map((it) => (
          <div
            key={it.id}
            className="p-3 rounded-md border border-white/10 bg-white/5"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{it.title}</div>
              <div className="text-xs text-[var(--muted)]">
                Avg:{" "}
                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[var(--text)]">
                  {it.avg.toFixed(2)}
                </span>{" "}
                · N: {it.n}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
              {s.order.map((k) => (
                <div
                  key={k}
                  className="px-2 py-1 rounded border border-white/10 bg-white/5 flex items-center justify-between"
                >
                  <span className="mr-2 truncate">{labelFor[k]}</span>
                  <span className="font-mono">{it.counts[k] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- BRAINSTORM / ASSIGNMENT VIEW ---------- */

function BrainstormBlock({ subs }: { subs: Sub[] }) {
  // Compute normalization ranges to color the metric badges
  const avgVals = subs
    .map((s) => s.avg ?? 0)
    .filter((v) => Number.isFinite(v));
  const stVals = subs
    .map((s) => s.stdev ?? 0)
    .filter((v) => Number.isFinite(v));
  const nVals = subs.map((s) => s.n ?? 0);
  const consVals = subs
    .map((s) => 1 / (1 + ((s.stdev ?? 0) as number)))
    .filter((v) => Number.isFinite(v));

  function minMax(vals: number[]) {
    if (!vals.length) return { min: 0, max: 0 };
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }

  const avgMM = minMax(avgVals);
  const stMM = minMax(stVals);
  const nMM = minMax(nVals);
  const cMM = minMax(consVals);

  function norm(
    v: number,
    mm: { min: number; max: number },
    invert = false
  ) {
    const d = mm.max - mm.min;
    if (d <= 0) return 0.5;
    const x = (v - mm.min) / d;
    return invert ? 1 - x : x;
  }

  function badge(label: string, valStr: string, score: number) {
    // traffic light tone based on percentile score
    let tone = "border-white/10 bg-white/5 text-[var(--text)]";
    if (score >= 0.67) {
      tone =
        "border-green-400/30 bg-green-500/15 text-[var(--text)]";
    } else if (score >= 0.33) {
      tone =
        "border-amber-400/30 bg-amber-500/15 text-[var(--text)]";
    } else {
      tone = "border-red-400/30 bg-red-500/15 text-[var(--text)]";
    }
    return (
      <span className={`px-1.5 py-0.5 rounded border ${tone}`}>
        {label} {valStr}
      </span>
    );
  }

  // Sorting + filtering state
  const [sortKey, setSortKey] = useState<
    "avg" | "stdev" | "n" | "consensus" | "idea" | "author"
  >("avg");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [ideaQuery, setIdeaQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [minAvg, setMinAvg] = useState<string>("");
  const [maxStdev, setMaxStdev] = useState<string>("");
  const [minN, setMinN] = useState<string>("");

  function getSortValue(s: Sub) {
    const consensusVal = 1 / (1 + ((s.stdev ?? 0) as number));
    switch (sortKey) {
      case "avg":
        return s.avg ?? -Infinity;
      case "stdev":
        return s.stdev ?? Infinity;
      case "n":
        return s.n ?? 0;
      case "consensus":
        return consensusVal;
      case "idea":
        return (s.text || "").toLowerCase();
      case "author":
        return (s.participant_name || "").toLowerCase();
    }
  }

  const filteredSorted = useMemo(() => {
    const q = ideaQuery.trim().toLowerCase();
    const qa = authorQuery.trim().toLowerCase();
    const minAvgNum = minAvg.trim() === "" ? null : Number(minAvg);
    const maxStNum = maxStdev.trim() === "" ? null : Number(maxStdev);
    const minNNum = minN.trim() === "" ? null : Number(minN);

    const rows = subs.filter((s) => {
      if (q && !(s.text || "").toLowerCase().includes(q)) return false;
      if (qa && !(s.participant_name || "").toLowerCase().includes(qa)) return false;
      if (minAvgNum !== null && Number.isFinite(minAvgNum)) {
        if ((s.avg ?? -Infinity) < minAvgNum) return false;
      }
      if (maxStNum !== null && Number.isFinite(maxStNum)) {
        if ((s.stdev ?? Infinity) > maxStNum) return false;
      }
      if (minNNum !== null && Number.isFinite(minNNum)) {
        if ((s.n ?? 0) < minNNum) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (av === bv) return 0;
      const dir = sortDir === "asc" ? 1 : -1;
      // string vs number safe compare
      if (typeof av === "string" && typeof bv === "string") {
        return av < bv ? -1 * dir : 1 * dir;
      }
      return (Number(av) - Number(bv)) * dir;
    });

    return rows;
  }, [subs, ideaQuery, authorQuery, minAvg, maxStdev, minN, sortKey, sortDir]);

  function onHeaderClick(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "stdev" ? "asc" : "desc"); // stdev low→high by default
    }
  }

  function sortIndicator(k: typeof sortKey) {
    if (sortKey !== k) return null;
    return <span className="ml-1 opacity-70">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <div className="space-y-4">
      {/* Scatter plot of consensus vs avg */}
      <Scatter
        points={subs.map((s, i) => ({
          id: s.id,
          label: s.text,
          avg: s.avg ?? 0,
          stdev: s.stdev ?? 0,
          n: s.n,
        }))}
      />

      {/* Tabular summary of ideas with metrics */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left cursor-pointer" onClick={() => onHeaderClick("idea")}>
                Idea{sortIndicator("idea")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("avg")}>
                Avg{sortIndicator("avg")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("stdev")}>
                Stdev{sortIndicator("stdev")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("n")}>
                N{sortIndicator("n")}
              </th>
              <th className="px-3 py-2 text-right cursor-pointer" onClick={() => onHeaderClick("consensus")}>
                Consensus{sortIndicator("consensus")}
              </th>
              <th className="px-3 py-2 text-left cursor-pointer" onClick={() => onHeaderClick("author")}>
                Author{sortIndicator("author")}
              </th>
            </tr>
            {/* Filter row */}
            <tr className="text-xs">
              <th />
              <th className="px-3 py-1">
                <input
                  placeholder="Filter idea"
                  value={ideaQuery}
                  onChange={(e) => setIdeaQuery(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none"
                />
              </th>
              <th className="px-3 py-1 text-right">
                <input
                  placeholder=">= avg"
                  value={minAvg}
                  onChange={(e) => setMinAvg(e.target.value)}
                  className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none"
                />
              </th>
              <th className="px-3 py-1 text-right">
                <input
                  placeholder="<= stdev"
                  value={maxStdev}
                  onChange={(e) => setMaxStdev(e.target.value)}
                  className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none"
                />
              </th>
              <th className="px-3 py-1 text-right">
                <input
                  placeholder=">= N"
                  value={minN}
                  onChange={(e) => setMinN(e.target.value)}
                  className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right outline-none"
                />
              </th>
              <th />
              <th className="px-3 py-1">
                <input
                  placeholder="Filter author"
                  value={authorQuery}
                  onChange={(e) => setAuthorQuery(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((s, idx) => {
                const avgStr = s.avg == null ? "-" : (s.avg as number).toFixed(2);
                const stdevStr = s.stdev == null ? "-" : (s.stdev as number).toFixed(2);
                const nStr = String(s.n ?? 0);
                const consensusVal = 1 / (1 + ((s.stdev ?? 0) as number));
                const consensusStr = `${Math.round(consensusVal * 100)}%`;
                return (
                  <tr key={s.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-3 py-2 text-left align-top">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-[var(--brand)]/20 border border-[var(--border)] text-[var(--text)]">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium leading-snug break-words">{s.text}</div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {badge("", avgStr, norm(s.avg ?? 0, avgMM, false))}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {badge("", stdevStr, norm(s.stdev ?? 0, stMM, true))}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {badge("", nStr, norm(s.n ?? 0, nMM, false))}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {badge("", consensusStr, norm(consensusVal, cMM, false))}
                    </td>
                    <td className="px-3 py-2 text-left align-top text-xs text-[var(--muted)]">
                      {s.participant_name || "Anonymous"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- SCATTER VISUALIZATION ---------- */

function Scatter({
  points,
}: {
  points: {
    id: string;
    label: string;
    avg: number;
    stdev: number;
    n: number;
  }[];
}) {
  // decorate each point with idx + consensus for plotting
  const rows = useMemo(() => {
    return points.map((p, i) => ({
      idx: i + 1,
      ...p,
      consensus: 1 / (1 + (isFinite(p.stdev) ? p.stdev : 0)),
    }));
  }, [points]);

  const maxAvg = useMemo(() => {
    return rows.reduce(
      (m, r) => Math.max(m, isFinite(r.avg) ? r.avg : 0),
      0
    );
  }, [rows]);

  const maxCons = 1; // consensus is 0..1 by definition

  // chart dims
  const W = 560;
  const H = 180;
  const px = 48;
  const py = 24;
  const innerW = W - px * 2;
  const innerH = H - py * 2;

  function x(cons: number) {
    return (
      px +
      (innerW * Math.max(0, Math.min(maxCons, cons))) / maxCons
    );
  }

  function y(avg: number) {
    const m = maxAvg || 1;
    return (
      py +
      innerH -
      (innerH * Math.max(0, Math.min(m, avg))) / m
    );
  }

  const ticksY = 4;
  const ticksX = 4;

  return (
    <Card>
      <CardHeader
        title={
          <>
            <IconResults className="text-[var(--brand)]" />
            <span>Consensus vs. Average</span>
          </>
        }
        subtitle={
          "X: consensus (1/(1+stdev)) - higher is better | Y: average score"
        }
      />
      <CardBody className="overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ height: H }}
        >
          {/* Axes */}
          <line
            x1={px}
            y1={py}
            x2={px}
            y2={py + innerH}
            stroke="currentColor"
            strokeOpacity="0.2"
          />
          <line
            x1={px}
            y1={py + innerH}
            x2={px + innerW}
            y2={py + innerH}
            stroke="currentColor"
            strokeOpacity="0.2"
          />

          {/* Y ticks (avg) */}
          {Array.from({ length: ticksY + 1 }).map((_, i) => {
            const val = (maxAvg * i) / ticksY;
            const yy = y(val);
            return (
              <g key={`yt${i}`}>
                <line
                  x1={px - 4}
                  x2={px}
                  y1={yy}
                  y2={yy}
                  stroke="currentColor"
                  strokeOpacity="0.3"
                />
                <text
                  x={px - 8}
                  y={yy + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                  opacity="0.6"
                >
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* X ticks (consensus) */}
          {Array.from({ length: ticksX + 1 }).map((_, i) => {
            const val = (maxCons * i) / ticksX;
            const xx = x(val);
            return (
              <g key={`xt${i}`}>
                <line
                  x1={xx}
                  x2={xx}
                  y1={py + innerH}
                  y2={py + innerH + 4}
                  stroke="currentColor"
                  strokeOpacity="0.3"
                />
                <text
                  x={xx}
                  y={py + innerH + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  opacity="0.6"
                >
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* points */}
          {rows.map((r) => (
            <g key={r.id}>
              <title>{`${r.idx}. ${r.label}\nAvg: ${
                isFinite(r.avg) ? r.avg.toFixed(2) : "-"
              } | Stdev: ${
                isFinite(r.stdev) ? r.stdev.toFixed(2) : "-"
              }`}</title>

              <circle
                cx={x(r.consensus)}
                cy={y(r.avg)}
                r={8}
                fill="var(--brand)"
                fillOpacity="0.95"
                stroke="currentColor"
                strokeOpacity="0.15"
              />
              <text
                x={x(r.consensus)}
                y={y(r.avg) + 3}
                textAnchor="middle"
                fontSize="10"
                fill="#ffffff"
              >
                {r.idx}
              </text>
            </g>
          ))}
        </svg>
      </CardBody>
    </Card>
  );
}
