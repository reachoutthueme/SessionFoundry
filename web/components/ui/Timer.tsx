"use client";
import { useEffect, useMemo, useState } from "react";

export default function Timer({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const rem = useMemo(() => new Date(endsAt).getTime() - now, [endsAt, now]);
  if (Number.isNaN(rem)) return null;
  if (rem <= 0) return <span className="text-red-300">Time's up</span>;
  const s = Math.floor(rem / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return <span className="text-xs text-[var(--muted)]">{mm}:{ss} remaining</span>;
}

