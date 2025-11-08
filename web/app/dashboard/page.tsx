"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import TemplateRail from "@/components/dashboard/TemplateRail";
import RecentSessions from "@/components/dashboard/RecentSessions";
import SuggestedActions from "@/components/dashboard/SuggestedActions";

type Sess = {
  id: string;
  name: string;
  status: string;
  join_code: string;
  created_at: string;
};

type DashboardPayload = {
  sessions: Sess[];
  stats: {
    participants: number;
    brainstorm: number;
    stocktake: number;
  };
};

export default function Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/dashboard/overview", {
          cache: "no-store",
          signal: ac.signal,
        });

        // Handle unauthorized or server error without exploding UI
        if (!res.ok) {
          // 401/403 can happen if auth failed server-side
          setError("Unable to load dashboard. Please sign in again.");
          setLoading(false);
          return;
        }

        const json = (await res.json()) as any;
        const sessions = Array.isArray(json.sessions) ? json.sessions : [];
        const stats = json.stats ?? {};

        setData({
          sessions,
          stats: {
            participants: Number(stats.participants || 0),
            brainstorm: Number(stats.brainstorm || 0),
            stocktake: Number(stats.stocktake || 0),
          },
        });
      } catch (err) {
        // Fetch was aborted or network failed
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("dashboard load failed", err);
          setError("Network error loading dashboard.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => ac.abort();
  }, []);

  // Derived KPIs
  const stats = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const total = sessions.length;
    const active = sessions.filter((s) => s.status === "Active").length;
    const completed = sessions.filter((s) => s.status === "Completed").length;
    const inactive = sessions.filter((s) => s.status === "Inactive" || s.status === "Draft").length;

    const brainstorm = data?.stats.brainstorm ?? 0;
    const stocktake = data?.stats.stocktake ?? 0;

    return {
      total,
      active,
      participants: data?.stats.participants ?? 0,
      brainstorm,
      stocktake,
      completed,
      inactive,
    };
  }, [data]);

  // Sessions by day (last 14 days)
  const sessionsByDay = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const map = new Map<string, number>();
    const days = 14;
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }

    sessions.forEach((s) => {
      const ts = new Date(s.created_at);
      if (!Number.isNaN(ts.valueOf())) {
        const key = ts.toISOString().slice(0, 10);
        if (map.has(key)) {
          map.set(key, (map.get(key) || 0) + 1);
        }
      }
    });

    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="dashboard-hero relative overflow-hidden rounded-[var(--radius)] border border-white/10 bg-gradient-to-r from-[var(--panel-2)]/90 to-[var(--panel)]/90 p-5">
        <div className="hero-bubble absolute -top-16 -right-16 h-64 w-64 rounded-full bg-[var(--brand)]/25 blur-3xl" />
        <div className="hero-bubble absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#5aa8ff]/20 blur-3xl" />
        <div className="hero-accent absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent opacity-70" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Control Center
            </div>
            <h1 className="mt-1 text-xl font-semibold">Welcome back</h1>
            <div className="mt-1 text-sm text-[var(--muted)]">
              Create, facilitate and export results.
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/sessions?new=1")}>
              New Session
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KPI title="Sessions" value={String(stats.total)} />
        <KPI title="Active now" value={String(stats.active)} />
        <KPI title="Participants" value={String(stats.participants)} />
        <StatusBreakdown
          active={stats.active}
          completed={stats.completed}
          inactive={stats.inactive}
        />
      </div>

      {/* Templates rail */}
      <TemplateRail />

      {/* Suggestions */}
      <SuggestedActions sessions={(data?.sessions ?? []) as any} stats={data?.stats ?? { participants: 0, brainstorm: 0, stocktake: 0 }} />

      {/* Sessions in last 14 days */}
      <Card>
        <CardHeader
          title="Sessions last 14 days"
          subtitle="Activity over time"
        />
        <CardBody className="p-0">
          <Sparkline
            data={sessionsByDay.map(([, v]) => v)}
            labels={sessionsByDay.map(([k]) => k.slice(5))}
          />
        </CardBody>
      </Card>

      {/* Recent sessions */}
      <RecentSessions />
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardBody className="p-0">
        <div className="text-sm text-[var(--muted)]">{title}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardBody>
    </Card>
  );
}

function StatusBreakdown({ active, completed, inactive }: { active: number; completed: number; inactive: number }) {
  const total = Math.max(active + completed + inactive, 1);
  const w = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <Card>
      <CardBody className="p-0">
        <div className="text-sm text-[var(--muted)]">Sessions by status</div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-green-500/40" style={{ width: w(active) }} />
          <div className="-mt-2 h-2 bg-rose-500/40" style={{ width: w(completed) }} />
          <div className="-mt-2 h-2 bg-white/20" style={{ width: w(inactive) }} />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400/80" />Active: {active}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-400/80" />Completed: {completed}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-white/50" />Inactive: {inactive}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  const [width, setWidth] = useState<number>(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(0, Math.floor(e.contentRect.width));
        setWidth((prev) => (prev === w || !w ? prev : w));
      }
    });

    ro.observe(el);
    // initialize immediately
    setWidth(el.clientWidth);

    return () => {
      ro.disconnect();
    };
  }, []);

  const W = Math.max(200, width || 0);
  const H = 112;
  const max = Math.max(1, ...data);
  const px = 28;
  const pyTop = 8;
  const pyBottom = 22;
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

  const xTicks = Math.min(7, data.length);
  const xTickIdxs = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i / ((xTicks - 1) || 1)) * (data.length - 1))
  );
  const yTicks = 4;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={W}
        height={H}
        className="block"
        role="img"
        aria-label="Sessions in the last 14 days"
      >
        {/* Axes */}
        <line
          x1={px}
          y1={pyTop}
          x2={px}
          y2={pyTop + innerH}
          stroke="currentColor"
          strokeOpacity="0.25"
        />
        <line
          x1={px}
          y1={pyTop + innerH}
          x2={px + innerW}
          y2={pyTop + innerH}
          stroke="currentColor"
          strokeOpacity="0.25"
        />

        {/* Y ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = (max * i) / yTicks;
          const yy = pyTop + innerH - (val / max) * innerH;
          return (
            <g key={`yt${i}`}>
              <line
                x1={px - 3}
                x2={px}
                y1={yy}
                y2={yy}
                stroke="currentColor"
                strokeOpacity="0.4"
              />
              <text
                x={px - 6}
                y={yy + 3}
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
                opacity="0.75"
              >
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
              <line
                x1={xx}
                x2={xx}
                y1={baseY}
                y2={baseY + 4}
                stroke="currentColor"
                strokeOpacity="0.4"
              />
              <text
                x={xx}
                y={baseY + 12}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                opacity="0.75"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          fill="none"
          stroke="#a86fff"
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  );
}
