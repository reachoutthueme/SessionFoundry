"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Empty from "@/components/ui/Empty";
import Modal from "@/components/ui/Modal";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";

type Sess = { id: string; name: string; status: string; created_at: string; join_code: string };

export default function Page() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [me, setMe] = useState<{ id: string; plan: 'free'|'pro' }|null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sessions", { cache: "no-store" });
    const json = await res.json();
    setSessions(json.sessions ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => { try { const r = await fetch('/api/auth/session',{cache:'no-store'}); const j=await r.json(); setMe(j.user||null);} catch{} })();
  }, []);

  async function create() {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    const json = await res.json();
    if (!res.ok) { toast(json.error || "Failed to create", "error"); return; }
    toast("Session created", "success");
    setOpen(false);
    setName("");
    location.href = `/session/${json.session.id}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sessions</h1>
          <p className="text-sm text-[var(--muted)]">All workshops in your org</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          New session {me && me.plan==='free' && sessions.length>=1 && (<ProTag className="bg-white text-[var(--brand)] border-white/80" />)}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 rounded-md bg-white/10 animate-pulse" />
          <div className="h-20 rounded-md bg-white/10 animate-pulse" />
        </div>
      ) : sessions.length === 0 ? (
        <Empty title="No sessions yet" hint="Create your first session to get started." />
      ) : (
        <Card>
          <CardHeader title="All sessions" />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Join code</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => { location.href = `/session/${s.id}`; }}
                  >
                    <td className="py-3 px-4">{s.name}</td>
                    <td className="py-3 px-4">{s.status === 'Draft' ? 'Inactive' : s.status}</td>
                    <td className="py-3 px-4">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{s.join_code}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {((s.status === 'Draft') || (s.status === 'Inactive')) && (
                          <Button
                            variant="outline"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const r = await fetch(`/api/session/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Active' }) });
                              if (!r.ok) {
                                const j = await r.json().catch(()=>({}));
                                toast(j.error || 'Failed to activate', 'error');
                              } else {
                                toast('Session activated', 'success');
                                load();
                              }
                            }}
                          >Activate</Button>
                        )}
                        {s.status === 'Active' && (
                          <Button
                            variant="outline"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const r = await fetch(`/api/session/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
                              if (!r.ok) {
                                const j = await r.json().catch(()=>({}));
                                toast(j.error || 'Failed to complete', 'error');
                              } else {
                                toast('Session completed', 'success');
                                load();
                              }
                            }}
                          >Complete</Button>
                        )}
                        <Link href={`/session/${s.id}`}><Button variant="ghost" onClick={(e)=>{ e.stopPropagation(); }}>Open</Button></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create session"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </>
        }
      >
        <label className="block text-sm mb-2">Name</label>
        <input
          value={name}
          onChange={(e)=>setName(e.target.value)}
          placeholder="e.g., Visioning Workshop"
          className="w-full h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none focus:ring-[var(--ring)]"
        />
      </Modal>
    </div>
  );
}
