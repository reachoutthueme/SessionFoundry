"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Row = { group_id: string; group_name: string; total: number };

export default function OverallLeaderboard({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose?: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(initial = false) {
    try {
      const r = await fetch(`/api/public/leaderboard?session_id=${sessionId}`, {
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error("[OverallLeaderboard] Failed to load:", j.error);
        setError(j.error || "Failed to load leaderboard");
        if (initial) setLoaded(true);
        return;
      }

      setError(null);

      const next: Row[] = Array.isArray(j.leaderboard)
        ? j.leaderboard
        : [];

      // Only update state if something actually changed to avoid flicker
      setRows((prev) => {
        if (!prev || prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (
            prev[i].group_id !== next[i].group_id ||
            prev[i].total !== next[i].total
          ) {
            return next;
          }
        }
        return prev;
      });

      if (initial) setLoaded(true);
    } catch (err) {
      console.error("[OverallLeaderboard] Crash in load():", err);
      setError("Failed to load leaderboard");
      if (initial) setLoaded(true);
    }
  }

  useEffect(() => {
    load(true);
    const iv = setInterval(() => load(false), 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  let bodyContent: React.ReactNode;

  if (!loaded) {
    // still on first load
    bodyContent = (
      <div className="h-16 rounded bg-white/10 animate-pulse" />
    );
  } else if (error) {
    // load finished but errored
    bodyContent = (
      <div className="text-sm text-[var(--muted)]">
        {error}
      </div>
    );
  } else if (!rows || rows.length === 0) {
    // loaded fine but no data
    bodyContent = (
      <div className="text-sm text-[var(--muted)]">
        No points yet.
      </div>
    );
  } else {
    // happy path, we have leaderboard rows
    bodyContent = (
      <div className="divide-y divide-white/10">
        {rows.map((r, idx) => (
          <div
            key={r.group_id}
            className="flex items-center justify-between py-2"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 text-center font-semibold">
                {idx + 1}
              </span>
              <span className="font-medium">
                {r.group_name}
              </span>
            </div>
            <div className="text-sm">{r.total}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Overall Leaderboard"
        subtitle="Totals across all activities"
      />
      <CardBody>
        {bodyContent}

        {onClose && (
          <div className="mt-4 text-right">
            <button
              type="button"
              className="text-sm text-[var(--muted)] hover:underline"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

