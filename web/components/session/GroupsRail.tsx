"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import GroupsManager from "@/components/session/GroupsManager";
import FacilitatorNotes from "@/components/session/FacilitatorNotes";
import { useToast } from "@/components/ui/Toast";
import { useSessionActivities } from "@/components/session/useSessionActivities";
import { apiFetch } from "@/app/lib/apiFetch";

type Participant = {
  id: string;
  display_name: string | null;
  group_id: string | null;
};

export default function GroupsRail({
  sessionId,
  currentActivityId,
}: {
  sessionId: string;
  currentActivityId?: string | null;
}) {
  const toast = useToast();
  const { groups, counts } = useSessionActivities(sessionId);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const rp = await apiFetch(`/api/participants?session_id=${sessionId}`, {
          cache: "no-store",
        });
        const jp = await rp.json().catch(() => ({}));

        if (!rp.ok) {
          console.error("[GroupsRail] Failed to load participants:", jp.error);
          if (!cancelled) toast(jp.error || "Failed to load participants", "error");
          return;
        }

        if (!cancelled) {
          setParticipants(
            Array.isArray(jp.participants)
              ? jp.participants.map((p: any) => ({
                  id: p.id,
                  display_name: p.display_name,
                  group_id: p.group_id,
                }))
              : []
          );
        }
      } catch (err) {
        console.error("[GroupsRail] load() crashed:", err);
        if (!cancelled) {
          setParticipants([]);
          toast("Failed to load participants", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, toast]);

  const activityCounts = currentActivityId ? counts[currentActivityId] : undefined;

  const unassigned = useMemo(
    () => participants.filter((p) => !p.group_id),
    [participants]
  );

  return (
    <div className="space-y-3 text-[11px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-[var(--muted)]">
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowManager(true)}>
          Manage groups
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 rounded bg-white/10 animate-pulse" />
            <div className="h-8 rounded bg-white/10 animate-pulse" />
          </div>
        ) : groups.length === 0 && unassigned.length === 0 ? (
          <div className="text-[var(--muted)] text-xs">No groups yet.</div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const members = participants.filter((p) => p.group_id === g.id);
              const c = activityCounts?.byGroup?.[g.id] ?? 0;
              const max = Number(activityCounts?.max || 0);
              const pct =
                max > 0
                  ? Math.max(
                      0,
                      Math.min(100, Math.round((c / max) * 100))
                    )
                  : 0;

              return (
                <div
                  key={g.id}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium text-[11px] truncate">
                        {g.name}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {members.length}{" "}
                        {members.length === 1 ? "member" : "members"}
                      </div>
                    </div>
                    {max > 0 && (
                      <div className="text-[10px] text-[var(--muted)]">
                        {c}/{max}
                      </div>
                    )}
                  </div>
                  {max > 0 && (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[var(--brand)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="rounded-md border border-dashed border-white/10 bg-white/5 px-2 py-2">
                <div className="font-medium text-[11px]">Unassigned</div>
                <div className="mt-1 text-[10px] text-[var(--muted)]">
                  {unassigned.length} participant
                  {unassigned.length === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/10 pt-2 mt-1">
          <FacilitatorNotes sessionId={sessionId} variant="inline" />
        </div>
      </div>

      <Modal
        open={showManager}
        onClose={() => setShowManager(false)}
        title="Manage groups"
        size="lg"
      >
        <div className="max-h-[70vh] overflow-auto">
          <GroupsManager sessionId={sessionId} />
        </div>
      </Modal>
    </div>
  );
}
