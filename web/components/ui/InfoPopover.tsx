"use client";

import { useEffect, useRef, useState } from "react";

export default function InfoPopover({
  children,
  label = "i",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node | null;
      if (ref.current && t && !ref.current.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block align-middle">
      <button
        type="button"
        aria-label="More info"
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] text-[var(--muted)] hover:bg-white/20"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 w-64 rounded-md border border-white/10 bg-[var(--panel-2)] p-2 text-xs shadow-lg"
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}

