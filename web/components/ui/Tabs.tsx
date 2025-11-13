"use client";
import { useState } from "react";

export function Tabs({
  tabs,
  defaultTab = 0,
}: {
  tabs: { label: string; icon?: React.ReactNode; content: React.ReactNode }[];
  defaultTab?: number;
}) {
  const [i, setI] = useState(defaultTab);
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {tabs.map((t, idx) => (
          <button
            key={t.label}
            onClick={() => setI(idx)}
            className={`h-9 px-3 rounded-md text-sm border inline-flex items-center gap-2 ${
              idx === i ? "bg-white/10 border-white/20" : "border-white/10 hover:bg-white/5"
            }`}
            aria-current={idx === i ? "page" : undefined}
          >
            {t.icon ? <span aria-hidden>{t.icon}</span> : null}
            <span className="whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </div>
      <div>{tabs[i].content}</div>
    </div>
  );
}
