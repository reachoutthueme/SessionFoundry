"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Row = { group_id: string; group_name: string; total: number };

export default function OverallLeaderboard({ sessionId, onClose }: { sessionId: string; onClose?: ()=>void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load(initial = false) {
    try {
      const r = await fetch(`/api/leaderboard?session_id=${sessionId}`, { cache: "no-store" });
      const j = await r.json();
      const next: Row[] = j.leaderboard ?? [];
      setRows(prev => {
        if (!prev || prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].group_id !== next[i].group_id || prev[i].total !== next[i].total) return next;
        }
        return prev;
      });
    } finally {
      if (initial) setLoaded(true);
    }
  }
  useEffect(() => {
    load(true);
    const iv = setInterval(() => load(false), 5000);
    return () => clearInterval(iv);
  }, [sessionId]);

  return (
    <Card>
      <CardHeader title="Overall Leaderboard" subtitle="Totals across all activities" />
      <CardBody>
        {!loaded ? (
          <div className="h-16 rounded bg-white/10 animate-pulse" />
        ) : !rows || rows.length===0 ? (
          <div className="text-sm text-[var(--muted)]">No points yet.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {rows.map((r, idx) => (
              <div key={r.group_id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-semibold">
                    {idx===0 ? '🥇' : idx===1 ? '🥈' : idx===2 ? '🥉' : idx+1}
                  </span>
                  <span className="font-medium">{r.group_name}</span>
                </div>
                <div className="text-sm">{r.total}</div>
              </div>
            ))}
          </div>
        )}
        {onClose && (
          <div className="mt-4 text-right">
            <button className="text-sm text-[var(--muted)] hover:underline" onClick={onClose}>Close</button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
