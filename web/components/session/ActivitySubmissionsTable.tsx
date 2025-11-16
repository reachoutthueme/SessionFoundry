"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { BrainstormTable, BrainstormSub } from "@/components/activities/results/BrainstormResults";

type Props = {
  activityId?: string | null;
};

export default function ActivitySubmissionsTable({ activityId }: Props) {
  const [subs, setSubs] = useState<BrainstormSub[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) {
      setSubs(null);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await apiFetch(`/api/activities/${activityId}/results`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (!cancelled) {
            setSubs(null);
            setError(j.error || "Failed to load submissions");
          }
          return;
        }
        const payload = j.submissions;
        if (!Array.isArray(payload)) {
          if (!cancelled) {
            setSubs([]);
          }
          return;
        }
        if (!cancelled) {
          setSubs(payload as BrainstormSub[]);
        }
      } catch {
        if (!cancelled) {
          setSubs(null);
          setError("Failed to load submissions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (!activityId) return null;
  if (loading && !subs && !error) {
    return (
      <div className="mt-3 h-16 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
    );
  }
  if (error) {
    return (
      <div className="mt-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!subs || subs.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs text-[var(--muted)]">
        All submissions for this activity
      </div>
      <BrainstormTable subs={subs} />
    </div>
  );
}

