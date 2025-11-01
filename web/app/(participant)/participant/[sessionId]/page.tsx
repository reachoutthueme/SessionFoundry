"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getParticipantPanel } from "@/lib/activities/components";
import Timer from "@/components/ui/Timer";
import { IconBrain, IconList, IconTimer, IconVote, IconLock } from "@/components/ui/Icons";
import { getActivityDisplayName } from "@/lib/activities/registry";
import OverallLeaderboard from "@/components/session/OverallLeaderboard";
import { useMemo, useRef } from "react";
import Modal from "@/components/ui/Modal";

type Activity = { id: string; type: "brainstorm"|"stocktake"|"assignment"; status: string; title?: string; instructions?: string; description?: string; ends_at?: string|null; config?: any };
type Part = { id: string; display_name?: string|null; group_id?: string|null };

export default function ParticipantPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participant, setParticipant] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Part[]>([]);
  const [active, setActive] = useState<Activity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showOverall, setShowOverall] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const sessionName = useMemo(() => {
    try { return localStorage.getItem(`sf_last_session_name_${sessionId}`) || "Session"; } catch { return "Session"; }
  }, [sessionId]);

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
  // Light polling to reflect live joins/leaves while choosing a group
  useEffect(() => {
    const needs = !participant || !participant.group_id;
    if (!needs) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [participant]);

  async function join(group_id: string) {
    const r = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId, group_id })
    });
    const text = await r.text();
    let j: any = {}; try { j = text ? JSON.parse(text) : {}; } catch {}
    if (r.ok && j.participant) setParticipant(j.participant); else alert(j.error || "Failed to join group");
  }

  const needsGroup = !participant || !participant.group_id;
  if (needsGroup) {
    return (
      <GroupJoinScreen
        sessionId={sessionId as string}
        participant={participant}
        groups={groups}
        participants={participants}
        onJoin={join}
        reload={load}
        setParticipant={setParticipant}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 relative">
      {/* Light/Dark toggle for participants */}
      <div className="absolute right-3 top-3 sm:right-4 sm:top-4 z-50">
        <ThemeToggle />
      </div>
      {/* Header / Hero */}
      {!selected && (
        <div className="relative overflow-hidden rounded-[var(--radius)] border border-white/10 bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[var(--brand)]/20 blur-3xl" />
          <div className="p-5 relative">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Participant</div>
                <h1 className="text-xl font-semibold mt-1">Welcome{participant?.display_name ? `, ${participant.display_name}` : ''}</h1>
                <div className="mt-1 text-sm text-[var(--muted)]">Jump into the active activities below and help your team climb the leaderboard.</div>
              </div>
              <div />
            </div>
            {/* leaderboard toggle moved below */}
          </div>
        </div>
      )}

      {/* Main content with sidebar */}
      <div className="grid md:grid-cols-[1fr_240px] gap-4">
        <div>
          {!selected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Activities</h2>
                <button className="text-sm px-3 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>setShowOverall(s=>!s)}>
                  {showOverall ? 'Hide leaderboard' : 'View leaderboard'}
                </button>
              </div>
              {showOverall && (
                <div className="mb-4">
                  <OverallLeaderboard sessionId={sessionId as string} />
                </div>
              )}
              {activities.length === 0 ? (
                <Card><CardBody><div className="text-sm text-[var(--muted)]">No activities yet.</div></CardBody></Card>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div key={a.id} className="p-3 rounded-md bg-white/5 border border-white/10 cursor-pointer" onClick={()=>setSelected(a)}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="font-medium flex items-start gap-2 min-w-0">
                          {a.type==='brainstorm' ? <IconBrain size={20} className="text-[var(--brand)] shrink-0" /> : <IconList size={20} className="text-[var(--brand)] shrink-0" />}
                          <span className="truncate">{a.title || getActivityDisplayName(a.type)}</span>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${a.status==='Active'||a.status==='Voting' ? 'border-green-400/30 text-green-200 bg-green-500/10' : 'border-white/20 text-[var(--muted)]'}`}>
                          {a.status==='Closed' ? (<IconLock size={14} />) : a.status==='Voting' ? (<IconVote size={14} />) : a.status==='Active' ? (<IconTimer size={14} />) : null}
                          <span>{a.status==='Draft' ? 'Inactive' : a.status}</span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]/80 flex-1 overflow-auto scroll-soft">
                        {completed[a.id] && (
                          <div className="inline-block mr-2 px-2 py-0.5 rounded-full border border-blue-400/30 text-blue-200 bg-blue-500/10">Completed</div>
                        )}
                        {a.instructions && <div className="text-sm text-[var(--muted)]">{a.instructions}</div>}
                        {a.description && <div className="mt-1">{a.description}</div>}
                      </div>
                      {a.ends_at && (a.status==='Active' || a.status==='Voting') && (
                        <div className="mt-2"><Timer endsAt={a.ends_at} /></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected ? (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-white/5 border border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{selected.title || getActivityDisplayName(selected.type)}</div>
                  {selected.instructions && (<div className="text-sm text-[var(--muted)] mt-0.5">{selected.instructions}</div>)}
                  {selected.ends_at && (<div className="mt-1"><Timer endsAt={selected.ends_at} /></div>)}
                </div>
                <Button size="sm" variant="outline" className="px-4 shrink-0 self-start sm:self-auto" onClick={() => setSelected(null)}>Back to activities</Button>
              </div>

              {(() => {
                const Panel = getParticipantPanel(selected.type);
                return Panel ? (
                  <Panel
                    sessionId={sessionId as string}
                    activity={selected as any}
                    onComplete={() => setCompleted(prev => ({ ...prev, [selected.id]: true }))}
                  />
                ) : (
                  <Card><CardBody><div className="text-sm text-[var(--muted)]">Unsupported activity type.</div></CardBody></Card>
                );
              })()}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {!needsGroup && participant?.group_id && (
            <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Your group</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {participants.filter(p=>p.group_id===participant.group_id).map(p=> (
                  <span key={p.id} className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/10">
                    {p.display_name || `#${p.id.slice(0,6)}`}
                  </span>
                ))}
                {participants.filter(p=>p.group_id===participant.group_id).length===0 && (
                  <div className="text-xs text-[var(--muted)]">No members yet.</div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function GroupJoinScreen({
  sessionId,
  participant,
  groups,
  participants,
  onJoin,
  reload,
  setParticipant,
}: {
  sessionId: string;
  participant: any;
  groups: any[];
  participants: Part[];
  onJoin: (gid: string) => Promise<void> | void;
  reload: () => Promise<void> | void;
  setParticipant: (p: any) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const sessionName = useMemo(() => {
    try { return localStorage.getItem(`sf_last_session_name_${sessionId}`) || "Session"; } catch { return "Session"; }
  }, [sessionId]);

  useEffect(() => {
    const needs = !participant || !participant.group_id;
    if (!needs) return;
    const t = setInterval(() => { void reload(); }, 3000);
    return () => clearInterval(t);
  }, [participant, reload]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!groups?.length) return;
      const cols = 2;
      if (e.key === "ArrowRight") { e.preventDefault(); setFocusIdx(i => Math.min(groups.length - 1, i + 1)); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); setFocusIdx(i => Math.max(0, i - 1)); }
      if (e.key === "ArrowDown")  { e.preventDefault(); setFocusIdx(i => Math.min(groups.length - 1, i + cols)); }
      if (e.key === "ArrowUp")    { e.preventDefault(); setFocusIdx(i => Math.max(0, i - cols)); }
      // Note: Do NOT bind Enter globally to avoid accidental joins
      if (e.key.toLowerCase() === "n") setCreateOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups]);

  function membersFor(gid: string) {
    return participants.filter(p => p.group_id === gid);
  }
  function initials(name?: string | null) {
    const s = (name || "").trim();
    if (!s) return "?";
    const parts = s.split(/\s+/);
    return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }

  async function createGroup() {
    const t = newGroupName.trim();
    if (!t) return;
    setCreateBusy(true);
    try {
      const r = await fetch(`/api/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: String(sessionId), name: t }) });
      const j = await r.json().catch(()=>({} as any));
      if (!r.ok) { alert(j.error || 'Failed to create group'); return; }
      setNewGroupName("");
      setCreateOpen(false);
      await reload();
      if (j?.group?.id) await onJoin(j.group.id);
    } finally { setCreateBusy(false); }
  }

  async function saveName() {
    const clean = editName.trim();
    const r = await fetch(`/api/participant?session_id=${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ display_name: clean || null }) });
    const j = await r.json().catch(()=>({} as any));
    if (!r.ok) { alert(j.error || 'Failed to update name'); return; }
    try { if (clean) localStorage.setItem('sf_display_name', clean); } catch {}
    setParticipant(j.participant || null);
    setEditNameOpen(false);
  }

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-xl sm:max-w-2xl animate-fade-up">
        <div className="mb-3 text-center text-xs uppercase tracking-wide text-[var(--muted)]">Step 2 of 3 ï¿½ Join a group</div>
        <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,.35)] p-6">
          <div className="text-center mb-4">
            <div className="text-sm text-[var(--muted)]">{sessionName} • Host</div>
            <div className="mt-1 text-2xl font-semibold">Pick a group to join</div>
            <div className="mt-1 text-sm text-[var(--muted)]">Youï¿½ll collaborate with teammates in this group.</div>
            <div className="mt-2 text-xs text-[var(--muted)]">
              {participant?.display_name ? (
                <>
                  Signed in as <span className="opacity-90">{participant.display_name}</span>.{' '}
                  <button className="underline hover:opacity-80" onClick={() => { setEditName(participant.display_name || ""); setEditNameOpen(true); }}>Not you?</button>
                </>
              ) : (
                <button className="underline hover:opacity-80" onClick={() => { setEditName(""); setEditNameOpen(true); }}>Add your name</button>
              )}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="text-sm text-[var(--muted)] text-center py-6">Waiting for facilitator to create a group.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g, idx) => {
                const members = membersFor(g.id);
                const stateLabel = members.length === 0 ? 'New' : 'In progress';
                return (
                  <div key={g.id} className="rounded-xl bg-white/4 border border-white/10 hover:bg-white/[.06] transition-colors">
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="mt-1 text-xs text-[var(--muted)] animate-fade-up" key={members.length}>{members.length} {members.length === 1 ? 'person' : 'people'}</div>
                        </div>
                        <div className="text-[10px] px-2 py-0.5 rounded-full border border-white/20 text-[var(--muted)]">{stateLabel}</div>
                      </div>
                      <div className="flex items-center gap-1">
                          {members.slice(0,5).map((m) => (
                          <div key={m.id} className="-ml-2 first:ml-0 w-6 h-6 rounded-full bg-white/10 border border-white/20 grid place-items-center text-[10px] font-semibold ring-1 ring-white/20 animate-avatar-pop" title={m.display_name || `#${m.id.slice(0,6)}`}>{initials(m.display_name || '')}</div>
                        ))}
                        {members.length > 5 && (
                          <div className="-ml-2 w-6 h-6 rounded-full bg-white/10 border border-white/20 grid place-items-center text-[10px]">+{members.length - 5}</div>
                        )}
                      </div>
                      <div>
                        <button
                          ref={(el) => { cardRefs.current[idx] = el; }}
                          onClick={() => onJoin(g.id)}
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
            <div className="text-xs text-[var(--muted)]">Press N to create a new group</div>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>Create group</Button>
          </div>
        </div>
      </div>

      {/* Create group modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a group">
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Group name</label>
            <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" placeholder="e.g., Team Fox" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createGroup} disabled={!newGroupName.trim() || createBusy}>{createBusy ? 'Creatingï¿½' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit name modal */}
      <Modal open={editNameOpen} onClose={() => setEditNameOpen(false)} title="Update your name">
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Display name</label>
            <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" placeholder="Your name" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditNameOpen(false)}>Cancel</Button>
            <Button onClick={saveName}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

