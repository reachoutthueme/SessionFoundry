"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Init = { id: string; title: string };
const choices = [
  { key: "stop", label: "Stop" },
  { key: "less", label: "Do less" },
  { key: "same", label: "Same" },
  { key: "more", label: "Do more" },
  { key: "begin", label: "Begin / Highly increase" },
] as const;

export default function StocktakePanel({ sessionId, activityId, onComplete }: { sessionId: string; activityId: string; onComplete?: ()=>void }) {
  const toast = useToast();
  const [items, setItems] = useState<Init[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/stocktake/initiatives?activity_id=${activityId}`);
      const j = await r.json();
      setItems(j.initiatives ?? []);
      // prefill any previous responses for this participant
      const rr = await fetch(`/api/stocktake/responses?session_id=${sessionId}&activity_id=${activityId}`);
      const rj = await rr.json();
      if (Array.isArray(rj.responses)) {
        const pre: Record<string,string> = {};
        rj.responses.forEach((x: any) => { pre[x.initiative_id] = x.choice; });
        setSel(pre);
      }
      setLoading(false);
    })();
  }, [activityId]);

  const allChosen = items.length > 0 && items.every(it => !!sel[it.id]);

  async function submitAll() {
    if (!allChosen) return;
    try {
      setLoadingSubmit(true);
      await Promise.all(items.map(async (it) => {
        const choice = sel[it.id]!;
        const r = await fetch(`/api/stocktake/responses`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, activity_id: activityId, initiative_id: it.id, choice })
        });
        if (!r.ok) throw new Error((await r.text()) || 'Request failed');
      }));
      toast("Responses submitted", "success");
      onComplete?.();
    } catch (e:any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Process stocktake" subtitle="Pick a choice for each initiative" />
      <CardBody>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 rounded bg-white/10 animate-pulse" />
            <div className="h-12 rounded bg-white/10 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No initiatives yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map(it => (
              <div key={it.id} className="p-3 rounded-md bg-white/5 border border-white/10">
                <div className="mb-2 font-medium">{it.title}</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {choices.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSel(prev => ({ ...prev, [it.id]: c.key }))}
                      className={`h-9 px-3 rounded-md text-sm border ${sel[it.id]===c.key?"bg-white/10 border-white/20":"border-white/10 hover:bg-white/5"}`}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end mt-2">
              <Button onClick={submitAll} disabled={!allChosen || loadingSubmit} variant={allChosen?"primary":"outline"}>
                Submit all
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
