"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconTimer } from "@/components/ui/Icons";
import Timer from "@/components/ui/Timer";
import Modal from "@/components/ui/Modal";
import ActivitiesManager from "@/components/session/ActivitiesManager";
import { apiFetch } from "@/app/lib/apiFetch";
import { useToast } from "@/components/ui/Toast";
import {
  useSessionActivities,
  SessionActivity,
} from "@/components/session/useSessionActivities";

export default function ActivityRail({
  sessionId,
  sessionStatus,
  currentActivityId,
  onCurrentActivityChange,
}: {
  sessionId: string;
  sessionStatus?: string;
  currentActivityId?: string | null;
  onCurrentActivityChange?: (id: string | null) => void;
}) {
  const toast = useToast();
  const {
    activities,
    rawActivities,
    counts,
    groups,
    summary,
    current,
    setStatus,
    extendTimer,
    moveActivity,
  } = useSessionActivities(sessionId);

  const [showManager, setShowManager] = useState(false);

  const effectiveCurrentId = useMemo(() => {
    if (currentActivityId && activities.some((a) => a.id === currentActivityId)) {
      return currentActivityId;
    }
    return current?.id ?? null;
  }, [currentActivityId, activities, current?.id]);

  const effectiveCurrent = useMemo<SessionActivity | null>(
    () =>
      activities.find((a) => a.id === effectiveCurrentId) ?? current ?? null,
    [activities, effectiveCurrentId, current]
  );

  async function goNext() {
    const arr = activities;
    const curId = effectiveCurrent?.id;
    const idx = curId ? arr.findIndex((a) => a.id === curId) : -1;
    const next =
      idx >= 0
        ? arr.slice(idx + 1).find(
            (a) => a.status === "Draft" || a.status === "Voting"
          )
        : arr.find((a) => a.status === "Draft" || a.status === "Voting");

    try {
      if (curId) {
        await setStatus(curId, "Closed");
      }
      if (next) {
        await setStatus(next.id, "Active");
        onCurrentActivityChange?.(next.id);
      } else {
        toast("No more activities", "info");
      }
    } catch {
      toast("Failed to advance", "error");
    }
  }

  async function goPrevious() {
    const arr = activities;
    const curId = effectiveCurrentId;
    const idx = curId ? arr.findIndex((a) => a.id === curId) : -1;
    const prev = idx > 0 ? arr[idx - 1] : null;
    if (prev) {
      onCurrentActivityChange?.(prev.id);
    }
  }

  async function addTime(minutes: number) {
    const cur = effectiveCurrent;
    if (!cur) {
      toast("No active activity", "info");
      return;
    }
    await extendTimer(cur.id, minutes);
  }

  async function endSession() {
    try {
      await apiFetch(`/api/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      toast("Session ended", "success");
    } catch {
      toast("Failed to end session", "error");
    }
  }

  const activitiesLabel =
    summary.total === 1 ? "activity" : "activities";

  const effectiveCurrentStatus = effectiveCurrent?.status ?? null;
  const effectiveCurrentType = effectiveCurrent?.type ?? null;
  const canVote =
    effectiveCurrentType === "brainstorm" || effectiveCurrentType === "assignment";
  const liveCurrent = current;

  async function activateSelected() {
    const targetId = effectiveCurrentId ?? activities[0]?.id;
    if (!targetId) {
      toast("No activity selected", "info");
      return;
    }
    try {
      await setStatus(targetId, "Active");
      onCurrentActivityChange?.(targetId);
    } catch {
      toast("Failed to activate", "error");
    }
  }

  async function startVotingSelected() {
    const targetId = effectiveCurrentId;
    if (!targetId) {
      toast("No activity selected", "info");
      return;
    }
    try {
      await setStatus(targetId, "Voting");
      onCurrentActivityChange?.(targetId);
    } catch {
      toast("Failed to start voting", "error");
    }
  }

  async function closeSelected() {
    const targetId = effectiveCurrentId;
    if (!targetId) {
      toast("No activity selected", "info");
      return;
    }
    try {
      await setStatus(targetId, "Closed");
    } catch {
      toast("Failed to close activity", "error");
    }
  }

  async function skipSelected() {
    const targetId = effectiveCurrentId;
    if (!targetId) {
      toast("No activity selected", "info");
      return;
    }
    const act = rawActivities.find((a) => a.id === targetId);
    if (!act) {
      toast("Activity not found", "error");
      return;
    }
    try {
      const r = await apiFetch(`/api/activities/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Closed",
          config: {
            ...((act.config as any) || {}),
            skipped: true,
          },
        }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        console.error("[ActivityRail] skip failed:", j);
        toast("Failed to skip", "error");
        return;
      }
      toast("Activity skipped", "success");
    } catch (err) {
      console.error("[ActivityRail] skipSelected failed:", err);
      toast("Failed to skip", "error");
    }
  }

  async function moveSelected(delta: number) {
    const targetId = effectiveCurrentId;
    if (!targetId) {
      toast("No activity selected", "info");
      return;
    }
    try {
      await moveActivity(targetId, delta);
    } catch {
      toast("Failed to reorder", "error");
    }
  }

  return (
    <div className="space-y-3 text-[11px]">
      {/* Top summary + manager */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-[var(--muted)]">
          {summary.total} {activitiesLabel}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowManager(true)}>
          Manage
        </Button>
      </div>

      {/* Controls section */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-[var(--muted)]">
              Progress: {summary.closed} of {summary.total}{" "}
              {activitiesLabel} complete
            </div>
            <div className="mt-1 text-[10px] text-[var(--muted)] space-y-0.5">
              <div className="truncate">
                Selected:{" "}
                <span className="text-[var(--text)]">
                  {effectiveCurrent
                    ? effectiveCurrent.title || effectiveCurrent.type
                    : "None"}
                </span>
              </div>
              {liveCurrent && liveCurrent.id !== effectiveCurrentId && (
                <div className="truncate">
                  Live:{" "}
                  <span className="text-[var(--text)]">
                    {liveCurrent.title || liveCurrent.type}
                  </span>
                </div>
              )}
            </div>
          </div>
          {effectiveCurrent?.ends_at && (
            <div className="flex items-center gap-1 text-[var(--muted)]">
              <IconTimer size={12} />
              <Timer endsAt={effectiveCurrent.ends_at} />
            </div>
          )}
        </div>

        {/* Primary controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={goPrevious}>
            Previous
          </Button>
          <Button size="sm" onClick={goNext}>
            Next
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={activateSelected}
            disabled={effectiveCurrentStatus === "Active"}
          >
            Activate
          </Button>
          {canVote && (
            <Button
              size="sm"
              variant="outline"
              onClick={startVotingSelected}
              disabled={effectiveCurrentStatus === "Voting"}
            >
              Start voting
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={closeSelected}
            disabled={effectiveCurrentStatus === "Closed"}
          >
            Close
          </Button>
          <Button size="sm" variant="outline" onClick={skipSelected}>
            Skip
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moveSelected(-1)}
          >
            Move up
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => moveSelected(1)}
          >
            Move down
          </Button>
        </div>

        {/* Timer / session controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => addTime(1)}
          >
            +1m
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addTime(5)}
          >
            +5m
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={endSession}>
            End session
          </Button>
        </div>
      </div>

      {/* Activities list */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
        <div className="mt-0 flex flex-col gap-1.5">
          {activities.map((a, idx) => {
            const isCur =
              effectiveCurrentId === a.id ||
              a.status === "Active" ||
              a.status === "Voting";
            const isSelected = effectiveCurrentId === a.id;
            const isLive = a.status === "Active" || a.status === "Voting";
            const tone = isCur
              ? "border-[var(--brand)] bg-white/6 ring-1 ring-[var(--brand)]/40"
              : a.status === "Closed"
              ? "border-green-500/30 bg-green-500/10"
              : "border-white/10 bg-white/5";

            const cc = counts[a.id] || {
              max: 0,
              byGroup: {},
              total: 0,
            };
            const max = Number(cc.max || 0);
            const groupCount = groups.length || 1;
            const denom = max > 0 ? max * groupCount : 0;

            return (
              <button
                key={a.id}
                className={`min-w-0 rounded-md border px-2 py-1 text-left text-[10px] transition-colors hover:border-white/30 ${tone}`}
                onClick={() => onCurrentActivityChange?.(a.id)}
              >
                <div className="flex items-center gap-1">
                  <span className="opacity-70">{idx + 1}.</span>
                  <span className="truncate max-w-[12ch]">
                    {a.title || a.type}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  <StatusPill
                    status={
                      (a.status === "Draft" ? "Queued" : a.status) as any
                    }
                  />
                  <div className="flex items-center gap-1">
                    {isLive && (
                      <span className="rounded-full border border-green-500/40 bg-green-500/10 px-1.5 py-px text-[9px] text-green-200">
                        Live
                      </span>
                    )}
                    {!isLive && isSelected && (
                      <span className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-1.5 py-px text-[9px] text-[var(--brand)]-100">
                        Selected
                      </span>
                    )}
                  </div>
                  {denom > 0 && (
                    <span className="opacity-70">
                      {cc.total}/{denom}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {activities.length === 0 && (
            <div className="text-[var(--muted)]">No activities yet.</div>
          )}
        </div>
      </div>

      {/* Optional full manager for deeper editing */}
      <Modal
        open={showManager}
        onClose={() => setShowManager(false)}
        title="Manage activities"
        size="xl"
      >
        <div className="max-h-[70vh] overflow-auto">
          <ActivitiesManager sessionId={sessionId} sessionStatus={sessionStatus} />
        </div>
      </Modal>
    </div>
  );
}
