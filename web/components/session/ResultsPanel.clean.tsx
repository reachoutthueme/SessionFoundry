"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Activity = { id: string; title?: string; type: string; status: string };
type Sub = { id: string; text: string; participant_name: string | null; n: number; avg: number | null; stdev: number | null; votes: { voter_id: string; voter_name: string | null; value: number }[] };

export default function ResultsPanel({ sessionId }: { sessionId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, Sub[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/activities?session_id=${sessionId}`, { cache: "no-store" });
      const j = await r.json();
      setActivities(j.activities ?? []);
    })();
  }, [sessionId]);

  async function toggle(id: string) {
    const next = !open[id];
    setOpen(o => ({ ...o, [id]: next }));
    if (next && !data[id]) {
      setLoading(true);
      const r = await fetch(`/api/activities/${id}/results`, { cache: "no-store" });
      const j = await r.json();
      setData(d => ({ ...d, [id]: j.submissions ?? [] }));
      setLoading(false);
    }
  }

  useEffect(() => {
    const iv = setInterval(async () => {
      const openIds = Object.entries(open).filter(([,v])=>v).map(([k])=>k);
      if (openIds.length === 0) return;
      await Promise.all(openIds.map(async (id) => {
        const r = await fetch(`/api/activities/${id}/results`, { cache: "no-store" });
        const j = await r.json();
        setData(d => ({ ...d, [id]: j.submissions ?? [] }));
      }));
    }, 5000);
    return () => clearInterval(iv);
  }, [open]);

  return (
    <Card>
      <CardHeader title="Results" subtitle="Expand an activity to see its submissions and scores" />
      <CardBody>
        {activities.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No activities yet.</div>
        ) : (
          <div className="space-y-2">
            {activities.map(a => (
              <div key={a.id} className="rounded-md border border-white/10 bg-white/5">
                <button onClick={() => toggle(a.id)} className="w-full text-left p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.title || (a.type==='brainstorm' ? 'Standard' : 'Stocktake')}</div>
                    <div className="text-xs text-[var(--muted)]">Status: {a.status}</div>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{open[a.id] ? 'Hide' : 'Show'}</span>
                </button>
                {open[a.id] && (
                  <div className="p-3 border-t border-white/10">
                    {loading && !data[a.id] ? (
                      <div className="h-16 rounded bg-white/10 animate-pulse" />
                    ) : (data[a.id] ?? []).length === 0 ? (
                      <div className="text-sm text-[var(--muted)]">No submissions yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {(data[a.id] ?? []).map(s => (
                          <div key={s.id} className="p-3 rounded-md bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{s.text}</div>
                              <div className="text-xs text-[var(--muted)]">by {s.participant_name || 'Anonymous'}</div>
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">Avg: {s.avg===null ? '—' : s.avg.toFixed(2)} • Stdev: {s.stdev===null ? '—' : s.stdev.toFixed(2)} • N: {s.n}</div>
                            {s.votes && s.votes.length>0 && (
                              <div className="mt-2 text-xs text-[var(--muted)]/90">
                                Votes: {s.votes.map((v,i)=> (
                                  <span key={i} className="mr-3">{v.value}{v.voter_name ? ` by ${v.voter_name}` : ''}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
