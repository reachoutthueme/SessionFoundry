// components/ui/Card.tsx
import React from "react";
export function Card({ children, className="" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded-[var(--radius)] border border-white/10 bg-[var(--panel-2)] shadow-[0_8px_30px_rgba(0,0,0,.12)] ${className}`}>{children}</div>;
}
export function CardBody({ children, className="" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
export function CardHeader({ title, subtitle, rightSlot }: { title: React.ReactNode; subtitle?: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-white/10">
      <div className="flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2">{title}</div>
        {rightSlot && <div className="ml-4">{rightSlot}</div>}
      </div>
      {subtitle && <div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div>}
    </div>
  );
}
