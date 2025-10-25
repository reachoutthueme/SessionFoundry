"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import ProTag from "@/components/ui/ProTag";

type T = { id: string; name: string; blurb: string; activities: number };
type Sess = { id: string; name: string };

export default function TemplatesPage() {
  const toast = useToast();
  const [list, setList] = useState<T[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; plan: 'free'|'pro' }|null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);
  const [mode, setMode] = useState<'existing'|'new'>('existing');
  const [sessionId, setSessionId] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [rt, rs, ra] = await Promise.all([
        fetch('/api/templates', { cache: 'no-store' }).then(r=>r.json()).catch(()=>({templates:[]})),
        fetch('/api/sessions', { cache: 'no-store' }).then(r=>r.json()).catch(()=>({sessions:[]})),
        fetch('/api/auth/session', { cache: 'no-store' }).then(r=>r.json()).catch(()=>({user:null})),
      ]);
      setList(rt.templates || []);
      const sess = (rs.sessions || []).map((s:any)=>({ id: s.id as string, name: s.name as string }));
      setSessions(sess);
      setMe(ra.user || null);
      setLoading(false);
    })();
  }, []);

  async function apply() {
    try {
      let sid = sessionId;
      if (mode === 'new') {
        const n = newName.trim();
        if (!n) { toast('Enter a session name', 'error'); return; }
        const r = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) });
        const j = await r.json();
        if (!r.ok) { toast(j.error || 'Failed to create session', 'error'); return; }
        sid = j.session.id as string;
      }
      if (!sid || !selected) return;
      const r2 = await fetch('/api/templates/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: selected.id, session_id: sid }) });
      const j2 = await r2.json();
      if (!r2.ok) { toast(j2.error || 'Failed to apply template', 'error'); return; }
      toast('Template applied', 'success');
      setOpen(false);
      location.href = `/session/${sid}`;
    } catch (e) {
      toast('Something went wrong', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Templates</h1>
          <div className="text-sm text-[var(--muted)]">Start fast with battle-tested flows</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2"><div className="h-20 rounded bg-white/10 animate-pulse"/><div className="h-20 rounded bg-white/10 animate-pulse"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(t => (
            <Card key={t.id}>
              <CardHeader title={<><span>{t.name}</span> <ProTag /></>} subtitle={`${t.activities} activities`} />
              <CardBody>
                <div className="text-sm text-[var(--muted)] mb-3">{t.blurb}</div>
                <Button onClick={()=>{
                  if (!me || me.plan !== 'pro') { toast('Templates are Pro. Upgrade to apply.', 'info'); location.href = '/settings'; return; }
                  setSelected(t); setMode('existing'); setSessionId(''); setNewName(''); setOpen(true);
                }}>Use template</Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={selected ? `Use: ${selected.name}` : 'Use template'}
        footer={<>
          <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
          <Button onClick={apply}>Apply</Button>
        </>}>
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <label className="text-sm w-28">Destination</label>
            <div className="flex items-center gap-3">
              <label className="text-sm inline-flex items-center gap-2"><input type="radio" checked={mode==='existing'} onChange={()=>setMode('existing')} /> Existing session</label>
              <label className="text-sm inline-flex items-center gap-2"><input type="radio" checked={mode==='new'} onChange={()=>setMode('new')} /> New session</label>
            </div>
          </div>
          {mode === 'existing' ? (
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Session</label>
              <select value={sessionId} onChange={e=>setSessionId(e.target.value)} className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none">
                <option value="">Select a session</option>
                {sessions.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          ) : (
            <div className="flex gap-3">
              <label className="text-sm w-28 pt-2">Name</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"/>
            </div>
          )}
          <div className="text-xs text-[var(--muted)]">You can edit activities after applying the template.</div>
        </div>
      </Modal>
    </div>
  );
}
