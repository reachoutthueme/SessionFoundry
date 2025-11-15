"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/apiFetch";
import Button from "@/components/ui/Button";
import { IconSettings } from "@/components/ui/Icons";
import { IconTimer, IconChevronRight } from "@/components/ui/Icons";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getActivityDisplayName } from "@/lib/activities/registry";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import StocktakeInitiativesManager from "@/components/session/StocktakeInitiativesManager";
import Timer from "@/components/ui/Timer";
import FacilitatorConfig from "@/components/activities/facilitator";
import { validateConfig } from "@/lib/activities/schemas";
import { StatusPill } from "@/components/ui/StatusPill";

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
  currentActivityId,
  onCurrentActivityChange,
  variant = "full",
}: {
  sessionId: string;
  sessionStatus?: string;
  currentActivityId?: string | null;
  onCurrentActivityChange?: (id: string | null) => void;
  variant?: "full" | "rail";
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

  // "Add step" modal state
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
  const [assignmentEditPromptDraft, setAssignmentEditPromptDraft] = useState("");

  // Stocktake modal state
  const [manageId, setManageId] = useState<string | null>(null);
  const [stockInitDraft, setStockInitDraft] = useState("");
  const [assignmentPromptDraft, setAssignmentPromptDraft] = useState("");

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
        apiFetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" }),
        apiFetch(`/api/groups?session_id=${sessionId}`, { cache: "no-store" }),
        apiFetch(`/api/activities/submission_counts?session_id=${sessionId}`, { cache: "no-store" }),
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
        const r = await apiFetch(
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

  const activitiesLabel = useMemo(
    () => (items.length === 1 ? "activity" : "activities"),
    [items.length]
  );

  const current = useMemo(
    () =>
      sorted.find(
        (a) => a.status === "Active" || a.status === "Voting"
      ) || null,
    [sorted]
  );

  // Track which activity is focused in the UI (for navigation/scrolling)
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Sync focusedId with either external currentActivityId or current live activity
  useEffect(() => {
    if (currentActivityId && sorted.some((a) => a.id === currentActivityId)) {
      setFocusedId(currentActivityId);
      return;
    }
    if (!currentActivityId && current?.id) {
      setFocusedId(current.id);
    }
  }, [currentActivityId, current?.id, sorted]);

  // Sticky footer visibility: show when stepper is out of view
  const stepperRef = useRef<HTMLDivElement | null>(null);
  const [showFooter, setShowFooter] = useState(false);
  useEffect(() => {
    const el = stepperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        // when stepper is not visible, show footer
        const e = entries[0];
        setShowFooter(!(e?.isIntersecting ?? true));
      },
      { root: null, threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Timer helpers for UI state (expiry, etc.)
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const isExpired = useMemo(() => {
    if (!current?.ends_at) return false;
    const ms = new Date(current.ends_at).getTime() - nowTs;
    return Number.isFinite(ms) && ms <= 0;
  }, [current?.ends_at, nowTs]);

  // Per-activity tab state for expanded view
  const [tabById, setTabById] = useState<Record<string, 'Overview'|'Submissions'|'Settings'>>({});

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
      const r = await apiFetch("/api/activities", {
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
      const r = await apiFetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();

      if (!r.ok) {
        toast(j.error || "Failed to update", "error");
        return;
      }

      // Optimistically merge the updated activity to avoid UI flicker
      const updated = j.activity as Activity | undefined;
      if (updated) {
        setItems((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      }
      toast("Status updated", "success");
    } catch (err) {
      console.error("[ActivitiesManager] setStatus() failed:", err);
      toast("Failed to update status", "error");
    }
  }

  async function extendTimer(id: string, minutes: number) {
    const act = items.find((a) => a.id === id);
    if (!act) return;

    try {
      const r = await apiFetch(`/api/activities/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: id, minutes }),
      });
      const j = await r.json().catch(() => ({} as any));

      if (!r.ok) {
        const e: any = j?.error;
        const msg = typeof e === "string"
          ? e
          : (typeof e?.message === "string"
              ? e.message
              : (e?.formErrors || e?.fieldErrors)
                ? "Invalid input"
                : "Failed to extend timer");
        toast(msg, "error");
        return;
      }

      toast(`+${minutes} min added`, "success");
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] extendTimer() failed:", err);
      toast("Failed to extend timer", "error");
    }
  }

  async function resetTimer(id: string) {
    const act = items.find((a) => a.id === id);
    if (!act) return;
    const tl = Number((act.config as any)?.time_limit_sec || 300);
    const starts = new Date().toISOString();
    const ends = new Date(Date.now() + tl * 1000).toISOString();
    try {
      const r = await apiFetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active", starts_at: starts, ends_at: ends }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        const e: any = j?.error;
        const msg = typeof e === "string"
          ? e
          : (typeof e?.message === "string"
              ? e.message
              : (e?.formErrors || e?.fieldErrors)
                ? "Invalid input"
                : "Failed to reset timer");
        toast(msg, "error");
        return;
      }
      toast("Timer reset", "success");
      await load();
    } catch (err) {
      console.error("[ActivitiesManager] resetTimer() failed:", err);
      toast("Failed to reset timer", "error");
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
        apiFetch(`/api/activities/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: target }),
        }),
        apiFetch(`/api/activities/${b.id}`, {
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

  const list = (
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
                {items.map((a, idx) => {
                  const status =
                    a.status === "Draft"
                      ? "Inactive"
                      : a.status;
                  const isCur = status === "Active" || status === "Voting";
                  const isExpanded = isCur || focusedId === a.id;
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

                   const expired = a.ends_at ? (new Date(a.ends_at).getTime() - nowTs) <= 0 : false;

                   // Collapsed one-liner for non-current, non-focused steps
                   if (!isExpanded) {
                     const denom = (max > 0 && groupList.length > 0) ? max * groupList.length : 0;
                     const remainSec = a.ends_at ? Math.max(0, Math.floor((new Date(a.ends_at).getTime() - nowTs)/1000)) : 0;
                     const mm = String(Math.floor(remainSec/60)).padStart(2,'0');
                     const ss = String(remainSec%60).padStart(2,'0');
                     const handleSelectCollapsed = () => {
                       setFocusedId(a.id);
                       onCurrentActivityChange?.(a.id);
                     };

                     return (
                       <div key={a.id} className={`rounded-md border px-3 py-2 ${tone}`}>
                         <div className="flex items-center justify-between gap-2">
                           <div className="min-w-0 flex items-center gap-2 text-sm">
                             <span className="opacity-70">{idx+1}.</span>
                             <span className="truncate max-w-[32ch]">{a.title || getActivityDisplayName(a.type)}</span>
                            <span className="text-xs text-[var(--muted)]">[{a.type === 'brainstorm' ? 'standard' : a.type}]</span>
                           </div>
                           <div className="flex items-center gap-3 text-xs">
                             <StatusPill status={(status as any) === 'Inactive' ? 'Queued' : (status as any)} />
                             {a.ends_at && <span className="opacity-80">{mm}:{ss}</span>}
                             {denom > 0 && <span className="opacity-80">{cc.total}/{denom}</span>}
                             <button className="rounded px-2 py-1 hover:bg-white/5" onClick={handleSelectCollapsed}>Expand</button>
                           </div>
                         </div>
                       </div>
                     );
                  }

                  const tab = tabById[a.id] ?? (isCur ? 'Submissions' : 'Overview');

                  return (
                     <div key={a.id} className={`rounded-2xl border p-3 ${tone}`}>
                       {status === 'Active' ? (
                         <div className="absolute -ml-3 mt-[-12px] mb-[-12px] inset-y-0 left-0 w-[3px] rounded-l-xl bg-gradient-to-b from-[var(--brand)] to-transparent" aria-hidden="true" />
                       ) : null}
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
                            {status === 'Active' && a.ends_at ? (
                              expired ? (
                                <StatusPill status="Overdue" label="Overdue" />
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[var(--muted)]"><IconTimer size={12} /> <Timer endsAt={a.ends_at} /></span>
                                  <Button size="sm" variant="outline" className="px-2 py-0.5 text-[10px]" onClick={() => extendTimer(a.id, 1)}>+1m</Button>
                                  <Button size="sm" variant="outline" className="px-2 py-0.5 text-[10px]" onClick={() => extendTimer(a.id, 5)}>+5m</Button>
                                </>
                              )
                            ) : (
                              <StatusPill status={(status as any) === 'Inactive' ? 'Queued' : (status as any)} />
                            )}
                          </div>

                          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs">
                            {(['Overview','Submissions'] as const).map(t => (
                              <button key={t} onClick={()=>setTabById(prev=>({...prev,[a.id]:t}))} className={`px-2 py-0.5 rounded-full ${tab===t ? 'bg-[var(--brand)] text-[var(--btn-on-brand)]' : 'text-[var(--muted)] hover:bg-white/5'}`}>{t}</button>
                            ))}
                          </div>

                          {tab === 'Submissions' && (a.type === 'brainstorm' || a.type === 'assignment') && (
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
                                          className={"h-full bg-[var(--brand)] " + (sessionStatus === "Active" ? "progress-striped progress-animate" : "") }
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

                          {tab === 'Overview' && (
                            <div className="mt-3 text-xs text-[var(--muted)]">
                              {a.description ? a.description : a.instructions}
                            </div>
                          )}

                          {/* Settings tab removed; gear menu handles settings */}
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
                              Actions
                              <IconChevronRight size={12} className={`ml-1 transition-transform ${menuId === a.id ? 'rotate-90' : ''}`} />
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
                                        await apiFetch(
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
                              <IconChevronRight size={12} className="transform -rotate-90" />
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
                              <IconChevronRight size={12} className="transform rotate-90" />
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

          {/* Sticky footer controls */}
          {showFooter && (
            <div className="pointer-events-none fixed inset-x-0 bottom-2 z-20 flex justify-center">
              <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/12 bg-[var(--panel)]/95 px-3 py-2 shadow-lg backdrop-blur">
                <Button size="sm" variant="outline" onClick={async ()=>{
                  // Move to previous: find sorted index before current focused
                  const arr = [...sorted];
                  const i = focusedId ? arr.findIndex(a=>a.id===focusedId) : -1;
                  const prev = i>0 ? arr[i-1] : null;
                  if (prev) {
                    setFocusedId(prev.id);
                    onCurrentActivityChange?.(prev.id);
                  }
                }}>Previous</Button>
                <Button size="sm" onClick={async ()=>{
                  // Close current active and activate next draft/inactive
                  try {
                    const arr = [...sorted];
                    const curIdx = arr.findIndex(a=>a.status==='Active' || a.status==='Voting');
                    const nxt = arr.find((a,ix)=> ix>curIdx && (a.status==='Draft' || (a.status as any)==='Inactive'));
                    if (curIdx>=0) await setStatus(arr[curIdx].id,'Closed');
                    if (nxt) await setStatus(nxt.id,'Active');
                    else toast('No more activities','info');
                  } catch { toast('Failed to advance','error'); }
                }}>Next</Button>
                <details className="relative">
                  <summary className="list-none inline-flex"><Button size="sm" variant="outline">Add time</Button></summary>
                  <div className="absolute right-0 mt-1 w-36 rounded-md border border-white/12 bg-[var(--panel)] p-1 shadow-lg">
                    {[{m:1,label:'+1 minute'},{m:5,label:'+5 minutes'}].map(({m,label})=> (
                      <button key={m} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-white/5" onClick={(e)=>{
                        const cur = sorted.find(a=>a.status==='Active' || a.status==='Voting');
                        if (!cur) { toast('No active activity','info'); const d=(e.currentTarget.closest('details') as HTMLDetailsElement|null); if(d) d.open=false; return; }
                        extendTimer(cur.id, m);
                        const d=(e.currentTarget.closest('details') as HTMLDetailsElement|null); if(d) d.open=false;
                      }}>{label}</button>
                    ))}
                  </div>
                </details>
                <Button size="sm" variant="outline" onClick={async ()=>{ await apiFetch(`/api/session/${sessionId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'Completed' }) }); toast('Session ended','success'); }}>End</Button>
                {current && (
                  <span className="ml-2 text-xs text-[var(--muted)]">Current: <span className="text-[var(--text)]">{current.title || getActivityDisplayName(current.type)}</span> {(() => { const cc = counts[current.id]||{total:0,max:0,byGroup:{}}; const groupCount = groups.length; const denom = (cc.max||0)* (groupCount||0); return denom>0 ? `(${cc.total}/${denom})` : ''; })()}</span>
                )}
              </div>
            </div>
          )}

          {/* "Add activity" modal */}
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Add activity"
            size="xl"
            footer={
              <>
                <div className="mr-auto text-xs text-[var(--muted)]">
                  {/* Summary bar */}
                  {(() => {
                    const parts: string[] = [];
                    parts.push(type === 'brainstorm' ? 'Brainstorm' : type === 'stocktake' ? 'Stocktake' : 'Assignment');
                    const ms = Number(configDraft?.max_submissions || 0);
                    if (type !== 'stocktake' && ms) parts.push(`${ms} submissions per participant`);
                    if (type !== 'stocktake') parts.push((configDraft?.voting_enabled ? 'Voting on' : 'Voting off'));
                    const tl = Number(configDraft?.time_limit_sec || 0);
                    if (tl) parts.push(`${Math.floor(tl/60)}:${String(tl%60).padStart(2,'0')}`);
                    return <span>{parts.join(' • ')}</span>;
                  })()}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={create}
                  disabled={title.trim().length<2 || title.trim().length>80 || (type!=='stocktake' && configDraft?.voting_enabled && !(Number(configDraft?.points_budget)||0))}
                >
                  Create
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Left: form */}
              <div className="space-y-3 min-w-0">
                {/* Type cards */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr items-start content-start">
                  {[{ key:'brainstorm', title:'Standard activity', tag:'Collect ideas, then (optionally) vote.', bullets:['Each participant/group submits 1–N items','Optional point-based voting','Best for ideation & short pitches'] },
                    { key:'stocktake', title:'Stocktake', tag:'Vote S/L/S/M/B on initiatives.', bullets:['You define initiatives','Everyone votes once per initiative','Best for prioritization/portfolio'] },
                    { key:'assignment', title:'Assignment', tag:'Give a prompt; teams submit to that prompt.', bullets:['You define prompts (each row = an item)','Teams submit one deliverable','Best for quick exercises'] }].map((c:any)=>{
                    const active = type===c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => { if (c.key !== type) setType(c.key as any); }}
                        className={`min-w-0 h-full text-left rounded-md border p-3 transition ${active? 'border-white/30 bg-white/10' : 'border-white/10 hover:bg-white/5'} flex flex-col items-start justify-start gap-1`}
                      >
                        <div className="font-medium">{c.title}</div>
                        <div className="min-h-[56px] text-xs text-[var(--muted)] mt-0.5">{c.tag}</div>
                        <ul className="mt-2 text-xs list-disc pl-4 text-[var(--muted)] break-words">
                          {c.bullets.map((b:string)=> <li key={b}>{b}</li>)}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm">Title</label>
                  <div className="text-[10px] text-[var(--muted)] mb-1">What participants will see at the top of the screen.</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Top risks in Q1 delivery"
                    className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                  />
                  {title.trim().length>0 && (title.trim().length<2 || title.trim().length>80) && (
                    <div className="mt-1 text-xs text-rose-300">Enter a title (2–80 characters).</div>
                  )}
                </div>

                {/* Instructions / Prompt (label varies) */}
                <div>
                  <label className="block text-sm">{type==='assignment' ? 'Prompt' : 'Instructions'}</label>
                  <div className="text-[10px] text-[var(--muted)] mb-1">What you want them to do. Keep it action-oriented (e.g., “List 3 risks for…”).</div>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={type==='assignment' ? 'List 3 risks and 1 mitigation for each.' : 'Describe the task clearly and briefly.'}
                    className="min-h-20 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm">Description</label>
                  <div className="text-[10px] text-[var(--muted)] mb-1">Optional context visible to everyone.</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Any facilitator notes or context"
                    className="min-h-20 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
                  />
                </div>

                {/* Per-type settings */}
                {type!=="stocktake" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm">Max submissions <span className="text-[var(--muted)]">(per participant)</span></label>
                      <input
                        type="number"
                        value={configDraft?.max_submissions ?? ''}
                        onChange={(e)=> setConfigDraft((prev:any)=> ({...prev, max_submissions: Math.max(0, parseInt(e.target.value||'0',10)||0)}))}
                        placeholder="3"
                        className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                      />
                      <div className="text-[10px] text-[var(--muted)] mt-1">Upper limit per participant/group (0 = unlimited).</div>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input id="voting-enabled" type="checkbox" checked={!!configDraft?.voting_enabled} onChange={(e)=> setConfigDraft((prev:any)=> ({...prev, voting_enabled: e.target.checked, points_budget: e.target.checked ? (prev?.points_budget||100) : undefined}))} />
                      <label htmlFor="voting-enabled" className="text-sm">Enable voting</label>
                    </div>
                    {configDraft?.voting_enabled && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm">Points budget <span className="text-[var(--muted)]">(per voter)</span></label>
                        <input
                          type="number"
                          value={configDraft?.points_budget ?? ''}
                          onChange={(e)=> setConfigDraft((prev:any)=> ({...prev, points_budget: Math.max(1, parseInt(e.target.value||'0',10)||0)}))}
                          placeholder="100"
                          className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                        />
                        {(!Number(configDraft?.points_budget) || Number(configDraft?.points_budget) < 1) && (
                          <div className="mt-1 text-xs text-rose-300">Points budget must be ≥ 1 when voting is enabled.</div>
                        )}
                        <div className="text-[10px] text-[var(--muted)] mt-1">Tip: With 100 points, a voter could put 40 on idea A, 30 on B, 30 on C.</div>
                      </div>
                    )}
                  </div>
                )}

                {type==="assignment" && (
                  <div>
                    <label className="block text-sm">Prompts</label>
                    <div className="text-[10px] text-[var(--muted)] mb-2">Each item on this list is a prompt. One item will be randomly assigned to each team.</div>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={assignmentPromptDraft}
                        onChange={(e)=> setAssignmentPromptDraft(e.target.value)}
                        placeholder="Add prompt"
                        className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                        maxLength={200}
                        onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); const t=assignmentPromptDraft.trim(); if(!t) return; setConfigDraft((prev:any)=> ({...prev, prompts: [...(Array.isArray(prev?.prompts)?prev.prompts:[]), t]})); setAssignmentPromptDraft(""); } }}
                      />
                      <Button onClick={()=>{ const t=assignmentPromptDraft.trim(); if(!t) return; setConfigDraft((prev:any)=> ({...prev, prompts: [...(Array.isArray(prev?.prompts)?prev.prompts:[]), t]})); setAssignmentPromptDraft(""); }}>Add</Button>
                    </div>
                    {!(Array.isArray(configDraft?.prompts) && configDraft.prompts.length>0) ? (
                      <div className="text-sm text-[var(--muted)]">No prompts yet.</div>
                    ) : (
                      <ul className="space-y-2">
                        {(configDraft.prompts as string[]).map((it:string, idx:number)=> (
                          <li key={idx} className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between">
                            <span className="text-sm break-words">{it}</span>
                            <Button size="sm" variant="outline" onClick={()=> setConfigDraft((prev:any)=> ({...prev, prompts: (prev.prompts as string[]).filter((_,i)=> i!==idx)}))}>Remove</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {type==="stocktake" && (
                  <div>
                    <label className="block text-sm">Stocktake initiatives</label>
                    <div className="text-[10px] text-[var(--muted)] mb-2">Add or remove items</div>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={stockInitDraft}
                        onChange={(e)=> setStockInitDraft(e.target.value)}
                        placeholder="Add initiative"
                        className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                        maxLength={200}
                        onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); const t=stockInitDraft.trim(); if(!t) return; setConfigDraft((prev:any)=> ({...prev, initial_initiatives: [...(Array.isArray(prev?.initial_initiatives)?prev.initial_initiatives:[]), t]})); setStockInitDraft(""); } }}
                      />
                      <Button onClick={()=>{ const t=stockInitDraft.trim(); if(!t) return; setConfigDraft((prev:any)=> ({...prev, initial_initiatives: [...(Array.isArray(prev?.initial_initiatives)?prev.initial_initiatives:[]), t]})); setStockInitDraft(""); }}>Add</Button>
                    </div>
                    {!(Array.isArray(configDraft?.initial_initiatives) && configDraft.initial_initiatives.length>0) ? (
                      <div className="text-sm text-[var(--muted)]">No initiatives yet.</div>
                    ) : (
                      <ul className="space-y-2">
                        {(configDraft.initial_initiatives as string[]).map((it:string, idx:number)=> (
                          <li key={idx} className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between">
                            <span className="text-sm break-words">{it}</span>
                            <Button size="sm" variant="outline" onClick={()=> setConfigDraft((prev:any)=> ({...prev, initial_initiatives: (prev.initial_initiatives as string[]).filter((_,i)=> i!==idx)}))}>Remove</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Time limit */}
                <div>
                  <label className="block text-sm">Time limit <span className="text-[var(--muted)]">(seconds)</span></label>
                  <div className="text-[10px] text-[var(--muted)] mb-1">Timer is visible to all and you can extend it during the activity.</div>
                  <input
                    type="number"
                    value={configDraft?.time_limit_sec ?? ''}
                    onChange={(e)=> setConfigDraft((prev:any)=> ({...prev, time_limit_sec: Math.max(0, parseInt(e.target.value||'0',10)||0)}))}
                    placeholder="300"
                    className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
                  />
                </div>
              </div>

              {/* Right: live preview */}
              <div className="rounded-md border border-white/10 bg-white/5 p-3 min-w-0">
                <div className="mb-2 text-xs text-[var(--muted)]">Preview — participant view</div>
                <div className="rounded-md border border-white/10 bg-[var(--panel)] p-3">
                  <div className="text-lg font-semibold">{title || (type==='assignment' ? 'Untitled assignment' : type==='stocktake' ? 'Untitled stocktake' : 'Untitled activity')}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{instructions || (type==='assignment' ? 'Your assigned prompt will appear here.' : 'Instructions will appear here.')}</div>
                  <div className="mt-3">
                    {type==='brainstorm' && (
                      <div className="text-sm">
                        <div className="mb-1">Submission box</div>
                        <div className="h-8 rounded border border-white/10 bg-white/5" />
                        {configDraft?.voting_enabled && (
                          <div className="mt-3">
                            <div className="mb-1 text-xs text-[var(--muted)]">Voting chips (example)</div>
                            <div className="inline-flex gap-1">
                              {[10,20,30,40].map(p=> <span key={p} className="rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-xs">+{p}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {type==='assignment' && (
                      <div className="text-sm">
                        <div className="mb-1">Assigned item</div>
                        <div className="rounded border border-white/10 bg-white/5 p-2 text-xs">{(configDraft?.prompts && configDraft.prompts[0]) || 'One of the prompt items will be randomly assigned to each team.'}</div>
                        <div className="mt-2 text-[10px] text-[var(--muted)]">Each row in the prompts list is an item. One item is randomly assigned to each team.</div>
                      </div>
                    )}
                    {type==='stocktake' && (
                      <div className="text-sm">
                        <div className="mb-1">Rate initiative</div>
                        <div className="inline-flex gap-1 text-xs">
                          {['stop','less','same','more','begin'].map(c=> (
                            <span key={c} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{c}</span>
                          ))}
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 text-xs text-[var(--muted)]">Initiatives preview</div>
                          {Array.isArray(configDraft?.initial_initiatives) && configDraft.initial_initiatives.length > 0 ? (
                            <ul className="space-y-2 max-h-48 overflow-auto pr-1">
                              {(configDraft.initial_initiatives as string[]).map((t, i) => (
                                <li key={i} className="rounded-md border border-white/10 bg-white/5 p-2">
                                  <div className="mb-1 text-xs break-words">{t || 'Untitled'}</div>
                                  <div className="inline-flex gap-1 text-[10px]">
                                    {['stop','less','same','more','begin'].map(c => (
                                      <span key={c} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{c}</span>
                                    ))}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs text-[var(--muted)]">No initiatives yet. Add them on the left.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                      const r = await apiFetch(
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

                    {/* Inline prompts manager for Assignment type */}
                    {a.type === 'assignment' && (
                      <div className="mt-3">
                        <label className="block text-sm">Prompts</label>
                        <div className="text-[10px] text-[var(--muted)] mb-2">Each item on this list is a prompt. One item will be randomly assigned to each team.</div>
                        <div className="flex gap-2 mb-3">
                          <input
                            value={assignmentEditPromptDraft}
                            onChange={(e)=> setAssignmentEditPromptDraft(e.target.value)}
                            placeholder="Add prompt"
                            className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                            maxLength={200}
                            onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); const t=assignmentEditPromptDraft.trim(); if(!t) return; setEConfigDraft((prev:any)=> ({...prev, prompts: [...(Array.isArray(prev?.prompts)?prev.prompts:[]), t]})); setAssignmentEditPromptDraft(""); } }}
                          />
                          <Button onClick={()=>{ const t=assignmentEditPromptDraft.trim(); if(!t) return; setEConfigDraft((prev:any)=> ({...prev, prompts: [...(Array.isArray(prev?.prompts)?prev.prompts:[]), t]})); setAssignmentEditPromptDraft(""); }}>Add</Button>
                        </div>
                        {!(Array.isArray(eConfigDraft?.prompts) && eConfigDraft.prompts.length>0) ? (
                          <div className="text-sm text-[var(--muted)]">No prompts yet.</div>
                        ) : (
                          <ul className="space-y-2">
                            {(eConfigDraft.prompts as string[]).map((it:string, idx:number)=> (
                              <li key={idx} className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between">
                                <span className="text-sm break-words">{it}</span>
                                <Button size="sm" variant="outline" onClick={()=> setEConfigDraft((prev:any)=> ({...prev, prompts: (prev.prompts as string[]).filter((_,i)=> i!==idx)}))}>Remove</Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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

