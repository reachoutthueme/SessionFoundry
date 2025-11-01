"use client";

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

export default function StocktakeResults({ stocktake }: { stocktake: StocktakeOut }) {
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

