"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import IntakePanel from "@/components/session/IntakePanel";
import VotingPanel from "@/components/session/VotingPanel.vibrant";
import StocktakePanel from "@/components/session/StocktakePanel";
import Timer from "@/components/ui/Timer";
import { IconBrain, IconList, IconTimer, IconVote, IconLock } from "@/components/ui/Icons";
import OverallLeaderboard from "@/components/session/OverallLeaderboard";

type Activity = { id: string; type: "brainstorm"|"stocktake"|"assignment"; status: string; title?: string; instructions?: string; description?: string; ends_at?: string|null; config?: any };

export default function ParticipantPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participant, setParticipant] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
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
      const [pR, gR, aR] = await Promise.all([
        fetch(`/api/participant?session_id=${sessionId}`),
        fetch(`/api/groups?session_id=${sessionId}`),
        fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" }),
      ]);
      const [pj, gj, aj] = await Promise.all([ safeJson(pR), safeJson(gR), safeJson(aR) ]);
      setParticipant(pj?.participant ?? null);
      setGroups(gj?.groups ?? []);
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header / Hero */}
      {!selected && (
        <div className="relative overflow-hidden rounded-[var(--radius)] border border-white/10 bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[var(--brand)]/20 blur-3xl" />
          <div className="p-5 relative">
            <div className="flex items-center justify-between">
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
      {!selected && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Activities</h2>
            <button className="text-sm px-3 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>setShowOverall(s=>!s)}>
              {showOverall ? 'Hide overall leaderboard' : 'Overall leaderboard'}
            </button>
          </div>
          {showOverall && (
            <div className="mb-4">
              <OverallLeaderboard sessionId={sessionId as string} />
            </div>
          )}
          {activities.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No activities yet.</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activities.map(a => (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`p-3 rounded-md bg-white/5 border transition cursor-pointer h-40 flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,.15)] hover:ring-1 hover:ring-[var(--brand)]/40 hover:translate-y-[-2px] ${ selected?.id === a.id ? "border-[var(--brand)]" : "border-white/10 hover:border-white/20" }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium flex items-center gap-2">
                      {a.type==='brainstorm' ? <IconBrain size={20} className="text-[var(--brand)] shrink-0" /> : <IconList size={20} className="text-[var(--brand)] shrink-0" />}
                      <span>{a.title || (a.type==='brainstorm' ? 'Standard' : a.type)}</span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${a.status==='Active'||a.status==='Voting' ? 'border-green-400/30 text-green-200 bg-green-500/10' : 'border-white/20 text-[var(--muted)]'}`}>
                      {a.status==='Closed' ? (<IconLock size={14} />) : a.status==='Voting' ? (<IconVote size={14} />) : a.status==='Active' ? (<IconTimer size={14} />) : null}
                      <span>{a.status}</span>
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
        <div className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div className="font-medium">{selected.title || (selected.type==='brainstorm' ? 'Standard' : selected.type)}</div>
            {selected.instructions && (<div className="text-sm text-[var(--muted)] mt-0.5">{selected.instructions}</div>)}
            {selected.ends_at && (<div className="mt-1"><Timer endsAt={selected.ends_at} /></div>)}
          </div>
          <Button size="sm" variant="outline" className="px-4 shrink-0" onClick={() => setSelected(null)}>Back to activities</Button>
        </div>
      ) : null}

      {selected ? (
        (selected.type === "brainstorm" || selected.type === 'assignment') ? (
          selected.status === "Voting" ? (
            <VotingPanel sessionId={sessionId as string} activityId={selected.id} />
          ) : selected.status === "Active" ? (
            <div className="space-y-3">
              {selected.type === 'assignment' && participant?.group_id && (
                <Card>
                  <CardHeader title="Your assignment" />
                  <CardBody>
                    <div className="text-sm">{(selected as any)?.config?.assignments?.[participant.group_id] || 'No item assigned yet.'}</div>
                  </CardBody>
                </Card>
              )}
              <IntakePanel sessionId={sessionId as string} activityId={selected.id} />
            </div>
          ) : (
            <Card><CardBody><div className="text-sm text-[var(--muted)]">This activity is not active.</div></CardBody></Card>
          )
        ) : (
          <StocktakePanel sessionId={sessionId as string} activityId={selected.id} onComplete={() => setCompleted(prev => ({ ...prev, [selected.id]: true }))} />
        )
      ) : null}
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
    <div className="flex items-center gap-2 pt-2 border-t border-white/10 mt-2">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Create a group" className="h-10 flex-1 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
      <Button size="sm" onClick={create} disabled={busy}>Create</Button>
    </div>
  );
}




