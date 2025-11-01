"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Empty from "@/components/ui/Empty";
import Modal from "@/components/ui/Modal";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";
import { IconCopy } from "@/components/ui/Icons";

type Sess = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  join_code: string;
};

type Me = { id: string; plan: "free" | "pro" } | null;

export default function Page() {
  const toast = useToast();
  const router = useRouter();

  // Modal + form state
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Data loading state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Sess[]>([]);
  const [me, setMe] = useState<Me>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"All"|"Active"|"Completed"|"Inactive">("All");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Action states
  const [creating, setCreating] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  // Load current user's plan / id
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (!r.ok) {
          setMe(null);
          return;
        }
        const j = await r.json();
        if (j?.user) {
          setMe({ id: j.user.id, plan: j.user.plan || "free" });
        } else {
          setMe(null);
        }
      } catch (err) {
        console.error("Failed to load user session", err);
        setMe(null);
      }
    })();
  }, []);

  // Fetch sessions list
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      if (!res.ok) {
        let msg = "Failed to load sessions";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore parse fail
        }
        setLoadError(msg);
        setSessions([]);
        return;
      }
      const json = await res.json();
      setSessions(json.sessions ?? []);
    } catch (err) {
      console.error("Failed to load sessions", err);
      setLoadError("Network error loading sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isFreePlan = me?.plan === "free";
  const reachedFreeLimit = isFreePlan && sessions.length >= 1;

  const filtered = sessions.filter((s) => {
    if (tab !== "All") {
      if (tab === "Inactive") {
        const st = (s.status || "").toLowerCase();
        if (!(st === "inactive" || st === "draft")) return false;
      } else {
        const t = tab.toLowerCase();
        if ((s.status || "").toLowerCase() !== t) return false;
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!s.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Open create modal if query param ?new=1 is present
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("new") === "1") {
        if (reachedFreeLimit) {
          toast("Free plan allows 1 session. Upgrade to create more.", "error");
        } else {
          setOpen(true);
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedFreeLimit]);

  // Create a new session
  async function create() {
    const n = name.trim();
    if (!n || creating) return;

    // Don't allow creating more if on free and already at limit
    if (reachedFreeLimit) {
      toast("Free plan allows 1 session. Upgrade to create more.", "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        toast(json.error || "Failed to create", "error");
        return;
      }

      toast("Session created", "success");
      setOpen(false);
      setName("");

      if (json.session?.id) {
        router.push(`/session/${json.session.id}`);
      } else {
        // fallback: reload list if we didn't get an ID
        load();
      }
    } catch (err) {
      console.error("Failed to create session", err);
      toast("Network error creating session", "error");
    } finally {
      setCreating(false);
    }
  }

  // Update one session status (Activate / Complete)
  async function updateStatus(id: string, status: "Active" | "Completed") {
    if (rowBusyId) return; // prevent double spam
    setRowBusyId(id);
    try {
      const r = await fetch(`/api/session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast(
          j.error ||
            (status === "Active"
              ? "Failed to activate"
              : "Failed to complete"),
          "error"
        );
      } else {
        toast(
          status === "Active"
            ? "Session activated"
            : "Session completed",
          "success"
        );
        // reload sessions so UI stays up to date
        load();
      }
    } catch (err) {
      console.error("Failed to update session status", err);
      toast("Network error updating session", "error");
    } finally {
      setRowBusyId(null);
    }
  }

  // Clicking "New session"
  function onClickNewSession() {
    if (reachedFreeLimit) {
      toast("Free plan allows 1 session. Upgrade to create more.", "error");
      return;
    }
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header panel */}
      <div className="rounded-[var(--radius)] border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
            <p className="text-sm text-[var(--muted)]">All workshops in your org</p>
          </div>
          <div>
            <Button onClick={onClickNewSession}>
              New session{" "}
              {reachedFreeLimit && (
                <ProTag className="border-white/80 bg-white text-[var(--brand)]" />
              )}
            </Button>
          </div>
        </div>
        {/* Filters row */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {(["All","Active","Completed","Inactive"] as const).map(t => (
              <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1 text-sm rounded-full ${tab===t? 'bg-[var(--brand)] text-[var(--btn-on-brand)]':'text-[var(--muted)] hover:bg-white/5'}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sessions" className="h-9 w-64 rounded-md border border-white/10 bg-[var(--panel)] px-3 text-sm outline-none focus:ring-[var(--ring)]" />
          </div>
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        // skeletons
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-md bg-white/10" />
          <div className="h-20 animate-pulse rounded-md bg-white/10" />
        </div>
      ) : loadError ? (
        // error block
        <Card>
          <CardBody>
            <div className="text-sm text-[var(--muted)]">{loadError}</div>
          </CardBody>
        </Card>
      ) : sessions.length === 0 ? (
        // empty
        <Empty
          title="No sessions yet"
          hint="Create your first session to get started."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            {/* Selection bar */}
            {Object.values(selected).some(Boolean) && (
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-sm">
                <div className="font-medium">{Object.values(selected).filter(Boolean).length} selected</div>
                <Button size="sm" variant="outline" onClick={async ()=>{
                  const ids = Object.entries(selected).filter(([,v])=>v).map(([id])=>id);
                  for (const id of ids) await updateStatus(id, 'Completed');
                  setSelected({});
                }}>Complete</Button>
                <Button size="sm" variant="outline" disabled>Archive</Button>
                <Button size="sm" variant="outline" disabled>Delete</Button>
              </div>
            )}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--panel)]/95 backdrop-blur-sm shadow-[inset_0_-1px_0_rgba(255,255,255,.08)]">
                  <tr className="text-left text-[var(--muted)]">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" aria-label="Select all" checked={filtered.length>0 && filtered.every(s=>selected[s.id])} onChange={(e)=>{
                        const all: Record<string, boolean> = {};
                        if (e.target.checked) filtered.forEach(s=>{ all[s.id]=true; });
                        setSelected(all);
                      }} />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Join code</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr key={s.id} className={`border-t border-white/10 ${idx % 2 === 1 ? 'bg-white/5' : ''} hover:bg-white/10`}
                      onClick={() => router.push(`/session/${s.id}`)}>
                      <td className="px-4 py-3" onClick={(e)=>e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${s.name}`} checked={!!selected[s.id]} onChange={(e)=> setSelected(prev=> ({ ...prev, [s.id]: e.target.checked }))} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.name}</div>
                        <div className="mt-0.5 text-xs text-[var(--muted)]">You</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${s.status==='Active' ? 'status-chip-active border-green-400/30 text-green-200 bg-green-500/10' : s.status==='Completed' ? 'border-rose-400/30 text-rose-200 bg-rose-500/10' : 'border-white/20 text-[var(--muted)]'}`}>{s.status==='Draft'?'Inactive':s.status}</span>
                      </td>
                      <td className="px-4 py-3">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {s.join_code ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            <span className="font-mono text-[11px] leading-none">{s.join_code}</span>
                            <button className="rounded p-0.5 hover:bg-white/5" title="Copy join code" aria-label="Copy join code" onClick={async (e)=>{ e.stopPropagation(); try { await navigator.clipboard.writeText(s.join_code); toast('Join code copied','success'); } catch { toast('Copy failed','error'); } }}><IconCopy size={12} /></button>
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e)=>e.stopPropagation()}>
                        <Link href={`/session/${s.id}`}><Button variant="ghost">Open</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create session modal */}
      <Modal
        open={open}
        onClose={() => {
          if (!creating) setOpen(false);
        }}
        title="Create session"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (!creating) setOpen(false);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={
                creating ||
                !name.trim() ||
                reachedFreeLimit
              }
            >
              {creating
                ? "Creating..."
                : reachedFreeLimit
                ? "Limit reached"
                : "Create"}
            </Button>
          </>
        }
      >
        <label
          htmlFor="session-name"
          className="mb-2 block text-sm"
        >
          Name
        </label>
        <input
          id="session-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Visioning Workshop"
          className="h-10 w-full rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none focus:ring-[var(--ring)]"
          disabled={creating || reachedFreeLimit}
        />
        {reachedFreeLimit && (
          <div className="mt-2 text-xs text-[var(--muted)]">
            Free plan includes 1 session. Upgrade to Pro for
            unlimited sessions and exports.
          </div>
        )}
      </Modal>
    </div>
  );
}
