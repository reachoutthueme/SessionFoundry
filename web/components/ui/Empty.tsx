// components/Empty.tsx
export default function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-white/15 rounded-[var(--radius)] p-10 text-center">
      <div className="text-sm text-[var(--muted)]">{title}</div>
      {hint && <div className="text-xs text-[var(--muted)]/80 mt-2">{hint}</div>}
    </div>
  );
}