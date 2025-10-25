"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export default function IntakePanel({ sessionId, activityId }: { sessionId: string; activityId?: string }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<{id:string;text:string;created_at:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const url = activityId
      ? `/api/submissions?activity_id=${activityId}&group_only=1`
      : `/api/submissions?session_id=${sessionId}&group_only=1`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setItems(json.submissions ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [sessionId, activityId]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    const payload = activityId
      ? { activity_id: activityId, session_id: sessionId, text: t }
      : { session_id: sessionId, text: t };
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) { toast(json.error || "Failed", "error"); return; }
    setText("");
    toast("Idea added", "success");
    setItems(prev => [...prev, json.submission]);
  }

  return (
    <Card>
      <CardHeader title="Submissions" subtitle="Add ideas and see them below" />
      <CardBody>
        <div className="mb-3">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e)=>setText(e.target.value)}
              placeholder="Type your idea. You can write multiple lines."
              rows={4}
              className="flex-1 rounded-md bg-[var(--panel)] border border-white/10 px-3 py-2 outline-none focus:ring-[var(--ring)] resize-y min-h-24"
            />
            <Button onClick={add} className="h-10 self-start">Add</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-white/10 animate-pulse" />
            <div className="h-10 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No submissions yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map(it => (
              <li key={it.id} className="p-3 rounded-md bg-white/5 border border-white/10">{it.text}</li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}


