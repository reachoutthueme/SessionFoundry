"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { IconSettings } from "@/components/ui/Icons";
import { IconTimer } from "@/components/ui/Icons";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getActivityDisplayName } from "@/lib/activities/registry";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import StocktakeInitiativesManager from "@/components/session/StocktakeInitiativesManager";
import Timer from "@/components/ui/Timer";
import FacilitatorConfig from "@/components/activities/facilitator";
import { validateConfig } from "@/lib/activities/schemas";

type Activity = {
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

export default function ActivitiesManager({
  sessionId,
  sessionStatus,
}: {
  sessionId: string;
  sessionStatus?: string;
}) {
  const toast = useToast();

  // Data / loading state
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [counts, setCounts] = useState<
    Record<
      string,
      { max: number; byGroup: Record<string, number>; total: number }
    >
  >({});

  // "Add Activity" modal state
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Activity["type"]>("brainstorm");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [description, setDescription] = useState("");
  // Centralized draft config for the Add modal
  const [configDraft, setConfigDraft] = useState<any>({});

  // Edit modal state
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eInstructions, setEInstructions] = useState("");
  const [eDescription, setEDescription] = useState("");
  // Centralized draft config for the Edit modal
  const [eConfigDraft, setEConfigDraft] = useState<any>({});

  // Stocktake modal state
  const [manageId, setManageId] = useState<string | null>(null);

  // "Actions" dropdown state
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuUp, setMenuUp] = useState(false);

  // Close dropdown if clicking outside
  useEffect(() => {
    if (!menuId) return;

    function onDoc(e: MouseEvent | TouchEvent) {
      const el = menuRef.current;
      const target = e.target as Node | null;
      if (el && target && !el.contains(target)) {
        setMenuId(null);
      }
    }

    // decide dropdown direction (above vs below)
    const el = menuRef.current;
    if (typeof window !== "undefined" && el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuUp(spaceBelow < 180); // heuristic
    } else {
      setMenuUp(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [menuId]);

  // Fetch activities, groups, submission counts
  async function load() {
    try {
      setLoading(true);
      const [rActs, rGroups, rCounts] = await Promise.all([
        fetch(`/api/activities?session_id=${sessionId}`, {
          cache: "no-store",
        }),
        fetch(`/api/groups?session_id=${sessionId}`, {
          cache: "no-store",
        }),
        fetch(`/api/activities/submission_counts?session_id=${sessionId}`, {
          cache: "no-store",
        }),
      ]);

      const jActs = await rActs.json();
      const jGroups = await rGroups.json();
      const jCounts = await rCounts.json();

      setItems(jActs.activities ?? []);

      setGroups(
        (jGroups.groups ?? []).map((g: any) => ({
          id: g.id as string,
          name: g.name as string,
        }))
      );

      setCounts(jCounts.counts ?? {});
    } catch (err) {
      console.error("[ActivitiesManager] load() failed:", err);
      toast("Failed to load activities", "error");
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    load();
  }, [sessionId]);

  // polling for submission counts
  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        const r = await fetch(
          `/api/activities/submission_counts?session_id=${sessionId}`,
          { cache: "no-store" }
        );
        const jc = await r.json();
        if (!stop) setCounts(jc.counts ?? {});
      } catch (err) {
        console.error("[ActivitiesManager] polling failed:", err);
      }
    }

    const iv = setInterval(tick, 5000);
    tick(); // immediate first run
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [sessionId]);

  // derived data
  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
  }, [items]);

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

  // create new activity
  async function create() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    // Centralized config draft based on selected type
    const config = configDraft || {};
    const v = validateConfig(type, config);
    if (!v.ok) {
      toast(v.error || "Invalid settings", "error");
      return;
    }

    try {
      const r = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          type,
          title: cleanTitle,
          instructions,
          description,
          config: v.value,
        }),
      });
      const j = await r.json();

      if (!r.ok) {
        toast(j.error || "Failed to create", "error");
        return;
      }

      toast("Activity created", "success");
      setOpen(false);
      setTitle("");
      setInstructions("");
      setDescription("");
      setConfigDraft({});
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] create() failed:", err);
      toast("Failed to create activity", "error");
    }
  }

  // Initialize defaults for configDraft when opening the Add modal or switching type
  useEffect(() => {
    if (!open) return;
    if (type === "brainstorm") {
      setConfigDraft((prev: any) => ({
        voting_enabled: prev?.voting_enabled ?? true,
        max_submissions: prev?.max_submissions ?? 5,
        time_limit_sec: prev?.time_limit_sec ?? 300,
        points_budget: prev?.points_budget ?? 100,
      }));
    } else if (type === "assignment") {
      setConfigDraft((prev: any) => ({
        voting_enabled: prev?.voting_enabled ?? true,
        max_submissions: prev?.max_submissions ?? 5,
        time_limit_sec: prev?.time_limit_sec ?? 300,
        points_budget: prev?.points_budget ?? 100,
        prompts: Array.isArray(prev?.prompts) ? prev.prompts : [],
      }));
    } else {
      // stocktake
      setConfigDraft((prev: any) => ({
        time_limit_sec: prev?.time_limit_sec ?? 300,
      }));
    }
  }, [open, type]);

  // update status / timer
  async function setStatus(id: string, status: Activity["status"]) {
    const patch: any = { status };

    // when first activating: stamp time window
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
      const r = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();

      if (!r.ok) {
        toast(j.error || "Failed to update", "error");
        return;
      }

      toast("Status updated", "success");
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] setStatus() failed:", err);
      toast("Failed to update status", "error");
    }
  }

  async function extendTimer(id: string, minutes: number) {
    const act = items.find((a) => a.id === id);
    if (!act) return;
    if (act.status !== "Active") return; // only allow while Active

    const prev = act.ends_at
      ? new Date(act.ends_at).getTime()
      : Date.now();
    const base = Number.isFinite(prev)
      ? Math.max(prev, Date.now())
      : Date.now();
    const next = new Date(base + minutes * 60_000).toISOString();

    try {
      const r = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ends_at: next }),
      });
      const j = await r.json();

      if (!r.ok) {
        toast(j.error || "Failed to extend timer", "error");
        return;
      }

      toast(`+${minutes} min added`, "success");
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] extendTimer() failed:", err);
      toast("Failed to extend timer", "error");
    }
  }

  // reorder activities
  async function moveActivity(id: string, delta: number) {
    const arr = [...items].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );
    const idx = arr.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= arr.length) return;

    const a = arr[idx];
    const b = arr[target];

    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/activities/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: target }),
        }),
        fetch(`/api/activities/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: idx }),
        }),
      ]);

      if (!r1.ok || !r2.ok) {
        throw new Error("reorder failed");
      }

      toast("Order updated", "success");
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] moveActivity() failed:", err);
      toast("Failed to reorder", "error");
    }
  }

  const statusLabel =
    sessionStatus === "Active" || sessionStatus === "Completed"
      ? sessionStatus
      : "Inactive";

  const statusColor =
    sessionStatus === "Active"
      ? "bg-red-500"
      : sessionStatus === "Completed"
      ? "bg-green-500"
      : "bg-gray-400";

  return (
    <>
      <Card>
        <CardHeader
          title="Activities"
          subtitle="Create and control workshop flow"
          rightSlot={
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-[var(--muted)]">
              <span
                className={`inline-block h-2 w-2 rounded-full ${statusColor} animate-pulse`}
              />
              <span>{statusLabel}</span>
            </div>
          }
        />
        <CardBody>
          {/* Sticky control bar */}
          <div className="sticky top-0 z-10 -mx-3 -mt-2 mb-4 px-3 pt-2 backdrop-blur-sm">
            <div className="rounded-md border border-white/12 bg-white/6 px-3 py-2 flex flex-wrap items-center gap-3">
              <div className="min-w-0 text-xs flex items-center gap-2">
                <span className="opacity-70">Now:</span>
                <span className="font-medium truncate max-w-[40ch]">{current ? (current.title || getActivityDisplayName(current.type)) : 'Nothing live'}</span>
                {current?.ends_at ? (
                  <span className="timer-pill timer-brand" aria-live="polite"><IconTimer size={12} /> <Timer endsAt={current.ends_at} /></span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {current ? (
                  current.status === 'Active' ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(current.id, 'Voting')}>Pause</Button>
                  ) : (
                    <Button size="sm" onClick={() => setStatus(current.id, 'Active')}>Start</Button>
                  )
                ) : null}
                <div className="relative">
                  <details className="group">
                    <summary className="list-none">
                      <Button size="sm" variant="outline">+ time</Button>
                    </summary>
                    <div className="absolute right-0 mt-1 rounded-md border border-white/12 bg-[var(--panel)] shadow-lg overflow-hidden">
                      {[1,3,5].map(m => (
                        <button key={m} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-white/5" onClick={() => current && extendTimer(current.id, m)}>+{m} min</button>
                      ))}
                    </div>
                  </details>
                </div>
<Button
  size="sm"
  variant="outline"
  onClick={async () => {
    const idx = current ? sorted.findIndex(x => x.id === current.id) : -1;
    // FIX: don't compare against 'Inactive' (not part of Activity["status"])
    const next = sorted
      .slice(Math.max(idx + 1, 0))
      .find(x => x.status === 'Draft' || x.status === 'Voting');

    if (current) await setStatus(current.id, 'Closed');
    if (next) await setStatus(next.id, 'Active');
  }}
>
  Next
</Button>
                {current ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(current.id, 'Closed')}>End</Button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Header row: count + add */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-[var(--muted)]">
              {items.length} activities
            </div>
            <Button onClick={() => setOpen(true)}>Add Activity</Button>
          </div>

          {/* Progress + Now panel */}
          <div className="mb-6 rounded-lg border border-white/15 bg-white/7 p-4 shadow-[0_8px_30px_rgba(0,0,0,.12)]">
            {/* Progress bar */}
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm">{summary.closed}/{summary.total} completed • {summary.pct}%</div>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[var(--brand)]"
                style={{ width: `${summary.pct}%` }}
              />
            </div>

            {/* Current activity row */}
            {current && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)]" />
                  <span className="text-[var(--muted)]">Now:</span>
                  <span className="font-medium">{current.title}</span>
                  <span className="rounded border border-white/10 px-2 py-0.5 text-[var(--muted)]">
                    {current.status}
                  </span>
                </div>

                {(current.status === "Active" || current.status === "Voting") && current.ends_at ? (
                  <div className="flex items-center gap-2 text-[var(--muted)]">
                    <span className="timer-pill timer-brand" aria-live="polite"><IconTimer size={12} /> <Timer endsAt={current.ends_at} /></span>
                  </div>
                ) : null}
              </div>
            )}

            {/* mini activity chips */}
            {sorted.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs text-[var(--muted)]">
                  Activities
                </div>
                <div className="flex flex-wrap gap-2">
                  {sorted.map((a, i) => {
                    const tone =
                      a.status === "Closed"
                        ? "bg-green-500/15 text-[var(--text)] border-green-500/30"
                        : a.status === "Voting"
                        ? "bg-blue-500/15 text-[var(--text)] border-blue-400/30"
                        : a.status === "Active"
                        ? "bg-[var(--brand)]/20 text-[var(--text)] border-white/20"
                        : "bg-white/5 text-[var(--muted)] border-white/10"; // Draft

                    return (
                      <div
                        key={a.id}
                        className={`rounded border px-2 py-1 text-xs ${tone}`}
                      >
                        <span className="mr-1 opacity-70">
                          {i + 1}.
                        </span>
                        {a.title || getActivityDisplayName(a.type)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Activities list */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            {loading ? (
              <div className="space-y-2">
                <div className="h-12 animate-pulse rounded bg-white/10" />
                <div className="h-12 animate-pulse rounded bg-white/10" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">
                No activities yet.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((a) => {
                  const status =
                    a.status === "Draft"
                      ? "Inactive"
                      : a.status;
                  const tone =
                    status === "Inactive"
                      ? "border-white/10 bg-white/5"
                      : status === "Active"
                      ? "border-[var(--brand)] bg-white/6 ring-1 ring-[var(--brand)]/50"
                      : status === "Voting"
                      ? "border-amber-400/30 bg-amber-500/5"
                      : "border-white/20 bg-white/5"; // Closed

                  const cc = counts[a.id] || {
                    max: 0,
                    byGroup: {},
                    total: 0,
                  };
                  const max = Number(cc.max || 0);
                  const byGroup = cc.byGroup || {};
                  const groupList =
                    groups.length > 0 ? groups : [];

                  return (
                    <div
                      key={a.id}
                      className={`rounded-2xl border p-3 ${tone}`}
                    >
                      <div className="flex items-center justify-between">
                        {/* left block */}
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {a.title || getActivityDisplayName(a.type)}
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              [{a.type === "brainstorm"
                                ? "standard"
                                : a.type}]
                            </span>
                            {a.config?.skipped && (
                              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                                Skipped
                              </span>
                            )}
                          </div>

                          <div className="text-xs flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border ${
                              status === 'Active' ? 'status-chip-active border-green-400/30 text-green-200 bg-green-500/10' :
                              status === 'Voting' ? 'border-amber-400/30 text-amber-200 bg-amber-500/10' :
                              status === 'Inactive' ? 'border-white/20 text-[var(--muted)]' : 'border-rose-400/30 text-rose-200 bg-rose-500/10'
                            }`}>
                              {status}
                            </span>
                            {(a.status === 'Active' || a.status === 'Voting') && a.ends_at ? (
                              <span className="timer-pill timer-brand"><IconTimer size={12} /> <Timer endsAt={a.ends_at} /></span>
                            ) : null}
                          </div>

                          {(a.type === "brainstorm" ||
                            a.type ===
                              "assignment") && (
                            <div className="mt-2 text-xs">
                              {groupList.length ===
                              0 ? (
                                <span className="text-[var(--muted)]">
                                  No groups
                                </span>
                              ) : (
                                <>
                                  {max > 0 && (
                                    <div className="mb-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[var(--muted)]">Submissions</span>
                                        <span className="text-[var(--muted)]">
                                          {cc.total}/
                                          {max *
                                            groupList.length}
                                        </span>
                                      </div>
                                      <div className="h-1 overflow-hidden rounded-full bg-white/10">
                                        <div
                                          className="h-full bg-[var(--brand)]"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              Math.round(
                                                (cc.total /
                                                  (max *
                                                    groupList.length)) *
                                                  100
                                              )
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                    {groupList.map(
                                      (g) => {
                                        const c =
                                          byGroup[
                                            g.id
                                          ] || 0;
                                        const pct =
                                          max > 0
                                            ? Math.max(
                                                0,
                                                Math.min(
                                                  100,
                                                  Math.round(
                                                    (c /
                                                      max) *
                                                      100
                                                  )
                                                )
                                              )
                                            : 0;
                                        const barColor =
                                          pct >= 100
                                            ? "bg-green-500"
                                            : "bg-[var(--brand)]";

                                        return (
                                          <div
                                            key={g.id}
                                            className="rounded border border-white/10 bg-white/5 px-2 py-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="mr-2 truncate">
                                                {g.name}
                                              </span>
                                              <span className="opacity-75">
                                                {c}
                                                {max >
                                                0
                                                  ? `/${max}`
                                                  : ""}
                                              </span>
                                            </div>

                                            {max > 0 && (
                                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                                <div
                                                  className={`${barColor} h-full`}
                                                  style={{
                                                    width: `${pct}%`,
                                                  }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* right-side controls */}
                        <div className="flex items-center gap-2">
                          {a.type === "stocktake" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                setManageId(a.id)
                              }
                            >
                              Initiatives
                            </Button>
                          )}

                          {/* Actions dropdown */}
                          <div
                            className="relative"
                            ref={
                              menuId === a.id
                                ? menuRef
                                : undefined
                            }
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setMenuId((m) =>
                                  m === a.id
                                    ? null
                                    : a.id
                                )
                              }
                              aria-haspopup="menu"
                              aria-expanded={
                                menuId === a.id
                              }
                            >
                              Actions{" "}
                              <span className="ml-1">
                                ▾
                              </span>
                            </Button>

                            {menuId === a.id && (
                              <div
                                className={`${
                                  menuUp
                                    ? "absolute bottom-full right-0 mb-1"
                                    : "absolute right-0 mt-1"
                                } z-10 w-40 rounded-md border border-white/10 bg-[var(--panel)] shadow-lg`}
                                role="menu"
                              >
                                <button
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                                  onClick={async () => {
                                    setMenuId(null);
                                    await setStatus(
                                      a.id,
                                      "Active"
                                    );
                                  }}
                                >
                                  Activate
                                </button>

                                {a.type ===
                                  "brainstorm" && (
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                                    onClick={async () => {
                                      setMenuId(
                                        null
                                      );
                                      await setStatus(
                                        a.id,
                                        "Voting"
                                      );
                                    }}
                                  >
                                    Start
                                    voting
                                  </button>
                                )}

                                <button
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                                  onClick={async () => {
                                    setMenuId(null);
                                    await setStatus(
                                      a.id,
                                      "Closed"
                                    );
                                  }}
                                >
                                  Close
                                </button>

                                <button
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                                  onClick={async () => {
                                    setMenuId(null);
                                    try {
                                      const r =
                                        await fetch(
                                          `/api/activities/${a.id}`,
                                          {
                                            method:
                                              "PATCH",
                                            headers:
                                              {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                            body: JSON.stringify(
                                              {
                                                status:
                                                  "Closed",
                                                config:
                                                  {
                                                    ...((a.config as any) ||
                                                      {}),
                                                    skipped:
                                                      true,
                                                  },
                                              }
                                            ),
                                          }
                                        );

                                      if (!r.ok) {
                                        throw new Error(
                                          "skip failed"
                                        );
                                      }

                                      toast(
                                        "Activity skipped",
                                        "success"
                                      );
                                      await load();
                                    } catch (err) {
                                      console.error(
                                        "[ActivitiesManager] skip failed:",
                                        err
                                      );
                                      toast(
                                        "Failed to skip",
                                        "error"
                                      );
                                    }
                                  }}
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </div>

                          {/* edit button */}
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Edit activity settings"
                            title="Edit settings"
                            onClick={() => {
                              setEditId(a.id);
                              setETitle(a.title || "");
                              setEInstructions(a.instructions || "");
                              setEDescription(a.description || "");
                              const cfg = a.config || {};
                              setEConfigDraft({ ...cfg });
                            }}
                          >
                            <IconSettings
                              size={14}
                            />
                          </Button>

                          {/* reorder */}
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs hover:bg-white/10"
                              title="Move up"
                              aria-label="Move up"
                              onClick={async () => {
                                await moveActivity(
                                  a.id,
                                  -1
                                );
                              }}
                            >
                              ↑
                            </button>
                            <button
                              className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs hover:bg-white/10"
                              title="Move down"
                              aria-label="Move down"
                              onClick={async () => {
                                await moveActivity(
                                  a.id,
                                  1
                                );
                              }}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* "Add Activity" modal */}
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Add Activity"
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={create}
                  disabled={!title.trim()}
                >
                  Create
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              {/* Type */}
              <div className="flex gap-3">
                <label className="w-28 pt-2 text-sm">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as any)
                  }
                  className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                >
                  <option value="brainstorm">
                    Standard activity
                  </option>
                  <option value="stocktake">
                    Process stocktake
                  </option>
                  <option value="assignment">
                    Prompt assignment
                  </option>
                </select>
              </div>

              {/* Help text for type */}
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--muted)]">
                {type === "brainstorm" && (
                  <div>
                    Standard activity: capture one
                    or more submissions per
                    participant or group. Useful
                    for many tasks (e.g., draft an
                    outline, propose actions). You
                    can enable voting to
                    prioritize ideas.
                  </div>
                )}
                {type === "stocktake" && (
                  <div>
                    Review predefined initiatives
                    with Stop/Less/Same/More/Begin
                    ratings. Manage the list via
                    the Initiatives action on the
                    activity.
                  </div>
                )}
                {type === "assignment" && (
                  <div>
                    Distribute a list of prompts
                    across groups so each group
                    works on one. You can enable
                    voting later to compare
                    outputs.
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="flex gap-3">
                <label className="w-28 pt-2 text-sm">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                />
              </div>

              {/* Instructions */}
              <div className="flex gap-3">
                <label className="w-28 pt-2 text-sm">
                  Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) =>
                    setInstructions(
                      e.target.value
                    )
                  }
                  className="flex-1 min-h-20 rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                />
              </div>

              {/* Description */}
              <div className="flex gap-3">
                <label className="w-28 pt-2 text-sm">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  className="flex-1 min-h-20 rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                />
              </div>

              {/* Per-type settings */}
              <FacilitatorConfig
                type={type}
                draft={configDraft}
                onChange={(fn) => setConfigDraft(fn)}
              />
            </div>
          </Modal>

          {/* Edit Activity modal */}
          <Modal
            open={!!editId}
            onClose={() => setEditId(null)}
            title="Edit Activity"
            footer={
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditId(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const a = items.find(
                      (x) => x.id === editId
                    );
                    if (!a) return;

                    const patch: any = {
                      title: eTitle,
                      instructions:
                        eInstructions,
                      description:
                        eDescription,
                    };
                    // Use centralized edit draft config with schema validation
                    const v2 = validateConfig(a.type, eConfigDraft || {});
                    if (!v2.ok) {
                      toast(v2.error || "Invalid settings", "error");
                      return;
                    }
                    patch.config = v2.value;

                    try {
                      const r = await fetch(
                        "/api/activities/" + a.id,
                        {
                          method: "PATCH",
                          headers: {
                            "Content-Type":
                              "application/json",
                          },
                          body: JSON.stringify(
                            patch
                          ),
                        }
                      );
                      const j =
                        await r
                          .json()
                          .catch(() => ({}));
                      if (!r.ok) {
                        toast(
                          j.error ||
                            "Failed to update",
                          "error"
                        );
                        return;
                      }

                      toast(
                        "Activity updated",
                        "success"
                      );
                      setEditId(null);
                      await load();
                    } catch (err) {
                      console.error(
                        "[ActivitiesManager] save edit failed:",
                        err
                      );
                      toast(
                        "Failed to update",
                        "error"
                      );
                    }
                  }}
                >
                  Save
                </Button>
              </>
            }
          >
            {editId ? (
              (() => {
                const a = items.find(
                  (x) => x.id === editId
                );
                if (!a) {
                  return (
                    <div className="text-sm text-[var(--muted)]">
                      This activity no longer
                      exists.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="text-xs text-[var(--muted)]">
                      Type: {a.type}
                    </div>

                    {/* Title */}
                    <div className="flex gap-3">
                      <label className="w-28 pt-2 text-sm">
                        Title
                      </label>
                      <input
                        value={eTitle}
                        onChange={(e) =>
                          setETitle(
                            e.target.value
                          )
                        }
                        className="flex-1 h-10 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                      />
                    </div>

                    {/* Instructions */}
                    <div className="flex gap-3">
                      <label className="w-28 pt-2 text-sm">
                        Instructions
                      </label>
                      <textarea
                        value={eInstructions}
                        onChange={(e) =>
                          setEInstructions(
                            e.target.value
                          )
                        }
                        className="flex-1 min-h-20 rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                      />
                    </div>

                    {/* Description */}
                    <div className="flex gap-3">
                      <label className="w-28 pt-2 text-sm">
                        Description
                      </label>
                      <textarea
                        value={eDescription}
                        onChange={(e) =>
                          setEDescription(
                            e.target.value
                          )
                        }
                        className="flex-1 min-h-20 rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                      />
                    </div>

                    {/* Per-type settings */}
                    <FacilitatorConfig
                      type={a.type}
                      draft={eConfigDraft}
                      onChange={(fn) => setEConfigDraft(fn)}
                      onManageInitiatives={() => setManageId(a.id)}
                    />
                  </div>
                );
              })()
            ) : null}
          </Modal>

          {/* Stocktake initiatives modal */}
          <Modal
            open={!!manageId}
            onClose={() => setManageId(null)}
            title="Manage initiatives"
            footer={
              <Button
                variant="outline"
                onClick={() => setManageId(null)}
              >
                Close
              </Button>
            }
          >
            {manageId && (
              <StocktakeInitiativesManager
                activityId={manageId}
              />
            )}
          </Modal>
        </CardBody>
      </Card>
    </>
  );
}
