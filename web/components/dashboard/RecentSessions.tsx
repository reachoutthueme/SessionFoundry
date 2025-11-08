"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Recent = {
  id: string;
  name: string;
  status: string;
  join_code?: string;
  created_at?: string;
  last_viewed_at?: string;
  participants?: number;
  activities?: number;
};

const PIN_KEY = "sf_pinned_sessions";
const LS_RECENT_KEY = "sf_recent_sessions";

function usePinned(): [Set<string>, (id: string) => void] {
  const [pins, setPins] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      setPins(new Set(arr.filter(Boolean)));
    } catch {}
  }, []);
  function toggle(id: string) {
    setPins((prev) => {
      const n = new Set(Array.from(prev));
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try {
        localStorage.setItem(PIN_KEY, JSON.stringify(Array.from(n)));
      } catch {}
      return n;
    });
  }
  return [pins, toggle];
}

function relative(t?: string) {
  if (!t) return "";
  const d = new Date(t).valueOf();
  if (!Number.isFinite(d)) return "";
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RecentSessions() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Recent[]>([]);
  const [pins, togglePin] = usePinned();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/sessions/recent?limit=6", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setRows(Array.isArray(j.sessions) ? j.sessions : []);
        } else {
          // Fallback to localStorage
          const raw = localStorage.getItem(LS_RECENT_KEY);
          const arr: any[] = raw ? JSON.parse(raw) : [];
          setRows(
            arr
              .filter((x) => x && x.id)
              .slice(0, 6)
          );
        }
      } catch (e) {
        // Fallback to localStorage on network error
        try {
          const raw = localStorage.getItem(LS_RECENT_KEY);
          const arr: any[] = raw ? JSON.parse(raw) : [];
          setRows(arr.filter((x) => x && x.id).slice(0, 6));
        } catch {}
        setError("Failed to load recent sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ordered = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const ap = pins.has(a.id) ? 1 : 0;
      const bp = pins.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap; // pinned first
      const at = new Date(a.last_viewed_at || a.created_at || 0).valueOf();
      const bt = new Date(b.last_viewed_at || b.created_at || 0).valueOf();
      return bt - at;
    });
    return list;
  }, [rows, pins]);

  return (
    <Card>
      <CardHeader title="Recently viewed" subtitle="Quickly jump back into work" />
      <CardBody className="p-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)]">
            No recent sessions — start with a template above.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((s) => (
              <div key={s.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{s.name}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                      {s.status} • {relative(s.last_viewed_at || s.created_at)}
                    </div>
                  </div>
                  <button
                    title={pins.has(s.id) ? "Unpin" : "Pin"}
                    aria-label={pins.has(s.id) ? "Unpin session" : "Pin session"}
                    className={`rounded px-2 py-1 text-xs ${pins.has(s.id) ? "bg-[var(--brand)] text-[var(--btn-on-brand)]" : "border border-white/10 text-[var(--muted)] hover:bg-white/5"}`}
                    onClick={() => togglePin(s.id)}
                  >
                    {pins.has(s.id) ? "Pinned" : "Pin"}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <div className="inline-flex gap-3">
                    {typeof s.participants === "number" && (
                      <span>{s.participants} participants</span>
                    )}
                    {typeof s.activities === "number" && (
                      <span>{s.activities} activities</span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/session/${s.id}`)}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

