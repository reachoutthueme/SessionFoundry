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
      <div className="flex flex-wrap items-center gap-2">
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
        <Button
          size="sm"
          className="min-w-[96px] justify-between"
          onClick={goNext}
          title="Close current and activate the next activity"
        >
          <span className="mx-auto">Next</span>
          <IconChevronRight size={12} className="opacity-80" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={activateSelected}
          disabled={effectiveCurrentStatus === "Active"}
          title="Activate the selected activity for participants"
        >
          Activate
        </Button>
        {canVote && (
          <Button
            size="sm"
            variant="outline"
            onClick={startVotingSelected}
            disabled={effectiveCurrentStatus === "Voting"}
            title="Move the selected activity into voting"
          >
            Start voting
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={closeSelected}
          disabled={effectiveCurrentStatus === "Closed"}
          title="Close the selected activity"
        >
          Close
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={skipSelected}
          title="Mark the selected activity as skipped"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
