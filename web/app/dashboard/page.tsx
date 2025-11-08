"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
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
          credentials: "include",
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

  // KPIs and sparkline removed per redesign

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

      {/* KPI and graph removed */}

      {/* Templates + Suggestions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TemplateRail />
        <SuggestedActions sessions={(data?.sessions ?? []) as any} stats={data?.stats ?? { participants: 0, brainstorm: 0, stocktake: 0 }} />
      </div>

      {/* Recent sessions */}
      <RecentSessions />
    </div>
  );
}

// KPI, StatusBreakdown, and Sparkline removed per redesign

