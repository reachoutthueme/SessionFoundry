"use client";

type Props = {
  draft: any;
  onChange: (fn: (prev: any) => any) => void;
};

export default function StandardAssignmentConfig({ draft, onChange }: Props) {
  const voting = !!draft?.voting_enabled;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="w-28 text-sm">Voting</label>
        <input
          type="checkbox"
          checked={voting}
          onChange={(e) => onChange((prev) => ({ ...prev, voting_enabled: !!e.target.checked }))}
          aria-label="Participants can vote"
        />
        <span className="text-sm text-[var(--muted)]">Participants can vote</span>
      </div>

      <div className="flex gap-3">
        <label className="w-28 pt-2 text-sm">Max submissions</label>
        <input
          type="number"
          min={1}
          max={50}
          value={Number(draft?.max_submissions ?? 5)}
          onChange={(e) => onChange((prev) => ({ ...prev, max_submissions: Number(e.target.value) }))}
          className="h-10 w-28 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
        />
      </div>

      {voting && (
        <div className="flex gap-3">
          <label className="w-28 pt-2 text-sm">Points budget</label>
          <input
            type="number"
            min={1}
            value={Number(draft?.points_budget ?? 100)}
            onChange={(e) => onChange((prev) => ({ ...prev, points_budget: Number(e.target.value) }))}
            className="h-10 w-28 rounded-md border border-white/10 bg-[var(--panel)] px-3 outline-none"
          />
          <span className="text-sm text-[var(--muted)]">total points to distribute</span>
        </div>
      )}

      {Array.isArray(draft?.prompts) && (
        <div className="flex gap-3">
          <label className="w-28 pt-2 text-sm">Prompts</label>
          <textarea
            value={draft.prompts.join("\n")}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                prompts: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="One prompt per line"
            className="flex-1 min-h-24 rounded-md border border-white/10 bg-[var(--panel)] px-3 py-2 outline-none"
          />
        </div>
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

