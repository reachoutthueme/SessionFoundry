"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";

export type SessionActivity = {
  id: string;
  session_id: string;
  type: "brainstorm" | "stocktake" | "assignment";
  title: string;
  instructions?: string;
  description?: string;
  config: any;
  order_index: number;
  status: "Draft" | "Active" | "Voting" | "Closed";
  starts_at?: string | null;
  ends_at?: string | null;
};

export type SubmissionCounts = Record<
  string,
  { max: number; byGroup: Record<string, number>; total: number }
>;

export type SessionGroup = { id: string; name: string };

export function useSessionActivities(sessionId: string) {
  const [items, setItems] = useState<SessionActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [counts, setCounts] = useState<SubmissionCounts>({});

  // initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [rActs, rGroups, rCounts] = await Promise.all([
          apiFetch(`/api/activities?session_id=${sessionId}`, {
            cache: "no-store",
          }),
          apiFetch(`/api/groups?session_id=${sessionId}`, {
            cache: "no-store",
          }),
          apiFetch(`/api/activities/submission_counts?session_id=${sessionId}`, {
            cache: "no-store",
          }),
        ]);

        const jActs = await rActs.json().catch(() => ({}));
        const jGroups = await rGroups.json().catch(() => ({}));
        const jCounts = await rCounts.json().catch(() => ({}));

        if (cancelled) return;

        if (!rActs.ok) {
          setItems([]);
          setError(jActs.error || "Failed to load activities");
        } else {
          setItems(jActs.activities ?? []);
        }

        setGroups(
          (jGroups.groups ?? []).map((g: any) => ({
            id: g.id as string,
            name: g.name as string,
          }))
        );

        setCounts(jCounts.counts ?? {});
      } catch (err) {
        if (!cancelled) {
          console.error("[useSessionActivities] load() failed:", err);
          setItems([]);
          setError("Failed to load activities");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // polling for submission counts
  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        const r = await apiFetch(
          `/api/activities/submission_counts?session_id=${sessionId}`,
          { cache: "no-store" }
        );
        const jc = await r.json().catch(() => ({}));
        if (!stop) setCounts(jc.counts ?? {});
      } catch (err) {
        console.error("[useSessionActivities] polling failed:", err);
      }
    }

    const iv = setInterval(tick, 5000);
    tick(); // immediate first run
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [sessionId]);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [items]
  );

  const summary = useMemo(() => {
    const total = items.length;
    const closed = items.filter((a) => a.status === "Closed").length;
    const active = items.filter((a) => a.status === "Active").length;
    const voting = items.filter((a) => a.status === "Voting").length;
    const inactive = items.filter((a) => a.status === "Draft").length;
    return {
      total,
      closed,
      active,
      voting,
      inactive,
      pct: total ? Math.round((closed / total) * 100) : 0,
    };
  }, [items]);

  const current = useMemo(
    () =>
      sorted.find(
        (a) => a.status === "Active" || a.status === "Voting"
      ) || null,
    [sorted]
  );

  async function setStatus(id: string, status: SessionActivity["status"]) {
    const patch: any = { status };

    const act = items.find((a) => a.id === id);
    const tl = Number(act?.config?.time_limit_sec || 0);

    if (
      status === "Active" &&
      tl > 0 &&
      !act?.starts_at &&
      !act?.ends_at
    ) {
      const now = new Date().toISOString();
      const ends = new Date(Date.now() + tl * 1000).toISOString();
      patch.starts_at = now;
      patch.ends_at = ends;
    }

    try {
      const r = await apiFetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        console.error("[useSessionActivities] setStatus failed:", j);
        return;
      }

      const updated = j.activity as SessionActivity | undefined;
      if (updated) {
        setItems((prev) =>
          prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
        );
      }
    } catch (err) {
      console.error("[useSessionActivities] setStatus() failed:", err);
    }
  }

  async function extendTimer(id: string, minutes: number) {
    try {
      const r = await apiFetch(`/api/activities/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: id, minutes }),
      });
      const j = await r.json().catch(() => ({} as any));

      if (!r.ok) {
        console.error(
          "[useSessionActivities] extendTimer failed:",
          j?.error || j
        );
        return;
      }
    } catch (err) {
      console.error("[useSessionActivities] extendTimer() failed:", err);
    }
  }

  return {
    activities: sorted,
    rawActivities: items,
    loading,
    error,
    groups,
    counts,
    summary,
    current,
    setStatus,
    extendTimer,
  };
}

