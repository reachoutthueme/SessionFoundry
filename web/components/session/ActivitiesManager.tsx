"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { IconSettings } from "@/components/ui/Icons";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import StocktakeInitiativesManager from "@/components/session/StocktakeInitiativesManager";
import Timer from "@/components/ui/Timer";

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

export default function ActivitiesManager({ sessionId, sessionStatus }: { sessionId: string; sessionStatus?: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [counts, setCounts] = useState<Record<string, { max: number; byGroup: Record<string, number>; total: number }>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eInstructions, setEInstructions] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eVotingEnabled, setEVotingEnabled] = useState(true);
  const [eMaxSubs, setEMaxSubs] = useState<number>(5);
  const [eTimeLimit, setETimeLimit] = useState<number>(300);
  const [ePointsBudget, setEPointsBudget] = useState<number>(100);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuUp, setMenuUp] = useState(false);

  useEffect(() => {
    if (!menuId) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const el = menuRef.current;
      const target = e.target as Node | null;
      if (el && target && !el.contains(target)) setMenuId(null);
    }
    // decide dropdown direction
    const el = menuRef.current;
    if (typeof window !== 'undefined' && el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuUp(spaceBelow < 180);
    } else {
      setMenuUp(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [menuId]);

  const [type, setType] = useState<Activity["type"]>("brainstorm");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [description, setDescription] = useState("");
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [maxSubs, setMaxSubs] = useState<number>(5);
  const [timeLimit, setTimeLimit] = useState<number>(300);
  const [pointsBudget, setPointsBudget] = useState<number>(100);
  const [itemsList, setItemsList] = useState<string>("");

  async function load() {
    setLoading(true);
    const [rActs, rGroups, rCounts] = await Promise.all([
      fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" }),
      fetch(`/api/groups?session_id=${sessionId}`, { cache: "no-store" }),
      fetch(`/api/activities/submission_counts?session_id=${sessionId}`, { cache: "no-store" }),
    ]);
    const j = await rActs.json();
    setItems(j.activities ?? []);
    const jg = await rGroups.json();
    setGroups((jg.groups ?? []).map((g: any) => ({ id: g.id as string, name: g.name as string })));
    const jc = await rCounts.json();
    setCounts(jc.counts ?? {});
    setLoading(false);
  }
  useEffect(() => { load(); }, [sessionId]);

  // Lightweight polling to keep submission counts fresh while facilitating
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const r = await fetch(`/api/activities/submission_counts?session_id=${sessionId}`, { cache: "no-store" });
        const jc = await r.json();
        if (!stop) setCounts(jc.counts ?? {});
      } catch {}
    }
    const iv = setInterval(tick, 5000);
    tick();
    return () => { stop = true; clearInterval(iv); };
  }, [sessionId]);

  const sorted = useMemo(() => {
    return [...items].sort((a,b)=> (a.order_index??0) - (b.order_index??0));
  }, [items]);
  const summary = useMemo(() => {
    const total = items.length;
    const closed = items.filter(a=>a.status==='Closed').length;
    const active = items.filter(a=>a.status==='Active').length;
    const voting = items.filter(a=>a.status==='Voting').length;
    const inactive = items.filter(a=>a.status==='Draft').length;
    return { total, closed, active, voting, inactive, pct: total? Math.round((closed/total)*100): 0 };
  }, [items]);
  const current = useMemo(() => sorted.find(a=>a.status==='Active' || a.status==='Voting') || null, [sorted]);

  async function create() {
    if (!title.trim()) return;
    const config = type === "brainstorm"
      ? { voting_enabled: !!votingEnabled, max_submissions: maxSubs, time_limit_sec: timeLimit, points_budget: pointsBudget }
      : type === "assignment"
        ? { voting_enabled: !!votingEnabled, max_submissions: maxSubs, time_limit_sec: timeLimit, points_budget: pointsBudget, prompts: itemsList.split('\n').map(s=>s.trim()).filter(Boolean) }
        : { time_limit_sec: timeLimit };
    const r = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, type, title: title.trim(), instructions, description, config }),
    });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed to create", "error");
    toast("Activity created", "success");
    setOpen(false);
    setTitle("");
    setInstructions("");
    setDescription("");
    setItemsList("");
    await load();
  }

  async function setStatus(id: string, status: Activity["status"]) {
    const patch: any = { status };
    // Stamp timer only when first activating and not already set
    const act = items.find(a => a.id === id);
    const tl = Number(act?.config?.time_limit_sec || 0);
    if (status === "Active" && tl > 0 && !act?.starts_at && !act?.ends_at) {
      const now = new Date().toISOString();
      const ends = new Date(Date.now() + tl * 1000).toISOString();
      patch.starts_at = now;
      patch.ends_at = ends;
    }
    const r = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed to update", "error");
    toast("Status updated", "success");
    await load();
  }

  async function extendTimer(id: string, minutes: number) {
    const act = items.find(a => a.id === id);
    if (!act) return;
    if (act.status !== 'Active') return; // Only allow while Active
    const prev = act.ends_at ? new Date(act.ends_at).getTime() : Date.now();
    const base = Number.isFinite(prev) ? Math.max(prev, Date.now()) : Date.now();
    const next = new Date(base + minutes * 60_000).toISOString();
    const r = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ends_at: next }),
    });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed to extend timer", "error");
    toast(`+${minutes} min added`, "success");
    await load();
  }

  async function moveActivity(id: string, delta: number) {
    const arr = [...items].sort((a,b)=> (a.order_index??0) - (b.order_index??0));
    const idx = arr.findIndex(a=>a.id===id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= arr.length) return;
    const a = arr[idx];
    const b = arr[target];
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/activities/${a.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ order_index: target }) }),
        fetch(`/api/activities/${b.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ order_index: idx }) }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error('reorder failed');
      await load();
      toast('Order updated','success');
    } catch (e) {
      toast('Failed to reorder','error');
    }
  }

  const statusLabel = (sessionStatus === 'Active' || sessionStatus === 'Completed') ? sessionStatus : 'Inactive';
  const statusColor = sessionStatus === 'Active' ? 'bg-red-500' : (sessionStatus === 'Completed' ? 'bg-green-500' : 'bg-gray-400');

  return (
    <>
      <Card>
      <CardHeader
        title="Activities"
        subtitle="Create and control workshop flow"
        rightSlot={
          <div className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/5 text-[var(--muted)] inline-flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
            <span>Status: {statusLabel}</span>
          </div>
        }
      />
      <CardBody>
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-[var(--muted)]">{items.length} activities</div>
          <Button onClick={() => setOpen(true)}>Add Activity</Button>
        </div>

        {/* Progress + Now panel */}
        <div className="mb-6 p-4 rounded-lg border border-white/15 bg-white/7 shadow-[0_8px_30px_rgba(0,0,0,.12)]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">Progress</div>
            <div className="text-xs text-[var(--muted)]">{summary.closed}/{summary.total} closed ({summary.pct}%)</div>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[var(--brand)]" style={{ width: `${summary.pct}%` }} />
          </div>
          {current && (
            <div className="mt-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand)]" />
                <span className="text-[var(--muted)]">Now:</span>
                <span className="font-medium">{current.title}</span>
                <span className="px-2 py-0.5 rounded border border-white/10 text-[var(--muted)]">{current.status}</span>
              </div>
              {(current.status==='Active' || current.status==='Voting') && (
                <div className="text-[var(--muted)] flex items-center gap-2">
                  {current.ends_at ? (
                    <>
                      <span>Time left</span>
                      <Timer endsAt={current.ends_at} />
                      {current.status==='Active' && (
                        <span className="ml-2 inline-flex gap-1">
                          <button className="px-2 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-xs" onClick={()=>extendTimer(current.id, 1)}>+1m</button>
                          <button className="px-2 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-xs" onClick={()=>extendTimer(current.id, 3)}>+3m</button>
                          <button className="px-2 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-xs" onClick={()=>extendTimer(current.id, 5)}>+5m</button>
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse"/>Live</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {sorted.length>0 && (
            <div className="mt-4">
              <div className="text-xs text-[var(--muted)] mb-2">Activities</div>
              <div className="flex flex-wrap gap-2">
                {sorted.map((a, i)=>{
                  const tone = a.status==='Closed' ? 'bg-green-500/15 text-[var(--text)] border-green-500/30' : a.status==='Voting' ? 'bg-blue-500/15 text-[var(--text)] border-blue-400/30' : a.status==='Active' ? 'bg-[var(--brand)]/20 text-[var(--text)] border-white/20' : 'bg-white/5 text-[var(--muted)] border-white/10';
                  return (
                    <div key={a.id} className={`px-2 py-1 text-xs rounded border ${tone}`}>
                      <span className="opacity-70 mr-1">{i+1}.</span>{a.title}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* Activities container */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No activities yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map(a => {
              const status = a.status === 'Draft' ? 'Inactive' : a.status;
              const tone = status==='Inactive' ? 'border-white/10 bg-white/5'
                : status==='Active' ? 'border-green-400/30 bg-green-500/5'
                : status==='Voting' ? 'border-blue-400/30 bg-blue-500/5'
                : 'border-white/20 bg-white/5';
              const cc = counts[a.id] || { max: 0, byGroup: {}, total: 0 };
              const max = Number(cc.max || 0);
              const byGroup = cc.byGroup || {};
              const groupList = groups.length>0 ? groups : [];
              return (
              <div key={a.id} className={`p-3 rounded-md ${tone} border`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">{a.title} <span className="ml-1 text-xs text-[var(--muted)]">[{a.type === 'brainstorm' ? 'standard' : a.type}]</span>{a.config?.skipped && <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-[var(--muted)]">Skipped</span>}</div>
                    <div className="text-xs text-[var(--muted)]">Status: {status} {(a.status==='Active'||a.status==='Voting') && (
                      a.ends_at ? (
                        <span className="ml-2 inline-flex items-center gap-2">
                          <Timer endsAt={a.ends_at} />
                          {a.status==='Active' && (
                            <span className="inline-flex gap-1">
                              <button className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10" onClick={()=>extendTimer(a.id,1)}>+1m</button>
                              <button className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10" onClick={()=>extendTimer(a.id,3)}>+3m</button>
                              <button className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 hover:bg-white/10" onClick={()=>extendTimer(a.id,5)}>+5m</button>
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse"/>Live</span>
                      )
                    )}</div>
                    {(a.type==='brainstorm' || a.type==='assignment') && (
                      <div className="mt-2 text-xs">
                        {groupList.length === 0 ? (
                          <span className="text-[var(--muted)]">No groups</span>
                        ) : (
                          <>
                            {max>0 && (
                              <div className="mb-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[var(--muted)]">Overall progress</span>
                                  <span className="text-[var(--muted)]">{cc.total}/{max*groupList.length}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full bg-[var(--brand)]" style={{ width: `${Math.min(100, Math.round((cc.total/(max*groupList.length))*100))}%` }} />
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                              {groupList.map(g => {
                                const c = byGroup[g.id] || 0;
                                const pct = max>0 ? Math.max(0, Math.min(100, Math.round((c/max)*100))) : 0;
                                const barColor = pct>=100 ? 'bg-green-500' : 'bg-[var(--brand)]';
                                return (
                                  <div key={g.id} className="px-2 py-1 rounded border border-white/10 bg-white/5">
                                    <div className="flex items-center justify-between">
                                      <span className="truncate mr-2">{g.name}</span>
                                      <span className="opacity-75">{c}{max>0?`/${max}`:''}</span>
                                    </div>
                                    {max>0 && (
                                      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className={`${barColor} h-full`} style={{ width: `${pct}%` }} />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    {a.type === 'stocktake' && (
                      <Button size="sm" onClick={() => setManageId(a.id)}>Initiatives</Button>
                    )}
                    <div className="relative" ref={menuId===a.id ? menuRef : undefined}>
                      <Button size="sm" variant="outline" onClick={() => setMenuId(m => m===a.id ? null : a.id)}>
                        Actions <span className="ml-1">▾</span>
                      </Button>
                      {menuId === a.id && (
                        <div className={`${menuUp ? 'absolute right-0 bottom-full mb-1' : 'absolute right-0 mt-1'} w-40 rounded-md border border-white/10 bg-[var(--panel)] shadow-lg z-10`}>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={async ()=>{ setMenuId(null); await setStatus(a.id, 'Active'); }}>Activate</button>
                          {a.type === 'brainstorm' && (
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={async ()=>{ setMenuId(null); await setStatus(a.id, 'Voting'); }}>Start voting</button>
                          )}
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={async ()=>{ setMenuId(null); await setStatus(a.id, 'Closed'); }}>Close</button>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={async ()=>{ setMenuId(null); try { await fetch(`/api/activities/${a.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'Closed', config: { ...(a.config||{}), skipped: true } }) }); toast('Activity skipped','success'); await load(); } catch { toast('Failed to skip','error'); } }}>Skip</button>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Edit activity settings"
                      title="Edit settings"
                      onClick={() => {
                        setEditId(a.id);
                        setETitle(a.title||"");
                        setEInstructions(a.instructions||"");
                        setEDescription(a.description||"");
                        const cfg = a.config||{};
                        setEVotingEnabled(!!cfg.voting_enabled);
                        setEMaxSubs(Number(cfg.max_submissions||5));
                        setETimeLimit(Number(cfg.time_limit_sec||300));
                        setEPointsBudget(Number(cfg.points_budget||100));
                        setItemsList(Array.isArray(cfg.prompts)? (cfg.prompts as string[]).join("\n") : "");
                      }}
                    >
                      <IconSettings size={14} />
                    </Button>
                    <div className="flex items-center gap-1">
                      <button className="px-1.5 py-0.5 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10" title="Move up" onClick={async ()=>{ await moveActivity(a.id, -1); }}>↑</button>
                      <button className="px-1.5 py-0.5 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10" title="Move down" onClick={async ()=>{ await moveActivity(a.id, 1); }}>↓</button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Add Activity"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create}>Create</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Type</label>
              <select value={type} onChange={e=>setType(e.target.value as any)} className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none">
                <option value="brainstorm">Standard activity</option>
                <option value="stocktake">Process stocktake</option>
                <option value="assignment">Prompt assignment</option>
              </select>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--muted)]">
              {type === 'brainstorm' && (
                <div>Standard activity: capture one or more submissions per participant or group. Useful for many tasks (e.g., draft an outline, propose actions). You can enable voting to prioritize ideas.</div>
              )}
              {type === 'stocktake' && (
                <div>Review predefined initiatives with Stop/Less/Same/More/Begin ratings. Manage the list via the Initiatives action on the activity.</div>
              )}
              {type === 'assignment' && (
                <div>Distribute a list of prompts across groups so each group works on one. You can enable voting later to compare outputs.</div>
              )}
            </div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Title</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
            </div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Instructions</label>
              <textarea value={instructions} onChange={e=>setInstructions(e.target.value)} className="flex-1 min-h-20 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none" />
            </div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Description</label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} className="flex-1 min-h-20 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none" />
            </div>

            {(type === "brainstorm" || type === 'assignment') && (
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <label className="text-sm w-28">Voting</label>
                  <input type="checkbox" checked={votingEnabled} onChange={e=>setVotingEnabled(e.target.checked)} />
                  <span className="text-sm text-[var(--muted)]">Participants can vote</span>
                </div>
                <div className="flex gap-3">
                  <label className="text-sm w-28 pt-2">Max submissions</label>
                  <input type="number" min={1} max={50} value={maxSubs} onChange={e=>setMaxSubs(Number(e.target.value))} className="w-28 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
                </div>{votingEnabled && (
                <div className="flex gap-3">
                  <label className="text-sm w-28 pt-2">Points budget</label>
                  <input type="number" min={1} value={pointsBudget} onChange={e=>setPointsBudget(Number(e.target.value))} className="w-28 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
                  <span className="text-sm text-[var(--muted)]">total points to distribute</span>
                </div>)}
              </div>
            )}
            {type === "assignment" && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <label className="text-sm w-28 pt-2">Prompts</label>
                  <textarea value={itemsList} onChange={e=>setItemsList(e.target.value)} placeholder="One prompt per line" className="flex-1 min-h-24 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Time limit</label>
              <input type="number" min={30} step={30} value={timeLimit} onChange={e=>setTimeLimit(Number(e.target.value))} className="w-36 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
              <span className="text-sm text-[var(--muted)]">seconds</span>
            </div>
          </div>
        </Modal>
      </CardBody>

      <Modal
        open={!!editId}
        onClose={() => setEditId(null)}
        title="Edit Activity"
        footer={<>
          <Button variant="outline" onClick={()=>setEditId(null)}>Cancel</Button>
          <Button onClick={async ()=>{
            const a = items.find(x=>x.id===editId);
            if(!a) return;
            const patch: any = { title: eTitle, instructions: eInstructions, description: eDescription };
            if (a.type==='brainstorm') {
              patch.config = { ...(a.config||{}), voting_enabled: !!eVotingEnabled, max_submissions: eMaxSubs, time_limit_sec: eTimeLimit, points_budget: ePointsBudget };
            } else {
              patch.config = { ...(a.config||{}), time_limit_sec: eTimeLimit };
            }
            const r = await fetch("/api/activities/" + a.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) });
            const j = await r.json().catch(()=>({}));
            if(!r.ok){ toast(j.error||'Failed to update', 'error'); return; }
            toast('Activity updated', 'success');
            setEditId(null);
            await load();
          }}>Save</Button>
        </>}
      >
        {editId && (()=>{ const a = items.find(x=>x.id===editId)!; return (
          <div className="space-y-3">
            <div className="text-xs text-[var(--muted)]">Type: {a.type}</div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Title</label>
              <input value={eTitle} onChange={e=>setETitle(e.target.value)} className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
            </div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Instructions</label>
              <textarea value={eInstructions} onChange={e=>setEInstructions(e.target.value)} className="flex-1 min-h-20 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none" />
            </div>
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Description</label>
              <textarea value={eDescription} onChange={e=>setEDescription(e.target.value)} className="flex-1 min-h-20 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none" />
            </div>
            {a.type==='brainstorm' && (
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <label className="text-sm w-28">Voting</label>
                  <input type="checkbox" checked={eVotingEnabled} onChange={e=>setEVotingEnabled(e.target.checked)} />
                  <span className="text-sm text-[var(--muted)]">Participants can vote</span>
                </div>
                <div className="flex gap-3">
                  <label className="text-sm w-28 pt-2">Max submissions</label>
                  <input type="number" min={1} max={50} value={eMaxSubs} onChange={e=>setEMaxSubs(Number(e.target.value))} className="w-28 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
                </div>{votingEnabled && (
                <div className="flex gap-3">
                  <label className="text-sm w-28 pt-2">Points budget</label>
                  <input type="number" min={1} value={ePointsBudget} onChange={e=>setEPointsBudget(Number(e.target.value))} className="w-28 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
                  <span className="text-sm text-[var(--muted)]">total points to distribute</span>
                </div>)}
              </div>
            )}
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Time limit</label>
              <input type="number" min={30} step={30} value={eTimeLimit} onChange={e=>setETimeLimit(Number(e.target.value))} className="w-36 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
              <span className="text-sm text-[var(--muted)]">seconds</span>
            </div>
          </div>
        ); })()}
      </Modal>

      <Modal
        open={!!manageId}
        onClose={() => setManageId(null)}
        title="Manage initiatives"
        footer={<Button variant="outline" onClick={() => setManageId(null)}>Close</Button>}
      >
        {manageId && <StocktakeInitiativesManager activityId={manageId} />}
      </Modal>
    </Card>
    </>
  );
}






