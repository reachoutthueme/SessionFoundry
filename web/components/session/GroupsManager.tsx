"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Group = { id: string; name: string };

export default function GroupsManager({ sessionId }: { sessionId: string }) {
  const toast = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [participants, setParticipants] = useState<{id:string;display_name:string|null;group_id:string|null}[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [rg, rp] = await Promise.all([
      fetch(`/api/groups?session_id=${sessionId}`),
      fetch(`/api/participants?session_id=${sessionId}`)
    ]);
    const jg = await rg.json();
    const jp = await rp.json();
    setGroups(jg.groups ?? []);
    setParticipants((jp.participants ?? []).map((p:any)=>({ id:p.id, display_name:p.display_name, group_id:p.group_id })));
    setLoading(false);
  }
  useEffect(() => { load(); }, [sessionId]);

  async function create() {
    if (!name.trim()) return;
    const r = await fetch(`/api/groups`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, name: name.trim() })
    });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed", "error");
    toast("Group created", "success");
    setName("");
    await load();
  }

  return (
    <Card>
      <CardHeader title="Participants" subtitle="Create and manage groups" />
      <CardBody>
        <div className="flex items-center gap-2 mb-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="New group name"
            className="h-10 flex-1 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
          <Button onClick={create}>Add</Button>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No groups yet.</div>
        ) : (
          <div className="space-y-2">
            {groups.map(g => {
              const ps = participants.filter(p=>p.group_id===g.id);
              return (
                <div key={g.id} className="p-3 rounded-md bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-[var(--muted)]">{ps.length} member{ps.length===1?"":"s"}</div>
                  </div>
                  {ps.length>0 && (
                    <ul className="mt-2 text-sm text-[var(--muted)]">
                      {ps.map(p => (<li key={p.id}>• {p.display_name || `Anon ${p.id.slice(0,4)}`}</li>))}
                    </ul>
                  )}
                </div>
              );
            })}
            {/* Unassigned */}
            {participants.some(p=>!p.group_id) && (
              <div className="p-3 rounded-md bg-white/5 border border-white/10">
                <div className="font-medium">Unassigned</div>
                <ul className="mt-2 text-sm text-[var(--muted)]">
                  {participants.filter(p=>!p.group_id).map(p => (
                    <li key={p.id}>• {p.display_name || `Anon ${p.id.slice(0,4)}`}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
