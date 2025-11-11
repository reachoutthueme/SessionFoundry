"use client";

import React from "react";

type StatusKind = "Active" | "Closed" | "Queued" | "Overdue" | "Voting" | "Inactive";

export function StatusPill({
  status,
  label,
}: {
  status: StatusKind;
  label?: string;
}) {
  const tone =
    status === "Active" || status === "Voting"
      ? "status-chip-active border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
      : status === "Closed"
      ? "status-chip-closed border-zinc-400/30 text-zinc-200 bg-white/5"
      : status === "Overdue"
      ? "status-chip-overdue border-rose-400/40 text-rose-200 bg-rose-500/10"
      : status === "Queued" || status === "Inactive"
      ? "status-chip-queued border-white/15 text-[var(--muted)] bg-white/5"
      : "status-chip-queued border-white/15 text-[var(--muted)] bg-white/5";

  const text = label || status;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
        status === "Active" || status === "Voting"
          ? "status-dot-active bg-emerald-300"
          : status === "Closed"
          ? "status-dot-closed bg-zinc-300"
          : status === "Overdue"
          ? "status-dot-overdue bg-rose-300"
          : "status-dot-queued bg-white/60"
      }`} />
      {text}
    </span>
  );
}
