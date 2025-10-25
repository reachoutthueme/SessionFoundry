"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import ProTag from "@/components/ui/ProTag";
import { Tabs } from "@/components/ui/Tabs";
import ResultsPanel from "@/components/session/ResultsPanel.vibrant";
import ActivitiesManager from "@/components/session/ActivitiesManager";
import GroupsManager from "@/components/session/GroupsManager";
import FacilitatorNotes from "@/components/session/FacilitatorNotes";

type Sess = { id: string; name: string; status: string; join_code: string; created_at: string };

export default function Page() {
  const params = useParams();
  const id = Array.isArray(params.id) ? (params.id[0] as string) : (params.id as string);

  const [s, setS] = useState<Sess | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportOpen) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const el = exportRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [exportOpen]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/session/${id}`, { cache: "no-store" });
      const json = await res.json();
      setS(json.session ?? null);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {editing ? (
              <span className="inline-flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e)=>setNameInput(e.target.value)}
                  className="h-9 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none"
                />
                <Button variant="outline" onClick={async ()=>{
                  const n = nameInput.trim(); if(!n||!s) return;
                  const r = await fetch(`/api/session/${s.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: n }) });
                  const j = await r.json().catch(()=>({}));
                  if(!r.ok){ alert(j.error||'Failed to rename'); return; }
                  setS(j.session||null); setEditing(false);
                }}>Save</Button>
                <Button variant="outline" onClick={()=>{ setEditing(false); setNameInput(s?.name||""); }}>Cancel</Button>
              </span>
            ) : (
              <span>Session: {s?.name ?? "Loading"}</span>
            )}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            ID {id?.slice(0, 8)} - Join code {s?.join_code ?? ""}
          </p>
        </div>
        <div className="flex gap-2 items-center relative">
          {s && (
            <div className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/5 text-[var(--muted)]">
              Status: {s.status === 'Draft' ? 'Inactive' : s.status}
            </div>
          )}
          {!editing && s && (
            <Button variant="outline" onClick={()=>{ setEditing(true); setNameInput(s.name); }}>Rename</Button>
          )}
          {s && (s.status === 'Draft' || s.status === 'Inactive') && (
            <Button
              variant="outline"
              onClick={async () => {
                const r = await fetch(`/api/session/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Active' }) });
                const j = await r.json().catch(()=>({}));
                if (!r.ok) return alert(j.error || 'Failed to activate');
                setS(j.session || null);
              }}
            >Activate</Button>
          )}
          {s && s.status === 'Active' && (
            <Button
              variant="outline"
              onClick={async () => {
                const r = await fetch(`/api/session/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
                const j = await r.json().catch(()=>({}));
                if (!r.ok) return alert(j.error || 'Failed to complete');
                setS(j.session || null);
              }}
            >Complete</Button>
          )}
          <div className="relative" ref={exportRef}>
            <Button variant="outline" onClick={() => setExportOpen(o=>!o)}>Export <ProTag /></Button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-white/10 bg-[var(--panel)] shadow-lg z-10">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between" onClick={()=>{ setExportOpen(false); window.open(`/api/session/${id}/export/results`, '_blank'); }}><span>Results CSV</span><ProTag /></button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between" onClick={()=>{ setExportOpen(false); window.open(`/api/session/${id}/export/activities`, '_blank'); }}><span>Activities CSV</span><ProTag /></button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between" onClick={()=>{ setExportOpen(false); window.open(`/api/session/${id}/export/json`, '_blank'); }}><span>JSON</span><ProTag /></button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between" onClick={()=>{ setExportOpen(false); window.open(`/api/session/${id}/export/deck`, '_blank'); }}><span>Deck (MD)</span><ProTag /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: "Activities", content: <ActivitiesManager sessionId={id} /> },
          { label: "Participants", content: <GroupsManager sessionId={id} /> },
          { label: "Results", content: <ResultsPanel sessionId={id} /> },
          { label: "Notes", content: <FacilitatorNotes sessionId={id} /> },
        ]}
      />
    </div>
  );
}

