"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getActivityDisplayName } from "@/lib/activities/registry";
import { useToast } from "@/components/ui/Toast";

type Activity = {
  id: string;
  type: "brainstorm" | "stocktake" | "assignment";
  title: string;
  instructions?: string;
  description?: string;
  config: any;
  status: "Draft" | "Active" | "Voting" | "Closed";
};

export default function ActivitySummary({
  activityId,
}: {
  activityId?: string | null;
}) {
  const toast = useToast();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [configDraft, setConfigDraft] = useState<any | null>(null);
  const [savingQuick, setSavingQuick] = useState(false);

  const [editingDetails, setEditingDetails] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setActivity(null);
      setConfigDraft(null);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await apiFetch(`/api/activities/${activityId}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (!cancelled) {
            setActivity(null);
            setConfigDraft(null);
            setError(j.error || "Failed to load activity");
          }
          return;
        }

        if (!cancelled) {
          const a = (j.activity ?? null) as Activity | null;
          setActivity(a);
          setConfigDraft(a?.config ?? null);
          setEditingDetails(false);
          setTitleDraft(a?.title ?? "");
          setInstructionsDraft(a?.instructions ?? "");
          setDescriptionDraft(a?.description ?? "");
        }
      } catch {
        if (!cancelled) {
          setActivity(null);
          setConfigDraft(null);
          setError("Failed to load activity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  async function saveQuickConfig() {
    if (!activity || !configDraft) return;
    try {
      setSavingQuick(true);
      const r = await apiFetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: configDraft }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[ActivitySummary] quick config save failed:", j);
        toast(j.error || "Failed to update settings", "error");
        return;
      }
      const updated = (j.activity ?? null) as Activity | null;
      setActivity(updated);
      setConfigDraft(updated?.config ?? null);
      toast("Settings updated", "success");
    } catch (err) {
      console.error("[ActivitySummary] quick config save crashed:", err);
      toast("Failed to update settings", "error");
    } finally {
      setSavingQuick(false);
    }
  }

  async function saveDetails() {
    if (!activity) return;
    try {
      setSavingDetails(true);
      const r = await apiFetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleDraft,
          instructions: instructionsDraft,
          description: descriptionDraft,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[ActivitySummary] details save failed:", j);
        toast(j.error || "Failed to update details", "error");
        return;
      }
      const updated = (j.activity ?? null) as Activity | null;
      setActivity(updated);
      setTitleDraft(updated?.title ?? "");
      setInstructionsDraft(updated?.instructions ?? "");
      setDescriptionDraft(updated?.description ?? "");
      setEditingDetails(false);
      toast("Details updated", "success");
    } catch (err) {
      console.error("[ActivitySummary] details save crashed:", err);
      toast("Failed to update details", "error");
    } finally {
      setSavingDetails(false);
    }
  }

  if (!activityId) {
    return (
      <Card>
        <CardHeader
          title="Activity settings"
          subtitle="Select an activity in the left rail to see its settings"
        />
        <CardBody>
          <div className="text-sm text-[var(--muted)]">
            No activity selected.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Activity settings"
        subtitle="Quick overview of the current activity configuration"
      />
      <CardBody>
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
            <div className="h-4 w-64 rounded bg-white/10 animate-pulse" />
            <div className="h-16 rounded bg-white/10 animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-300">{error}</div>
        ) : !activity ? (
          <div className="text-sm text-[var(--muted)]">
            Activity not found.
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {/* Title + edit toggle */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[var(--muted)] text-xs uppercase tracking-wide mb-0.5">
                  Title
                </div>
                {editingDetails ? (
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="h-9 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 text-sm outline-none"
                    placeholder={getActivityDisplayName(activity.type)}
                  />
                ) : (
                  <div className="font-medium">
                    {activity.title || getActivityDisplayName(activity.type)}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-[10px] rounded border border-white/10 bg-white/5 px-2 py-1 text-[var(--muted)] hover:bg-white/10"
                onClick={() => {
                  if (!editingDetails) {
                    setTitleDraft(activity.title ?? "");
                    setInstructionsDraft(activity.instructions ?? "");
                    setDescriptionDraft(activity.description ?? "");
                  }
                  setEditingDetails((v) => !v);
                }}
              >
                {editingDetails ? "Cancel edit" : "Edit"}
              </button>
            </div>

            {/* Type / Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[var(--muted)] text-xs uppercase tracking-wide mb-0.5">
                  Type
                </div>
                <div>
                  {activity.type === "brainstorm"
                    ? "Standard activity"
                    : activity.type === "stocktake"
                    ? "Stocktake"
                    : "Assignment"}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs uppercase tracking-wide mb-0.5">
                  Status
                </div>
                <div>{activity.status}</div>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <div className="text-[var(--muted)] text-xs uppercase tracking-wide mb-0.5">
                Instructions
              </div>
              {editingDetails ? (
                <textarea
                  value={instructionsDraft}
                  onChange={(e) => setInstructionsDraft(e.target.value)}
                  className="min-h-20 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 py-1 text-sm outline-none"
                  placeholder="What do you want participants to do?"
                />
              ) : (
                <div className="text-[var(--muted)] whitespace-pre-line">
                  {activity.instructions || (
                    <span className="opacity-60">No instructions yet.</span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="text-[var(--muted)] text-xs uppercase tracking-wide mb-0.5">
                Description
              </div>
              {editingDetails ? (
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  className="min-h-20 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 py-1 text-sm outline-none"
                  placeholder="Optional context visible to participants"
                />
              ) : (
                <div className="text-[var(--muted)] whitespace-pre-line">
                  {activity.description || (
                    <span className="opacity-60">No description yet.</span>
                  )}
                </div>
              )}
            </div>

            {editingDetails && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="inline-flex items-center rounded-md border border-white/10 bg-[var(--brand)] px-3 py-1 text-xs text-[var(--btn-on-brand)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                >
                  {savingDetails ? "Saving…" : "Save text"}
                </button>
              </div>
            )}

            {/* High-level config summary + quick edit */}
            {configDraft && (
              <div className="border-t border-white/10 pt-3 mt-1 text-xs text-[var(--muted)] space-y-3">
                {(() => {
                  const parts: string[] = [];
                  if (activity.type !== "stocktake") {
                    const ms = Number(configDraft?.max_submissions || 0);
                    if (ms) {
                      parts.push(`${ms} submissions per participant`);
                    }
                    parts.push(
                      configDraft?.voting_enabled ? "Voting on" : "Voting off"
                    );
                  }
                  const tl = Number(configDraft?.time_limit_sec || 0);
                  if (tl) {
                    const mins = Math.floor(tl / 60);
                    const secs = tl % 60;
                    parts.push(
                      `Time limit ${mins}:${String(secs).padStart(2, "0")}`
                    );
                  }
                  if (activity.type === "stocktake") {
                    const count = Array.isArray(configDraft?.initiatives)
                      ? configDraft.initiatives.length
                      : 0;
                    if (count) {
                      parts.push(`${count} initiatives`);
                    }
                  }
                  if (parts.length === 0) return null;
                  return (
                    <div>
                      <span className="uppercase tracking-wide mr-1">
                        Summary:
                      </span>
                      <span>{parts.join(" • ")}</span>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Quick settings
                  </div>

                  {activity.type !== "stocktake" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-0.5 text-[10px] text-[var(--muted)]">
                          Max submissions (per participant)
                        </div>
                        <input
                          type="number"
                          min={0}
                          className="h-7 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 text-xs outline-none"
                          value={configDraft?.max_submissions ?? ""}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            setConfigDraft((prev: any) => ({
                              ...(prev || {}),
                              max_submissions: v,
                            }));
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <input
                          id="quick-voting-enabled"
                          type="checkbox"
                          checked={!!configDraft?.voting_enabled}
                          onChange={(e) =>
                            setConfigDraft((prev: any) => ({
                              ...(prev || {}),
                              voting_enabled: e.target.checked,
                            }))
                          }
                        />
                        <label
                          htmlFor="quick-voting-enabled"
                          className="text-xs"
                        >
                          Enable voting
                        </label>
                      </div>
                      {configDraft?.voting_enabled && (
                        <div className="col-span-2">
                          <div className="mb-0.5 text-[10px] text-[var(--muted)]">
                            Points budget (per voter)
                          </div>
                          <input
                            type="number"
                            min={1}
                            className="h-7 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 text-xs outline-none"
                            value={configDraft?.points_budget ?? ""}
                            onChange={(e) => {
                              const v = Math.max(
                                1,
                                Number(e.target.value || 0)
                              );
                              setConfigDraft((prev: any) => ({
                                ...(prev || {}),
                                points_budget: v,
                              }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="mb-0.5 text-[10px] text-[var(--muted)]">
                      Time limit (minutes, 0 = none)
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="h-7 w-full rounded-md border border-white/10 bg-[var(--panel)] px-2 text-xs outline-none"
                      value={
                        configDraft?.time_limit_sec
                          ? Math.floor(
                              Number(configDraft.time_limit_sec || 0) / 60
                            )
                          : ""
                      }
                      onChange={(e) => {
                        const mins = Math.max(
                          0,
                          Number(e.target.value || 0)
                        );
                        setConfigDraft((prev: any) => ({
                          ...(prev || {}),
                          time_limit_sec: mins > 0 ? mins * 60 : 0,
                        }));
                      }}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={saveQuickConfig}
                      disabled={savingQuick}
                      className="inline-flex items-center rounded-md border border-white/10 bg-[var(--brand)] px-3 py-1 text-xs text-[var(--btn-on-brand)] hover:bg-[var(--brand-soft)] disabled:opacity-60"
                    >
                      {savingQuick ? "Saving…" : "Save settings"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

