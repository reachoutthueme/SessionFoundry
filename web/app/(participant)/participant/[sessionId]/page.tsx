"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ThemeToggle from "@/components/ui/ThemeToggle";
import IntakePanel from "@/components/session/IntakePanel";
import VotingPanel from "@/components/session/VotingPanel.vibrant";
import StocktakePanel from "@/components/session/StocktakePanel";
import Timer from "@/components/ui/Timer";
import { IconBrain, IconList, IconTimer, IconVote, IconLock } from "@/components/ui/Icons";
import OverallLeaderboard from "@/components/session/OverallLeaderboard";

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

  async function load() {
    function safeJson(r: Response) {
      return r.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
    }
    try {
      const [pR, gR, aR, pplR] = await Promise.all([
        fetch(`/api/participant?session_id=${sessionId}`),
        fetch(`/api/groups?session_id=${sessionId}`),
        fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" }),
        fetch(`/api/participants?session_id=${sessionId}`, { cache: "no-store" }),
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
      <div className="max-w-md mx-auto p-6">
        <Card>
          <CardHeader title="Welcome" subtitle="Pick your group to start" />
          <CardBody>
            <div className="space-y-2">
              {groups.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">Waiting for facilitator to create a group…</div>
              ) : groups.map(g => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10">
                  <div>{g.name}</div>
                  <Button size="sm" onClick={()=>join(g.id)}>Join</Button>
                </div>
              ))}
              <CreateGroupInline sessionId={sessionId as string} onCreated={(gid)=>join(gid)} />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 relative">
      {/* Light/Dark toggle for participants */}
      <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
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
                          <span className="truncate">{a.title || (a.type==='brainstorm' ? 'Standard' : a.type)}</span>
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
                  <div className="font-medium">{selected.title || (selected.type==='brainstorm' ? 'Standard' : selected.type)}</div>
                  {selected.instructions && (<div className="text-sm text-[var(--muted)] mt-0.5">{selected.instructions}</div>)}
                  {selected.ends_at && (<div className="mt-1"><Timer endsAt={selected.ends_at} /></div>)}
                </div>
                <Button size="sm" variant="outline" className="px-4 shrink-0 self-start sm:self-auto" onClick={() => setSelected(null)}>Back to activities</Button>
              </div>

              {selected.type === "brainstorm" ? (
                selected.status === "Voting" ? (
                  <VotingPanel sessionId={sessionId as string} activityId={selected.id} />
                ) : selected.status === "Active" ? (
                  <IntakePanel sessionId={sessionId as string} activityId={selected.id} />
                ) : (
                  <Card><CardBody><div className="text-sm text-[var(--muted)]">This activity is not active.</div></CardBody></Card>
                )
              ) : (
                <StocktakePanel sessionId={sessionId as string} activityId={selected.id} onComplete={() => setCompleted(prev => ({ ...prev, [selected.id]: true }))} />
              )}
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

function CreateGroupInline({ sessionId, onCreated }: { sessionId: string; onCreated: (groupId: string)=>void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    const t = name.trim();
    if (!t) return;
    setBusy(true);
    const r = await fetch(`/api/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, name: t }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { alert(j.error || 'Failed to create'); return; }
    setName("");
    onCreated(j.group.id);
  }
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-white/10 mt-2 sm:flex-row sm:items-center">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Create a group" className="h-10 w-full sm:flex-1 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
      <Button size="sm" onClick={create} disabled={busy} className="self-start sm:self-auto">Create</Button>
    </div>
  );
}




