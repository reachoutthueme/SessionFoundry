"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getParticipantPanel } from "@/lib/activities/components";
import Timer from "@/components/ui/Timer";
import { IconBrain, IconList, IconTimer, IconVote, IconLock, IconChevronRight } from "@/components/ui/Icons";
import { getActivityDisplayName } from "@/lib/activities/registry";
import OverallLeaderboard from "@/components/session/OverallLeaderboard";
import ActivityLeaderboard from "@/components/session/ActivityLeaderboard";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/app/lib/apiFetch";
import { StatusPill } from "@/components/ui/StatusPill";

type Activity = { id: string; type: "brainstorm"|"stocktake"|"assignment"; status: string; title?: string; instructions?: string; description?: string; ends_at?: string|null; config?: any };
type Part = { id: string; display_name?: string|null; group_id?: string|null };

type GroupJoinScreenProps = {
  sessionId: string;
  sessionName: string;
  participant: any;
  groups: any[];
  participants: Part[];
  onJoin: (groupId: string) => Promise<void> | void;
  reload: () => Promise<void> | void;
  setParticipant: (p: any) => void;
  onConfirm: () => void;
};

export default function ParticipantPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participant, setParticipant] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Part[]>([]);
  const [active, setActive] = useState<Activity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showActLb, setShowActLb] = useState(false);
  const [showOverall, setShowOverall] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Require explicit confirmation on arriving at participant view
  const [mustChoose, setMustChoose] = useState(true);
  const sessionName = useMemo(() => {
    try { return localStorage.getItem(`sf_last_session_name_${sessionId}`) || "Session"; } catch { return "Session"; }
  }, [sessionId]);
  const groupName = useMemo(() => {
    try {
      const gid = (participant as any)?.group_id as string | undefined;
      if (!gid) return null;
      const g = (groups as any[]).find((x:any) => x.id === gid);
      return g?.name || null;
    } catch { return null; }
  }, [participant, groups]);
  // Timer pill color ramp helper
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!active?.ends_at) return;
    const t = setInterval(() => setNowTs(Date.now()), 10000);
    return () => clearInterval(t);
  }, [active?.ends_at]);
  function timerPillClass(endsAt?: string | null) {
    if (!endsAt) return "timer-brand";
    const ms = new Date(endsAt).getTime() - nowTs;
    const mins = ms / 60000;
    if (mins <= 2) return "timer-red";
    if (mins <= 5) return "timer-amber";
    return "timer-brand";
  }

  async function load() {
    function safeJson(r: Response) {
      return r.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
    }
    try {
      const [pR, gR, aR, pplR] = await Promise.all([
        fetch(`/api/participant?session_id=${sessionId}`),
        fetch(`/api/public/groups?session_id=${sessionId}`),
        fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" }),
        fetch(`/api/public/participants?session_id=${sessionId}`, { cache: "no-store" }),
      ]);
      const [pj, gj, aj, pplj] = await Promise.all([ safeJson(pR), safeJson(gR), safeJson(aR), safeJson(pplR) ]);
      setParticipant(pj?.participant ?? null);
      setGroups(gj?.groups ?? []);
      setParticipants((pplj?.participants ?? []).map((x:any)=>({ id: String(x.id), display_name: x.display_name || null, group_id: x.group_id || null })));
      const list: Activity[] = (aj?.activities ?? []) as Activity[];
      setActivities(list);
      const act = list.find((a: Activity)=> a.status === "Active" || a.status === "Voting") || null;
      setActive(act);
    } catch {
      setParticipant(null);
      setGroups([]);
      setActive(null);
    }
  }

  useEffect(() => { load(); }, [sessionId]);
  // Periodically refresh to reflect facilitator actions (start/vote/end)
  useEffect(() => {
    const iv = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(iv);
  }, [sessionId]);
  // Shortcuts: Enter opens active, '?' help, 'g' focuses group
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as any)?.isContentEditable;
      if (isTyping) return;
      if (selected) return;
      if (e.key === 'Enter' && (active && (active.status === 'Active' || active.status === 'Voting'))) {
        e.preventDefault();
        setSelected(active);
      }
      if (e.key === '?') {
        e.preventDefault();
        alert('Shortcuts:\nEnter: Open active activity');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, selected]);
  useEffect(() => {
    // If user has already confirmed their group choice on this device, skip the chooser
    try {
      const v = localStorage.getItem(`sf_group_confirmed_${sessionId}`);
      setMustChoose(v !== '1');
    } catch { setMustChoose(true); }
  }, [sessionId]);
  // Light polling to reflect live joins/leaves while choosing a group
  useEffect(() => {
    const needs = !participant || !participant.group_id;
    if (!needs) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [participant]);

  // Live region for activity announcements (must be declared before any early returns)
  const liveRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active) return;
    try {
      const title = active.title || getActivityDisplayName(active.type);
      if (liveRef.current) liveRef.current.textContent = `${title} is now active.`;
    } catch {}
  }, [active?.id]);

  async function join(group_id: string) {
    const r = await apiFetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, group_id })
    });
    const text = await r.text();
    let j: any = {}; try { j = text ? JSON.parse(text) : {}; } catch {}
    if (r.ok && j.participant) setParticipant(j.participant); else alert(j.error || "Failed to join group");
  }

  const needsGroup = !participant || !participant.group_id;
  if (needsGroup || mustChoose) {
    return (
      <GroupJoinScreen
        sessionId={sessionId as string}
        sessionName={sessionName}
        participant={participant}
        groups={groups}
        participants={participants}
        onJoin={join}
        reload={load}
        setParticipant={setParticipant}
        onConfirm={() => { try { localStorage.setItem(`sf_group_confirmed_${sessionId}`, '1'); } catch {}; setMustChoose(false); }}
      />
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Header with session + active status */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Session
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {sessionName}
              </h1>
              {groupName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  In group {groupName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {active && (
              <div className="flex items-center gap-2 text-xs">
                <StatusPill
                  status={(active.status === "Draft" ? "Queued" : active.status) as any}
                  label={active.status}
                />
                {active.ends_at ? (
                  <div className={timerPillClass(active.ends_at)}>
                    <Timer endsAt={active.ends_at} />
                  </div>
                ) : null}
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]">
          {/* Left column: activities */}
          <div className="space-y-3">
            <Card>
              <CardHeader
                title="Activities"
                subtitle={
                  active
                    ? "Open the step your facilitator just started."
                    : "Waiting for your facilitator to start an activity."
                }
              />
              <CardBody className="space-y-2">
                {activities.length === 0 ? (
                  <div className="text-sm text-[var(--muted)]">
                    No activities have been added yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activities.map((a) => {
                      const isCurrent = active && active.id === a.id;
                      const isLocked = a.status !== "Active" && a.status !== "Voting";
                      const pillStatus =
                        (a.status === "Draft"
                          ? "Queued"
                          : a.status === "Completed"
                          ? "Closed"
                          : a.status) as any;
                      return (
                        <button
                          key={a.id}
                          onClick={() => {
                            if (!isLocked) setSelected(a);
                          }}
                          className={`w-full rounded-md border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10 ${
                            isCurrent ? "ring-1 ring-[var(--brand)]" : ""
                          } ${isLocked ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                                {a.type === "brainstorm" ? (
                                  <IconBrain size={16} />
                                ) : a.type === "stocktake" ? (
                                  <IconList size={16} />
                                ) : (
                                  <IconVote size={16} />
                                )}
                              </span>
                              <div>
                                <div className="font-medium">
                                  {a.title || getActivityDisplayName(a.type)}
                                </div>
                                {a.description || a.instructions ? (
                                  <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                                    {a.description || a.instructions}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-xs">
                              <StatusPill status={pillStatus} label={a.status} />
                              {a.ends_at && (a.status === "Active" || a.status === "Voting") && (
                                <div className={timerPillClass(a.ends_at)}>
                                  <span className="inline-flex items-center gap-1">
                                    <IconTimer size={12} />
                                    <Timer endsAt={a.ends_at} />
                                  </span>
                                </div>
                              )}
                              {isLocked ? (
                                <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                                  <IconLock size={12} />
                                  Locked
                                </span>
                              ) : isCurrent ? (
                                <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  Active now
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right column: group + leaderboards */}
          <div className="space-y-3">
            {/* Group members */}
            <Card>
              <CardHeader
                title="Your group"
                subtitle={
                  groupName
                    ? groupName
                    : "You haven't joined a group in this session."
                }
              />
              <CardBody>
                {participant?.group_id ? (
                  (() => {
                    const gid = participant.group_id as string;
                    const members = participants.filter((p) => p.group_id === gid);
                    if (!members.length) {
                      return (
                        <div className="text-sm text-[var(--muted)]">
                          No one else has joined your group yet.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {members.map((m) => (
                            <div
                              key={m.id}
                              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-2 py-1 text-xs"
                            >
                              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-semibold">
                                {(m.display_name || "?")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                              <span className="max-w-[130px] truncate">
                                {m.display_name || `Anon ${m.id.slice(0, 4)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {members.length}{" "}
                          {members.length === 1 ? "person in your group" : "people in your group"}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-[var(--muted)]">
                    Join a group first to see your teammates here.
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Leaderboard shortcuts */}
            <Card>
              <CardHeader
                title="Leaderboards"
                subtitle="See how groups are scoring"
              />
              <CardBody>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    disabled={!active}
                    onClick={() => setShowActLb(true)}
                  >
                    <span>Current activity</span>
                    <IconChevronRight size={14} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => setShowOverall(true)}
                  >
                    <span>Overall workshop</span>
                    <IconChevronRight size={14} />
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <div ref={liveRef} aria-live="polite" className="sr-only" />
      </div>

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={selected.title || getActivityDisplayName(selected.type)}
        >
          {(() => {
            const Panel = getParticipantPanel(selected.type);
            if (!Panel) {
              return (
                <div className="text-sm text-[var(--muted)]">
                  This activity type is not available for participants yet.
                </div>
              );
            }
            return (
              <Panel
                sessionId={sessionId as string}
                activity={selected as any}
                onComplete={() => {
                  setCompleted((prev) => ({ ...prev, [selected.id]: true }));
                  setSelected(null);
                }}
              />
            );
          })()}
        </Modal>
      )}

      {showActLb && active && (
        <Modal
          open
          onClose={() => setShowActLb(false)}
          title="Activity leaderboard"
        >
          <ActivityLeaderboard
            activityId={active.id}
            onClose={() => setShowActLb(false)}
          />
        </Modal>
      )}

      {showOverall && (
        <Modal
          open
          onClose={() => setShowOverall(false)}
          title="Overall leaderboard"
        >
          <OverallLeaderboard
            sessionId={sessionId as string}
            onClose={() => setShowOverall(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function GroupJoinScreen({
  sessionId,
  sessionName,
  participant,
  groups,
  participants,
  onJoin,
  reload,
  setParticipant,
  onConfirm,
}: GroupJoinScreenProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");

  function membersFor(groupId: string) {
    return participants.filter((p) => p.group_id === groupId);
  }

  async function createGroup() {
    const clean = newGroupName.trim();
    if (!clean || createBusy) return;
    setCreateBusy(true);
    try {
      const r = await apiFetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, name: clean }),
      });
      const text = await r.text();
      let j: any = {};
      try { j = text ? JSON.parse(text) : {}; } catch {}
      if (!r.ok) {
        alert(j.error || "Failed to create group");
        return;
      }
      setNewGroupName("");
      setCreateOpen(false);
      await reload();
    } catch {
      alert("Failed to create group");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveName() {
    const clean = editName.trim();
    try {
      const r = await apiFetch(`/api/participant?session_id=${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: clean || null }),
      });
      const text = await r.text();
      let j: any = {};
      try { j = text ? JSON.parse(text) : {}; } catch {}
      if (!r.ok) {
        alert(j.error || "Failed to update name");
        return;
      }
      setParticipant(j.participant ?? null);
      setEditNameOpen(false);
    } catch {
      alert("Failed to update name");
    }
  }

  useEffect(() => {
    // Keep focusIdx within bounds if groups change
    if (!groups.length) {
      setFocusIdx(0);
      return;
    }
    setFocusIdx((idx) => {
      if (idx < 0) return 0;
      if (idx >= groups.length) return groups.length - 1;
      return idx;
    });
  }, [groups.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as any)?.isContentEditable;
      if (isTyping) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }

      if (!groups.length) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((idx) => (idx + 1) % groups.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((idx) => (idx - 1 + groups.length) % groups.length);
      } else if (e.key === "Enter") {
        const btn = cardRefs.current[focusIdx];
        if (btn) btn.click();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups.length, focusIdx]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="w-full max-w-xl sm:max-w-2xl animate-fade-up">
          <div className="mb-3 text-center text-xs uppercase tracking-wide text-[var(--muted)]">
            Step 2 of 3 - Join a group
          </div>
          <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,.35)] p-6">
            <div className="text-center mb-4">
              <div className="text-sm text-[var(--muted)]">{sessionName}</div>
              <div className="mt-1 text-2xl font-semibold">Pick a group to join</div>
              <div className="mt-1">You'll collaborate with teammates in this group.</div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                {participant?.display_name ? (
                  <>
                    Your display name:{" "}
                    <span className="opacity-90">{participant.display_name}</span>.{" "}
                    <button
                      className="underline hover:opacity-80"
                      onClick={() => {
                        setEditName(participant.display_name || "");
                        setEditNameOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </>
                ) : (
                  <button
                    className="underline hover:opacity-80"
                    onClick={() => {
                      setEditName("");
                      setEditNameOpen(true);
                    }}
                  >
                    Add your name
                  </button>
                )}
              </div>
            </div>

            {groups.length === 0 ? (
              <div className="text-sm text-[var(--muted)] text-center py-6">
                Waiting for facilitator to create a group.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groups.map((g, idx) => {
                  const members = membersFor(g.id);
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl bg-white/4 border border-white/10 hover:bg-white/[.06] transition-colors"
                    >
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{g.name}</div>
                            <div
                              className="mt-1 text-xs text-[var(--muted)] animate-fade-up"
                              key={members.length}
                            >
                              {members.length}{" "}
                              {members.length === 1 ? "person" : "people"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {members.slice(0, 5).map((m) => (
                            <div
                              key={m.id}
                              className="-ml-2 first:ml-0 w-6 h-6 rounded-full bg-white/10 border border-white/20 grid place-items-center text-[10px] font-semibold ring-1 ring-white/20 animate-avatar-pop"
                              title={m.display_name || `#${m.id.slice(0, 6)}`}
                            >
                              {(m.display_name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          ))}
                          {members.length > 5 && (
                            <div className="-ml-2 w-6 h-6 rounded-full bg-white/10 border border-white/20 grid place-items-center text-[10px]">
                              +{members.length - 5}
                            </div>
                          )}
                        </div>
                        <div>
                          <button
                            ref={(el) => {
                              cardRefs.current[idx] = el;
                            }}
                            onClick={async () => {
                              await onJoin(g.id);
                              onConfirm();
                            }}
                            className="w-full inline-flex items-center justify-center h-9 px-3 rounded-md bg-[var(--brand)] text-[var(--btn-on-brand)] focus:outline-none focus:ring-[var(--ring)]"
                            tabIndex={idx === focusIdx ? 0 : -1}
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-[var(--muted)]">
                Press N to create a new group
              </div>
              <div className="flex items-center gap-2">
                {participant?.group_id ? (
                  <Button variant="ghost" onClick={() => onConfirm()}>
                    Continue with current group
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  Create group
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Create a group"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Group name</label>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                placeholder="e.g., Team Fox"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={createGroup}
                disabled={!newGroupName.trim() || createBusy}
              >
                {createBusy ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={editNameOpen}
          onClose={() => setEditNameOpen(false)}
          title="Update your name"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Display name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                placeholder="Your name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditNameOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveName}>Save</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}





