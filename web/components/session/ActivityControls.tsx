"use client";

import { useMemo } from "react";
import Button from "@/components/ui/Button";
import { IconTimer, IconChevronRight } from "@/components/ui/Icons";
import Timer from "@/components/ui/Timer";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/app/lib/apiFetch";
import { useSessionActivities } from "@/components/session/useSessionActivities";

export default function ActivityControls({
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
    summary,
    current,
    setStatus,
    extendTimer,
  } = useSessionActivities(sessionId);

  const effectiveCurrentId = useMemo(() => {
    if (
      currentActivityId &&
      activities.some((a) => a.id === currentActivityId)
    ) {
      return currentActivityId;
    }
    return current?.id ?? null;
  }, [currentActivityId, activities, current?.id]);

  const effectiveCurrent = useMemo(
    () =>
      activities.find((a) => a.id === effectiveCurrentId) ?? current ?? null,
    [activities, effectiveCurrentId, current]
  );

  const effectiveCurrentStatus = effectiveCurrent?.status ?? null;
  const effectiveCurrentType = effectiveCurrent?.type ?? null;
  const canVote =
    effectiveCurrentType === "brainstorm" ||
    effectiveCurrentType === "assignment";
  const isSessionActive = sessionStatus === "Active";

  const ordered = activities;
  const currentIndex = effectiveCurrent
    ? ordered.findIndex((a) => a.id === effectiveCurrent.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < ordered.length - 1;

  const isDraft = effectiveCurrentStatus === "Draft";
  const isActive = effectiveCurrentStatus === "Active";
  const isVoting = effectiveCurrentStatus === "Voting";
  const isClosed = effectiveCurrentStatus === "Closed";

  const showStartActivity = isSessionActive && isDraft;
  const showSkip = isSessionActive && isDraft;
  const showStartVoting = isSessionActive && canVote && isActive;
  const showEndActivity = isSessionActive && (isActive || isVoting);
  const showPrev = isSessionActive && hasPrev;
  const showNext = isSessionActive && isClosed && hasNext;

  async function goNext() {
    const arr = activities;
    const curId = effectiveCurrent?.id;
    const idx = curId ? arr.findIndex((a) => a.id === curId) : -1;
    const next =
      idx >= 0
        ? arr
            .slice(idx + 1)
            .find(
              (a) => a.status === "Draft" || a.status === "Voting"
            )
        : arr.find(
            (a) => a.status === "Draft" || a.status === "Voting"
          );

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
        console.error("[ActivityControls] skip failed:", j);
        toast("Failed to skip", "error");
        return;
      }
      toast("Activity skipped", "success");
    } catch (err) {
      console.error("[ActivityControls] skipSelected failed:", err);
      toast("Failed to skip", "error");
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
      {/* Summary + timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-[var(--muted)]">
            {summary.closed} of {summary.total} activities complete
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
            {current && current.id !== effectiveCurrentId && (
              <div className="truncate">
                Live:{" "}
                <span className="text-[var(--text)]">
                  {current.title || current.type}
                </span>
              </div>
            )}
          </div>
        </div>
        {effectiveCurrent?.ends_at && (
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              <IconTimer size={12} />
              <Timer endsAt={effectiveCurrent.ends_at} />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => addTime(1)}
                title="Add 1 minute to the current activity timer"
              >
                +1 min
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addTime(5)}
                title="Add 5 minutes to the current activity timer"
              >
                +5 min
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isSessionActive ? (
        effectiveCurrent ? (
          <div className="flex flex-wrap items-center gap-2">
            {showPrev && (
              <Button
                size="sm"
                variant="outline"
                className="min-w-[96px] justify-between"
                onClick={goPrevious}
                title="Select the previous activity in the run order"
              >
                <IconChevronRight
                  size={12}
                  className="rotate-180 opacity-80"
                />
                <span className="mx-auto">Previous</span>
              </Button>
            )}

            {showNext && (
              <Button
                size="sm"
                className="min-w-[96px] justify-between"
                onClick={goNext}
                title="Move to the next activity in the run order"
              >
                <span className="mx-auto">Next</span>
                <IconChevronRight size={12} className="opacity-80" />
              </Button>
            )}

            {showStartActivity && (
              <Button
                size="sm"
                variant="outline"
                onClick={activateSelected}
                title="Start this activity for participants"
              >
                Start Activity
              </Button>
            )}

            {showStartVoting && (
              <Button
                size="sm"
                variant="outline"
                onClick={startVotingSelected}
                title="Move this activity into the voting stage"
              >
                Start Voting
              </Button>
            )}

            {showEndActivity && (
              <Button
                size="sm"
                variant="outline"
                onClick={closeSelected}
                title="End this activity and lock in responses"
              >
                End Activity
              </Button>
            )}

            {showSkip && (
              <Button
                size="sm"
                variant="outline"
                onClick={skipSelected}
                title="Skip this activity and mark it as skipped"
              >
                Skip Activity
              </Button>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-[var(--muted)]">
            Select an activity to see controls.
          </div>
        )
      ) : (
        <div className="text-[10px] text-[var(--muted)]">
          Start the session to control activities.
        </div>
      )}
    </div>
  );
}
