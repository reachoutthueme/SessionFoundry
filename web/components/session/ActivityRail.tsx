"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import Modal from "@/components/ui/Modal";
import ActivitiesManager from "@/components/session/ActivitiesManager";
import { useSessionActivities } from "@/components/session/useSessionActivities";

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
  const { activities, counts, groups, summary } =
    useSessionActivities(sessionId);

  const [showManager, setShowManager] = useState(false);

  const effectiveCurrentId = useMemo(() => {
    if (
      currentActivityId &&
      activities.some((a) => a.id === currentActivityId)
    ) {
      return currentActivityId;
    }
    return null;
  }, [currentActivityId, activities]);

  return (
    <div className="space-y-3 text-[11px]">
      {/* Header + Manage */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">
            Activities
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            {summary.total} {summary.total === 1 ? "activity" : "activities"}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowManager(true)}
          title="Open the full activities manager"
        >
          Manage
        </Button>
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
                  <span className="truncate max-w-[22ch]" title={a.title || a.type}>
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
