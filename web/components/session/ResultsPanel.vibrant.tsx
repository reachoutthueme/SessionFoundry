"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { IconResults } from "@/components/ui/Icons";

type Activity = { id: string; title?: string; type: string; status: string };
type Vote = { voter_id: string; voter_name: string | null; value: number };
type Sub = { id: string; text: string; participant_name: string | null; n: number; avg: number | null; stdev: number | null; votes: Vote[] };
type StocktakeOut = { initiatives: { id: string; title: string; counts: Record<'stop'|'less'|'same'|'more'|'begin', number>; n: number; avg: number }[]; overall: { n: number; avg: number }; order: Array<'stop'|'less'|'same'|'more'|'begin'> };

export default function ResultsPanel({ sessionId }: { sessionId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" });
      const j = await r.json();
      setActivities(j.activities ?? []);
    })();
  }, [sessionId]);

  async function toggle(id: string) {
    const next = !open[id];
    setOpen((o) => ({ ...o, [id]: next }));
    if (next && !data[id]) {
      setLoading(true);
      const r = await fetch(`/api/activities/${id}/results`, { cache: "no-store" });
      const j = await r.json();
      setData((d) => ({ ...d, [id]: (j.stocktake ?? j.submissions ?? []) }));
      setLoading(false);
    }
  }

  useEffect(() => {
    const iv = setInterval(async () => {
      const openIds = Object.entries(open)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (openIds.length === 0) return;
      await Promise.all(
        openIds.map(async (id) => {
          const r = await fetch(`/api/activities/${id}/results`, { cache: "no-store" });
          const j = await r.json();
          setData((d) => ({ ...d, [id]: (j.stocktake ?? j.submissions ?? []) }));
        })
      );
    }, 5000);
    return () => clearInterval(iv);
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
            {activities.map((a) => (
              <div key={a.id} className="rounded-md border border-white/10 bg-white/5">
                <button onClick={() => toggle(a.id)} className="w-full text-left p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {a.title || (a.type === "brainstorm" ? "Standard activity" : a.type === "stocktake" ? "Process stocktake" : "Assignment")}
                    </div>
                    <div className="text-xs text-[var(--muted)]">Status: {a.status}</div>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{open[a.id] ? "Hide" : "Show"}</span>
                </button>
                {open[a.id] && (
                  <div className="p-3 border-t border-white/10">
                    {(() => {
                      const payload = data[a.id];
                      if (!payload) return <div className="text-sm text-[var(--muted)]">No data.</div>;
                      if (a.type === 'stocktake' && !Array.isArray(payload)) {
                        const s = payload as StocktakeOut;
                        const labelFor: Record<string,string> = { stop: 'Stop', less: 'Do less', same: 'Stay the same', more: 'Increase', begin: 'Begin / Highly increase' };
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                              <span>Overall Avg:</span>
                              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">{s.overall.avg.toFixed(2)}</span>
                              <span>Responses:</span>
                              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">{s.overall.n}</span>
                            </div>
                            <div className="space-y-2">
                              {s.initiatives.map((it) => (
                                <div key={it.id} className="p-3 rounded-md border border-white/10 bg-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">{it.title}</div>
                                    <div className="text-xs text-[var(--muted)]">Avg: <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[var(--text)]">{it.avg.toFixed(2)}</span> · N: {it.n}</div>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                                    {s.order.map((k) => (
                                      <div key={k} className="px-2 py-1 rounded border border-white/10 bg-white/5 flex items-center justify-between">
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
                      const rows = (payload ?? []) as Sub[];
                      const avgVals = rows.map((s) => (s.avg ?? 0)).filter((v) => isFinite(v));
                      const stVals = rows.map((s) => (s.stdev ?? 0)).filter((v) => isFinite(v));
                      const nVals = rows.map((s) => (s.n ?? 0));
                      const consVals = stVals.map((v) => 1 / (1 + v));
                      const minMax = (vals: number[]) => {
                        if (!vals.length) return { min: 0, max: 0 };
                        return { min: Math.min(...vals), max: Math.max(...vals) };
                      };
                      const avgMM = minMax(avgVals);
                      const stMM = minMax(stVals);
                      const nMM = minMax(nVals);
                      const cMM = minMax(consVals);
                      const norm = (v: number, mm: { min: number; max: number }, invert = false) => {
                        const d = mm.max - mm.min;
                        if (d <= 0) return 0.5;
                        const x = (v - mm.min) / d;
                        return invert ? 1 - x : x;
                      };
                      const badge = (label: string, valStr: string, score: number) => {
                        let tone = 'border-white/10 bg-white/5';
                        if (score >= 0.67) tone = 'border-green-400/30 bg-green-500/15 text-[var(--text)]';
                        else if (score >= 0.33) tone = 'border-amber-400/30 bg-amber-500/15 text-[var(--text)]';
                        else tone = 'border-red-400/30 bg-red-500/15 text-[var(--text)]';
                        return (
                          <span className={`px-1.5 py-0.5 rounded border ${tone}`}>{label} {valStr}</span>
                        );
                      };
                    return loading && !data[a.id] ? (
                      <div className="h-16 rounded bg-white/10 animate-pulse" />
                    ) : (data[a.id] ?? []).length === 0 ? (
                      <div className="text-sm text-[var(--muted)]">No submissions yet.</div>
                    ) : (
                      <div className="space-y-4">
                        <Scatter
                          points={(data[a.id] ?? []).map((s, i) => ({ id: s.id, label: s.text, avg: s.avg ?? 0, stdev: s.stdev ?? 0, n: s.n }))}
                        />
                        {(data[a.id] ?? []).map((s, idx) => (
                          <div key={s.id} className="p-3 rounded-md bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-[var(--brand)]/20 border border-[var(--border)] text-[var(--text)]">
                                  {idx + 1}
                                </span>
                                <div className="font-medium">{s.text}</div>
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                by {s.participant_name || "Anonymous"}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)] flex items-center gap-2">
                              {badge('Avg', s.avg === null ? '-' : (s.avg as number).toFixed(2), norm((s.avg ?? 0), avgMM, false))}
                              {badge('Stdev', s.stdev === null ? '-' : (s.stdev as number).toFixed(2), norm((s.stdev ?? 0), stMM, true))}
                              {badge('N', String(s.n ?? 0), norm((s.n ?? 0), nMM, false))}
                              {badge(
                                'Consensus',
                                `${Math.round((1 / (1 + ((s.stdev ?? 0) as number))) * 100)}%`,
                                norm(1 / (1 + ((s.stdev ?? 0) as number)), cMM, false)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Scatter({ points }: { points: { id: string; label: string; avg: number; stdev: number; n: number }[] }) {
  const rows = useMemo(
    () => points.map((p, i) => ({ idx: i + 1, ...p, consensus: 1 / (1 + (isFinite(p.stdev) ? p.stdev : 0)) })),
    [points]
  );
  const maxAvg = useMemo(() => rows.reduce((m, r) => Math.max(m, isFinite(r.avg) ? r.avg : 0), 0), [rows]);
  const maxCons = 1;

  const W = 560;
  const H = 180;
  const px = 48;
  const py = 24;
  const innerW = W - px * 2;
  const innerH = H - py * 2;
  function x(cons: number) {
    return px + (innerW * Math.max(0, Math.min(maxCons, cons))) / maxCons;
  }
  function y(avg: number) {
    const m = maxAvg || 1;
    return py + innerH - (innerH * Math.max(0, Math.min(m, avg))) / m;
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
        subtitle={"X: consensus (1/(1+stdev)) - higher is better | Y: average score"}
      />
      <CardBody className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ height: H }}>
          <line x1={px} y1={py} x2={px} y2={py + innerH} stroke="currentColor" strokeOpacity="0.2" />
          <line x1={px} y1={py + innerH} x2={px + innerW} y2={py + innerH} stroke="currentColor" strokeOpacity="0.2" />

          {Array.from({ length: ticksY + 1 }).map((_, i) => {
            const val = (maxAvg * i) / ticksY;
            const yy = y(val);
            return (
              <g key={`yt${i}`}>
                <line x1={px - 4} x2={px} y1={yy} y2={yy} stroke="currentColor" strokeOpacity="0.3" />
                <text x={px - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {Array.from({ length: ticksX + 1 }).map((_, i) => {
            const val = (maxCons * i) / ticksX;
            const xx = x(val);
            return (
              <g key={`xt${i}`}>
                <line x1={xx} x2={xx} y1={py + innerH} y2={py + innerH + 4} stroke="currentColor" strokeOpacity="0.3" />
                <text x={xx} y={py + innerH + 14} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {rows.map((r) => (
            <g key={r.id}>
              <title>{`${r.idx}. ${r.label}\nAvg: ${isFinite(r.avg) ? r.avg.toFixed(2) : "-"} | Stdev: ${
                isFinite(r.stdev) ? r.stdev.toFixed(2) : "-"
              }`}</title>
              <circle cx={x(r.consensus)} cy={y(r.avg)} r={8} fill="var(--brand)" fillOpacity="0.95" stroke="currentColor" strokeOpacity="0.15" />
              <text x={x(r.consensus)} y={y(r.avg) + 3} textAnchor="middle" fontSize="10" fill="#ffffff">
                {r.idx}
              </text>
            </g>
          ))}
        </svg>
      </CardBody>
    </Card>
  );
}
