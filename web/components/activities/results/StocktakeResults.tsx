"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

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

export default function StocktakeResults({
  stocktake,
}: {
  stocktake: StocktakeOut;
  mode?: "present" | "analyze";
}) {
  const s = stocktake;

  const ranked = useMemo(() => {
    const z = 1; // simple ~68% CI
    return s.initiatives
      .map((it) => {
        const n = it.n || 0;
        const counts = it.counts;
        const mapVal: Record<keyof typeof counts, number> = {
          stop: -2,
          less: -1,
          same: 0,
          more: 1,
          begin: 2,
        };
        const total = Object.values(counts).reduce((acc, c) => acc + (c || 0), 0);
        const mean = it.avg;
        let secondMoment = 0;
        if (total > 0) {
          secondMoment =
            (mapVal.stop * mapVal.stop * (counts.stop || 0) +
              mapVal.less * mapVal.less * (counts.less || 0) +
              mapVal.same * mapVal.same * (counts.same || 0) +
              mapVal.more * mapVal.more * (counts.more || 0) +
              mapVal.begin * mapVal.begin * (counts.begin || 0)) / total;
        }
        const variance = Math.max(0, secondMoment - mean * mean);
        const stdev = Math.sqrt(variance);
        const stderr = n > 0 ? stdev / Math.sqrt(n) : 0;
        const lower = mean - z * stderr;
        const consensus = 1 / (1 + stdev);
        return {
          ...it,
          _stdev: stdev,
          supportScore: lower,
          consensusScore: consensus,
        };
      })
      .sort((a, b) => (b.supportScore ?? 0) - (a.supportScore ?? 0));
  }, [s]);

  const labelFor: Record<string, string> = {
    stop: "Stop",
    less: "Do less",
    same: "Stay the same",
    more: "Increase",
    begin: "Begin / Highly increase",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-3 flex-wrap">
          <span>Overall Avg:</span>
          <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">
            {s.overall.avg.toFixed(2)}
          </span>
          <span>Responses:</span>
          <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text)]">
            {s.overall.n}
          </span>
        </div>
        {ranked.length > 0 && (
          <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-[var(--text)] mb-1">
              Top initiatives by robust support
            </div>
            {ranked.slice(0, 3).map((it, idx) => {
              const n = it.n || 0;
              const stderr = n > 0 ? it._stdev / Math.sqrt(n) : 0;
              const ciWidth = stderr;
              const avgStr = it.avg.toFixed(2);
              const ciStr =
                n > 1 && Number.isFinite(ciWidth)
                  ? `±${ciWidth.toFixed(2)}`
                  : "";
              return (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-2 text-[10px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[var(--text)]">
                      {idx + 1}. {it.title}
                    </div>
                    <div>
                      Avg {avgStr} {ciStr && `(${ciStr})`} · n={n} · consensus≈{" "}
                      {it.consensusScore.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {s.initiatives.map((it) => (
          <div key={it.id} className="p-3 rounded-md border border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div className="font-medium">{it.title}</div>
              <div className="text-xs text-[var(--muted)]">
                Avg:{" "}
                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[var(--text)]">
                  {it.avg.toFixed(2)}
                </span>{" "}
                N: {it.n}
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
