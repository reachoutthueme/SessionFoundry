export default function ProTag({ className = "" }: { className?: string }) {
  return (
    <span className={`ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border border-[var(--brand)]/40 text-[var(--brand)] bg-[var(--brand)]/10 align-middle ${className}`}>
      Pro
    </span>
  );
}
