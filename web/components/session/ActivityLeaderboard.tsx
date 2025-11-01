"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Row = { group_id: string; group_name: string; total: number };

export default function ActivityLeaderboard({ activityId, onClose }: { activityId: string; onClose?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(initial = false) {
    try {
      const r = await fetch(`/api/public/activities/${activityId}/leaderboard`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error || "Failed to load leaderboard");
        if (initial) setLoaded(true);
        return;
      }
      setError(null);
      const next: Row[] = Array.isArray(j.leaderboard) ? j.leaderboard : [];
      setRows(next);
      if (initial) setLoaded(true);
    } catch {
      setError("Failed to load leaderboard");
      if (initial) setLoaded(true);
    }
  }

  useEffect(() => {
    load(true);
    const iv = setInterval(() => load(false), 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  let body: React.ReactNode = null;
  if (!loaded) body = <div className="h-16 rounded bg-white/10 animate-pulse" />;
  else if (error) body = <div className="text-sm text-[var(--muted)]">{error}</div>;
  else if (!rows || rows.length === 0) body = <div className="text-sm text-[var(--muted)]">No points yet.</div>;
  else body = (
    <div className="divide-y divide-white/10">
      {rows.map((r, idx) => (
        <div key={r.group_id} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="w-8 text-center font-semibold">{idx + 1}</span>
            <span className="font-medium">{r.group_name}</span>
          </div>
          <div className="text-sm">{r.total}</div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader title="Activity Leaderboard" subtitle="Totals for this activity" />
      <CardBody>
        {body}
        {onClose && (
          <div className="mt-4 text-right">
            <button className="text-sm text-[var(--muted)] hover:underline" onClick={onClose}>Close</button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

