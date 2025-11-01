"use client";

import Button from "@/components/ui/Button";

type Props = {
  draft: any;
  onChange: (fn: (prev: any) => any) => void;
  onManageInitiatives?: () => void;
};

export default function StocktakeConfig({ draft, onChange, onManageInitiatives }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--muted)]">
        Manage the list of initiatives from the Actions menu or the button below.
      </div>
      {onManageInitiatives && (
        <Button size="sm" variant="outline" onClick={onManageInitiatives}>Open initiatives</Button>
      )}
      <div className="flex gap-3">
        <label className="w-28 pt-2 text-sm">Time limit</label>
        <input
          type="number"
          min={30}
          step={30}
          value={Number(draft?.time_limit_sec ?? 300)}
          onChange={(e) => onChange((prev) => ({ ...prev, time_limit_sec: Number(e.target.value) }))}
          className="h-10 w-36 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
        />
        <span className="text-sm text-[var(--muted)]">seconds</span>
      </div>
    </div>
  );
}

