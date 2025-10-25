"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Init = { id: string; title: string };

export default function StocktakeInitiativesManager({ activityId }: { activityId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Init[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/stocktake/initiatives?activity_id=${activityId}`);
    const j = await r.json();
    setItems(j.initiatives ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [activityId]);

  async function add() {
    if (!title.trim()) return;
    const r = await fetch(`/api/stocktake/initiatives`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity_id: activityId, title: title.trim() })
    });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed", "error");
    toast("Initiative added", "success");
    setTitle("");
    await load();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/stocktake/initiatives/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed", "error");
    toast("Removed", "success");
    await load();
  }

  return (
    <Card>
      <CardHeader title="Stocktake initiatives" subtitle="Add or remove items" />
      <CardBody>
        <div className="flex gap-2 mb-3">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add initiative"
            className="flex-1 h-10 rounded-md bg-[var(--panel)] border border-white/10 px-3 outline-none" />
          <Button onClick={add}>Add</Button>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-white/10 animate-pulse" />
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No initiatives yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map(it => (
              <li key={it.id} className="p-3 rounded-md bg-white/5 border border-white/10 flex items-center justify-between">
                <span>{it.title}</span>
                <Button size="sm" variant="outline" onClick={() => remove(it.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

