"use client";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type Sess = { id: string; name: string; status: string; join_code: string; created_at: string };
type Activity = { id: string; session_id: string; type: "brainstorm"|"stocktake"; created_at: string };

export default function Page() {
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsTotal, setParticipantsTotal] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    let did = false;
    (async () => {
      if (did) return; did = true;
      setLoading(true);
      const r = await fetch("/api/dashboard/overview", { cache: "no-store" });
      const j = await r.json();
      const sess: Sess[] = j.sessions ?? [];
      setSessions(sess);
      setParticipantsTotal(Number(j?.stats?.participants || 0));
      const brain = Number(j?.stats?.brainstorm || 0);
      const stock = Number(j?.stats?.stocktake || 0);
      const acts: Activity[] = [
        ...Array(brain).fill(null).map((_,i)=>({ id: `b${i}`, session_id: '', type: 'brainstorm' as const, created_at: '' })),
        ...Array(stock).fill(null).map((_,i)=>({ id: `s${i}`, session_id: '', type: 'stocktake' as const, created_at: '' })),
      ];
      setActivities(acts);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter(s=> s.status==='Active').length;
    const brainstorm = activities.filter(a=>a.type==='brainstorm').length;
    const stocktake = activities.filter(a=>a.type==='stocktake').length;
    return { total, active, participants: participantsTotal, brainstorm, stocktake };
  }, [sessions, activities, participantsTotal]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, number>();
    const days = 14;
    const now = new Date();
    for (let i=days-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const key=d.toISOString().slice(0,10); map.set(key,0); }
    sessions.forEach(s=>{ const key = new Date(s.created_at).toISOString().slice(0,10); if(map.has(key)) map.set(key,(map.get(key)||0)+1); });
    return Array.from(map.entries());
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="dashboard-hero relative overflow-hidden rounded-[var(--radius)] border border-white/10 bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90 p-5">
        <div className="hero-bubble absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[var(--brand)]/25 blur-3xl" />
        <div className="hero-bubble absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-[#5aa8ff]/20 blur-3xl" />
        <div className="hero-accent absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent opacity-70" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Control Center</div>
            <h1 className="text-xl font-semibold mt-1">Welcome back</h1>
            <div className="mt-1 text-sm text-[var(--muted)]">Create, facilitate and export results.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => location.href="/sessions"}>View Sessions</Button>
            <Button onClick={() => location.href="/sessions/new"}>New Session</Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI title="Sessions" value={String(stats.total)} />
        <KPI title="Active now" value={String(stats.active)} />
        <KPI title="Participants" value={String(stats.participants)} />
        <Donut title="Activities" a={stats.brainstorm} b={stats.stocktake} aLabel="Brainstorm" bLabel="Stocktake" />
      </div>

      {/* Sessions in last 14 days */}
      <Card>
        <CardHeader title="Sessions last 14 days" subtitle="Activity over time" />
        <CardBody className="p-0">
          <Sparkline data={sessionsByDay.map(([,v])=>v)} labels={sessionsByDay.map(([k])=>k.slice(5))} />
        </CardBody>
      </Card>

      {/* Recent sessions */}
      <Card>
        <CardHeader title="Recent sessions" subtitle="Your latest workshops" />
        <CardBody className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              <div className="h-10 rounded bg-white/10 animate-pulse" />
              <div className="h-10 rounded bg-white/10 animate-pulse" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted)]">No sessions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Join code</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4">{s.name}</td>
                    <td className="py-3 px-4">{s.status}</td>
                    <td className="py-3 px-4 font-mono text-xs">{s.join_code}</td>
                    <td className="py-3 px-4">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" onClick={() => location.href=`/session/${s.id}`}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardBody className="p-0">
        <div className="text-sm text-[var(--muted)]">{title}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardBody>
    </Card>
  );
}

function Donut({ title, a, b, aLabel, bLabel }: { title: string; a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b || 1;
  const pa = (a/total)*100, pb = (b/total)*100;
  const r = 28, c = 2*Math.PI*r;
  const sa = (pa/100)*c, sb = (pb/100)*c;
  return (
    <Card>
      <CardBody className="p-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--muted)]">{title}</div>
            <div className="mt-2 text-xs text-[var(--muted)]">{aLabel}: {a} • {bLabel}: {b}</div>
          </div>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <g transform="translate(40,40)">
              <circle r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="10" />
              <circle r={r} fill="none" stroke="#a86fff" strokeWidth="10" strokeDasharray={`${sa} ${c}`} transform="rotate(-90)" />
              <circle r={r} fill="none" stroke="#5aa8ff" strokeWidth="10" strokeDasharray={`${sb} ${c}`} transform={`rotate(${(pa*3.6)-90})`} />
            </g>
          </svg>
        </div>
      </CardBody>
    </Card>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  // Measure container width to render full-width without distorting text
  const [width, setWidth] = useState<number>(0);
  const ref = useMemo(() => ({ current: null as null | HTMLDivElement }), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new (window as any).ResizeObserver((entries: any[]) => {
      for (const e of entries) {
        const w = Math.max(0, Math.floor(e.contentRect.width));
        if (w && w !== width) setWidth(w);
      }
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref, width]);

  const W = Math.max(200, width || 0);
  const H = 112; // ~ h-28
  const max = Math.max(1, ...data);
  const px = 28; // left padding for y labels
  const pyTop = 8;
  const pyBottom = 22; // extra space for x-axis labels
  const innerW = Math.max(1, W - px * 2);
  const innerH = Math.max(1, H - pyTop - pyBottom);
  const n = Math.max(1, data.length - 1);

  const points = data
    .map((v, i) => {
      const x = px + (i / (n || 1)) * innerW;
      const y = pyTop + innerH - (Math.max(0, v) / max) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  // Choose up to 7 x-ticks for more spread over full width
  const xTicks = Math.min(7, data.length);
  const xTickIdxs = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i / ((xTicks - 1) || 1)) * (data.length - 1))
  );
  const yTicks = 4;

  return (
    <div ref={(ref as any)} className="w-full">
      <svg width={W} height={H} className="block">
        {/* Axes */}
        <line x1={px} y1={pyTop} x2={px} y2={pyTop + innerH} stroke="currentColor" strokeOpacity="0.25" />
        <line x1={px} y1={pyTop + innerH} x2={px + innerW} y2={pyTop + innerH} stroke="currentColor" strokeOpacity="0.25" />

        {/* Y ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = (max * i) / yTicks;
          const yy = pyTop + innerH - (val / max) * innerH;
          return (
            <g key={`yt${i}`}>
              <line x1={px - 3} x2={px} y1={yy} y2={yy} stroke="currentColor" strokeOpacity="0.4" />
              <text x={px - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.75">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* X ticks */}
        {xTickIdxs.map((idx, i) => {
          const xx = px + (idx / (data.length - 1 || 1)) * innerW;
          const label = labels[idx] || String(idx + 1);
          const baseY = pyTop + innerH;
          return (
            <g key={`xt${i}`}>
              <line x1={xx} x2={xx} y1={baseY} y2={baseY + 4} stroke="currentColor" strokeOpacity="0.4" />
              <text x={xx} y={baseY + 12} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.75">
                {label}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline fill="none" stroke="#a86fff" strokeWidth="2" points={points} />
      </svg>
    </div>
  );
}




